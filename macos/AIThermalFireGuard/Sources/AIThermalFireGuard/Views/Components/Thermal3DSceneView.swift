import SceneKit
import SwiftUI

struct Thermal3DSceneView: NSViewRepresentable {
    let frame: ThermalFrame

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeNSView(context: Context) -> SCNView {
        let view = SCNView()
        let scene = SCNScene()
        view.scene = scene
        view.backgroundColor = NSColor(red: 0.008, green: 0.025, blue: 0.055, alpha: 1)
        view.allowsCameraControl = true
        view.autoenablesDefaultLighting = false
        view.antialiasingMode = .multisampling4X
        view.preferredFramesPerSecond = 30
        view.rendersContinuously = true
        context.coordinator.configure(scene: scene)
        context.coordinator.update(frame: frame, scene: scene)
        return view
    }

    func updateNSView(_ nsView: SCNView, context: Context) {
        guard let scene = nsView.scene else { return }
        context.coordinator.update(frame: frame, scene: scene)
    }

    final class Coordinator {
        private let hotspotRoot = SCNNode()
        private let scanNode = SCNNode()
        private let heatLight = SCNLight()
        private let heatLightNode = SCNNode()

        func configure(scene: SCNScene) {
            scene.background.contents = NSColor(red: 0.008, green: 0.025, blue: 0.055, alpha: 1)
            scene.rootNode.addChildNode(makeCamera())
            scene.rootNode.addChildNode(makeFloor())
            scene.rootNode.addChildNode(makeRoom())
            scene.rootNode.addChildNode(makeSensor())

            scanNode.geometry = SCNPlane(width: 10, height: 6.4)
            scanNode.eulerAngles.x = -.pi / 2
            scanNode.position = SCNVector3(0, 0.08, 0)
            let scanMaterial = SCNMaterial()
            scanMaterial.diffuse.contents = NSColor(calibratedRed: 0.12, green: 0.72, blue: 1, alpha: 0.18)
            scanMaterial.emission.contents = NSColor(calibratedRed: 0.12, green: 0.72, blue: 1, alpha: 0.48)
            scanMaterial.isDoubleSided = true
            scanMaterial.transparency = 0.55
            scanNode.geometry?.materials = [scanMaterial]
            scene.rootNode.addChildNode(scanNode)

            hotspotRoot.name = "hotspots"
            scene.rootNode.addChildNode(hotspotRoot)

            heatLight.type = .omni
            heatLight.color = NSColor.orange
            heatLight.intensity = 0
            heatLight.attenuationStartDistance = 1
            heatLight.attenuationEndDistance = 10
            heatLightNode.light = heatLight
            heatLightNode.position = SCNVector3(0, 2.2, 0)
            heatLightNode.name = "heatLight"
            scene.rootNode.addChildNode(heatLightNode)
        }

        func update(frame: ThermalFrame, scene: SCNScene) {
            let timestamp = frame.timestamp.timeIntervalSinceReferenceDate
            scanNode.position.z = CGFloat(sin(timestamp * 0.22) * 2.2)
            scanNode.opacity = 0.58 + CGFloat((sin(timestamp * 1.3) + 1) * 0.14)

            hotspotRoot.childNodes.forEach { $0.removeFromParentNode() }
            for (index, hotspot) in frame.hotspots.prefix(6).enumerated() {
                let normalized = max(0, min((hotspot.temperature - 35) / 55, 1))
                let radius = CGFloat(0.22 + normalized * 0.26)
                let sphere = SCNSphere(radius: radius)
                let color = NSColor(calibratedRed: 1, green: CGFloat(0.32 + normalized * 0.28), blue: 0.08, alpha: 1)
                let material = SCNMaterial()
                material.diffuse.contents = color
                material.emission.contents = color.withAlphaComponent(0.85)
                material.transparency = 0.88
                sphere.materials = [material]

                let node = SCNNode(geometry: sphere)
                node.position = SCNVector3(
                    (CGFloat(hotspot.x / 100) - 0.5) * 8.4,
                    CGFloat(0.32 + normalized * 0.7),
                    -(CGFloat((hotspot.y - 45) / 100) * 4.5)
                )
                hotspotRoot.addChildNode(node)

                let ring = SCNTorus(ringRadius: radius * 1.45, pipeRadius: 0.028)
                let ringMaterial = SCNMaterial()
                ringMaterial.diffuse.contents = color
                ringMaterial.emission.contents = color
                ring.materials = [ringMaterial]
                let ringNode = SCNNode(geometry: ring)
                ringNode.position = node.position
                ringNode.eulerAngles.x = -.pi / 2
                ringNode.opacity = 0.64
                hotspotRoot.addChildNode(ringNode)

                if index == 0 {
                    heatLight.intensity = CGFloat(520 + normalized * 1100)
                    heatLightNode.position = node.position
                }
            }
        }

