import React, { useState, useRef } from 'react'
import { useStore } from '@/store/useStore'
import { Tag, Clock, Layers, GitBranch, Plus, X } from 'lucide-react'

export function FlowMetadataPanel() {
  const currentNote = useStore((s) => s.currentNote)
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const setTags = useStore((s) => s.setTags)

  const [tagInputOpen, setTagInputOpen] = useState(false)
  const [newTag, setNewTag] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  if (!currentNote) return null

  const tags = currentNote.tags ?? []

  const updatedAt = currentNote.updatedAt
    ? new Date(currentNote.updatedAt).toLocaleString('ja-JP', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '—'

  const openTagInput = () => {
    setTagInputOpen(true)
    setNewTag('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const commitTag = () => {
    const t = newTag.trim()
    if (t && !tags.includes(t)) {
      setTags([...tags, t])
    }
    setTagInputOpen(false)
    setNewTag('')
  }

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  return (
    <div className="flex items-center gap-4 px-4 py-1.5 bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-500 shrink-0">
      {/* Title */}
      <span className="font-medium text-zinc-300 truncate max-w-40">{currentNote.title}</span>

      <div className="flex items-center gap-3 ml-auto flex-wrap">
        {/* Tags */}
        <div className="flex items-center gap-1 flex-wrap">
          <Tag className="w-3 h-3 shrink-0" />
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-900/50 text-indigo-300"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="hover:text-red-400 transition-colors ml-0.5"
                title="タグを削除"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
          {tagInputOpen ? (
            <input
              ref={inputRef}
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTag()
                if (e.key === 'Escape') { setTagInputOpen(false); setNewTag('') }
              }}
              onBlur={commitTag}
              className="w-20 bg-zinc-800 border border-indigo-500 rounded px-1.5 py-0.5 text-zinc-200 outline-none text-xs"
              placeholder="タグ名"
            />
          ) : (
            <button
              onClick={openTagInput}
              className="flex items-center gap-0.5 px-1 py-0.5 rounded hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
              title="タグを追加"
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Node count */}
        <div className="flex items-center gap-1">
          <Layers className="w-3 h-3" />
          <span>{nodes.length} ノード</span>
        </div>

        {/* Edge count */}
        <div className="flex items-center gap-1">
          <GitBranch className="w-3 h-3" />
          <span>{edges.length} エッジ</span>
        </div>

        {/* Updated at */}
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{updatedAt}</span>
        </div>
      </div>
    </div>
  )
}
