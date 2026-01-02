// shapeAnnotationManager.js - 図形アノテーション管理
// 動画上に時刻ベースで図形（四角、矢印）を描画する機能

class ShapeAnnotationManager {
    constructor() {
        // DOM要素
        this.canvas = document.getElementById('annotationCanvas');
        this.ctx = this.canvas?.getContext('2d');
        this.shapeButtons = document.querySelectorAll('.shape-btn');
        this.shapeColorButtons = document.querySelectorAll('.shape-color-btn');
        this.shapeLineWidthButtons = document.querySelectorAll('.shape-linewidth-btn, .shape-linewidth-btn-compact');
        this.customLineWidthInput = document.getElementById('customLineWidth');
        this.customColor = document.getElementById('shapeCustomColor');
        this.sharedCustomPresetBtn = document.getElementById('sharedCustomPresetBtn');
        this.shapeList = document.getElementById('shapeList');
        this.addShapeContinueBtn = document.getElementById('addShapeContinueBtn');
        this.addShapeNewBtn = document.getElementById('addShapeNewBtn');
        this.addNoShapeBtn = document.getElementById('addNoShapeBtn');
        this.shapeCurrentTime = document.getElementById('shapeCurrentTime');

        // 時刻調整ボタン（サイドバーの統合ボタン）
        this.timeAdjustShapeButtons = document.querySelectorAll('[data-video-adjust]');
        this.syncShapeTimeBtn = document.getElementById('syncVideoTime');
        this.resetShapeTimeBtn = document.getElementById('resetVideoTime');

        // 選択された色
        this.selectedShapeColor = '#FFFFFF'; // デフォルト: 白

        // 選択された枠線の太さ
        this.selectedLineWidth = 1; // デフォルト: 1px（最極細）

        // 現在の図形タイプ
        this.currentShapeType = null;

        // テキスト付き矢印フラグ（direction-arrow-btnクラスを持つボタンからの選択）
        this.isTextIncludedArrow = false;

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

        // localStorageから枠線の太さを復元
        const savedLineWidth = localStorage.getItem('selectedLineWidth');
        if (savedLineWidth) {
            this.selectedLineWidth = parseInt(savedLineWidth);
            console.log('枠線の太さを復元しました:', this.selectedLineWidth);

            // 復元した値に対応するボタンをアクティブにする
            this.shapeLineWidthButtons.forEach(btn => {
                if (parseInt(btn.getAttribute('data-linewidth'), 10) === this.selectedLineWidth) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        // 図形選択ボタン
        this.shapeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // direction-arrow-btnクラスを持つ場合はテキスト付き矢印
                this.isTextIncludedArrow = btn.classList.contains('direction-arrow-btn');
                this.selectShape(btn.dataset.shape);
                this.updateButtonStates(btn);
            });
        });

        // 「追加（継続）」ボタン
        if (this.addShapeContinueBtn) {
            this.addShapeContinueBtn.addEventListener('click', () => {
                console.log('追加（継続）ボタンがクリックされました');
                this.confirmPendingShapes(true); // 継続フラグ: true
            });
        } else {
            console.error('addShapeContinueBtn要素が見つかりません');
        }

