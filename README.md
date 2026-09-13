# AI热感火警风险检测系统

基于热成像与计算机视觉的早期火灾预警科研演示原型。

## 在线访问

网站通过 GitHub Pages 自动发布：

https://roubizhao6-sys.github.io/ai-thermal-fire-risk-system/

## 功能

- 热成像图片上传、拖拽与本地预览
- 模拟 AI 检测加载与进度反馈
- 低、中、高风险三级预警
- 高温疑似区域框选与温度估算
- 检测数据统计、趋势图与风险分布
- 桌面端与移动端响应式适配

## 本地运行

```bash
pnpm install
pnpm dev
```

生产构建：

```bash
pnpm build
```

> 本系统为科研演示原型，不替代专业消防检测设备。
