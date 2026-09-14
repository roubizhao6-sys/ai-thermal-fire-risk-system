import { useEffect, useRef } from 'react'
import * as THREE from 'three'

function buildingMaterial({ color, emissive = 0x000000, opacity = 1, transparent = false, roughness = 0.55, metalness = 0.18 }) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    opacity,
    transparent,
    roughness,
    metalness,
  })
}

function makeWindow(x, y, z, width, height, color = 0x56c8ff) {
  const geometry = new THREE.PlaneGeometry(width, height)
  const material = new THREE.MeshBasicMaterial({ color })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(x, y, z)
  return mesh
}

function makeBuilding() {
  const group = new THREE.Group()

  // Main tower
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(8, 12, 5),
    buildingMaterial({ color: 0x0d2238, emissive: 0x05101f, roughness: 0.68, metalness: 0.12 }),
  )
  tower.position.y = 6
  group.add(tower)

  // Floor slabs
  for (const y of [2.5, 5, 7.5, 10]) {
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(8.25, 0.12, 5.25),
      buildingMaterial({ color: 0x153956, emissive: 0x07182b, roughness: 0.38, metalness: 0.5 }),
    )
    slab.position.y = y
    group.add(slab)
  }

  // Roof
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(8.45, 0.5, 5.45),
    buildingMaterial({ color: 0x0a1d30, roughness: 0.5 }),
  )
  roof.position.y = 12.35
  group.add(roof)

  // Window grid
  const floors = [1.5, 3.9, 6.3, 8.7, 11.1]
  const xPositions = [-2.8, -1.4, 0, 1.4, 2.8]
  for (const y of floors) {
    for (const x of xPositions) {
      group.add(makeWindow(x, y, 2.52, 0.52, 0.66, 0x54b8e8))
      group.add(makeWindow(x, y, -2.52, 0.52, 0.66, 0x3f91c7))
    }
  }
  for (const y of floors) {
    for (const z of [-1.9, -0.65, 0.65, 1.9]) {
      group.add(makeWindow(4.02, y, z, 0.58, 0.62, 0x3f91c7))
      group.add(makeWindow(-4.02, y, z, 0.58, 0.62, 0x3f91c7))
    }
  }

  // Entrance
  const entrance = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 2.2, 0.2),
    buildingMaterial({ color: 0x8b5f2f, emissive: 0x2c1705 }),
  )
  entrance.position.set(0, 1.1, 2.52)
  group.add(entrance)

  // Exit doors on two sides
  for (const x of [-3.4, 3.4]) {
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 2.0, 0.8),
      buildingMaterial({ color: 0x0e7490, emissive: 0x14c07a, roughness: 0.3 }),
    )
    door.position.set(x, 1, -2.52)
    group.add(door)
  }

  // Roof antenna and beacon
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8),
    buildingMaterial({ color: 0x9fb4c7, metalness: 0.9, roughness: 0.2 }),
  )
  antenna.position.y = 13.3
  group.add(antenna)

  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xff4b3a }),
  )
  beacon.position.y = 14.15
  group.add(beacon)

  return group
}

function makeSensor(x, y, z) {
  const sensor = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.22, 0.28),
    buildingMaterial({ color: 0x0c2b44, emissive: 0x38bdf8, roughness: 0.25, metalness: 0.4 }),
  )
  sensor.position.set(x, y, z)
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(1.35, 2.4, 18),
    buildingMaterial({ color: 0x38bdf8, emissive: 0x0b5b7a, opacity: 0.18, transparent: true }),
  )
  cone.position.set(x, y - 1.55, z + 0.15)
  cone.rotation.x = Math.PI
  sensor.add(cone)
  return sensor
}

