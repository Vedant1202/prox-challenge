# Vulcan OmniPro 220 Welder Assistant — Project Overview

> Built for the Prox Founding Engineer Challenge.

---

## What It Is

A multimodal AI assistant for the Vulcan OmniPro 220 multiprocess welder. You ask it technical questions — "what polarity for TIG?", "I'm getting porosity, what's wrong?", "what's the duty cycle at 200A?" — and it answers from the actual manual, with interactive diagrams, manual page images, and clickable troubleshooting flows generated on the fly.

The goal was to show what a support agent looks like when it's genuinely useful to someone standing in their garage, not just a chatbot that can summarize a PDF.

---

## Demo Questions

| Question | What you get |
|---|---|
| "What's the duty cycle for MIG at 200A on 240V?" | SVG arc gauge: 25% duty cycle, weld/rest time breakdown |
| "What polarity do I need for TIG?" | Front-panel SVG with cables highlighted by socket (DCEN) |
| "I'm getting porosity in my flux-cored welds." | Interactive checklist with expandable steps, tip panels, and inline diagram thumbnails |
| "Show me the wire feed mechanism." | Actual manual page images with diagrams and callouts |
| "What wire speed for MIG on 1/4" steel?" | Settings card from the selection chart |
| "Walk me through MIG setup" | Checklist with per-step manual page thumbnails — tap to zoom full-page |

The sidebar also exposes two standalone tools: a **Machine Diagram** (annotated hotspot map of the front panel) and a **Manual Viewer** (all 51 pages in a thumbnail grid with zoom + page navigation).

---

## Stack

- **Framework:** Next.js 15 App Router
- **AI:** Anthropic Claude API (`claude-sonnet-4-6`) — streaming, tool use, agentic loop
- **Corpus:** 51 pages extracted offline via Claude vision, committed to repo
- **Persistence:** Node.js built-in `node:sqlite` — no native module, no external DB
- **Styling:** Tailwind CSS + DaisyUI, dark/light theme
- **Tests:** Vitest — lib, API routes, components

**Setup: `cd solution && cp .env.example .env && npm install && npm run dev`**

---

## How It Works

### 1. Offline corpus extraction (already done)

Every page of the owner manual, quick start guide, and selection chart was converted to PNG and passed through Claude vision with a structured extraction prompt. The output — summaries, key facts, tables, diagrams, topics, keywords — is stored as JSON and committed to the repo.

The reviewer never runs this. It's a one-time $1 extraction.

### 2. Agentic retrieval loop

When you send a message, the API route runs a prompt-cached tool-use loop:

```
User message
    ↓
search_corpus(query)
    └─ linear score over 51 pages (key facts +4, topic tags +3, keywords +2)
    └─ returns top 5 pages as formatted context
    ↓
get_page_image(page_id)
    └─ returns static PNG URL
    └─ emits page_image SSE event → PageImage card in UI
    ↓
show_artifact(type, title)          OR        show_checklist(title, items[])
    └─ Claude generates <artifact>              └─ emits checklist SSE event
       HTML inline                                 items carry step, description,
                                                   optional image_id, optional tips
    ↓
Final text streamed to client; done event carries token usage (cache + input + output)
```

### 3. Artifact rendering

Claude writes self-contained HTML/CSS/JS inside `<artifact type="html">` blocks in its response. The frontend strips these from the markdown display and renders each one in a sandboxed `<iframe srcDoc>`. Light/dark theme is injected via CSS custom property overrides — no communication channel between iframe and host needed. A fullscreen zoom button opens the artifact in a full-window modal.

### 4. Checklist rendering

The `show_checklist` tool emits a structured JSON payload instead of inline HTML. `ChecklistCard` renders it as a stateful step list: checkboxes (checked state lives in `page.tsx`), expandable rows, optional corpus-page thumbnails with zoom modals, and optional tips panels. Checked steps are summarised back into the next API message so Claude knows the user's progress.

### 5. Multimodal troubleshooting

The system prompt instructs a diagnostic conversation loop: suggest a fix → ask if it worked → if not, ask one clarifying question → re-search → never repeat a suggestion → when corpus is exhausted, say so and point to manufacturer support.

---

## Key Technical Decisions

