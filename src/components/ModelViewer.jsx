import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useLoader, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei'
import * as THREE from 'three'
import { useModelStore } from '../state/useModelStore.js'
import { buildTextGeometry, loadFont } from '../lib/textTo3D.js'
import { buildSurfaceFrame } from '../lib/surfaceFrame.js'
import { assetUrl } from '../lib/assetUrl.js'
import { splitConnectedComponents } from '../lib/splitGeometry.js'
import { HybridLoaderClass } from '../lib/loadGeometry.js'
import {
  extractColorPalette,
  snapshotOriginalColors,
  applyPaletteToGeometry,
} from '../lib/vertexColors.js'

/** Slot id for a sub-component of a split part. Index 0 = main body. */
export function accentSlotId(partId, index) {
  return index === 0 ? partId : `${partId}-accent${index}`
}

function PartMesh({ part, onRef, onBounds }) {
  // When the part is flagged splitColors, fall through to the multi-mesh
  // renderer that lets each disconnected piece take its own color slot.
  // (Legacy STL-only multi-piece path; FBX/GLB with vertex colors uses the
  // palette path below instead.)
  if (part.splitColors) return <SplitPartMesh part={part} onRef={onRef} onBounds={onBounds} />

  const geometry = useLoader(HybridLoaderClass, assetUrl(part.file))
  const setColorPalette = useModelStore((s) => s.setColorPalette)
  const palette = useModelStore((s) => s.colorPalettes[part.id])
  const partColor = useModelStore((s) => s.partColors[part.id] || part.defaultColor)
  const meshRef = useRef()
  const position = part.position || [0, 0, 0]
  const rotation = part.rotation || [0, 0, 0]

  // Extract the palette once per loaded geometry. If the geometry has
  // vertex colors (FBX/GLB), this returns the painted accent regions; if
  // not (plain STL), returns null and we fall back to single-color mode.
  useEffect(() => {
    if (!geometry) return
    const detected = extractColorPalette(geometry)
    if (detected && detected.length) {
      snapshotOriginalColors(geometry)
      setColorPalette(part.id, detected)
    } else {
      setColorPalette(part.id, [])
    }
  }, [part.id, geometry, setColorPalette])

  // Reapply palette to the GL buffer whenever the user picks a new color.
  useEffect(() => {
    if (!geometry || !palette?.length) return
    applyPaletteToGeometry(geometry, palette)
  }, [geometry, palette])

  useEffect(() => {
    if (!geometry) return
    geometry.computeBoundingBox()
    if (onBounds) {
      // Report the bbox in world coords (local bbox shifted by part position),
      // so text anchors that fall back to `onPart.max.z` work correctly.
      const worldBox = geometry.boundingBox.clone()
      worldBox.min.add(new THREE.Vector3(...position))
      worldBox.max.add(new THREE.Vector3(...position))
      onBounds(part.id, worldBox)
    }
    if (meshRef.current && onRef) onRef(part.id, meshRef.current)
  }, [part.id, onRef, onBounds, geometry, position])

  const usePalette = !!(palette && palette.length)

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      name={part.id}
      position={position}
      rotation={rotation}
      castShadow
      receiveShadow
    >
      {/* When the geometry has a vertex-color palette, drive shading from
       *  the per-vertex color buffer; otherwise tint with a single color
       *  from partColors. */}
      <meshStandardMaterial
        color={usePalette ? '#ffffff' : partColor}
        vertexColors={usePalette}
        roughness={0.6}
        metalness={0.05}
      />
    </mesh>
  )
}

/**
 * Loads the STL once, splits it into connected components (largest first),
 * and renders each as its own mesh. The largest piece reuses the part's
 * id as its color slot; smaller pieces get `${partId}-accent1`, `-accent2`,
 * etc. so they each can be colored independently from the sidebar.
 *
 * Reports the detected component count up to the store so the ColorEditor
 * can render a row per detected accent piece.
 */
