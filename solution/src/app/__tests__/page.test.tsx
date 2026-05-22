// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Home from '../page'

// jsdom doesn't implement scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn()

// ── Module mocks ────────────────────────────────────────────────────────────

vi.mock('@/components/FingerprintProvider', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useFingerprintId: () => 'test-fp',
}))

vi.mock('@/components/SiriOrb', () => ({
  default: () => <div data-testid="siri-orb" />,
}))

vi.mock('@/components/ThemeToggle', () => ({
  default: () => <button>Toggle theme</button>,
}))

vi.mock('@/components/ArtifactFrame', () => ({
  default: () => null,
}))

vi.mock('@/components/PageImage', () => ({
  default: () => null,
}))

vi.mock('@/components/ActivitySteps', () => ({
  default: ({ steps }: { steps: Array<{ label: string; status: string }> }) => (
    <div data-testid="activity-steps">
      {steps.map((s, i) => <span key={i}>{s.label}</span>)}
    </div>
  ),
}))

// ChatSidebar stub exposes each chat as a clickable button by id
vi.mock('@/components/ChatSidebar', () => ({
  default: ({ chats, activeChatId, onSelectChat, onNewChat }: {
    chats: Array<{ id: string; title: string }>
    activeChatId: string | null
    onSelectChat: (id: string) => void
    onNewChat: () => void
    onDeleteChat: (id: string) => void
  }) => (
    <div data-testid="sidebar">
      <button onClick={onNewChat}>New Chat</button>
      {chats.map(c => (
        <button
          key={c.id}
          data-testid={`select-chat-${c.id}`}
          data-active={activeChatId === c.id ? 'true' : 'false'}
          onClick={() => onSelectChat(c.id)}
        >
          {c.title}
        </button>
      ))}
    </div>
  ),
}))

vi.mock('@/lib/theme-context', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTheme: () => ({ theme: 'ai-dark', toggle: () => {} }),
}))

// ── Helpers ─────────────────────────────────────────────────────────────────

const CHAT_A = { id: 'chat-a', title: 'Chat A', updated_at: 1 }
const CHAT_B = { id: 'chat-b', title: 'Chat B', updated_at: 2 }

const MSGS_A = [
  { role: 'user', content: 'Hello from A' },
  { role: 'assistant', content: 'Reply from A', isStreaming: false },
]
const MSGS_B = [
  { role: 'user', content: 'Hello from B' },
  { role: 'assistant', content: 'Reply from B', isStreaming: false },
]

function makeConfigResponse() {
  return {
    modelSwitchingAllowed: true,
    defaultModel: 'claude-sonnet-4-6',
    rateLimit: { requests: 10, windowMinutes: 60 },
  }
}

function makeFetch(overrides: Record<string, unknown> = {}) {
  return vi.fn((url: string) => {
    const resolved = overrides[url as string]
    if (resolved !== undefined) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(resolved),
        headers: { get: () => null },
      })
    }
    if (url === '/api/config') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(makeConfigResponse()), headers: { get: () => null } })
    }
    if (url === '/api/chats') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ chats: [CHAT_B, CHAT_A] }), headers: { get: () => null } })
    }
    if (url === `/api/chats/${CHAT_A.id}/messages`) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ messages: MSGS_A }), headers: { get: () => null } })
    }
    if (url === `/api/chats/${CHAT_B.id}/messages`) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ messages: MSGS_B }), headers: { get: () => null } })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}), headers: { get: () => null } })
  })
}

