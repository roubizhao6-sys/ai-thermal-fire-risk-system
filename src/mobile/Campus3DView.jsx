import { useEffect, useRef } from 'react'
import * as THREE from 'three'

function standard({ color, emissive = 0x000000, opacity = 1, transparent = false, roughness = 0.55, metalness = 0.18 }) {
  return new THREE.MeshStandardMaterial({ color, emissive, opacity, transparent, roughness, metalness })
}

function labelSprite(text, color = '#dff4ff', background = 'rgba(3,10,22,.82)') {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = background
  ctx.beginPath()
  ctx.roundRect(8, 16, 496, 92, 26)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.font = 'bold 48px "PingFang SC", "Arial Unicode MS", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.fillText(text, 256, 64)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }))
  sprite.scale.set(3.8, 0.95, 1)
  return sprite
}

function addLabel(group, text, x, y, z, color) {
  const sprite = labelSprite(text, color)
  sprite.position.set(x, y, z)
  group.add(sprite)
  return sprite
}

function buildingBox(w, h, d, color, emissive = 0x000000) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), standard({ color, emissive, roughness: 0.48, metalness: 0.18 }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function addWindowBand(parent, width, y, z, color = 0x46b8e8) {
  const band = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.28), new THREE.MeshBasicMaterial({ color }))
  band.position.set(0, y, z)
  parent.add(band)
}

function addTree(group, x, z, scale = 1) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * scale, 0.11 * scale, 1.1 * scale, 8), standard({ color: 0x6b4c2a, roughness: 0.9 }))
  trunk.position.set(x, 0.55 * scale, z)
  trunk.castShadow = true
  group.add(trunk)
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.48 * scale, 1.35 * scale, 10), standard({ color: 0x1f8a5b, emissive: 0x082f21, roughness: 0.78 }))
  crown.position.set(x, 1.55 * scale, z)
  crown.castShadow = true
  group.add(crown)
}

function makeSensor(x, y, z, rotationY = 0) {
  const root = new THREE.Group()
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.28), standard({ color: 0x0c2b44, emissive: 0x38bdf8, roughness: 0.25, metalness: 0.45 }))
  root.add(box)
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.25, 2.2, 18), standard({ color: 0x38bdf8, emissive: 0x0b5b7a, opacity: 0.15, transparent: true }))
  cone.position.set(0, -1.45, 0.25)
  cone.rotation.x = Math.PI
  root.add(cone)
  root.position.set(x, y, z)
  root.rotation.y = rotationY
  return root
}

function makeBuilding({ x, z, w, h, d, color, emissive = 0x000000, floors = 4, label, labelColor = '#8fd8ff', windowColor = 0x46b8e8, front = true }) {
  const root = new THREE.Group()
  const body = buildingBox(w, h, d, color, emissive)
  body.position.set(0, h / 2, 0)
  root.add(body)
  for (let i = 1; i < floors; i += 1) {
    const y = (h / floors) * i
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.08, d + 0.16), standard({ color: 0x1e4e70, emissive: 0x082038, roughness: 0.35, metalness: 0.4 }))
    slab.position.y = y
    root.add(slab)
  }
  for (let i = 0; i < floors; i += 1) {
    const y = h * (0.13 + i / floors)
    const band = new THREE.Group()
    band.position.y = y
    for (let j = -1; j <= 1; j += 1) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.18, h * 0.12), new THREE.MeshBasicMaterial({ color: windowColor }))
      win.position.set(j * w * 0.25, 0, d / 2 + 0.01)
      band.add(win)
    }
    root.add(band)
  }
  if (front) {
    const entrance = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.26, h * 0.28), standard({ color: 0x0b2339, emissive: 0x0b3e63, roughness: 0.3 }))
    entrance.position.set(0, h * 0.14, d / 2 + 0.02)
    root.add(entrance)
  }
  root.position.set(x, 0, z)
  const labelY = h + 0.72
  addLabel(root, label, 0, labelY, 0, labelColor)
  return root
}

function makeGate() {
  const root = new THREE.Group()
  const pillarMat = standard({ color: 0xdce8f1, emissive: 0x1a4668, roughness: 0.36, metalness: 0.2 })
  for (const x of [-2.1, 2.1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 3.6, 0.55), pillarMat)
    pillar.position.set(x, 1.8, 0)
    root.add(pillar)
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.5, 0.65), standard({ color: 0x162c44, emissive: 0x123b5a, roughness: 0.38, metalness: 0.28 }))
  lintel.position.set(0, 3.45, 0)
  root.add(lintel)
  addLabel(root, '澳门科技大学', 0, 3.95, 0.02, '#c9f2ff')
  return root
}