        // 「追加（新規）」ボタン
        if (this.addShapeNewBtn) {
            this.addShapeNewBtn.addEventListener('click', () => {
                console.log('追加（新規）ボタンがクリックされました');
                this.confirmPendingShapes(false); // 継続フラグ: false
            });
        } else {
            console.error('addShapeNewBtn要素が見つかりません');
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
                const offset = parseFloat(button.getAttribute('data-video-adjust'));
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

        // DeleteまたはBackspaceキーで選択された図形を削除
        document.addEventListener('keydown', (e) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && this.currentShapeType === 'erase') {
                console.log('Deleteキーで削除実行');
                e.preventDefault(); // ブラウザのデフォルト動作を防止
                this.deleteSelectedShapes();
            }
        });

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
        // 共通プリセットボタン（説明/要点/注意/登録）
        const presetButtons = document.querySelectorAll('.preset-btn');
        presetButtons.forEach(button => {
            button.addEventListener('click', () => {
                const bgColor = button.getAttribute('data-bg-color');
                if (bgColor) {
                    this.selectedShapeColor = bgColor;
                    console.log('共通プリセットボタンから図形色を設定:', bgColor);

                    // pendingShapes（確定前の図形）の最後の図形の色を更新
                    if (this.pendingShapes.length > 0) {
                        this.pendingShapes[this.pendingShapes.length - 1].color = bgColor;
                        this.redrawShapes(); // リアルタイムプレビュー更新
                    }
                }
            });
        });

        // 6色パネルボタン
        this.shapeColorButtons.forEach(button => {
            button.addEventListener('click', () => {
                const color = button.getAttribute('data-color');
                this.selectPanelColor(color, button);
            });
        });

        // カスタムカラーピッカー
        if (this.customColor) {
            // ダブルクリックでカラーピッカーを開く
            this.customColor.addEventListener('dblclick', () => {
                const input = document.createElement('input');
                input.type = 'color';
                input.value = this.selectedShapeColor;
                input.addEventListener('change', () => {
                    this.selectedShapeColor = input.value;
                    this.selectCustomColor();
                });
                input.click();
            });
        }

        // 共通カスタムボタンのダブルクリック → カスタム設定を開く
        if (this.sharedCustomPresetBtn) {
            this.sharedCustomPresetBtn.addEventListener('dblclick', () => {
                const customSettings = document.getElementById('sharedCustomSettings');
                if (customSettings) {
                    customSettings.open = true; // detailsを開く
                }
            });
        }

        // 統一カスタム設定の背景色変更イベント
        const sharedBgColor = document.getElementById('sharedCustomBgColor');
        if (sharedBgColor) {
            sharedBgColor.addEventListener('change', () => {
                this.selectedShapeColor = sharedBgColor.value;
                console.log('統一カスタム設定から図形色を設定:', this.selectedShapeColor);

                // pendingShapes（確定前の図形）の最後の図形の色を更新
                if (this.pendingShapes.length > 0) {
                    this.pendingShapes[this.pendingShapes.length - 1].color = this.selectedShapeColor;
                    this.redrawShapes(); // リアルタイムプレビュー更新
                }
            });
        }

        // 枠線の太さボタン
        this.shapeLineWidthButtons.forEach(button => {
            button.addEventListener('click', () => {
                const lineWidth = parseInt(button.getAttribute('data-linewidth'), 10);
                this.selectLineWidth(lineWidth, button);
            });
        });

        // カスタム枠線の太さ入力欄
        if (this.customLineWidthInput) {
            this.customLineWidthInput.addEventListener('change', () => {
                const lineWidth = parseInt(this.customLineWidthInput.value, 10);
                if (lineWidth >= 1 && lineWidth <= 50) {
                    this.selectLineWidth(lineWidth, null);
                    // プリセットボタンの選択を解除
                    this.shapeLineWidthButtons.forEach(btn => btn.classList.remove('active'));
                }
            });

            // 復元した値をカスタム入力欄に反映
            this.customLineWidthInput.value = this.selectedLineWidth;
        }
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
        // パネルボタンのactive状態を解除
        this.shapeColorButtons.forEach(btn => btn.classList.remove('active'));

        // pendingShapes（確定前の図形）の最後の図形の色を更新
        if (this.pendingShapes.length > 0) {
            this.pendingShapes[this.pendingShapes.length - 1].color = this.selectedShapeColor;
            this.redrawShapes(); // リアルタイムプレビュー更新
        }
    }

    /**
     * 枠線の太さを選択
     * @param {number} lineWidth - 選択された太さ
     * @param {HTMLElement} button - クリックされたボタン（nullの場合はカスタム入力）
     */
    selectLineWidth(lineWidth, button) {
        this.selectedLineWidth = lineWidth;

        // localStorageに保存
        localStorage.setItem('selectedLineWidth', lineWidth);

        // ボタンのactive状態を更新
        this.shapeLineWidthButtons.forEach(btn => btn.classList.remove('active'));
        if (button) {
            button.classList.add('active');
        }

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
     * @param {string} shapeType - 図形タイプ (rectangle, arrow, none, erase)
     */
    selectShape(shapeType) {
        if (shapeType === 'erase') {
            // 消しゴムモード
            this.currentShapeType = 'erase';
            this.canvas.style.cursor = 'pointer';
            console.log('消しゴムモードに入りました');
        } else if (shapeType === 'none') {
            // 図形選択を解除
            this.currentShapeType = null;
            this.isTextIncludedArrow = false;
            this.canvas.style.cursor = 'default';
            // 全ての選択を解除
            this.pendingShapes.forEach(s => s.selected = false);
            this.redrawCanvas();
        } else if (shapeType === 'arrow-left' || shapeType === 'arrow-right' ||
                   shapeType === 'arrow-up' || shapeType === 'arrow-down') {
            // 方向矢印モード（C案：クリック配置）
            this.currentShapeType = shapeType;
            this.canvas.style.cursor = 'crosshair';
            console.log('方向矢印モードに入りました:', shapeType, 'テキスト付き:', this.isTextIncludedArrow);
        } else {
            this.currentShapeType = shapeType;
            this.isTextIncludedArrow = false;  // 矢印以外を選択した時はリセット
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
        const rect = this.canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        console.log('=== onMouseDown 呼び出し ===');
        console.log('currentShapeType:', this.currentShapeType);
        console.log('pendingShapes.length:', this.pendingShapes.length);
        console.log('クリック座標:', clickX, clickY);

        // 消しゴムモードの場合、図形を選択
        if (this.currentShapeType === 'erase') {
            console.log('消しゴムモードで図形を選択します');
            e.preventDefault();
            e.stopPropagation();
            this.selectShapeAtPosition(clickX, clickY);
            return;
        }

        // 方向矢印モードの場合、クリック一発で配置
        if (this.currentShapeType === 'arrow-left' || this.currentShapeType === 'arrow-right' ||
            this.currentShapeType === 'arrow-up' || this.currentShapeType === 'arrow-down') {
            console.log('方向矢印をクリック位置に配置します');
            this.placeArrowAtClick(clickX, clickY);
            return;
        }

        // 図形描画モードでない場合
        if (!this.currentShapeType) {
            console.log('図形描画モードではありません');
            return;
        }

        console.log('図形描画モードで描画開始');
        this.isDrawing = true;
        this.startX = clickX;
        this.startY = clickY;
    }

    /**
     * クリック位置にある図形を選択
     * @param {number} x - クリックX座標
     * @param {number} y - クリックY座標
     */
    selectShapeAtPosition(x, y) {
        console.log('=== selectShapeAtPosition 呼び出し ===');
        console.log('クリック位置:', x, y);
        console.log('pendingShapes:', this.pendingShapes);

        let shapeFound = false;

        // pendingShapes を逆順で検索（後から描画された図形を優先）
        for (let i = this.pendingShapes.length - 1; i >= 0; i--) {
            const shape = this.pendingShapes[i];

            // 図形の境界ボックスを計算
            const minX = Math.min(shape.x1, shape.x2);
            const maxX = Math.max(shape.x1, shape.x2);
            const minY = Math.min(shape.y1, shape.y2);
            const maxY = Math.max(shape.y1, shape.y2);

            // マージン（クリックしやすくするため）
            const margin = 10;

            console.log(`図形 ${i}: 境界 (${minX}, ${minY}) - (${maxX}, ${maxY}), マージン込み: (${minX - margin}, ${minY - margin}) - (${maxX + margin}, ${maxY + margin})`);

            // クリック位置が図形の範囲内か判定
            if (x >= minX - margin && x <= maxX + margin &&
                y >= minY - margin && y <= maxY + margin) {
                // トグル動作：選択状態を反転
                shape.selected = !shape.selected;
                shapeFound = true;
                if (shape.selected) {
                    console.log('✓ 図形を選択しました:', shape);
                } else {
                    console.log('✓ 図形の選択を解除しました:', shape);
                }
                break;
            }
        }

        if (!shapeFound) {
            // クリック位置に図形がない場合、全ての選択を解除
            this.pendingShapes.forEach(s => s.selected = false);
            console.log('図形の選択を解除しました');
        }

        // 再描画
        this.redrawCanvas();
    }

    /**
     * マウス移動時の処理（プレビュー表示）
     * @param {MouseEvent} e - マウスイベント
     */
    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        // 方向矢印モードの場合、マウス位置にプレビュー表示
        if (this.currentShapeType === 'arrow-left' || this.currentShapeType === 'arrow-right' ||
            this.currentShapeType === 'arrow-up' || this.currentShapeType === 'arrow-down') {
            // 既存の図形を再描画
            this.redrawShapes();

            // プレビュー矢印を半透明で描画（透過率0.3で仮の状態を強調）
            this.ctx.save();
            this.ctx.globalAlpha = 0.3;

            if (this.isTextIncludedArrow) {
                // テキスト付き矢印
                this.drawTextIncludedArrow(currentX, currentY, this.currentShapeType, this.selectedShapeColor, this.selectedLineWidth);
            } else {
                // 記号のみ矢印
                this.drawArrow(currentX, currentY, this.currentShapeType, this.selectedShapeColor, this.selectedLineWidth);
            }

            this.ctx.restore();
            return;
        }

        // ドラッグ中でない場合は何もしない
        if (!this.isDrawing) return;

        // 既存の図形を再描画
        this.redrawShapes();

        // プレビュー図形を半透明で描画（透過率0.3で仮の状態を強調、矢印と同じUX）
        this.ctx.save();
        this.ctx.globalAlpha = 0.3;
        this.drawShape(this.currentShapeType, this.startX, this.startY, currentX, currentY, this.selectedShapeColor, this.selectedLineWidth, this.isTextIncludedArrow);
        this.ctx.restore();
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
            lineWidth: this.selectedLineWidth,
            canvasWidth: this.canvas.width,   // 描画時のキャンバス幅を記録
            canvasHeight: this.canvas.height, // 描画時のキャンバス高さを記録
            selected: false                   // 選択状態を初期化
        };

        this.pendingShapes.push(newShape);
        console.log('図形を描画しました（未確定）:', newShape);
        console.log('現在の未確定図形数:', this.pendingShapes.length);

        // 追加ボタンを有効化
        if (this.addShapeContinueBtn) {
            setEnabled(this.addShapeContinueBtn, true);
        }
        if (this.addShapeNewBtn) {
            setEnabled(this.addShapeNewBtn, true);
        }
        console.log('追加ボタンを有効化しました');

        // プレビュー表示を維持（redrawShapesで一時図形も描画される）
        this.redrawShapes();
    }

    /**
     * すべての未確定図形を確定して追加
     * @param {boolean} continueFromPrevious - 前の図形を継続表示するかどうか
     */
    confirmPendingShapes(continueFromPrevious) {
        console.log('confirmPendingShapes呼び出し - pendingShapes数:', this.pendingShapes.length);
        console.log('継続フラグ:', continueFromPrevious);

        if (this.pendingShapes.length === 0) {
            console.log('pendingShapesが空のため処理を中断');
            return;
        }

        // すべての未確定図形に継続フラグを追加して配列に追加
        this.pendingShapes.forEach(shape => {
            shape.continueFromPrevious = continueFromPrevious;
            this.shapes.push(shape);
        });
        console.log('図形を配列に追加しました。追加した図形数:', this.pendingShapes.length);
        console.log('現在の図形総数:', this.shapes.length);

        // pendingShapesをクリア
        this.pendingShapes = [];

        // ボタンを無効化
        if (this.addShapeContinueBtn) {
            setEnabled(this.addShapeContinueBtn, false);
        }
        if (this.addShapeNewBtn) {
            setEnabled(this.addShapeNewBtn, false);
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
     * 方向矢印をクリック位置に配置（C案）
     * @param {number} x - クリックX座標
     * @param {number} y - クリックY座標
     */
    placeArrowAtClick(x, y) {
        // 現在の動画時刻を取得
        const currentTime = videoPlayer ? videoPlayer.getCurrentTime() : 0;

        // 矢印データを作成
        const arrow = {
            time: currentTime,
            type: this.currentShapeType,
            x1: x,
            y1: y,
            x2: x,
            y2: y,
            color: this.selectedShapeColor,
            lineWidth: this.selectedLineWidth,
            canvasWidth: this.canvas.width,
            canvasHeight: this.canvas.height,
            continueFromPrevious: false,
            isTextIncluded: this.isTextIncludedArrow  // テキスト付き矢印フラグを保存
        };

        // pendingShapesに追加（一時保存、直線・四角形と同じ動作）
        this.pendingShapes.push(arrow);
        console.log('方向矢印を配置しました（未確定）:', arrow);
        console.log('現在の未確定図形数:', this.pendingShapes.length);

        // 追加ボタンを有効化
        if (this.addShapeContinueBtn) {
            setEnabled(this.addShapeContinueBtn, true);
        }
        if (this.addShapeNewBtn) {
            setEnabled(this.addShapeNewBtn, true);
        }
        console.log('追加ボタンを有効化しました');

        // 再描画
        this.redrawShapes();
    }

    /**
     * 選択された図形を削除
     */
    deleteSelectedShapes() {
        // 選択された図形を検索
        const selectedShapes = this.pendingShapes.filter(s => s.selected);

        if (selectedShapes.length === 0) {
            console.log('選択された図形がありません');
            alert('削除する図形を選択してください');
            return;
        }

        console.log('選択された図形を削除します。削除数:', selectedShapes.length);

        // 選択された図形を削除
        this.pendingShapes = this.pendingShapes.filter(s => !s.selected);

        // pendingShapes が空になった場合、ボタンを無効化
        if (this.pendingShapes.length === 0) {
            if (this.addShapeContinueBtn) {
                setEnabled(this.addShapeContinueBtn, false);
            }
            if (this.addShapeNewBtn) {
                setEnabled(this.addShapeNewBtn, false);
            }
        }

        // 再描画
        this.redrawCanvas();

        console.log('選択された図形を削除しました');
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
     * @param {boolean} isTextIncluded - テキスト付き矢印かどうか
     */
    drawShape(type, x1, y1, x2, y2, color, lineWidth = this.selectedLineWidth, isTextIncluded = false) {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.fillStyle = 'transparent';

        switch (type) {
            case 'rectangle':
                this.ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
                break;

            case 'line':
                this.ctx.beginPath();
                this.ctx.moveTo(x1, y1);
                this.ctx.lineTo(x2, y2);
                this.ctx.stroke();
                break;

            case 'arrow-right':
            case 'arrow-left':
            case 'arrow-up':
            case 'arrow-down':
            case 'arrow':  // 後方互換性
                if (isTextIncluded) {
                    this.drawTextIncludedArrow(x2, y2, type, color, lineWidth);
                } else {
                    this.drawArrow(x2, y2, type, color, lineWidth);
                }
                break;
        }
    }

    /**
     * 矢印を描画（Unicode記号）
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {string} arrowType - 矢印のタイプ
     * @param {string} color - 色
     * @param {number} lineWidth - 枠線の太さ
     */
    drawArrow(x, y, arrowType, color, lineWidth = null) {
        // lineWidthをフォントサイズに変換
        const currentLineWidth = lineWidth || this.ctx.lineWidth || this.selectedLineWidth;
        const fontSize = 16 + (currentLineWidth * 4.8);

        // 矢印のタイプに応じてUnicode記号を選択
        let arrowSymbol = '➡';  // デフォルト：右向き
        if (arrowType === 'arrow-left') arrowSymbol = '⬅';
        else if (arrowType === 'arrow-up') arrowSymbol = '⬆';
        else if (arrowType === 'arrow-down') arrowSymbol = '⬇';
        else if (arrowType === 'arrow' || arrowType === 'arrow-right') arrowSymbol = '➡';

        // テキストとして描画
        this.ctx.font = `${fontSize}px sans-serif`;
        this.ctx.fillStyle = color;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(arrowSymbol, x, y);
    }

    /**
     * テキスト付き矢印を描画（背景色なし）
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {string} arrowType - 矢印のタイプ
     * @param {string} color - 色
     * @param {number} lineWidth - 枠線の太さ
     */
    drawTextIncludedArrow(x, y, arrowType, color, lineWidth = null) {
        const currentLineWidth = lineWidth || this.ctx.lineWidth || this.selectedLineWidth;
        const fontSize = 16 + (currentLineWidth * 4.8);

        // 矢印タイプに応じてテキストと色を決定
        let text = '';
        let textColor = '';

        if (arrowType === 'arrow-left') {
            text = '⬅ 左';
            textColor = '#1976D2'; // 青
        } else if (arrowType === 'arrow-right') {
            text = '右 ➡';
            textColor = '#FF9800'; // 橙
        } else if (arrowType === 'arrow-up') {
            text = '⬆ 上';
            textColor = '#4CAF50'; // 緑
        } else if (arrowType === 'arrow-down') {
            text = '⬇ 下';
            textColor = '#F44336'; // 赤
        }

        // テキストを描画（背景なし）
        this.ctx.font = `${fontSize}px sans-serif`;
        this.ctx.fillStyle = textColor;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, x, y);
    }

    /**
     * 現在時刻で有効な図形を取得
     * @param {number} currentTime - 現在時刻（秒）
     * @returns {Array} 有効な図形の配列
     */
    getActiveShapesAtTime(currentTime) {
        if (this.shapes.length === 0) return [];

        const activeShapes = [];
        let continueCollecting = true;

        // 現在時刻以前の図形を逆順で走査
        for (let i = this.shapes.length - 1; i >= 0; i--) {
            const shape = this.shapes[i];

            // 現在時刻より未来の図形はスキップ
            if (shape.time > currentTime) continue;

            // 「図形なし」が見つかったらそれ以降の図形を無効化
            if (shape.type === '') {
                break;
            }

            // 図形を追加
            activeShapes.push(shape);

            // 継続フラグがfalseの場合、これ以上前の図形は表示しない
            if (shape.continueFromPrevious === false) {
                break;
            }

            // 継続フラグがundefined（古いデータ）の場合、同じタイムスタンプのみ表示（後方互換性）
            if (shape.continueFromPrevious === undefined) {
                const currentShapeTime = shape.time;
                // 同じタイムスタンプの図形をすべて追加
                for (let j = i - 1; j >= 0; j--) {
                    if (this.shapes[j].time > currentTime) continue;
                    if (this.shapes[j].type === '') break;
                    if (this.shapes[j].time === currentShapeTime) {
                        activeShapes.push(this.shapes[j]);
                    } else {
                        break;
                    }
                }
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
                // スケール係数を計算（図形保存時のキャンバスサイズと現在のキャンバスサイズの比率）
                let x1 = shape.x1;
                let y1 = shape.y1;
                let x2 = shape.x2;
                let y2 = shape.y2;

                if (shape.canvasWidth && shape.canvasHeight) {
                    const scaleX = this.canvas.width / shape.canvasWidth;
                    const scaleY = this.canvas.height / shape.canvasHeight;
                    x1 = shape.x1 * scaleX;
                    y1 = shape.y1 * scaleY;
                    x2 = shape.x2 * scaleX;
                    y2 = shape.y2 * scaleY;
                }

                // 後方互換性: lineWidthがない場合はデフォルト値5を使用
                const lineWidth = shape.lineWidth || 5;
                const isTextIncluded = shape.isTextIncluded || false;
                this.drawShape(shape.type, x1, y1, x2, y2, shape.color, lineWidth, isTextIncluded);
            });
        }

        // 一時図形（未確定）もすべて描画
        this.pendingShapes.forEach(shape => {
            // 選択された図形は破線と透明度で強調表示
            if (shape.selected) {
                this.ctx.save();
                this.ctx.globalAlpha = 0.5;  // 透明度50%
                this.ctx.setLineDash([5, 5]); // 破線（5px線、5px空白）
            }

            this.drawShape(
                shape.type,
                shape.x1,
                shape.y1,
                shape.x2,
                shape.y2,
                shape.color,  // 元の色のまま
                shape.lineWidth || this.selectedLineWidth,
                shape.isTextIncluded || false
            );

            if (shape.selected) {
                this.ctx.restore();  // 設定を元に戻す
            }
        });
    }

    /**
     * キャンバス全体を再描画（redrawShapes のエイリアス）
     */
    redrawCanvas() {
        this.redrawShapes();
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
            'arrow-right': '➡',
            'arrow-left': '⬅',
            'arrow-up': '⬆',
            'arrow-down': '⬇',
            arrow: '➡',  // 後方互換性
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

        // カスタム枠線の太さ入力欄を有効化
        if (this.customLineWidthInput) {
            this.customLineWidthInput.disabled = false;
        }

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
