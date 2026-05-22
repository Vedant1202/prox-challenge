'use client'

interface SiriOrbProps {
  size?: number
}

export default function SiriOrb({ size = 180 }: SiriOrbProps) {
  const glow = Math.round(size * 0.28)

  return (
    <div
      style={{
        width: size + glow * 2,
        height: size + glow * 2,
        position: 'relative',
        margin: '0 auto',
      }}
    >
      {/* Outer glow — bleeds beyond wrapper */}
      <div className="siri-orb-glow" style={{ inset: 0 }} />
      {/* Main rotating body */}
      <div className="siri-orb-body" style={{ inset: glow }}>
        <div className="siri-orb-core" />
        <div className="siri-orb-glass" />
      </div>
    </div>
  )
}
