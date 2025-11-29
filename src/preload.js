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
     * Node.jsのpathモジュールの機能を提供
     * （ファイルパスの処理に使用）
     */
    path: {
        join: (...args) => require('path').join(...args),
        basename: (filePath) => require('path').basename(filePath),
        dirname: (filePath) => require('path').dirname(filePath),
        extname: (filePath) => require('path').extname(filePath)
    }
});
