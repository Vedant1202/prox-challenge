# Usage Guide

## Starting a Conversation

On first load, the app shows an empty state with five suggested questions. Click any to send it immediately, or type your own in the input box.

**Press Enter** to send. **Shift+Enter** inserts a newline.

---

## What the Assistant Can Do

### Answer technical questions from the manual

Ask anything about the Vulcan OmniPro 220 and the assistant will search the 51-page corpus before answering. It cites page numbers for every specification it gives.

Good questions to try:
- "What's the duty cycle for MIG at 200A on 240V?"
- "What polarity do I need for TIG?"
- "I'm getting porosity in my flux-cored welds."
- "What wire speed and voltage for MIG on 1/4" steel?"
- "Show me the wire feed mechanism."
- "How do I set up for stick welding?"

### Show manual page images

When the answer involves a diagram, schematic, or photo from the manual, the assistant surfaces the actual page as an expandable card below the response.

- Pages that are explicitly cited in the text auto-expand
- Others are shown collapsed with a thumbnail preview
- Click any page card to expand the full image

### Generate interactive artifacts

For questions about polarity setup, duty cycle, or settings, the assistant generates an interactive HTML component inline:

| Question type | Artifact generated |
|---|---|
| Polarity / cable connections | SVG front-panel diagram with cables highlighted by socket |
| Duty cycle | Arc gauge showing cycle % with weld/rest time breakdown |
| Settings / wire speed | Formatted settings card from the selection chart |

Artifacts render in a sandboxed iframe next to the response text. They have no external dependencies — everything is self-contained HTML/CSS/JS. Click the expand icon on any artifact to open it fullscreen.

### Interactive step checklists

For procedural questions (setup, troubleshooting sequences), the assistant generates a step-by-step checklist:

- Click the circle next to a step to check it off — the progress counter updates
- Click the chevron to expand a step and see its description
- Steps with a relevant manual diagram show a thumbnail — click it to zoom the full page
- Steps with practical tips show a "Tips" panel with actionable shortcuts or warnings
- Checked steps are included as context in your next message so the assistant knows where you are in the process

### View manual pages and diagrams

Use the **Tools** section at the bottom of the sidebar:

- **Machine Diagram** — annotated hotspot map of the Vulcan OmniPro 220 front panel. Click any pin for a labelled popover showing the control's function. Click the diagram to open it fullscreen.
- **Manual Pages** — all 51 corpus pages in a scrollable grid. Click any thumbnail to open the full page. Use ← → arrow keys or the on-screen buttons to navigate between pages. Type a page number and press Enter to jump directly.

---

## Activity Indicator

While the assistant is working, a step-by-step indicator shows what it's doing:

- **Thinking…** — initial Claude turn, formulating the approach
- **Searching manual…** — `search_corpus` tool running
- **Loading page image…** — `get_page_image` tool running
- **Building visual…** — `show_artifact` tool signalled, artifact HTML being generated
- **Building checklist…** — `show_checklist` tool generating a step-by-step checklist

---

## Multi-turn Troubleshooting

The assistant is designed for back-and-forth diagnosis, not single-shot answers:

1. Ask about a symptom ("I'm getting spatter")
2. The assistant gives a diagnosis and asks "Give that a try — did it fix the issue?"
3. If yes → acknowledgment + tip to prevent recurrence
4. If no → one targeted follow-up question → re-searches corpus with new context
5. It will never repeat the same suggestion in the same conversation
6. If the corpus is exhausted, it says so honestly and points you to Harbor Freight support

---

## Chat History

Previous conversations appear in the left sidebar, titled by the first message. Click any to switch to it.

- **New Chat** button (top of sidebar) starts a fresh conversation
- Hover a chat row to reveal the delete button
- History persists across page reloads (stored in SQLite locally)
- Each chat remembers which model was selected when you return to it

---

## Model Indicator

The header always shows which model is active. If model switching is enabled in configuration, clicking the toggle switches between Sonnet and Haiku mid-conversation.

- **Sonnet** — better artifact quality, more accurate citations, ~10x slower and costlier
- **Haiku** — fast responses, lighter artifacts, good for quick factual lookups

---

## Rate Limiting

A usage badge in the header shows `requests used / limit`. When the limit is reached:
- The input is disabled and shows a countdown to reset
- A rate limit card appears above the input with the exact reset time
- No requests are lost — they just need to wait for the window to slide

The window is a rolling 60-minute window (configurable). Each request expires individually rather than all resetting at the top of the hour.
