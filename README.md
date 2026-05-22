# Vulcan OmniPro 220 — Welder Assistant

<img src="product.webp" alt="Vulcan OmniPro 220" width="400" /> <img src="product-inside.webp" alt="Vulcan OmniPro 220 — inside panel" width="400" />

A multimodal AI assistant for the Vulcan OmniPro 220 built for the Prox Founding Engineer Challenge. Ask it technical questions and it answers from the actual manual — with interactive diagrams, duty cycle gauges, and troubleshooting flowcharts generated on the fly.

---

## Quickstart

```bash
cd solution
cp .env.example .env       # add your ANTHROPIC_API_KEY
npm install
npm run dev                # app runs at http://localhost:3000
```

No database. No vector store. No Python. The corpus is committed — the reviewer never re-runs extraction.

---

## Demo

Try these questions to see the full range of responses:

| Question | What you get |
|---|---|
| "What's the duty cycle for MIG at 200A on 240V?" | Interactive arc gauge showing 25% duty cycle, weld/rest breakdown |
| "What polarity do I need for TIG welding?" | SVG front-panel diagram with cables highlighted by socket |
| "I'm getting porosity in my flux-cored welds." | Interactive checklist: click through causes, mark resolved |
| "Show me the wire feed mechanism." | Actual manual page images with callouts |
| "What wire speed for MIG on 1/4\" steel?" | Recommended settings card from the selection chart |

---

## Architecture

```
User message
    ↓
POST /api/chat  (full conversation history every turn)
    ↓
Claude Sonnet 4.6  ─  agentic loop
    ├── search_corpus(query)     keyword/topic/key_fact scoring → top 5 pages
    ├── get_page_image(page_id)  → image URL → PageImage card in UI
    └── show_artifact(type)      → signals artifact type
    ↓
Streamed SSE: text deltas + page_image events + done
    ↓
Client: accumulates text, parses <artifact>…</artifact> blocks,
        renders ArtifactFrame (sandboxed iframe) + PageImage cards
```

**No server-side state.** Full `messages[]` array sent with every request — Claude sees the entire conversation each turn for free.

---

## How Knowledge Extraction Works

All extraction happens **offline, once**. The results are committed to the repo.

```bash
npm run extract-corpus    # requires: brew install poppler, ANTHROPIC_API_KEY
```

Steps:
1. `pdftoppm -r 150 -png` converts each PDF page to a 150 DPI PNG
2. Each PNG is sent to `claude-sonnet-4-6` vision with a structured extraction prompt
3. Per-page output stored as JSON:
   - `summary` — one-sentence description
   - `text_content` — all visible text verbatim
   - `tables` — structured rows/columns
   - `diagrams` — label, spatial layout, all callout text
   - `key_facts` — pre-extracted factoids (e.g. "MIG at 240V 200A = 25% duty cycle")
   - `topics` — controlled vocab tags
   - `keywords`, `content_types`
4. Merged into `corpus/corpus.json`; PNGs copied to `public/corpus/pages/`

**Why not a vector DB?** 51 pages — a linear keyword scan takes <5ms and the quality is better. Semantic similarity would rank a page about "MIG gas shielding" higher for the query "duty cycle" than the page that actually has the duty cycle table. Key-fact scoring beats embeddings for this corpus size.

---

## Corpus

| Source | Pages | Key topics |
|---|---|---|
| Owner Manual | 48 | duty cycle, polarity, wire feed, troubleshooting, TIG/MIG/Flux/Stick setup |
| Quick Start Guide | 2 | cable connections, process overview |
| Selection Chart | 1 | process selection by material/skill/application |

**Coverage verified:**
- 5 pages tagged `duty_cycle` — MIG 240V/200A = 25%, TIG 240V/175A = 30%, etc.
- 6 pages tagged `polarity` — TIG=DCEN, MIG=DCEP, Flux-Cored=DCEN
- 12 pages tagged `troubleshooting` — porosity, spatter, burn-through, unstable arc
- 9 pages tagged `weld_diagnosis` with actual weld photos

