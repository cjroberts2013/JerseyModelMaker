import opentype from 'opentype.js'
import { assetUrl } from './assetUrl.js'

/**
 * Font system for ModelMaker.
 *
 * We use opentype.js (not three.js FontLoader) because it:
 *   - Handles any TTF/OTF directly — no typeface.json preprocessing step
 *   - Supports the full glyph range (numbers, punctuation, accents)
 *   - Is already a dependency of our text extrusion pipeline in textTo3D.js
 *
 * The returned "Font" objects are opentype.Font instances. They have a
 * `unitsPerEm` field and `charToGlyph(ch)` / `getPath()` methods that are
 * consumed by buildTextGeometry() in src/lib/textTo3D.js.
 */

const fontCache = new Map() // keyed by URL AND by font name for convenience

/**
 * Fetch and parse a single font from its URL. Results are cached so repeated
 * calls return the same promise / font instance.
 */
export function loadFont(url) {
  // Resolve relative/absolute paths under Vite's BASE_URL so the same code
  // works in dev (base "/") and in GitHub Pages builds ("/JerseyModelMaker/").
  const resolved = /^https?:\/\//.test(url) ? url : assetUrl(url)
  if (fontCache.has(resolved)) return fontCache.get(resolved)
  const promise = opentype.load(resolved).then((font) => {
    font._sourceUrl = resolved
    return font
  })
  fontCache.set(resolved, promise)
  return promise
}

/**
 * Load the entire font catalog from a fonts.json file and resolve every
 * font in parallel. Returns a Map keyed by font `name` → loaded Font.
 * The raw catalog array is available on the result as `.list` for rendering
 * the dropdown (preserves JSON order).
 */
export async function loadAllFonts(fontsJsonUrl = '/fonts.json') {
  const resolved = /^https?:\/\//.test(fontsJsonUrl) ? fontsJsonUrl : assetUrl(fontsJsonUrl)
  const resp = await fetch(resolved)
  if (!resp.ok) throw new Error(`Failed to fetch ${resolved}: ${resp.status}`)
  const data = await resp.json()
  const list = data.fonts || []

  const entries = await Promise.all(
    list.map(async (entry) => {
      try {
        const font = await loadFont(entry.url)
        fontCache.set(entry.name, font)
        return [entry.name, font]
      } catch (err) {
        console.warn(`[fontLoader] failed to load "${entry.name}" at ${entry.url}:`, err)
        return null
      }
    }),
  )

  const map = new Map(entries.filter(Boolean))
  map.list = list
  return map
}

/** Synchronous lookup, returns the cached Font or null. */
export function getFont(nameOrUrl) {
  const hit = fontCache.get(nameOrUrl)
  return hit && !(hit instanceof Promise) ? hit : null
}
