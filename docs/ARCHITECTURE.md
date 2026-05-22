# Architecture

## System Overview

```
Browser
  │
  ├─ GET  /api/config          → modelSwitchingAllowed, defaultModel, rateLimit config
  ├─ GET  /api/chats           → chat history list (titles + IDs)
  ├─ GET  /api/chats/:id/messages → full message history for a chat
  └─ POST /api/chat            → streaming SSE  ←── the main path
              │
              ▼
      Rate limit check (Neon Postgres sliding window, keyed on SHA256(ip:fingerprint))
              │
              ▼
      Claude Sonnet 4.6  —  agentic tool loop  (prompt-cached: system → tools → history)
              │
        ┌─────┴──────────────────────────────────┐
        │  search_corpus(query)                  │
        │    └─ linear keyword/topic/            │
        │       key_fact score over              │
        │       corpus.json (51 pages)           │
        │                                        │
        │  get_page_image(page_id)               │
        │    └─ returns /corpus/pages/*.png URL  │
        │       emits page_image SSE event       │
        │                                        │
        │  show_artifact(type, title)            │
        │    └─ signals frontend to expect       │
        │       <artifact> block in text         │
        │                                        │
        │  show_checklist(title, items[])        │
        │    └─ emits checklist SSE event        │
        │       items carry step, description,   │
        │       optional image_id, optional tips │
        └────────────────────────────────────────┘
              │
              ▼
      SSE stream: text | tool_call | page_image | checklist | done
              │
              ▼
       Client accumulates text, renders markdown,
       parses <artifact>…</artifact> → ArtifactFrame (sandboxed iframe),
       shows PageImage cards, renders ChecklistCard for checklist events
              │
              ▼
       On done: persist to Neon Postgres (chats + messages tables, including checklist JSON)
```

---

## The Agentic Loop

The API route runs a standard tool-use loop: call Claude, process all content blocks, if any are `tool_use` blocks execute them and append results, repeat. The loop exits when `stop_reason === 'end_turn'` or there are no tool calls.

```typescript
while (true) {
  const response = await anthropic.messages.create({ model, tools, messages })

  for (const block of response.content) {
    if (block.type === 'text')     stream text delta to client
    if (block.type === 'tool_use') execute tool, queue result
  }

  if (no tool_use blocks || stop_reason === 'end_turn') break

  messages = [...messages,
    { role: 'assistant', content: response.content },
    { role: 'user',      content: toolResults },
  ]
}
```

Typical sequence for a technical question:
1. Claude calls `search_corpus("TIG polarity setup")`
2. Corpus returns 3–5 relevant pages with key facts, diagrams, tables
3. Claude calls `get_page_image("owner-manual-018")` for the connection diagram
4. Claude calls `show_artifact("polarity_diagram", "TIG Polarity Setup")`
5. Claude generates final text + inline `<artifact>` HTML block
6. Loop exits, page_image event fires, `done` event fires

Typical sequence for a procedural question (e.g. "walk me through MIG setup"):
1. Claude calls `search_corpus("MIG polarity wire setup")`
2. Claude calls `show_checklist("MIG Setup", [{step, description, image_id, tips}, ...])`
3. Checklist SSE event fires; client creates ChecklistCard and initialises checked state
4. Claude generates explanatory text alongside
5. `done` event fires; checklist JSON is persisted with the message

---

## Corpus & Retrieval

### Offline Extraction (run once)

`scripts/extract-corpus.ts`:
1. `pdftoppm -r 150 -png` converts each PDF page → PNG
2. Each PNG is passed to Claude vision with a structured extraction prompt
3. Per-page JSON stored in `corpus/extracted/`
4. Merged into `corpus/corpus.json`
5. PNGs copied to `public/corpus/pages/` for static serving

