// detailTextManager.js - 詳細テキスト管理
// 動画の特定時刻に詳細テキスト（小さな1行テキスト）を追加・編集・削除する機能

class DetailTextManager {
    constructor() {
        // DOM要素
        this.detailText = document.getElementById('detailText');
        this.detailFontSelect = document.getElementById('detailFontSelect');
        this.presetButtons = document.querySelectorAll('.detail-preset-btn'); // 詳細専用プリセットボタン
        this.detailCustomPresetBtn = document.getElementById('detailCustomPresetBtn');
        this.addDetailTextBtn = document.getElementById('addDetailTextBtn');
        this.addNoDetailTextBtn = document.getElementById('addNoDetailTextBtn');
        this.detailHistoryList = document.getElementById('detailHistoryList');

        // 時刻調整ボタン
        this.timeAdjustButtons = document.querySelectorAll('[data-video-adjust]');

        // 選択された色とプリセット
        this.selectedTextColor = '#000000'; // デフォルト: 黒
        this.selectedBgColor = '#FFFFFF';   // デフォルト: 白
        this.selectedBgOpacity = 1.0;       // デフォルト: 不透明
        this.selectedPreset = 'explanation'; // デフォルト: 説明
        this.selectedFont = 'Noto Sans JP'; // デフォルト: Noto Sans JP
        this.selectedTextAlign = 'left';    // デフォルト: 左寄せ

        // 詳細テキストデータ（配列）
        // 各詳細テキスト: { time: 秒数, text: テキスト, textColor: 色, bgColor: 色, bgOpacity: 透明度, textAlign: 文字位置 }
        this.detailTexts = [];

        // 編集モード
        this.isEditMode = false;
        this.editingIndex = -1;
        this.originalDetailText = null;

        // コールバック
        this.onDetailTextsChangeCallback = null;

        // 最大文字数（40文字固定）
        this.maxCharacters = 40;
    }

    /**
     * 初期化
     */
    init() {
        // 詳細テキスト追加ボタン
        if (this.addDetailTextBtn) {
            this.addDetailTextBtn.addEventListener('click', () => {
                this.addDetailText();
            });
        }

        // 詳細テキストなし追加ボタン
        if (this.addNoDetailTextBtn) {
            this.addNoDetailTextBtn.addEventListener('click', () => {
                this.addBlankDetailText();
            });
        }

        // 時刻調整ボタン
        this.timeAdjustButtons.forEach(button => {
            button.addEventListener('click', () => {
                const offset = parseFloat(button.getAttribute('data-video-adjust'));
                this.adjustTime(offset);
            });
        });

        // 配色コントロールのイベントハンドラ
        this.initColorControls();

        // フォント選択イベント
        if (this.detailFontSelect) {
            // 初期値をHTMLから読み取る
            this.selectedFont = this.detailFontSelect.value;
            console.log('[DEBUG] 詳細テキストフォントの初期値:', this.selectedFont);

            this.detailFontSelect.addEventListener('change', () => {
                this.selectedFont = this.detailFontSelect.value;

                // 入力フィールドにフォントを適用（プレビュー）
                if (this.detailText) {
                    this.detailText.style.fontFamily = `"${this.selectedFont}", sans-serif`;
                }
            });
        }

        // 文字配置ボタンのイベントハンドラ
        this.initTextAlignButtons();

        // 統一カスタム設定のイベントハンドラ
        this.initSharedCustomSettings();
    }

    /**
     * 配色コントロールの初期化
     */
    initColorControls() {
        // 共通プリセットボタン
        this.presetButtons.forEach(button => {
            button.addEventListener('click', () => {
                const preset = button.getAttribute('data-preset');
                const textColor = button.getAttribute('data-text-color');
                const bgColor = button.getAttribute('data-bg-color');
                this.selectPreset(preset, textColor, bgColor, button);
            });
        });

        // カスタムボタンのダブルクリック → カスタム設定を開く
        if (this.detailCustomPresetBtn) {
            this.detailCustomPresetBtn.addEventListener('dblclick', () => {
                const customSettings = document.getElementById('detailCustomSettings');
                if (customSettings) {
                    customSettings.open = true; // detailsを開く
                }
            });
        }
    }

    /**
     * プリセットを選択
     */
    selectPreset(preset, textColor, bgColor, button) {
        this.selectedPreset = preset;
        this.selectedTextColor = textColor;
        this.selectedBgColor = bgColor;

        // プリセットボタンのactive状態を更新
        this.presetButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        console.log('詳細テキストプリセット選択:', { preset, textColor, bgColor });
    }

