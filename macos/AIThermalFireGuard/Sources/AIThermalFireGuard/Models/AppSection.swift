import SwiftUI

enum AppSection: String, CaseIterable, Identifiable {
    case dashboard
    case monitor
    case evacuation
    case hardware
    case equipment
    case alerts

    var id: String { rawValue }

    var title: String {
        switch self {
        case .dashboard: "首页检测"
        case .monitor: "3D热感监控"
        case .evacuation: "疏散导航"
        case .hardware: "硬件连接"
        case .equipment: "实验设备"
        case .alerts: "预警记录"
        }
    }

    var subtitle: String {
        switch self {
        case .dashboard: "超早期温度预警与智能判断"
        case .monitor: "空间热源重建与实时监控"
        case .evacuation: "指南针与安全出口路线"
        case .hardware: "串口与 Wi-Fi 数据接入"
        case .equipment: "采购清单与接线方案"
        case .alerts: "高温事件与处置记录"
        }
    }

    var icon: String {
        switch self {
        case .dashboard: "rectangle.3.group"
        case .monitor: "rotate.3d"
        case .evacuation: "location.north.circle"
        case .hardware: "cable.connector"
        case .equipment: "shippingbox"
        case .alerts: "exclamationmark.triangle"
        }
    }
}
