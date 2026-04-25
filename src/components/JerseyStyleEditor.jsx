import { useModelStore } from '../state/useModelStore.js'

/**
 * Dropdown that lets the user switch between the available jersey-shape
 * styles defined on the template (Classic, Style 1, …). Selecting one
 * causes ModelViewer to swap the jersey STL via getStyleParts().
 */
export default function JerseyStyleEditor({ model }) {
  const styles = model?.jerseyStyles || []
  const styleId = useModelStore((s) => s.jerseyStyleId)
  const setJerseyStyle = useModelStore((s) => s.setJerseyStyle)

  if (styles.length < 2) return null

  return (
    <div>
      <label className="block text-xs uppercase text-slate-400 mb-2">
        Jersey Style
      </label>
      <select
        value={styleId || ''}
        onChange={(e) => setJerseyStyle(e.target.value, model)}
        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm"
      >
        {styles.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  )
}
