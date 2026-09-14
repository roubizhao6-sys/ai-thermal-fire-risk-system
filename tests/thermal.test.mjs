import { createFrame, normalizePacket, riskFromMaxTemp, DEFAULT_THRESHOLDS } from '../src/mobile/thermal.js'

let failures = 0
const check = (name, condition, detail = '') => {
  if (condition) console.log(`  PASS  ${name}`)
  else {
    failures += 1
    console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`)
  }
}

console.log('\n[1] 正常运行工况：不应触发报警')
{
  const frame = createFrame(0, 'normal')
  check('风险为低', frame.risk === 'low', frame.risk)
  check('最高温低于中风险阈值', frame.maxTemp < DEFAULT_THRESHOLDS.medium, frame.maxTemp.toFixed(1))
  check('无热区框选', frame.hotspots.length === 0, `${frame.hotspots.length}`)
  check('数据源标注工况', frame.source.includes('正常运行'), frame.source)
  console.log(`        max=${frame.maxTemp.toFixed(1)}°C min=${frame.minTemp.toFixed(1)}°C 热区=${frame.hotspots.length}`)
}

console.log('\n[2] 缓慢升温工况：应按时间穿越三级风险')
{
  const risks = [0, 10, 20, 30, 45, 80].map((phase) => createFrame(phase, 'warming').risk)
  check('起始为低风险', risks[0] === 'low', risks.join(','))
  check('中途出现中风险', risks.includes('medium'), risks.join(','))
  check('最终升到高风险', risks[risks.length - 1] === 'high', risks.join(','))
  check('风险单调不降', risks.every((risk, index) => index === 0 || ['low', 'medium', 'high'].indexOf(risk) >= ['low', 'medium', 'high'].indexOf(risks[index - 1])), risks.join(','))
  console.log(`        phase 0/10/20/30/45/80 -> ${risks.join(' / ')}`)
}

console.log('\n[3] 高温火情工况：维持高风险并检出多个热区')
{
  const frame = createFrame(10, 'fire')
  const original = createFrame(10, 'fire')
  check('风险为高', frame.risk === 'high', frame.risk)
  check('最高温接近原始模拟值 90°C', frame.maxTemp > 80 && frame.maxTemp < 100, frame.maxTemp.toFixed(1))
  check('检出 2-3 个热区', frame.hotspots.length >= 2 && frame.hotspots.length <= 3, `${frame.hotspots.length}`)
  check('热区温度均高于阈值', frame.hotspots.every((spot) => spot.temp > 60), JSON.stringify(frame.hotspots.map((s) => Math.round(s.temp))))
  check('热区框在画面内', frame.hotspots.every((spot) => spot.x >= 0 && spot.y >= 0 && spot.x + spot.w <= 100 && spot.y + spot.h <= 100), JSON.stringify(frame.hotspots))
  check('同一工况温度可复现', Math.abs(frame.maxTemp - original.maxTemp) < 0.001)
  console.log(`        max=${frame.maxTemp.toFixed(1)}°C 热区=${frame.hotspots.length}`)
}

console.log('\n[4] 阈值可配置')
{
  check('65°C 判为高风险', riskFromMaxTemp(65) === 'high')
  check('50°C 判为中风险', riskFromMaxTemp(50) === 'medium')
  check('30°C 判为低风险', riskFromMaxTemp(30) === 'low')
  check('提高阈值后 60°C 降级为中风险', riskFromMaxTemp(60, { high: 75, medium: 40 }) === 'medium')
  check('降低阈值后 60°C 升为高风险', riskFromMaxTemp(60, { high: 55, medium: 40 }) === 'high')
}

console.log('\n[5] ESP32 数据包解析')
{
  const packet = {
    width: 4,
    height: 3,
    temperatures: [30, 31, 32, 33, 40, 45, 50, 55, 60, 70, 80, 90],
    hotspots: [{ x: 0.2, y: 0.3, width: 0.15, height: 0.2, temp: 90 }],
  }
  const frame = normalizePacket(packet)
  check('尺寸解析正确', frame.width === 4 && frame.height === 3)
  check('最高温取矩阵最大值', frame.maxTemp === 90, `${frame.maxTemp}`)
  check('热区坐标转换为百分比', frame.hotspots[0].x === 20 && frame.hotspots[0].w === 15, JSON.stringify(frame.hotspots[0]))
  check('风险为高', frame.risk === 'high')

  const broken = normalizePacket({ width: 4, height: 3, temperatures: [1, 2] })
  check('非法数据回退到模拟矩阵', broken.temperatures.length === 32 * 24, `${broken.temperatures.length}`)
}

console.log(`\n结果：${failures === 0 ? '全部通过' : `${failures} 项失败`}`)
process.exit(failures === 0 ? 0 : 1)
