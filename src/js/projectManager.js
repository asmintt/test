// projectManager.js - プロジェクト保存・読み込み管理
// アノテーション情報をJSONファイルとして保存・読み込みする機能

class ProjectManager {
    constructor() {
        // DOM要素
        this.saveProjectBtn = document.getElementById('saveProjectBtn');
        this.loadProjectBtn = document.getElementById('loadProjectBtn');

        // 現在のプロジェクト情報
        this.currentVideoFileName = null;

        // プロジェクト読み込み中フラグ
        this.isLoadingProject = false;
    }

    /**
     * 初期化
     */
    init() {
        // プロジェクト保存ボタン
        if (this.saveProjectBtn) {
            this.saveProjectBtn.addEventListener('click', () => {
                this.saveProject();
            });
        }

        // プロジェクト読み込みボタン
        if (this.loadProjectBtn) {
            this.loadProjectBtn.addEventListener('click', () => {
                this.loadProjectFromFile();
            });
        }
    }

    /**
     * 動画読み込み時の設定
     */
    onVideoLoaded(fileName) {
        this.currentVideoFileName = fileName;

        // ボタンを有効化
        if (this.saveProjectBtn) {
            setEnabled(this.saveProjectBtn, true);
        }
        if (this.loadProjectBtn) {
            setEnabled(this.loadProjectBtn, true);
        }
    }

    /**
     * プロジェクトデータを収集
     * @returns {Object} プロジェクトデータ
     */
    collectProjectData() {
        const projectData = {
            version: APP_CONSTANTS.PROJECT_VERSION,
            videoFileName: this.currentVideoFileName,
            savedAt: new Date().toISOString(),
            annotations: [],
            shapes: [],
            detailTexts: [],
            range: {
                startTime: 0,
                endTime: 0
            }
        };

        // テキスト注釈を取得
        if (annotationManager) {
            projectData.annotations = annotationManager.getAnnotations();
            console.log('[DEBUG] テキスト注釈を収集:', projectData.annotations.length, '件', projectData.annotations);
        } else {
            console.warn('[DEBUG] annotationManager が存在しません');
        }

        // 図形アノテーションを取得
        if (shapeAnnotationManager) {
            projectData.shapes = shapeAnnotationManager.getShapes();
            console.log('[DEBUG] 図形アノテーションを収集:', projectData.shapes.length, '件', projectData.shapes);
        } else {
            console.warn('[DEBUG] shapeAnnotationManager が存在しません');
        }

        // 詳細テキストを取得
        if (detailTextManager) {
            projectData.detailTexts = detailTextManager.getDetailTexts();
            console.log('[DEBUG] 詳細テキストを収集:', projectData.detailTexts.length, '件', projectData.detailTexts);
        } else {
            console.warn('[DEBUG] detailTextManager が存在しません');
        }

        // 範囲情報を取得
        if (rangeSelector) {
            projectData.range = {
                startTime: rangeSelector.getStartTime(),
                endTime: rangeSelector.getEndTime()
            };
            console.log('[DEBUG] 範囲情報を収集:', projectData.range);
        } else {
            console.warn('[DEBUG] rangeSelector が存在しません');
        }

        console.log('[DEBUG] プロジェクトデータ収集完了:', projectData);
        return projectData;
    }

    /**
     * プロジェクト名を自動生成
     * @returns {string} プロジェクト名（タイトル_日付）
     */
    generateProjectName() {
        // タイトルを取得（videoPlayerから）
        let baseFileName = '';
        if (videoPlayer) {
            baseFileName = videoPlayer.getProjectTitle();
        }

        // タイトルが空の場合は動画ファイル名を使用
        if (!baseFileName && this.currentVideoFileName) {
            baseFileName = this.currentVideoFileName.replace(/\.[^.]+$/, '');
        }

        // 現在の日付を取得（YYYY-MM-DD形式）
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        // プロジェクト名を生成
        return `${baseFileName}_${dateString}`;
    }

    /**
     * プロジェクトを保存
     */
    async saveProject() {
        if (!this.currentVideoFileName) {
            alert(APP_CONSTANTS.MESSAGES.ERROR.NO_VIDEO);
            return;
        }

        // Electron APIが利用可能かチェック
        if (!window.electronApi || !window.electronApi.saveProjectAsFolder) {
            alert(APP_CONSTANTS.MESSAGES.ERROR.NO_ELECTRON_API);
            return;
        }

        // 動画ファイルを取得
        const videoFile = fileHandler ? fileHandler.getCurrentFile() : null;
        if (!videoFile) {
            alert(APP_CONSTANTS.MESSAGES.ERROR.NO_VIDEO_FILE);
            return;
        }

        // プロジェクトタイトルを取得
        const projectTitle = videoPlayer ? videoPlayer.getProjectTitle() : '';
        if (!projectTitle) {
            alert(APP_CONSTANTS.MESSAGES.ERROR.NO_TITLE);
            return;
        }

        // プロジェクトデータを収集
        const projectData = this.collectProjectData();

        // JSONに変換
        const jsonString = JSON.stringify(projectData, null, 2);

        // プロジェクト名を自動生成（タイトル_日付）
        const projectName = this.generateProjectName();

        // 元の動画ファイルの拡張子を取得
        const originalExtension = this.currentVideoFileName.match(/\.[^.]+$/);
        const extension = originalExtension ? originalExtension[0] : '.mp4';

        // 新しい動画ファイル名を生成（タイトル + 拡張子）
        const newVideoFileName = `${projectTitle}${extension}`;

        try {
            // 動画ファイルをArrayBufferとして読み込み
            const videoArrayBuffer = await videoFile.arrayBuffer();

            // IPC通信でプロジェクトフォルダ保存を実行
            const result = await window.electronApi.saveProjectAsFolder({
                projectName: projectName,
                projectTitle: projectTitle,
                originalVideoFileName: this.currentVideoFileName,
                videoFileName: newVideoFileName,
                videoData: videoArrayBuffer,
                jsonContent: jsonString
            });

            if (result.success) {
                console.log('プロジェクトを保存しました:', result.folderPath);
                alert(`プロジェクトを保存しました:\n${result.folderPath}`);
            } else if (result.canceled) {
                console.log('プロジェクトの保存がキャンセルされました');
            } else {
                console.error('プロジェクトの保存に失敗しました:', result.error);
                alert(`プロジェクトの保存に失敗しました:\n${result.error}`);
            }
        } catch (error) {
            console.error('プロジェクト保存エラー:', error);
            alert(`プロジェクトの保存中にエラーが発生しました:\n${error.message}`);
        }
    }

