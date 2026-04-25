import { useState } from 'react'
import { useModelStore } from '../state/useModelStore.js'
import { accentSlotId } from './ModelViewer.jsx'

/**
 * Color picker rows for every renderable surface.
 * - Plain parts get one row.
 * - Parts with `splitColors: true` get one row for the main body plus an
 *   "Accent N" row for each additional connected component detected by
 *   ModelViewer, so users can tint sleeve stripes / collars / name plates
 *   independently from the main jersey color.
 */
export default function ColorEditor({ model }) {
  const [open, setOpen] = useState(true)
  const partColors = useModelStore((s) => s.partColors)
  const partSlots = useModelStore((s) => s.partSlots)
  const setPartColor = useModelStore((s) => s.setPartColor)

  // Expand each splitColors part into its detected slot rows.
  const rows = []
  for (const p of model.parts) {
    if (p.splitColors) {
      const count = partSlots[p.id] || 1
      for (let i = 0; i < count; i++) {
        rows.push({
          id: accentSlotId(p.id, i),
          name: i === 0 ? p.name : `${p.name} Accent ${i}`,
          fallback: i === 0 ? p.defaultColor : (p.accentColor || '#a5acaf'),
        })
      }
    } else {
      rows.push({ id: p.id, name: p.name, fallback: p.defaultColor })
    }
  }

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
          {rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between">
              <span className="text-sm text-slate-300">{row.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-500">
                  {partColors[row.id] || row.fallback}
                </span>
                <input
                  type="color"
                  value={partColors[row.id] || row.fallback}
                  onChange={(e) => setPartColor(row.id, e.target.value)}
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
