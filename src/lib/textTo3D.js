import * as THREE from 'three'
// Re-export loadFont from the shared font loader so text-extrusion and the
// editor UI both read from the same cache.
export { loadFont } from './fontLoader.js'

/**
 * Convert a single opentype.js Path to an array of THREE.Shape objects.
 * Handles holes (e.g. interior of an "O").
 */
function pathToShapes(otPath) {
  // Split commands into contours (each M starts a new one).
  const contours = []
  let current = null
  for (const cmd of otPath.commands) {
    if (cmd.type === 'M') {
      if (current) contours.push(current)
      current = []
    }
    if (current) current.push(cmd)
  }
  if (current && current.length) contours.push(current)

  // Build a THREE.Path for each contour.
  const paths = contours.map((cmds) => {
    const p = new THREE.Path()
    for (const cmd of cmds) {
      if (cmd.type === 'M') p.moveTo(cmd.x, -cmd.y)
      else if (cmd.type === 'L') p.lineTo(cmd.x, -cmd.y)
      else if (cmd.type === 'C')
        p.bezierCurveTo(cmd.x1, -cmd.y1, cmd.x2, -cmd.y2, cmd.x, -cmd.y)
      else if (cmd.type === 'Q') p.quadraticCurveTo(cmd.x1, -cmd.y1, cmd.x, -cmd.y)
      else if (cmd.type === 'Z') p.closePath()
    }
    return p
  })

  // Determine signed area to separate outer shapes from holes.
  const areas = paths.map((p) => signedArea(p.getPoints()))
  const shapes = []
  const holes = []
  paths.forEach((p, i) => {
    if (areas[i] >= 0) shapes.push({ path: p, idx: i })
    else holes.push({ path: p, idx: i, points: p.getPoints() })
  })

  // Build THREE.Shape objects, assigning each hole to its enclosing shape.
  const result = shapes.map(({ path }) => {
    const shape = new THREE.Shape(path.getPoints())
    return shape
  })
  holes.forEach(({ path, points }) => {
    // Find containing shape (first shape whose polygon contains any hole point).
    const testPoint = points[0]
    const containerIndex = shapes.findIndex(({ path: sp }) =>
      pointInPolygon(testPoint, sp.getPoints()),
    )
    const target = containerIndex >= 0 ? result[containerIndex] : result[0]
    if (target) target.holes.push(new THREE.Path(path.getPoints()))
  })

  return result
}

function signedArea(points) {
  let a = 0
  for (let i = 0, n = points.length; i < n; i++) {
    const p1 = points[i]
    const p2 = points[(i + 1) % n]
    a += (p2.x - p1.x) * (p2.y + p1.y)
  }
  return a
}

function pointInPolygon(pt, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y
    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-12) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/**
 * Build an extruded 3D geometry for a text string, with multi-line support.
 * Newlines ("\n") produce separate lines stacked top-to-bottom. `align`
 * controls how each line is placed horizontally relative to the block's center.
 * The returned geometry's anchor is (x=0, y=0) at the vertical center of the
 * block, with the front face on z=depth and back on z=0.
 */
export function buildTextGeometry({ font, text, size, depth, spacing = 0, lineSpacing = 0, align = 'center' }) {
  if (!text) return null

  const fontScale = size / font.unitsPerEm
  const lines = String(text).split(/\r?\n/)
  // Base leading is 1.2× the font's em; `lineSpacing` (mm) is added on top.
  // Convert mm → em units by dividing by fontScale (mm per em).
  const lineHeightEm = font.unitsPerEm * 1.2 + lineSpacing / fontScale
  const lineGeos = []
  const lineBounds = []

  lines.forEach((line, lineIdx) => {
    const glyphGeos = []
    let cursor = 0
    for (const ch of line) {
      const glyph = font.charToGlyph(ch)
      const path = glyph.getPath(0, 0, font.unitsPerEm)
      const shapes = pathToShapes(path)
      if (shapes.length) {
        const geo = new THREE.ExtrudeGeometry(shapes, {
          depth: depth / fontScale,
          bevelEnabled: false,
          curveSegments: 8,
        })
        geo.translate(cursor, 0, 0)
        glyphGeos.push(geo)
      }
      cursor += glyph.advanceWidth + spacing / fontScale
    }
    if (!glyphGeos.length) {
      // Empty line — still take up vertical space.
      lineGeos.push(null)
      lineBounds.push({ min: 0, max: 0, width: 0 })
      return
    }
    const merged = mergeGeometries(glyphGeos)
    glyphGeos.forEach((g) => g.dispose())
    merged.computeBoundingBox()
    const bb = merged.boundingBox
    lineGeos.push(merged)
    lineBounds.push({ min: bb.min.x, max: bb.max.x, width: bb.max.x - bb.min.x })
    // Stack lines by translating down; we'll adjust later.
    merged.translate(0, -lineIdx * lineHeightEm, 0)
  })

  const realLines = lineGeos.filter(Boolean)
  if (!realLines.length) return null

  // Align each line horizontally within the block.
  const blockWidth = Math.max(...lineBounds.map((b) => b.width))
  lineGeos.forEach((g, i) => {
    if (!g) return
    const b = lineBounds[i]
    let offset = 0
    if (align === 'center') offset = -b.min - b.width / 2
    else if (align === 'right') offset = (blockWidth / 2) - b.max
    else offset = -(blockWidth / 2) - b.min // left
    g.translate(offset, 0, 0)
  })

  const merged = mergeGeometries(realLines)
  realLines.forEach((g) => g.dispose())

  merged.scale(fontScale, fontScale, fontScale)

  merged.computeBoundingBox()
  const bb = merged.boundingBox
  // Center vertically; horizontal anchor already at x=0 via alignment math.
  merged.translate(0, -(bb.min.y + bb.max.y) / 2, -bb.min.z)
  return merged
}

function mergeGeometries(geometries) {
  // Minimal merge: concat position/normal/index, no groups, assume non-indexed fine.
  let totalVertices = 0
  let totalIndices = 0
  let hasIndex = true
  for (const g of geometries) {
    const pos = g.getAttribute('position')
    totalVertices += pos.count
    if (g.getIndex()) {
      totalIndices += g.getIndex().count
    } else {
      hasIndex = false
    }
  }

  const mergedPositions = new Float32Array(totalVertices * 3)
  const mergedNormals = new Float32Array(totalVertices * 3)
  let posOffset = 0

  const mergedIndices = hasIndex ? new Uint32Array(totalIndices) : null
  let idxOffset = 0
  let vertOffset = 0

  for (const g of geometries) {
    const pos = g.getAttribute('position')
    const norm = g.getAttribute('normal')
    mergedPositions.set(pos.array, posOffset * 3)
    if (norm) mergedNormals.set(norm.array, posOffset * 3)

    if (hasIndex) {
      const idx = g.getIndex().array
      for (let i = 0; i < idx.length; i++) {
        mergedIndices[idxOffset + i] = idx[i] + vertOffset
      }
      idxOffset += idx.length
    }

    posOffset += pos.count
    vertOffset += pos.count
  }

  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(mergedNormals, 3))
  if (mergedIndices) out.setIndex(new THREE.BufferAttribute(mergedIndices, 1))
  out.computeVertexNormals()
  return out
}
