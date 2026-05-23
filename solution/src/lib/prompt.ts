/**
 * System prompt, tool definitions, and conversation-caching utilities for the
 * Vulcan OmniPro 220 assistant.
 *
 * All static content (system prompt + tools) is marked with Anthropic prompt
 * caching so the API stores the KV result across requests (5-minute TTL),
 * avoiding re-processing the same tokens on every turn.
 *
 * Cache layout (3 breakpoints):
 *   1. CACHED_SYSTEM       — system prompt
 *   2. TOOLS (last entry)  — system + all tool definitions
 *   3. withHistoryCacheMarker — system + tools + prior conversation history
 */
import Anthropic from '@anthropic-ai/sdk'

// ── System prompt ─────────────────────────────────────────────────────────────

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
- Troubleshooting flows or multi-step setup procedures → call \`show_checklist\` with title + ordered items. Do NOT generate HTML for checklists. After calling show_checklist, the checklist is displayed automatically in the chat — add only a short text follow-up. Include \`image_id\` on any step that has a relevant manual diagram (e.g. polarity diagram page, wiring schematic). Include \`tips\` (max 3) for practical shortcuts or warnings not already in the description.
- Settings/configuration → formatted card with recommended settings

**IMPORTANT**: Surface manual page images using get_page_image whenever the answer involves a diagram, schematic, labeled figure, or technical table (like a duty cycle table or settings chart).

## Generating Artifacts
When you need to render a visual component, call show_artifact with the complete HTML in the \`html\` parameter. Do NOT emit any <artifact> tags in your text — put the HTML directly in the tool call.

Artifact HTML rules (all required — violations break the UI):
- Must be a complete document: <!DOCTYPE html><html><head>...</head><body>...</body></html>
- ALL CSS must be inline in <style> tags — no external stylesheets
- No external JS libraries — vanilla JS only
- Only use values confirmed in the corpus — no invented specifications
- Use ONLY CSS custom properties for ALL colors — NEVER hardcode hex or rgb values:
  var(--color-bg), var(--color-text), var(--color-accent), var(--color-surface), var(--color-border), var(--color-muted)
  The host app injects dark/light theme overrides through these variables.
- Make it interactive where appropriate (hover states, click, sliders)
- The artifact replaces an explanation — make it self-explanatory
- After calling show_artifact, add a short 1–2 sentence text summary of what it shows

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

/**
 * Wrapped in an array with cache_control so the system prompt tokens are cached
 * after the first call and reused on subsequent calls within the 5-minute TTL.
 */
export const CACHED_SYSTEM: Anthropic.TextBlockParam[] = [
  { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
]

// ── Tool definitions ──────────────────────────────────────────────────────────

/**
 * Tool set available to the assistant. The last entry has cache_control so the
 * entire system + tools block is covered by a single second cache breakpoint.
 */
export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_corpus',
    description:
      'Search the Vulcan OmniPro 220 manual corpus for pages relevant to the query. Returns structured page data including key facts, tables, diagrams, and text. Always call this before answering technical questions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description:
            'The search query — use specific technical terms like "duty cycle MIG 240V" or "TIG polarity setup" or "flux cored porosity troubleshooting"',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_page_image',
    description:
      'Get the image URL for a specific manual page to surface the actual diagram/schematic/photo in the response. Use this when the answer involves a visual element like a connection diagram, front panel, or weld diagnosis photo.',
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
    description:
      'Display a step-by-step checklist in the chat UI. Call this for troubleshooting flows, setup procedures, or any multi-step process. Provide structured data — the UI renders the interactive component. Do NOT also write the steps as a numbered list in your text. Each item may include image_id (corpus page ID for a relevant diagram) and tips (up to 3 practical tips). Include them when they add genuine value.',
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
              image_id: {
                type: 'string',
                description:
                  'Optional corpus page ID (e.g. "owner-manual-008") when a specific diagram or photo would genuinely help this step. Only include when there is a real relevant page — not every step needs one.',
              },
              tips: {
                type: 'array',
                items: { type: 'string' },
                description:
                  'Up to 3 short practical tips or warnings for this step — actionable, not a repeat of the description.',
              },
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
    description:
      'Render an interactive HTML visual in the chat UI. Call this with the complete self-contained HTML for the component. The html is rendered in a sandboxed iframe — do NOT emit <artifact> tags in your text.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          enum: ['polarity_diagram', 'duty_cycle', 'troubleshooting', 'settings', 'custom'],
          description: 'The kind of visual being rendered',
        },
        title: {
          type: 'string',
          description: 'A short label for the artifact panel (e.g. "MIG Polarity Setup")',
        },
        html: {
          type: 'string',
          description:
            'Complete self-contained HTML document. Must include <!DOCTYPE html>, <html>, <head> with <style> block, and <body>. Use var(--color-bg), var(--color-text), var(--color-accent), var(--color-surface), var(--color-border), var(--color-muted) for ALL colors — never hardcode hex values. No external JS or CSS.',
        },
      },
      required: ['type', 'title', 'html'],
    },
    // Cache breakpoint: covers system prompt + all four tool definitions together
    cache_control: { type: 'ephemeral' as const },
  },
]

// ── Conversation history cache marker ─────────────────────────────────────────

/**
 * Marks the penultimate message with `cache_control` to create a third cache
 * breakpoint covering the full prior conversation. With this in place, each new
 * turn only pays for the two new messages (current user turn + assistant reply),
 * not the entire accumulated history.
 *
 * Requires at least 2 messages to be worth caching.
 */
export function withHistoryCacheMarker(
  msgs: Anthropic.MessageParam[]
): Anthropic.MessageParam[] {
  if (msgs.length < 2) return msgs

  return msgs.map((m, i) => {
    // Only mark the message just before the current user turn
    if (i !== msgs.length - 2) return m

    const content = m.content
    if (typeof content === 'string') {
      return {
        ...m,
        content: [{ type: 'text' as const, text: content, cache_control: { type: 'ephemeral' as const } }],
      }
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
