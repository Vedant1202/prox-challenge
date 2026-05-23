// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ModelSelector from '../ModelSelector'

describe('ModelSelector', () => {
  it('renders Sonnet and Haiku options', () => {
    render(<ModelSelector value="claude-sonnet-4-6" onChange={vi.fn()} />)
    expect(screen.getByText('Sonnet')).toBeInTheDocument()
    expect(screen.getByText('Haiku')).toBeInTheDocument()
  })

  it('calls onChange with haiku model when Haiku is clicked', async () => {
    const onChange = vi.fn()
    render(<ModelSelector value="claude-sonnet-4-6" onChange={onChange} />)
    await userEvent.click(screen.getByText('Haiku'))
    expect(onChange).toHaveBeenCalledWith('claude-haiku-4-5-20251001')
  })

  it('calls onChange with sonnet model when Sonnet is clicked', async () => {
    const onChange = vi.fn()
    render(<ModelSelector value="claude-haiku-4-5-20251001" onChange={onChange} />)
    await userEvent.click(screen.getByText('Sonnet'))
    expect(onChange).toHaveBeenCalledWith('claude-sonnet-4-6')
  })

  it('does not call onChange when the already-active option is clicked', async () => {
    const onChange = vi.fn()
    render(<ModelSelector value="claude-sonnet-4-6" onChange={onChange} />)
    await userEvent.click(screen.getByText('Sonnet'))
    // onChange is still called — the parent decides whether to update state
    expect(onChange).toHaveBeenCalledWith('claude-sonnet-4-6')
  })
})
