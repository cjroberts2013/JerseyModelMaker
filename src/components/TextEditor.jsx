import { useState } from 'react'
import { useModelStore } from '../state/useModelStore.js'

export default function TextEditor({ model, fonts }) {
  const [activeZoneId, setActiveZoneId] = useState(model.textZones[0]?.id)
  const textConfigs = useModelStore((s) => s.textConfigs)
  const setTextField = useModelStore((s) => s.setTextField)

  if (!model.textZones.length) return null
  const activeZone = model.textZones.find((z) => z.id === activeZoneId)
  const cfg = textConfigs[activeZoneId]
  if (!activeZone || !cfg) return null

  const alignments = [
    { id: 'left', icon: '←' },
    { id: 'center', icon: '↔' },
    { id: 'right', icon: '→' },
  ]

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold tracking-wide text-white">Customize Text</div>

      <div>
        <label className="block text-xs uppercase text-slate-400 mb-2">
          Select text to customize:
        </label>
        <select
          value={activeZoneId}
          onChange={(e) => setActiveZoneId(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm"
        >
          {model.textZones.map((z) => (
            <option key={z.id} value={z.id}>
              "{z.label}"
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs uppercase text-slate-400 mb-2">Your Text</label>
        <textarea
          value={cfg.text}
          onChange={(e) => setTextField(activeZoneId, 'text', e.target.value)}
          rows={2}
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm resize-none"
        />
      </div>

      <div>
        <label className="block text-xs uppercase text-slate-400 mb-2">Font Family</label>
        <select
          value={cfg.fontName || ''}
          onChange={(e) => setTextField(activeZoneId, 'fontName', e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm"
        >
          {fonts.map((f) => (
            <option key={f.name} value={f.name}>
              {f.displayName || f.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs uppercase text-slate-400 mb-2">Text Alignment</label>
        <div className="flex gap-2">
          {alignments.map((a) => (
            <button
              key={a.id}
              onClick={() => setTextField(activeZoneId, 'align', a.id)}
              className={`flex-1 py-2 rounded text-lg ${
                cfg.align === a.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-900 text-slate-400 border border-slate-700'
              }`}
            >
              {a.icon}
            </button>
          ))}
        </div>
      </div>

      <Slider
        label="Size"
        unit="mm"
        value={cfg.size}
        min={2}
        max={50}
        step={0.5}
        onChange={(v) => setTextField(activeZoneId, 'size', v)}
      />
      <Slider
        label="Depth"
        unit="mm"
        value={cfg.depth}
        min={0.5}
        max={15}
        step={0.5}
        onChange={(v) => setTextField(activeZoneId, 'depth', v)}
      />
      <Slider
        label="Letter Spacing"
        unit="mm"
        value={cfg.spacing}
        min={-2}
        max={10}
        step={0.1}
        precision={2}
        onChange={(v) => setTextField(activeZoneId, 'spacing', v)}
      />
      <Slider
        label="Line Spacing"
        unit="mm"
        value={cfg.lineSpacing ?? 0}
        min={-5}
        max={20}
        step={0.5}
        precision={1}
        onChange={(v) => setTextField(activeZoneId, 'lineSpacing', v)}
      />
      <Slider
        label="Nudge ← →"
        unit="mm"
        value={cfg.offsetX ?? 0}
        min={-40}
        max={40}
        step={0.5}
        precision={1}
        onChange={(v) => setTextField(activeZoneId, 'offsetX', v)}
      />
      <Slider
        label="Nudge ↑ ↓"
        unit="mm"
        value={cfg.offsetY ?? 0}
        min={-40}
        max={40}
        step={0.5}
        precision={1}
        onChange={(v) => setTextField(activeZoneId, 'offsetY', v)}
      />

      {/* Text color is now a single global setting in the Global Colors
          panel below ("Applies to all texts"). */}
    </div>
  )
}

function Slider({ label, unit, value, min, max, step, precision = 1, onChange }) {
  const display = typeof value === 'number' ? value.toFixed(precision === 2 ? 2 : 1) : value
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs uppercase text-slate-400">
          {label}: {display} {unit}
        </label>
        <span className="number-badge">{Math.round(value)}{unit}</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="flex-1"
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-center"
        />
      </div>
    </div>
  )
}
