'use client'

export type Model = 'claude-sonnet-4-6' | 'claude-haiku-4-5'

const OPTIONS: { id: Model; label: string; sublabel: string }[] = [
  { id: 'claude-sonnet-4-6', label: 'Sonnet', sublabel: 'Smart' },
  { id: 'claude-haiku-4-5', label: 'Haiku', sublabel: 'Fast' },
]

interface ModelSelectorProps {
  value: Model
  onChange: (model: Model) => void
  readOnly?: boolean
}

export default function ModelSelector({ value, onChange, readOnly = false }: ModelSelectorProps) {
  const activeOpt = OPTIONS.find(o => o.id === value) ?? OPTIONS[0]

  if (readOnly) {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
        style={{
          background: 'rgba(129,140,248,0.08)',
          border: '1px solid rgba(129,140,248,0.15)',
          color: 'rgba(var(--bc), 0.5)',
        }}
        title={activeOpt.id}
      >
        <span
          className="inline-block rounded-full flex-shrink-0"
          style={{ width: 6, height: 6, background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}
        />
        <span>{activeOpt.label}</span>
        <span className="hidden sm:inline" style={{ opacity: 0.5, fontSize: 10 }}>{activeOpt.sublabel}</span>
      </div>
    )
  }

  return (
    <div
      className="flex items-center rounded-lg p-0.5 gap-0.5"
      style={{ background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.15)' }}
    >
      {OPTIONS.map(opt => {
        const active = value === opt.id
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150"
            style={{
              background: active ? 'linear-gradient(135deg, #7c3aed, #06b6d4)' : 'transparent',
              color: active ? '#fff' : 'rgba(var(--bc), 0.5)',
            }}
          >
            <span>{opt.label}</span>
            <span
              className="hidden sm:inline text-xs"
              style={{ opacity: active ? 0.75 : 0.4, fontSize: 10 }}
            >
              {opt.sublabel}
            </span>
          </button>
        )
      })}
    </div>
  )
}
