import { useEffect, useState } from 'react'
import data from '../data/models.json'
import { renderJerseyThumb } from '../lib/thumbRenderer.js'

/**
 * Gallery thumbnail backed by a single shared offscreen WebGL renderer.
 * Each card renders the actual STL parts + baked text zones once with the
 * team's overrides, captures a PNG, and shows it via <img>. Avoids per-card
 * WebGL contexts (browsers cap them around 8-16) and lets us scale to many
 * tiles.
 *
 * The team's `defaultStyle` selects which jersey-shape STL is used; this is
 * what makes the gallery showcase the available styles across the cards.
 */
const DEFAULT_TEMPLATE_ID = data.templates[0]?.id

function getTemplate(templateId) {
  return (
    data.templates.find((t) => t.id === templateId) ||
    data.templates.find((t) => t.id === DEFAULT_TEMPLATE_ID) ||
    data.templates[0]
  )
}

function pickStyleParts(template, defaultStyle) {
  const styles = template.jerseyStyles || []
  const style = styles.find((s) => s.id === defaultStyle) || styles[0]
  return style?.parts || []
}

export default function JerseyThumb3D({
  colorOverrides = {},
  textOverrides = {},
  fontCatalog,
  defaultStyle,
  templateId,
}) {
  const [src, setSrc] = useState(null)

  useEffect(() => {
    if (!fontCatalog) return
    let cancelled = false

    const template = getTemplate(templateId)
    const textZones = template.textZones.map((z) => ({ ...z, ...(textOverrides[z.id] || {}) }))
    const parts = [...template.parts, ...pickStyleParts(template, defaultStyle)]

    renderJerseyThumb(parts, colorOverrides, textZones, fontCatalog)
      .then((url) => {
        if (!cancelled) setSrc(url)
      })
      .catch((err) => {
        console.error('thumb render failed', err)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(colorOverrides), JSON.stringify(textOverrides), defaultStyle, templateId, !!fontCatalog])

  return (
    <div className="w-full h-full flex items-center justify-center">
      {src ? (
        <img
          src={src}
          alt=""
          className="w-full h-full object-contain"
          loading="lazy"
        />
      ) : (
        <div className="text-xs text-slate-500">Loading…</div>
      )}
    </div>
  )
}