**No vector database.** 51 pages. Linear keyword + key-fact scoring runs in <5ms. Semantic similarity would rank "gas shielding efficiency" pages higher for "duty cycle" than the page with the actual duty cycle table. Exact key-fact matching beats embeddings for this corpus size.

**No server-side session state.** Full `messages[]` sent every request. Claude sees the full conversation. No session management, no sticky routing needed.

**Corpus committed to repo.** Extraction is $1, 15 minutes. Requiring the reviewer to run it breaks 2-minute setup. PNGs add ~8MB — acceptable.

**Node built-in SQLite.** `node:sqlite` (Node 22+) has no native binary. Zero compilation, zero friction on clone.

**Artifacts in streaming text, not a separate call.** If the stream fails mid-artifact, there's partial text to show. The client strips and renders artifact HTML only on `done`.

---

## What's in the Corpus

| Source | Pages | Key content |
|---|---|---|
| Owner Manual | 48 | Duty cycle tables, polarity diagrams, wire feed mechanism, troubleshooting matrix, parts list |
| Quick Start Guide | 2 | Cable connections, process overview |
| Selection Chart | 1 | Process/material/thickness → settings |

Coverage verified:
- 5 pages tagged `duty_cycle` — MIG 240V/200A = 25%, TIG 240V/175A = 30%
- 6 pages tagged `polarity` — TIG=DCEN, MIG=DCEP, Flux-Cored=DCEN
- 12 pages tagged `troubleshooting` — porosity, spatter, burn-through, unstable arc
- 9 pages with weld diagnosis photos

---

## Repository Layout

```
files/                        ← source PDFs
solution/
  corpus/
    corpus.json               ← 51-page knowledge base (committed)
    extracted/                ← per-page JSON
    pages/                    ← PNG reference copies
  public/corpus/pages/        ← PNGs served statically by Next.js
  scripts/extract-corpus.ts   ← one-time extraction (already run)
  src/
    app/
      api/chat/route.ts       ← streaming API + agentic tool loop + prompt caching
      api/chats/              ← chat CRUD + messages endpoint
      api/config/             ← client config (model, rate limit settings)
      page.tsx                ← root UI: view routing, checklist state, stream handling
    lib/
      corpus.ts               ← searchCorpus, getPage, formatPageForContext
      anthropic.ts            ← client + model allowlist
      db.ts                   ← SQLite init + migration-safe schema
      rate-limit.ts           ← sliding window rate limiter
      theme-context.tsx       ← dark/light theme provider
    components/
      ChatMessage.tsx         ← markdown + artifact parsing + page images + checklists
      ArtifactFrame.tsx       ← sandboxed iframe with fullscreen zoom modal
      ChecklistCard.tsx       ← step checklist with image thumbnails, tips, zoom modal
      MachineDiagram.tsx      ← annotated SVG front-panel diagram with hotspot pins
      ManualViewer.tsx        ← 51-page grid with zoom + page navigation modal
      ChatSidebar.tsx         ← chat list + Machine Diagram / Manual Pages nav
      PageImage.tsx           ← expandable manual page card (inline in chat)
      ModelSelector.tsx       ← Sonnet / Haiku picker
      RateLimitBadge.tsx      ← usage / limit / countdown display
      ActivitySteps.tsx       ← step progress indicator during streaming
      ThemeToggle.tsx         ← dark/light theme switcher
      SiriOrb.tsx             ← animated orb for empty state
      FingerprintProvider.tsx ← localStorage UUID for rate-limit fingerprinting
docs/
  ARCHITECTURE.md             ← system design, component breakdown, decisions
  CONFIGURATION.md            ← all env vars with types, defaults, examples
  USAGE.md                    ← feature guide
  OVERVIEW.md                 ← this file — high-level summary
```

---

## Running Locally

```bash
git clone <repo>
cd solution
cp .env.example .env          # add ANTHROPIC_API_KEY
npm install
npm run dev                   # http://localhost:3000
```

No database setup. No vector store. No Python. The corpus is committed.

---

## Known Limitations

- Corpus is static — manual revisions require re-running extraction (~$1, 15 min)
- Artifact HTML occasionally has minor layout issues; text + page images always work as fallback
- No weld photo upload/diagnosis (the corpus has weld photos but no upload-and-compare)
- English only

---

*Vedant Nandoskar — May 2026*
