// 澳门科技大学校园微缩 3D（three.js）
//
// 目标：一眼看出「哪栋楼、哪一层、哪里是火源」。
//   · 每栋楼按楼层逐层建（一栋楼 = N 个楼板盒子），所以楼层是可以被单独点亮的；
//   · 火源所在楼层整层转为红色发光，并竖一根光柱、地面一圈脉冲环、楼顶一个红色标签；
//   · 拖动旋转、滚轮缩放，自动缓慢旋转，方便对着评委讲。
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { CAMPUS_BUILDINGS, CAMPUS_DECOR, CAMPUS_FLOOR_HEIGHT, campusLocationForNode } from './campus.js'

const STYLE_COLORS = {
  glass: { body: '#1b3550', window: '#7dd3fc', roof: '#0e1c2c' },
  warm: { body: '#3a2f22', window: '#fbbf24', roof: '#1c150e' },
  clean: { body: '#243542', window: '#a7f3d0', roof: '#101d24' },
  lab: { body: '#17333a', window: '#5eead4', roof: '#0a1b1f' },
  office: { body: '#1d2a3d', window: '#93c5fd', roof: '#0d1520' },
  dorm: { body: '#22283a', window: '#c7d2fe', roof: '#101423' },
  sport: { body: '#2b2440', window: '#c4b5fd', roof: '#160f24' },
}

// 楼体外立面：用 canvas 画一层窗格，做成自发光贴图，夜里像亮着灯
function facadeTexture(color) {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 32
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, 64, 32)
  ctx.fillStyle = color
  for (let row = 2; row < 30; row += 6) {
    for (let col = 3; col < 60; col += 8) {
      ctx.globalAlpha = 0.35 + Math.random() * 0.6
      ctx.fillRect(col, row, 5, 3)
    }
  }
  ctx.globalAlpha = 1
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

function groundTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#0a1017'
  ctx.fillRect(0, 0, 512, 512)
  ctx.strokeStyle = 'rgba(56,189,248,0.12)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 512; i += 32) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(3, 3)
  return texture
}

