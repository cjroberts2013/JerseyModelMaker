import { useState } from 'react'
import { useModelStore } from '../state/useModelStore.js'

export default function ColorEditor({ model }) {
  const [open, setOpen] = useState(true)
  const partColors = useModelStore((s) => s.partColors)
  const setPartColor = useModelStore((s) => s.setPartColor)

  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 flex items-center justify-between bg-slate-900/60 text-sm font-medium"
      >
        <span>Global Colors</span>
        <span className="text-slate-500">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="p-3 space-y-2">
          {model.parts.map((p) => (
            <div key={p.id} className="flex items-center justify-between">
              <span className="text-sm text-slate-300">{p.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-500">
                  {partColors[p.id]}
                </span>
                <input
                  type="color"
                  value={partColors[p.id] || p.defaultColor}
                  onChange={(e) => setPartColor(p.id, e.target.value)}
                  className="w-8 h-8 rounded border border-slate-700 bg-slate-900 cursor-pointer"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
