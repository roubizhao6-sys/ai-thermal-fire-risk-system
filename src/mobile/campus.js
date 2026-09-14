// 澳门科技大学（MUST）校园微缩模型数据
//
// 说明：这是**按公开资料做的示意模型**，不是测绘级还原。
// 依据：学校位于澳门凼仔岛，校内有多座教学大楼与教学实验室，综合教学大楼内含演艺厅、
// 电影院与多种体育设施，另有图书馆、科大医院、中药质量研究国家重点实验室、
// 月球与行星科学国家重点实验室、学生宿舍区等。
// 坐标单位≈米，x 向东、z 向南（与 building.js 一致），y 为高度。

export const CAMPUS_FLOOR_HEIGHT = 7 // 每层高度（模型单位）

// style 决定外立面配色（见 Campus3D.jsx 的材质表）
export const CAMPUS_BUILDINGS = [
  { id: 'teaching', name: '综合教学大楼', short: '教学主楼', letter: 'C', x: 0, z: -110, w: 130, d: 44, floors: 9, style: 'glass', note: '含演艺厅 / 电影院 / 教室 / 实验室' },
  { id: 'library', name: '图书馆', short: '图书馆', letter: 'A', x: -120, z: 10, w: 74, d: 56, floors: 6, style: 'warm', note: '馆藏文献资源总量超 900 万种' },
  { id: 'hospital', name: '科大医院', short: '科大医院', letter: 'B', x: 128, z: 20, w: 62, d: 48, floors: 8, style: 'clean', note: '中医临床服务 / 教学 / 科研' },
  { id: 'lab-tcm', name: '中药质量研究国家重点实验室', short: '中药国家实验室', letter: 'D', x: -62, z: -58, w: 48, d: 36, floors: 5, style: 'lab', note: '国家重点实验室' },
  { id: 'lab-space', name: '月球与行星科学国家重点实验室', short: '月球行星实验室', letter: 'E', x: 68, z: -56, w: 48, d: 36, floors: 5, style: 'lab', note: '国家重点实验室' },
  { id: 'admin', name: '行政楼', short: '行政楼', letter: 'F', x: 0, z: 62, w: 58, d: 30, floors: 6, style: 'office', note: '校务与招生' },
  { id: 'dorm-a', name: '学生宿舍 A 座', short: '宿舍 A', letter: 'G', x: -152, z: 138, w: 34, d: 86, floors: 12, style: 'dorm', note: '24 小时保安与医疗支持' },
  { id: 'dorm-b', name: '学生宿舍 B 座', short: '宿舍 B', letter: 'H', x: 152, z: 138, w: 34, d: 86, floors: 12, style: 'dorm', note: '24 小时保安与医疗支持' },
  { id: 'gym', name: '体育馆', short: '体育馆', letter: 'J', x: -128, z: -128, w: 86, d: 62, floors: 3, style: 'sport', note: '篮球 / 排球 / 网球 / 羽毛球' },
  { id: 'dining', name: '学生中心与食堂', short: '学生中心', letter: 'K', x: 126, z: -126, w: 64, d: 52, floors: 3, style: 'warm', note: '餐饮与学生活动' },
]

// 校园环境装饰（路、广场、绿化、校门）
export const CAMPUS_DECOR = {
  plaza: { x: 0, z: 0, radius: 46 },
  gate: { x: 0, z: 178, w: 46, d: 10 },
  roads: [
    { x: 0, z: 0, w: 26, d: 360 }, // 南北主轴
    { x: 0, z: 0, w: 340, d: 22 }, // 东西横轴
    { x: -120, z: 70, w: 22, d: 150 },
    { x: 126, z: 74, w: 22, d: 150 },
  ],
  trees: [
    { x: -78, z: 96 }, { x: 78, z: 96 }, { x: -170, z: 40 }, { x: 172, z: 46 },
    { x: -40, z: -150 }, { x: 42, z: -152 }, { x: -96, z: -66 }, { x: 100, z: -64 },
    { x: -60, z: 30 }, { x: 62, z: 34 }, { x: -176, z: -60 }, { x: 178, z: -58 },
  ],
}

export const CAMPUS_BY_ID = Object.fromEntries(CAMPUS_BUILDINGS.map((item) => [item.id, item]))

// 把楼盘节点（如 'C4'）映射到校园里的建筑与楼层：
//   A（A 梯）→ 图书馆、B（B 梯）→ 科大医院、C（走廊）→ 综合教学大楼
// 这样系统端/用户端判定出的"哪一层起火"能直接落到校园模型的对应楼层上。
const SPOT_TO_BUILDING = { A: 'library', B: 'hospital', C: 'teaching' }

export function campusLocationForNode(nodeId) {
  if (!nodeId || typeof nodeId !== 'string') return null
  const spot = nodeId[0]
  const floor = Number(nodeId.replace(/\D/g, ''))
  const buildingId = SPOT_TO_BUILDING[spot] ?? 'teaching'
  const building = CAMPUS_BY_ID[buildingId]
  if (!building) return null
  const safeFloor = Math.min(Math.max(floor || 1, 1), building.floors)
  return {
    buildingId,
    building,
    floor: safeFloor,
    label: `${building.name} ${safeFloor} 楼`,
    height: (safeFloor - 0.5) * CAMPUS_FLOOR_HEIGHT,
  }
}

export const SPOT_MAPPING_NOTE = '节点映射：C 走廊 → 综合教学大楼｜A 梯 → 图书馆｜B 梯 → 科大医院'
