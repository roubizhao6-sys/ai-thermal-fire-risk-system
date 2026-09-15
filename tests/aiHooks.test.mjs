// AI 接入接口单测：队友注册的三类能力必须"即插即用 + 出错不拖垮主流程"。

import {
  getVitalSensor,
  getVisionDetector,
  integrationStatus,
  listExtraProviders,
  readVitalFrame,
  registerProvider,
  registerVitalSensor,
  registerVisionDetector,
  resetIntegrations,
  runVisionDetector,
  subscribeIntegrations,
} from '../src/shared/aiHooks.js'

let failures = 0
function check(name, condition, detail = '') {
  if (condition) console.log(`  PASS  ${name}`)
  else { failures += 1; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`) }
}

console.log('[1] 端点预设注册')
{
  resetIntegrations()
  check('初始没有额外预设', Object.keys(listExtraProviders()).length === 0)
  const preset = registerProvider({ id: 'doubao', label: '豆包（火山方舟）', baseUrl: 'https://ark.example/v3', model: 'doubao-seed' })
  check('注册成功并返回规范对象', preset?.id === 'doubao' && preset.label === '豆包（火山方舟）')
  check('进入预设列表', listExtraProviders().doubao?.baseUrl === 'https://ark.example/v3')
  check('非法预设被忽略', registerProvider(null) === null && registerProvider({ label: '没有 id' }) === null)
  check('状态里能看到预设', integrationStatus().providers.includes('doubao'))
}

console.log('[2] 视觉通道（阶段一）')
{
  resetIntegrations()
  check('未接入时返回 attached=false', (await runVisionDetector({})).attached === false)
  registerVisionDetector(async () => ({ flame: 1.4, smoke: -0.2, note: '测试通道' }))
  check('接入后 getVisionDetector 有值', typeof getVisionDetector() === 'function')
  const result = await runVisionDetector({ frame: {}, floor: 4 })
  check('置信度被夹到 0–1', result.flame === 1 && result.smoke === 0)
  check('带回通道备注', result.note === '测试通道')
  registerVisionDetector(async () => { throw new Error('camera-down') })
  const failed = await runVisionDetector({})
  check('通道报错不抛出，只是标记失败', failed.attached === true && failed.flame === null && failed.note.includes('camera-down'))
  registerVisionDetector(null)
  check('可以注销通道', getVisionDetector() === null && integrationStatus().vision === false)
}

console.log('[3] 红外设备（阶段三）')
{
  resetIntegrations()
  const fallback = { width: 2, height: 2, temperatures: [30, 31, 32, 33] }
  const noSensor = await readVitalFrame(fallback)
  check('未接入时用兜底帧', noSensor.attached === false && noSensor.frame === fallback)

  registerVitalSensor(async () => ({ width: 4, height: 4, temperatures: new Array(16).fill(31) }))
  const withSensor = await readVitalFrame(fallback)
  check('接入后使用真实帧', withSensor.attached === true && withSensor.frame.width === 4 && withSensor.frame.temperatures.length === 16)

  registerVitalSensor(async () => ({ width: 4, height: 4, temperatures: [1, 2, 3] }))
  const badFrame = await readVitalFrame(fallback)
  check('矩阵尺寸不符时回退兜底帧', badFrame.frame === fallback && badFrame.note.includes('尺寸'))

  registerVitalSensor(async () => { throw new Error('device-offline') })
  const broken = await readVitalFrame(fallback)
  check('设备报错时回退并说明原因', broken.frame === fallback && broken.note.includes('device-offline'))
  check('getVitalSensor 可读', typeof getVitalSensor() === 'function')
}

console.log('[4] 状态订阅')
{
  resetIntegrations()
  const seen = []
  const unsubscribe = subscribeIntegrations((payload) => seen.push(payload.reason))
  registerProvider({ id: 'x', baseUrl: '', model: '' })
  registerVisionDetector(async () => ({}))
  registerVitalSensor(async () => null)
  check('每次注册都会通知订阅者', seen.length >= 3, seen.join(','))
  unsubscribe()
  registerProvider({ id: 'y', baseUrl: '', model: '' })
  check('退订后不再收到通知', seen.length === 3, seen.join(','))
  resetIntegrations()
  check('重置后状态清空', integrationStatus().vision === false && integrationStatus().vital === false && integrationStatus().providers.length === 0)
}

console.log('[5] 外部配置与端点解析（ai-config.json / window.THERMAL_GUARD_AI）')
{
  resetIntegrations()
  const { listAiProviders, providerPreset, readAiSettings, setExternalAiConfig } = await import('../src/shared/aiClient.js')
  check('内置预设包含离线与自定义端点', listAiProviders().offline && listAiProviders().custom)
  check('未知来源回退到自定义端点', providerPreset('不存在的来源').id === 'custom')

  setExternalAiConfig({ provider: 'ollama', baseUrl: '/ai/v1', model: 'qwen2.5:7b', _readme: '注释字段应被忽略', vision: true })
  const settings = readAiSettings()
  check('外部配置生效', settings.provider === 'ollama' && settings.baseUrl === '/ai/v1' && settings.model === 'qwen2.5:7b' && settings.vision === true)
  check('注释字段不进入设置', settings._readme === undefined)
  setExternalAiConfig(null)
  check('清空外部配置后回到默认', readAiSettings().provider === 'offline')

  registerProvider({ id: 'doubao', label: '豆包（火山方舟）', baseUrl: 'https://ark.example/v3', model: 'doubao-seed' })
  check('队友注册的端点出现在下拉列表里', listAiProviders().doubao?.label === '豆包（火山方舟）')
  resetIntegrations()
}

console.log(`\n结果：${failures === 0 ? '全部通过' : `${failures} 项失败`}`)
process.exit(failures === 0 ? 0 : 1)
