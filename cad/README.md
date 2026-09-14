# 澳门科技大学简化校园 CAD 模型

该目录使用 build123d 生成澳门科技大学校园的低多边形简化几何，用于科研和竞赛演示，不是官方测绘模型。

## 建模范围

- 校园地面、主干道和道路
- 正门和门楼
- 图书馆、行政楼、教学楼 A/B、实验室
- 学生宿舍、科大医院
- 运动场、人工湖
- 热感传感器预留底座

## 导出文件

- `public/models/must-campus.step`：CAD 交换格式，适合 SolidWorks、Fusion 360、FreeCAD。
- `public/models/must-campus.stl`：三角网格格式，适合 3D 打印和网格软件。

## 重新生成

```bash
uv run --python 3.12 --with build123d python cad/build_must_campus.py
```

简化坐标单位为毫米，校园总平面约 270 m × 190 m。

## 素材说明

校园实景背景采用 Wikimedia Commons「An aerial view of MUST」作者 Winslowchen，许可 CC BY-SA 3.0；校园参考图采用「Macau University of Science and Technology」作者 Bill9999360，许可 CC BY-SA 4.0。三维几何为原创低多边形重建。
