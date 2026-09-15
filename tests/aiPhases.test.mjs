// AI 三阶段纯逻辑单测：
//   阶段一 预防判定（三路证据融合 + 单路不报警 + 周边通知文案）
//   阶段二 救援简报汇总
//   阶段三 生命体征扫描（环境基准、排除余温、人体温度带、置信度）

import {
  AI_PHASES,
  buildNeighborNotice,
  buildPhaseMessages,
  fusePreventionSignals,
  summarizeRescueBrief,
} from '../src/shared/aiPhases.js'
import {
  ambientBaseline,
  createAfterFireFrame,
  describeVitalSigns,
  scanVitalSigns,
} from '../src/shared/vitalSigns.js'

let failures = 0
function check(name, condition, detail = '') {
  if (condition) console.log(`  PASS  ${name}`)
  else { failures += 1; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`) }
}

console.log('[1] 阶段一：三路证据融合')
{
  const normal = fusePreventionSignals({ thermal: { maxTemp: 30, ror: 0.5, sustainedSec: 0 } })
  check('常温安静 → normal', normal.level === 'normal' && normal.alarm === false)
  check('给出理由文本', normal.reasons.length > 0)

  const thermalOnly = fusePreventionSignals({ thermal: { maxTemp: 72, ror: 9, sustainedSec: 12, multiNode: false } })
  check('只有热像快速升温 → 可以单独判定报警', thermalOnly.level === 'alarm')
  check('标出证据来源数', thermalOnly.evidence.sources >= 1)

  const singleWarm = fusePreventionSignals({ thermal: { maxTemp: 52, ror: 1, sustainedSec: 3 } })
  check('单路轻微升温 → 只关注不报警', singleWarm.level === 'watch' && singleWarm.alarm === false, singleWarm.level)

  const threeWay = fusePreventionSignals({
    thermal: { maxTemp: 58, ror: 2, sustainedSec: 5, multiNode: true },
    visual: { flame: 0.8, smoke: 0.7 },
  })
  check('热像未到阈值但三路证据齐 → 报警', threeWay.alarm === true, JSON.stringify(threeWay.evidence))

  const smokeOnly = fusePreventionSignals({ thermal: { maxTemp: 31 }, smoke: { density: 0.9 } })
  check('只有烟雾一路 → 不报警只关注', smokeOnly.alarm === false && smokeOnly.level === 'watch')
}

console.log('[2] 阶段一：给周边居民的通知')
{
  const alarm = fusePreventionSignals({
    thermal: { maxTemp: 78, ror: 8, sustainedSec: 20 },
    visual: { flame: 0.9 },
    smoke: { density: 0.6 },
  })
  const notice = buildNeighborNotice(alarm, { floor: 4, location: '教学楼' })
  check('火警通知含地点与楼层', notice.includes('教学楼') && notice.includes('4 楼'))
  check('火警通知含撤离动作', notice.includes('撤离') && notice.includes('不要乘坐电梯'))
  const calm = buildNeighborNotice(fusePreventionSignals({ thermal: { maxTemp: 28 } }), { floor: 2, location: '图书馆' })
  check('正常状态通知为安心提示', calm.includes('监测正常') && calm.includes('无需撤离'))
}

console.log('[3] 阶段二：救援端简报')
{
  const lines = summarizeRescueBrief({
    fire: { nodes: ['C4', 'C5'] },
    position: { floor: 4, spot: 'C' },
    crowd: { totals: { remaining: 62 } },
    blocked: ['A1'],
    userStatus: [
      { floor: 4, spot: 'C', needsHelp: true, advice: '原地避险等救援' },
      { floor: 2, spot: 'A', needsHelp: false, advice: '按箭头前进' },
    ],
  })
  const text = lines.join(' | ')
  check('给出起火层', text.includes('4、5 楼'))
  check('给出未撤离人数', text.includes('62 人'))
  check('给出封控通道', text.includes('A1'))
  check('列出求助位置', text.includes('4 楼 C'))
  check('无数据时不崩', summarizeRescueBrief({}).length > 0)
  check('三个阶段都有提示词', ['prevention', 'response', 'aftermath'].every((phase) => buildPhaseMessages(phase, {}).length === 2))
  check('阶段元数据齐全', Object.values(AI_PHASES).every((phase) => phase.label && phase.goal))
}

console.log('[4] 阶段三：生命体征扫描')
{
  const frame = createAfterFireFrame()
  check('灾后帧尺寸为 32×24', frame.width === 32 && frame.height === 24 && frame.temperatures.length === 768)
  check('灾后帧含余温与人体温度', frame.maxTemp > 40 && frame.minTemp >= 28)

  const result = scanVitalSigns(frame)
  check('扫描成功', result.ok === true)
  check('环境基准接近室温 30°C', Math.abs(result.ambient - 30) < 3, `${result.ambient}`)
  check('找到候选生命体征', result.candidates.length >= 2, `${result.candidates.length}`)
  check('候选温度落在人体带内', result.candidates.every((item) => item.meanTemp >= 33 && item.meanTemp <= 42))
  check('候选与环境有反差', result.candidates.every((item) => item.contrast >= 3))
  check('置信度在 0–1 之间', result.candidates.every((item) => item.confidence > 0 && item.confidence <= 1))
  check('按置信度排序', result.candidates.every((item, index, list) => index === 0 || list[index - 1].confidence >= item.confidence))

  const described = describeVitalSigns(result, { floor: 4 })
  check('结论里带楼层与数量', described.summary.includes('4 楼') && described.summary.includes('处疑似生命体征'))
  check('给出优先排查顺序', described.priority.length > 0)
  check('提示必须人工复核', described.caution.includes('人工'))

  const empty = scanVitalSigns({ width: 4, height: 4, temperatures: new Array(16).fill(29) })
  check('没有候选时给出继续搜索建议', empty.candidates.length === 0 && describeVitalSigns(empty).action.includes('复扫'))
  check('矩阵尺寸不符时安全返回', scanVitalSigns({ width: 8, height: 8, temperatures: [1, 2, 3] }).ok === false)

  const hotOnly = scanVitalSigns({ width: 6, height: 6, temperatures: [...new Array(18).fill(29), ...new Array(18).fill(120)] })
  check('火场余温被排除，不算生命体征', hotOnly.candidates.length === 0 && hotOnly.burnedCells === 18)
  check('环境基准用分位数，不被余温带高', ambientBaseline([...new Array(36).fill(29), 400]) < 35)

  // 一大片 36–38°C 的热区（例如暖气、余温墙）不能当成一群人
  const warmWall = new Array(64).fill(30)
  for (let index = 0; index < 24; index += 1) warmWall[index] = 37
  const wallScan = scanVitalSigns({ width: 8, height: 8, temperatures: warmWall })
  check('大片暖区按余温处理，不算生命体征', wallScan.candidates.length === 0 && wallScan.warmAreaCells > 0, JSON.stringify(wallScan))
  check('人体级小团块仍能报出', scanVitalSigns(frame).candidates.every((item) => item.cells <= 46))
  check('候选面积都远小于整幅画', scanVitalSigns(frame).candidates.every((item) => item.cells < frame.width * frame.height * 0.06))
}

console.log(`\n结果：${failures === 0 ? '全部通过' : `${failures} 项失败`}`)
process.exit(failures === 0 ? 0 : 1)