    /**
     * 文字配置ボタンの初期化
     */
    initTextAlignButtons() {
        const textAlignButtons = document.querySelectorAll('.detail-text-align-btn');

        textAlignButtons.forEach(button => {
            button.addEventListener('click', () => {
                const align = button.getAttribute('data-align');
                this.selectedTextAlign = align;

                // アクティブ状態を更新
                textAlignButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                console.log('詳細テキスト文字配置変更:', align);
            });
        });
    }

    /**
     * 統一カスタム設定の初期化
     */
    initSharedCustomSettings() {
        const sharedBgColor = document.getElementById('sharedCustomBgColor');
        const sharedTextColor = document.getElementById('sharedCustomTextColor');
        const sharedTextAlignButtons = document.querySelectorAll('.shared-text-align-btn');
        const saveSharedCustomBtn = document.getElementById('saveSharedCustomPresetBtn');

        // 背景色変更
        if (sharedBgColor) {
            sharedBgColor.addEventListener('change', () => {
                this.selectedBgColor = sharedBgColor.value;
            });
        }

        // 文字色変更
        if (sharedTextColor) {
            sharedTextColor.addEventListener('change', () => {
                this.selectedTextColor = sharedTextColor.value;
            });
        }

        // 文字位置ボタン
        sharedTextAlignButtons.forEach(button => {
            button.addEventListener('click', () => {
                const align = button.getAttribute('data-align');
                this.selectedTextAlign = align;

                // アクティブ状態を更新
                sharedTextAlignButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                console.log('詳細テキスト文字位置変更:', align);
            });
        });

        // 登録ボタン
        if (saveSharedCustomBtn) {
            saveSharedCustomBtn.addEventListener('click', () => {
                this.saveSharedCustomPreset();
            });
        }
    }

    /**
     * 統一カスタムプリセットに登録
     */
    saveSharedCustomPreset() {
        if (!this.detailCustomPresetBtn) return;

        // 現在の設定をカスタムボタンに保存
        this.detailCustomPresetBtn.setAttribute('data-text-color', this.selectedTextColor);
        this.detailCustomPresetBtn.setAttribute('data-bg-color', this.selectedBgColor);

        // ボタンに色を視覚的に反映
        this.detailCustomPresetBtn.style.color = this.selectedTextColor;
        this.detailCustomPresetBtn.style.backgroundColor = this.selectedBgColor;

        console.log('詳細カスタムプリセットを登録しました:', {
            textColor: this.selectedTextColor,
            bgColor: this.selectedBgColor,
            textAlign: this.selectedTextAlign
        });

        alert('カスタム設定を登録しました！');
    }

    /**
     * 時刻調整
     */
    adjustTime(offset) {
        if (!videoPlayer || !videoPlayer.video) return;

        const currentTime = videoPlayer.getCurrentTime();
        const newTime = Math.max(0, Math.min(currentTime + offset, videoPlayer.getDuration()));
        videoPlayer.seekTo(newTime);
    }

    /**
     * 時刻リセット
     */
    resetTime() {
        if (videoPlayer && videoPlayer.video) {
            videoPlayer.seekTo(0);
        }
    }

    /**
     * 詳細テキストを追加
     */
    addDetailText() {
        if (!this.detailText || !videoPlayer) return;

        const text = this.detailText.value.trim();
        if (!text) {
            alert('詳細テキストを入力してください');
            return;
        }

        const currentTime = videoPlayer.getCurrentTime();

        const detailTextObj = {
            time: currentTime,
            text: text,
            textColor: this.selectedTextColor,
            bgColor: this.selectedBgColor,
            bgOpacity: this.selectedBgOpacity,
            textAlign: this.selectedTextAlign,
            font: this.selectedFont
        };

        // 編集モードの場合は上書き更新
        if (this.isEditMode && this.editingIndex >= 0) {
            console.log('編集モード: 詳細テキストを上書き更新します。インデックス:', this.editingIndex);
            this.detailTexts[this.editingIndex] = detailTextObj;

            // 編集モードを解除
            this.isEditMode = false;
            this.editingIndex = -1;
            this.originalDetailText = null;
        } else {
            // 新規追加
            this.detailTexts.push(detailTextObj);
        }

        this.sortDetailTexts();
        this.renderDetailTextList();
        this.triggerChange();

        // 入力欄をクリア
        this.detailText.value = '';

        console.log('詳細テキスト追加:', detailTextObj);
    }

