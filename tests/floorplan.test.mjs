// 逃生路线图纯逻辑单测：图内方位角、分步指令、按位置取当前步、朝向归一化。
// 这些计算决定「按路线图撤离」时箭头指向与每步文案是否正确。

import {
  applyPlanRecognition,
  buildPlanRecognitionPrompt,
  buildPlanRoute,
  currentStep,
  imageBearing,
  normalizeDeg,
  parsePlanRecognition,
} from '../src/user/floorplan.js'

let failures = 0
function check(name, condition, detail = '') {
  if (condition) console.log(`  PASS  ${name}`)
  else { failures += 1; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`) }
}
const close = (a, b, t) => Math.abs(a - b) <= t

console.log('[1] 图内方位角（图上方为北）')
{
  const origin = { x: 0.5, y: 0.5 }
  check('向上 = 0°', close(imageBearing(origin, { x: 0.5, y: 0.1 }), 0, 0.01))
  check('向右 = 90°', close(imageBearing(origin, { x: 0.9, y: 0.5 }), 90, 0.01))
  check('向下 = 180°', close(imageBearing(origin, { x: 0.5, y: 0.9 }), 180, 0.01))
  check('向左 = 270°', close(imageBearing(origin, { x: 0.1, y: 0.5 }), 270, 0.01))
  check('角度归一化到 0–360', normalizeDeg(-30) === 330 && normalizeDeg(390) === 30)
}

console.log('[2] 分步指令与距离')
{
  const straight = buildPlanRoute({
    name: '直线测试',
    widthMeters: 50,
    start: { x: 0.5, y: 0.9 },
    exit: { x: 0.5, y: 0.1 },
  })
  check('只走一条直线时给一条指令', straight.instructions.length === 1)
  check('距离按图宽换算（0.8 × 50 = 40 米）', close(straight.totalMeters, 40, 0.5), `${straight.totalMeters}`)
  check('首步文案为直行', straight.instructions[0].text.startsWith('直行'), straight.instructions[0].text)

  const bend = buildPlanRoute({
    name: '拐弯测试',
    widthMeters: 40,
    start: { x: 0.1, y: 0.5 },
    waypoints: [{ x: 0.5, y: 0.5 }],
    exit: { x: 0.5, y: 0.1 },
  })
  check('拐弯路线给两条指令', bend.instructions.length === 2)
  check('第二条指令提示转向', /向右转|向左转/.test(bend.instructions[1].text), bend.instructions[1].text)
  check('总距离等于两段之和', close(bend.totalMeters, bend.instructions[0].meters + bend.instructions[1].meters, 0.01))
  check('出口标签使用自定义名称', buildPlanRoute({ exitLabel: '南门', exit: { x: 0.5, y: 0.1 } }).exitLabel === '南门')
}

console.log('[3] 按当前位置取当前步')
{
  const route = buildPlanRoute({
    widthMeters: 50,
    start: { x: 0.1, y: 0.5 },
    waypoints: [{ x: 0.5, y: 0.5 }],
    exit: { x: 0.5, y: 0.1 },
  })
  check('默认返回第一步', currentStep(route, null).index === 0)
  check('靠近第二段时返回第二步', currentStep(route, { x: 0.5, y: 0.2 }).index === 1)
  check('靠近起点时返回第一步', currentStep(route, { x: 0.12, y: 0.5 }).index === 0)
  check('空路线返回 null', currentStep(null, { x: 0, y: 0 }) === null)
}

console.log('[4] 朝向校正（图上方不是北时）')
{
  const plan = buildPlanRoute({
    widthMeters: 50,
    upBearing: 90, // 图上方为东
    start: { x: 0.5, y: 0.9 },
    exit: { x: 0.5, y: 0.1 },
  })
  check('罗盘方位 = 图内方位 + 校正角', close(plan.instructions[0].compassBearing, 90, 0.01), `${plan.instructions[0].compassBearing}`)
}

console.log('[5] 本地模型复核（AI 辅助）：提示词、回复解析、名称回填')
{
  const analysis = {
    exits: [{ x: 0.82, y: 0.5, area: 120 }, { x: 0.12, y: 0.48, area: 90 }],
    extinguishers: [{ x: 0.4, y: 0.6, area: 30 }],
  }
  const prompt = buildPlanRecognitionPrompt(analysis, { floor: 4, fireText: '4 楼东侧' })
  check('提示词里带上每个候选出口的编号与坐标', prompt.includes('1. 图内坐标 (0.82, 0.50)') && prompt.includes('2. 图内坐标 (0.12, 0.48)'))
  check('提示词要求只回 JSON', prompt.includes('只回答一个 JSON'))
  check('提示词带上楼层与火源', prompt.includes('4 楼') && prompt.includes('4 楼东侧'))

  const parsed = parsePlanRecognition('好的，结果如下：\n{"exitLabels":["东侧楼梯间","西侧楼梯间"],"recommendedExit":2,"rooms":["机房"],"corridor":"东西向主通道","notes":"东侧近火源，建议走西侧"}\n以上。')
  check('能从夹杂文字里取出 JSON', parsed?.exitLabels?.[0] === '东侧楼梯间')
  check('推荐出口按 0 基索引解析', parsed?.recommendedExit === 2)
  check('读不出的字段给空值', parsePlanRecognition('{"exitLabels":[]}')?.recommendedExit !== undefined)
  check('完全不是 JSON 时返回 null', parsePlanRecognition('抱歉我无法识别') === null)
  check('空输入返回 null', parsePlanRecognition('') === null)

  const merged = applyPlanRecognition(analysis, parsed)
  check('名称贴回候选出口', merged.exits[0].label === '东侧楼梯间' && merged.exits[1].label === '西侧楼梯间')
  check('位置仍用启发式坐标', merged.exits[0].x === 0.82)
  check('推荐索引越界时退回第一个出口', applyPlanRecognition(analysis, { exitLabels: ['A'], recommendedExit: 9 }).chosen.label === 'A')
  check('模型没给名字时保留默认名称', applyPlanRecognition(analysis, {}).exits[0].label === '候选出口 1')
}

console.log(`\n结果：${failures === 0 ? '全部通过' : `${failures} 项失败`}`)
process.exit(failures === 0 ? 0 : 1)
