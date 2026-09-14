import { useEffect, useMemo, useState } from 'react'
import { Building2, ExternalLink, Layers3, ShieldAlert } from 'lucide-react'

function floorZones(building, floor) {
  const text = `${building.name} ${building.type}`.toLowerCase()
  const top = floor >= building.floors
  if (text.includes('图书')) return top ? ['书库与档案区', '研讨室', '设备机房'] : ['大厅与服务台', '公共阅览区', '自修区与检索区']
  if (text.includes('宿舍')) return top ? ['宿舍房间', '晾晒与设备平台', '屋顶疏散区'] : ['门厅与宿管室', '公共洗衣房', '疏散楼梯与电梯厅']
  if (text.includes('医院')) return top ? ['住院病房', '医护站', '设备机房'] : ['急诊与挂号区', '门诊与检查室', '药房与候诊区']
  if (text.includes('体育') || text.includes('活動')) return top ? ['看台与器材区', '体测室', '设备间'] : ['综合运动场', '更衣室与淋浴间', '器材库与消防控制室']
  if (text.includes('行政')) return top ? ['行政办公室', '会议室', '档案与设备间'] : ['接待大厅', '值班与安保中心', '公共会议室']
  if (text.includes('会议')) return top ? ['报告厅与主舞台', '控制室', '休息区'] : ['会议大厅', '签到与接待区', '疏散通道']
  return top ? ['专业实验室', '研究中心', '设备与数据机房'] : ['共享大厅', '智慧教室', '教师办公室与疏散楼梯']
}

export default function CampusBuildingPanel() {
  const [buildings, setBuildings] = useState([])
  const [selectedCode, setSelectedCode] = useState('N')
  const [floor, setFloor] = useState(1)
  const selected = useMemo(() => buildings.find((item) => item.code === selectedCode) || buildings[0], [buildings, selectedCode])

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}models/must-campus-osm.json`)
      .then((response) => response.json())
      .then((data) => setBuildings(data.buildings || []))
      .catch(() => setBuildings([]))
  }, [])

  useEffect(() => {
    if (selected) setFloor(Math.min(floor, selected.floors))
  }, [selected, floor])

  if (!selected) return null

  return (
    <section className="mobile-card campus-building-panel">
      <div className="card-head">
        <div><strong>校园楼栋与楼层内部</strong><small>官网地图楼号 + 开放街图建筑轮廓 + 楼层功能示意</small></div>
        <Building2 size={18} />
      </div>
      <div className="campus-building-list">
        {buildings.map((building) => (
          <button type="button" className={building.code === selected.code ? 'active' : ''} key={building.osmId} onClick={() => { setSelectedCode(building.code); setFloor(1) }}>
            <b>{building.code}</b><span>{building.name}</span>
          </button>
        ))}
      </div>
      <div className="campus-building-detail">
        <div><span>{selected.code} 座</span><strong>{selected.name}</strong><small>{selected.type} · 约 {selected.floors} 层 · OSM {selected.osmId}</small></div>
        <a href="https://www.must.edu.mo/page/id-13635.html?locale=zh_MO" target="_blank" rel="noreferrer"><ExternalLink size={14} />官网地图</a>
      </div>
      <div className="campus-floor-tabs">
        {Array.from({ length: selected.floors }, (_, index) => index + 1).map((value) => (
          <button type="button" className={floor === value ? 'active' : ''} key={value} onClick={() => setFloor(value)}>{value}F</button>
        ))}
      </div>
      <div className="campus-floor-view">
        <div className="campus-floor-plan">
          <span className="floor-core">竖向交通核<br />楼梯 / 电梯</span>
          <i className="floor-corridor" />
          {floorZones(selected, floor).map((zone, index) => <span className={`floor-zone zone-${index + 1}`} key={zone}>{zone}</span>)}
        </div>
        <div className="campus-floor-legend"><Layers3 size={15} /><span>{selected.name} · {floor}F 内部功能示意</span></div>
      </div>
      <div className="campus-data-warning"><ShieldAlert size={14} />房间隔墙与设备点位为公开资料推断；精确到每个房间需导入学校官方平面图、BIM或现场扫描。</div>
    </section>
  )
}
