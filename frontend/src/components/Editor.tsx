import { useRef } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { useAppStore } from '../store'
import { Save, Undo, Redo, Loader2 } from 'lucide-react'

interface EditorProps {
  getToken: () => Promise<string>
}

export default function Editor({ getToken }: EditorProps) {
  const { markdown: md, setMarkdown, saveNote, isSaving } = useAppStore()
  const historyRef = useRef<string[]>([])
  const historyIndexRef = useRef(-1)

  const handleChange = (value: string) => {
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
    historyRef.current.push(value)
    historyIndexRef.current = historyRef.current.length - 1
    setMarkdown(value)
  }

  const undo = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--
      setMarkdown(historyRef.current[historyIndexRef.current])
    }
  }

  const redo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++
      setMarkdown(historyRef.current[historyIndexRef.current])
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-700 bg-gray-800">
        <span className="text-sm font-medium text-gray-300 flex-1">Markdown Editor</span>
        <button onClick={undo} className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white" title="Undo">
          <Undo size={16} />
        </button>
        <button onClick={redo} className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white" title="Redo">
          <Redo size={16} />
        </button>
        <button
          onClick={() => saveNote(getToken)}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-60 transition-colors ml-1"
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <CodeMirror
          value={md}
          height="100%"
          theme="dark"
          extensions={[markdown()]}
          onChange={handleChange}
          className="h-full text-sm"
          style={{ height: '100%' }}
        />
      </div>
    </div>
  )
}
