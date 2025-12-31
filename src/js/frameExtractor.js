// frameExtractor.js - フレーム抽出機能
// 動画の現在位置から画像を抽出し、注釈を含めて保存

class FrameExtractor {
    constructor() {
        // DOM要素
        this.extractFrameBtn = document.getElementById('extractFrameBtn');
        this.includeTimestamp = document.getElementById('includeTimestamp');
        this.includeShapes = document.getElementById('includeShapes');
        this.includeTextAnnotations = document.getElementById('includeTextAnnotations');
        this.imageGallery = document.getElementById('imageGallery');
        this.clearAllImagesBtn = document.getElementById('clearAllImagesBtn');

        // 抽出した画像データ
        // 各画像: { url: Blob URL, time: 秒数, timestamp: フォーマット済み時刻 }
        this.extractedImages = [];

        // 抽出用のキャンバス（非表示）
        this.extractCanvas = document.createElement('canvas');
        this.extractCtx = this.extractCanvas.getContext('2d');
    }

    /**
     * 初期化
     */
    init() {
        // 抽出ボタン
        if (this.extractFrameBtn) {
            this.extractFrameBtn.addEventListener('click', () => {
                this.extractCurrentFrame();
            });
        }

        // すべてクリアボタン
        if (this.clearAllImagesBtn) {
            this.clearAllImagesBtn.addEventListener('click', () => {
                this.confirmAndClearAll();
            });
        }
    }

    /**
     * 動画読み込み時の設定
     */
    onVideoLoaded() {
        // ボタンを有効化
        setEnabled(this.extractFrameBtn, true);

        // ギャラリーをクリア
        this.clearGallery();
    }

