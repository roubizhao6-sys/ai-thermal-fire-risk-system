#!/usr/bin/env bash
set -euo pipefail

APP_NAME="AIThermalFireGuard"
VERSION="1.0.5"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/build/distribution"
DERIVED_DIR="$BUILD_DIR/DerivedData"
STAGE_DIR="$BUILD_DIR/dmg-stage"
DIST_DIR="$ROOT_DIR/dist"
APP_PATH="$DERIVED_DIR/Build/Products/Release/$APP_NAME.app"
DMG_PATH="$DIST_DIR/$APP_NAME-macOS-$VERSION.dmg"
ZIP_PATH="$DIST_DIR/$APP_NAME-macOS-$VERSION.zip"
ENTITLEMENTS="$ROOT_DIR/AppStore/AIThermalFireGuard-Direct.entitlements"

mkdir -p "$BUILD_DIR" "$DIST_DIR"

xcodebuild \
  -project "$ROOT_DIR/AIThermalFireGuard.xcodeproj" \
  -scheme "$APP_NAME" \
  -configuration Release \
  -destination 'generic/platform=macOS' \
  -derivedDataPath "$DERIVED_DIR" \
  ARCHS='arm64 x86_64' \
  ONLY_ACTIVE_ARCH=NO \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGN_IDENTITY='' \
  CODE_SIGN_ENTITLEMENTS="$ENTITLEMENTS" \
  SWIFT_ACTIVE_COMPILATION_CONDITIONS='' \
  build

/usr/bin/codesign \
  --force \
  --deep \
  --options runtime \
  --sign - \
  --entitlements "$ENTITLEMENTS" \
  "$APP_PATH"

python3 - "$STAGE_DIR" <<'PY'
import shutil, sys
from pathlib import Path
p = Path(sys.argv[1])
if p.exists():
    shutil.rmtree(p)
p.mkdir(parents=True)
PY

/usr/bin/ditto "$APP_PATH" "$STAGE_DIR/$APP_NAME.app"
ln -s /Applications "$STAGE_DIR/Applications"
cp -R "$ROOT_DIR/firmware" "$STAGE_DIR/实验固件"
cat > "$STAGE_DIR/安装说明.txt" <<'TXT'
AI热感火警风险检测系统 macOS App 安装说明

1. 将 AIThermalFireGuard.app 拖入 Applications（应用程序）文件夹。
2. 首次打开时，请右键点击 App，选择“打开”。
3. 如果仍被拦截，请打开：
   系统设置 → 隐私与安全性 → 仍要打开。
4. 系统要求：macOS 14 或更高版本。
5. App 默认启动模拟器，无需硬件即可体验。
6. ESP32 USB 串口和 Wi-Fi WebSocket 使用说明见“实验固件”文件夹。

注意：本 App 使用本地临时签名，未经过 Apple Developer ID 公证。
请仅从项目官方 GitHub Release 下载。

本系统为科研演示原型，不替代专业消防检测设备。
TXT

python3 - "$DMG_PATH" "$ZIP_PATH" <<'PY'
from pathlib import Path
import sys
for name in sys.argv[1:]:
    p = Path(name)
    if p.exists():
        p.unlink()
PY

/usr/bin/hdiutil create \
  -volname "AI热感火警风险检测" \
  -srcfolder "$STAGE_DIR" \
  -ov \
  -format UDZO \
  "$DMG_PATH"

/usr/bin/ditto \
  -c -k --sequesterRsrc --keepParent \
  "$APP_PATH" \
  "$ZIP_PATH"

cd "$DIST_DIR"
/usr/bin/shasum -a 256 "$(basename "$DMG_PATH")" "$(basename "$ZIP_PATH")" > SHA256.txt
file "$APP_PATH/Contents/MacOS/$APP_NAME"
/usr/bin/lipo -info "$APP_PATH/Contents/MacOS/$APP_NAME"
/usr/bin/codesign --verify --deep --strict --verbose=2 "$APP_PATH"
ls -lh "$DMG_PATH" "$ZIP_PATH" "$DIST_DIR/SHA256.txt"
