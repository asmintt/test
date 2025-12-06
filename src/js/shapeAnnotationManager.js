// shapeAnnotationManager.js - 図形アノテーション管理
// 動画上に時刻ベースで図形（四角、矢印）を描画する機能

class ShapeAnnotationManager {
    constructor() {
        // DOM要素
        this.canvas = document.getElementById('annotationCanvas');
        this.ctx = this.canvas?.getContext('2d');
        this.shapeButtons = document.querySelectorAll('.shape-btn');
        this.shapeColorPalette = document.getElementById('shapeColorPalette');
        this.shapeList = document.getElementById('shapeList');
        this.addShapeBtn = document.getElementById('addShapeBtn');
        this.addNoShapeBtn = document.getElementById('addNoShapeBtn');
        this.shapeCurrentTime = document.getElementById('shapeCurrentTime');

        // 時刻調整ボタン
        this.timeAdjustShapeButtons = document.querySelectorAll('[data-adjust-shape]');
        this.syncShapeTimeBtn = document.getElementById('syncShapeTime');
        this.resetShapeTimeBtn = document.getElementById('resetShapeTime');

        // 選択された色
        this.selectedShapeColor = '#FF0000'; // デフォルト: 赤

        // 現在の図形タイプ
        this.currentShapeType = null;

        // 描画中の状態
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;

        // 一時的な図形（追加前のプレビュー）
        this.pendingShape = null;

        // 図形データ（配列）
        // 各図形: { time, type, x1, y1, x2, y2, color }
        this.shapes = [];

        // テキスト注釈エリアの高さ
        this.textAreaHeight = 150;

        // コールバック
        this.onShapesChangeCallback = null;
    }