        private func makeCamera() -> SCNNode {
            let camera = SCNCamera()
            camera.fieldOfView = 54
            camera.zNear = 0.1
            camera.zFar = 100
            camera.wantsHDR = true
            camera.bloomIntensity = 0.65
            camera.bloomThreshold = 0.65
            camera.vignettingIntensity = 0.28

            let node = SCNNode()
            node.camera = camera
            node.position = SCNVector3(7.2, 5.1, 8.4)
            node.eulerAngles = SCNVector3(-0.58, 0.7, 0.08)
            return node
        }

        private func makeFloor() -> SCNNode {
            let floor = SCNPlane(width: 11, height: 7.2)
            let material = SCNMaterial()
            material.diffuse.contents = NSColor(calibratedRed: 0.025, green: 0.09, blue: 0.16, alpha: 1)
            material.emission.contents = NSColor(calibratedRed: 0.03, green: 0.16, blue: 0.28, alpha: 0.34)
            floor.materials = [material]

            let node = SCNNode(geometry: floor)
            node.eulerAngles.x = -.pi / 2
            node.position.y = -0.03

            let gridColor = NSColor(calibratedRed: 0.08, green: 0.48, blue: 0.78, alpha: 0.34)
            for index in -5...5 {
                let xLine = SCNBox(width: 0.016, height: 0.012, length: 7.2, chamferRadius: 0)
                xLine.materials = [makeMaterial(color: gridColor)]
                let xNode = SCNNode(geometry: xLine)
                xNode.position = SCNVector3(CGFloat(index), 0.01, 0)
                node.addChildNode(xNode)
            }
            for index in -3...3 {
                let zLine = SCNBox(width: 11, height: 0.012, length: 0.016, chamferRadius: 0)
                zLine.materials = [makeMaterial(color: gridColor)]
                let zNode = SCNNode(geometry: zLine)
                zNode.position = SCNVector3(0, 0.01, CGFloat(index))
                node.addChildNode(zNode)
            }
            return node
        }

        private func makeRoom() -> SCNNode {
            let root = SCNNode()
            let wallColor = NSColor(calibratedRed: 0.04, green: 0.22, blue: 0.38, alpha: 0.26)

            let backWall = SCNBox(width: 11, height: 5, length: 0.08, chamferRadius: 0.02)
            backWall.materials = [makeMaterial(color: wallColor)]
            let backNode = SCNNode(geometry: backWall)
            backNode.position = SCNVector3(0, 2.5, -3.6)
            root.addChildNode(backNode)

            for side in [-1.0, 1.0] {
                let wall = SCNBox(width: 0.08, height: 5, length: 7.2, chamferRadius: 0.02)
                wall.materials = [makeMaterial(color: wallColor)]
                let node = SCNNode(geometry: wall)
                node.position = SCNVector3(CGFloat(side) * 5.5, 2.5, 0)
                root.addChildNode(node)
            }
            return root
        }

        private func makeSensor() -> SCNNode {
            let root = SCNNode()
            let sensor = SCNBox(width: 0.68, height: 0.28, length: 0.44, chamferRadius: 0.08)
            let sensorMaterial = SCNMaterial()
            sensorMaterial.diffuse.contents = NSColor(calibratedRed: 0.10, green: 0.72, blue: 1, alpha: 1)
            sensorMaterial.emission.contents = NSColor(calibratedRed: 0.16, green: 0.78, blue: 1, alpha: 0.78)
            sensor.materials = [sensorMaterial]
            root.geometry = sensor
            root.position = SCNVector3(0, 4.35, -3.1)
            root.eulerAngles.x = 0.32

            let cone = SCNCone(topRadius: 0.06, bottomRadius: 1.48, height: 3.35)
            let coneMaterial = SCNMaterial()
            coneMaterial.diffuse.contents = NSColor(calibratedRed: 0.06, green: 0.65, blue: 0.92, alpha: 0.11)
            coneMaterial.emission.contents = NSColor(calibratedRed: 0.06, green: 0.65, blue: 0.92, alpha: 0.16)
            coneMaterial.transparency = 0.32
            coneMaterial.isDoubleSided = true
            cone.materials = [coneMaterial]
            let coneNode = SCNNode(geometry: cone)
            coneNode.position = SCNVector3(0, -1.7, 0.3)
            coneNode.eulerAngles.x = .pi
            root.addChildNode(coneNode)
            return root
        }

        private func makeMaterial(color: NSColor) -> SCNMaterial {
            let material = SCNMaterial()
            material.diffuse.contents = color
            material.emission.contents = color.withAlphaComponent(0.19)
            material.isDoubleSided = true
            return material
        }
    }
}
