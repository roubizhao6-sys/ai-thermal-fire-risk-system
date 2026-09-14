// 多节点温度联合定位单测：聚类是否正确、估计是否合理、低置信度是否退化稳健解
import { clusterReadings, estimateCluster, fuseReadings, graphDistances } from '../src/mobile/sensorFusion.js'

let failures = 0
const check = (name, condition, detail = '') => {
  if (condition) console.log(`  PASS  ${name}`)
  else {
    failures += 1
    console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`)
  }
}

console.log('\n[1] 图距离：楼梯上行比下行快（与烟气扩散模型一致）')
{
  const fromC4 = graphDistances('C4')
  check('自身距离为 0', fromC4.get('C4') === 0)
  check('同层到 A 楼梯 1 跳', Math.abs(fromC4.get('A4') - 1) < 1e-6, `${fromC4.get('A4')}`)
  check('同层到 B 楼梯 1 跳', Math.abs(fromC4.get('B4') - 1) < 1e-6, `${fromC4.get('B4')}`)
  check('上楼比下楼代价小', fromC4.get('A5') - fromC4.get('A3') < 0, `${fromC4.get('A5')} vs ${fromC4.get('A3')}`)
}

console.log('\n[2] 单个高温节点：一处火源，且以该节点为估计')
{
  const result = fuseReadings([{ nodeId: 'C4', temp: 88 }])
  check('只产生 1 处来源', result.sources.length === 1, `${result.sources.length}`)
  check('估计节点为该节点', result.sources[0].nodeId === 'C4', result.sources[0].nodeId)
  check('带置信度与不确定度', typeof result.sources[0].confidence === 'number' && typeof result.sources[0].uncertaintyHops === 'number')
}

console.log('\n[3] 同一火场被多个传感器看到：不该算成多处火源')
{
  const result = fuseReadings([
    { nodeId: 'C4', temp: 88 },
    { nodeId: 'A4', temp: 80 },
  ])
  check('合并为 1 处来源', result.sources.length === 1, JSON.stringify(result.sources.map((item) => item.nodeId)))
  check('记录了两个贡献节点', result.sources[0].contributors.length === 2, JSON.stringify(result.sources[0].contributors))
  check('估计落在团内', ['C4', 'A4'].includes(result.sources[0].nodeId), result.sources[0].nodeId)
}

console.log('\n[4] 相隔较远的两处火场：必须分成两处')
{
  const result = fuseReadings([
    { nodeId: 'C4', temp: 88 },
    { nodeId: 'C7', temp: 90 },
  ])
  check('识别为 2 处来源', result.sources.length === 2, JSON.stringify(result.sources.map((item) => item.nodeId)))
  check('两处分别覆盖 4 楼与 7 楼', result.sources.some((item) => item.nodeId.endsWith('4')) && result.sources.some((item) => item.nodeId.endsWith('7')))
}

console.log('\n[5] 只给楼层的读数也能定位到该层走廊')
{
  const result = fuseReadings([{ floor: 6, temp: 90 }])
  check('落到 6 楼走廊', result.sources.length === 1 && result.sources[0].nodeId === 'C6', JSON.stringify(result.sources.map((item) => item.nodeId)))
}

console.log('\n[6] 阈值过滤：中温只观察、不报警')
{
  const result = fuseReadings([
    { nodeId: 'C4', temp: 88 },
    { nodeId: 'C5', temp: 50 },
  ])
  check('仅高温节点成为火源', result.sources.length === 1, `${result.sources.length}`)
  check('中温节点进入观察列表', result.watch.some((item) => item.nodeId === 'C5'), JSON.stringify(result.watch.map((item) => item.nodeId)))
  check('全部为中温时不产生火源', fuseReadings([{ nodeId: 'C4', temp: 50 }, { nodeId: 'C5', temp: 48 }]).sources.length === 0)
}

console.log('\n[7] 非法读数必须被忽略')
{
  const result = fuseReadings([
    { nodeId: 'Z9', temp: 99 },
    { nodeId: 'C4', temp: '很高' },
    { nodeId: 'C5' },
    { nodeId: 'C5', temp: 91 },
  ])
  check('只剩合法读数', result.sources.length === 1 && result.sources[0].nodeId === 'C5', JSON.stringify(result.sources.map((item) => item.nodeId)))
}

console.log('\n[8] 不变式：所有高温节点都必须被覆盖（估计节点或贡献节点）')
{
  const readings = [
    { nodeId: 'C4', temp: 88 },
    { nodeId: 'C5', temp: 70 },
    { nodeId: 'A6', temp: 66 },
    { nodeId: 'C7', temp: 92 },
  ]
  const result = fuseReadings(readings)
  const covered = new Set()
  result.sources.forEach((source) => {
    covered.add(source.nodeId)
    source.contributors.forEach((id) => covered.add(id))
  })
  const hot = readings.map((item) => item.nodeId)
  check('每个高温节点都被覆盖', hot.every((id) => covered.has(id)), [...covered].join(','))

  const { clusters } = clusterReadings(readings)
  const clusterCovered = new Set(clusters.flat().map((item) => item.nodeId))
  check('聚类不丢节点', hot.every((id) => clusterCovered.has(id)), [...clusterCovered].join(','))
}

console.log('\n[9] 低置信度：退化为稳健解（团内节点都作为可能火源）')
{
  const { clusters } = clusterReadings([{ nodeId: 'C4', temp: 70 }, { nodeId: 'A4', temp: 69 }])
  const estimate = estimateCluster(clusters[0], { confidenceFloor: 0.9 })
  check('估计本身仍然给出单一节点', Boolean(estimate.nodeId), JSON.stringify(estimate))
  const robust = fuseReadings([{ nodeId: 'C4', temp: 70 }, { nodeId: 'A4', temp: 69 }], { confidenceFloor: 0.99 })
  check('把门槛提到 0.99 时给出稳健解并标记', robust.sources.length >= 1 && robust.sources.every((item) => item.robust), JSON.stringify(robust.sources.map((item) => `${item.nodeId}:${item.robust}`)))
}

console.log(`\n结果：${failures === 0 ? '全部通过' : `${failures} 项失败`}`)
process.exit(failures === 0 ? 0 : 1)
