import * as THREE from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { saveAs } from 'file-saver'
import { zipSync } from 'fflate'

/**
 * Export the entire scene as a single binary STL.
 */
export function exportSTL(scene, filename = 'model.stl', scale = 1) {
  const scaled = cloneAndScale(scene, scale)
  const bytes = sceneToSTLBytes(scaled)
  saveAs(new Blob([bytes], { type: 'application/octet-stream' }), filename)
  disposeScene(scaled)
}

/**
 * Export just one part (plus any text zones attached to that part) as an STL.
 */
export function exportPartSTL({ scene, partId, attachedTextZoneIds = [], scale = 1, filename }) {
  const bytes = buildPartSTLBytes(scene, partId, attachedTextZoneIds, scale)
  if (!bytes) return
  saveAs(new Blob([bytes], { type: 'application/octet-stream' }), filename)
}

/**
 * Export every part as its own STL file inside a single zip.
 * `items` is an array of { partId, attachedTextZoneIds, filename }.
 */
export function exportAllZip({ scene, items, scale = 1, filename = 'model.zip' }) {
  const entries = {}
  items.forEach((item) => {
    const bytes = buildPartSTLBytes(scene, item.partId, item.attachedTextZoneIds || [], scale)
    if (bytes) {
      entries[safeZipName(item.filename)] = bytes
    }
  })
  const zipped = zipSync(entries)
  saveAs(new Blob([zipped], { type: 'application/zip' }), filename)
}

/**
 * Export the full scene as a 3MF with one object per mesh and per-mesh colors.
 */
export function export3MF(scene, filename = 'model.3mf', scale = 1) {
  const scaled = cloneAndScale(scene, scale)
  const meshes = []
  scaled.traverse((obj) => {
    if (obj.isMesh && obj.geometry) meshes.push(obj)
  })

  const baseMaterials = meshes
    .map((m, i) => {
      const hex = colorToHex(m.material.color)
      return `      <base name="${escapeXml(m.name || `part${i}`)}" displaycolor="#${hex}FF" />`
    })
    .join('\n')

  let objectXml = ''
  let buildXml = ''

  meshes.forEach((mesh, index) => {
    const id = index + 1
    mesh.updateMatrixWorld(true)
    const worldGeo = mesh.geometry.clone()
    worldGeo.applyMatrix4(mesh.matrixWorld)
    const posAttr = worldGeo.getAttribute('position')
    const idx = worldGeo.getIndex()

    let vertices = ''
    for (let i = 0; i < posAttr.count; i++) {
      vertices += `          <vertex x="${posAttr.getX(i).toFixed(4)}" y="${posAttr.getY(i).toFixed(4)}" z="${posAttr.getZ(i).toFixed(4)}" />\n`
    }

    let triangles = ''
    if (idx) {
      for (let i = 0; i < idx.count; i += 3) {
        triangles += `          <triangle v1="${idx.getX(i)}" v2="${idx.getX(i + 1)}" v3="${idx.getX(i + 2)}" />\n`
      }
    } else {
      for (let i = 0; i < posAttr.count; i += 3) {
        triangles += `          <triangle v1="${i}" v2="${i + 1}" v3="${i + 2}" />\n`
      }
    }

    objectXml += `    <object id="${id}" type="model" pid="1" pindex="${index}">
      <mesh>
        <vertices>
${vertices}        </vertices>
        <triangles>
${triangles}        </triangles>
      </mesh>
    </object>
`
    buildXml += `    <item objectid="${id}" />\n`
    worldGeo.dispose()
  })

  const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US"
  xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <basematerials id="1">
${baseMaterials}
    </basematerials>
${objectXml}  </resources>
  <build>
${buildXml}  </build>
</model>
`

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />
</Types>
`

  const relsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />
</Relationships>
`

  const toUint8 = (s) => new TextEncoder().encode(s)
  const zipped = zipSync({
    '[Content_Types].xml': toUint8(contentTypesXml),
    '_rels/.rels': toUint8(relsXml),
    '3D/3dmodel.model': toUint8(modelXml),
  })
  saveAs(new Blob([zipped], { type: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml' }), filename)
  disposeScene(scaled)
}

// ---------- internals ----------

function buildPartSTLBytes(scene, partId, attachedTextZoneIds, scale) {
  // Collect the part mesh and any attached-text meshes, bake each one's
  // world transform into its geometry, then merge them all into a SINGLE
  // BufferGeometry. The resulting STL is one solid body — slicers union
  // the overlapping text/part volume instead of treating them as separate
  // shells.
  scene.updateMatrixWorld(true)
  const wanted = new Set([partId, ...attachedTextZoneIds.map((z) => `text-${z}`)])
  const geometries = []
  scene.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry) return
    if (!wanted.has(obj.name)) return
    const worldGeo = normalizeGeometry(obj.geometry.clone())
    worldGeo.applyMatrix4(obj.matrixWorld)
    geometries.push(worldGeo)
  })
  if (geometries.length === 0) return null

  const merged = mergeGeometries(geometries, false)
  geometries.forEach((g) => g.dispose())
  if (!merged) return null
  if (scale !== 1) merged.scale(scale, scale, scale)

  const tmpMesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial())
  const tmpScene = new THREE.Scene()
  tmpScene.add(tmpMesh)
  const bytes = sceneToSTLBytes(tmpScene)
  merged.dispose()
  return bytes
}

/**
 * mergeGeometries requires every source geometry to expose the same set of
 * attributes. STL-loaded meshes have no indexed triangle list, while our
 * extruded text does. Normalize by dropping the index + keeping only
 * position/normal so all geometries match and can be merged.
 */
function normalizeGeometry(geo) {
  const g = geo.toNonIndexed()
  // Keep only position + normal attributes
  const position = g.getAttribute('position')
  if (!g.getAttribute('normal')) g.computeVertexNormals()
  const normal = g.getAttribute('normal')
  const stripped = new THREE.BufferGeometry()
  stripped.setAttribute('position', position)
  stripped.setAttribute('normal', normal)
  return stripped
}

function sceneToSTLBytes(scene) {
  const exporter = new STLExporter()
  // Binary mode returns a DataView; normalize to Uint8Array so Blob and
  // fflate.zipSync (which requires Uint8Array values) both accept it.
  const result = exporter.parse(scene, { binary: true })
  if (result instanceof Uint8Array) return result
  if (result instanceof DataView) {
    return new Uint8Array(result.buffer, result.byteOffset, result.byteLength)
  }
  if (result instanceof ArrayBuffer) return new Uint8Array(result)
  return new TextEncoder().encode(String(result))
}

function cloneAndScale(scene, scale) {
  const group = new THREE.Group()
  scene.traverse((obj) => {
    if (obj.isMesh && obj.geometry) {
      const cloned = obj.clone()
      cloned.geometry = obj.geometry.clone()
      cloned.material = obj.material.clone()
      group.add(cloned)
    }
  })
  group.scale.setScalar(scale)
  group.updateMatrixWorld(true)
  return group
}

function disposeScene(scene) {
  scene.traverse((obj) => {
    if (obj.isMesh) {
      obj.geometry?.dispose()
      obj.material?.dispose?.()
    }
  })
}

function colorToHex(color) {
  return color.getHexString().toUpperCase()
}

function escapeXml(str) {
  return String(str).replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      case "'": return '&apos;'
    }
  })
}

function safeZipName(name) {
  // Most zip tools tolerate spaces and parens, but strip path separators.
  return name.replace(/[\\/]/g, '_')
}