    /**
     * 初期化
     */
    init() {
        if (!this.canvas) return;

        // 図形選択ボタン
        this.shapeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectShape(btn.dataset.shape);
                this.updateButtonStates(btn);
            });
        });

        // 「追加」ボタン
        if (this.addShapeBtn) {
            this.addShapeBtn.addEventListener('click', () => {
                console.log('追加ボタンがクリックされました');
                this.confirmPendingShape();
            });
        } else {
            console.error('addShapeBtn要素が見つかりません');
        }

        // 「図形描画終了」ボタン
        if (this.addNoShapeBtn) {
            this.addNoShapeBtn.addEventListener('click', () => {
                this.addNoShape();
            });
        }

        // 時刻調整ボタン
        this.timeAdjustShapeButtons.forEach(button => {
            button.addEventListener('click', () => {
                const offset = parseFloat(button.getAttribute('data-adjust-shape'));
                this.adjustTime(offset);
            });
        });

        // 現在位置ボタン
        if (this.syncShapeTimeBtn) {
            this.syncShapeTimeBtn.addEventListener('click', () => {
                // 何もしない（既に動画の現在位置が表示されているため）
            });
        }

        // リセットボタン
        if (this.resetShapeTimeBtn) {
            this.resetShapeTimeBtn.addEventListener('click', () => {
                this.resetTime();
            });
        }

        // マウスイベント
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));

        // 動画のサイズに合わせてキャンバスをリサイズ
        if (videoPlayer && videoPlayer.video) {
            videoPlayer.video.addEventListener('loadedmetadata', () => {
                this.resizeCanvas();
            });

            // ウィンドウリサイズ時もキャンバスをリサイズ
            window.addEventListener('resize', () => {
                this.resizeCanvas();
            });
        }

        // カラーパレットの初期化
        this.initColorPalette();
    }

    /**
     * カラーパレットの初期化
     */
    initColorPalette() {
        if (this.shapeColorPalette) {
            const colorButtons = this.shapeColorPalette.querySelectorAll('.color-btn');
            colorButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const color = button.getAttribute('data-color');
                    this.selectShapeColor(color, button);
                });
            });
        }
    }

    /**
     * 図形色を選択
     * @param {string} color - 選択された色
     * @param {HTMLElement} button - クリックされたボタン
     */
    selectShapeColor(color, button) {
        this.selectedShapeColor = color;

        // すべてのボタンからactiveクラスを削除
        const allButtons = this.shapeColorPalette.querySelectorAll('.color-btn');
        allButtons.forEach(btn => btn.classList.remove('active'));

        // クリックされたボタンにactiveクラスを追加
        button.classList.add('active');
    }

    /**
     * キャンバスを動画のサイズに合わせる
     */
    resizeCanvas() {
        if (!videoPlayer || !videoPlayer.video) return;

        const video = videoPlayer.video;
        this.canvas.width = video.offsetWidth;
        this.canvas.height = video.offsetHeight;

        // リサイズ後に図形を再描画
        this.redrawShapes();
    }

    /**
     * 図形タイプを選択
     * @param {string} shapeType - 図形タイプ (rectangle, arrow, none)
     */
    selectShape(shapeType) {
        if (shapeType === 'none') {
            // 図形選択を解除
            this.currentShapeType = null;
            this.canvas.style.cursor = 'default';
        } else {
            this.currentShapeType = shapeType;
            this.canvas.style.cursor = 'crosshair';
        }
    }

    /**
     * 図形ボタンのアクティブ状態を更新
     * @param {HTMLElement} activeBtn - アクティブなボタン
     */
    updateButtonStates(activeBtn) {
        this.shapeButtons.forEach(btn => {
            btn.classList.remove('active');
        });
        activeBtn.classList.add('active');
    }

    /**
     * マウスダウン時の処理
     * @param {MouseEvent} e - マウスイベント
     */
    onMouseDown(e) {
        if (!this.currentShapeType) return;

        this.isDrawing = true;

        // キャンバス上の相対座標を取得
        const rect = this.canvas.getBoundingClientRect();
        this.startX = e.clientX - rect.left;
        this.startY = e.clientY - rect.top;
    }

    /**
     * マウス移動時の処理（プレビュー表示）
     * @param {MouseEvent} e - マウスイベント
     */
    onMouseMove(e) {
        if (!this.isDrawing) return;

        const rect = this.canvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        // 既存の図形を再描画
        this.redrawShapes();

        // プレビュー図形を描画
        this.drawShape(this.currentShapeType, this.startX, this.startY, currentX, currentY, this.selectedShapeColor);
    }

    /**
     * マウスアップ時の処理（図形を一時保存）
     * @param {MouseEvent} e - マウスイベント
     */
    onMouseUp(e) {
        if (!this.isDrawing) return;

        this.isDrawing = false;

        const rect = this.canvas.getBoundingClientRect();
        const endX = e.clientX - rect.left;
        const endY = e.clientY - rect.top;

        // 図形が小さすぎる場合はキャンセル
        const distance = Math.sqrt(Math.pow(endX - this.startX, 2) + Math.pow(endY - this.startY, 2));
        if (distance < 10) {
            this.pendingShape = null;
            this.redrawShapes();
            return;
        }

        // 現在の動画時刻を取得
        const currentTime = videoPlayer ? videoPlayer.getCurrentTime() : 0;

        // 一時的な図形として保存（まだ確定しない）
        this.pendingShape = {
            time: currentTime,
            type: this.currentShapeType,
            x1: this.startX,
            y1: this.startY,
            x2: endX,
            y2: endY,
            color: this.selectedShapeColor
        };

        console.log('図形を描画しました（未確定）:', this.pendingShape);

        // 「追加」ボタンを有効化
        if (this.addShapeBtn) {
            setEnabled(this.addShapeBtn, true);
            console.log('追加ボタンを有効化しました');
        }

        // プレビュー表示を維持（redrawShapesで一時図形も描画される）
        this.redrawShapes();
    }

    /**
     * 一時保存された図形を確定して追加
     */
    confirmPendingShape() {
        console.log('confirmPendingShape呼び出し - pendingShape:', this.pendingShape);

        if (!this.pendingShape) {
            console.log('pendingShapeがnullのため処理を中断');
            return;
        }

        // 図形を配列に追加
        this.shapes.push(this.pendingShape);
        console.log('図形を配列に追加しました。現在の図形数:', this.shapes.length);
        this.pendingShape = null;

        // 「追加」ボタンを無効化
        if (this.addShapeBtn) {
            setEnabled(this.addShapeBtn, false);
        }

        // 時刻順にソート
        this.sortShapes();

        // 再描画
        this.redrawShapes();

        // リストを更新
        this.updateShapeList();
        console.log('図形リストを更新しました');

        // コールバック実行
        this.notifyChange();
    }

    /**
     * 「図形なし」を追加（図形の終了ポイント）
     */
    addNoShape() {
        if (!videoPlayer) return;

        const currentTime = videoPlayer.getCurrentTime();

        // 空のタイプで図形なしを追加
        const shape = {
            time: currentTime,
            type: '',
            x1: 0,
            y1: 0,
            x2: 0,
            y2: 0,
            color: '#000000'
        };

        this.shapes.push(shape);
        this.sortShapes();
        this.updateShapeList();
        this.notifyChange();
    }

    /**
     * 図形を時刻順にソート
     */
    sortShapes() {
        this.shapes.sort((a, b) => a.time - b.time);
    }

    /**
     * 図形を描画
     * @param {string} type - 図形タイプ
     * @param {number} x1 - 開始X座標
     * @param {number} y1 - 開始Y座標
     * @param {number} x2 - 終了X座標
     * @param {number} y2 - 終了Y座標
     * @param {string} color - 色
     */
    drawShape(type, x1, y1, x2, y2, color) {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 3;
        this.ctx.fillStyle = 'transparent';

        switch (type) {
            case 'rectangle':
                this.ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
                break;

            case 'arrow':
                this.drawArrow(x1, y1, x2, y2, color);
                break;
        }
    }

    /**
     * 矢印を描画（→記号のみ）
     * @param {number} x1 - 開始X座標
     * @param {number} y1 - 開始Y座標
     * @param {number} x2 - 終了X座標
     * @param {number} y2 - 終了Y座標
     * @param {string} color - 色
     */
    drawArrow(x1, y1, x2, y2, color) {
        // →記号を描画
        this.ctx.font = '40px sans-serif';
        this.ctx.fillStyle = color;
        this.ctx.fillText('→', x2 - 20, y2 + 10);
    }

    /**
     * 現在時刻で有効な図形を取得
     * @param {number} currentTime - 現在時刻（秒）
     * @returns {Array} 有効な図形の配列
     */
    getActiveShapesAtTime(currentTime) {
        if (this.shapes.length === 0) return [];

        const activeShapes = [];

        // 現在時刻以前の図形を取得
        for (let i = 0; i < this.shapes.length; i++) {
            const shape = this.shapes[i];

            if (shape.time > currentTime) break;

            // 次の図形を確認
            const nextShape = this.shapes[i + 1];

            if (nextShape && nextShape.time <= currentTime) {
                // 次の図形がすでに開始している場合はスキップ
                continue;
            }

            // 現在の図形が「図形なし」でない場合は追加
            if (shape.type !== '') {
                activeShapes.push(shape);
            }
        }

        return activeShapes;
    }

    /**
     * すべての図形を再描画
     */
    redrawShapes() {
        // キャンバスをクリア
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 現在時刻の図形を取得して描画
        if (videoPlayer) {
            const currentTime = videoPlayer.getCurrentTime();
            const activeShapes = this.getActiveShapesAtTime(currentTime);

            activeShapes.forEach(shape => {
                this.drawShape(shape.type, shape.x1, shape.y1, shape.x2, shape.y2, shape.color);
            });
        }

        // 一時図形（未確定）も描画
        if (this.pendingShape) {
            this.drawShape(
                this.pendingShape.type,
                this.pendingShape.x1,
                this.pendingShape.y1,
                this.pendingShape.x2,
                this.pendingShape.y2,
                this.pendingShape.color
            );
        }
    }

    /**
     * 図形リストを更新
     */
    updateShapeList() {
        if (!this.shapeList) return;

        this.shapeList.innerHTML = '';

        if (this.shapes.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.className = 'empty-message';
            emptyMsg.textContent = '図形が登録されていません';
            this.shapeList.appendChild(emptyMsg);
            return;
        }

        // 降順で表示
        for (let i = this.shapes.length - 1; i >= 0; i--) {
            const item = this.createShapeItem(this.shapes[i], i);
            this.shapeList.appendChild(item);
        }
    }

    /**
     * 図形アイテムのHTML要素を作成
     * @param {Object} shape - 図形オブジェクト
     * @param {number} index - インデックス
     * @returns {HTMLElement} 図形アイテム要素
     */
    createShapeItem(shape, index) {
        const item = document.createElement('div');
        item.className = 'annotation-item';

        // 時刻表示
        const timeLabel = document.createElement('div');
        timeLabel.className = 'annotation-time';
        timeLabel.textContent = formatTimeWithDecimal(shape.time);
        timeLabel.style.cursor = 'pointer';
        timeLabel.addEventListener('click', () => {
            if (videoPlayer) {
                videoPlayer.setCurrentTime(shape.time);
            }
        });

        // 図形タイプの日本語名
        const typeNames = {
            rectangle: '四角',
            arrow: '矢印',
            '': '図形なし'
        };

        // テキスト表示
        const textLabel = document.createElement('div');
        textLabel.className = 'annotation-text';
        textLabel.textContent = typeNames[shape.type] || shape.type;
        if (shape.type !== '') {
            textLabel.style.color = shape.color;
        }

        // 修正ボタン
        const editBtn = document.createElement('button');
        editBtn.className = 'btn-edit';
        editBtn.textContent = '修正';
        editBtn.addEventListener('click', () => {
            this.editShape(index);
        });

        // 削除ボタン
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.textContent = '削除';
        deleteBtn.addEventListener('click', () => {
            this.deleteShape(index);
        });

        // 要素を組み立て
        item.appendChild(timeLabel);
        item.appendChild(textLabel);
        if (shape.type !== '') {
            item.appendChild(editBtn);
        }
        item.appendChild(deleteBtn);

        return item;
    }

    /**
     * 図形を編集
     * @param {number} index - 編集する図形のインデックス
     */
    editShape(index) {
        const shape = this.shapes[index];

        // 色を設定してボタンの状態を更新
        this.selectedShapeColor = shape.color;

        // 枠線色パレットのアクティブ状態を更新
        if (this.shapeColorPalette) {
            const colorButtons = this.shapeColorPalette.querySelectorAll('.color-btn');
            colorButtons.forEach(btn => {
                if (btn.getAttribute('data-color') === shape.color) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        // 図形タイプを選択
        const shapeBtn = Array.from(this.shapeButtons).find(btn => btn.dataset.shape === shape.type);
        if (shapeBtn) {
            this.selectShape(shape.type);
            this.updateButtonStates(shapeBtn);
        }

        // 図形を削除（再描画するため）
        this.shapes.splice(index, 1);
        this.redrawShapes();
        this.updateShapeList();
        this.notifyChange();

        // 動画の時刻を設定
        if (videoPlayer) {
            videoPlayer.setCurrentTime(shape.time);
        }
    }

    /**
     * 図形を削除
     * @param {number} index - 削除する図形のインデックス
     */
    deleteShape(index) {
        this.shapes.splice(index, 1);
        this.redrawShapes();
        this.updateShapeList();
        this.notifyChange();
    }

    /**
     * すべての図形を取得
     * @returns {Array} 図形の配列
     */
    getShapes() {
        return this.shapes;
    }

    /**
     * すべての図形をクリア
     */
    clearShapes() {
        this.shapes = [];
        this.redrawShapes();
        this.updateShapeList();
        this.notifyChange();
    }

    /**
     * 動画読み込み時の設定
     */
    onVideoLoaded() {
        // キャンバスをリサイズ
        this.resizeCanvas();

        // UIを有効化
        if (this.addNoShapeBtn) {
            setEnabled(this.addNoShapeBtn, true);
        }

        // 時刻調整ボタンを有効化
        this.timeAdjustShapeButtons.forEach(button => {
            button.disabled = false;
        });
        if (this.syncShapeTimeBtn) this.syncShapeTimeBtn.disabled = false;
        if (this.resetShapeTimeBtn) this.resetShapeTimeBtn.disabled = false;

        // 図形をクリア
        this.clearShapes();
    }

    /**
     * 時刻を調整
     * @param {number} offset - 調整する秒数（正または負）
     */
    adjustTime(offset) {
        if (!videoPlayer) return;

        const currentTime = videoPlayer.getCurrentTime();
        const newTime = currentTime + offset;
        videoPlayer.setCurrentTime(newTime);
    }

    /**
     * 時刻をリセット
     */
    resetTime() {
        if (!videoPlayer) return;
        videoPlayer.setCurrentTime(0);
    }

    /**
     * 現在時刻の更新（videoPlayerから呼ばれる）
     * @param {number} currentTime - 現在時刻（秒）
     */
    updateCurrentTime(currentTime) {
        if (this.shapeCurrentTime) {
            this.shapeCurrentTime.textContent = formatTimeWithDecimal(currentTime);
        }

        // 図形を再描画（時刻に応じて表示/非表示）
        this.redrawShapes();
    }

    /**
     * 図形変更時のコールバックを設定
     * @param {Function} callback - コールバック関数
     */
    onShapesChange(callback) {
        this.onShapesChangeCallback = callback;
    }

    /**
     * 図形変更を通知
     */
    notifyChange() {
        if (this.onShapesChangeCallback) {
            this.onShapesChangeCallback(this.shapes);
        }
    }
}

// グローバルインスタンス
const shapeAnnotationManager = new ShapeAnnotationManager();
