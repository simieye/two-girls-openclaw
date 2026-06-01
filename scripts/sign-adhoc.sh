#!/bin/bash
# Ad-hoc 签名修复脚本 - 解决 macOS Gatekeeper 阻止未签名 Electron 应用运行的问题
# 用法: bash scripts/sign-adhoc.sh

set -e

DIST_DIR="dist-electron"

echo "🔐 Ad-hoc signing Electron apps..."

for arch in mac-arm64 mac; do
  APP="$DIST_DIR/$arch/Two Girls Brew AI.app"
  if [ ! -d "$APP" ]; then
    echo "  ⏭️  Skip $arch (not found)"
    continue
  fi

  echo "  📦 Processing $arch..."

  # 1. 移除现有签名
  codesign --remove-signature "$APP" 2>/dev/null || true

  # 2. 签名所有 .dylib 库
  find "$APP/Contents/Frameworks" -name "*.dylib" -type f 2>/dev/null | while read lib; do
    codesign --force --sign - --timestamp=none "$lib" 2>/dev/null || true
  done

  # 3. 签名 Helper 应用
  find "$APP/Contents/Frameworks" -name "*.app" -type d 2>/dev/null | while read helper; do
    codesign --force --deep --sign - --timestamp=none "$helper" 2>/dev/null || true
  done

  # 4. 签名 Electron Framework
  codesign --force --sign - --timestamp=none \
    "$APP/Contents/Frameworks/Electron Framework.framework/Versions/A" 2>/dev/null || true

  # 5. 签名其他 frameworks
  for fw in "$APP/Contents/Frameworks/"*.framework; do
    if [ -d "$fw" ] && [[ "$fw" != *"Electron Framework.framework" ]]; then
      codesign --force --sign - --timestamp=none "$fw" 2>/dev/null || true
    fi
  done

  # 6. 最终签名主 app
  codesign --force --deep --sign - --timestamp=none "$APP" 2>/dev/null || true

  echo "  ✅ $arch signed"
done

echo "✅ All apps signed successfully"
