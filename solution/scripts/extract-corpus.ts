#!/usr/bin/env tsx
/**
 * One-time corpus extraction script.
 * Run: npm run extract-corpus
 * Output: corpus/corpus.json + public/corpus/pages/*.png
 *
 * Requires: poppler (brew install poppler) for pdftoppm
 */

import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const ROOT = path.resolve(__dirname, '..')
const FILES_DIR = path.resolve(ROOT, '../files')
const CORPUS_DIR = path.resolve(ROOT, 'corpus')
const PAGES_DIR = path.resolve(ROOT, 'corpus/pages')
const EXTRACTED_DIR = path.resolve(ROOT, 'corpus/extracted')
const PUBLIC_PAGES_DIR = path.resolve(ROOT, 'public/corpus/pages')

const PDFS = [
  { file: 'owner-manual.pdf', prefix: 'owner-manual' },
  { file: 'quick-start-guide.pdf', prefix: 'quick-start' },
  { file: 'selection-chart.pdf', prefix: 'selection-chart' },
]

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface PageRecord {
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

async function extractPage(imagePath: string, source: string, pageNum: number): Promise<PageRecord> {
  const id = `${source}-${String(pageNum).padStart(3, '0')}`
  const imageBuffer = fs.readFileSync(imagePath)
  const base64Image = imageBuffer.toString('base64')

  const prompt = `You are extracting structured data from a page of the Vulcan OmniPro 220 welder manual.

Extract ALL information from this page into this exact JSON structure:

{
  "summary": "one sentence describing what this page covers",
  "text_content": "all visible text verbatim, preserving structure",
  "tables": [
    {
      "title": "table title or description",
      "rows": [["col1", "col2", ...], ...]
    }
  ],
  "diagrams": [
    {
      "label": "figure label or description",
      "spatial": "describe layout: what is on left/right/top/bottom",
      "callouts": ["all callout text and labels in the diagram"]
    }
  ],
  "key_facts": [
    "specific factual claim, e.g.: MIG at 240V 200A has 30% duty cycle",
    "TIG welding requires DCEN polarity",
    "Ground clamp connects to negative terminal for TIG"
  ],
  "topics": ["array of applicable tags from: duty_cycle, polarity, wire_feed, troubleshooting, settings, mig, tig, flux_cored, stick, safety, parts, maintenance, specifications, quick_start, selection_chart, weld_diagnosis, schematic"],
  "keywords": ["important technical terms on this page"],
  "content_types": ["array of: text, table, diagram, schematic, photo, chart"]
}

Be exhaustive with key_facts — these are used for retrieval. Include every specific number, measurement, setting, or procedure mentioned.
Return only valid JSON, no markdown.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: base64Image,
            },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  let parsed: Omit<PageRecord, 'id' | 'source' | 'page' | 'image_path'>

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text)
  } catch {
    console.error(`  Failed to parse JSON for ${id}, using fallback`)
    parsed = {
      summary: 'Page extraction failed',
      text_content: text,
      tables: [],
      diagrams: [],
      key_facts: [],
      topics: [],
      keywords: [],
      content_types: ['text'],
    }
  }

  return {
    id,
    source,
    page: pageNum,
    image_path: `/corpus/pages/${id}.png`,
    ...parsed,
  }
}

async function main() {
  console.log('Vulcan OmniPro 220 Corpus Extraction')
  console.log('=====================================')

  for (const dir of [CORPUS_DIR, PAGES_DIR, EXTRACTED_DIR, PUBLIC_PAGES_DIR]) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const allPages: PageRecord[] = []

  for (const { file, prefix } of PDFS) {
    const pdfPath = path.join(FILES_DIR, file)
    if (!fs.existsSync(pdfPath)) {
      console.warn(`  Skipping ${file} — not found at ${pdfPath}`)
      continue
    }

    console.log(`\nProcessing ${file}...`)

    const tmpDir = path.join(PAGES_DIR, `tmp-${prefix}`)
    fs.mkdirSync(tmpDir, { recursive: true })

    // Convert PDF pages to PNG using pdftoppm (from poppler)
    console.log('  Converting PDF pages to PNG...')
    execSync(`pdftoppm -r 150 -png "${pdfPath}" "${path.join(tmpDir, prefix)}"`, {
      stdio: 'pipe',
    })

    // pdftoppm outputs files like: prefix-1.png, prefix-2.png (or prefix-01.png etc.)
    const pngFiles = fs.readdirSync(tmpDir)
      .filter(f => f.endsWith('.png'))
      .sort()

    console.log(`  Found ${pngFiles.length} pages`)

    for (let i = 0; i < pngFiles.length; i++) {
      const pageNum = i + 1
      const id = `${prefix}-${String(pageNum).padStart(3, '0')}`
      const srcPath = path.join(tmpDir, pngFiles[i])
      const destPath = path.join(PAGES_DIR, `${id}.png`)
      const publicPath = path.join(PUBLIC_PAGES_DIR, `${id}.png`)

      // Copy PNG to corpus/pages/ and public/corpus/pages/
      fs.copyFileSync(srcPath, destPath)
      fs.copyFileSync(srcPath, publicPath)

      const extractedPath = path.join(EXTRACTED_DIR, `${id}.json`)

      // Skip if already extracted
      if (fs.existsSync(extractedPath)) {
        console.log(`  [${pageNum}/${pngFiles.length}] ${id} — cached`)
        allPages.push(JSON.parse(fs.readFileSync(extractedPath, 'utf-8')))
        continue
      }

      console.log(`  [${pageNum}/${pngFiles.length}] Extracting ${id}...`)
      try {
        const record = await extractPage(destPath, prefix, pageNum)
        fs.writeFileSync(extractedPath, JSON.stringify(record, null, 2))
        allPages.push(record)
        console.log(`    ✓ ${record.topics.join(', ')}`)
        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 500))
      } catch (err) {
        console.error(`    ✗ Error: ${err}`)
      }
    }

    // Cleanup temp dir
    fs.rmSync(tmpDir, { recursive: true })
  }

  // Merge all pages into corpus.json
  const corpusPath = path.join(CORPUS_DIR, 'corpus.json')
  fs.writeFileSync(corpusPath, JSON.stringify(allPages, null, 2))
  console.log(`\n✓ corpus.json written with ${allPages.length} pages`)
  console.log(`✓ PNGs saved to corpus/pages/ and public/corpus/pages/`)
}

main().catch(console.error)
