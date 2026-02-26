import { useEffect, useState } from 'react'
import { useAppStore } from '../store'
import { FilePlus, Search, Trash2, FileText, Clock, Tag } from 'lucide-react'

interface SidebarProps {
  getToken: () => Promise<string>
}

export default function Sidebar({ getToken }: SidebarProps) {
  const { notes, currentNote, listNotes, loadNote, deleteNote } = useAppStore()
  const [search, setSearch] = useState('')

  useEffect(() => {
    listNotes(getToken)
  }, [])

  const filtered = notes.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase())
  )

  const handleNewNote = () => {
    useAppStore.setState({
      currentNote: { id: '', title: 'Untitled', updatedAt: new Date().toISOString(), tags: [] },
      markdown: '',
      flow: { nodes: [], edges: [] },
    })
  }

  return (
    <div className="w-72 bg-gray-800 flex flex-col border-r border-gray-700">
      <div className="p-4 border-b border-gray-700 flex items-center gap-2">
        <span className="text-xl font-bold text-white flex-1">FlowNote</span>
        <button
          onClick={handleNewNote}
          className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          title="New Note"
        >
          <FilePlus size={18} />
        </button>
      </div>

      <div className="px-3 py-2">
        <div className="flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-1.5">
          <Search size={14} className="text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="bg-transparent text-sm text-white placeholder-gray-400 outline-none flex-1"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1">
        {filtered.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-8">No notes yet</div>
        ) : (
          filtered.map((note) => (
            <div
              key={note.id}
              onClick={() => loadNote(note.id, getToken)}
              className={`group flex items-start gap-2 p-3 rounded-lg cursor-pointer mb-1 transition-colors ${
                currentNote?.id === note.id ? 'bg-blue-600/20 border border-blue-500/30' : 'hover:bg-gray-700'
              }`}
            >
              <FileText size={16} className="text-gray-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{note.title}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Clock size={10} className="text-gray-500" />
                  <span className="text-xs text-gray-500">
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                {note.tags && note.tags.length > 0 && (
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <Tag size={10} className="text-gray-500" />
                    {note.tags.map((t) => (
                      <span key={t} className="text-xs bg-gray-600 text-gray-300 px-1.5 py-0.5 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteNote(note.id, getToken)
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
