'use client'

export interface ChatRecord {
  id: string
  title: string
  updated_at: number
}

type View = 'chat' | 'diagram' | 'manual'

interface ChatSidebarProps {
  chats: ChatRecord[]
  activeChatId: string | null
  onSelectChat: (id: string) => void
  onNewChat: () => void
  onDeleteChat: (id: string) => void
  view: View
  onViewChange: (v: View) => void
  mobileOpen?: boolean
  onMobileClose?: () => void
}

function DiagramIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="12" height="12" rx="2" />
      <circle cx="4.5" cy="4.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="4.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="9.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="9.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="7" cy="7" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function ManualIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 2h7l2 2v8a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" />
      <path d="M4 5.5h5M4 7.5h5M4 9.5h3" />
    </svg>
  )
}

export default function ChatSidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  view,
  onViewChange,
  mobileOpen,
  onMobileClose,
}: ChatSidebarProps) {
  function handleViewItem(v: View) {
    onViewChange(view === v ? 'chat' : v)
  }

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 sm:hidden" onClick={onMobileClose} />
      )}
    <div
      className={`glass border-r flex flex-col overflow-hidden flex-shrink-0 fixed inset-y-0 left-0 z-30 transition-transform duration-200 sm:static sm:translate-x-0 sm:z-auto ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      style={{ width: 240 }}
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
          const isActive = chat.id === activeChatId && view === 'chat'
          return (
            <div
              key={chat.id}
              onClick={() => { onViewChange('chat'); onSelectChat(chat.id) }}
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
                className="opacity-25 group-hover:opacity-100 btn btn-ghost btn-xs btn-circle text-base-content/35 hover:text-error hover:bg-transparent transition-all flex-shrink-0"
                aria-label="Delete chat"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>

      {/* Tools nav */}
      <div className="flex-shrink-0 border-t border-base-content/10 px-2 py-2">
        <p className="px-3 pb-1.5 text-[10px] font-semibold tracking-widest uppercase text-base-content/30">
          Tools
        </p>

        <button
          data-testid="nav-diagram"
          onClick={() => handleViewItem('diagram')}
          className={`
            w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium
            transition-all duration-150 select-none
            ${view === 'diagram'
              ? 'glass-card border-l-2 !border-l-primary text-base-content'
              : 'text-base-content/55 hover:bg-base-content/5 border-l-2 border-l-transparent'
            }
          `}
          aria-label="Machine Diagram"
        >
          <DiagramIcon />
          Machine Diagram
        </button>

        <button
          data-testid="nav-manual"
          onClick={() => handleViewItem('manual')}
          className={`
            w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium
            transition-all duration-150 select-none mt-0.5
            ${view === 'manual'
              ? 'glass-card border-l-2 !border-l-primary text-base-content'
              : 'text-base-content/55 hover:bg-base-content/5 border-l-2 border-l-transparent'
            }
          `}
          aria-label="Manual Pages"
        >
          <ManualIcon />
          Manual Pages
        </button>
      </div>
    </div>
    </>
  )
}
