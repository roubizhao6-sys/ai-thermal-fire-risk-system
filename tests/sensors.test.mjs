// 用户端传感器输入层单测：不需要浏览器，打桩 localStorage / BroadcastChannel / window 即可。
// 覆盖「信标定位优先、过期回退、非法数据兜底」这条楼道导航精度的关键逻辑。

const store = new Map()
const windowListeners = []

globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => { store.set(key, String(value)) },
  removeItem: (key) => { store.delete(key) },
}

globalThis.BroadcastChannel = class {
  constructor(name) { this.name = name; this.listeners = [] }
  addEventListener(_type, fn) { this.listeners.push(fn) }
  removeEventListener(_type, fn) { this.listeners = this.listeners.filter((item) => item !== fn) }
  postMessage(data) { this.listeners.forEach((fn) => fn({ data })) }
  close() {}
}

globalThis.window = {
  addEventListener: (type, fn) => windowListeners.push({ type, fn }),
  removeEventListener: (type, fn) => {
    const index = windowListeners.findIndex((item) => item.type === type && item.fn === fn)
    if (index >= 0) windowListeners.splice(index, 1)
  },
}

const {
  BEACON_TTL_MS,
  KEYS,
  normalizeFire,
  readHazardSources,
  readFire,
  readSettings,
  readTelemetry,
  resolvePosition,
  saveManualPosition,
  writeJson,
} = await import('../src/user/sensors.js')

const { subscribe } = await import('../src/user/sensors.js')