function makeCampus() {
  const root = new THREE.Group()

  const ground = new THREE.Mesh(new THREE.BoxGeometry(27, 0.16, 19), standard({ color: 0x071727, emissive: 0x03101c, roughness: 0.86, metalness: 0.05 }))
  ground.position.y = -0.1
  ground.receiveShadow = true
  root.add(ground)

  const roadMat = standard({ color: 0x182331, emissive: 0x07101b, roughness: 0.7 })
  const boulevard = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 16), roadMat)
  boulevard.position.set(0, 0.01, 0)
  root.add(boulevard)
  const crossRoad = new THREE.Mesh(new THREE.BoxGeometry(23, 0.04, 1.4), roadMat)
  crossRoad.position.set(0, 0.01, 4.2)
  root.add(crossRoad)

  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.06, 48), standard({ color: 0x17354c, emissive: 0x0a2540, roughness: 0.55 }))
  plaza.position.set(0, 0.03, 3.4)
  root.add(plaza)

  const lake = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.05, 64), standard({ color: 0x0b6c9e, emissive: 0x063d64, opacity: 0.76, transparent: true, roughness: 0.15, metalness: 0.22 }))
  lake.position.set(-3.6, 0.02, 4.7)
  root.add(lake)

  const field = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.08, 4.2), standard({ color: 0x16804e, emissive: 0x0a3c25, roughness: 0.8 }))
  field.position.set(8.1, 0.04, 6.1)
  root.add(field)
  const fieldMark = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.64, 32), new THREE.MeshBasicMaterial({ color: 0xd8f9e6, transparent: true, opacity: 0.7, side: THREE.DoubleSide }))
  fieldMark.rotation.x = -Math.PI / 2
  fieldMark.position.set(8.1, 0.1, 6.1)
  root.add(fieldMark)

  root.add(makeGate().clone().translateX(0).translateZ(8.2))
  root.add(makeBuilding({ x: 0, z: -2.8, w: 6.8, h: 3.5, d: 4.4, color: 0x175b86, emissive: 0x09283d, floors: 3, label: '图书馆', labelColor: '#7de3ff', windowColor: 0x8fe7ff }))
  root.add(makeBuilding({ x: -7.4, z: -3.2, w: 4.8, h: 4.5, d: 3.7, color: 0xb9d7e7, emissive: 0x183b53, floors: 4, label: '行政楼', labelColor: '#b9efff', windowColor: 0x61c9ee }))
  root.add(makeBuilding({ x: 7.1, z: -3.2, w: 4.8, h: 3.7, d: 3.1, color: 0x17608a, emissive: 0x092b44, floors: 4, label: '教学楼 A' }))
  root.add(makeBuilding({ x: 7.1, z: 1.0, w: 4.8, h: 3.7, d: 3.1, color: 0x17608a, emissive: 0x092b44, floors: 4, label: '教学楼 B' }))
  root.add(makeBuilding({ x: 0, z: -7.0, w: 5.5, h: 3.9, d: 3.1, color: 0x123d63, emissive: 0x071f35, floors: 4, label: '实验室', labelColor: '#f6bd75', windowColor: 0xf2a34c }))
  root.add(makeBuilding({ x: -7.8, z: 6.2, w: 5.4, h: 5.8, d: 3.2, color: 0x1d3656, emissive: 0x0a1b2d, floors: 5, label: '学生宿舍', labelColor: '#a9d5ff' }))
  const hospital = makeBuilding({ x: 8.0, z: -7.0, w: 4.2, h: 4.9, d: 3.2, color: 0xc9dce7, emissive: 0x274457, floors: 4, label: '科大医院', labelColor: '#ffd7d7', windowColor: 0xff7f7f })
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xff4b3a })
  const crossA = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 0.07), crossMat)
  const crossB = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.0, 0.07), crossMat)
  crossA.position.set(0, 4.45, 1.64); crossB.position.set(0, 4.45, 1.64); hospital.add(crossA, crossB)
  root.add(hospital)

  ;[
    [-2.2, 6.5], [2.2, 6.5], [-2.1, 1.7], [2.1, 1.7], [-5.2, 1.2], [5.2, 1.2],
    [-4.8, 7.4], [4.8, 7.4], [-9.3, -1.2], [9.3, 0.0], [-9.4, 2.8], [9.5, 3.5],
  ].forEach(([x, z], index) => addTree(root, x, z, 0.9 + (index % 3) * 0.08))

  const routeMat = new THREE.MeshBasicMaterial({ color: 0x36e38b })
  const route = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 10.8), routeMat)
  route.position.set(-1.25, 0.05, -0.3)
  root.add(route)
  const routeBranch = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.06, 0.16), routeMat)
  routeBranch.position.set(-3.9, 0.05, -5.75)
  root.add(routeBranch)

  const sensors = [
    [-3.45, 4.6, -2.2, -0.5], [3.45, 4.6, -2.2, 0.5], [-7.4, 5.5, -3.2, 0],
    [7.1, 4.7, -3.2, -0.45], [7.1, 4.7, 1.0, 0.35], [0, 4.55, -7.0, 0],
  ]
  sensors.forEach(([x, y, z, rot]) => root.add(makeSensor(x, y, z, rot)))

  return root
}

