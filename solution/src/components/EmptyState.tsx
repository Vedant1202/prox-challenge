'use client'

/**
 * EmptyState — shown in the chat area when there are no messages yet.
 *
 * Displays the Siri-orb hero animation, a brief product description, and a list
 * of suggested questions the user can tap to kick off a conversation.
 */
import SiriOrb from '@/components/SiriOrb'

// Starter questions shown before the first message is sent
const SUGGESTED_QUESTIONS = [
  "What's the duty cycle for MIG at 200A on 240V?",
  "What polarity setup do I need for TIG welding?",
  "I'm getting porosity in my flux-cored welds. What should I check?",
  "Show me the wire feed mechanism.",
  "What wire speed and voltage for MIG on 1/4\" steel?",
]

interface EmptyStateProps {
  onSendMessage: (text: string) => void
}

export default function EmptyState({ onSendMessage }: EmptyStateProps) {
  return (
    <div style={{ paddingTop: 48 }}>
      {/* Hero orb */}
      <div style={{ marginBottom: 32 }}>
        <SiriOrb size={160} />
      </div>

      {/* Headline */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <h1 className="text-2xl font-bold text-base-content mb-2">
          Vulcan OmniPro 220 Assistant
        </h1>
        <p
          className="text-sm text-base-content/55 max-w-sm mx-auto"
          style={{ lineHeight: 1.65 }}
        >
          Ask anything about setup, settings, troubleshooting, or how to use your welder.
          I have the full manual and can show you diagrams and interactive visuals.
        </p>
      </div>

      {/* Suggested starter questions */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          maxWidth: 560,
          margin: '0 auto',
        }}
      >
        {SUGGESTED_QUESTIONS.map(q => (
          <button
            key={q}
            onClick={() => onSendMessage(q)}
            className="glass-card text-left rounded-xl px-4 py-3 text-sm text-base-content/80 hover:text-base-content transition-colors duration-150 cursor-pointer w-full"
            style={{ lineHeight: 1.45 }}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}