    /**
     * 空の詳細テキストを追加
     */
    addBlankDetailText() {
        if (!videoPlayer) return;

        const currentTime = videoPlayer.getCurrentTime();

        const detailTextObj = {
            time: currentTime,
            text: '',
            textColor: this.selectedTextColor,
            bgColor: this.selectedBgColor,
            bgOpacity: this.selectedBgOpacity,
            textAlign: this.selectedTextAlign,
            font: this.selectedFont
        };

        this.detailTexts.push(detailTextObj);
        this.sortDetailTexts();
        this.renderDetailTextList();
        this.triggerChange();

        console.log('空の詳細テキスト追加:', detailTextObj);
    }

    /**
     * 詳細テキストを時刻順にソート
     */
    sortDetailTexts() {
        this.detailTexts.sort((a, b) => a.time - b.time);
    }

    /**
     * 詳細テキストリストをレンダリング
     */
    renderDetailTextList() {
        if (!this.detailHistoryList) return;

        this.detailHistoryList.innerHTML = '';

        if (this.detailTexts.length === 0) {
            this.detailHistoryList.innerHTML = '<p class="empty-message">詳細が登録されていません</p>';
            return;
        }

        // 時刻の降順でソート
        const sortedTexts = [...this.detailTexts].sort((a, b) => b.time - a.time);

        sortedTexts.forEach((detailTextObj, index) => {
            const item = this.createDetailHistoryItem(detailTextObj, this.detailTexts.indexOf(detailTextObj));
            this.detailHistoryList.appendChild(item);
        });
    }

    /**
     * 詳細テキスト履歴アイテムのHTML要素を作成（コンパクト版）
     * @param {Object} detailTextObj - 詳細テキストオブジェクト
     * @param {number} index - インデックス
     * @returns {HTMLElement} 詳細テキストアイテム要素
     */
    createDetailHistoryItem(detailTextObj, index) {
        const item = document.createElement('div');
        item.className = 'history-item';

        // ヘッダー行（時刻とボタン）
        const headerDiv = document.createElement('div');
        headerDiv.className = 'history-item-header';

        // 時刻表示
        const timeSpan = document.createElement('div');
        timeSpan.className = 'history-time';
        timeSpan.textContent = formatTimeWithDecimal(detailTextObj.time);
        timeSpan.addEventListener('click', () => {
            if (videoPlayer) {
                videoPlayer.setCurrentTime(detailTextObj.time);
            }
        });
        headerDiv.appendChild(timeSpan);

        // ボタン
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'history-buttons';

        const editBtn = document.createElement('button');
        editBtn.className = 'btn-edit';
        editBtn.textContent = '編集';
        editBtn.addEventListener('click', () => this.editDetailText(index));
        buttonsDiv.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.textContent = '削除';
        deleteBtn.addEventListener('click', () => this.deleteDetailText(index));
        buttonsDiv.appendChild(deleteBtn);

        headerDiv.appendChild(buttonsDiv);
        item.appendChild(headerDiv);

        // 詳細テキスト表示
        const contentDiv = document.createElement('div');
        contentDiv.className = 'history-content';
        contentDiv.textContent = detailTextObj.text || '表示終了';
        contentDiv.style.color = detailTextObj.textColor;
        contentDiv.style.backgroundColor = detailTextObj.bgColor;
        contentDiv.style.padding = '2px 6px';
        contentDiv.style.borderRadius = '3px';
        item.appendChild(contentDiv);

        return item;
    }