    /**
     * データを復元する共通処理
     * @param {Array|Object} data - 復元するデータ
     * @param {Object} manager - マネージャーオブジェクト
     * @param {string} methodName - 呼び出すメソッド名
     * @param {string} dataTypeName - データ種類の名前（ログ用）
     */
    restoreData(data, manager, methodName, dataTypeName) {
        if (data && manager) {
            const count = Array.isArray(data) ? data.length : '';
            const countText = count ? `${count}件` : '';
            console.log(`[DEBUG] ${dataTypeName}を復元:`, countText, data);
            manager[methodName](data);
        } else {
            console.warn(`[DEBUG] ${dataTypeName}のデータがないか、マネージャーが存在しません`);
        }
    }

    /**
     * プロジェクトを読み込み
     * @param {Object} projectData - プロジェクトデータ
     */
    loadProject(projectData) {
        console.log('[DEBUG] プロジェクトを読み込み中...', projectData);

        // 各種データを復元
        this.restoreData(
            projectData.annotations,
            annotationManager,
            'loadAnnotations',
            'テキスト注釈'
        );

        this.restoreData(
            projectData.shapes,
            shapeAnnotationManager,
            'loadShapes',
            '図形アノテーション'
        );

        this.restoreData(
            projectData.detailTexts,
            detailTextManager,
            'loadDetailTexts',
            '詳細テキスト'
        );

        // 範囲情報を復元
        if (projectData.range && rangeSelector) {
            console.log('[DEBUG] 範囲情報を復元:', projectData.range);
            rangeSelector.setRange(projectData.range.startTime, projectData.range.endTime);
        } else {
            console.warn('[DEBUG] 範囲情報のデータがないか、rangeSelectorが存在しません');
        }

        console.log('[DEBUG] プロジェクトの読み込みが完了しました');
    }

    /**
     * ファイルからプロジェクトを読み込み（手動読み込み）
     */
    async loadProjectFromFile() {
        // Electron APIが利用可能かチェック
        if (!window.electronApi || !window.electronApi.loadProjectFile) {
            alert('この機能はデスクトップアプリ版でのみ利用できます');
            return;
        }

        try {
            // IPC通信でファイル選択ダイアログを表示
            const result = await window.electronApi.loadProjectFile();

            if (result.success && result.projectData) {
                console.log('プロジェクトファイルを読み込みました:', result.filePath);

                // プロジェクト読み込みフラグをON
                this.isLoadingProject = true;
                console.log('[DEBUG] プロジェクト読み込みフラグをONにしました');

                // 動画ファイルが見つかった場合、自動的に読み込む
                if (result.videoData && result.videoFileName) {
                    console.log('動画ファイルを読み込み中...', result.videoFileName);

                    // ArrayBufferからBlobを作成
                    const videoBlob = new Blob([result.videoData], { type: 'video/mp4' });
                    const videoFile = new File([videoBlob], result.videoFileName, { type: videoBlob.type });

                    // 動画ファイルを読み込み（fileHandlerを使用）
                    if (fileHandler) {
                        // ファイル名を表示
                        const fileNameDisplay = document.getElementById('fileName');
                        if (fileNameDisplay) {
                            fileNameDisplay.textContent = `選択中: ${result.videoFileName}`;
                        }

                        // 現在のファイルを保存
                        fileHandler.currentFile = videoFile;

                        // 動画を読み込み
                        const videoUrl = createBlobUrl(videoFile);
                        if (fileHandler.onFileLoadedCallback) {
                            fileHandler.onFileLoadedCallback(videoUrl, videoFile);
                        }

                        console.log('動画ファイルを読み込みました');
                    }

                    // 動画の読み込みが完了するまで少し待つ
                    await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                    console.warn('動画ファイルが見つかりませんでした。手動で読み込んでください。');
                    alert('動画ファイルが見つかりませんでした。\n動画ファイルを手動で読み込んでください。');
                }

                // プロジェクトデータを適用
                this.loadProject(result.projectData);

                // プロジェクト読み込みフラグをOFF
                this.isLoadingProject = false;
                console.log('[DEBUG] プロジェクト読み込みフラグをOFFにしました');

                alert(`プロジェクトを読み込みました:\n${result.filePath}`);
            } else if (result.canceled) {
                console.log('プロジェクトの読み込みがキャンセルされました');
            } else {
                console.error('プロジェクトの読み込みに失敗しました:', result.error);
                alert(`プロジェクトの読み込みに失敗しました:\n${result.error}`);
            }
        } catch (error) {
            console.error('プロジェクト読み込みエラー:', error);
            alert(`プロジェクトの読み込み中にエラーが発生しました:\n${error.message}`);
            // エラー時もフラグをOFF
            this.isLoadingProject = false;
        }
    }
}

// グローバルインスタンス
const projectManager = new ProjectManager();
