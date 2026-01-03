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
        this.currentVideoUrl = null; // 現在の動画URL

        // 注釈フォントサイズ用の統一縮小係数
        this.globalScaleFactor = 1.0;

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

            // コールバック実行（新しい動画の場合のみ）
            if (this.isNewVideo && this.onLoadedCallback) {
                console.log('新しい動画を読み込みました:', this.currentVideoUrl);
                this.onLoadedCallback(this.duration);
                this.isNewVideo = false; // フラグをリセット
            } else {
                console.log('同じ動画のloadedmetadataイベント（データクリアをスキップ）');
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

        // エラーイベント
        this.video.addEventListener('error', () => {
            const error = this.video.error;
            let message = '動画の読み込みに失敗しました';

            if (error) {
                switch (error.code) {
                    case error.MEDIA_ERR_ABORTED:
                        message = '動画の読み込みが中断されました';
                        break;
                    case error.MEDIA_ERR_NETWORK:
                        message = 'ネットワークエラーが発生しました';
                        break;
                    case error.MEDIA_ERR_DECODE:
                        message = '動画のデコードに失敗しました（コーデック非対応の可能性）';
                        break;
                    case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                        message = 'この動画形式はサポートされていません';
                        break;
                }
            }

            handleError(new Error(message), '動画再生');
            this.isLoaded = false;
        });
    }

    /**
     * 動画ソースを設定
     * @param {string} url - 動画URL
     */
    loadVideo(url) {
        // URLが変わった場合のみ、新しい動画としてフラグを立てる
        this.isNewVideo = (url !== this.currentVideoUrl);
        this.currentVideoUrl = url;

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
     * プロジェクトタイトルを取得
     * @returns {string} タイトル
     */
    getProjectTitle() {
        if (this.projectTitleInput) {
            const title = this.projectTitleInput.value.trim();
            return title || this.projectTitleInput.placeholder;
        }
        return '';
    }

    /**
     * 全注釈の最大文字数を基準に統一フォントサイズの縮小係数を計算
     */
    calculateGlobalScaleFactor() {
        if (!annotationManager) return;

        const allAnnotations = annotationManager.annotations;
        let globalMaxLength = 10;

        allAnnotations.forEach(ann => {
            const text1Length = (ann.text1 || '').length;
            const text2Length = (ann.text2 || '').length;
            const maxLength = Math.max(text1Length, text2Length);
            globalMaxLength = Math.max(globalMaxLength, maxLength);
        });

        // 全注釈で共通の縮小係数を計算
        let scaleFactor = 1.0;
        if (globalMaxLength > 10) {
            scaleFactor = 10 / globalMaxLength;
            scaleFactor = Math.max(scaleFactor, 0.7); // 最小70%サイズ（最大30%縮小）
        }

        this.globalScaleFactor = scaleFactor;
        console.log(`全注釈統一フォントサイズ: 最大${globalMaxLength}文字, 縮小係数=${scaleFactor.toFixed(2)}`);
    }

    /**
     * テキスト注釈の表示を更新（2行表示）
     * @param {number} currentTime - 現在時刻（秒）
     */
    updateTextAnnotationDisplay(currentTime) {
        if (!this.textAnnotationDisplay || !annotationManager) return;

        // 現在時刻で有効な注釈を取得（継続表示）
        const annotation = annotationManager.getActiveAnnotationAtTime(currentTime);

        if (annotation && (annotation.text1 || annotation.text2)) {
            // 表示されている動画の高さの5%をベースにする（ダウンロード動画と同じ比率）
            const baseSize = Math.floor(this.video.clientHeight * 0.05);

            // 全注釈で統一されたフォントサイズを計算
            const fontSize = Math.floor(baseSize * this.globalScaleFactor);

            // 2行テキストを改行で結合
            const displayText = (annotation.text1 || '') + '\n' + (annotation.text2 || '');

            // 注釈がある場合は表示
            this.textAnnotationDisplay.textContent = displayText;
            this.textAnnotationDisplay.style.color = annotation.textColor;
            this.textAnnotationDisplay.style.backgroundColor = annotation.bgColor;
            this.textAnnotationDisplay.style.fontFamily = `"${annotation.font || 'Noto Sans JP'}", sans-serif`;
            this.textAnnotationDisplay.style.fontWeight = 'bold';
            this.textAnnotationDisplay.style.fontSize = `${fontSize}px`;
            this.textAnnotationDisplay.style.whiteSpace = 'pre-line';
            this.textAnnotationDisplay.style.textAlign = annotation.textAlign || 'center';
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

        // 現在時刻以前のテキストを抽出し、その中で最も時刻が近いものを取得
        const activeDetailText = detailTexts
            .filter(text => text.time <= currentTime)
            .reduce((latest, current) =>
                !latest || current.time > latest.time ? current : latest
            , null);

        if (activeDetailText && activeDetailText.text) {
            // 詳細テキストがある場合は表示
            // 内側のボックスを作成して背景色を適用
            const textBox = document.createElement('span');
            textBox.className = 'detail-text-box';
            textBox.textContent = activeDetailText.text;
            textBox.style.color = activeDetailText.textColor;

            // 背景色に透明度を適用
            const bgColor = activeDetailText.bgColor || '#FFFFFF';
            const bgOpacity = activeDetailText.bgOpacity !== undefined ? activeDetailText.bgOpacity : 1.0;
            textBox.style.backgroundColor = bgColor;
            textBox.style.opacity = bgOpacity;

            // 文字位置を適用
            const textAlign = activeDetailText.textAlign || 'left';
            const justifyContent = textAlign === 'left' ? 'flex-start' : (textAlign === 'right' ? 'flex-end' : 'center');
            this.detailTextDisplay.style.justifyContent = justifyContent;

            // コンテナをクリアして新しいボックスを追加
            this.detailTextDisplay.innerHTML = '';
            this.detailTextDisplay.appendChild(textBox);
            this.detailTextDisplay.classList.add('visible');
        } else {
            // 詳細テキストがない場合は非表示
            this.detailTextDisplay.innerHTML = '';
            this.detailTextDisplay.classList.remove('visible');
        }
    }
}

// グローバルインスタンス
const videoPlayer = new VideoPlayer();
