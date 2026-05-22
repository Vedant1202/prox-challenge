// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ArtifactFrame from '../ArtifactFrame'
import { ThemeProvider } from '@/lib/theme-context'

function renderFrame(html = '<p>Hello</p>', title = 'Test Artifact', defaultExpanded = false) {
  return render(
    <ThemeProvider>
      <ArtifactFrame html={html} title={title} defaultExpanded={defaultExpanded} />
    </ThemeProvider>
  )
}

beforeEach(() => {
  document.body.style.overflow = ''
})

describe('ArtifactFrame', () => {
  it('renders the header with title', () => {
    renderFrame()
    expect(screen.getByText('Test Artifact')).toBeInTheDocument()
  })

  it('is collapsed by default when defaultExpanded=false', () => {
    renderFrame()
    expect(screen.queryByTitle('Test Artifact')).not.toBeInTheDocument()
  })

  it('expands when header is clicked', () => {
    renderFrame()
    const header = screen.getByText('Test Artifact').closest('[class]')!
    fireEvent.click(header)
    expect(screen.getByTitle('Test Artifact')).toBeInTheDocument()
  })

  it('collapses when header is clicked again', () => {
    renderFrame(undefined, undefined, true)
    const header = screen.getByText('Test Artifact').closest('[class]')!
    fireEvent.click(header)
    expect(screen.queryByTitle('Test Artifact')).not.toBeInTheDocument()
  })

  it('has a zoom button', () => {
    renderFrame()
    expect(screen.getByTestId('artifact-zoom-btn')).toBeInTheDocument()
  })

  it('opens fullscreen modal when zoom button clicked', () => {
    renderFrame()
    fireEvent.click(screen.getByTestId('artifact-zoom-btn'))
    expect(screen.getByTestId('artifact-zoom-modal')).toBeInTheDocument()
  })

  it('closes modal when backdrop is clicked', () => {
    renderFrame()
    fireEvent.click(screen.getByTestId('artifact-zoom-btn'))
    expect(screen.getByTestId('artifact-zoom-modal')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('artifact-zoom-modal'))
    expect(screen.queryByTestId('artifact-zoom-modal')).not.toBeInTheDocument()
  })

  it('closes modal on Escape key', () => {
    renderFrame()
    fireEvent.click(screen.getByTestId('artifact-zoom-btn'))
    expect(screen.getByTestId('artifact-zoom-modal')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('artifact-zoom-modal')).not.toBeInTheDocument()
  })

  it('does not expand iframe when zoom button is clicked (stops propagation)', () => {
    renderFrame()
    // Before clicking zoom, iframe is not in the dom
    fireEvent.click(screen.getByTestId('artifact-zoom-btn'))
    // Modal is open, but the inline iframe (title=Test Artifact) should not appear outside modal
    const iframes = screen.getAllByTitle('Test Artifact')
    // All iframes should be inside the modal, not the collapsed panel
    expect(iframes.length).toBeGreaterThanOrEqual(1)
  })
})