export default function Campus3DView({ frame }) {
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
    container.prepend(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x050d19)
    scene.fog = new THREE.Fog(0x050d19, 22, 54)
    const camera = new THREE.PerspectiveCamera(40, (container.clientWidth || 1) / (container.clientHeight || 1), 0.1, 120)
    camera.position.set(17, 13, 19)

    const root = new THREE.Group()
    root.rotation.y = -0.42
    scene.add(root)
    rootRef.current = root

    scene.add(new THREE.AmbientLight(0xa9cff0, 1.45))
    const hemisphere = new THREE.HemisphereLight(0xc9ebff, 0x06101d, 0.9)
    scene.add(hemisphere)
    const sun = new THREE.DirectionalLight(0xffffff, 2.35)
    sun.position.set(12, 18, 8)
    sun.castShadow = true
    scene.add(sun)

    root.add(makeCampus())
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

    const down = (event) => {
      interactionRef.current.dragging = true
      interactionRef.current.autoRotate = false
      interactionRef.current.lastX = event.clientX
      interactionRef.current.lastY = event.clientY
    }
    const move = (event) => {
      if (!interactionRef.current.dragging) return
      const dx = event.clientX - interactionRef.current.lastX
      const dy = event.clientY - interactionRef.current.lastY
      interactionRef.current.lastX = event.clientX
      interactionRef.current.lastY = event.clientY
      root.rotation.y += dx * 0.006
      camera.position.y = Math.min(21, Math.max(6, camera.position.y + dy * 0.025))
      interactionRef.current.lastMoveAt = performance.now()
    }
    const up = () => {
      interactionRef.current.dragging = false
      setTimeout(() => {
        if (performance.now() - interactionRef.current.lastMoveAt > 2600) interactionRef.current.autoRotate = true
      }, 2600)
    }
    renderer.domElement.addEventListener('pointerdown', down)
    renderer.domElement.addEventListener('pointermove', move)
    renderer.domElement.addEventListener('pointerup', up)
    renderer.domElement.addEventListener('pointerleave', up)

    let frameId
    const clock = new THREE.Clock()
    const animate = () => {
      frameId = requestAnimationFrame(animate)
      const time = clock.getElapsedTime()
      if (interactionRef.current.autoRotate && !interactionRef.current.dragging) root.rotation.y += 0.0018
      hotspotsRef.current?.children.forEach((hotspot, index) => {
        hotspot.scale.setScalar(1 + Math.sin(time * 3 + index) * 0.12)
      })
      camera.lookAt(0, 3.8, 0)
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(frameId)
      observer.disconnect()
      renderer.domElement.removeEventListener('pointerdown', down)
      renderer.domElement.removeEventListener('pointermove', move)
      renderer.domElement.removeEventListener('pointerup', up)
      renderer.domElement.removeEventListener('pointerleave', up)
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  useEffect(() => {
    const group = hotspotsRef.current
    if (!group) return
    group.clear()
    const anchors = [
      [-7.4, 5.2, -3.2], [0, 4.2, -2.8], [7.1, 4.5, -3.2], [7.1, 4.5, 1.0], [0, 4.5, -7.0],
    ]
    const hotspots = frame?.hotspots?.length ? frame.hotspots : [{ x: 34, y: 44, temp: frame?.maxTemp || 72 }]
    hotspots.slice(0, 5).forEach((spot, index) => {
      const anchor = anchors[index % anchors.length]
      const temp = Number(spot.temp || frame?.maxTemp || 0)
      const color = temp >= 65 ? 0xff3b30 : 0xff9d2e
      const node = new THREE.Group()
      node.position.set(anchor[0] + (Number(spot.x || 0) / 100 - 0.5) * 2.4, anchor[1], anchor[2] + (Number(spot.y || 0) / 100 - 0.5) * 1.8)
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.36 + Math.min(temp / 95, 1) * 0.26, 18, 18), new THREE.MeshBasicMaterial({ color }))
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.65 + Math.min(temp / 95, 1) * 0.28, 0.035, 10, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.68 }))
      ring.rotation.x = Math.PI / 2
      node.add(sphere, ring)
      group.add(node)
    })
  }, [frame])

  return (
    <div className="campus-3d-view" ref={containerRef}>
      <div className="campus-legend">
        <strong>澳门科技大学数字孪生演示</strong>
        <span>正门</span><span>图书馆</span><span>教学楼</span><span>宿舍区</span><span>科大医院</span>
      </div>
      <div className="campus-caption">低多边形数字孪生 · 依据公开校园地图与建筑外观素材原创重建</div>
      <div className="campus-downloads">
        <a href={`${import.meta.env.BASE_URL}models/must-campus.step`} download>下载 STEP CAD</a>
        <a href={`${import.meta.env.BASE_URL}models/must-campus.stl`} download>下载 STL 模型</a>
      </div>
    </div>
  )
}
