// videoTrimmer.js - 動画トリミング機能
// 選択範囲の動画を切り出してダウンロード

class VideoTrimmer {
    constructor() {
        // DOM要素
        this.downloadVideoBtn = document.getElementById('downloadVideoBtn');
        this.includeAudio = document.getElementById('includeAudio');
        this.includeVideoAnnotations = document.getElementById('includeVideoAnnotations');

        // トリミング処理中フラグ
        this.isTrimming = false;
    }

    /**
     * 初期化
     */
    init() {
        // ダウンロードボタン
        if (this.downloadVideoBtn) {
            this.downloadVideoBtn.addEventListener('click', () => {
                this.trimAndDownloadVideo();
            });
        }

        // Electronからの進捗通知を受け取る
        if (window.electronApi && window.electronApi.onTrimProgress) {
            window.electronApi.onTrimProgress((progress) => {
                this.handleProgress(progress);
            });
        }
    }

    /**
     * 動画読み込み時の設定
     */
    onVideoLoaded() {
        // ボタンを有効化
        setEnabledMultiple([
            this.downloadVideoBtn,
            this.includeAudio,
            this.includeVideoAnnotations
        ], true);
    }

    /**
     * 動画をトリミングしてダウンロード
     */
    async trimAndDownloadVideo() {
        if (this.isTrimming) {
            alert('処理中です。しばらくお待ちください。');
            return;
        }

        if (!fileHandler || !fileHandler.currentFile) {
            alert('動画ファイルが読み込まれていません');
            return;
        }

        if (!rangeSelector) {
            alert('範囲選択が利用できません');
            return;
        }

        // Electron APIが利用可能かチェック
        if (!window.electronApi || !window.electronApi.trimVideo) {
            alert('この機能はデスクトップアプリ版でのみ利用できます');
            return;
        }

        this.isTrimming = true;
        this.downloadVideoBtn.textContent = '処理中...';
        this.downloadVideoBtn.disabled = true;

        try {
            // トリミングパラメータ
            const startTime = rangeSelector.getStartTime();
            const endTime = rangeSelector.getEndTime();
            const includeAudio = this.includeAudio.checked;
            const includeAnnotations = this.includeVideoAnnotations.checked;
            const projectTitle = videoPlayer.projectTitleInput?.value || fileHandler.getCurrentFileName();

            // 注釈データを取得
            let annotations = [];
            let shapes = [];
            let detailTexts = [];
            let arrows = [];
            if (includeAnnotations && annotationManager) {
                annotations = annotationManager.getAnnotations();
            }
            if (includeAnnotations && shapeAnnotationManager) {
                shapes = shapeAnnotationManager.getShapes();
            }
            if (includeAnnotations && detailTextManager) {
                detailTexts = detailTextManager.getDetailTexts();
            }
            if (includeAnnotations && arrowAnnotationManager) {
                arrows = arrowAnnotationManager.getArrows();
            }

            // 動画の実際のサイズと表示サイズを取得（座標変換用）
            const video = videoPlayer.video;
            const videoScale = {
                actualWidth: video.videoWidth,
                actualHeight: video.videoHeight,
                displayWidth: video.offsetWidth,
                displayHeight: video.offsetHeight
            };

            // 再生速度を取得
            const playbackSpeed = video.playbackRate || 1.0;

            // ファイルをArrayBufferとして読み込む
            const arrayBuffer = await this.readFileAsArrayBuffer(fileHandler.currentFile);

            // Electronのメインプロセスにトリミングを依頼
            const result = await window.electronApi.trimVideo({
                videoData: arrayBuffer,
                startTime: startTime,
                duration: endTime - startTime,
                includeAudio: includeAudio,
                includeAnnotations: includeAnnotations,
                annotations: annotations,
                shapes: shapes,
                detailTexts: detailTexts,
                arrows: arrows,
                videoScale: videoScale,
                speed: playbackSpeed,
                filename: projectTitle
            });

            if (result.success) {
                // 成功時: ファイルが保存された
                alert(`動画を保存しました:\n${result.outputPath}`);
            } else {
                // エラー
                alert(`動画の処理に失敗しました:\n${result.error}`);
            }

        } catch (error) {
            console.error('動画トリミングエラー:', error);
            alert(`エラーが発生しました:\n${error.message}`);
        } finally {
            this.isTrimming = false;
            this.downloadVideoBtn.textContent = '⬇ トリミング動画をダウンロード';
            this.downloadVideoBtn.disabled = false;
        }
    }

    /**
     * ファイルをArrayBufferとして読み込む
     * @param {File} file - ファイルオブジェクト
     * @returns {Promise<ArrayBuffer>} ArrayBuffer
     */
    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                resolve(e.target.result);
            };

            reader.onerror = (e) => {
                reject(new Error('ファイルの読み込みに失敗しました'));
            };

            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * 進捗を処理
     * @param {Object} progress - 進捗情報
     */
    handleProgress(progress) {
        if (progress.percent) {
            // 進捗パーセントを表示
            this.downloadVideoBtn.textContent = `処理中... ${Math.floor(progress.percent)}%`;
        }
    }
}

// グローバルインスタンス
const videoTrimmer = new VideoTrimmer();
