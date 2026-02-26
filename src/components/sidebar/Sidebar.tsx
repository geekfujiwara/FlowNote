import React, { useState } from 'react'
import { useStore } from '@/store/useStore'
import { NoteListItem } from './NoteListItem'
import {
  FilePlus2,
  Search,
  FileText,
  SlidersHorizontal,
  Loader2,
} from 'lucide-react'

export function Sidebar() {
  const notes = useStore((s) => s.notes)
  const currentNote = useStore((s) => s.currentNote)
  const newNote = useStore((s) => s.newNote)
  const loadNote = useStore((s) => s.loadNote)
  const deleteNote = useStore((s) => s.deleteNote)

  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const filtered = notes.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    (n.tags ?? []).some((t) => t.toLowerCase().includes(search.toLowerCase()))
  )

  const handleNew = () => {
    newNote()
  }

  const handleLoad = async (id: string) => {
    if (currentNote?.id === id) return
    setLoading(true)
    try {
      await loadNote(id)
    } finally {
      setLoading(false)
    }
  }

  return (
    <aside className="h-full flex flex-col bg-zinc-900 border-r border-zinc-800 w-64">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
          <FileText className="w-4 h-4 text-indigo-400" />
          <span>ノート一覧</span>
          <span className="text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded-full">
            {notes.length}
          </span>
        </div>
        <button
          onClick={handleNew}
          className="p-1.5 rounded-md hover:bg-zinc-700 text-zinc-400 hover:text-indigo-300 transition-colors"
          title="新しいノートを作成"
        >
          <FilePlus2 className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-1.5">
          <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <input
            type="text"
            placeholder="検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-zinc-500 hover:text-zinc-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Note list */}
      <div className="flex-1 overflow-y-auto py-1 space-y-0.5 px-1">
        {loading && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center py-8 gap-3 text-zinc-600">
            <FileText className="w-8 h-8" />
            <div className="text-center text-xs px-4">
              {search ? `"${search}" に一致するノートがありません` : 'ノートがありません'}
            </div>
            {!search && (
              <button
                onClick={handleNew}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
                新規作成
              </button>
            )}
          </div>
        )}

        {filtered.map((note) => (
          <NoteListItem
            key={note.id}
            note={note}
            isActive={currentNote?.id === note.id}
            onSelect={() => handleLoad(note.id)}
            onDelete={() => deleteNote(note.id)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-800 p-3">
        <button className="w-full flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1.5 rounded-md hover:bg-zinc-800">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>設定</span>
        </button>
      </div>
    </aside>
  )
}
