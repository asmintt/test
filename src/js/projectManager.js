// projectManager.js - プロジェクト保存・読み込み管理
// アノテーション情報をJSONファイルとして保存・読み込みする機能

class ProjectManager {
    constructor() {
        // DOM要素
        this.saveProjectBtn = document.getElementById('saveProjectBtn');
        this.loadProjectBtn = document.getElementById('loadProjectBtn');

        // 現在のプロジェクト情報
        this.currentVideoFileName = null;
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
            version: '1.0',
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
        }

        // 図形アノテーションを取得
        if (shapeAnnotationManager) {
            projectData.shapes = shapeAnnotationManager.getShapes();
        }

        // 詳細テキストを取得
        if (detailTextManager) {
            projectData.detailTexts = detailTextManager.getDetailTexts();
        }

        // 範囲情報を取得
        if (rangeSelector) {
            projectData.range = {
                startTime: rangeSelector.getStartTime(),
                endTime: rangeSelector.getEndTime()
            };
        }

        return projectData;
    }

    /**
     * プロジェクトを保存
     */
    async saveProject() {
        if (!this.currentVideoFileName) {
            alert('動画ファイルが読み込まれていません');
            return;
        }

        // Electron APIが利用可能かチェック
        if (!window.electronApi || !window.electronApi.saveProjectFile) {
            alert('この機能はデスクトップアプリ版でのみ利用できます');
            return;
        }

        // プロジェクトデータを収集
        const projectData = this.collectProjectData();

        // JSONに変換
        const jsonString = JSON.stringify(projectData, null, 2);

        // ファイル名を生成（拡張子を.mfs.jsonに変更）
        const baseFileName = this.currentVideoFileName.replace(/\.[^.]+$/, '');
        const projectFileName = `${baseFileName}.mfs.json`;

        // 動画ファイルのパスを取得
        let videoFilePath = null;
        if (fileHandler && fileHandler.getCurrentFile()) {
            // Fileオブジェクトからはフルパスにアクセスできないためnullのまま
            // ダイアログのデフォルトはDownloadsフォルダになります
            videoFilePath = null;
        }

        try {
            // IPC通信でファイル保存ダイアログを表示
            const result = await window.electronApi.saveProjectFile({
                jsonContent: jsonString,
                defaultFileName: projectFileName,
                videoFilePath: videoFilePath
            });

            if (result.success) {
                console.log('プロジェクトを保存しました:', result.filePath);
                alert(`プロジェクトを保存しました:\n${result.filePath}`);
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
     * プロジェクトを読み込み
     * @param {Object} projectData - プロジェクトデータ
     */
    loadProject(projectData) {
        console.log('プロジェクトを読み込み中...', projectData);

        // テキスト注釈を復元
        if (projectData.annotations && annotationManager) {
            annotationManager.loadAnnotations(projectData.annotations);
        }

        // 図形アノテーションを復元
        if (projectData.shapes && shapeAnnotationManager) {
            shapeAnnotationManager.loadShapes(projectData.shapes);
        }

        // 詳細テキストを復元
        if (projectData.detailTexts && detailTextManager) {
            detailTextManager.loadDetailTexts(projectData.detailTexts);
        }

        // 範囲情報を復元
        if (projectData.range && rangeSelector) {
            rangeSelector.setRange(projectData.range.startTime, projectData.range.endTime);
        }

        console.log('プロジェクトの読み込みが完了しました');
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

                // プロジェクトデータを適用
                this.loadProject(result.projectData);

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
        }
    }
}

// グローバルインスタンス
const projectManager = new ProjectManager();
