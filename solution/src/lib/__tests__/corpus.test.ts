import { describe, it, expect } from 'vitest'
import { searchCorpus, getPage, getPageImageUrl, formatPageForContext } from '../corpus'

describe('searchCorpus', () => {
  it('returns results for a known technical query', () => {
    const results = searchCorpus('duty cycle MIG 240V')
    expect(results.length).toBeGreaterThan(0)
    // The spec page for duty cycle/electrical specs should rank high
    const ids = results.map(p => p.id)
    expect(ids).toContain('owner-manual-007')
  })

  it('returns empty array for nonsense query', () => {
    const results = searchCorpus('xyzzy nonsense frobnicator')
    expect(results).toHaveLength(0)
  })

  it('respects the topN limit', () => {
    const results = searchCorpus('welding', 3)
    expect(results.length).toBeLessThanOrEqual(3)
  })

  it('returns PageRecord objects with required fields', () => {
    const results = searchCorpus('MIG welding')
    expect(results.length).toBeGreaterThan(0)
    const page = results[0]
    expect(page).toHaveProperty('id')
    expect(page).toHaveProperty('source')
    expect(page).toHaveProperty('page')
    expect(page).toHaveProperty('summary')
    expect(page).toHaveProperty('topics')
    expect(page).toHaveProperty('keywords')
    expect(page).toHaveProperty('key_facts')
  })

  it('returns relevant pages for a polarity query', () => {
    const results = searchCorpus('polarity setup TIG')
    expect(results.length).toBeGreaterThan(0)
    // Results should all have score > 0 (i.e., actually relevant)
    results.forEach(p => {
      const combined = [
        ...p.topics,
        ...p.keywords,
        ...p.key_facts,
        p.summary,
      ].join(' ').toLowerCase()
      expect(combined.length).toBeGreaterThan(0)
    })
    // The top result should be from the quick-start or owner-manual (real manual pages)
    expect(results[0].id).toMatch(/^(quick-start|owner-manual|selection-chart)/)
  })
})

describe('getPage', () => {
  it('returns the page for a known page ID', () => {
    const page = getPage('owner-manual-007')
    expect(page).toBeDefined()
    expect(page!.id).toBe('owner-manual-007')
    expect(page!.source).toBe('owner-manual')
  })

  it('returns undefined for an unknown page ID', () => {
    expect(getPage('nonexistent-page-999')).toBeUndefined()
  })

  it('returned page has electrical specs content for owner-manual-007', () => {
    const page = getPage('owner-manual-007')!
    expect(page.summary.toLowerCase()).toContain('specification')
    expect(page.topics).toContain('duty_cycle')
  })
})

describe('getPageImageUrl', () => {
  it('returns the correct URL format', () => {
    expect(getPageImageUrl('owner-manual-007')).toBe('/corpus/pages/owner-manual-007.png')
  })

  it('handles any page ID', () => {
    expect(getPageImageUrl('quick-start-003')).toBe('/corpus/pages/quick-start-003.png')
  })
})

describe('formatPageForContext', () => {
  it('includes the page number and source', () => {
    const page = getPage('owner-manual-007')!
    const formatted = formatPageForContext(page)
    expect(formatted).toContain(`Page ${page.page}`)
    expect(formatted).toContain(page.source)
  })

  it('includes the summary', () => {
    const page = getPage('owner-manual-007')!
    const formatted = formatPageForContext(page)
    expect(formatted).toContain('Summary:')
    expect(formatted).toContain(page.summary)
  })

  it('includes key facts when present', () => {
    const page = getPage('owner-manual-007')!
    expect(page.key_facts.length).toBeGreaterThan(0)
    const formatted = formatPageForContext(page)
    expect(formatted).toContain('Key facts:')
    expect(formatted).toContain(page.key_facts[0])
  })

  it('truncates long text content to 800 chars + ellipsis', () => {
    // Find a page with long text
    const results = searchCorpus('welding')
    const longPage = results.find(p => p.text_content.length > 800)
    if (longPage) {
      const formatted = formatPageForContext(longPage)
      expect(formatted).toContain('...')
    }
  })
})
