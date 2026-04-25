import { useMemo } from 'react'
import { useModelStore } from '../state/useModelStore.js'
import { exportPartSTL, exportAllZip } from '../lib/exporters.js'

const GROUP_LABELS = {
  withText: 'Objects with text',
  withoutText: 'Objects without text',
  stl: 'STL objects',
}
const GROUP_ORDER = ['withText', 'withoutText', 'stl']

export default function ExportDialog({ open, onClose, model, getScene }) {
  const exportScale = useModelStore((s) => s.exportScale)
  const textConfigs = useModelStore((s) => s.textConfigs)

  const items = useMemo(() => {
    return model.parts.map((p) => {
      const attachedZones = model.textZones.filter((z) => z.onPart === p.id).map((z) => z.id)
      const filename = renderFilename(p.exportFilename || `${p.id}.stl`, textConfigs)
      return {
        partId: p.id,
        partName: p.name,
        attachedTextZoneIds: attachedZones,
        filename,
        group: p.exportGroup || 'withoutText',
      }
    })
  }, [model, textConfigs])

  if (!open) return null

  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    items: items.filter((i) => i.group === g),
  })).filter((g) => g.items.length)

  const downloadOne = (item) => {
    const scene = getScene()
    if (!scene) return
    exportPartSTL({
      scene,
      partId: item.partId,
      attachedTextZoneIds: item.attachedTextZoneIds,
      scale: exportScale,
      filename: item.filename,
    })
  }

  const downloadAll = () => {
    const scene = getScene()
    if (!scene) return
    exportAllZip({
      scene,
      items,
      scale: exportScale,
      filename: `${slugify(model.name)}.zip`,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[560px] max-w-[92vw] rounded-xl bg-slate-900 border border-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="text-white text-base font-semibold">Export Files</div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4 space-y-5">
          {grouped.map(({ group, items }) => (
            <section key={group}>
              <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">
                {GROUP_LABELS[group]}
              </div>
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.partId}
                    className="flex items-center justify-between bg-slate-800/60 border border-slate-800 rounded-lg px-3 py-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[10px] font-bold bg-indigo-500/80 text-white rounded px-2 py-0.5">
                        STL
                      </span>
                      <span className="text-sm text-slate-200 truncate">{item.filename}</span>
                    </div>
                    <button
                      onClick={() => downloadOne(item)}
                      className="text-sm px-3 py-1.5 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-700/60"
                    >
                      Download
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-slate-200 bg-slate-800 hover:bg-slate-700 text-sm"
          >
            Close
          </button>
          <button
            onClick={downloadAll}
            className="px-4 py-2 rounded-md text-white text-sm font-semibold"
            style={{ background: 'linear-gradient(90deg,#7c3aed 0%,#4f46e5 100%)' }}
          >
            Download All (.zip)
          </button>
        </div>
      </div>
    </div>
  )
}

function renderFilename(template, textConfigs) {
  // Replace {zoneId} tokens with the current text value (sanitized).
  // If a token has no matching text zone, drop it along with any leading
  // underscore, so "JERSSEY_{name}_{num}.stl" with no zones becomes
  // "JERSSEY.stl" rather than "JERSSEY_NAME_NUM.stl".
  return template
    .replace(/_?\{(\w+)\}/g, (full, id) => {
      const t = textConfigs[id]?.text
      if (t === undefined) return ''
      const safe = sanitizeForFilename(t)
      if (!safe) return ''
      return full.startsWith('_') ? `_${safe}` : safe
    })
    .replace(/__+/g, '_')
    .replace(/_+\./g, '.')
}

function sanitizeForFilename(s) {
  return s.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '')
}

function slugify(s) {
  return s.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '')
}
