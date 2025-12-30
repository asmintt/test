// preload.js - ElectronのBridge
// メインプロセスとレンダラープロセスの安全な通信を提供

const { contextBridge, ipcRenderer } = require('electron');

/**
 * レンダラープロセスにAPIを公開
 * window.electronApi としてアクセス可能になる
 */
contextBridge.exposeInMainWorld('electronApi', {
    /**
     * 動画のトリミングを実行
     * @param {Object} data - トリミングデータ
     * @returns {Promise} トリミング結果
     */
    trimVideo: (data) => ipcRenderer.invoke('trim-video', data),

    /**
     * トリミングの進捗を受信
     * @param {Function} callback - 進捗受信時のコールバック
     */
    onTrimProgress: (callback) => {
        ipcRenderer.on('trim-progress', (event, data) => {
            callback(data);
        });
    },

    /**
     * プロジェクトをフォルダとして保存
     * @param {Object} data - プロジェクトデータとファイル情報
     * @returns {Promise} 保存結果
     */
    saveProjectAsFolder: (data) => ipcRenderer.invoke('save-project-as-folder', data),

    /**
     * プロジェクトファイルを保存（旧版）
     * @param {Object} data - プロジェクトデータとファイル情報
     * @returns {Promise} 保存結果
     */
    saveProjectFile: (data) => ipcRenderer.invoke('save-project-file', data),

    /**
     * プロジェクトファイルを読み込み（動画ファイルも自動検索）
     * @returns {Promise} 読み込み結果
     */
    loadProjectFile: () => ipcRenderer.invoke('load-project-file'),

    /**
     * プロジェクトフォルダを読み込み（推奨）
     * フォルダを選択し、動画とJSONファイルを自動的に読み込む
     * @returns {Promise} 読み込み結果
     */
    loadProjectFolder: () => ipcRenderer.invoke('load-project-folder'),

    /**
     * Node.jsのpathモジュールの機能を提供
     * （ファイルパスの処理に使用）
     */
    path: {
        join: (...args) => require('path').join(...args),
        basename: (filePath) => require('path').basename(filePath),
        dirname: (filePath) => require('path').dirname(filePath),
        extname: (filePath) => require('path').extname(filePath)
    },

    /**
     * 矢印画像を一時ファイルとして保存
     * @param {string} dataUrl - base64形式の画像データ
     * @param {string} filename - ファイル名
     * @returns {Promise<string>} 保存されたファイルのパス
     */
    saveArrowImage: (dataUrl, filename) => ipcRenderer.invoke('save-arrow-image', dataUrl, filename)
});
