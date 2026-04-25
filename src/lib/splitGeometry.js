import * as THREE from 'three'

/**
 * Split a (possibly indexed) BufferGeometry into one BufferGeometry per
 * connected component. Two triangles are considered connected if they
 * share a vertex position (within a small epsilon — STL files often write
 * each triangle's vertices independently, so we weld by quantized
 * position before union-find).
 *
 * Returns the components sorted by triangle count descending — the
 * largest piece (typically the main jersey body) first, followed by
 * smaller accent pieces (sleeve stripes, collar, name plate, etc.).
 *
 * Each returned BufferGeometry is non-indexed and has freshly computed
 * vertex normals + bounding box.
 */
export function splitConnectedComponents(geometry, { quantum = 0.01 } = {}) {
  if (!geometry || !geometry.attributes?.position) return []
  const pos = geometry.attributes.position
  const idx = geometry.index
  const triCount = idx ? idx.count / 3 : pos.count / 3
  if (!Number.isFinite(triCount) || triCount === 0) return []

  // 1. Weld vertices by quantized position so triangle authors that
  //    duplicate corner vertices (every STL) still register as connected.
  const inv = 1 / quantum
  const keyToCanonical = new Map()
  const canonicalForVertex = new Int32Array(pos.count)
  let nextCanonical = 0
  for (let i = 0; i < pos.count; i++) {
    const kx = Math.round(pos.getX(i) * inv)
    const ky = Math.round(pos.getY(i) * inv)
    const kz = Math.round(pos.getZ(i) * inv)
    const k = `${kx},${ky},${kz}`
    let c = keyToCanonical.get(k)
    if (c === undefined) {
      c = nextCanonical++
      keyToCanonical.set(k, c)
    }
    canonicalForVertex[i] = c
  }

  // 2. Union-find on canonical ids, merging vertices of each triangle.
  const parent = new Int32Array(nextCanonical)
  for (let i = 0; i < nextCanonical; i++) parent[i] = i
  const find = (x) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }
  const union = (a, b) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }
  const vertexAt = (t, v) =>
    idx ? idx.getX(t * 3 + v) : t * 3 + v
  for (let t = 0; t < triCount; t++) {
    const ca = canonicalForVertex[vertexAt(t, 0)]
    const cb = canonicalForVertex[vertexAt(t, 1)]
    const cc = canonicalForVertex[vertexAt(t, 2)]
    union(ca, cb)
    union(cb, cc)
  }

  // 3. Bucket triangle indices by component root.
  const buckets = new Map()
  for (let t = 0; t < triCount; t++) {
    const root = find(canonicalForVertex[vertexAt(t, 0)])
    let arr = buckets.get(root)
    if (!arr) {
      arr = []
      buckets.set(root, arr)
    }
    arr.push(t)
  }

  // 4. Build one non-indexed BufferGeometry per bucket.
  const normals = geometry.attributes.normal
  const components = []
  for (const tris of buckets.values()) {
    const n = tris.length
    const positions = new Float32Array(n * 9)
    const outNormals = normals ? new Float32Array(n * 9) : null
    for (let i = 0; i < n; i++) {
      const t = tris[i]
      for (let v = 0; v < 3; v++) {
        const src = vertexAt(t, v)
        const o = i * 9 + v * 3
        positions[o] = pos.getX(src)
        positions[o + 1] = pos.getY(src)
        positions[o + 2] = pos.getZ(src)
        if (outNormals) {
          outNormals[o] = normals.getX(src)
          outNormals[o + 1] = normals.getY(src)
          outNormals[o + 2] = normals.getZ(src)
        }
      }
    }
    const sub = new THREE.BufferGeometry()
    sub.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    if (outNormals) sub.setAttribute('normal', new THREE.BufferAttribute(outNormals, 3))
    else sub.computeVertexNormals()
    sub.computeBoundingBox()
    components.push(sub)
  }

  // 5. Largest piece first.
  components.sort(
    (a, b) => b.attributes.position.count - a.attributes.position.count,
  )
  return components
}
