import corpusData from '../../corpus/corpus.json'

export interface PageRecord {
  id: string
  source: string
  page: number
  image_path: string
  summary: string
  text_content: string
  tables: Array<{ title: string; rows: string[][] }>
  diagrams: Array<{ label: string; spatial: string; callouts: string[] }>
  key_facts: string[]
  topics: string[]
  keywords: string[]
  content_types: string[]
}

const corpus: PageRecord[] = corpusData as PageRecord[]

function scorePageForQuery(page: PageRecord, queryLower: string): number {
  let score = 0
  const terms = queryLower.split(/\s+/).filter(t => t.length > 2)

  // Topic tag exact match (+3 each)
  for (const topic of page.topics) {
    if (queryLower.includes(topic.replace(/_/g, ' ')) || queryLower.includes(topic)) {
      score += 3
    }
  }

  // Keyword substring match (+2 each)
  for (const kw of page.keywords) {
    if (queryLower.includes(kw.toLowerCase())) {
      score += 2
    }
  }

  // Key fact substring match (+4 each) — most specific
  for (const fact of page.key_facts) {
    const factLower = fact.toLowerCase()
    for (const term of terms) {
      if (factLower.includes(term)) {
        score += 1
      }
    }
    // Bonus if multiple query terms match the same fact
    const termMatches = terms.filter(t => factLower.includes(t)).length
    if (termMatches >= 2) score += 4
    else if (termMatches === 1) score += 2
  }

  // Summary match (+1)
  const summaryLower = page.summary.toLowerCase()
  for (const term of terms) {
    if (summaryLower.includes(term)) score += 1
  }

  // Text content match (+0.5 per term)
  const textLower = page.text_content.toLowerCase()
  for (const term of terms) {
    if (textLower.includes(term)) score += 0.5
  }

  return score
}

export function searchCorpus(query: string, topN = 5): PageRecord[] {
  const queryLower = query.toLowerCase()
  const scored = corpus.map(page => ({
    page,
    score: scorePageForQuery(page, queryLower),
  }))

  return scored
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(({ page }) => page)
}

export function getPage(pageId: string): PageRecord | undefined {
  return corpus.find(p => p.id === pageId)
}

export function getPageImageUrl(pageId: string): string {
  return `/corpus/pages/${pageId}.png`
}

export function formatPageForContext(page: PageRecord): string {
  const parts: string[] = [
    `[Page ${page.page} — ${page.source}]`,
    `Summary: ${page.summary}`,
  ]

  if (page.key_facts.length > 0) {
    parts.push(`Key facts:\n${page.key_facts.map(f => `  • ${f}`).join('\n')}`)
  }

  if (page.tables.length > 0) {
    for (const table of page.tables) {
      parts.push(`Table: ${table.title}`)
      parts.push(table.rows.map(r => r.join(' | ')).join('\n'))
    }
  }

  if (page.diagrams.length > 0) {
    for (const d of page.diagrams) {
      parts.push(`Diagram: ${d.label}`)
      parts.push(`  Layout: ${d.spatial}`)
      if (d.callouts.length > 0) {
        parts.push(`  Labels: ${d.callouts.join(', ')}`)
      }
    }
  }

  if (page.text_content) {
    // Include a truncated version of the text
    const truncated = page.text_content.slice(0, 800)
    parts.push(`Content:\n${truncated}${page.text_content.length > 800 ? '...' : ''}`)
  }

  return parts.join('\n\n')
}
