import React, { useRef, useState } from 'react'
import type { NoteItem } from '@/types'
import { FileText, Trash2, MoreVertical, Pencil, AlertTriangle } from 'lucide-react'

interface Props {
  note: NoteItem
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
  onRename: (title: string) => void
}

export function NoteListItem({ note, isActive, onSelect, onDelete, onRename }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editTitle, setEditTitle] = useState(note.title)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const relativeTime = formatRelative(note.updatedAt)

  const startEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setMenuOpen(false)
    setEditTitle(note.title)
    setEditMode(true)
    setTimeout(() => inputRef.current?.select(), 50)
  }

  const commitEdit = () => {
    const trimmed = editTitle.trim()
    if (trimmed && trimmed !== note.title) onRename(trimmed)
    setEditMode(false)
  }

  const cancelEdit = () => {
    setEditTitle(note.title)
    setEditMode(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') cancelEdit()
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpen(false)
    setConfirmDelete(true)
  }

  return (
    <div
      className={`group relative flex items-start gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
        isActive
          ? 'bg-indigo-950 border border-indigo-800'
          : 'hover:bg-zinc-800 border border-transparent'
      }`}
      onClick={editMode ? undefined : onSelect}
    >
      <FileText
        className={`w-4 h-4 mt-0.5 shrink-0 ${
          isActive ? 'text-indigo-400' : 'text-zinc-500'
        }`}
      />

      <div className="flex-1 min-w-0">
        {editMode ? (
          <input
            ref={inputRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            aria-label="フロー名"
            placeholder="フロー名を入力"
            className="w-full bg-zinc-700 text-sm text-zinc-100 px-1.5 py-0.5 rounded outline-none border border-indigo-500"
          />
        ) : (
          <p
            className={`text-sm font-medium truncate ${isActive ? 'text-indigo-200' : 'text-zinc-200'}`}
            onDoubleClick={startEdit}
            title="ダブルクリックで名前変更"
          >
            {note.title}
          </p>
        )}
        <p className="text-xs text-zinc-500 mt-0.5">{relativeTime}</p>
        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {note.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-xs px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Context menu trigger */}
      {!editMode && (
        <button
          aria-label="メニューを開く"
          className={`shrink-0 p-1 rounded-md transition-opacity ${
            menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          } hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100`}
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen(!menuOpen)
            setConfirmDelete(false)
          }}
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Dropdown */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }} />
          <div className="absolute right-0 top-8 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-40">
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
              onClick={startEdit}
            >
              <Pencil className="w-3.5 h-3.5 text-indigo-400" />
              名前変更
            </button>
            <div className="h-px bg-zinc-700 mx-2 my-1" />
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-zinc-700 transition-colors"
              onClick={handleDeleteClick}
            >
              <Trash2 className="w-3.5 h-3.5" />
              削除
            </button>
          </div>
        </>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setConfirmDelete(false) }} />
          <div
            className="absolute right-0 top-8 z-50 bg-zinc-800 border border-red-800 rounded-lg shadow-xl p-3 min-w-48"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-zinc-200 leading-snug">
                「{note.title}」を削除しますか？<br />
                <span className="text-zinc-500">この操作は取り消せません。</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="flex-1 text-xs px-2 py-1.5 rounded-md bg-red-700 hover:bg-red-600 text-white transition-colors"
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); onDelete() }}
              >
                削除する
              </button>
              <button
                className="flex-1 text-xs px-2 py-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors"
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(false) }}
              >
                キャンセル
              </button>
            </div>
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