let failures = 0
const check = (name, condition, detail = '') => {
  if (condition) console.log(`  PASS  ${name}`)
  else {
    failures += 1
    console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`)
  }
}

const clear = () => store.clear()

console.log('\n[1] 没有任何数据：回退到默认手动位置')
{
  clear()
  const position = resolvePosition()
  check('默认 4 楼走廊', position.floor === 4 && position.spot === 'C', JSON.stringify(position))
  check('来源标记为手动', position.source === 'manual', position.source)
}

console.log('\n[2] 手动选点生效并可持久化')
{
  clear()
  saveManualPosition({ floor: 8, spot: 'A' })
  const position = resolvePosition()
  check('跟随手动选点', position.floor === 8 && position.spot === 'A', JSON.stringify(position))
  check('写入了手动位置键', JSON.parse(store.get(KEYS.position)).floor === 8)
}

console.log('\n[3] 蓝牙信标优先于手动选点')
{
  clear()
  saveManualPosition({ floor: 2, spot: 'B' })
  writeJson(KEYS.beacon, { floor: 6, spot: 'C', accuracy: 3.5, at: Date.now(), source: 'ble' })
  const position = resolvePosition()
  check('信标覆盖手动', position.floor === 6 && position.spot === 'C', JSON.stringify(position))
  check('来源标记为信标', position.source === 'beacon', position.source)
  check('透传定位精度', position.accuracy === 3.5, `${position.accuracy}`)
}

console.log('\n[4] 信标过期后回退手动选点')
{
  clear()
  saveManualPosition({ floor: 3, spot: 'A' })
  writeJson(KEYS.beacon, { floor: 7, spot: 'B', at: Date.now() - BEACON_TTL_MS - 5000 })
  const position = resolvePosition()
  check('过期信标不再参与', position.floor === 3 && position.spot === 'A', JSON.stringify(position))
  check('来源回到手动', position.source === 'manual', position.source)
}

console.log('\n[5] 信标可以只给 nodeId（原生端常见写法）')
{
  clear()
  writeJson(KEYS.beacon, { nodeId: 'C6', at: Date.now() })
  const position = resolvePosition()
  check('nodeId 解析为楼层与位置', position.floor === 6 && position.spot === 'C', JSON.stringify(position))
}

console.log('\n[6] 非法信标数据必须被忽略')
{
  clear()
  saveManualPosition({ floor: 5, spot: 'C' })
  writeJson(KEYS.beacon, { floor: 99, spot: 'X', at: Date.now() })
  const position = resolvePosition()
  check('非法楼层/位置不生效', position.floor === 5 && position.spot === 'C', JSON.stringify(position))
}

console.log('\n[7] 火情与设置')
{
  clear()
  writeJson(KEYS.fire, { nodeId: 'C4', floor: 4, mode: 'drill' })
  const fire = readFire()
  check('读出火源', fire?.nodeId === 'C4', JSON.stringify(fire))
  check('自动补齐起始时间', typeof fire?.startedAt === 'number', `${fire?.startedAt}`)

  check('无火情返回 null', ((clear()), readFire() === null))

  clear()
  check('设置默认全开', (() => { const s = readSettings(); return s.sound && s.voice && s.vibrate })())
  writeJson(KEYS.settings, { sound: false })
  const settings = readSettings()
  check('自定义设置覆盖默认', settings.sound === false && settings.voice === true, JSON.stringify(settings))
}

console.log('\n[8] 热像遥测（预留接口）')
{
  clear()
  writeJson(KEYS.telemetry, { at: Date.now(), nodes: [{ id: 'n1', nodeId: 'C4', floor: 4, temp: 88 }] })
  const telemetry = readTelemetry()
  check('新鲜遥测可用', telemetry?.nodes?.length === 1, JSON.stringify(telemetry))
  writeJson(KEYS.telemetry, { at: Date.now() - BEACON_TTL_MS - 1000, nodes: [{ id: 'n1', temp: 88 }] })
  check('过期遥测返回 null', readTelemetry() === null)
}

console.log('\n[9] 订阅通道：只对关心的 key 触发')
{
  clear()
  let hits = 0
  const off = subscribe([KEYS.beacon], () => { hits += 1 })
  windowListeners
    .filter((item) => item.type === 'storage')
    .forEach((item) => item.fn({ key: KEYS.fire }))
  check('无关 key 不触发', hits === 0, `${hits}`)
  windowListeners
    .filter((item) => item.type === 'storage')
    .forEach((item) => item.fn({ key: KEYS.beacon }))
  check('相关 key 触发一次', hits === 1, `${hits}`)
  off()
  windowListeners
    .filter((item) => item.type === 'storage')
    .forEach((item) => item.fn({ key: KEYS.beacon }))
  check('取消订阅后不再触发', hits === 1, `${hits}`)
}

console.log('\n[10] 多火源：载荷归一化与多传感器合并')
{
  clear()
  const legacy = normalizeFire({ nodeId: 'C4', floor: 4, startedAt: 1000, mode: 'live' })
  check('旧格式 → 单火源', legacy.sources.length === 1 && legacy.sources[0].nodeId === 'C4', JSON.stringify(legacy.sources))
  check('保留起始时间与模式', legacy.startedAt === 1000 && legacy.mode === 'live')

  const multi = normalizeFire({ nodeId: 'C4', nodes: ['C4', 'C6'], startedAt: 2000, mode: 'drill' })
  check('nodes 数组 → 两个火源', multi.sources.length === 2, JSON.stringify(multi.sources))
  check('主节点仍为首个火源', multi.nodeId === 'C4', multi.nodeId)

  const staggered = normalizeFire({ sources: [{ nodeId: 'A4', startedAt: 0 }, { nodeId: 'B6', startedAt: 60000 }], startedAt: 0 })
  check('各火源保留自己的起火时间', staggered.sources[1].startedAt === 60000, JSON.stringify(staggered.sources))

  const nowMs = 600000
  clear()
  writeJson(KEYS.fire, { nodeId: 'C4', startedAt: nowMs - 120000, mode: 'live' })
  writeJson(KEYS.telemetry, { at: nowMs, nodes: [{ nodeId: 'C6', temp: 88 }, { nodeId: 'C7', temp: 30 }, { floor: 5, temp: 70 }] })
  const sources = readHazardSources({ nowMs, thresholds: { highThreshold: 65 } })
  check('火源 + 超阈值节点都成为来源', sources.length === 3, JSON.stringify(sources.map((item) => item.nodeId)))
  check('低于阈值的节点不算火源', !sources.some((item) => item.nodeId === 'C7'))
  check('只给楼层也能定位到走廊节点', sources.some((item) => item.nodeId === 'C5'))
  check('火源来源排在最先', sources[0].from === 'fire', sources[0].from)
  check('每个来源各带已流逝时间', sources[0].elapsedSec === 120, `${sources[0].elapsedSec}`)

  clear()
  writeJson(KEYS.fire, { nodes: ['C6'], startedAt: nowMs, mode: 'live' })
  writeJson(KEYS.telemetry, { at: nowMs, nodes: [{ nodeId: 'C6', temp: 90 }] })
  check('同一节点不会重复计入', readHazardSources({ nowMs }).length === 1)
}

console.log(`\n结果：${failures === 0 ? '全部通过' : `${failures} 项失败`}`)
process.exit(failures === 0 ? 0 : 1)
