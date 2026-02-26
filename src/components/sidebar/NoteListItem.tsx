import React, { useState } from 'react'
import type { NoteItem } from '@/types'
import { FileText, Trash2, MoreVertical } from 'lucide-react'

interface Props {
  note: NoteItem
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}

export function NoteListItem({ note, isActive, onSelect, onDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)

  const relativeTime = formatRelative(note.updatedAt)

  return (
    <div
      className={`group relative flex items-start gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
        isActive
          ? 'bg-indigo-950 border border-indigo-800'
          : 'hover:bg-zinc-800 border border-transparent'
      }`}
      onClick={onSelect}
    >
      <FileText
        className={`w-4 h-4 mt-0.5 shrink-0 ${
          isActive ? 'text-indigo-400' : 'text-zinc-500'
        }`}
      />

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isActive ? 'text-indigo-200' : 'text-zinc-200'}`}>
          {note.title}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">{relativeTime}</p>
        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {note.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-xs px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Context menu trigger */}
      <button
        className={`shrink-0 p-1 rounded-md transition-opacity ${
          menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        } hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100`}
        onClick={(e) => {
          e.stopPropagation()
          setMenuOpen(!menuOpen)
        }}
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>

      {/* Dropdown */}
      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }}
          />
          <div className="absolute right-0 top-8 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-36">
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-zinc-700 transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen(false)
                onDelete()
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              削除
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function formatRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}分前`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}時間前`
    const d = Math.floor(h / 24)
    if (d < 30) return `${d}日前`
    return new Date(iso).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}
