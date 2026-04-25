/**
 * Renders one or more jersey-frame thumbnails to PNG using a single
 * offscreen WebGL renderer. Browsers cap live WebGL contexts at ~8-16,
 * so per-card <Canvas> instances cause context-lost errors. Instead we:
 *   - keep ONE THREE.WebGLRenderer alive
 *   - cache STL geometries by URL
 *   - on demand, build a scene with the team's color overrides, render once,
 *     capture toDataURL, and dispose the per-render materials
 *
 * Returns a Promise<string> resolving to a data: URL the caller can put in
 * an <img src=...>.
 */
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { buildTextGeometry, loadFont } from './textTo3D.js'
import { buildSurfaceFrame } from './surfaceFrame.js'
import { assetUrl } from './assetUrl.js'

const WIDTH = 480
const HEIGHT = 640

let renderer = null
const geometryCache = new Map() // url -> Promise<BufferGeometry>

function getRenderer() {
  if (renderer) return renderer
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(WIDTH, HEIGHT, false)
  renderer.setClearColor(0x1a1438, 1)
  return renderer
}

function loadGeometry(url) {
  const resolved = /^https?:\/\//.test(url) ? url : assetUrl(url)
  if (geometryCache.has(resolved)) return geometryCache.get(resolved)
  const loader = new STLLoader()
  const promise = new Promise((resolve, reject) => {
    loader.load(resolved, (geom) => {
      geom.computeVertexNormals()
      geom.computeBoundingBox()
      resolve(geom)
    }, undefined, reject)
  })
  geometryCache.set(url, promise)
  return promise
}

/**
 * Build a scene with the given parts + colors + text zones, render once,
 * return a PNG.
 * @param {Array} parts - template parts: { id, file, defaultColor, position?, rotation? }
 * @param {Object} colorOverrides - { partId: '#hex' }
 * @param {Array} textZones - resolved text zones: { defaultText, defaultFont, defaultSize, defaultDepth, defaultSpacing, defaultLineSpacing, defaultAlign, defaultColor, defaultEmbed, surface }
 * @param {Map<string, {url:string}>} fontCatalog - map of font name → { url }
 */
export async function renderJerseyThumb(parts, colorOverrides = {}, textZones = [], fontCatalog = null) {
  const r = getRenderer()
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1438)

  const ambient = new THREE.AmbientLight(0xffffff, 0.7)
  const key = new THREE.DirectionalLight(0xffffff, 1.0)
  key.position.set(80, 180, 140)
  const fill = new THREE.DirectionalLight(0xffffff, 0.35)
  fill.position.set(-120, 60, 100)
  const rim = new THREE.DirectionalLight(0xffffff, 0.2)
  rim.position.set(0, -120, 80)
  scene.add(ambient, key, fill, rim)

  // Load all parts in parallel.
  const geometries = await Promise.all(parts.map((p) => loadGeometry(p.file))) // assetUrl applied inside loadGeometry
  const meshes = []
  parts.forEach((part, i) => {
    const color = colorOverrides[part.id] || part.defaultColor
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.65,
      metalness: 0.05,
    })
    const mesh = new THREE.Mesh(geometries[i], material)
    if (part.position) mesh.position.fromArray(part.position)
    if (part.rotation) mesh.rotation.fromArray(part.rotation)
    scene.add(mesh)
    meshes.push({ mesh, material })
  })

  // Add text zones (best-effort: skip silently on font/text errors).
  if (textZones.length && fontCatalog) {
    await Promise.all(
      textZones.map(async (zone) => {
        if (!zone.defaultText || !zone.surface) return
        const fontEntry = fontCatalog.get(zone.defaultFont) || fontCatalog.values().next().value
        if (!fontEntry?.url) return
        try {
          const font = await loadFont(fontEntry.url)
          const geo = buildTextGeometry({
            font,
            text: zone.defaultText,
            size: zone.defaultSize,
            depth: zone.defaultDepth,
            spacing: zone.defaultSpacing || 0,
            lineSpacing: zone.defaultLineSpacing || 0,
            align: zone.defaultAlign || 'center',
          })
          if (!geo) return
          const embed = zone.defaultEmbed || 0
          if (embed) geo.translate(0, 0, -embed)
          const { matrix } = buildSurfaceFrame(zone.surface)
          const mat = new THREE.MeshStandardMaterial({
            color: zone.defaultColor,
            roughness: 0.65,
            metalness: 0.05,
          })
          const mesh = new THREE.Mesh(geo, mat)
          mesh.matrix.copy(matrix)
          mesh.matrixAutoUpdate = false
          scene.add(mesh)
          meshes.push({ mesh, material: mat })
        } catch {
          // Drop the zone if font/text fails — thumbnail still shows the model.
        }
      }),
    )
  }

  // Camera framed to the scene's bbox.
  const box = new THREE.Box3().setFromObject(scene)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const camera = new THREE.PerspectiveCamera(28, WIDTH / HEIGHT, 1, 5000)
  const aspect = WIDTH / HEIGHT
  const fov = (camera.fov * Math.PI) / 180
  const fitHeight = Math.max(size.y, size.x / aspect)
  const dist = (fitHeight / 2) / Math.tan(fov / 2) * 1.05
  camera.position.set(center.x, center.y, center.z + dist)
  camera.lookAt(center)

  r.render(scene, camera)
  const dataUrl = r.domElement.toDataURL('image/png')

  // Dispose per-render materials but keep cached geometries.
  meshes.forEach(({ material }) => material.dispose())
  return dataUrl
}
