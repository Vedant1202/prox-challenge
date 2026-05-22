// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ChecklistCard from '../ChecklistCard'

const ITEMS = [
  { step: 'Set polarity to DCEP', description: 'Move the cable to the positive terminal.' },
  { step: 'Install wire spool', description: 'Thread the wire through the liner.' },
  { step: 'Attach ground clamp', description: 'Clamp to clean bare metal on the workpiece.' },
]

function renderCard(checked = ITEMS.map(() => false), onToggle = vi.fn()) {
  return render(
    <ChecklistCard title="MIG Setup" items={ITEMS} checked={checked} onToggle={onToggle} />
  )
}

describe('ChecklistCard', () => {
  it('renders title and all step labels', () => {
    renderCard()
    expect(screen.getByText('MIG Setup')).toBeInTheDocument()
    ITEMS.forEach(item => expect(screen.getByText(item.step)).toBeInTheDocument())
  })

  it('shows 0/N done initially', () => {
    renderCard()
    expect(screen.getByText('0/3')).toBeInTheDocument()
  })

  it('calls onToggle with correct index when item clicked', () => {
    const onToggle = vi.fn()
    renderCard(ITEMS.map(() => false), onToggle)
    fireEvent.click(screen.getByTestId('checklist-item-1'))
    expect(onToggle).toHaveBeenCalledWith(1)
  })

  it('shows strikethrough style on checked item', () => {
    renderCard([true, false, false])
    const label = screen.getByText(ITEMS[0].step)
    expect(label).toHaveStyle({ textDecoration: 'line-through' })
  })

  it('shows all-done state when all items checked', () => {
    renderCard(ITEMS.map(() => true))
    expect(screen.getByText('All done ✓')).toBeInTheDocument()
    expect(screen.getByText(/All steps complete/)).toBeInTheDocument()
  })

  it('expands description when chevron clicked', () => {
    renderCard()
    // Description should not be visible initially
    expect(screen.queryByText(ITEMS[0].description)).not.toBeInTheDocument()
    // Click expand button for first item
    const expandBtn = screen.getAllByLabelText('Expand details')[0]
    fireEvent.click(expandBtn)
    expect(screen.getByText(ITEMS[0].description)).toBeInTheDocument()
  })

  it('renders the checklist-card data-testid', () => {
    renderCard()
    expect(screen.getByTestId('checklist-card')).toBeInTheDocument()
  })
})
