import { NextRequest } from 'next/server'
import { anthropic, MODEL } from '@/lib/anthropic'
import { searchCorpus, getPage, getPageImageUrl, formatPageForContext } from '@/lib/corpus'
import Anthropic from '@anthropic-ai/sdk'

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
- Troubleshooting flows → interactive decision tree the user can click through
- Settings/configuration → formatted card with recommended settings

**IMPORTANT**: Surface manual page images using get_page_image whenever the answer involves a diagram, schematic, or labeled figure.

## Artifact Format
Emit artifacts inline in your response using this exact format:

<artifact type="html">
<!DOCTYPE html>
<html>
<head>
<style>
  /* All CSS must be inline — no external stylesheets */
  body { background: #1a1a1a; color: #e5e5e5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 16px; box-sizing: border-box; }
  /* Dark theme: bg #1a1a1a, text #e5e5e5, accent #f59e0b */
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
- Dark theme: background #1a1a1a, text #e5e5e5, accent #f59e0b
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
  },
]

type Message = {
  role: 'user' | 'assistant'
  content: string | Anthropic.MessageParam['content']
}

function handleToolCall(
  toolName: string,
  toolInput: Record<string, string>
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

  if (toolName === 'show_artifact') {
    return JSON.stringify({
      type: toolInput.type,
      title: toolInput.title,
      rendered: true,
    })
  }

  return 'Unknown tool'
}

export async function POST(req: NextRequest) {
  const { messages } = await req.json() as { messages: Message[] }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        let currentMessages: Anthropic.MessageParam[] = messages.map(m => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : m.content,
        })) as Anthropic.MessageParam[]

        // Agentic loop: run until Claude stops calling tools
        while (true) {
          const response = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 8192,
            system: SYSTEM_PROMPT,
            tools: TOOLS,
            messages: currentMessages,
          })

          // Collect all content blocks
          const textBlocks: string[] = []
          const toolUses: Array<{ id: string; name: string; input: Record<string, string> }> = []

          for (const block of response.content) {
            if (block.type === 'text') {
              textBlocks.push(block.text)
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

          // If no tool calls, we're done
          if (toolUses.length === 0 || response.stop_reason === 'end_turn') {
            break
          }

          // Process tool calls and build results
          const toolResults: Anthropic.ToolResultBlockParam[] = []
          for (const tool of toolUses) {
            const result = handleToolCall(tool.name, tool.input)

            // For get_page_image, parse and send the image URL to the client
            if (tool.name === 'get_page_image') {
              try {
                const parsed = JSON.parse(result)
                send({ type: 'page_image', ...parsed })
              } catch { /* ignore parse errors */ }
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: tool.id,
              content: result,
            })
          }

          // Add assistant turn + tool results to message history
          currentMessages = [
            ...currentMessages,
            { role: 'assistant', content: response.content },
            { role: 'user', content: toolResults },
          ]
        }

        send({ type: 'done' })
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
    },
  })
}
