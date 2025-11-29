// shapeAnnotationManager.js - 図形アノテーション管理
// 動画上に図形（四角、丸、矢印、線）を描画する機能

class ShapeAnnotationManager {
    constructor() {
        // DOM要素
        this.canvas = document.getElementById('annotationCanvas');
        this.ctx = this.canvas?.getContext('2d');
        this.shapeButtons = document.querySelectorAll('.shape-btn');
        this.shapeColorInput = document.getElementById('shapeColor');
        this.shapeList = document.getElementById('shapeList');

        // 現在の図形タイプ
        this.currentShapeType = null;

        // 描画中の状態
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;

        // 図形データ（配列）
        // 各図形: { type, x1, y1, x2, y2, color }
        this.shapes = [];

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
     * @param {string} shapeType - 図形タイプ (rectangle, circle, arrow, line)
     */
    selectShape(shapeType) {
        this.currentShapeType = shapeType;
        this.canvas.style.cursor = 'crosshair';
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
        const color = this.shapeColorInput.value;
        this.drawShape(this.currentShapeType, this.startX, this.startY, currentX, currentY, color);
    }

    /**
     * マウスアップ時の処理（図形確定）
     * @param {MouseEvent} e - マウスイベント
     */
    onMouseUp(e) {
        if (!this.isDrawing) return;

        this.isDrawing = false;

        const rect = this.canvas.getBoundingClientRect();
        const endX = e.clientX - rect.left;
        const endY = e.clientY - rect.top;

        // 図形が小さすぎる場合は追加しない
        const distance = Math.sqrt(Math.pow(endX - this.startX, 2) + Math.pow(endY - this.startY, 2));
        if (distance < 10) return;

        // 図形を配列に追加
        const shape = {
            type: this.currentShapeType,
            x1: this.startX,
            y1: this.startY,
            x2: endX,
            y2: endY,
            color: this.shapeColorInput.value
        };

        this.shapes.push(shape);

        // 再描画
        this.redrawShapes();

        // リストを更新
        this.updateShapeList();

        // コールバック実行
        this.notifyChange();
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

            case 'circle':
                const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                this.ctx.beginPath();
                this.ctx.arc(x1, y1, radius, 0, 2 * Math.PI);
                this.ctx.stroke();
                break;

            case 'arrow':
                this.drawArrow(x1, y1, x2, y2, color);
                break;

            case 'line':
                this.ctx.beginPath();
                this.ctx.moveTo(x1, y1);
                this.ctx.lineTo(x2, y2);
                this.ctx.stroke();
                break;
        }
    }

    /**
     * 矢印を描画
     * @param {number} x1 - 開始X座標
     * @param {number} y1 - 開始Y座標
     * @param {number} x2 - 終了X座標
     * @param {number} y2 - 終了Y座標
     * @param {string} color - 色
     */
    drawArrow(x1, y1, x2, y2, color) {
        const headLength = 20; // 矢印の頭の長さ
        const angle = Math.atan2(y2 - y1, x2 - x1);

        // 線を描画
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();

        // 矢印の頭を描画
        this.ctx.beginPath();
        this.ctx.moveTo(x2, y2);
        this.ctx.lineTo(
            x2 - headLength * Math.cos(angle - Math.PI / 6),
            y2 - headLength * Math.sin(angle - Math.PI / 6)
        );
        this.ctx.moveTo(x2, y2);
        this.ctx.lineTo(
            x2 - headLength * Math.cos(angle + Math.PI / 6),
            y2 - headLength * Math.sin(angle + Math.PI / 6)
        );
        this.ctx.stroke();
    }

    /**
     * すべての図形を再描画
     */
    redrawShapes() {
        // キャンバスをクリア
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // すべての図形を描画
        this.shapes.forEach(shape => {
            this.drawShape(shape.type, shape.x1, shape.y1, shape.x2, shape.y2, shape.color);
        });
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

        this.shapes.forEach((shape, index) => {
            const item = this.createShapeItem(shape, index);
            this.shapeList.appendChild(item);
        });
    }

    /**
     * 図形アイテムのHTML要素を作成
     * @param {Object} shape - 図形オブジェクト
     * @param {number} index - インデックス
     * @returns {HTMLElement} 図形アイテム要素
     */
    createShapeItem(shape, index) {
        const item = document.createElement('div');
        item.className = 'shape-item';

        // 図形タイプの日本語名
        const typeNames = {
            rectangle: '四角',
            circle: '丸',
            arrow: '矢印',
            line: '線'
        };

        const typeLabel = document.createElement('span');
        typeLabel.textContent = typeNames[shape.type] || shape.type;

        // 削除ボタン
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.textContent = '削除';
        deleteBtn.addEventListener('click', () => {
            this.deleteShape(index);
        });

        item.appendChild(typeLabel);
        item.appendChild(deleteBtn);

        return item;
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

        // 色選択を有効化
        if (this.shapeColorInput) {
            setEnabled(this.shapeColorInput, true);
        }

        // 図形をクリア
        this.clearShapes();
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