function renderPage() {
  return render(<Home />)
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('scroll container layout', () => {
  beforeEach(() => {
    global.fetch = makeFetch() as unknown as typeof fetch
  })

  it('scroll container spans full width — no maxWidth on the outer scrollable div', async () => {
    const { container } = renderPage()
    await waitFor(() => screen.getByTestId('scroll-container'))
    const scrollEl = container.querySelector('[data-testid="scroll-container"]')!
    expect(scrollEl).toBeTruthy()
    // No inline style that would constrain the width — maxWidth lives only on the inner wrapper
    const style = scrollEl.getAttribute('style') ?? ''
    expect(style).not.toMatch(/max-width/)
    expect(scrollEl.className).toContain('overflow-y-auto')
  })

  it('inner content wrapper has maxWidth: 800 centering', async () => {
    const { container } = await renderPage()
    await waitFor(() => screen.getByTestId('scroll-container'))
    const scrollEl = container.querySelector('[data-testid="scroll-container"]')!
    const inner = scrollEl.firstElementChild as HTMLElement
    expect(inner.style.maxWidth).toBe('800px')
  })
})

describe('header z-index', () => {
  beforeEach(() => {
    global.fetch = makeFetch() as unknown as typeof fetch
  })

  it('header has the z-10 class to render above chat bubbles', async () => {
    const { container } = await renderPage()
    await waitFor(() => screen.getByRole('banner'))
    const header = container.querySelector('header')!
    expect(header.className).toMatch(/\bz-10\b/)
  })

  it('header has position:relative so z-index takes effect', async () => {
    const { container } = await renderPage()
    await waitFor(() => screen.getByRole('banner'))
    const header = container.querySelector('header')!
    expect(header.className).toMatch(/\brelative\b/)
  })
})

describe('chat message persistence across switches', () => {

  it('shows cached messages immediately when switching back to a visited chat', async () => {
    global.fetch = makeFetch() as unknown as typeof fetch
    await renderPage()

    // Initial load selects the first chat (CHAT_B since it has higher updated_at)
    await waitFor(() => expect(screen.queryByText('Reply from B')).toBeInTheDocument())

    // Switch to Chat A
    await act(async () => {
      await userEvent.click(screen.getByTestId(`select-chat-${CHAT_A.id}`))
    })
    await waitFor(() => expect(screen.queryByText('Reply from A')).toBeInTheDocument())

    // Switch back to Chat B — messages should appear from cache before the fetch resolves
    let fetchCallCount = 0
    const slowFetch = vi.fn((url: string) => {
      if (url === `/api/chats/${CHAT_B.id}/messages`) {
        fetchCallCount++
        // Intentionally slow — cache should display before this resolves
        return new Promise(resolve =>
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve({ messages: MSGS_B }),
            headers: { get: () => null },
          }), 200)
        )
      }
      return makeFetch()(url)
    })
    global.fetch = slowFetch as unknown as typeof fetch

    await act(async () => {
      await userEvent.click(screen.getByTestId(`select-chat-${CHAT_B.id}`))
    })

    // Chat B messages should be visible immediately from the cache — not blank
    expect(screen.getByText('Reply from B')).toBeInTheDocument()
    expect(fetchCallCount).toBe(1)
  })

  it('shows cached messages when switching back without going blank', async () => {
    // Set up a slow fetch for chat A messages so we can observe cache-first behavior
    let resolveChatAFetch!: (val: unknown) => void
    const slowFetch = vi.fn((url: string) => {
      if (url === `/api/chats/${CHAT_A.id}/messages`) {
        return new Promise(resolve => { resolveChatAFetch = resolve })
      }
      return makeFetch()(url)
    })
    global.fetch = slowFetch as unknown as typeof fetch

    renderPage()
    // Initial load: chat B auto-selected
    await waitFor(() => screen.getByText('Reply from B'))

    // Visit chat A — fetch is slow, but messages populate once it resolves
    await act(async () => {
      await userEvent.click(screen.getByTestId(`select-chat-${CHAT_A.id}`))
    })
    // Resolve chat A fetch
    await act(async () => {
      resolveChatAFetch({
        ok: true,
        json: () => Promise.resolve({ messages: MSGS_A }),
        headers: { get: () => null },
      })
    })
    await waitFor(() => screen.getByText('Reply from A'))

    // Switch to chat B
    await act(async () => {
      await userEvent.click(screen.getByTestId(`select-chat-${CHAT_B.id}`))
    })
    await waitFor(() => screen.getByText('Reply from B'))

    // Make the next chat A fetch slow again (resetting the spy)
    let resolveSecondFetch!: (val: unknown) => void
    slowFetch.mockImplementation((url: string) => {
      if (url === `/api/chats/${CHAT_A.id}/messages`) {
        return new Promise(resolve => { resolveSecondFetch = resolve })
      }
      return makeFetch()(url)
    })

    // Switch back to chat A — cache should show messages BEFORE fetch resolves
    await act(async () => {
      await userEvent.click(screen.getByTestId(`select-chat-${CHAT_A.id}`))
    })

    // Messages visible immediately from cache — no blank screen
    expect(screen.getByText('Reply from A')).toBeInTheDocument()

    // Cleanup
    resolveSecondFetch?.({
      ok: true,
      json: () => Promise.resolve({ messages: MSGS_A }),
      headers: { get: () => null },
    })
  })
})

describe('model selection per chat', () => {
  beforeEach(() => {
    global.fetch = makeFetch() as unknown as typeof fetch
  })

  it('restores the model last used in a chat when switching back to it', async () => {
    renderPage()
    await waitFor(() => screen.getByText('Chat B'))

    // On chat B (auto-selected): switch to Haiku
    await act(async () => {
      await userEvent.click(screen.getByText('Haiku'))
    })
    expect(screen.getByRole('button', { name: /Haiku/i }).style.background).toContain('linear-gradient')

    // Switch to chat A
    await act(async () => {
      await userEvent.click(screen.getByTestId(`select-chat-${CHAT_A.id}`))
    })
    await waitFor(() => screen.getByText('Reply from A'))

    // Chat A has no saved model yet — current model (Haiku) stays
    // Now switch to Sonnet on chat A
    await act(async () => {
      await userEvent.click(screen.getByText('Sonnet'))
    })
    expect(screen.getByRole('button', { name: /Sonnet/i }).style.background).toContain('linear-gradient')

    // Switch back to chat B — should restore Haiku
    await act(async () => {
      await userEvent.click(screen.getByTestId(`select-chat-${CHAT_B.id}`))
    })
    await waitFor(() => screen.getByText('Reply from B'))
    expect(screen.getByRole('button', { name: /Haiku/i }).style.background).toContain('linear-gradient')

    // Switch back to chat A — should restore Sonnet
    await act(async () => {
      await userEvent.click(screen.getByTestId(`select-chat-${CHAT_A.id}`))
    })
    await waitFor(() => screen.getByText('Reply from A'))
    expect(screen.getByRole('button', { name: /Sonnet/i }).style.background).toContain('linear-gradient')
  })

  it('saves model to cache when model selector changes', async () => {
    await renderPage()
    await waitFor(() => screen.getByText('Chat B'))

    // Haiku button click
    await act(async () => {
      await userEvent.click(screen.getByText('Haiku'))
    })

    const haikuBtn = screen.getByRole('button', { name: /Haiku/i })
    expect(haikuBtn.style.background).toContain('linear-gradient')
  })
})
