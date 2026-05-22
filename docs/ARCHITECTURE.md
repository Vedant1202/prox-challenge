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
      Rate limit check (SQLite sliding window, keyed on SHA256(ip:fingerprint))
              │
              ▼
      Claude Sonnet 4.6  —  agentic tool loop
              │
        ┌─────┴──────────────────────────────┐
        │  search_corpus(query)              │
        │    └─ linear keyword/topic/        │
        │       key_fact score over          │
        │       corpus.json (51 pages)       │
        │                                    │
        │  get_page_image(page_id)           │
        │    └─ returns /corpus/pages/*.png  │
        │       URL, emits page_image event  │
        │                                    │
        │  show_artifact(type, title)        │
        │    └─ signals frontend to expect   │
        │       <artifact> block in text     │
        └────────────────────────────────────┘
              │
              ▼
      SSE stream: text | tool_call | page_image | done
              │
              ▼
       Client accumulates text, renders markdown,
       parses <artifact>…</artifact> → sandboxed iframe,
       shows PageImage cards for each page_image event
              │
              ▼
       On done: persist to SQLite (chats + messages tables)
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
| `done` | `{}` | Finalize message, refetch chat list, persist |
| `error` | `{ message }` | Show error in message bubble |

`show_by_default` is computed server-side: a page image auto-expands if the final assistant text explicitly references that page number (e.g. "see page 18", "p. 18").

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

---

## Persistence Layer

SQLite via Node.js built-in `node:sqlite` (no native module, no binary dependency).

```sql
chats    (id, title, created_at, updated_at)
messages (id, chat_id, role, content, page_images JSON, artifact_html, created_at)
rate_limit (client_key, timestamp)   ← sliding window log
```

Database is written **after** the stream completes (inside the `finally`-equivalent path after `send({ type: 'done' })`). This means the client sees the response immediately; persistence is fire-and-forget with error logging.

The chat row is auto-created from the first message if it doesn't exist yet — no separate "create chat" API call is required before the first message.

---

## Rate Limiting

Sliding window, stored in SQLite. Per request:
1. Delete all entries for this `client_key` older than `windowMs`
2. Count remaining entries — if `>= limit`, return 429
3. Insert a new row, return allowed

`client_key` is `SHA256(ip + ":" + browser_fingerprint)`. The fingerprint is a `localStorage` UUID generated on first visit, sent as `X-Client-Fingerprint` header. Combined with IP it prevents trivially bypassing the limit by refreshing.

Reset time is computed as `oldest_entry.timestamp + windowMs` — the exact moment the window slides enough to allow another request.

---

## Key Design Decisions

**No vector database.** 51 pages fit in memory. Linear keyword scoring runs in <5ms and produces better results than semantic similarity for this domain — "duty cycle" should retrieve the page with the duty cycle table, not pages that discuss general efficiency concepts.

**No server-side session state.** The full `messages[]` array is sent with every request. Claude sees the entire conversation context on each turn. This eliminates session management, simplifies horizontal scaling, and removes a failure mode.

**Corpus committed to the repo.** Extraction costs ~$1 and 15 minutes. Requiring the reviewer to run it would break the 2-minute setup goal and introduce a failure point. The PNGs add ~8MB to the repo, which is acceptable.

**Node.js built-in SQLite.** No native binary dependency (better-sqlite3 requires compilation). Node 22+ ships `node:sqlite`. Simpler cold-start, no installation friction.

**Artifact HTML in streaming text.** Claude generates artifact HTML inline as a text block, not as a separate API call or tool result. This keeps the response atomic — if the stream fails mid-artifact, the client has partial text to show rather than nothing. The client strips and renders it only on `done`.

**Single centralized agent.** No multi-agent routing. Claude decides which tools to call and in what order — that is already orchestration. Adding a router adds latency and complexity for a corpus this size without accuracy gain.
