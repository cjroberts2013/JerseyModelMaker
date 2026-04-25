import * as THREE from 'three'

/**
 * Vertex-color palette system, modelled on PressPrint Lab's approach:
 *
 *   - Source asset (FBX/GLB) is authored in Blender with vertex colors painted
 *     onto distinct accent regions (jersey body, sleeves, collar, …). Each
 *     painted color becomes one palette entry.
 *   - At load time we scan `geometry.attributes.color`, group vertices by
 *     unique color, and surface a small palette `[{ originalColor,
 *     currentColor, vertexCount }, …]` for the editor UI.
 *   - When the user picks a new color, we rewrite the GL color buffer:
 *     reset to the original snapshot, then replace every vertex matching an
 *     `originalColor` with its `currentColor`, and flag for re-upload.
 *   - All palette comparisons happen in linear color space (Three.js stores
 *     vertex colors linearly since r152). Hex pickers use sRGB, so we
 *     convert at the boundary.
 */

const EPSILON = 0.005 // matches roughly half a 0..255 step in linear

/** Convert an sRGB hex string ("#rrggbb") to linear-space {r,g,b} floats. */
function hexToLinear(hex) {
  const c = new THREE.Color(hex)
  c.convertSRGBToLinear()
  return { r: c.r, g: c.g, b: c.b }
}

/** Convert linear-space (r,g,b) floats to an sRGB hex string. */
function linearToHex(r, g, b) {
  const c = new THREE.Color()
  c.setRGB(r, g, b)
  c.convertLinearToSRGB()
  return '#' + c.getHexString()
}

/** Quantize a linear-space float color to an integer key for grouping. */
function colorKey(r, g, b) {
  // Quantize at 1/255 resolution after gamma — empirically this matches the
  // cluster of values produced by a vertex paint stroke without over-merging.
  const q = 255
  return `${Math.round(r * q)}:${Math.round(g * q)}:${Math.round(b * q)}`
}

/**
 * Extract a color palette from a BufferGeometry's vertex color attribute.
 * Returns null if the geometry has no vertex colors (e.g. plain STLs).
 *
 * Filters out near-white (>= 0.97 luma) entries — these are typically
 * decal/logo placeholders the modeler doesn't want users to recolor — and
 * any entry below `minVertexCount` (small bits of trim/seams).
 *
 * Largest cluster first.
 */
export function extractColorPalette(
  geometry,
  { minVertexCount = 50, dropNearWhite = true } = {},
) {
  const colorAttr = geometry?.attributes?.color
  if (!colorAttr) return null

  const arr = colorAttr.array
  const buckets = new Map() // key -> { rSum, gSum, bSum, count }
  for (let i = 0; i < arr.length; i += 3) {
    const r = arr[i], g = arr[i + 1], b = arr[i + 2]
    const k = colorKey(r, g, b)
    let buc = buckets.get(k)
    if (!buc) {
      buc = { rSum: 0, gSum: 0, bSum: 0, count: 0 }
      buckets.set(k, buc)
    }
    buc.rSum += r
    buc.gSum += g
    buc.bSum += b
    buc.count++
  }

  const palette = []
  for (const buc of buckets.values()) {
    const r = buc.rSum / buc.count
    const g = buc.gSum / buc.count
    const b = buc.bSum / buc.count
    // Linear luma test for near-white. (sRGB hex of #f6f6f3 ≈ linear 0.91+)
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    if (dropNearWhite && luma > 0.93 && buc.count < 5000) continue
    if (buc.count < minVertexCount) continue
    const hex = linearToHex(r, g, b)
    palette.push({
      originalColor: hex,
      currentColor: hex,
      vertexCount: buc.count,
      _linearOriginal: { r, g, b },
    })
  }
  palette.sort((a, b) => b.vertexCount - a.vertexCount)
  return palette
}

/**
 * Snapshot the current color buffer onto the geometry so subsequent palette
 * applies can re-base from it (avoids feedback loops when two entries swap
 * to overlapping colors, since the lookup is always against the unchanged
 * source).
 */
export function snapshotOriginalColors(geometry) {
  const attr = geometry?.attributes?.color
  if (!attr) return
  if (geometry.userData._originalColors) return
  geometry.userData._originalColors = new Float32Array(attr.array)
}

/**
 * Re-apply a palette to a geometry's color buffer. Assumes
 * snapshotOriginalColors() has run at least once on this geometry.
 */
export function applyPaletteToGeometry(geometry, palette) {
  const attr = geometry?.attributes?.color
  if (!attr || !palette?.length) return
  const orig = geometry.userData._originalColors
  if (!orig) return

  const arr = attr.array
  // Rebase from the original snapshot so the lookup always references the
  // authored colors, not whatever was last written.
  arr.set(orig)

  // Build lookup: linear original → linear new.
  const lookups = palette.map((entry) => {
    const lo = entry._linearOriginal || hexToLinear(entry.originalColor)
    const ln = hexToLinear(entry.currentColor)
    return { lo, ln, changed: entry.originalColor !== entry.currentColor }
  })

  for (let i = 0; i < arr.length; i += 3) {
    const r = arr[i], g = arr[i + 1], b = arr[i + 2]
    for (const { lo, ln, changed } of lookups) {
      if (!changed) continue
      if (
        Math.abs(r - lo.r) < EPSILON &&
        Math.abs(g - lo.g) < EPSILON &&
        Math.abs(b - lo.b) < EPSILON
      ) {
        arr[i] = ln.r
        arr[i + 1] = ln.g
        arr[i + 2] = ln.b
        break
      }
    }
  }

  attr.needsUpdate = true
}
