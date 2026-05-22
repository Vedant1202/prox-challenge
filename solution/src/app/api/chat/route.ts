import { NextRequest, NextResponse } from 'next/server'
import { anthropic, resolveModel } from '@/lib/anthropic'
import { searchCorpus, getPage, getPageImageUrl, formatPageForContext } from '@/lib/corpus'
import { getDb } from '@/lib/db'
import { checkRateLimit } from '@/lib/rate-limit'
import Anthropic from '@anthropic-ai/sdk'
import { randomUUID, createHash } from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 60

const SYSTEM_PROMPT = `You are the expert support assistant for the Vulcan OmniPro 220 multiprocess welder. You help users — typically someone standing in their garage trying to set up or troubleshoot their welder — answer technical questions accurately and helpfully.

## Your Knowledge
You have access to the complete owner's manual, quick start guide, and process selection chart for the Vulcan OmniPro 220. Always call search_corpus before answering technical questions. Cite page numbers.

## Tone
- Helpful and direct, like a knowledgeable friend who knows welding
- Not condescending, not overly technical
- Assume the user is competent but not a professional welder
- If something is dangerous, say so clearly without being alarmist

## Multimodal Responses
When a visual would significantly help the user understand, generate an artifact. You MUST generate artifacts for:
- Polarity setup questions → SVG diagram of the front panel showing which cable goes where
- Duty cycle questions → visual gauge or table showing the duty cycle at given settings
- Troubleshooting flows or multi-step setup procedures → call \`show_checklist\` with title + ordered items. Do NOT generate HTML for checklists. After calling show_checklist, the checklist is displayed automatically in the chat — add only a short text follow-up.
- Settings/configuration → formatted card with recommended settings

**IMPORTANT**: Surface manual page images using get_page_image whenever the answer involves a diagram, schematic, or labeled figure.

## Artifact Format
Emit artifacts inline in your response using this exact format:

<artifact type="html">
<!DOCTYPE html>
<html>
<head>
<style>
  /* ── Theme tokens — the host app overrides these for light/dark switching ── */
  :root {
    --color-bg:      #0a0a1a;
    --color-surface: #1a1a2e;
    --color-border:  rgba(129,140,248,0.15);
    --color-text:    #e2e8f0;
    --color-muted:   #94a3b8;
    --color-accent:  #f59e0b;
  }
  /* ── Always use var(--color-*) — NEVER hardcode hex colors ── */
  * { box-sizing: border-box; }
  body { background: var(--color-bg); color: var(--color-text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 16px; }
</style>
</head>
<body>
  <!-- Self-contained interactive component. No external JS/CSS/image dependencies. -->
</body>
</html>
</artifact>

Artifact rules:
- ALL CSS inline in <style> tags — never reference external stylesheets
- No external JS libraries — use only vanilla JS
- Only use data values confirmed in the manual (no invented specs)
- ALWAYS use CSS custom properties (var(--color-bg), var(--color-text), var(--color-accent), var(--color-surface), var(--color-border), var(--color-muted)) for ALL color values — NEVER hardcode hex colors. The host app injects theme overrides.
- Make it interactive where appropriate (clickable flowcharts, hover states, sliders)
- The artifact replaces an explanation, not supplements it — make it self-explanatory

## Conversational Follow-up
After providing a diagnosis or fix:
1. End with a short follow-up: "Give that a try — did it fix the issue?"
2. If the user confirms it worked: acknowledge, then offer one tip to prevent the issue recurring
3. If the user says it didn't work: ask ONE targeted clarifying question, then search again with new context
4. Never suggest the same fix twice in the same conversation
5. If you've exhausted corpus-backed suggestions, say so honestly and recommend Harbor Freight support

## Accuracy
- Never state specifications not found in the corpus
- Always cite page numbers when giving technical specs
- If you're unsure, say so — don't guess on safety-critical info`

// ── Prompt caching ────────────────────────────────────────────────────────────
// The system prompt and tool definitions are static across every request.
// Marking them with cache_control tells the API to store the KV computation
// so subsequent calls reuse it instead of reprocessing those tokens.

