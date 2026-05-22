// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ChatMessage, { type Message } from '../ChatMessage'
import { ThemeProvider } from '@/lib/theme-context'

const CHECKLIST = {
  title: 'TIG Setup Checklist',
  items: [
    { step: 'Set polarity to DCEN', description: 'Move cables to the correct terminals.' },
    { step: 'Connect gas line', description: 'Use 100% Argon at 15–20 CFH.' },
  ],
}

function renderMsg(message: Message, checklistChecked?: boolean[], onChecklistToggle?: (i: number) => void) {
  return render(
    <ThemeProvider>
      <ChatMessage message={message} checklistChecked={checklistChecked} onChecklistToggle={onChecklistToggle} />
    </ThemeProvider>
  )
}

describe('ChatMessage — user messages', () => {
  it('renders user message content', () => {
    renderMsg({ role: 'user', content: 'Hello world' })
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('does not render page images for user messages', () => {
    renderMsg({ role: 'user', content: 'Test' })
    expect(screen.queryByText(/p\.\d+/)).not.toBeInTheDocument()
  })
})

describe('ChatMessage — assistant messages', () => {
  it('renders plain text content', () => {
    renderMsg({ role: 'assistant', content: 'Here is my answer.', isStreaming: false })
    expect(screen.getByText('Here is my answer.')).toBeInTheDocument()
  })

  it('renders markdown bold text', () => {
    renderMsg({ role: 'assistant', content: 'Use **DCEP** polarity.', isStreaming: false })
    const bold = screen.getByText('DCEP')
    expect(bold.tagName).toBe('STRONG')
  })

  it('shows streaming steps while isStreaming is true', () => {
    renderMsg({
      role: 'assistant',
      content: '',
      isStreaming: true,
      steps: [{ label: 'Thinking…', status: 'active' }],
    })
    // ActivitySteps strips '…' and appends animated dots; initially shows base label without '…'
    expect(screen.getByText(/Thinking/)).toBeInTheDocument()
  })

  it('does not show streaming steps when not streaming', () => {
    renderMsg({
      role: 'assistant',
      content: 'Done.',
      isStreaming: false,
      steps: [{ label: 'Thinking…', status: 'done' }],
    })
    // Steps only render while streaming
    expect(screen.queryByText('Thinking…')).not.toBeInTheDocument()
  })

  it('renders an artifact frame when content has <artifact> tags', () => {
    const content = `Here is a diagram.\n<artifact type="html"><h1>Test</h1></artifact>`
    renderMsg({ role: 'assistant', content, isStreaming: false })
    // The artifact tag text should be stripped; the ArtifactFrame header is shown
    expect(screen.queryByText(/<artifact/)).not.toBeInTheDocument()
    // ArtifactFrame renders a toggle header
    expect(screen.getByText('Interactive Component')).toBeInTheDocument()
  })

  it('strips artifact tags from visible markdown text', () => {
    const content = `Answer here.\n<artifact type="html"><p>Visual</p></artifact>`
    renderMsg({ role: 'assistant', content, isStreaming: false })
    expect(screen.getByText('Answer here.')).toBeInTheDocument()
    // Raw artifact markup should not be visible
    expect(screen.queryByText(/type="html"/)).not.toBeInTheDocument()
  })

  it('shows rate-limited error message when rateLimited is true', () => {
    renderMsg({
      role: 'assistant',
      content: '',
      isStreaming: false,
      rateLimited: true,
    })
    expect(screen.getByText(/rate limit reached/i)).toBeInTheDocument()
  })

  it('does not render page images if none provided', () => {
    renderMsg({ role: 'assistant', content: 'No images.', isStreaming: false })
    // No image badges rendered
    expect(screen.queryByText(/p\.\d+/)).not.toBeInTheDocument()
  })

  it('renders ChecklistCard when message.checklist is set', () => {
    renderMsg(
      { role: 'assistant', content: 'Here are the steps.', isStreaming: false, checklist: CHECKLIST },
      [false, false]
    )
    expect(screen.getByTestId('checklist-card')).toBeInTheDocument()
    expect(screen.getByText('TIG Setup Checklist')).toBeInTheDocument()
    expect(screen.getByText('Set polarity to DCEN')).toBeInTheDocument()
  })

  it('does not render ChecklistCard when message.checklist is not set', () => {
    renderMsg({ role: 'assistant', content: 'No checklist here.', isStreaming: false })
    expect(screen.queryByTestId('checklist-card')).not.toBeInTheDocument()
  })

  it('calls onChecklistToggle when a checklist item is toggled', () => {
    const onToggle = vi.fn()
    renderMsg(
      { role: 'assistant', content: '', isStreaming: false, checklist: CHECKLIST },
      [false, false],
      onToggle
    )
    fireEvent.click(screen.getByTestId('checklist-item-0'))
    expect(onToggle).toHaveBeenCalledWith(0)
  })
})
