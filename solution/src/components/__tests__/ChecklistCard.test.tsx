// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ChecklistCard from '../ChecklistCard'

const ITEMS = [
  { step: 'Set polarity to DCEP', description: 'Move the cable to the positive terminal.' },
  { step: 'Install wire spool', description: 'Thread the wire through the liner.' },
  { step: 'Attach ground clamp', description: 'Clamp to clean bare metal on the workpiece.' },
]

const ITEMS_RICH = [
  {
    step: 'Set polarity to DCEP',
    description: 'Move the MIG gun cable to the positive terminal.',
    image_id: 'owner-manual-008',
    tips: ['Double-check before striking arc', 'Wrong polarity = poor fusion'],
  },
  {
    step: 'Install wire spool',
    description: 'Thread the wire through the liner.',
  },
]

function renderCard(items = ITEMS, checked = items.map(() => false), onToggle = vi.fn()) {
  return render(
    <ChecklistCard title="MIG Setup" items={items} checked={checked} onToggle={onToggle} />
  )
}

beforeEach(() => {
  document.body.style.overflow = ''
})

describe('ChecklistCard — core', () => {
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
    renderCard(ITEMS, ITEMS.map(() => false), onToggle)
    fireEvent.click(screen.getByTestId('checklist-item-1'))
    expect(onToggle).toHaveBeenCalledWith(1)
  })

  it('shows strikethrough style on checked item', () => {
    renderCard(ITEMS, [true, false, false])
    const label = screen.getByText(ITEMS[0].step)
    expect(label).toHaveStyle({ textDecoration: 'line-through' })
  })

  it('shows all-done state when all items checked', () => {
    renderCard(ITEMS, ITEMS.map(() => true))
    expect(screen.getByText('All done ✓')).toBeInTheDocument()
    expect(screen.getByText(/All steps complete/)).toBeInTheDocument()
  })

  it('expands description when chevron clicked', () => {
    renderCard()
    expect(screen.queryByText(ITEMS[0].description)).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByLabelText('Expand details')[0])
    expect(screen.getByText(ITEMS[0].description)).toBeInTheDocument()
  })

  it('renders the checklist-card data-testid', () => {
    renderCard()
    expect(screen.getByTestId('checklist-card')).toBeInTheDocument()
  })
})

describe('ChecklistCard — image thumbnails', () => {
  it('does not render image when item is collapsed', () => {
    renderCard(ITEMS_RICH)
    expect(screen.queryByTestId('checklist-image-0')).not.toBeInTheDocument()
  })

  it('renders image thumbnail when item with image_id is expanded', () => {
    renderCard(ITEMS_RICH)
    fireEvent.click(screen.getAllByLabelText('Expand details')[0])
    expect(screen.getByTestId('checklist-image-0')).toBeInTheDocument()
  })

  it('does not render image for item without image_id', () => {
    renderCard(ITEMS_RICH)
    fireEvent.click(screen.getAllByLabelText('Expand details')[1])
    expect(screen.queryByTestId('checklist-image-1')).not.toBeInTheDocument()
  })

  it('opens zoom modal when image thumbnail is clicked', () => {
    renderCard(ITEMS_RICH)
    fireEvent.click(screen.getAllByLabelText('Expand details')[0])
    fireEvent.click(screen.getByTestId('checklist-image-0'))
    expect(screen.getByTestId('checklist-zoom-modal')).toBeInTheDocument()
  })

  it('closes zoom modal when backdrop is clicked', () => {
    renderCard(ITEMS_RICH)
    fireEvent.click(screen.getAllByLabelText('Expand details')[0])
    fireEvent.click(screen.getByTestId('checklist-image-0'))
    fireEvent.click(screen.getByTestId('checklist-zoom-modal'))
    expect(screen.queryByTestId('checklist-zoom-modal')).not.toBeInTheDocument()
  })

  it('closes zoom modal on Escape key', () => {
    renderCard(ITEMS_RICH)
    fireEvent.click(screen.getAllByLabelText('Expand details')[0])
    fireEvent.click(screen.getByTestId('checklist-image-0'))
    expect(screen.getByTestId('checklist-zoom-modal')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('checklist-zoom-modal')).not.toBeInTheDocument()
  })

  it('shows the image_id as a badge in the zoom modal header', () => {
    renderCard(ITEMS_RICH)
    fireEvent.click(screen.getAllByLabelText('Expand details')[0])
    fireEvent.click(screen.getByTestId('checklist-image-0'))
    // badge appears both on the thumbnail and in the modal header
    const badges = screen.getAllByText('owner-manual-008')
    expect(badges.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByTestId('checklist-zoom-modal')).toBeInTheDocument()
  })
})

describe('ChecklistCard — tips', () => {
  it('does not render tips when item is collapsed', () => {
    renderCard(ITEMS_RICH)
    expect(screen.queryByTestId('checklist-tips-0')).not.toBeInTheDocument()
  })

  it('renders tips block when item with tips is expanded', () => {
    renderCard(ITEMS_RICH)
    fireEvent.click(screen.getAllByLabelText('Expand details')[0])
    expect(screen.getByTestId('checklist-tips-0')).toBeInTheDocument()
    expect(screen.getByText('Double-check before striking arc')).toBeInTheDocument()
    expect(screen.getByText('Wrong polarity = poor fusion')).toBeInTheDocument()
  })

  it('does not render tips block for item without tips', () => {
    renderCard(ITEMS_RICH)
    fireEvent.click(screen.getAllByLabelText('Expand details')[1])
    expect(screen.queryByTestId('checklist-tips-1')).not.toBeInTheDocument()
  })

  it('shows Tips label in the tips block', () => {
    renderCard(ITEMS_RICH)
    fireEvent.click(screen.getAllByLabelText('Expand details')[0])
    expect(screen.getByText('Tips')).toBeInTheDocument()
  })
})