function SplitPartMesh({ part, onRef, onBounds }) {
  const geometry = useLoader(HybridLoaderClass, assetUrl(part.file))
  const setPartSlots = useModelStore((s) => s.setPartSlots)
  const position = part.position || [0, 0, 0]
  const rotation = part.rotation || [0, 0, 0]

  // Split once per loaded geometry. Falls back to [geometry] if there's
  // only one connected piece anyway.
  const components = useMemo(() => {
    if (!geometry) return []
    const split = splitConnectedComponents(geometry)
    return split.length ? split : [geometry]
  }, [geometry])

  // Report bbox of the union (= original geometry bbox) so text anchors keep
  // resolving correctly, and tell the store how many slots this part now has.
  useEffect(() => {
    if (!geometry || !components.length) return
    geometry.computeBoundingBox()
    if (onBounds) {
      const worldBox = geometry.boundingBox.clone()
      worldBox.min.add(new THREE.Vector3(...position))
      worldBox.max.add(new THREE.Vector3(...position))
      onBounds(part.id, worldBox)
    }
    setPartSlots(part.id, components.length)
  }, [part.id, components, geometry, onBounds, position, setPartSlots])

  return (
    <group name={part.id} position={position} rotation={rotation}>
      {components.map((geo, i) => (
        <SubMesh
          key={i}
          geometry={geo}
          slotId={accentSlotId(part.id, i)}
          fallbackColor={i === 0 ? part.defaultColor : (part.accentColor || '#a5acaf')}
          onRef={onRef}
        />
      ))}
    </group>
  )
}

function SubMesh({ geometry, slotId, fallbackColor, onRef }) {
  const color = useModelStore((s) => s.partColors[slotId] || fallbackColor)
  const meshRef = useRef()
  useEffect(() => {
    if (meshRef.current && onRef) onRef(slotId, meshRef.current)
  }, [slotId, onRef])
  return (
    <mesh ref={meshRef} geometry={geometry} name={slotId} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.6} metalness={0.05} />
    </mesh>
  )
}

/**
 * TextMesh places a text mesh on a quad "surface" defined by 4 corner points
 * in the part's coordinate space. The surface's local frame (right, up, normal)
 * orients the text so its extrusion runs along the surface normal. The text
 * geometry is shifted by `embed` along the negative normal direction so it
 * penetrates into the part, guaranteeing a fused body after export.
 *
 * Legacy fallback: zones without a `surface` definition still honor
 * `anchor = [x, y, zOffset]` on the `onPart`'s front face.
 */
function TextMesh({ zone, fonts, onRef, partBounds }) {
  const config = useModelStore((s) => s.textConfigs[zone.id])
  const globalTextColor = useModelStore((s) => s.globalTextColor)
  const [geometry, setGeometry] = useState(null)
  const meshRef = useRef()

  useEffect(() => {
    let cancelled = false
    async function build() {
      if (!config || !config.text || !fonts.length) {
        setGeometry(null)
        return
      }
      const fontDef =
        fonts.find((f) => f.name === config.fontName) || fonts[0]
      try {
        const font = await loadFont(fontDef.url)
        const geo = buildTextGeometry({
          font,
          text: config.text,
          size: config.size,
          depth: config.depth,
          spacing: config.spacing,
          lineSpacing: config.lineSpacing,
          align: config.align,
        })
        if (geo) {
          // Shift the text along -Z by `embed` so it starts below the surface
          // (still extrudes +Z up past it for solid-body printing), and nudge
          // along local X/Y per the user's offset sliders.
          const dx = config.offsetX || 0
          const dy = config.offsetY || 0
          const dz = -(config.embed || 0)
          if (dx || dy || dz) geo.translate(dx, dy, dz)
        }
        if (!cancelled) setGeometry(geo)
      } catch (err) {
        console.error('font/text error', err)
      }
    }
    build()
    return () => {
      cancelled = true
    }
  }, [
    config?.text, config?.fontName, config?.size, config?.depth,
    config?.spacing, config?.lineSpacing, config?.align, config?.embed,
    config?.offsetX, config?.offsetY, fonts,
  ])

  useEffect(() => {
    if (meshRef.current && onRef) onRef(`text:${zone.id}`, meshRef.current)
  }, [zone.id, onRef, geometry])

  // Compute the surface frame matrix (stable as long as surface points don't change).
  const surfaceMatrix = useMemo(() => {
    if (!zone.surface) return null
    return buildSurfaceFrame(zone.surface).matrix
  }, [zone.surface])

  if (!geometry) return null

  // --- Surface quad mode ---
  if (surfaceMatrix) {
    return (
      <mesh
        ref={meshRef}
        geometry={geometry}
        matrix={surfaceMatrix}
        matrixAutoUpdate={false}
        name={`text-${zone.id}`}
      >
        <meshStandardMaterial color={globalTextColor || config?.color || '#000'} roughness={0.6} metalness={0.05} />
      </mesh>
    )
  }

  // --- Legacy anchor fallback ---
  if (!zone.anchor) return null
  const [ax, ay, az] = zone.anchor
  let worldZ = az
  if (zone.onPart) {
    const bbox = partBounds[zone.onPart]
    if (!bbox) return null
    worldZ = bbox.max.z + (az ?? 0)
  }
  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={[ax, ay, worldZ]}
      rotation={zone.rotation || [0, 0, 0]}
      name={`text-${zone.id}`}
    >
      <meshStandardMaterial color={config?.color || '#000'} roughness={0.6} metalness={0.05} />
    </mesh>
  )
}

