// videoPlayer.js - 動画再生制御
// 動画の再生、一時停止、シーク、速度変更などを管理

class VideoPlayer {
    constructor() {
        // DOM要素
        this.video = document.getElementById('videoPlayer');
        this.currentTimeDisplay = document.getElementById('currentTime');
        this.playbackSpeedInput = document.getElementById('playbackSpeed');
        this.projectTitleInput = document.getElementById('projectTitle');
        this.textAnnotationDisplay = document.getElementById('textAnnotationDisplay');
        this.detailTextDisplay = document.getElementById('detailTextDisplay');

        // 動画の状態
        this.isLoaded = false;
        this.duration = 0;

        // コールバック
        this.onLoadedCallback = null;
        this.onTimeUpdateCallback = null;
    }

    /**
     * 初期化
     */
    init() {
        if (!this.video) {
            console.error('動画要素が見つかりません');
            return;
        }

        // 動画イベントの設定
        this.setupVideoEvents();

        // 再生速度変更
        if (this.playbackSpeedInput) {
            this.playbackSpeedInput.addEventListener('change', () => {
                this.setPlaybackSpeed(parseFloat(this.playbackSpeedInput.value));
            });
        }
    }

    /**
     * 動画イベントを設定
     */
    setupVideoEvents() {
        // メタデータ読み込み完了
        this.video.addEventListener('loadedmetadata', () => {
            this.duration = this.video.duration;
            this.isLoaded = true;

            // UIを有効化
            setEnabled(this.playbackSpeedInput, true);

            // コールバック実行
            if (this.onLoadedCallback) {
                this.onLoadedCallback(this.duration);
            }
        });

        // 時刻更新
        this.video.addEventListener('timeupdate', () => {
            const currentTime = this.video.currentTime;

            // 現在時刻を表示
            if (this.currentTimeDisplay) {
                this.currentTimeDisplay.textContent = formatTimeWithDecimal(currentTime);
            }

            // テキスト注釈を表示
            this.updateTextAnnotationDisplay(currentTime);

            // 図形アノテーションの時刻を更新
            if (shapeAnnotationManager) {
                shapeAnnotationManager.updateCurrentTime(currentTime);
            }

            // 詳細テキストの時刻を更新
            if (detailTextManager) {
                detailTextManager.updateCurrentTime(currentTime);
            }

            // 詳細テキストを表示
            this.updateDetailTextDisplay(currentTime);

            // コールバック実行
            if (this.onTimeUpdateCallback) {
                this.onTimeUpdateCallback(currentTime);
            }
        });
    }

    /**
     * 動画ソースを設定
     * @param {string} url - 動画URL
     */
    loadVideo(url) {
        this.video.src = url;
        this.video.load();
    }

    /**
     * 再生
     */
    play() {
        this.video.play();
    }

    /**
     * 一時停止
     */
    pause() {
        this.video.pause();
    }

    /**
     * 現在時刻を取得
     * @returns {number} 現在時刻（秒）
     */
    getCurrentTime() {
        return this.video.currentTime;
    }

    /**
     * 現在時刻を設定
     * @param {number} time - 時刻（秒）
     */
    setCurrentTime(time) {
        this.video.currentTime = Math.max(0, Math.min(time, this.duration));
    }

    /**
     * 再生速度を設定
     * @param {number} speed - 再生速度
     */
    setPlaybackSpeed(speed) {
        this.video.playbackRate = speed;
    }

    /**
     * 動画の長さを取得
     * @returns {number} 長さ（秒）
     */
    getDuration() {
        return this.duration;
    }

    /**
     * 動画読み込み完了時のコールバックを設定
     * @param {Function} callback - コールバック関数
     */
    onLoaded(callback) {
        this.onLoadedCallback = callback;
    }

    /**
     * 時刻更新時のコールバックを設定
     * @param {Function} callback - コールバック関数
     */
    onTimeUpdate(callback) {
        this.onTimeUpdateCallback = callback;
    }

    /**
     * プロジェクトタイトルを設定
     * @param {string} title - タイトル
     */
    setProjectTitle(title) {
        if (this.projectTitleInput) {
            this.projectTitleInput.value = title;
            setEnabled(this.projectTitleInput, true);
        }
    }

    /**
     * テキスト注釈の表示を更新
     * @param {number} currentTime - 現在時刻（秒）
     */
    updateTextAnnotationDisplay(currentTime) {
        if (!this.textAnnotationDisplay || !annotationManager) return;

        // 現在時刻で有効な注釈を取得（継続表示）
        const annotation = annotationManager.getActiveAnnotationAtTime(currentTime);

        if (annotation && annotation.text) {
            // 注釈がある場合は表示
            this.textAnnotationDisplay.textContent = annotation.text;
            this.textAnnotationDisplay.style.color = annotation.textColor;
            this.textAnnotationDisplay.style.backgroundColor = annotation.bgColor;
            this.textAnnotationDisplay.classList.add('visible');
        } else {
            // 注釈がない場合は非表示
            this.textAnnotationDisplay.textContent = '';
            this.textAnnotationDisplay.classList.remove('visible');
        }
    }

    /**
     * 詳細テキストの表示を更新
     * @param {number} currentTime - 現在時刻（秒）
     */
    updateDetailTextDisplay(currentTime) {
        if (!this.detailTextDisplay || !detailTextManager) return;

        // 現在時刻で有効な詳細テキストを取得
        const detailTexts = detailTextManager.getDetailTexts();

        // 詳細テキストを時刻順にソート済みと仮定
        // 現在時刻以前で最も近い詳細テキストを見つける
        let activeDetailText = null;
        for (let i = 0; i < detailTexts.length; i++) {
            if (detailTexts[i].time <= currentTime) {
                // 次の詳細テキストがあるか確認
                if (i < detailTexts.length - 1) {
                    // 次の詳細テキストの時刻前であれば、このテキストを表示
                    if (currentTime < detailTexts[i + 1].time) {
                        activeDetailText = detailTexts[i];
                        break;
                    }
                } else {
                    // 最後の詳細テキストであれば、動画終了まで表示
                    activeDetailText = detailTexts[i];
                    break;
                }
            }
        }

        if (activeDetailText && activeDetailText.text) {
            // 詳細テキストがある場合は表示
            this.detailTextDisplay.textContent = activeDetailText.text;
            this.detailTextDisplay.style.color = activeDetailText.textColor;
            this.detailTextDisplay.style.backgroundColor = activeDetailText.bgColor;
            this.detailTextDisplay.classList.add('visible');
        } else {
            // 詳細テキストがない場合は非表示
            this.detailTextDisplay.textContent = '';
            this.detailTextDisplay.classList.remove('visible');
        }
    }
}

// グローバルインスタンス
const videoPlayer = new VideoPlayer();
