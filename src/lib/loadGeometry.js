import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * Dispatches to the right Three.js loader by file extension and always
 * resolves to a single `BufferGeometry`. FBX/GLB scenes contain a graph
 * of meshes; we merge their geometries (after baking world transforms)
 * into one buffer so downstream code can treat every part the same way
 * regardless of source format.
 *
 * Provides a `.load(url, onLoad, onProgress, onError)` shape so it can
 * be passed straight to `useLoader` from @react-three/fiber.
 */
class HybridGeometryLoader {
  load(url, onLoad, onProgress, onError) {
    const ext = (url.split('?')[0].split('#')[0].split('.').pop() || '').toLowerCase()
    try {
      if (ext === 'stl') {
        new STLLoader().load(url, onLoad, onProgress, onError)
        return
      }
      if (ext === 'fbx') {
        new FBXLoader().load(
          url,
          (group) => onLoad(mergeSceneToGeometry(group)),
          onProgress,
          onError,
        )
        return
      }
      if (ext === 'glb' || ext === 'gltf') {
        new GLTFLoader().load(
          url,
          (gltf) => onLoad(mergeSceneToGeometry(gltf.scene)),
          onProgress,
          onError,
        )
        return
      }
      onError?.(new Error(`Unsupported model extension: .${ext}`))
    } catch (err) {
      onError?.(err)
    }
  }
}

export const hybridGeometryLoader = new HybridGeometryLoader()
// Stable reference for useLoader; pass-through identity loader factory.
export function HybridLoaderClass() {
  return hybridGeometryLoader
}
HybridLoaderClass.prototype = HybridGeometryLoader.prototype

/**
 * Walk a scene/group, bake each mesh's world transform into its geometry,
 * and concatenate everything into a single non-indexed BufferGeometry.
 * Preserves vertex colors when present on any source mesh; pads with white
 * (1,1,1) for meshes that lack them so the merged buffer is consistent.
 */
function mergeSceneToGeometry(root) {
  root.updateMatrixWorld(true)
  const meshes = []
  root.traverse((o) => {
    if (o.isMesh && o.geometry) meshes.push(o)
  })
  if (!meshes.length) {
    // Empty scene — return an empty geometry so consumers don't crash.
    const empty = new THREE.BufferGeometry()
    empty.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3))
    return empty
  }

  // First pass: bake transforms and figure out total vertex count + whether
  // ANY source mesh carries vertex colors.
  const baked = []
  let totalVerts = 0
  let anyHasColor = false
  for (const mesh of meshes) {
    const g = mesh.geometry.clone()
    g.applyMatrix4(mesh.matrixWorld)
    if (!g.getAttribute('normal')) g.computeVertexNormals()
    // Convert to non-indexed so we can simply concatenate position/normal arrays.
    const nonIndexed = g.toNonIndexed()
    g.dispose()
    baked.push(nonIndexed)
    totalVerts += nonIndexed.getAttribute('position').count
    if (nonIndexed.getAttribute('color')) anyHasColor = true
  }

  const positions = new Float32Array(totalVerts * 3)
  const normals = new Float32Array(totalVerts * 3)
  const colors = anyHasColor ? new Float32Array(totalVerts * 3) : null
  let offset = 0
  for (const g of baked) {
    const p = g.getAttribute('position')
    const n = g.getAttribute('normal')
    const c = g.getAttribute('color')
    positions.set(p.array, offset * 3)
    if (n) normals.set(n.array, offset * 3)
    if (colors) {
      if (c) {
        colors.set(c.array, offset * 3)
      } else {
        // No color attribute on this sub-mesh — fill with white in linear space
        // so it doesn't accidentally get bucketed into a palette entry.
        for (let i = 0; i < p.count; i++) {
          colors[(offset + i) * 3] = 1
          colors[(offset + i) * 3 + 1] = 1
          colors[(offset + i) * 3 + 2] = 1
        }
      }
    }
    offset += p.count
    g.dispose()
  }

  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  if (colors) out.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  out.computeBoundingBox()
  out.computeBoundingSphere()
  return out
}
