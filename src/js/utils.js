// utils.js - 共通ユーティリティ関数
// アプリ全体で使用する汎用的な関数を提供

/**
 * 秒数を時刻文字列に変換（共通ロジック）
 * @param {number} seconds - 秒数
 * @param {Object} options - オプション
 * @param {boolean} options.decimal - 小数点を含めるかどうか（デフォルト: false）
 * @returns {string} フォーマットされた時刻文字列
 */
function formatTimeInternal(seconds, options = {}) {
    const includeDecimal = options.decimal ?? false;

    if (isNaN(seconds) || seconds < 0) {
        return includeDecimal ? '00:00:00.0' : '00:00:00';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const timeString = [hours, minutes, secs]
        .map(v => v.toString().padStart(2, '0'))
        .join(':');

    if (includeDecimal) {
        const decimal = Math.floor((seconds % 1) * 10);
        return `${timeString}.${decimal}`;
    }

    return timeString;
}

/**
 * 秒数を HH:MM:SS 形式の文字列に変換
 * @param {number} seconds - 秒数
 * @param {Object} options - オプション（省略可）
 * @param {boolean} options.decimal - 小数点を含めるかどうか
 * @returns {string} フォーマットされた時刻文字列
 */
function formatTime(seconds, options = {}) {
    return formatTimeInternal(seconds, options);
}

/**
 * 秒数を HH:MM:SS.d 形式の文字列に変換（小数点1桁付き）
 * @param {number} seconds - 秒数
 * @returns {string} フォーマットされた時刻文字列
 */
function formatTimeWithDecimal(seconds) {
    return formatTimeInternal(seconds, { decimal: true });
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

/**
 * カラーパレットから色を選択（active状態を更新）
 * @param {HTMLElement} palette - パレット要素
 * @param {HTMLElement} button - クリックされたボタン
 */
function selectColorFromPalette(palette, button) {
    if (!palette || !button) {
        console.warn('selectColorFromPalette: palette または button が存在しません');
        return;
    }

    // 全てのボタンから active クラスを削除
    const allButtons = palette.querySelectorAll('.color-btn');
    allButtons.forEach(btn => btn.classList.remove('active'));

    // クリックされたボタンに active クラスを追加
    button.classList.add('active');
}

/**
 * リストアイテムを作成（共通ロジック）
 * @param {Object} options - オプション
 * @param {string} options.itemClassName - アイテムのクラス名
 * @param {number} options.time - 時刻（秒）
 * @param {Function} options.onTimeClick - 時刻クリック時のコールバック
 * @param {string} options.timeClassName - 時刻ラベルのクラス名
 * @param {boolean} options.useDecimalTime - 小数点付き時刻表示を使用するか
 * @param {string} options.text - テキスト
 * @param {string} options.textClassName - テキストラベルのクラス名
 * @param {Object} options.textStyle - テキストのスタイル
 * @param {Function} options.onEdit - 編集ボタンクリック時のコールバック（nullの場合は編集ボタンを表示しない）
 * @param {Function} options.onDelete - 削除ボタンクリック時のコールバック
 * @returns {HTMLElement} リストアイテム要素
 */
function createListItem(options) {
    const item = document.createElement('div');
    item.className = options.itemClassName || 'annotation-item';

    // 時刻表示
    const timeLabel = document.createElement('div');
    timeLabel.className = options.timeClassName || 'annotation-time';
    const formatFn = options.useDecimalTime ? formatTimeWithDecimal : formatTime;
    timeLabel.textContent = formatFn(options.time);
    timeLabel.style.cursor = 'pointer';
    if (options.onTimeClick) {
        timeLabel.addEventListener('click', options.onTimeClick);
    }

    // テキスト表示
    const textLabel = document.createElement('div');
    textLabel.className = options.textClassName || 'annotation-text';
    textLabel.textContent = options.text;

    // スタイル適用
    if (options.textStyle) {
        Object.assign(textLabel.style, options.textStyle);
    }

    // 要素を組み立て
    item.appendChild(timeLabel);
    item.appendChild(textLabel);

    // 編集ボタン（オプション）
    if (options.onEdit) {
        const editBtn = document.createElement('button');
        editBtn.className = 'btn-edit';
        editBtn.textContent = '修正';
        editBtn.addEventListener('click', options.onEdit);
        item.appendChild(editBtn);
    }

    // 削除ボタン
    if (options.onDelete) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.textContent = '削除';
        deleteBtn.addEventListener('click', options.onDelete);
        item.appendChild(deleteBtn);
    }

    return item;
}

/**
 * エラーを安全に処理（ユーザーへの通知とログ）
 * @param {Error} error - エラーオブジェクト
 * @param {string} context - エラーの発生場所
 * @param {boolean} showAlert - アラート表示の有無（デフォルト: true）
 */
function handleError(error, context = '', showAlert = true) {
    const errorMessage = error?.message || '不明なエラー';
    const fullMessage = context ? `${context}: ${errorMessage}` : errorMessage;

    console.error(`[ERROR] ${fullMessage}`, error);

    if (showAlert) {
        alert(`エラーが発生しました\n\n${fullMessage}`);
    }
}

/**
 * 非同期処理を安全に実行
 * @param {Function} asyncFn - 非同期関数
 * @param {string} context - エラーの発生場所
 * @returns {Promise<{success: boolean, data?: any, error?: Error}>}
 */
async function safeExecute(asyncFn, context = '') {
    try {
        const data = await asyncFn();
        return { success: true, data };
    } catch (error) {
        handleError(error, context);
        return { success: false, error };
    }
}

/**
 * 時刻が有効かチェック
 * @param {number} time - 時刻（秒）
 * @returns {boolean}
 */
function isValidTime(time) {
    return typeof time === 'number' && !isNaN(time) && time >= 0;
}

/**
 * 範囲が有効かチェック
 * @param {number} start - 開始時刻
 * @param {number} end - 終了時刻
 * @returns {boolean}
 */
function isValidRange(start, end) {
    return isValidTime(start) && isValidTime(end) && start < end;
}

/**
 * テキストが有効かチェック
 * @param {string} text - テキスト
 * @param {number} maxLength - 最大文字数（デフォルト: 1000）
 * @returns {boolean}
 */
function isValidText(text, maxLength = 1000) {
    return typeof text === 'string' && text.length <= maxLength;
}