Per-page schema:
```json
{
  "id": "owner-manual-018",
  "source": "Owner Manual",
  "page": 18,
  "summary": "Front panel connection diagram showing TIG/MIG/Flux-Cored cable routing",
  "text_content": "...",
  "tables": [{ "title": "...", "rows": [["col1", "col2"]] }],
  "diagrams": [{ "label": "...", "spatial": "...", "callouts": ["..."] }],
  "key_facts": ["TIG welding requires DCEN polarity", "..."],
  "topics": ["polarity", "tig_setup", "cable_connections"],
  "keywords": ["DCEN", "electrode negative", "torch cable"],
  "content_types": ["diagram", "text"]
}
```

### Runtime Search (`lib/corpus.ts`)

Linear scan over all 51 pages, scored per query:

| Signal | Weight |
|---|---|
| Topic tag exact match | +3 per match |
| Keyword substring match | +2 per match |
| Key fact: multiple query terms match same fact | +4 bonus |
| Key fact: single query term match | +2 per match |
| Summary term match | +1 per term |
| Text content term match | +0.5 per term |

Top 5 scoring pages are returned. No score threshold — zero-scoring pages are excluded.

`formatPageForContext()` serializes the winning pages into a text block that includes key facts, tables, diagrams, and a truncated text excerpt. This is the tool result Claude receives.

---

## Streaming SSE Protocol

The client connects with a standard `fetch` + `ReadableStream` reader. Events are newline-delimited JSON prefixed with `data: `.

| Event type | Payload | Client action |
|---|---|---|
| `text` | `{ text: string }` | Append to assistant message content |
| `tool_call` | `{ name, input }` | Advance activity step indicator |
| `page_image` | `{ page_id, url, page_num, source, summary, show_by_default }` | Add PageImage card to message |
| `checklist` | `{ title: string, items: ChecklistItem[] }` | Mount ChecklistCard, initialise checked state |
| `done` | `{ usage: { cache_creation, cache_read, input, output } }` | Finalise message, refetch chat list, persist |
| `error` | `{ message }` | Show error in message bubble |

`show_by_default` is computed server-side: a page image auto-expands if the final assistant text explicitly references that page number (e.g. "see page 18", "p. 18").

`ChecklistItem` schema: `{ step: string, description: string, image_id?: string, tips?: string[] }`. `image_id` maps to a corpus page PNG. Checked state is held in `page.tsx` as `Map<"${chatId}:${msgIndex}", boolean[]>` and serialised into follow-up messages as context.

---

## Artifact Pipeline

Claude emits HTML artifacts inline in its text response using:

```html
<artifact type="html">
<!DOCTYPE html>
<html>...</html>
</artifact>
```

Client-side in `ChatMessage.tsx`:
1. Regex extracts `<artifact>` blocks from the streamed text
2. Blocks are stripped from the markdown display
3. Each block is passed to `ArtifactFrame` — a `<iframe sandbox="allow-scripts" srcDoc={html}>`

Theme tokens are injected into the iframe via a `<style>` block prepended to the `srcDoc`, overriding the CSS custom properties Claude uses (`--color-bg`, `--color-text`, `--color-accent`, `--color-surface`, `--color-border`, `--color-muted`). This is how light/dark theme switching propagates into artifacts without any communication channel between the iframe and the host page.

`ArtifactFrame` also exposes a fullscreen zoom button. The modal is rendered via `createPortal` into `document.body` so it covers the full viewport regardless of ancestor stacking contexts created by `backdrop-filter` on glass/glass-card elements.

---

## Prompt Caching

Three `cache_control: { type: "ephemeral" }` breakpoints are set per request to minimise repeated token costs:

1. **System prompt** — the large SYSTEM_PROMPT text block; rarely changes, cached across all turns
2. **Tools** — the tool definition array; the last tool (`show_artifact`) carries the cache marker
3. **Conversation history** — `withHistoryCacheMarker()` marks the penultimate message (last complete turn before the current user message), caching the growing history prefix

The `done` event payload includes token usage — `cache_creation`, `cache_read`, `input`, `output` — accumulated across all agentic loop iterations.

