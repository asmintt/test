// fileHandler.js - ファイル選択・読み込み処理
// 動画ファイルの選択、ドロップ、読み込みを担当

class FileHandler {
    constructor() {
        // DOM要素
        this.fileInput = document.getElementById('videoInput');
        this.fileLabel = this.fileInput?.nextElementSibling;
        this.fileNameDisplay = document.getElementById('fileName');

        // 選択された動画ファイル
        this.currentFile = null;

        // コールバック関数
        this.onFileLoadedCallback = null;
    }

    /**
     * 初期化 - イベントリスナーを設定
     */
    init() {
        if (!this.fileInput) {
            console.error('ファイル入力要素が見つかりません');
            return;
        }

        // ファイル選択イベント
        this.fileInput.addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files[0]);
        });

        // ドラッグ＆ドロップのイベント
        this.setupDragAndDrop();
    }

    /**
     * ドラッグ＆ドロップ機能を設定
     */
    setupDragAndDrop() {
        const dropZone = this.fileLabel;
        if (!dropZone) return;

        // ドラッグオーバー時
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        // ドラッグ離脱時
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        // ドロップ時
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelect(files[0]);
            }
        });
    }

    /**
     * ファイルが選択されたときの処理
     * @param {File} file - 選択されたファイル
     */
    handleFileSelect(file) {
        if (!file) return;

        // 動画ファイルかチェック
        if (!file.type.startsWith('video/')) {
            alert('動画ファイルを選択してください');
            return;
        }

        // ファイル名を表示
        this.fileNameDisplay.textContent = `選択中: ${file.name}`;

        // 現在のファイルを保存
        this.currentFile = file;

        // 動画を読み込み
        this.loadVideo(file);
    }

    /**
     * 動画ファイルを読み込み
     * @param {File} file - 動画ファイル
     */
    loadVideo(file) {
        // Blob URLを作成
        const videoUrl = createBlobUrl(file);

        // コールバックを実行
        if (this.onFileLoadedCallback) {
            this.onFileLoadedCallback(videoUrl, file);
        }
    }

    /**
     * ファイル読み込み完了時のコールバックを設定
     * @param {Function} callback - コールバック関数
     */
    onFileLoaded(callback) {
        this.onFileLoadedCallback = callback;
    }

    /**
     * 現在のファイルを取得
     * @returns {File|null} 現在のファイル
     */
    getCurrentFile() {
        return this.currentFile;
    }

    /**
     * 現在のファイル名（拡張子なし）を取得
     * @returns {string} ファイル名
     */
    getCurrentFileName() {
        if (!this.currentFile) return '';
        return getFileNameWithoutExtension(this.currentFile.name);
    }
}

// グローバルインスタンス
const fileHandler = new FileHandler();
