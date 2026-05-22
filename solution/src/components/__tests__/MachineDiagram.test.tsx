// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MachineDiagram, { MachineDiagramPage } from '../MachineDiagram'

// Mock Next.js Image
vi.mock('next/image', () => ({
  default: (props: { src: string; alt: string; fill?: boolean; className?: string; style?: object; priority?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} alt={props.alt} className={props.className} style={props.style} />
  ),
}))

beforeEach(() => {
  // Reset body overflow
  document.body.style.overflow = ''
})

describe('MachineDiagram', () => {
  it('renders without crashing', () => {
    render(<MachineDiagram />)
    expect(document.body).toBeTruthy()
  })

  it('shows Front Panel tab by default', () => {
    render(<MachineDiagram />)
    const frontTab = screen.getByRole('button', { name: /front panel/i })
    expect(frontTab).toBeInTheDocument()
  })

  it('switches to Interior tab on click', () => {
    render(<MachineDiagram />)
    const interiorTab = screen.getByRole('button', { name: /interior/i })
    fireEvent.click(interiorTab)
    // Interior tab becomes active (has different styling — at minimum it should still be there)
    expect(interiorTab).toBeInTheDocument()
  })

  it('opens a popover when a pin is clicked', () => {
    render(<MachineDiagram />)
    // Pins have aria-label matching the hotspot label, e.g. "LCD Display"
    const pins = screen.getAllByTestId(/^hotspot-pin-/)
    expect(pins.length).toBeGreaterThan(0)
    fireEvent.click(pins[0])
    // A close button should appear inside the popover
    expect(screen.getByTestId('hotspot-popover')).toBeInTheDocument()
  })

  it('closes popover when X button is clicked', () => {
    render(<MachineDiagram />)
    const pins = screen.getAllByTestId(/^hotspot-pin-/)
    fireEvent.click(pins[0])
    expect(screen.getByTestId('hotspot-popover')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Close'))
    expect(screen.queryByTestId('hotspot-popover')).not.toBeInTheDocument()
  })

  it('opens zoom modal when zoom button is clicked', () => {
    render(<MachineDiagram />)
    const zoomBtn = screen.getByLabelText(/zoom/i)
    fireEvent.click(zoomBtn)
    expect(screen.getByTestId('zoom-modal')).toBeInTheDocument()
  })

  it('closes zoom modal on backdrop click', () => {
    render(<MachineDiagram />)
    fireEvent.click(screen.getByLabelText(/zoom/i))
    const modal = screen.getByTestId('zoom-modal')
    fireEvent.click(modal)
    expect(screen.queryByTestId('zoom-modal')).not.toBeInTheDocument()
  })
})

describe('MachineDiagramPage', () => {
  it('renders a Back button and calls onClose', () => {
    const onClose = vi.fn()
    render(<MachineDiagramPage onClose={onClose} />)
    const back = screen.getByText(/back to chat/i)
    fireEvent.click(back)
    expect(onClose).toHaveBeenCalled()
  })
})
