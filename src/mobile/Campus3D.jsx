// 澳门科技大学校园微缩 3D（three.js）
//
// 布局按校方校园图重建（楼名与相对位置来自对地图的 OCR）。
// 交互：
//   · 拖动旋转 / 滚轮缩放 / 缓慢自动旋转；
//   · **点楼体进入楼层模式**：镜头逐层抬升，选中层高亮、其余层半透明，可逐层切换、可"楼层展开"；
//   · 火源所在楼层整层转红 + 光柱 + 地面脉冲环 + "火源 · X 樓"标签，支持多处火源。
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { CAMPUS_BUILDINGS, CAMPUS_FLOOR_HEIGHT, CAMPUS_LANDMARKS, CAMPUS_ROADS, campusLocationForNode } from './campus.js'

const STYLE_COLORS = {
  glass: { body: '#1b3550', window: '#7dd3fc', roof: '#0e1c2c' },
  warm: { body: '#3a2f22', window: '#fbbf24', roof: '#1c150e' },
  clean: { body: '#243542', window: '#a7f3d0', roof: '#101d24' },
  lab: { body: '#17333a', window: '#5eead4', roof: '#0a1b1f' },
  office: { body: '#1d2a3d', window: '#93c5fd', roof: '#0d1520' },
  dorm: { body: '#22283a', window: '#c7d2fe', roof: '#101423' },
  sport: { body: '#2b2440', window: '#c4b5fd', roof: '#160f24' },
}

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
  ctx.strokeStyle = 'rgba(56,189,248,0.10)'
  for (let i = 0; i <= 512; i += 32) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(4, 4)
  return texture
}

const lerp = (from, to, t) => from + (to - from) * t

