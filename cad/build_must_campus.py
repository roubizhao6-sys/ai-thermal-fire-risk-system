from pathlib import Path
from build123d import Align, Box, Compound, Cylinder, Pos, export_step, export_stl

# 简化校园总平面，单位 mm。
# 该模型依据公开校园外观与地图资料做低多边形化重建，不是官方测绘模型。
OUT = Path(__file__).resolve().parents[1]
MODELS = OUT / "public" / "models"
MODELS.mkdir(parents=True, exist_ok=True)

parts = []

def building(name, width, depth, height, x, z, roof_height=1.2):
    body = Pos(x, z, height / 2) * Box(width, depth, height, align=(Align.CENTER, Align.CENTER, Align.CENTER))
    body.label = name
    parts.append(body)
    roof = Pos(x, z, height + roof_height / 2) * Box(width + 1.5, depth + 1.5, roof_height, align=(Align.CENTER, Align.CENTER, Align.CENTER))
    roof.label = f"{name}-roof"
    parts.append(roof)

# 地面与道路
ground = Pos(0, 0, -1) * Box(270, 190, 2, align=(Align.CENTER, Align.CENTER, Align.CENTER))
ground.label = "campus-ground"
parts.append(ground)
boulevard = Pos(0, 0, 0.2) * Box(24, 160, 0.4, align=(Align.CENTER, Align.CENTER, Align.CENTER))
boulevard.label = "central-boulevard"
parts.append(boulevard)
cross_road = Pos(0, 42, 0.2) * Box(230, 14, 0.4, align=(Align.CENTER, Align.CENTER, Align.CENTER))
cross_road.label = "cross-road"
parts.append(cross_road)

# 主要建筑
building("library", 68, 44, 35, 0, -28)
building("administration", 48, 37, 45, -74, -32)
building("teaching-a", 48, 31, 37, 71, -32)
building("teaching-b", 48, 31, 37, 71, 10)
building("laboratory", 55, 31, 39, 0, -70)
building("student-dormitory", 54, 32, 58, -78, 62)
building("university-hospital", 42, 32, 49, 80, -70)

# 运动场与人工湖
field = Pos(81, 61, 0.6) * Box(62, 42, 1.2, align=(Align.CENTER, Align.CENTER, Align.CENTER))
field.label = "sports-field"
parts.append(field)
lake = Pos(-36, 47, 0.5) * Cylinder(24, 1, align=(Align.CENTER, Align.CENTER, Align.CENTER))
lake.label = "lake"
parts.append(lake)

# 正门
for x in (-21, 21):
    pillar = Pos(x, 82, 18) * Box(5.5, 5.5, 36, align=(Align.CENTER, Align.CENTER, Align.CENTER))
    pillar.label = f"gate-pillar-{x}"
    parts.append(pillar)
gate = Pos(0, 82, 34.5) * Box(52, 6.5, 5, align=(Align.CENTER, Align.CENTER, Align.CENTER))
gate.label = "main-gate"
parts.append(gate)

# 热感节点底座，便于后续 CAD 标注和布点。
sensors = [(-74, -32, 48), (0, -28, 38), (71, -32, 41), (71, 10, 41), (0, -70, 43), (-78, 62, 62)]
for index, (x, z, y) in enumerate(sensors):
    sensor = Pos(x, z, y) * Box(4, 4, 3, align=(Align.CENTER, Align.CENTER, Align.CENTER))
    sensor.label = f"thermal-sensor-{index + 1}"
    parts.append(sensor)

campus = Compound(children=parts)
step_path = MODELS / "must-campus.step"
stl_path = MODELS / "must-campus.stl"
export_step(campus, step_path)
export_stl(campus, stl_path)
print(f"parts={len(parts)} volume_mm3={campus.volume:.0f}")
print(step_path)
print(stl_path)
