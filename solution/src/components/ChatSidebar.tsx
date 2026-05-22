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
      className="glass border-r flex flex-col overflow-hidden flex-shrink-0"
      style={{ width: 240, height: '100vh', zIndex: 2 }}
    >
      {/* New chat button */}
      <div className="p-3 border-b border-inherit flex-shrink-0">
        <button
          onClick={onNewChat}
          className="btn btn-ghost btn-sm w-full justify-start gap-2 text-base-content/70 hover:text-base-content transition-colors"
        >
          <span className="text-base leading-none text-primary">+</span>
          New Chat
        </button>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto p-2">
        {chats.length === 0 && (
          <div className="text-xs text-base-content/30 text-center mt-6">No chats yet</div>
        )}
        {chats.map(chat => {
          const isActive = chat.id === activeChatId
          return (
            <div
              key={chat.id}
              onClick={() => onSelectChat(chat.id)}
              className={`
                group flex items-center gap-2 rounded-lg px-3 py-2 mb-1 cursor-pointer
                transition-all duration-150 select-none
                ${isActive
                  ? 'glass-card border-l-2 !border-l-primary'
                  : 'hover:bg-base-content/5 border-l-2 border-l-transparent'
                }
              `}
            >
              <span
                className={`text-xs flex-1 truncate leading-snug transition-colors duration-150 ${
                  isActive ? 'text-base-content' : 'text-base-content/55'
                }`}
              >
                {chat.title}
              </span>
              <button
                onClick={e => { e.stopPropagation(); onDeleteChat(chat.id) }}
                className="opacity-0 group-hover:opacity-100 btn btn-ghost btn-xs btn-circle text-base-content/35 hover:text-error hover:bg-transparent transition-all flex-shrink-0"
                aria-label="Delete chat"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