export default function Campus3D({ fires = [], onPick, onFocusChange }) {
  const wrapRef = useRef(null)
  const stageRef = useRef(null)
  const apiRef = useRef(null)
  const pickRef = useRef(onPick)
  pickRef.current = onPick
  const [focus, setFocus] = useState(null) // { building, floor }
  const [exploded, setExploded] = useState(false)
  const focusRef = useRef(null)
  focusRef.current = focus
  const reportRef = useRef(onFocusChange)
  reportRef.current = onFocusChange

  // 建场景（只建一次）
  useEffect(() => {
    const wrap = wrapRef.current
    const stage = stageRef.current
    if (!wrap || !stage) return undefined

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#05080f')
    scene.fog = new THREE.Fog('#05080f', 620, 1500)

    const camera = new THREE.PerspectiveCamera(42, 1, 1, 3200)
    camera.position.set(470, 430, 640)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
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
    controls.target.set(0, 30, 40)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 160
    controls.maxDistance = 1800
    controls.maxPolarAngle = Math.PI * 0.47
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.3

    scene.add(new THREE.HemisphereLight('#9ec9ff', '#050a12', 0.6))
    const key = new THREE.DirectionalLight('#cfe6ff', 1.5)
    key.position.set(320, 520, 260)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.near = 100
    key.shadow.camera.far = 1800
    key.shadow.camera.left = -700
    key.shadow.camera.right = 700
    key.shadow.camera.top = 700
    key.shadow.camera.bottom = -700
    key.shadow.bias = -0.0006
    scene.add(key)
    const rim = new THREE.DirectionalLight('#3b82f6', 0.5)
    rim.position.set(-400, 240, -320)
    scene.add(rim)

    const disposables = []
    const track = (object) => { disposables.push(object); return object }

    // 地面
    const ground = track(new THREE.Mesh(
      track(new THREE.PlaneGeometry(2600, 2600)),
      track(new THREE.MeshStandardMaterial({ map: groundTexture(), color: '#101c2a', roughness: 0.95, metalness: 0.05 })),
    ))
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)

    const lawn = track(new THREE.Mesh(
      track(new THREE.CircleGeometry(520, 72)),
      track(new THREE.MeshStandardMaterial({ color: '#0d2a22', roughness: 1 })),
    ))
    lawn.rotation.x = -Math.PI / 2
    lawn.position.y = 0.05
    lawn.receiveShadow = true
    scene.add(lawn)

    // 道路（按地图主动线）
    const roadMat = track(new THREE.MeshStandardMaterial({ color: '#1d2937', roughness: 0.85 }))
    CAMPUS_ROADS.forEach((road) => {
      const mesh = track(new THREE.Mesh(track(new THREE.BoxGeometry(road.w, 1.2, road.d)), roadMat))
      mesh.position.set(road.x, 0.6, road.z)
      mesh.rotation.y = -road.angle
      mesh.receiveShadow = true
      scene.add(mesh)
    })

    // 地标：南北门 + 轻轨科大站
    const gateMat = track(new THREE.MeshStandardMaterial({ color: '#27506f', roughness: 0.5, metalness: 0.4 }))
    CAMPUS_LANDMARKS.forEach((landmark) => {
      const height = landmark.kind === 'station' ? 14 : 12
      const mesh = track(new THREE.Mesh(track(new THREE.BoxGeometry(landmark.w, height, landmark.d)), gateMat))
      mesh.position.set(landmark.x, height / 2, landmark.z)
      mesh.castShadow = true
      scene.add(mesh)
      const el = document.createElement('div')
      el.className = 'campus-label is-landmark'
      el.textContent = landmark.name
      const label = new CSS2DObject(el)
      label.position.set(landmark.x, height + 10, landmark.z)
      scene.add(label)
    })

    // 楼体：每层一个独立材质的楼板盒子
    const baseMaterials = {}
    const accentMaterial = track(new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0ea5e9', emissiveIntensity: 1.1, roughness: 0.3, metalness: 0.25 }))
    const fireMaterial = track(new THREE.MeshStandardMaterial({ color: '#ff5a3c', emissive: '#ff3b30', emissiveIntensity: 1.6, roughness: 0.35, metalness: 0.2 }))
    const buildings = {}

    CAMPUS_BUILDINGS.forEach((building) => {
      const palette = STYLE_COLORS[building.style] ?? STYLE_COLORS.glass
      if (!baseMaterials[building.style]) {
        baseMaterials[building.style] = {
          body: track(new THREE.MeshStandardMaterial({ color: palette.body, emissive: new THREE.Color(palette.window), emissiveMap: track(facadeTexture(palette.window)), emissiveIntensity: 0.55, roughness: 0.45, metalness: 0.35 })),
          roof: track(new THREE.MeshStandardMaterial({ color: palette.roof, roughness: 0.8 })),
        }
      }
      const materials = baseMaterials[building.style]
      const group = new THREE.Group()
      group.position.set(building.x, 0, building.z)
      scene.add(group)

      const plinth = track(new THREE.Mesh(
        track(new THREE.BoxGeometry(building.w + 8, 3, building.d + 8)),
        track(new THREE.MeshStandardMaterial({ color: '#14202c', roughness: 0.9 })),
      ))
      plinth.position.y = 1.5
      plinth.receiveShadow = true
      group.add(plinth)

      const floorMeshes = []
      for (let floor = 1; floor <= building.floors; floor += 1) {
        // 每层独立材质：这样才能单独高亮 / 半透明
        const slabMaterial = track(materials.body.clone())
        const slab = track(new THREE.Mesh(
          track(new THREE.BoxGeometry(building.w, CAMPUS_FLOOR_HEIGHT - 0.9, building.d)),
          slabMaterial,
        ))
        const baseY = (floor - 0.5) * CAMPUS_FLOOR_HEIGHT
        slab.position.y = baseY
        slab.castShadow = true
        slab.receiveShadow = true
        slab.userData = { buildingId: building.id, floor, baseY, material: slabMaterial }
        group.add(slab)
        floorMeshes.push(slab)
      }

      const roof = track(new THREE.Mesh(
        track(new THREE.BoxGeometry(building.w + 3, 3.4, building.d + 3)),
        materials.roof,
      ))
      roof.position.y = building.floors * CAMPUS_FLOOR_HEIGHT + 1.2
      roof.castShadow = true
      group.add(roof)

      const labelEl = document.createElement('div')
      labelEl.className = 'campus-label'
      labelEl.textContent = building.short
      const label = new CSS2DObject(labelEl)
      label.position.set(0, building.floors * CAMPUS_FLOOR_HEIGHT + 16, 0)
      group.add(label)

      buildings[building.id] = { building, group, floorMeshes, labelEl }
    })

    // 火源标记（最多 6 处）
    const beaconMat = track(new THREE.MeshBasicMaterial({ color: '#ff6b4a', transparent: true, opacity: 0.4, depthWrite: false }))
    const beaconGeo = track(new THREE.CylinderGeometry(3.6, 5.6, 1, 20, 1, true))
    const fireRingMat = track(new THREE.MeshBasicMaterial({ color: '#ff3b30', transparent: true, opacity: 0.6, side: THREE.DoubleSide }))
    const fireRingGeo = track(new THREE.RingGeometry(26, 34, 48))
    const fireGlowMat = track(new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.85 }))
    const fireGlowGeo = track(new THREE.SphereGeometry(6.8, 18, 18))
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
      markers.push({ beacon, ring: ringMesh, glow, label, el, location: null })
    }

    // 画面刷新：根据"火源 + 当前聚焦楼层 + 是否展开"决定每层的外观
    let fireLocations = []
    let focusState = null
    let explodeState = false
    const desired = { position: camera.position.clone(), target: controls.target.clone() }

    const refresh = () => {
      Object.values(buildings).forEach((entry) => {
        const isFocusedBuilding = focusState?.buildingId === entry.building.id
        entry.floorMeshes.forEach((slab) => {
          const { floor, material } = slab.userData
          const isFire = fireLocations.some((location) => location.buildingId === entry.building.id && location.floor === floor)
          const isFocused = isFocusedBuilding && focusState.floor === floor
          let target = baseMaterials[entry.building.style].body
          material.color.copy(target.color)
          material.emissive.copy(target.emissive)
          material.emissiveMap = target.emissiveMap
          material.emissiveIntensity = target.emissiveIntensity
          material.roughness = target.roughness
          material.metalness = target.metalness
          material.opacity = 1
          material.transparent = false

          if (isFire) {
            material.color.set('#ff5a3c')
            material.emissive.set('#ff3b30')
            material.emissiveIntensity = 1.6
          } else if (isFocused) {
            material.color.set('#38bdf8')
            material.emissive.set('#0ea5e9')
            material.emissiveIntensity = 1.1
          } else if (focusState && !isFocusedBuilding) {
            material.transparent = true
            material.opacity = 0.22
          } else if (isFocusedBuilding) {
            material.transparent = true
            material.opacity = 0.4
          }
          material.needsUpdate = true

          const offset = focusState && explodeState ? (floor - 1) * 4.2 : 0
          slab.position.y = slab.userData.baseY + offset
        })
        entry.labelEl.classList.toggle('is-fire', fireLocations.some((location) => location.buildingId === entry.building.id))
        entry.labelEl.classList.toggle('is-focused', focusState?.buildingId === entry.building.id)
      })

      markers.forEach((marker, index) => {
        const location = fireLocations[index]
        marker.location = location ?? null
        const visible = Boolean(location)
        marker.beacon.visible = visible
        marker.ring.visible = visible
        marker.glow.visible = visible
        marker.label.visible = visible
        if (!visible) return
        marker.beacon.position.set(location.building.x, location.height / 2 + 6, location.building.z)
        marker.beacon.scale.set(1, Math.max(location.height, 24), 1)
        marker.ring.position.set(location.building.x, 1.2, location.building.z)
        marker.glow.position.set(location.building.x, location.height, location.building.z)
        marker.label.position.set(location.building.x, location.height + 22, location.building.z)
        marker.el.textContent = `火源 · ${location.label}`
      })

      // 镜头目标：聚焦某楼某层 → 飞到该层侧面；否则回到校园全景
      if (focusState) {
        const entry = buildings[focusState.buildingId]
        if (entry) {
          const { building } = entry
          const floorY = (focusState.floor - 0.5) * CAMPUS_FLOOR_HEIGHT
          const distance = Math.max(building.w, building.d) * 2.4 + 130
          desired.target.set(building.x, floorY + 8, building.z)
          desired.position.set(building.x + distance * 0.85, floorY + 72, building.z + distance * 0.95)
        }
      } else {
        desired.target.set(0, 30, 40)
        desired.position.set(470, 430, 640)
      }
      controls.autoRotate = !focusState
    }

    // 对外 API
    apiRef.current = {
      setFires: (list) => {
        fireLocations = []
        const seen = new Set()
        ;(Array.isArray(list) ? list : []).forEach((fire) => {
          const location = campusLocationForNode(typeof fire === 'string' ? fire : fire?.nodeId)
          if (!location) return
          const key = `${location.buildingId}-${location.floor}`
          if (seen.has(key)) return
          seen.add(key)
          fireLocations.push(location)
        })
        refresh()
      },
      setFocus: (nextFocus, nextExploded) => {
        focusState = nextFocus
        explodeState = Boolean(nextExploded)
        refresh()
      },
    }

    // 点击拾取：点楼层 → 进入该楼该层的视角
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const onClick = (event) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(Object.values(buildings).flatMap((entry) => entry.floorMeshes), false)
      if (!hits.length) return
      const { buildingId, floor } = hits[0].object.userData
      const entry = buildings[buildingId]
      if (!entry) return
      setFocus({ buildingId, floor })
      pickRef.current?.({ building: entry.building, floor })
      reportRef.current?.({ building: entry.building, floor })
    }
    renderer.domElement.addEventListener('click', onClick)

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

    let raf = 0
    const startedAt = performance.now()
    const animate = () => {
      raf = requestAnimationFrame(animate)
      const time = (performance.now() - startedAt) / 1000
      // 平滑飞向目标视角
      camera.position.set(
        lerp(camera.position.x, desired.position.x, 0.075),
        lerp(camera.position.y, desired.position.y, 0.075),
        lerp(camera.position.z, desired.position.z, 0.075),
      )
      controls.target.set(
        lerp(controls.target.x, desired.target.x, 0.09),
        lerp(controls.target.y, desired.target.y, 0.09),
        lerp(controls.target.z, desired.target.z, 0.09),
      )
      markers.forEach((marker, index) => {
        if (!marker.location) return
        const pulse = 1 + 0.16 * Math.sin(time * 3 + index)
        marker.glow.scale.setScalar(pulse)
        marker.ring.scale.setScalar(1 + 0.1 * Math.sin(time * 2 + index))
        marker.ring.material.opacity = 0.32 + 0.3 * (0.5 + 0.5 * Math.sin(time * 2 + index))
        marker.beacon.material.opacity = 0.26 + 0.18 * (0.5 + 0.5 * Math.sin(time * 1.6 + index))
      })
      fireMaterial.emissiveIntensity = 1.2 + 0.5 * (0.5 + 0.5 * Math.sin(time * 2.4))
      accentMaterial.emissiveIntensity = 0.9 + 0.35 * (0.5 + 0.5 * Math.sin(time * 2))
      controls.update()
      renderer.render(scene, camera)
      labelRenderer.render(scene, camera)
    }
    animate()
    wrap.dataset.campusReady = 'true'

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      renderer.domElement.removeEventListener('click', onClick)
      controls.dispose()
      apiRef.current = null
      disposables.forEach((item) => item.dispose?.())
      scene.traverse((object) => {
        if (object instanceof CSS2DObject) object.element?.remove()
      })
      renderer.dispose()
      stage.removeChild(renderer.domElement)
      stage.removeChild(labelRenderer.domElement)
    }
  }, [])

  useEffect(() => {
    apiRef.current?.setFires(fires)
  }, [fires])

  useEffect(() => {
    apiRef.current?.setFocus(focus, exploded)
  }, [focus, exploded])

  const focusedBuilding = focus ? CAMPUS_BUILDINGS.find((item) => item.id === focus.buildingId) : null
  const fireLocation = fires.length ? campusLocationForNode(typeof fires[0] === 'string' ? fires[0] : fires[0]?.nodeId) : null

  return (
    <div className="campus-3d" ref={wrapRef}>
      <div className="campus-3d-stage" ref={stageRef} />

      {focus && focusedBuilding ? (
        <div className="campus-floor-panel">
          <div className="campus-floor-head">
            <div>
              <strong>{focusedBuilding.name}</strong>
              <small>共 {focusedBuilding.floors} 層 · 当前第 {focus.floor} 層</small>
            </div>
            <button type="button" onClick={() => setFocus(null)}>返回校园</button>
          </div>
          <div className="campus-floor-grid">
            {Array.from({ length: focusedBuilding.floors }, (_, index) => index + 1).map((floor) => (
              <button
                key={floor}
                type="button"
                className={focus.floor === floor ? 'active' : ''}
                onClick={() => setFocus({ buildingId: focusedBuilding.id, floor })}
              >
                {floor} 層
              </button>
            ))}
          </div>
          <div className="campus-floor-actions">
            <button type="button" disabled={focus.floor <= 1} onClick={() => setFocus({ buildingId: focusedBuilding.id, floor: focus.floor - 1 })}>下一层</button>
            <button type="button" disabled={focus.floor >= focusedBuilding.floors} onClick={() => setFocus({ buildingId: focusedBuilding.id, floor: focus.floor + 1 })}>上一层</button>
            <button type="button" className={exploded ? 'active' : ''} onClick={() => setExploded((value) => !value)}>{exploded ? '楼层合并' : '楼层展开'}</button>
          </div>
          {focusedBuilding.note && <p className="campus-floor-note">{focusedBuilding.note}</p>}
        </div>
      ) : (
        <div className="campus-3d-legend">
          <span>拖动旋转 · 滚轮缩放 · 点击楼体进入楼层视角</span>
          {fireLocation && (
            <button
              type="button"
              className="campus-jump-fire"
              onClick={() => setFocus({ buildingId: fireLocation.buildingId, floor: fireLocation.floor })}
            >
              定位到火源 · {fireLocation.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
