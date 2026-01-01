// detailTextManager.js - 詳細テキスト管理
// 動画の特定時刻に詳細テキスト（小さな1行テキスト）を追加・編集・削除する機能

class DetailTextManager {
    constructor() {
        // DOM要素
        this.detailText = document.getElementById('detailText');
        this.detailFontSelect = document.getElementById('detailFontSelect');
        this.presetButtons = document.querySelectorAll('.detail-preset-btn');
        this.customTextColor = document.getElementById('detailCustomTextColor');
        this.customBgColor = document.getElementById('detailCustomBgColor');
        this.bgOpacitySlider = document.getElementById('detailBgOpacity');
        this.bgOpacityValue = document.getElementById('detailBgOpacityValue');
        this.textAlignButtons = document.querySelectorAll('.detail-text-align-btn');
        this.saveCustomPresetBtn = document.getElementById('saveDetailCustomPresetBtn');
        this.customPresetBtn = document.getElementById('detailCustomPresetBtn');
        this.addDetailTextBtn = document.getElementById('addDetailTextBtn');
        this.addNoDetailTextBtn = document.getElementById('addNoDetailTextBtn');
        this.detailTextList = document.getElementById('detailTextList');

        // 時刻調整ボタン（サイドバーの統合ボタン）
        this.timeAdjustButtons = document.querySelectorAll('[data-video-adjust]');
        this.syncDetailTimeBtn = document.getElementById('syncVideoTime');
        this.resetDetailTimeBtn = document.getElementById('resetVideoTime');

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

        // コールバック
        this.onDetailTextsChangeCallback = null;

        // 最大文字数（動画読み込み時に設定）
        this.maxCharacters = 100;
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

        // 現在位置ボタン
        if (this.syncDetailTimeBtn) {
            this.syncDetailTimeBtn.addEventListener('click', () => {
                // 何もしない（既に動画の現在位置が表示されているため）
            });
        }

        // リセットボタン
        if (this.resetDetailTimeBtn) {
            this.resetDetailTimeBtn.addEventListener('click', () => {
                this.resetTime();
            });
        }

        // 配色コントロールのイベントハンドラ
        this.initColorControls();

        // フォント選択イベント
        if (this.detailFontSelect) {
            this.detailFontSelect.addEventListener('change', () => {
                this.selectedFont = this.detailFontSelect.value;

                // 入力フィールドにフォントを適用（プレビュー）
                if (this.detailText) {
                    this.detailText.style.fontFamily = `"${this.selectedFont}", sans-serif`;
                }
            });
        }

        // 文字位置ボタンのイベントハンドラ
        this.textAlignButtons.forEach(button => {
            button.addEventListener('click', () => {
                const align = button.getAttribute('data-align');
                this.selectTextAlign(align, button);
            });
        });

        // 登録ボタンのイベントハンドラ
        if (this.saveCustomPresetBtn) {
            this.saveCustomPresetBtn.addEventListener('click', () => {
                this.saveCustomPreset();
            });
        }
    }

