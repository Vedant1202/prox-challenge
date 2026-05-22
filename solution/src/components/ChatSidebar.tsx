'use client'

export interface ChatRecord {
  id: string
  title: string
  updated_at: number
}

interface ChatSidebarProps {
  chats: ChatRecord[]
  activeChatId: string | null
  onSelectChat: (id: string) => void
  onNewChat: () => void
  onDeleteChat: (id: string) => void
}

export default function ChatSidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
}: ChatSidebarProps) {
  return (
    <div
      style={{
        width: '240px',
        flexShrink: 0,
        background: '#0d0d0d',
        borderRight: '1px solid #1a1a1a',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* New chat button */}
      <div style={{ padding: '12px 10px', borderBottom: '1px solid #1a1a1a' }}>
        <button
          onClick={onNewChat}
          style={{
            width: '100%',
            background: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#ccc',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#222'
            e.currentTarget.style.color = '#e5e5e5'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#1a1a1a'
            e.currentTarget.style.color = '#ccc'
          }}
        >
          <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span>
          New Chat
        </button>
      </div>

      {/* Chat list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
        {chats.length === 0 && (
          <div style={{ fontSize: '12px', color: '#444', textAlign: 'center', marginTop: '24px' }}>
            No chats yet
          </div>
        )}
        {chats.map(chat => {
          const isActive = chat.id === activeChatId
          return (
            <div
              key={chat.id}
              onClick={() => onSelectChat(chat.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                borderRadius: '8px',
                padding: '7px 8px',
                cursor: 'pointer',
                marginBottom: '2px',
                background: isActive ? '#1a1a1a' : 'transparent',
                borderLeft: isActive ? '2px solid #f59e0b' : '2px solid transparent',
                transition: 'all 0.15s',
                gap: '6px',
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.background = '#141414'
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.background = 'transparent'
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  color: isActive ? '#e5e5e5' : '#888',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.4,
                }}
              >
                {chat.title}
              </span>
              <button
                onClick={e => {
                  e.stopPropagation()
                  onDeleteChat(chat.id)
                }}
                style={{
                  flexShrink: 0,
                  background: 'none',
                  border: 'none',
                  color: '#444',
                  cursor: 'pointer',
                  fontSize: '14px',
                  padding: '0 2px',
                  lineHeight: 1,
                  opacity: 0,
                  transition: 'opacity 0.15s',
                }}
                className="delete-btn"
                aria-label="Delete chat"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>

      <style>{`
        div:hover .delete-btn { opacity: 1 !important; }
      `}</style>
    </div>
  )
}
