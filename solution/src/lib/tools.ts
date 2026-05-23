/**
 * Tool execution and result types for the Vulcan OmniPro 220 assistant.
 *
 * Each tool defined in prompt.ts has a corresponding branch in handleToolCall.
 * Side-effect tools (show_artifact, show_checklist, get_page_image) also emit
 * SSE events in the calling route — this module only returns the result string
 * the API needs to continue the agentic loop.
 */
import { searchCorpus, getPage, getPageImageUrl, formatPageForContext } from './corpus'

// ── Types ─────────────────────────────────────────────────────────────────────

/** A page image collected during a streaming response (before show_by_default is computed). */
export interface CollectedPageImage {
  page_id: string
  url: string
  page_num: number
  source: string
  summary?: string
}

/** Checklist structure emitted by the show_checklist tool. */
export interface CollectedChecklist {
  title: string
  items: Array<{
    step: string
    description: string
    image_id?: string
    tips?: string[]
  }>
}

/** Artifact HTML + title emitted by the show_artifact tool. */
export interface CollectedArtifact {
  html: string
  title: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true if the assistant's response text explicitly references the given
 * page number (e.g. "see p. 12" or "page 12"). Used to decide whether a page
 * image should be expanded by default when the message is first rendered.
 */
export function shouldShowByDefault(pageNum: number, text: string): boolean {
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

// ── Tool handler ──────────────────────────────────────────────────────────────

/**
 * Executes a tool call and returns the result string consumed by the API in
 * the agentic loop. Side effects (SSE events, collected state) are handled
 * by the caller (api/chat/route.ts).
 */
export function handleToolCall(
  toolName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolInput: Record<string, any>
): string {
  switch (toolName) {
    case 'search_corpus': {
      const pages = searchCorpus(toolInput.query as string, 5)
      if (pages.length === 0) {
        return 'No relevant pages found in the corpus for this query.'
      }
      return pages.map(formatPageForContext).join('\n\n---\n\n')
    }

    case 'get_page_image': {
      const page = getPage(toolInput.page_id as string)
      if (!page) {
        return `Page ${toolInput.page_id} not found in corpus.`
      }
      const url = getPageImageUrl(toolInput.page_id as string)
      // Return structured JSON; the caller also emits an SSE event for the UI
      return JSON.stringify({
        page_id: page.id,
        url,
        page_num: page.page,
        source: page.source,
        summary: page.summary,
      } satisfies CollectedPageImage)
    }

    case 'show_checklist':
      // The caller emits the SSE event and stores the checklist; just ack here
      return JSON.stringify({
        rendered: true,
        item_count: (toolInput.items as unknown[]).length,
      })

    case 'show_artifact':
      // The caller emits the SSE event and stores the HTML; just ack here
      return JSON.stringify({
        type: toolInput.type,
        title: toolInput.title,
        rendered: true,
      })

    default:
      return 'Unknown tool'
  }
}