/**
 * Re-frames the camera each frame until the scene bounds are stable.
 * Handles the delay of Suspense-loaded STLs without a single hard-coded timeout.
 */
function SceneFramer({ groupRef, partCount }) {
  const { camera, controls, size } = useThree()
  const framedSig = useRef('')

  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    const box = new THREE.Box3().setFromObject(group)
    if (box.isEmpty()) return

    const sig = `${box.min.x.toFixed(2)},${box.min.y.toFixed(2)},${box.min.z.toFixed(2)}|${box.max.x.toFixed(2)},${box.max.y.toFixed(2)},${box.max.z.toFixed(2)}|${partCount}`
    if (sig === framedSig.current) return
    framedSig.current = sig

    const center = box.getCenter(new THREE.Vector3())
    const sizeVec = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z)
    const aspect = size.width / size.height
    const fov = (camera.fov * Math.PI) / 180
    const fitHeight = Math.max(sizeVec.y, sizeVec.x / aspect)
    const dist = (fitHeight / 2) / Math.tan(fov / 2) * 1.4

    camera.position.set(center.x, center.y, center.z + Math.max(dist, maxDim * 1.2))
    camera.near = Math.max(0.1, maxDim / 500)
    camera.far = maxDim * 50
    camera.lookAt(center)
    camera.updateProjectionMatrix()

    if (controls) {
      controls.target.copy(center)
      controls.update()
    }
  })

  return null
}

export default function ModelViewer({ model, fonts, onSceneReady }) {
  const groupRef = useRef()
  const meshRegistryRef = useRef({})
  const [partBounds, setPartBounds] = useState({})

  const onSceneReadyRef = useRef(onSceneReady)
  useEffect(() => { onSceneReadyRef.current = onSceneReady }, [onSceneReady])

  const handleRef = useCallback((id, mesh) => {
    meshRegistryRef.current[id] = mesh
    onSceneReadyRef.current?.(groupRef.current, meshRegistryRef.current)
  }, [])

  const handleBounds = useCallback((partId, bbox) => {
    setPartBounds((prev) => {
      const existing = prev[partId]
      if (
        existing &&
        existing.max.z === bbox.max.z &&
        existing.min.z === bbox.min.z &&
        existing.min.x === bbox.min.x
      ) {
        return prev
      }
      return { ...prev, [partId]: bbox }
    })
  }, [])

  return (
    <Canvas
      shadows
      camera={{ position: [0, 0, 250], fov: 40, near: 1, far: 5000 }}
      style={{ width: '100%', height: '100%', display: 'block' }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
    >
      <color attach="background" args={['#1a1438']} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[100, 200, 150]} intensity={1.0} castShadow />
      <directionalLight position={[-150, 50, 100]} intensity={0.4} />
      <directionalLight position={[0, -150, 50]} intensity={0.25} />
      <group ref={groupRef}>
        <Suspense fallback={null}>
          {model.parts.map((p) => (
            <PartMesh key={p.id} part={p} onRef={handleRef} onBounds={handleBounds} />
          ))}
        </Suspense>
        {model.textZones.map((z) => (
          <TextMesh key={z.id} zone={z} fonts={fonts} onRef={handleRef} partBounds={partBounds} />
        ))}
      </group>
      <SceneFramer groupRef={groupRef} partCount={model.parts.length} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={['#f87171', '#4ade80', '#60a5fa']} labelColor="white" />
      </GizmoHelper>
    </Canvas>
  )
}
