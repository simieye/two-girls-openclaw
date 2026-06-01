#!/bin/bash
# Ad-hoc 签名修复脚本 - 解决 macOS Gatekeeper 阻止和 Team ID 不匹配问题
# 核心修复：所有组件必须使用同一个签名身份（adhoc key chain）
# 用法: bash scripts/sign-adhoc.sh

set -e

DIST_DIR="dist-electron"

echo "🔐 Ad-hoc signing Electron apps (unified Team ID)..."

for arch in mac-arm64 mac; do
  APP="$DIST_DIR/$arch/Two Girls Brew AI.app"
  if [ ! -d "$APP" ]; then
    echo "  ⏭️  Skip $arch (not found)"
    continue
  fi

  echo "  📦 Processing $arch..."

  # 1. 移除所有现有签名
  codesign --remove-signature "$APP" 2>/dev/null || true

  # 定义统一签名参数（使用 "-" 作为 ad-hoc 身份，但保持一致）
  SIGN="--force --sign -"
  # 注意：codesign --sign - 每次调用会生成相同的 ad-hoc team ID (hash of "-")
  # 但在 macOS 26 上，关键是要确保签名链完整

  FRAMEWORKS="$APP/Contents/Frameworks"

  # 2. 签名所有 .dylib 库（最内层）
  find "$FRAMEWORKS" -name "*.dylib" -type f 2>/dev/null | sort | while read lib; do
    codesign $SIGN "$lib" 2>/dev/null || true
  done

  # 3. 签名非 Electron 的 frameworks
  for fw in "$FRAMEWORKS/"*.framework; do
    if [ -d "$fw" ] && [[ "$fw" != *"Electron Framework.framework" ]]; then
      # 先签 framework 内部的库
      find "$fw" -name "*.dylib" -type f 2>/dev/null | while read flib; do
        codesign $SIGN "$flib" 2>/dev/null || true
      done
      # 再签 framework 本身
      codesign $SIGN "$fw" 2>/dev/null || true
    fi
  done

  # 4. 签名 Electron Framework（先内部版本目录）
  EF="$FRAMEWORKS/Electron Framework.framework/Versions/A"
  if [ -d "$EF" ]; then
    # 签 Electron 内部 dylibs
    find "$EF" -name "*.dylib" -type f 2>/dev/null | while read elib; do
      codesign $SIGN "$elib" 2>/dev/null || true
    done
    # 签 Electron Framework 可执行文件
    codesign $SIGN "$EF" 2>/dev/null || true
  fi

  # 5. 签名 Helper apps（每个 helper 及其内部组件）
  for helper in "$FRAMEWORKS/Two Girls Brew AI Helper.app" \
                "$FRAMEWORKS/Two Girls Brew AI Helper (GPU).app" \
                "$FRAMEWORKS/Two Girls Brew AI Helper (Renderer).app" \
                "$FRAMEWORKS/Two Girls Brew AI Helper (Plugin).app"; do
    if [ -d "$helper" ]; then
      # Helper 内部 dylibs
      find "$helper" -name "*.dylib" -type f 2>/dev/null | while read hlib; do
        codesign $SIGN "$hlib" 2>/dev/null || true
      done
      # Helper 内部 frameworks
      find "$helper" -name "*.framework" -type d 2>/dev/null | while read hfw; do
        codesign $SIGN "$hfw" 2>/dev/null || true
      done
      # Helper 本身
      codesign $SIGN "$helper" 2>/dev/null || true
    fi
  done

  # 6. 最终签名主 app
  codesign $SIGN "$APP" 2>&1

  echo "  ✅ $arch signed"
done

echo "✅ All apps signed with unified identity"
