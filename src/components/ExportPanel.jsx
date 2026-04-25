import { useState } from 'react'
import { useModelStore } from '../state/useModelStore.js'
import { export3MF } from '../lib/exporters.js'

export default function ExportPanel({ getScene, modelName, onOpenDownloadDialog }) {
  const exportScale = useModelStore((s) => s.exportScale)
  const setExportScale = useModelStore((s) => s.setExportScale)
  const [busy, setBusy] = useState(false)

  const slugify = (s) => s.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')

  const download3mf = () => {
    const scene = getScene()
    if (!scene) return
    setBusy(true)
    try {
      export3MF(scene, `${slugify(modelName)}.3mf`, exportScale)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs uppercase text-slate-400 mb-1">
          Export Scale: {exportScale.toFixed(2)}x
        </label>
        <input
          type="range"
          min={0.1}
          max={5}
          step={0.05}
          value={exportScale}
          onChange={(e) => setExportScale(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>
      <button
        onClick={onOpenDownloadDialog}
        disabled={busy}
        className="w-full py-3 rounded text-white font-semibold text-sm tracking-wide disabled:opacity-50"
        style={{ background: 'linear-gradient(90deg,#7c3aed 0%,#4f46e5 100%)' }}
      >
        DOWNLOAD MODEL
      </button>
      <button
        onClick={download3mf}
        disabled={busy}
        className="w-full py-3 rounded text-white font-semibold text-sm tracking-wide disabled:opacity-50"
        style={{ background: 'linear-gradient(90deg,#0ea5e9 0%,#3b82f6 100%)' }}
      >
        EXPORT 3MF
      </button>
    </div>
  )
}