    /**
     * 詳細テキストを編集
     * @param {number} index - 編集する詳細テキストのインデックス
     */
    editDetailText(index) {
        const detailText = this.detailTexts[index];

        // 編集モードに入る
        this.isEditMode = true;
        this.editingIndex = index;
        this.originalDetailText = JSON.parse(JSON.stringify(detailText));

        console.log('詳細テキスト編集モードに入ります。インデックス:', index);

        // 入力フィールドに現在の値を設定
        this.detailText.value = detailText.text || '';

        // 色を設定
        this.selectedTextColor = detailText.textColor;
        this.selectedBgColor = detailText.bgColor;

        // 文字位置を設定
        if (detailText.textAlign) {
            this.selectedTextAlign = detailText.textAlign;
            const textAlignButtons = document.querySelectorAll('.detail-text-align-btn');
            textAlignButtons.forEach(btn => {
                if (btn.getAttribute('data-align') === detailText.textAlign) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        // カスタムカラーピッカーを同期
        if (this.customTextColor) this.customTextColor.value = detailText.textColor;
        if (this.customBgColor) this.customBgColor.value = detailText.bgColor;

        // 動画の時刻を設定
        if (videoPlayer) {
            videoPlayer.setCurrentTime(detailText.time);
        }

        // 入力フィールドにフォーカス
        this.detailText.focus();
    }

    /**
     * 詳細テキストを削除
     */
    deleteDetailText(index) {
        if (confirm('この詳細テキストを削除しますか？')) {
            this.detailTexts.splice(index, 1);
            this.renderDetailTextList();
            this.triggerChange();
        }
    }

    /**
     * すべての詳細テキストを取得
     */
    getDetailTexts() {
        return this.detailTexts;
    }

    /**
     * 現在時刻で有効な詳細テキストを取得
     * @param {number} currentTime - 現在時刻（秒）
     * @returns {Object|null} 有効な詳細テキスト、なければnull
     */
    getActiveDetailTextAtTime(currentTime) {
        if (this.detailTexts.length === 0) return null;

        // 現在時刻以前の詳細テキストを時刻の降順で取得
        const validTexts = this.detailTexts
            .filter(d => d.time <= currentTime)
            .sort((a, b) => b.time - a.time);

        if (validTexts.length === 0) return null;

        // 最新の詳細テキストを取得
        const latestText = validTexts[0];

        // テキストが空文字列の場合は「表示終了」マーカーなのでnullを返す
        if (!latestText.text || latestText.text.trim() === '') {
            return null;
        }

        return latestText;
    }

    /**
     * 詳細テキストデータをクリア
     */
    clearDetailTexts() {
        this.detailTexts = [];
        this.renderDetailTextList();
        this.triggerChange();
    }

    /**
     * 動画読み込み完了時の処理
     */
    onVideoLoaded() {
        // 最大文字数を40文字に固定
        this.maxCharacters = 40;

        // プレースホルダーを更新
        if (this.detailText) {
            this.detailText.placeholder = `詳細テキスト（40文字まで）`;
            this.detailText.maxLength = 40;
        }

        // コントロールを有効化
        this.enableControls();
    }

    /**
     * コントロールを有効化
     */
    enableControls() {
        if (this.detailText) this.detailText.disabled = false;
        if (this.detailFontSelect) this.detailFontSelect.disabled = false;
        if (this.addDetailTextBtn) this.addDetailTextBtn.disabled = false;
        if (this.addNoDetailTextBtn) this.addNoDetailTextBtn.disabled = false;

        // プリセットボタンを有効化
        this.presetButtons.forEach(button => button.disabled = false);

        // 文字配置ボタンを有効化
        const textAlignButtons = document.querySelectorAll('.detail-text-align-btn');
        textAlignButtons.forEach(btn => btn.disabled = false);

        // 統一カスタム設定のUIを有効化
        const sharedBgColor = document.getElementById('sharedCustomBgColor');
        const sharedTextColor = document.getElementById('sharedCustomTextColor');
        const sharedTextAlignButtons = document.querySelectorAll('.shared-text-align-btn');
        const saveSharedCustomBtn = document.getElementById('saveSharedCustomPresetBtn');

        if (sharedBgColor) sharedBgColor.disabled = false;
        if (sharedTextColor) sharedTextColor.disabled = false;
        sharedTextAlignButtons.forEach(btn => btn.disabled = false);
        if (saveSharedCustomBtn) saveSharedCustomBtn.disabled = false;

        // 時刻調整ボタンを有効化
        this.timeAdjustButtons.forEach(button => button.disabled = false);

        // 初期フォントを入力フィールドに適用
        if (this.detailText) {
            this.detailText.style.fontFamily = `"${this.selectedFont}", sans-serif`;
        }
    }

    /**
     * 詳細テキスト変更時のコールバックを登録
     */
    onDetailTextsChange(callback) {
        this.onDetailTextsChangeCallback = callback;
    }

    /**
     * 詳細テキスト変更を通知
     */
    triggerChange() {
        if (this.onDetailTextsChangeCallback) {
            this.onDetailTextsChangeCallback(this.detailTexts);
        }
    }

    /**
     * 現在時刻表示を更新
     */
    updateCurrentTime(currentTime) {
        const detailCurrentTime = document.getElementById('detailCurrentTime');
        if (detailCurrentTime) {
            detailCurrentTime.textContent = formatTimeWithDecimal(currentTime);
        }
    }

    /**
     * 詳細テキストデータを読み込み
     * @param {Array} detailTexts - 読み込む詳細テキストデータ
     */
    loadDetailTexts(detailTexts) {
        if (!Array.isArray(detailTexts)) return;

        this.detailTexts = detailTexts;
        this.renderDetailTextList();
        console.log(`詳細テキストを${detailTexts.length}件読み込みました`);
    }

    /**
     * 詳細テキストデータを取得
     * @returns {Array} 詳細テキストデータ
     */
    getDetailTexts() {
        return this.detailTexts;
    }
}

// グローバルインスタンス
const detailTextManager = new DetailTextManager();