export default function Building3DView({ frame }) {
  const containerRef = useRef(null)
  const rootRef = useRef(null)
  const hotspotsRef = useRef(null)
  const interactionRef = useRef({ dragging: false, lastX: 0, lastY: 0, autoRotate: true, lastMoveAt: 0 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.setSize(container.clientWidth || 1, container.clientHeight || 1)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x050d19)
    scene.fog = new THREE.Fog(0x050d19, 18, 44)

    const camera = new THREE.PerspectiveCamera(41, (container.clientWidth || 1) / (container.clientHeight || 1), 0.1, 100)
    camera.position.set(13.5, 9.5, 13.5)

    const root = new THREE.Group()
    root.rotation.y = -0.55
    scene.add(root)
    rootRef.current = root

    scene.add(new THREE.AmbientLight(0x9fc7e8, 1.35))
    const hemisphere = new THREE.HemisphereLight(0xbfe3ff, 0x07101e, 0.85)
    scene.add(hemisphere)
    const sun = new THREE.DirectionalLight(0xffffff, 2.2)
    sun.position.set(10, 14, 8)
    sun.castShadow = true
    scene.add(sun)

    root.add(makeBuilding())
    root.add(makeSensor(-4.6, 3.1, 2.1))
    root.add(makeSensor(4.6, 6.0, -2.0))
    root.add(makeSensor(-4.6, 9.0, -1.9))
    root.add(makeSensor(4.6, 11.2, 2.2))

    const ground = new THREE.GridHelper(26, 22, 0x2c6ba8, 0x0a1b2d)
    ground.position.y = -0.02
    scene.add(ground)

    const hotspots = new THREE.Group()
    root.add(hotspots)
    hotspotsRef.current = hotspots

    const resize = () => {
      if (!container.clientWidth || !container.clientHeight) return
      renderer.setSize(container.clientWidth, container.clientHeight)
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()

    const pointerDown = (event) => {
      interactionRef.current.dragging = true
      interactionRef.current.lastX = event.clientX
      interactionRef.current.lastY = event.clientY
      interactionRef.current.autoRotate = false
    }
    const pointerMove = (event) => {
      if (!interactionRef.current.dragging || !rootRef.current) return
      const dx = event.clientX - interactionRef.current.lastX
      const dy = event.clientY - interactionRef.current.lastY
      interactionRef.current.lastX = event.clientX
      interactionRef.current.lastY = event.clientY
      rootRef.current.rotation.y += dx * 0.006
      camera.position.y = Math.min(17, Math.max(4.5, camera.position.y + dy * 0.02))
      camera.lookAt(0, 5.5, 0)
      interactionRef.current.lastMoveAt = performance.now()
    }
    const pointerUp = () => {
      interactionRef.current.dragging = false
      setTimeout(() => {
        if (!interactionRef.current.dragging && performance.now() - interactionRef.current.lastMoveAt > 2600) {
          interactionRef.current.autoRotate = true
        }
      }, 2600)
    }
    renderer.domElement.addEventListener('pointerdown', pointerDown)
    renderer.domElement.addEventListener('pointermove', pointerMove)
    renderer.domElement.addEventListener('pointerup', pointerUp)
    renderer.domElement.addEventListener('pointerleave', pointerUp)

    let frameId
    const clock = new THREE.Clock()
    const animate = () => {
      frameId = requestAnimationFrame(animate)
      const time = clock.getElapsedTime()
      if (rootRef.current && interactionRef.current.autoRotate && !interactionRef.current.dragging) {
        rootRef.current.rotation.y += 0.0022
      }
      hotspotsRef.current?.children.forEach((hotspot, index) => {
        const scale = 1 + Math.sin(time * 3 + index) * 0.12
        hotspot.scale.setScalar(scale)
      })
      camera.lookAt(0, 5.5, 0)
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(frameId)
      observer.disconnect()
      renderer.domElement.removeEventListener('pointerdown', pointerDown)
      renderer.domElement.removeEventListener('pointermove', pointerMove)
      renderer.domElement.removeEventListener('pointerup', pointerUp)
      renderer.domElement.removeEventListener('pointerleave', pointerUp)
      renderer.dispose()
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
    }
  }, [])

  useEffect(() => {
    const group = hotspotsRef.current
    if (!group) return
    group.clear()
    const hotspots = frame?.hotspots?.length ? frame.hotspots : [{ x: 32, y: 34, temp: frame?.maxTemp || 72 }]
    hotspots.slice(0, 4).forEach((spot, index) => {
      const x = (Number(spot.x || 0) / 100 - 0.5) * 6.8
      const y = 1.1 + (Number(spot.y || 0) / 100) * 10
      const z = index % 2 === 0 ? 2.75 : -2.75
      const temp = Number(spot.temp || 0)
      const color = temp >= 65 ? 0xff3b30 : 0xff9d2e
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.42 + Math.min(temp / 90, 1) * 0.3, 18, 18),
        new THREE.MeshBasicMaterial({ color }),
      )
      sphere.position.set(x, y, z)
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.72 + Math.min(temp / 90, 1) * 0.35, 0.035, 10, 28),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.65 }),
      )
      ring.position.copy(sphere.position)
      ring.rotation.x = Math.PI / 2
      group.add(sphere)
      group.add(ring)
    })
  }, [frame])

  return <div className="building-3d-view" ref={containerRef} />
}
