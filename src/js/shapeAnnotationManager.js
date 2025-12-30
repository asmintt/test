// shapeAnnotationManager.js - 図形アノテーション管理
// 動画上に時刻ベースで図形（四角、矢印）を描画する機能

class ShapeAnnotationManager {
    constructor() {
        // DOM要素
        this.canvas = document.getElementById('annotationCanvas');
        this.ctx = this.canvas?.getContext('2d');
        this.shapeButtons = document.querySelectorAll('.shape-btn');
        this.shapeColorButtons = document.querySelectorAll('.shape-color-btn');
        this.shapeLineWidthButtons = document.querySelectorAll('.shape-linewidth-btn');
        this.customColor = document.getElementById('shapeCustomColor');
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

        // 選択された枠線の太さ
        this.selectedLineWidth = 5; // デフォルト: 5px（標準）

        // 現在の図形タイプ
        this.currentShapeType = null;

        // 描画中の状態
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;

        // 一時的な図形（追加前のプレビュー）- 複数対応
        this.pendingShapes = [];

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

        // 「すべて追加」ボタン
        if (this.addShapeBtn) {
            this.addShapeBtn.addEventListener('click', () => {
                console.log('すべて追加ボタンがクリックされました');
                this.confirmAllPendingShapes();
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

        // 図形コントロール（色・太さ）の初期化
        this.initShapeControls();
    }

    /**
     * 図形コントロール（色・太さ）の初期化
     */
    initShapeControls() {
        // 6色パネルボタン
        this.shapeColorButtons.forEach(button => {
            button.addEventListener('click', () => {
                const color = button.getAttribute('data-color');
                this.selectPanelColor(color, button);
            });
        });

        // カスタムカラーピッカー
        if (this.customColor) {
            this.customColor.addEventListener('change', () => {
                this.selectCustomColor();
            });
        }

        // 枠線の太さボタン
        this.shapeLineWidthButtons.forEach(button => {
            button.addEventListener('click', () => {
                const lineWidth = parseInt(button.getAttribute('data-linewidth'), 10);
                this.selectLineWidth(lineWidth, button);
            });
        });
    }

    /**
     * パネルから色を選択
     * @param {string} color - 選択された色
     * @param {HTMLElement} button - クリックされたボタン
     */
    selectPanelColor(color, button) {
        this.selectedShapeColor = color;

        // パネルボタンのactive状態を更新
        this.shapeColorButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // カスタムカラーピッカーを同期
        if (this.customColor) this.customColor.value = color;

        // pendingShapes（確定前の図形）の最後の図形の色を更新
        if (this.pendingShapes.length > 0) {
            this.pendingShapes[this.pendingShapes.length - 1].color = color;
            this.redrawShapes(); // リアルタイムプレビュー更新
        }
    }

    /**
     * カスタム色を選択
     */
    selectCustomColor() {
        this.selectedShapeColor = this.customColor.value;

        // パネルボタンのactive状態を解除
        this.shapeColorButtons.forEach(btn => btn.classList.remove('active'));

        // pendingShapes（確定前の図形）の最後の図形の色を更新
        if (this.pendingShapes.length > 0) {
            this.pendingShapes[this.pendingShapes.length - 1].color = this.customColor.value;
            this.redrawShapes(); // リアルタイムプレビュー更新
        }
    }

    /**
     * 枠線の太さを選択
     * @param {number} lineWidth - 選択された太さ
     * @param {HTMLElement} button - クリックされたボタン
     */
    selectLineWidth(lineWidth, button) {
        this.selectedLineWidth = lineWidth;

        // ボタンのactive状態を更新
        this.shapeLineWidthButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // pendingShapes（確定前の図形）の最後の図形の太さを更新
        if (this.pendingShapes.length > 0) {
            this.pendingShapes[this.pendingShapes.length - 1].lineWidth = lineWidth;
            this.redrawShapes(); // リアルタイムプレビュー更新
            console.log(`枠線の太さを${lineWidth}pxに変更し、プレビューを更新しました`);
        } else {
            console.log(`枠線の太さを${lineWidth}pxに変更しました`);
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
        this.drawShape(this.currentShapeType, this.startX, this.startY, currentX, currentY, this.selectedShapeColor, this.selectedLineWidth);
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
            // 図形が小さすぎる場合はキャンセル（何も追加しない）
            this.redrawShapes();
            return;
        }

        // 現在の動画時刻を取得
        const currentTime = videoPlayer ? videoPlayer.getCurrentTime() : 0;

        // 一時的な図形として配列に追加
        const newShape = {
            time: currentTime,
            type: this.currentShapeType,
            x1: this.startX,
            y1: this.startY,
            x2: endX,
            y2: endY,
            color: this.selectedShapeColor,
            lineWidth: this.selectedLineWidth
        };

        this.pendingShapes.push(newShape);
        console.log('図形を描画しました（未確定）:', newShape);
        console.log('現在の未確定図形数:', this.pendingShapes.length);

        // 「すべて追加」ボタンを有効化
        if (this.addShapeBtn) {
            setEnabled(this.addShapeBtn, true);
            console.log('すべて追加ボタンを有効化しました');
        }

        // プレビュー表示を維持（redrawShapesで一時図形も描画される）
        this.redrawShapes();
    }

    /**
     * すべての未確定図形を確定して追加
     */
    confirmAllPendingShapes() {
        console.log('confirmAllPendingShapes呼び出し - pendingShapes数:', this.pendingShapes.length);

        if (this.pendingShapes.length === 0) {
            console.log('pendingShapesが空のため処理を中断');
            return;
        }

        // すべての未確定図形を配列に追加
        this.pendingShapes.forEach(shape => {
            this.shapes.push(shape);
        });
        console.log('図形を配列に追加しました。追加した図形数:', this.pendingShapes.length);
        console.log('現在の図形総数:', this.shapes.length);

        // pendingShapesをクリア
        this.pendingShapes = [];

        // ボタンを無効化
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

        // 図形選択を解除して、カーソルを通常に戻す
        this.selectShape('none');

        // 「選択解除」ボタンをアクティブにする
        const noneBtn = Array.from(this.shapeButtons).find(btn => btn.dataset.shape === 'none');
        if (noneBtn) {
            this.updateButtonStates(noneBtn);
        }
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
            color: '#000000',
            lineWidth: 5
        };

        this.shapes.push(shape);
        this.sortShapes();
        this.updateShapeList();
        this.notifyChange();

        // 図形選択を解除して、カーソルを通常に戻す
        this.selectShape('none');

        // 「選択解除」ボタンをアクティブにする
        const noneBtn = Array.from(this.shapeButtons).find(btn => btn.dataset.shape === 'none');
        if (noneBtn) {
            this.updateButtonStates(noneBtn);
        }
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
     * @param {number} lineWidth - 枠線の太さ（デフォルト: this.selectedLineWidth）
     */
    drawShape(type, x1, y1, x2, y2, color, lineWidth = this.selectedLineWidth) {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
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
     * 矢印を描画（幾何学的な矢印：直線+三角形）
     * @param {number} x1 - 開始X座標
     * @param {number} y1 - 開始Y座標
     * @param {number} x2 - 終了X座標
     * @param {number} y2 - 終了Y座標
     * @param {string} color - 色
     */
    drawArrow(x1, y1, x2, y2, color) {
        // lineWidthに応じて矢印の先端サイズを調整
        const currentLineWidth = this.ctx.lineWidth || this.selectedLineWidth;
        const headLength = Math.max(15, currentLineWidth * 3); // 最小15px、lineWidthの3倍
        const angle = Math.atan2(y2 - y1, x2 - x1);

        // 直線を描画
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();

        // 矢印の先端を描画
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
     * 現在時刻で有効な図形を取得
     * @param {number} currentTime - 現在時刻（秒）
     * @returns {Array} 有効な図形の配列
     */
    getActiveShapesAtTime(currentTime) {
        if (this.shapes.length === 0) return [];

        const activeShapes = [];
        let lastShapeTime = -1;

        // 現在時刻以前の図形を逆順で走査
        for (let i = this.shapes.length - 1; i >= 0; i--) {
            const shape = this.shapes[i];

            // 現在時刻より未来の図形はスキップ
            if (shape.time > currentTime) continue;

            // 「図形なし」が見つかったらそれ以降の図形を無効化
            if (shape.type === '') {
                break;
            }

            // まだ有効な図形時刻が設定されていない場合
            if (lastShapeTime === -1) {
                lastShapeTime = shape.time;
            }

            // 同じタイムスタンプの図形はすべて追加
            if (shape.time === lastShapeTime) {
                activeShapes.push(shape);
            } else {
                // 異なるタイムスタンプに到達したら終了
                break;
            }
        }

        // 逆順で追加したので、元の順序に戻す
        return activeShapes.reverse();
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
                // 後方互換性: lineWidthがない場合はデフォルト値5を使用
                const lineWidth = shape.lineWidth || 5;
                this.drawShape(shape.type, shape.x1, shape.y1, shape.x2, shape.y2, shape.color, lineWidth);
            });
        }

        // 一時図形（未確定）もすべて描画
        this.pendingShapes.forEach(shape => {
            this.drawShape(
                shape.type,
                shape.x1,
                shape.y1,
                shape.x2,
                shape.y2,
                shape.color,
                shape.lineWidth || this.selectedLineWidth
            );
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
        // 図形タイプの日本語名
        const typeNames = {
            rectangle: '四角',
            arrow: '矢印',
            '': '図形なし'
        };

        // テキストスタイル
        const textStyle = {};
        if (shape.type !== '') {
            textStyle.color = shape.color;
        }

        return createListItem({
            itemClassName: 'annotation-item',
            time: shape.time,
            useDecimalTime: true,
            onTimeClick: () => {
                if (videoPlayer) {
                    videoPlayer.setCurrentTime(shape.time);
                }
            },
            text: typeNames[shape.type] || shape.type,
            textStyle: textStyle,
            onEdit: shape.type !== '' ? () => this.editShape(index) : null,
            onDelete: () => this.deleteShape(index)
        });
    }

    /**
     * 図形を編集
     * @param {number} index - 編集する図形のインデックス
     */
    editShape(index) {
        const shape = this.shapes[index];

        // 色を設定
        this.selectedShapeColor = shape.color;

        // 6色パネルボタンのアクティブ状態を更新
        let matchedPanel = false;
        this.shapeColorButtons.forEach(btn => {
            if (btn.getAttribute('data-color') === shape.color) {
                btn.classList.add('active');
                matchedPanel = true;
            } else {
                btn.classList.remove('active');
            }
        });

        // パネルと一致しない場合はカスタム色として扱う
        if (!matchedPanel) {
            // すべてのパネルボタンを非アクティブ化
            this.shapeColorButtons.forEach(btn => btn.classList.remove('active'));
        }

        // カスタムカラーピッカーを同期
        if (this.customColor) this.customColor.value = shape.color;

        // 枠線の太さを設定（後方互換性）
        this.selectedLineWidth = shape.lineWidth || 5;

        // 太さボタンのアクティブ状態を更新
        this.shapeLineWidthButtons.forEach(btn => {
            if (parseInt(btn.getAttribute('data-linewidth'), 10) === this.selectedLineWidth) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

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
        this.pendingShapes = [];
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

        // カスタムカラーピッカーを有効化
        if (this.customColor) this.customColor.disabled = false;

        // 6色パネルボタンを有効化
        this.shapeColorButtons.forEach(button => {
            button.disabled = false;
        });

        // 枠線の太さボタンを有効化
        this.shapeLineWidthButtons.forEach(button => {
            button.disabled = false;
        });

        // 時刻調整ボタンを有効化
        this.timeAdjustShapeButtons.forEach(button => {
            button.disabled = false;
        });
        if (this.syncShapeTimeBtn) this.syncShapeTimeBtn.disabled = false;
        if (this.resetShapeTimeBtn) this.resetShapeTimeBtn.disabled = false;

        // プロジェクト読み込み中でない場合のみ図形をクリア
        if (projectManager && !projectManager.isLoadingProject) {
            console.log('[DEBUG] shapeAnnotationManager: 図形をクリアします');
            this.clearShapes();
        } else {
            console.log('[DEBUG] shapeAnnotationManager: プロジェクト読み込み中のため図形をクリアしません');
        }
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

    /**
     * 図形データを読み込み
     * @param {Array} shapes - 読み込む図形データ
     */
    loadShapes(shapes) {
        if (!Array.isArray(shapes)) return;

        this.shapes = shapes;
        this.updateShapeList();
        this.redrawShapes();
        console.log(`図形アノテーションを${shapes.length}件読み込みました`);
    }

    /**
     * 図形データを取得
     * @returns {Array} 図形データ
     */
    getShapes() {
        return this.shapes;
    }
}

// グローバルインスタンス
const shapeAnnotationManager = new ShapeAnnotationManager();