    /**
     * 配色コントロールの初期化
     */
    initColorControls() {
        // プリセットボタン
        this.presetButtons.forEach(button => {
            button.addEventListener('click', () => {
                const preset = button.getAttribute('data-preset');
                const textColor = button.getAttribute('data-text-color');
                const bgColor = button.getAttribute('data-bg-color');
                this.selectPreset(preset, textColor, bgColor, button);
            });
        });

        // カスタムカラーピッカー
        if (this.customTextColor) {
            this.customTextColor.addEventListener('change', () => {
                this.selectCustomColors();
            });
        }

        if (this.customBgColor) {
            this.customBgColor.addEventListener('change', () => {
                this.selectCustomColors();
            });
        }

        // 背景透明度スライダー
        if (this.bgOpacitySlider) {
            this.bgOpacitySlider.addEventListener('input', () => {
                const opacity = parseInt(this.bgOpacitySlider.value) / 100;
                this.selectedBgOpacity = opacity;
                if (this.bgOpacityValue) {
                    this.bgOpacityValue.textContent = `${this.bgOpacitySlider.value}%`;
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

        // 透明度と文字位置も取得
        const bgOpacity = button.getAttribute('data-bg-opacity');
        if (bgOpacity) {
            this.selectedBgOpacity = parseFloat(bgOpacity);
            if (this.bgOpacitySlider) {
                this.bgOpacitySlider.value = Math.round(this.selectedBgOpacity * 100);
            }
            if (this.bgOpacityValue) {
                this.bgOpacityValue.textContent = `${Math.round(this.selectedBgOpacity * 100)}%`;
            }
        }

        const textAlign = button.getAttribute('data-text-align');
        if (textAlign) {
            this.selectedTextAlign = textAlign;

            // 文字位置ボタンのactive状態を更新
            this.textAlignButtons.forEach(btn => btn.classList.remove('active'));
            this.textAlignButtons.forEach(btn => {
                if (btn.getAttribute('data-align') === textAlign) {
                    btn.classList.add('active');
                }
            });
        }

        // プリセットボタンのactive状態を更新
        this.presetButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // カスタムカラーピッカーを同期
        if (this.customTextColor) this.customTextColor.value = textColor;
        if (this.customBgColor) this.customBgColor.value = bgColor;
    }

    /**
     * カスタム色を選択
     */
    selectCustomColors() {
        this.selectedTextColor = this.customTextColor.value;
        this.selectedBgColor = this.customBgColor.value;

        // プリセットボタンのactive状態を解除
        this.presetButtons.forEach(btn => btn.classList.remove('active'));
        this.selectedPreset = null;
    }

    /**
     * 文字位置を選択
     * @param {string} align - 文字位置（left/center/right）
     * @param {HTMLElement} button - クリックされたボタン
     */
    selectTextAlign(align, button) {
        this.selectedTextAlign = align;

        // 文字位置ボタンのactive状態を更新
        this.textAlignButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        console.log(`文字位置を${align}に変更しました`);
    }

    /**
     * カスタムプリセットに登録
     */
    saveCustomPreset() {
        if (!this.customPresetBtn) return;

        // 現在の設定をカスタムボタンに保存
        this.customPresetBtn.setAttribute('data-text-color', this.selectedTextColor);
        this.customPresetBtn.setAttribute('data-bg-color', this.selectedBgColor);
        this.customPresetBtn.setAttribute('data-bg-opacity', this.selectedBgOpacity);
        this.customPresetBtn.setAttribute('data-text-align', this.selectedTextAlign);

        // ボタンに色を視覚的に反映
        this.customPresetBtn.style.color = this.selectedTextColor;
        this.customPresetBtn.style.backgroundColor = this.selectedBgColor;

        console.log('カスタムプリセットを登録しました:', {
            textColor: this.selectedTextColor,
            bgColor: this.selectedBgColor,
            bgOpacity: this.selectedBgOpacity,
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
            textAlign: this.selectedTextAlign
        };

        this.detailTexts.push(detailTextObj);
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
            textAlign: this.selectedTextAlign
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
        if (!this.detailTextList) return;

        this.detailTextList.innerHTML = '';

        if (this.detailTexts.length === 0) {
            this.detailTextList.innerHTML = '<p class="empty-message">詳細テキストが登録されていません</p>';
            return;
        }

        this.detailTexts.forEach((detailTextObj, index) => {
            const item = createListItem({
                itemClassName: 'detail-text-item',
                time: detailTextObj.time,
                timeClassName: 'detail-text-time',
                useDecimalTime: false,
                onTimeClick: () => {
                    if (videoPlayer) {
                        videoPlayer.seekTo(detailTextObj.time);
                    }
                },
                text: detailTextObj.text || '（詳細テキストなし）',
                textClassName: 'detail-text-content',
                textStyle: {
                    color: detailTextObj.textColor,
                    backgroundColor: detailTextObj.bgColor
                },
                onEdit: null,
                onDelete: () => this.deleteDetailText(index)
            });

            this.detailTextList.appendChild(item);
        });
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
        // 最大文字数を計算
        if (videoPlayer && videoPlayer.video) {
            const videoWidth = videoPlayer.video.videoWidth;
            this.maxCharacters = Math.floor((videoWidth - 110) / 16); // フォントサイズ16に対応

            // プレースホルダーを更新
            if (this.detailText) {
                this.detailText.placeholder = `文字数：${this.maxCharacters}文字まで`;
                this.detailText.maxLength = this.maxCharacters;
            }
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
        if (this.customTextColor) this.customTextColor.disabled = false;
        if (this.customBgColor) this.customBgColor.disabled = false;
        if (this.bgOpacitySlider) this.bgOpacitySlider.disabled = false;
        if (this.saveCustomPresetBtn) this.saveCustomPresetBtn.disabled = false;
        if (this.addDetailTextBtn) this.addDetailTextBtn.disabled = false;
        if (this.addNoDetailTextBtn) this.addNoDetailTextBtn.disabled = false;

        // プリセットボタンを有効化
        this.presetButtons.forEach(button => button.disabled = false);

        // 文字位置ボタンを有効化
        this.textAlignButtons.forEach(button => button.disabled = false);

        this.timeAdjustButtons.forEach(button => button.disabled = false);
        if (this.syncDetailTimeBtn) this.syncDetailTimeBtn.disabled = false;
        if (this.resetDetailTimeBtn) this.resetDetailTimeBtn.disabled = false;

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