const CACHED_SYSTEM: Anthropic.TextBlockParam[] = [
  { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
]

// cache_control on the last tool creates a second cache breakpoint covering
// system + all tools together.
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_corpus',
    description: 'Search the Vulcan OmniPro 220 manual corpus for pages relevant to the query. Returns structured page data including key facts, tables, diagrams, and text. Always call this before answering technical questions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'The search query — use specific technical terms like "duty cycle MIG 240V" or "TIG polarity setup" or "flux cored porosity troubleshooting"',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_page_image',
    description: 'Get the image URL for a specific manual page to surface the actual diagram/schematic/photo in the response. Use this when the answer involves a visual element like a connection diagram, front panel, or weld diagnosis photo.',
    input_schema: {
      type: 'object' as const,
      properties: {
        page_id: {
          type: 'string',
          description: 'The page ID from search results, e.g. "owner-manual-018" or "quick-start-003"',
        },
      },
      required: ['page_id'],
    },
  },
  {
    name: 'show_checklist',
    description: 'Display a step-by-step checklist in the chat UI. Call this for troubleshooting flows, setup procedures, or any multi-step process. Provide structured data — the UI renders the interactive component. Do NOT also write the steps as a numbered list in your text.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Title for the checklist, e.g. "MIG Setup Checklist"' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              step: { type: 'string', description: 'Short action label, 5–8 words' },
              description: { type: 'string', description: 'Detailed instruction for this step' },
            },
            required: ['step', 'description'],
          },
        },
      },
      required: ['title', 'items'],
    },
  },
  {
    name: 'show_artifact',
    description: 'Signal to the frontend to render an interactive HTML artifact. Use this to trigger the display of a visual component like a polarity diagram, duty cycle gauge, or troubleshooting flowchart. The artifact HTML should also be emitted inline in your text response using <artifact> tags.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          enum: ['polarity_diagram', 'duty_cycle', 'troubleshooting', 'settings', 'custom'],
          description: 'The type of artifact being shown',
        },
        title: {
          type: 'string',
          description: 'A short title for the artifact panel',
        },
      },
      required: ['type', 'title'],
    },
    cache_control: { type: 'ephemeral' as const },
  },
]

// ── History caching helper ────────────────────────────────────────────────────
// Marks the last content block of the message just before the current user turn
// so the full prior conversation is cached as a third breakpoint. Each new turn
// only pays for the two new messages (user + assistant), not the whole history.
function withHistoryCacheMarker(msgs: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  // Need at least 2 messages to have history worth caching
  if (msgs.length < 2) return msgs

  return msgs.map((m, i) => {
    if (i !== msgs.length - 2) return m  // only mark the penultimate message

    const content = m.content
    if (typeof content === 'string') {
      return { ...m, content: [{ type: 'text' as const, text: content, cache_control: { type: 'ephemeral' as const } }] }
    }
    if (Array.isArray(content) && content.length > 0) {
      const blocks = [...content]
      const last = blocks[blocks.length - 1]
      if (last.type === 'text' || last.type === 'tool_result') {
        blocks[blocks.length - 1] = { ...last, cache_control: { type: 'ephemeral' as const } }
      }
      return { ...m, content: blocks }
    }
    return m
  })
}

type Message = {
  role: 'user' | 'assistant'
  content: string | Anthropic.MessageParam['content']
}

function handleToolCall(
  toolName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolInput: Record<string, any>
): string {
  if (toolName === 'search_corpus') {
    const pages = searchCorpus(toolInput.query, 5)
    if (pages.length === 0) {
      return 'No relevant pages found in the corpus for this query.'
    }
    return pages.map(formatPageForContext).join('\n\n---\n\n')
  }

  if (toolName === 'get_page_image') {
    const page = getPage(toolInput.page_id)
    if (!page) {
      return `Page ${toolInput.page_id} not found in corpus.`
    }
    const url = getPageImageUrl(toolInput.page_id)
    return JSON.stringify({
      page_id: page.id,
      url,
      page_num: page.page,
      source: page.source,
      summary: page.summary,
    })
  }

  if (toolName === 'show_checklist') {
    return JSON.stringify({ rendered: true, item_count: (toolInput.items as unknown[]).length })
  }

  if (toolName === 'show_artifact') {
    return JSON.stringify({
      type: toolInput.type,
      title: toolInput.title,
      rendered: true,
    })
  }

  return 'Unknown tool'
}

interface CollectedPageImage {
  page_id: string
  url: string
  page_num: number
  source: string
  summary?: string
}

function shouldShowByDefault(pageNum: number, text: string): boolean {
  const lower = text.toLowerCase()
  const patterns = [
    `p. ${pageNum}`,
    `page ${pageNum}`,
    `pg ${pageNum}`,
    `p${pageNum}`,
    `p.${pageNum}`,
  ]
  return patterns.some(p => lower.includes(p))
}

function extractIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { messages: Message[]; chatId?: string; model?: string }
  const { messages, chatId } = body
  const requestedModel = body.model ?? null

  // Rate limiting
  const ip = extractIp(req)
  const fingerprint = req.headers.get('x-client-fingerprint') ?? 'unknown'
  const clientKey = createHash('sha256').update(`${ip}:${fingerprint}`).digest('hex')
  const rl = checkRateLimit(clientKey)

  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', reset_at: rl.reset_at, retry_after_ms: rl.retry_after_ms, used: rl.used, limit: rl.limit },
      { status: 429 }
    )
  }

  const model = resolveModel(
    process.env.MODEL_SWITCHING_ALLOWED === 'true' ? requestedModel : null
  )

  // Identify the last user message for persistence
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // Apply history cache marker: marks the message just before the current
        // user turn so the prior conversation is cached as a third breakpoint.
        let currentMessages = withHistoryCacheMarker(
          messages.map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : m.content,
          })) as Anthropic.MessageParam[]
        )

        let fullText = ''
        const collectedPageImages: CollectedPageImage[] = []
        let collectedChecklist: { title: string; items: Array<{ step: string; description: string }> } | null = null

        // Accumulate token usage across all agentic loop iterations
        let cacheCreationTokens = 0
        let cacheReadTokens = 0
        let inputTokens = 0
        let outputTokens = 0

        // Agentic loop: run until Claude stops calling tools
        while (true) {
          const response = await anthropic.messages.create({
            model,
            max_tokens: 8192,
            system: CACHED_SYSTEM,
            tools: TOOLS,
            messages: currentMessages,
          })

          // Accumulate usage (cache_creation/cache_read available when caching fires)
          const u = response.usage as Anthropic.Usage & { cache_creation_input_tokens?: number; cache_read_input_tokens?: number }
          cacheCreationTokens += u.cache_creation_input_tokens ?? 0
          cacheReadTokens     += u.cache_read_input_tokens     ?? 0
          inputTokens         += u.input_tokens
          outputTokens        += u.output_tokens

          const toolUses: Array<{ id: string; name: string; input: Record<string, string> }> = []

          for (const block of response.content) {
            if (block.type === 'text') {
              fullText += block.text
              send({ type: 'text', text: block.text })
            } else if (block.type === 'tool_use') {
              toolUses.push({
                id: block.id,
                name: block.name,
                input: block.input as Record<string, string>,
              })
              send({ type: 'tool_call', name: block.name, input: block.input })
            }
          }

          if (toolUses.length === 0 || response.stop_reason === 'end_turn') {
            break
          }

          const toolResults: Anthropic.ToolResultBlockParam[] = []
          for (const tool of toolUses) {
            const result = handleToolCall(tool.name, tool.input)

            if (tool.name === 'get_page_image') {
              try {
                const parsed = JSON.parse(result) as CollectedPageImage
                collectedPageImages.push(parsed)
              } catch { /* ignore */ }
            }

            if (tool.name === 'show_checklist') {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const inp = tool.input as any
              collectedChecklist = { title: inp.title, items: inp.items }
              send({ type: 'checklist', title: inp.title, items: inp.items })
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: tool.id,
              content: result,
            })
          }

          currentMessages = [
            ...currentMessages,
            { role: 'assistant', content: response.content },
            { role: 'user', content: toolResults },
          ]
        }

        // Orchestration pass: emit page_image events with show_by_default computed from final text
        for (const img of collectedPageImages) {
          send({
            type: 'page_image',
            ...img,
            show_by_default: shouldShowByDefault(img.page_num, fullText),
          })
        }

        send({
          type: 'done',
          usage: { cache_creation: cacheCreationTokens, cache_read: cacheReadTokens, input: inputTokens, output: outputTokens },
        })

        // Persist to SQLite if chatId provided
        if (chatId) {
          try {
            const db = getDb()
            const now = Date.now()

            // Auto-create chat row if missing
            const existing = db.prepare('SELECT id, title FROM chats WHERE id = ?').get(chatId) as { id: string; title: string } | undefined
            if (!existing) {
              const title = (typeof lastUserMessage?.content === 'string'
                ? lastUserMessage.content
                : 'New Chat'
              ).slice(0, 60)
              db.prepare('INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)').run(chatId, title, now, now)
            } else if (existing.title === 'New Chat' && lastUserMessage) {
              const title = (typeof lastUserMessage.content === 'string'
                ? lastUserMessage.content
                : 'New Chat'
              ).slice(0, 60)
              db.prepare('UPDATE chats SET title = ?, updated_at = ? WHERE id = ?').run(title, now, chatId)
            } else {
              db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(now, chatId)
            }

            // Save user message (only the last one — prior turns were already saved)
            if (lastUserMessage && typeof lastUserMessage.content === 'string') {
              db.prepare(
                'INSERT OR IGNORE INTO messages (id, chat_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
              ).run(randomUUID(), chatId, 'user', lastUserMessage.content, now - 1)
            }

            // Save assistant message
            db.prepare(
              'INSERT INTO messages (id, chat_id, role, content, page_images, checklist, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
            ).run(
              randomUUID(),
              chatId,
              'assistant',
              fullText,
              collectedPageImages.length > 0 ? JSON.stringify(
                collectedPageImages.map(img => ({
                  ...img,
                  show_by_default: shouldShowByDefault(img.page_num, fullText),
                }))
              ) : null,
              collectedChecklist ? JSON.stringify(collectedChecklist) : null,
              now,
            )
          } catch (dbErr) {
            console.error('DB persist error:', dbErr)
          }
        }
      } catch (err) {
        send({ type: 'error', message: String(err) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Rate-Limit-Used': String(rl.used),
      'X-Rate-Limit-Limit': String(rl.limit),
      'X-Rate-Limit-Reset': String(rl.reset_at),
    },
  })
}
