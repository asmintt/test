#!/bin/bash

# MovieFrameSnap Lite を開発モードで起動

cd "$(dirname "$0")"

# 既存のElectronプロセスを終了
echo "既存のプロセスを終了中..."
killall -9 Electron 2>/dev/null || echo "既存のプロセスはありません"

# 少し待機
sleep 1

# 開発モードで起動
echo "開発モードで起動中..."
npm start
