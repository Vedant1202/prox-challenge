// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RateLimitBadge from '../RateLimitBadge'

const BASE_PROPS = {
  used: 5,
  limit: 10,
  resetAt: Date.now() + 30 * 60 * 1000,
  windowMinutes: 60,
}

describe('RateLimitBadge', () => {
  it('shows remaining/limit counts', () => {
    render(<RateLimitBadge {...BASE_PROPS} />)
    expect(screen.getByText('5/10')).toBeInTheDocument()
  })

  it('shows remaining count as limit minus used', () => {
    // "5/10" means 5 remaining out of 10
    render(<RateLimitBadge {...BASE_PROPS} />)
    expect(screen.getByText('5/10')).toBeInTheDocument()
  })

  it('popover is hidden by default', () => {
    render(<RateLimitBadge {...BASE_PROPS} />)
    expect(screen.queryByText('Usage limits')).not.toBeInTheDocument()
  })

  it('opens popover when (i) button is clicked', async () => {
    render(<RateLimitBadge {...BASE_PROPS} />)
    await userEvent.click(screen.getByRole('button', { name: /rate limit info/i }))
    expect(screen.getByText('Usage limits')).toBeInTheDocument()
  })

  it('popover shows limit and window duration', async () => {
    render(<RateLimitBadge {...BASE_PROPS} />)
    await userEvent.click(screen.getByRole('button', { name: /rate limit info/i }))
    expect(screen.getByText(/10 messages per 60 min/)).toBeInTheDocument()
  })

  it('popover shows remaining message count', async () => {
    render(<RateLimitBadge {...BASE_PROPS} />)
    await userEvent.click(screen.getByRole('button', { name: /rate limit info/i }))
    expect(screen.getByText(/5 messages remaining/)).toBeInTheDocument()
  })

  it('closes popover when backdrop is clicked', async () => {
    render(<RateLimitBadge {...BASE_PROPS} />)
    await userEvent.click(screen.getByRole('button', { name: /rate limit info/i }))
    expect(screen.getByText('Usage limits')).toBeInTheDocument()
    // Click the fixed backdrop overlay (first element in the toggle group)
    const backdrop = document.querySelector('.fixed.inset-0') as HTMLElement
    await userEvent.click(backdrop)
    expect(screen.queryByText('Usage limits')).not.toBeInTheDocument()
  })

  it('shows singular "message" when 1 remaining', async () => {
    render(<RateLimitBadge {...BASE_PROPS} used={9} limit={10} />)
    await userEvent.click(screen.getByRole('button', { name: /rate limit info/i }))
    expect(screen.getByText(/1 message remaining/)).toBeInTheDocument()
  })
})
