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
        if (!videoPlayer || !videoPlayer.video) return;

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

        // 画像として保存
        this.extractCanvas.toBlob((blob) => {
            if (!blob) return;

            // Blob URLを作成
            const url = createBlobUrl(blob);

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
        }, 'image/png');
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
            ctx.lineWidth = 5;

            switch (shape.type) {
                case 'rectangle':
                    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
                    break;

                case 'circle':
                    const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                    ctx.beginPath();
                    ctx.arc(x1, y1, radius, 0, 2 * Math.PI);
                    ctx.stroke();
                    break;

                case 'arrow':
                    this.drawArrowOnCanvas(ctx, x1, y1, x2, y2);
                    break;

                case 'line':
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                    break;
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
        const annotation = annotationManager.getAnnotationAtTime(currentTime);
        if (!annotation || !annotation.text) return;

        // テキスト設定
        const fontSize = Math.floor(video.videoHeight * 0.05); // 動画高さの5%
        ctx.font = `bold ${fontSize}px "Hiragino Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // テキストサイズを測定
        const textMetrics = ctx.measureText(annotation.text);
        const textWidth = textMetrics.width;
        const textHeight = fontSize * 1.4;

        // 背景位置（画面上部中央）
        const bgX = video.videoWidth / 2 - textWidth / 2 - 20;
        const bgY = 20;
        const bgWidth = textWidth + 40;
        const bgHeight = textHeight + 20;

        // 背景を描画
        ctx.fillStyle = annotation.bgColor;
        ctx.fillRect(bgX, bgY, bgWidth, bgHeight);

        // テキストを描画
        ctx.fillStyle = annotation.textColor;
        ctx.fillText(annotation.text, video.videoWidth / 2, bgY + 10);
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