---

## UI Views

`page.tsx` manages three mutually-exclusive views via `view: 'chat' | 'diagram' | 'manual'` state:

| View | Component | Trigger |
|---|---|---|
| `chat` | Default chat UI | Any chat click in sidebar, or toggling active view |
| `diagram` | `MachineDiagramPage` | "Machine Diagram" nav button in sidebar |
| `manual` | `ManualViewer` | "Manual Pages" nav button in sidebar |

The sidebar is always visible; only the main column content switches. All three views share the same sidebar, which highlights the active nav item.

**MachineDiagram** — SVG-based hotspot map of the front panel. Pins are positioned as CSS percentages over an `<img>` tag. Clicking a pin opens an annotated popover near the pin. The full diagram can be zoomed into a full-window modal.

**ManualViewer** — Grid of all 51 corpus pages as lazy-loaded thumbnails. Clicking opens a zoom modal with: header showing page number + label, prev/next buttons, keyboard arrows (← →), Escape to close, and a page-number input for direct navigation. All modals portal to `document.body`.

---

## Persistence Layer

Neon Postgres via `@neondatabase/serverless`. `DATABASE_URL` should point at the pooled Neon connection string for Vercel/serverless deployments.

```sql
chats      (id, client_key, title, created_at, updated_at)
messages   (id, chat_id, role, content, page_images JSON, checklist JSON, created_at)
rate_limit (client_key, timestamp)   ← sliding window log
```

The canonical schema is in `solution/db/schema.sql`. The runtime also calls an idempotent schema initializer on first database access so a fresh Neon database can boot without a separate migration command for the demo.

Database is written **after** the stream completes (inside the `finally`-equivalent path after `send({ type: 'done' })`). The client sees the response immediately; persistence is fire-and-forget with error logging.

The chat row is scoped by `client_key` and auto-created from the first message if it doesn't exist yet — no separate "create chat" API call is required before the first message.

---

## Rate Limiting

Sliding window, stored in Neon Postgres. Per request:
1. Delete all entries for this `client_key` older than `windowMs`
2. Count remaining entries — if `>= limit`, return 429
3. Insert a new row, return allowed

`client_key` is `SHA256(ip + ":" + browser_fingerprint)`. The browser sends `X-Client-Fingerprint` on chat and history requests. The fingerprint is supplied by FingerprintJS when available, with a stable `localStorage` UUID fallback so Vercel-deployed chat history stays per visitor even if the library fails to load.

Reset time is computed as `oldest_entry.timestamp + windowMs` — the exact moment the window slides enough to allow another request.

---

## Key Design Decisions

**No vector database.** 51 pages fit in memory. Linear keyword scoring runs in <5ms and produces better results than semantic similarity for this domain — "duty cycle" should retrieve the page with the duty cycle table, not pages that discuss general efficiency concepts.

**No server-side session state.** The full `messages[]` array is sent with every request. Claude sees the entire conversation context on each turn. This eliminates session management, simplifies horizontal scaling, and removes a failure mode.

**Corpus committed to the repo.** Extraction costs ~$1 and 15 minutes. Requiring the reviewer to run it would break the 2-minute setup goal and introduce a failure point. The PNGs add ~8MB to the repo, which is acceptable.

**Neon Postgres for deployment.** Vercel functions do not provide durable local disk, so chat history and the rate-limit ledger live in Neon. The storage boundary is isolated in `lib/storage.ts`, keeping route handlers independent of SQL details.

**Artifact HTML in streaming text.** Claude generates artifact HTML inline as a text block, not as a separate API call or tool result. This keeps the response atomic — if the stream fails mid-artifact, the client has partial text to show rather than nothing. The client strips and renders it only on `done`.

**Single centralized agent.** No multi-agent routing. Claude decides which tools to call and in what order — that is already orchestration. Adding a router adds latency and complexity for a corpus this size without accuracy gain.