    /**
     * 現在位置のフレームを抽出
     */
    async extractCurrentFrame() {
        if (!videoPlayer || !videoPlayer.video) {
            handleError(new Error('動画が読み込まれていません'), 'フレーム抽出', true);
            return;
        }

        if (!videoPlayer.isLoaded) {
            handleError(new Error('動画のメタデータが読み込まれていません'), 'フレーム抽出', true);
            return;
        }

        try {
            const video = videoPlayer.video;
            const currentTime = videoPlayer.getCurrentTime();

            // キャンバスサイズを動画に合わせる
            this.extractCanvas.width = video.videoWidth;
            this.extractCanvas.height = video.videoHeight;

            // 動画フレームを描画
            this.extractCtx.drawImage(video, 0, 0);

            // 図形アノテーションを含める場合
            if (this.includeShapes && this.includeShapes.checked && shapeAnnotationManager) {
                this.drawShapesOnCanvas(this.extractCtx, video);
            }

            // テキスト注釈を含める場合
            if (this.includeTextAnnotations && this.includeTextAnnotations.checked && annotationManager) {
                this.drawTextAnnotationOnCanvas(this.extractCtx, currentTime, video);
            }

            // タイムスタンプを含める場合
            if (this.includeTimestamp && this.includeTimestamp.checked) {
                this.drawTimestampOnCanvas(this.extractCtx, currentTime);
            }

            // 画像として保存（Promiseでラップ）
            await new Promise((resolve, reject) => {
                this.extractCanvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('画像の生成に失敗しました'));
                        return;
                    }

                    try {
                        // Blob URLを作成
                        const url = createBlobUrl(blob);

                        if (!url) {
                            reject(new Error('画像URLの作成に失敗しました'));
                            return;
                        }

                        // 抽出画像データに追加
                        const imageData = {
                            url: url,
                            time: currentTime,
                            timestamp: formatTimeWithDecimal(currentTime),
                            blob: blob
                        };

                        this.extractedImages.push(imageData);

                        // ギャラリーに追加
                        this.addImageToGallery(imageData);
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                }, 'image/png');
            });

        } catch (error) {
            handleError(error, 'フレーム抽出処理');
        }
    }

    /**
     * 矩形を描画
     * @param {CanvasRenderingContext2D} ctx - キャンバスコンテキスト
     * @param {number} x1 - 開始X座標
     * @param {number} y1 - 開始Y座標
     * @param {number} x2 - 終了X座標
     * @param {number} y2 - 終了Y座標
     */
    drawRectangle(ctx, x1, y1, x2, y2) {
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    }

    /**
     * 円を描画
     * @param {CanvasRenderingContext2D} ctx - キャンバスコンテキスト
     * @param {number} x1 - 中心X座標
     * @param {number} y1 - 中心Y座標
     * @param {number} x2 - 外周点X座標
     * @param {number} y2 - 外周点Y座標
     */
    drawCircle(ctx, x1, y1, x2, y2) {
        const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        ctx.beginPath();
        ctx.arc(x1, y1, radius, 0, 2 * Math.PI);
        ctx.stroke();
    }

    /**
     * 直線を描画
     * @param {CanvasRenderingContext2D} ctx - キャンバスコンテキスト
     * @param {number} x1 - 開始X座標
     * @param {number} y1 - 開始Y座標
     * @param {number} x2 - 終了X座標
     * @param {number} y2 - 終了Y座標
     */
    drawLine(ctx, x1, y1, x2, y2) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    /**
     * 図形タイプに応じた描画メソッドを取得
     * @param {string} shapeType - 図形タイプ
     * @returns {Function} 描画メソッド
     */
    getShapeDrawMethod(shapeType) {
        const drawMethods = {
            'rectangle': this.drawRectangle.bind(this),
            'circle': this.drawCircle.bind(this),
            'arrow': this.drawArrowOnCanvas.bind(this),
            'line': this.drawLine.bind(this)
        };
        return drawMethods[shapeType] || null;
    }

    /**
     * キャンバスに図形を描画
     * @param {CanvasRenderingContext2D} ctx - キャンバスコンテキスト
     * @param {HTMLVideoElement} video - 動画要素
     */
    drawShapesOnCanvas(ctx, video) {
        const shapes = shapeAnnotationManager.getShapes();

        // スケール比率を計算（表示サイズ vs 実際の動画サイズ）
        const scaleX = video.videoWidth / video.offsetWidth;
        const scaleY = video.videoHeight / video.offsetHeight;

        shapes.forEach(shape => {
            // 座標をスケール変換
            const x1 = shape.x1 * scaleX;
            const y1 = shape.y1 * scaleY;
            const x2 = shape.x2 * scaleX;
            const y2 = shape.y2 * scaleY;

            ctx.strokeStyle = shape.color;
            // 後方互換性: lineWidthがない場合はデフォルト値5を使用
            ctx.lineWidth = shape.lineWidth || 5;

            // 図形タイプに応じた描画メソッドを実行
            const drawMethod = this.getShapeDrawMethod(shape.type);
            if (drawMethod) {
                drawMethod(ctx, x1, y1, x2, y2);
            }
        });
    }

    /**
     * キャンバスに矢印を描画
     * @param {CanvasRenderingContext2D} ctx - キャンバスコンテキスト
     * @param {number} x1 - 開始X座標
     * @param {number} y1 - 開始Y座標
     * @param {number} x2 - 終了X座標
     * @param {number} y2 - 終了Y座標
     */
    drawArrowOnCanvas(ctx, x1, y1, x2, y2) {
        const headLength = 30;
        const angle = Math.atan2(y2 - y1, x2 - x1);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(
            x2 - headLength * Math.cos(angle - Math.PI / 6),
            y2 - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(x2, y2);
        ctx.lineTo(
            x2 - headLength * Math.cos(angle + Math.PI / 6),
            y2 - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
    }

    /**
     * キャンバスにテキスト注釈を描画
     * @param {CanvasRenderingContext2D} ctx - キャンバスコンテキスト
     * @param {number} currentTime - 現在時刻
     * @param {HTMLVideoElement} video - 動画要素
     */
    drawTextAnnotationOnCanvas(ctx, currentTime, video) {
        const annotation = annotationManager.getActiveAnnotationAtTime(currentTime);
        if (!annotation || (!annotation.text1 && !annotation.text2)) return;

        // テキスト設定
        const fontSize = Math.floor(video.videoHeight * 0.05); // 動画高さの5%
        const fontFamily = annotation.font || 'Noto Sans JP';
        ctx.font = `bold ${fontSize}px "${fontFamily}", sans-serif`;
        ctx.textBaseline = 'top';

        // テキストサイズを測定（text1とtext2の両方）
        const text1 = annotation.text1 || '';
        const text2 = annotation.text2 || '';
        const text1Metrics = ctx.measureText(text1);
        const text2Metrics = ctx.measureText(text2);
        const maxTextWidth = Math.max(text1Metrics.width, text2Metrics.width);
        const lineHeight = fontSize * 1.4;
        const numLines = (text1 ? 1 : 0) + (text2 ? 1 : 0);
        const textHeight = lineHeight * numLines;

        // テキスト配置
        const textAlign = annotation.textAlign || 'center';
        let textX;
        if (textAlign === 'left') {
            ctx.textAlign = 'left';
            textX = 40;
        } else if (textAlign === 'right') {
            ctx.textAlign = 'left'; // 行頭を揃えるため、左寄せで描画
            textX = video.videoWidth - maxTextWidth - 40;
        } else {
            ctx.textAlign = 'left'; // 行頭を揃えるため、左寄せで描画
            textX = (video.videoWidth - maxTextWidth) / 2;
        }

        // 背景位置
        const bgX = textX - 20;
        const bgY = 20;
        const bgWidth = maxTextWidth + 40;
        const bgHeight = textHeight + 20;

        // 背景を描画
        ctx.fillStyle = annotation.bgColor;
        ctx.fillRect(bgX, bgY, bgWidth, bgHeight);

        // テキストを描画（行頭を揃える）
        ctx.fillStyle = annotation.textColor;
        let yOffset = bgY + 10;
        if (text1) {
            ctx.fillText(text1, textX, yOffset);
            yOffset += lineHeight;
        }
        if (text2) {
            ctx.fillText(text2, textX, yOffset);
        }
    }

    /**
     * キャンバスにタイムスタンプを描画
     * @param {CanvasRenderingContext2D} ctx - キャンバスコンテキスト
     * @param {number} currentTime - 現在時刻
     */
    drawTimestampOnCanvas(ctx, currentTime) {
        const timestamp = formatTimeWithDecimal(currentTime);
        const fontSize = 30;

        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';

        // 背景（半透明黒）
        const textMetrics = ctx.measureText(timestamp);
        const padding = 10;
        const bgX = this.extractCanvas.width - textMetrics.width - padding * 2;
        const bgY = this.extractCanvas.height - fontSize - padding * 2;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(bgX, bgY, textMetrics.width + padding * 2, fontSize + padding * 2);

        // テキスト（白）
        ctx.fillStyle = '#ffffff';
        ctx.fillText(timestamp, this.extractCanvas.width - padding, this.extractCanvas.height - padding);
    }

    /**
     * ギャラリーに画像を追加
     * @param {Object} imageData - 画像データ
     */
    addImageToGallery(imageData) {
        if (!this.imageGallery) return;

        // 空メッセージを削除
        const emptyMsg = this.imageGallery.querySelector('.empty-message');
        if (emptyMsg) {
            emptyMsg.remove();
        }

        // 画像アイテムを作成
        const item = document.createElement('div');
        item.className = 'gallery-item';

        const img = document.createElement('img');
        img.src = imageData.url;
        img.alt = `Frame at ${imageData.timestamp}`;

        const caption = document.createElement('div');
        caption.className = 'gallery-caption';
        caption.textContent = imageData.timestamp;

        // ダウンロードボタン
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn-download';
        downloadBtn.textContent = '保存';
        downloadBtn.addEventListener('click', () => {
            this.downloadImage(imageData);
        });

        item.appendChild(img);
        item.appendChild(caption);
        item.appendChild(downloadBtn);

        this.imageGallery.appendChild(item);

        // クリアボタンの表示を更新
        this.updateClearButtonVisibility();
    }

    /**
     * 画像をダウンロード
     * @param {Object} imageData - 画像データ
     */
    downloadImage(imageData) {
        const projectTitle = videoPlayer.projectTitleInput?.value || 'frame';
        const filename = `${projectTitle}_${imageData.timestamp.replace(/:/g, '-')}.png`;

        // ダウンロードリンクを作成
        const a = document.createElement('a');
        a.href = imageData.url;
        a.download = filename;
        a.click();
    }

    /**
     * ギャラリーをクリア
     */
    clearGallery() {
        if (!this.imageGallery) return;

        // Blob URLを解放
        this.extractedImages.forEach(img => {
            revokeBlobUrl(img.url);
        });

        // データをクリア
        this.extractedImages = [];

        // DOMをクリア
        this.imageGallery.innerHTML = '<p class="empty-message">画像が抽出されていません</p>';

        // クリアボタンの表示を更新
        this.updateClearButtonVisibility();
    }

    /**
     * 確認ダイアログを表示してすべてクリア
     */
    confirmAndClearAll() {
        if (this.extractedImages.length === 0) return;

        const confirmed = confirm(`抽出した画像 ${this.extractedImages.length} 枚をすべて削除しますか？`);
        if (confirmed) {
            this.clearGallery();
        }
    }

    /**
     * クリアボタンの表示/非表示を更新
     */
    updateClearButtonVisibility() {
        if (!this.clearAllImagesBtn) return;

        if (this.extractedImages.length > 0) {
            this.clearAllImagesBtn.style.display = 'block';
        } else {
            this.clearAllImagesBtn.style.display = 'none';
        }
    }
}

// グローバルインスタンス
const frameExtractor = new FrameExtractor();
