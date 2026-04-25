import { useState } from 'react'
import { useModelStore } from '../state/useModelStore.js'
import { accentSlotId } from './ModelViewer.jsx'

/**
 * Global color editor.
 *
 *   ┌─ Global Colors ─────────────────────────┐
 *   │  Set colors for your design.            │
 *   │                                         │
 *   │  📝 TEXT COLOR                          │
 *   │  [■] #ffffff                            │
 *   │  Applies to all texts                   │
 *   │                                         │
 *   │  📦 MODEL COLORS                        │
 *   │  Frame              [■]                 │
 *   │  Background         [■] [■]             │  ← multi-swatch from palette
 *   │  Jersey             [■] [■] [■]         │
 *   │  …                                      │
 *   └─────────────────────────────────────────┘
 *
 * Each part shows one swatch per palette entry when the model has vertex
 * colors (FBX/GLB), or a single swatch when it doesn't (STL fallback).
 * `splitColors: true` parts also expand into accent rows (legacy STL
 * multi-piece path).
 */
export default function ColorEditor({ model }) {
  const [open, setOpen] = useState(true)
  const partColors = useModelStore((s) => s.partColors)
  const partSlots = useModelStore((s) => s.partSlots)
  const colorPalettes = useModelStore((s) => s.colorPalettes)
  const setPartColor = useModelStore((s) => s.setPartColor)
  const setPaletteColor = useModelStore((s) => s.setPaletteColor)
  const globalTextColor = useModelStore((s) => s.globalTextColor)
  const setGlobalTextColor = useModelStore((s) => s.setGlobalTextColor)

  // Build the list of part-level rows. Each row carries either an array of
  // palette swatches (vertex-color path) or a single legacy swatch.
  const rows = []
  for (const p of model.parts) {
    const palette = colorPalettes[p.id]
    if (palette && palette.length) {
      rows.push({
        id: p.id,
        name: p.name,
        kind: 'palette',
        swatches: palette.map((entry, index) => ({
          key: `${p.id}-${index}`,
          color: entry.currentColor,
          onChange: (color) => setPaletteColor(p.id, index, color),
        })),
      })
      continue
    }
    if (p.splitColors) {
      // No palette detected (STL) but the part is split-colors capable —
      // fall back to the per-component slots reported by the viewer.
      const count = partSlots[p.id] || 1
      const swatches = []
      for (let i = 0; i < count; i++) {
        const slotId = accentSlotId(p.id, i)
        const fallback =
          i === 0 ? p.defaultColor : (p.accentColor || '#a5acaf')
        swatches.push({
          key: slotId,
          color: partColors[slotId] || fallback,
          onChange: (color) => setPartColor(slotId, color),
        })
      }
      rows.push({ id: p.id, name: p.name, kind: 'parts', swatches })
      continue
    }
    rows.push({
      id: p.id,
      name: p.name,
      kind: 'single',
      swatches: [
        {
          key: p.id,
          color: partColors[p.id] || p.defaultColor,
          onChange: (color) => setPartColor(p.id, color),
        },
      ],
    })
  }

  const textColor = globalTextColor || '#111111'

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
        <div className="p-3 space-y-4">
          <p className="text-xs text-slate-500">Set colors for your design.</p>

          {/* TEXT COLOR — applies to every text zone */}
          <div className="rounded-md border border-slate-800 bg-slate-900/40 p-3 space-y-2">
            <div className="text-xs uppercase font-semibold text-indigo-300">
              Text Color
            </div>
            <div className="flex items-center gap-2">
              <Swatch
                color={textColor}
                onChange={(c) => setGlobalTextColor(c)}
              />
              <span className="text-xs font-mono text-slate-400">{textColor}</span>
            </div>
            <p className="text-[11px] text-slate-500">Applies to all texts</p>
          </div>

          {/* MODEL COLORS — one row per part, multiple swatches when palette */}
          <div className="rounded-md border border-slate-800 bg-slate-900/40 p-3 space-y-3">
            <div className="text-xs uppercase font-semibold text-indigo-300">
              Model Colors
            </div>
            {rows.map((row) => (
              <div key={row.id} className="space-y-1">
                <div className="text-sm text-slate-300">{row.name}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  {row.swatches.map((s) => (
                    <Swatch key={s.key} color={s.color} onChange={s.onChange} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Swatch({ color, onChange }) {
  return (
    <input
      type="color"
      value={color}
      onChange={(e) => onChange(e.target.value)}
      className="w-9 h-9 rounded border-2 border-indigo-500/40 bg-slate-900 cursor-pointer"
      title={color}
    />
  )
}
