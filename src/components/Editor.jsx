import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import data from '../data/models.json'
import { useModelStore } from '../state/useModelStore.js'
import { resolveModel } from '../lib/resolveModel.js'
import { loadAllFonts } from '../lib/fontLoader.js'
import ModelViewer from './ModelViewer.jsx'
import TextEditor from './TextEditor.jsx'
import ColorEditor from './ColorEditor.jsx'
import ExportPanel from './ExportPanel.jsx'
import ExportDialog from './ExportDialog.jsx'

export default function Editor() {
  const { modelId } = useParams()
  const navigate = useNavigate()
  const entry = data.models.find((m) => m.id === modelId)
  const model = useMemo(() => resolveModel(entry, data.templates), [entry])
  const initFromModel = useModelStore((s) => s.initFromModel)
  const sceneRef = useRef(null)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [fonts, setFonts] = useState([])

  // Load the font catalog from /fonts.json once.
  useEffect(() => {
    let cancelled = false
    loadAllFonts('/fonts.json').then((map) => {
      if (!cancelled) setFonts(map.list || [])
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (model && fonts.length) initFromModel(model, fonts)
  }, [model, fonts, initFromModel])

  if (!model) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        Model not found.{' '}
        <button className="ml-2 underline" onClick={() => navigate('/')}>
          Back to gallery
        </button>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen flex">
      {/* Sidebar */}
      <aside className="w-[320px] shrink-0 bg-slate-950/80 border-r border-slate-800 overflow-y-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="text-xs uppercase text-slate-400 hover:text-white"
          >
            ← Gallery
          </button>
          <div className="text-xs text-slate-500">{model.name}</div>
        </div>
        <TextEditor model={model} fonts={fonts} />
        <ColorEditor model={model} />
      </aside>

      {/* Canvas + top-right controls */}
      <main className="relative flex-1">
        <ModelViewer
          model={model}
          fonts={fonts}
          onSceneReady={(scene) => {
            sceneRef.current = scene
          }}
        />
        <div className="absolute top-4 right-4 w-[220px] bg-slate-900/70 border border-slate-800 rounded-xl p-3 backdrop-blur">
          <ExportPanel
            getScene={() => sceneRef.current}
            modelName={model.name}
            onOpenDownloadDialog={() => setDownloadOpen(true)}
          />
        </div>
        <ExportDialog
          open={downloadOpen}
          onClose={() => setDownloadOpen(false)}
          model={model}
          getScene={() => sceneRef.current}
        />
        <button
          onClick={() => navigate('/')}
          className="absolute top-4 right-[calc(220px+2rem)] w-10 h-10 rounded-full bg-red-600 text-white text-lg flex items-center justify-center shadow"
          aria-label="Close editor"
          title="Close"
        >
          ×
        </button>
      </main>
    </div>
  )
}