---

## Multimodal Response System

Claude generates `<artifact type="html">...</artifact>` blocks inline. The frontend:
1. Parses artifact blocks from the streamed text
2. Strips them from the markdown
3. Renders them in a `<iframe sandbox="allow-scripts" srcDoc={html}>` — same pattern as Claude Artifacts on claude.ai

**Artifact rules in system prompt:**
- All CSS inline — no external stylesheets
- No external JS — vanilla only
- Only corpus-verified data values (no hallucinated specs)
- Dark theme: `#1a1a1a` bg, `#e5e5e5` text, `#f59e0b` accent
- Interactive where it helps (clickable flowcharts, arc gauges, hover states)

Artifacts generated in testing:
- **Duty cycle question** → SVG arc gauge with weld/rest time breakdown and amperage selector
- **TIG polarity question** → Front panel SVG with sockets labeled, cables with arrows
- **Flux-cored porosity** → Click-through checklist with mark-resolved per cause

---

## Conversational Troubleshooting

The system prompt instructs Claude to follow a diagnostic loop:

1. After suggesting a fix → ask "Give that a try — did it fix the issue?"
2. If fixed → acknowledge + one tip to prevent recurrence
3. If not fixed → ask one targeted clarifying question → re-search corpus with new context
4. Never repeat the same suggestion in a conversation
5. When corpus is exhausted → say so honestly and recommend Harbor Freight support with page ref

This makes multi-turn troubleshooting feel like talking to a knowledgeable friend, not querying a FAQ.

---

## Design Decisions

**Why Next.js instead of FastAPI?** Single `npm install && npm run dev`. No Python environment, no pip, no conda. The reviewer is running in 2 minutes.

**Why commit the corpus?** Extraction costs ~$1 in API calls and takes ~15 minutes. Making the reviewer run it would break the 2-minute setup requirement and introduce a failure mode.

**Why Claude Sonnet 4.6 everywhere?** For a challenge where artifact generation quality is the primary evaluation criterion, the cost difference between Haiku and Sonnet (~$0.008/query) is not worth the quality tradeoff.

**Why keyword scoring over vector search?** 51 pages. Linear scan is 5ms. Key-fact scoring retrieves "the page with the duty cycle table" more reliably than semantic similarity for this domain.

**Why a single centralized agent?** Multi-agent routing adds latency and complexity without accuracy gain for a 51-page corpus. Claude decides which tools to call and in what order — that is the orchestration layer.

---

## File Structure

```
solution/
  corpus/
    corpus.json              ← 51-page structured knowledge base
    pages/                   ← PNG images (150 DPI) for reference
    extracted/               ← per-page JSON files
  public/corpus/pages/       ← same PNGs, served by Next.js
  scripts/
    extract-corpus.ts        ← one-time extraction (already run)
  src/
    app/
      api/chat/route.ts      ← streaming Claude API + agentic tool loop
      page.tsx               ← chat UI
    lib/
      corpus.ts              ← searchCorpus(), getPage(), formatPageForContext()
      anthropic.ts           ← client + model constant
    components/
      ChatMessage.tsx        ← markdown + page images + artifact iframes
      ArtifactFrame.tsx      ← sandboxed iframe renderer
      PageImage.tsx          ← expandable manual page card
```

---

## Known Limitations

- **Corpus is static** — new pages or manual revisions require re-running extraction
- **Artifact reliability** — Claude occasionally generates HTML with minor layout issues; the fallback is text + page images, which always works
- **No weld photo diagnosis** — the manual's weld diagnosis photos are in the corpus as images but the agent doesn't do upload-and-compare; a future version could
- **English only** — no i18n

---

## Running Locally Without the Corpus

If you want to re-extract the corpus from scratch:

```bash
brew install poppler         # for pdftoppm (PDF → PNG)
cd solution
npm run extract-corpus       # requires ANTHROPIC_API_KEY, ~$1, ~15 min
```

The script caches per-page results in `corpus/extracted/` — safe to re-run if interrupted.
