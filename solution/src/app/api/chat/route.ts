/**
 * POST /api/chat
 *
 * Streaming chat endpoint. Accepts a JSON body with `messages`, `chatId`, and
 * optional `model`. Runs an agentic loop (tools: search_corpus, get_page_image,
 * show_checklist, show_artifact) and streams SSE events back to the client.
 *
 * SSE event types: text | tool_call | page_image | artifact | checklist | done | error
 */
import { NextRequest, NextResponse } from "next/server";
import { anthropic, resolveModel } from "@/lib/anthropic";
import { CACHED_SYSTEM, TOOLS, withHistoryCacheMarker } from "@/lib/prompt";
import {
  handleToolCall,
  shouldShowByDefault,
  CollectedPageImage,
  CollectedChecklist,
  CollectedArtifact,
} from "@/lib/tools";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientKey } from "@/lib/client-key";
import { persistChatTurn, StoredPageImage } from "@/lib/storage";

import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── Types ─────────────────────────────────────────────────────────────────────

type Message = {
  role: "user" | "assistant";
  content: string | Anthropic.MessageParam["content"];
};

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    messages: Message[];
    chatId?: string;
    model?: string;
  };
  const { messages, chatId } = body;
  const requestedModel = body.model ?? null;

  // ── Rate limiting ──────────────────────────────────────────────────────────
  const clientKey = getClientKey(req);
  const rl = await checkRateLimit(clientKey);

  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        reset_at: rl.reset_at,
        retry_after_ms: rl.retry_after_ms,
        used: rl.used,
        limit: rl.limit,
      },
      { status: 429 },
    );
  }

  const model = resolveModel(
    process.env.MODEL_SWITCHING_ALLOWED === "true" ? requestedModel : null,
  );

  // The last user message is used for chat title + DB persist
  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user");

  const encoder = new TextEncoder();

  // ── SSE stream ─────────────────────────────────────────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Apply the history cache marker so prior conversation is cached cheaply
        let currentMessages = withHistoryCacheMarker(
          messages.map((m) => ({
            role: m.role,
            content: typeof m.content === "string" ? m.content : m.content,
          })) as Anthropic.MessageParam[],
        );

        // Accumulators for the full response
        let fullText = "";
        const collectedPageImages: CollectedPageImage[] = [];
        let collectedChecklist: CollectedChecklist | null = null;
        let collectedArtifact: CollectedArtifact | null = null;

        // Accumulate token usage across all agentic loop iterations
        let cacheCreationTokens = 0;
        let cacheReadTokens = 0;
        let inputTokens = 0;
        let outputTokens = 0;

        // ── Agentic loop — runs until Claude stops calling tools ────────────
        while (true) {
          const response = await anthropic.messages.create({
            model,
            max_tokens: 8192,
            system: CACHED_SYSTEM,
            tools: TOOLS,
            messages: currentMessages,
          });

          // Accumulate usage (cache fields present when caching fires)
          const u = response.usage as Anthropic.Usage & {
            cache_creation_input_tokens?: number;
            cache_read_input_tokens?: number;
          };
          cacheCreationTokens += u.cache_creation_input_tokens ?? 0;
          cacheReadTokens += u.cache_read_input_tokens ?? 0;
          inputTokens += u.input_tokens;
          outputTokens += u.output_tokens;

          const toolUses: Array<{
            id: string;
            name: string;
            input: Record<string, unknown>;
          }> = [];

          for (const block of response.content) {
            if (block.type === "text") {
              fullText += block.text;
              send({ type: "text", text: block.text });
            } else if (block.type === "tool_use") {
              toolUses.push({
                id: block.id,
                name: block.name,
                input: block.input as Record<string, unknown>,
              });
              send({ type: "tool_call", name: block.name, input: block.input });
            }
          }

          // Exit when Claude has no more tool calls or finishes naturally
          if (toolUses.length === 0 || response.stop_reason === "end_turn")
            break;

          // Execute each tool call, emit side-effect events, collect results
          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const tool of toolUses) {
            const result = handleToolCall(
              tool.name,
              tool.input as Record<string, unknown>,
            );

            if (tool.name === "get_page_image") {
              try {
                const parsed = JSON.parse(result) as CollectedPageImage;
                collectedPageImages.push(parsed);
              } catch {
                /* ignore malformed result */
              }
            }

            if (tool.name === "show_checklist") {
              const inp = tool.input as {
                title: string;
                items: CollectedChecklist["items"];
              };
              collectedChecklist = { title: inp.title, items: inp.items };
              send({ type: "checklist", title: inp.title, items: inp.items });
            }

            if (tool.name === "show_artifact") {
              const inp = tool.input as { html?: string; title: string };
              if (inp.html) {
                collectedArtifact = { html: inp.html, title: inp.title };
                send({ type: "artifact", html: inp.html, title: inp.title });
              }
            }

            toolResults.push({
              type: "tool_result",
              tool_use_id: tool.id,
              content: result,
            });
          }

          // Append assistant turn + tool results and continue the loop
          currentMessages = [
            ...currentMessages,
            { role: "assistant", content: response.content },
            { role: "user", content: toolResults },
          ];
        }

        // Emit page_image events after full text is known (show_by_default needs final text)
        const annotatedPageImages: StoredPageImage[] = collectedPageImages.map(
          (img) => ({
            ...img,
            show_by_default: shouldShowByDefault(img.page_num, fullText),
          }),
        );
        for (const img of annotatedPageImages) {
          send({ type: "page_image", ...img });
        }

        send({
          type: "done",
          usage: {
            cache_creation: cacheCreationTokens,
            cache_read: cacheReadTokens,
            input: inputTokens,
            output: outputTokens,
          },
        });

        // Persist to Neon (failures are caught here so they don't abort the stream)
        if (chatId) {
          try {
            await persistChatTurn({
              clientKey,
              chatId,
              userContent:
                typeof lastUserMessage?.content === "string"
                  ? lastUserMessage.content
                  : undefined,
              assistantContent: fullText,
              pageImages: annotatedPageImages,
              checklist: collectedChecklist,
              artifactHtml: collectedArtifact?.html ?? null,
            });
          } catch (dbErr) {
            console.error("DB persist error:", dbErr);
          }
        }
      } catch (err) {
        send({ type: "error", message: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Rate-Limit-Used": String(rl.used),
      "X-Rate-Limit-Limit": String(rl.limit),
      "X-Rate-Limit-Reset": String(rl.reset_at),
    },
  });
}