export default function Campus3D({ fires = [], onPick }) {
  const wrapRef = useRef(null)
  const stageRef = useRef(null)
  const pickRef = useRef(onPick)
  pickRef.current = onPick

  useEffect(() => {
    const wrap = wrapRef.current
    const stage = stageRef.current
    if (!wrap || !stage) return undefined

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#05080f')
    scene.fog = new THREE.Fog('#05080f', 420, 1120)

    const camera = new THREE.PerspectiveCamera(42, 1, 1, 2600)
    camera.position.set(330, 300, 430)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    stage.appendChild(renderer.domElement)

    const labelRenderer = new CSS2DRenderer()
    labelRenderer.domElement.style.position = 'absolute'
    labelRenderer.domElement.style.inset = '0'
    labelRenderer.domElement.style.pointerEvents = 'none'
    stage.appendChild(labelRenderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 24, 10)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 200
    controls.maxDistance = 980
    controls.maxPolarAngle = Math.PI * 0.46
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.32

    // 灯光：半球环境光 + 主光（投影）+ 蓝色补光，做出夜景科技感
    scene.add(new THREE.HemisphereLight('#9ec9ff', '#050a12', 0.55))
    const key = new THREE.DirectionalLight('#cfe6ff', 1.5)
    key.position.set(220, 340, 180)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.near = 80
    key.shadow.camera.far = 1200
    key.shadow.camera.left = -420
    key.shadow.camera.right = 420
    key.shadow.camera.top = 420
    key.shadow.camera.bottom = -420
    key.shadow.bias = -0.0006
    scene.add(key)
    const rim = new THREE.DirectionalLight('#3b82f6', 0.5)
    rim.position.set(-260, 160, -220)
    scene.add(rim)

    const disposables = []
    const track = (object) => { disposables.push(object); return object }
    const labelNodes = []

    // 地面
    const ground = track(new THREE.Mesh(
      track(new THREE.PlaneGeometry(1400, 1400)),
      track(new THREE.MeshStandardMaterial({ map: groundTexture(), color: '#132030', roughness: 0.95, metalness: 0.05 })),
    ))
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)

    // 草坪与广场
    const lawnMat = track(new THREE.MeshStandardMaterial({ color: '#0f2a22', roughness: 1 }))
    const plazaMat = track(new THREE.MeshStandardMaterial({ color: '#182534', roughness: 0.7, metalness: 0.15 }))
    const lawn = track(new THREE.Mesh(track(new THREE.CircleGeometry(240, 64)), lawnMat))
    lawn.rotation.x = -Math.PI / 2
    lawn.position.y = 0.05
    lawn.receiveShadow = true
    scene.add(lawn)

    // 道路
    const roadMat = track(new THREE.MeshStandardMaterial({ color: '#1b2635', roughness: 0.85 }))
    CAMPUS_DECOR.roads.forEach((road) => {
      const mesh = track(new THREE.Mesh(track(new THREE.BoxGeometry(road.w, 1.2, road.d)), roadMat))
      mesh.position.set(road.x, 0.6, road.z)
      mesh.receiveShadow = true
      scene.add(mesh)
    })

    // 中心广场（圆环 + 内圈）
    const plaza = track(new THREE.Mesh(track(new THREE.CircleGeometry(CAMPUS_DECOR.plaza.radius, 64)), plazaMat))
    plaza.rotation.x = -Math.PI / 2
    plaza.position.set(CAMPUS_DECOR.plaza.x, 0.15, CAMPUS_DECOR.plaza.z)
    plaza.receiveShadow = true
    scene.add(plaza)
    const ring = track(new THREE.Mesh(
      track(new THREE.RingGeometry(CAMPUS_DECOR.plaza.radius - 6, CAMPUS_DECOR.plaza.radius - 1.5, 64)),
      track(new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.5, side: THREE.DoubleSide })),
    ))
    ring.rotation.x = -Math.PI / 2
    ring.position.set(CAMPUS_DECOR.plaza.x, 0.3, CAMPUS_DECOR.plaza.z)
    scene.add(ring)

    // 校门
    const gateMat = track(new THREE.MeshStandardMaterial({ color: '#25405c', roughness: 0.5, metalness: 0.4 }))
    const gate = track(new THREE.Mesh(track(new THREE.BoxGeometry(CAMPUS_DECOR.gate.w, 16, CAMPUS_DECOR.gate.d)), gateMat))
    gate.position.set(CAMPUS_DECOR.gate.x, 8, CAMPUS_DECOR.gate.z)
    gate.castShadow = true
    scene.add(gate)

    // 绿化
    const trunkMat = track(new THREE.MeshStandardMaterial({ color: '#2f2418', roughness: 0.9 }))
    const leafMat = track(new THREE.MeshStandardMaterial({ color: '#1f5138', roughness: 0.85, flatShading: true }))
    CAMPUS_DECOR.trees.forEach((tree) => {
      const trunk = track(new THREE.Mesh(track(new THREE.CylinderGeometry(1.6, 2.1, 12, 6)), trunkMat))
      trunk.position.set(tree.x, 6, tree.z)
      trunk.castShadow = true
      const leaf = track(new THREE.Mesh(track(new THREE.IcosahedronGeometry(9, 0)), leafMat))
      leaf.position.set(tree.x, 18, tree.z)
      leaf.castShadow = true
      scene.add(trunk, leaf)
    })

    // 楼体
    const fireFloorMaterial = track(new THREE.MeshStandardMaterial({
      color: '#ff5a3c', emissive: '#ff3b30', emissiveIntensity: 1.6, roughness: 0.35, metalness: 0.2,
    }))
    const roofMaterials = {}
    const buildings = {}

    CAMPUS_BUILDINGS.forEach((building) => {
      const palette = STYLE_COLORS[building.style] ?? STYLE_COLORS.glass
      const group = new THREE.Group()
      group.position.set(building.x, 0, building.z)
      scene.add(group)

      // 基座
      const plinth = track(new THREE.Mesh(
        track(new THREE.BoxGeometry(building.w + 8, 3, building.d + 8)),
        track(new THREE.MeshStandardMaterial({ color: '#151f2b', roughness: 0.9 })),
      ))
      plinth.position.y = 1.5
      plinth.receiveShadow = true
      group.add(plinth)

      // 逐层楼板：每层单独一个盒子，便于单独高亮
      const bodyMat = track(new THREE.MeshStandardMaterial({
        color: palette.body,
        emissive: new THREE.Color(palette.window),
        emissiveMap: track(facadeTexture(palette.window)),
        emissiveIntensity: 0.55,
        roughness: 0.45,
        metalness: 0.35,
      }))
      const floorMeshes = []
      for (let floor = 1; floor <= building.floors; floor += 1) {
        const slab = track(new THREE.Mesh(
          track(new THREE.BoxGeometry(building.w, CAMPUS_FLOOR_HEIGHT - 0.9, building.d)),
          bodyMat,
        ))
        slab.position.y = (floor - 0.5) * CAMPUS_FLOOR_HEIGHT
        slab.castShadow = true
        slab.receiveShadow = true
        slab.userData = { buildingId: building.id, floor, baseMaterial: bodyMat }
        group.add(slab)
        floorMeshes.push(slab)
      }

      // 顶部收边
      if (!roofMaterials[building.style]) roofMaterials[building.style] = track(new THREE.MeshStandardMaterial({ color: palette.roof, roughness: 0.8 }))
      const roof = track(new THREE.Mesh(
        track(new THREE.BoxGeometry(building.w + 3, 3.4, building.d + 3)),
        roofMaterials[building.style],
      ))
      roof.position.y = building.floors * CAMPUS_FLOOR_HEIGHT + 1.2
      roof.castShadow = true
      group.add(roof)

      // 楼名标签
      const labelEl = document.createElement('div')
      labelEl.className = 'campus-label'
      labelEl.textContent = building.short
      const label = new CSS2DObject(labelEl)
      label.position.set(0, building.floors * CAMPUS_FLOOR_HEIGHT + 14, 0)
      group.add(label)

      buildings[building.id] = { building, group, floorMeshes, bodyMat, labelEl }
    })

    // 火源可视化：光柱 + 地面脉冲环 + 红色标签
    const beaconMat = track(new THREE.MeshBasicMaterial({ color: '#ff6b4a', transparent: true, opacity: 0.4, depthWrite: false }))
    const beaconGeo = track(new THREE.CylinderGeometry(3.4, 5.2, 1, 20, 1, true))
    const fireRingMat = track(new THREE.MeshBasicMaterial({ color: '#ff3b30', transparent: true, opacity: 0.65, side: THREE.DoubleSide }))
    const fireRingGeo = track(new THREE.RingGeometry(26, 34, 48))
    const fireGlowMat = track(new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.85 }))
    const fireGlowGeo = track(new THREE.SphereGeometry(6.5, 18, 18))

    const markers = []
    for (let index = 0; index < 6; index += 1) {
      const beacon = new THREE.Mesh(beaconGeo, beaconMat)
      const ringMesh = new THREE.Mesh(fireRingGeo, fireRingMat)
      ringMesh.rotation.x = -Math.PI / 2
      const glow = new THREE.Mesh(fireGlowGeo, fireGlowMat)
      const el = document.createElement('div')
      el.className = 'campus-fire-label'
      const label = new CSS2DObject(el)
      scene.add(beacon, ringMesh, glow, label)
      markers.push({ beacon, ring: ringMesh, glow, label, el, visible: false })
    }

    // 把火源落到校园模型上
    const applyFires = (list) => {
      buildings && Object.values(buildings).forEach((entry) => {
        entry.floorMeshes.forEach((slab) => { slab.material = slab.userData.baseMaterial })
        entry.labelEl.classList.remove('is-fire')
      })
      markers.forEach((marker) => {
        marker.visible = false
        marker.beacon.visible = false
        marker.ring.visible = false
        marker.glow.visible = false
        marker.label.visible = false
      })

      const unique = []
      const seen = new Set()
      ;(Array.isArray(list) ? list : []).forEach((fire) => {
        const location = campusLocationForNode(typeof fire === 'string' ? fire : fire?.nodeId)
        if (!location) return
        const key = `${location.buildingId}-${location.floor}`
        if (seen.has(key)) return
        seen.add(key)
        unique.push(location)
      })

      unique.slice(0, markers.length).forEach((location, index) => {
        const entry = buildings[location.buildingId]
        const marker = markers[index]
        if (!entry) return
        entry.floorMeshes.forEach((slab) => {
          if (slab.userData.floor === location.floor) slab.material = fireFloorMaterial
        })
        entry.labelEl.classList.add('is-fire')
        const { x, z } = entry.building
        marker.visible = true
        marker.beacon.visible = true
        marker.ring.visible = true
        marker.glow.visible = true
        marker.label.visible = true
        marker.beacon.position.set(x, location.height / 2 + 6, z)
        marker.beacon.scale.set(1, Math.max(location.height, 24), 1)
        marker.ring.position.set(x, 1.2, z)
        marker.glow.position.set(x, location.height, z)
        marker.label.position.set(x, location.height + 22, z)
        marker.el.textContent = `火源 · ${location.label}`
      })
    }

    // 点击拾取：点哪栋楼就把楼名与楼层数抛给上层
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const onPointerDown = (event) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(Object.values(buildings).flatMap((entry) => entry.floorMeshes), false)
      if (!hits.length) return
      const { buildingId, floor } = hits[0].object.userData
      const entry = buildings[buildingId]
      if (entry) pickRef.current?.({ building: entry.building, floor })
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown)

    // 尺寸自适应
    const resize = () => {
      const width = stage.clientWidth || 360
      const height = stage.clientHeight || 340
      renderer.setSize(width, height, false)
      labelRenderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(stage)

    // 动画：慢旋转 + 火源脉冲
    let raf = 0
    const startedAt = performance.now()
    const animate = () => {
      raf = requestAnimationFrame(animate)
      const time = (performance.now() - startedAt) / 1000
      markers.forEach((marker, index) => {
        if (!marker.visible) return
        const pulse = 1 + 0.16 * Math.sin(time * 3 + index)
        marker.glow.scale.setScalar(pulse)
        marker.ring.scale.setScalar(1 + 0.1 * Math.sin(time * 2 + index))
        marker.ring.material.opacity = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(time * 2 + index))
        marker.beacon.material.opacity = 0.28 + 0.18 * (0.5 + 0.5 * Math.sin(time * 1.6 + index))
      })
      fireFloorMaterial.emissiveIntensity = 1.2 + 0.5 * (0.5 + 0.5 * Math.sin(time * 2.4))
      controls.update()
      renderer.render(scene, camera)
      labelRenderer.render(scene, camera)
    }
    animate()

    wrap.dataset.campusReady = 'true'
    wrap.__applyFires = applyFires

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      controls.dispose()
      disposables.forEach((item) => item.dispose?.())
      scene.traverse((object) => {
        if (object instanceof CSS2DObject) object.element?.remove()
      })
      renderer.dispose()
      stage.removeChild(renderer.domElement)
      stage.removeChild(labelRenderer.domElement)
    }
  }, [])

  // 火源变化时只更新高亮，不重建场景
  useEffect(() => {
    const wrap = wrapRef.current
    if (wrap?.__applyFires) wrap.__applyFires(fires)
  }, [fires])

  return (
    <div className="campus-3d" ref={wrapRef}>
      <div className="campus-3d-stage" ref={stageRef} />
      <div className="campus-3d-legend">
        <span>拖动旋转 · 滚轮缩放 · 点击楼体查看楼层</span>
      </div>
    </div>
  )
}
