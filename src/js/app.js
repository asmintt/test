// app.js - アプリケーションメイン
// すべてのモジュールを初期化し、連携させる

class App {
    constructor() {
        // アプリケーション準備完了フラグ
        this.isReady = false;
    }

    /**
     * アプリケーション初期化
     */
    init() {
        // DOMが読み込まれるまで待機
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setup();
            });
        } else {
            this.setup();
        }
    }

    /**
     * セットアップ処理
     */
    setup() {
        console.log('MovieFrameSnap Lite を起動中...');

        // 各モジュールを初期化
        this.initializeModules();

        // モジュール間の連携を設定
        this.setupModuleConnections();

        this.isReady = true;
        console.log('MovieFrameSnap Lite 起動完了');
    }

    /**
     * 各モジュールを初期化
     */
    initializeModules() {
        // タブ切り替え機能を初期化
        this.initializeTabs();

        // ファイルハンドラー
        if (typeof fileHandler !== 'undefined') {
            fileHandler.init();
            console.log('✓ FileHandler initialized');
        }

        // 動画プレイヤー
        if (typeof videoPlayer !== 'undefined') {
            videoPlayer.init();
            console.log('✓ VideoPlayer initialized');
        }

        // 範囲セレクター
        if (typeof rangeSelector !== 'undefined') {
            rangeSelector.init();
            console.log('✓ RangeSelector initialized');
        }

        // 注釈マネージャー
        if (typeof annotationManager !== 'undefined') {
            annotationManager.init();
            console.log('✓ AnnotationManager initialized');
        }

        // 図形アノテーションマネージャー
        if (typeof shapeAnnotationManager !== 'undefined') {
            shapeAnnotationManager.init();
            console.log('✓ ShapeAnnotationManager initialized');
        }

        // 詳細テキストマネージャー
        if (typeof detailTextManager !== 'undefined') {
            detailTextManager.init();
            console.log('✓ DetailTextManager initialized');
        }

        // フレーム抽出
        if (typeof frameExtractor !== 'undefined') {
            frameExtractor.init();
            console.log('✓ FrameExtractor initialized');
        }

        // 動画トリミング
        if (typeof videoTrimmer !== 'undefined') {
            videoTrimmer.init();
            console.log('✓ VideoTrimmer initialized');
        }

        // プロジェクトマネージャー
        if (typeof projectManager !== 'undefined') {
            projectManager.init();
            console.log('✓ ProjectManager initialized');
        }
    }

    /**
     * タブ切り替え機能を初期化
     */
    initializeTabs() {
        // 右サイドバーのタブ（テキスト注釈、図形、詳細テキスト）
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');

                // すべてのタブボタンとコンテンツから active クラスを削除
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));

                // クリックされたタブボタンとコンテンツに active クラスを追加
                button.classList.add('active');
                const targetContent = document.getElementById(targetTab + 'Tab');
                if (targetContent) {
                    targetContent.classList.add('active');
                }

                console.log('タブ切り替え:', targetTab);
            });
        });

        // 左サイドバーの開始タブ（新規作成、既存を開く）
        const startTabButtons = document.querySelectorAll('.start-tab-btn');
        const startTabContents = document.querySelectorAll('.start-tab-content');

        startTabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-start-tab');

                // すべてのタブボタンとコンテンツから active クラスを削除
                startTabButtons.forEach(btn => btn.classList.remove('active'));
                startTabContents.forEach(content => content.classList.remove('active'));

                // クリックされたタブボタンとコンテンツに active クラスを追加
                button.classList.add('active');
                const targetContent = document.getElementById(targetTab === 'new' ? 'newProjectTab' : 'openProjectTab');
                if (targetContent) {
                    targetContent.classList.add('active');
                }

                console.log('開始タブ切り替え:', targetTab);
            });
        });

        console.log('✓ Tab navigation initialized');
    }

    /**
     * モジュール間の連携を設定
     */
    setupModuleConnections() {
        // ファイル読み込み完了時の処理
        if (fileHandler) {
            fileHandler.onFileLoaded((videoUrl, file) => {
                this.handleFileLoaded(videoUrl, file);
            });
        }

        // 動画メタデータ読み込み完了時の処理
        if (videoPlayer) {
            videoPlayer.onLoaded((duration) => {
                this.handleVideoLoaded(duration);
            });

            // 動画の時刻更新時の処理
            videoPlayer.onTimeUpdate((currentTime) => {
                this.handleTimeUpdate(currentTime);
            });
        }
    }

    /**
     * ファイル読み込み完了時の処理
     * @param {string} videoUrl - 動画のBlob URL
     * @param {File} file - ファイルオブジェクト
     */
    handleFileLoaded(videoUrl, file) {
        console.log('動画ファイル読み込み:', file.name);

        // 動画プレイヤーに動画をセット
        if (videoPlayer) {
            videoPlayer.loadVideo(videoUrl);

            // プロジェクトタイトルを設定（拡張子なしのファイル名）
            const titleWithoutExt = fileHandler.getCurrentFileName();
            videoPlayer.setProjectTitle(titleWithoutExt);
        }
    }

    /**
     * 動画メタデータ読み込み完了時の処理
     * @param {number} duration - 動画の長さ（秒）
     */
    handleVideoLoaded(duration) {
        console.log('動画読み込み完了 (長さ:', formatTime(duration), ')');

        // 範囲セレクターに動画の長さを設定
        if (rangeSelector) {
            rangeSelector.setDuration(duration);
        }

        // 注釈マネージャーを有効化
        if (annotationManager) {
            annotationManager.onVideoLoaded();
        }

        // 図形アノテーションマネージャーを有効化
        if (shapeAnnotationManager) {
            shapeAnnotationManager.onVideoLoaded();
        }

        // 詳細テキストマネージャーを有効化
        if (detailTextManager) {
            detailTextManager.onVideoLoaded();
        }

        // フレーム抽出を有効化
        if (frameExtractor) {
            frameExtractor.onVideoLoaded();
        }

        // 動画トリミングを有効化
        if (videoTrimmer) {
            videoTrimmer.onVideoLoaded();
        }

        // プロジェクトマネージャーを有効化
        if (projectManager && fileHandler) {
            const fileName = fileHandler.getCurrentFile().name;
            projectManager.onVideoLoaded(fileName);
        }
    }

    /**
     * 動画の時刻更新時の処理
     * @param {number} currentTime - 現在時刻（秒）
     */
    handleTimeUpdate(currentTime) {
        // 範囲再生の終了判定
        if (rangeSelector) {
            rangeSelector.checkRangePlayback(currentTime);
        }
    }
}

// アプリケーションのインスタンスを作成して初期化
const app = new App();
app.init();
