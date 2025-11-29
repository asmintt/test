// utils.js - 共通ユーティリティ関数
// アプリ全体で使用する汎用的な関数を提供

/**
 * 秒数を HH:MM:SS 形式の文字列に変換
 * @param {number} seconds - 秒数
 * @returns {string} フォーマットされた時刻文字列
 */
function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) {
        return '00:00:00';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return [hours, minutes, secs]
        .map(v => v.toString().padStart(2, '0'))
        .join(':');
}

/**
 * 秒数を HH:MM:SS.d 形式の文字列に変換（小数点1桁付き）
 * @param {number} seconds - 秒数
 * @returns {string} フォーマットされた時刻文字列
 */
function formatTimeWithDecimal(seconds) {
    if (isNaN(seconds) || seconds < 0) {
        return '00:00:00.0';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const decimal = Math.floor((seconds % 1) * 10);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${decimal}`;
}

/**
 * HH:MM:SS 形式の文字列を秒数に変換
 * @param {string} timeString - 時刻文字列
 * @returns {number} 秒数
 */
function parseTime(timeString) {
    const parts = timeString.split(':');
    if (parts.length !== 3) {
        return 0;
    }

    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    const seconds = parseInt(parts[2], 10) || 0;

    return hours * 3600 + minutes * 60 + seconds;
}

/**
 * ファイル名から拡張子を除いた名前を取得
 * @param {string} filename - ファイル名
 * @returns {string} 拡張子を除いた名前
 */
function getFileNameWithoutExtension(filename) {
    return filename.replace(/\.[^/.]+$/, '');
}

/**
 * Blob URLを作成
 * @param {Blob} blob - Blobオブジェクト
 * @returns {string} Blob URL
 */
function createBlobUrl(blob) {
    return URL.createObjectURL(blob);
}

/**
 * Blob URLを解放
 * @param {string} url - Blob URL
 */
function revokeBlobUrl(url) {
    URL.revokeObjectURL(url);
}

/**
 * 要素を有効化/無効化
 * @param {HTMLElement|string} element - 要素またはセレクタ
 * @param {boolean} enabled - 有効にするかどうか
 */
function setEnabled(element, enabled) {
    const el = typeof element === 'string' ? document.querySelector(element) : element;
    if (el) {
        el.disabled = !enabled;
    }
}

/**
 * 複数の要素を有効化/無効化
 * @param {Array<HTMLElement|string>} elements - 要素またはセレクタの配列
 * @param {boolean} enabled - 有効にするかどうか
 */
function setEnabledMultiple(elements, enabled) {
    elements.forEach(el => setEnabled(el, enabled));
}

/**
 * 要素の表示/非表示を切り替え
 * @param {HTMLElement|string} element - 要素またはセレクタ
 * @param {boolean} visible - 表示するかどうか
 */
function setVisible(element, visible) {
    const el = typeof element === 'string' ? document.querySelector(element) : element;
    if (el) {
        el.style.display = visible ? '' : 'none';
    }
}
