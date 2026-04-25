import * as THREE from 'three'

/**
 * Given 4 corner points of a quad on the model's surface (in CCW or CW order:
 * p1=top-left, p2=top-right, p3=bottom-right, p4=bottom-left), build a local
 * coordinate frame whose origin is the quad centroid, with:
 *   +X (right) = p2 - p1 normalized
 *   +Y (up)   = p1 - p4 normalized
 *   +Z (norm) = right × up (outward from the surface)
 *
 * Returns the Matrix4 that maps surface-local coords to world coords, plus
 * width and height of the quad.
 */
export function buildSurfaceFrame(surface) {
  const p1 = new THREE.Vector3().fromArray(surface.point1)
  const p2 = new THREE.Vector3().fromArray(surface.point2)
  const p3 = new THREE.Vector3().fromArray(surface.point3)
  const p4 = new THREE.Vector3().fromArray(surface.point4)

  const right = p2.clone().sub(p1)
  const up = p1.clone().sub(p4)
  const width = right.length()
  const height = up.length()
  right.normalize()
  up.normalize()
  const normal = new THREE.Vector3().crossVectors(right, up).normalize()
  // Re-orthogonalize up to guarantee orthonormal basis even if quad isn't planar.
  const upOrtho = new THREE.Vector3().crossVectors(normal, right).normalize()

  const center = new THREE.Vector3()
    .add(p1).add(p2).add(p3).add(p4).multiplyScalar(0.25)

  const matrix = new THREE.Matrix4()
  matrix.makeBasis(right, upOrtho, normal)
  matrix.setPosition(center)

  return { matrix, width, height, normal, center }
}
