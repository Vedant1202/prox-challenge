// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ManualViewer from '../ManualViewer'

const onClose = vi.fn()

beforeEach(() => {
  document.body.style.overflow = ''
  vi.clearAllMocks()
})

describe('ManualViewer', () => {
  it('renders 51 page thumbnail cards', () => {
    render(<ManualViewer onClose={onClose} />)
    const thumbBtns = screen.getAllByTestId(/^page-thumb-/)
    expect(thumbBtns.length).toBe(51)
  })

  it('calls onClose when back button is clicked', () => {
    render(<ManualViewer onClose={onClose} />)
    const backBtn = screen.getByText(/back to chat/i)
    fireEvent.click(backBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('opens zoom modal when a thumbnail is clicked', () => {
    render(<ManualViewer onClose={onClose} />)
    const thumbBtns = screen.getAllByTestId(/^page-thumb-/)
    fireEvent.click(thumbBtns[0])
    expect(screen.getByTestId('manual-zoom-modal')).toBeInTheDocument()
  })

  it('disables Prev button on first page', () => {
    render(<ManualViewer onClose={onClose} />)
    fireEvent.click(screen.getAllByTestId(/^page-thumb-/)[0])
    const prevBtn = screen.getByRole('button', { name: /previous page/i })
    expect(prevBtn).toBeDisabled()
  })

  it('disables Next button on last page', () => {
    render(<ManualViewer onClose={onClose} />)
    const thumbBtns = screen.getAllByTestId(/^page-thumb-/)
    fireEvent.click(thumbBtns[thumbBtns.length - 1])
    const nextBtn = screen.getByRole('button', { name: /next page/i })
    expect(nextBtn).toBeDisabled()
  })

  it('navigates to next page when Next clicked', () => {
    render(<ManualViewer onClose={onClose} />)
    fireEvent.click(screen.getAllByTestId(/^page-thumb-/)[0])
    const nextBtn = screen.getByRole('button', { name: /next page/i })
    fireEvent.click(nextBtn)
    const pageInput = screen.getByTestId('page-number-input') as HTMLInputElement
    expect(Number(pageInput.value)).toBe(2)
  })

  it('closes zoom modal on Escape key', () => {
    render(<ManualViewer onClose={onClose} />)
    fireEvent.click(screen.getAllByTestId(/^page-thumb-/)[0])
    expect(screen.getByTestId('manual-zoom-modal')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('manual-zoom-modal')).not.toBeInTheDocument()
  })

  it('jumps to page via number input', () => {
    render(<ManualViewer onClose={onClose} />)
    fireEvent.click(screen.getAllByTestId(/^page-thumb-/)[0])
    const pageInput = screen.getByTestId('page-number-input') as HTMLInputElement
    fireEvent.change(pageInput, { target: { value: '10' } })
    fireEvent.submit(pageInput.closest('form')!)
    expect(Number(pageInput.value)).toBe(10)
  })
})
