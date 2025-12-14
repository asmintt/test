// detailTextManager.js - 詳細テキスト管理
// 動画の特定時刻に詳細テキスト（小さな1行テキスト）を追加・編集・削除する機能

class DetailTextManager {
    constructor() {
        // DOM要素
        this.detailText = document.getElementById('detailText');
        this.detailTextColorPalette = document.getElementById('detailTextColorPalette');
        this.detailBgColorPalette = document.getElementById('detailBgColorPalette');
        this.addDetailTextBtn = document.getElementById('addDetailTextBtn');
        this.addNoDetailTextBtn = document.getElementById('addNoDetailTextBtn');
        this.detailTextList = document.getElementById('detailTextList');

        // 時刻調整ボタン
        this.timeAdjustButtons = document.querySelectorAll('[data-adjust-detail]');
        this.syncDetailTimeBtn = document.getElementById('syncDetailTime');
        this.resetDetailTimeBtn = document.getElementById('resetDetailTime');

        // 選択された色
        this.selectedTextColor = '#000000'; // デフォルト: 黒
        this.selectedBgColor = '#FFFFFF';   // デフォルト: 白

        // 詳細テキストデータ（配列）
        // 各詳細テキスト: { time: 秒数, text: テキスト, textColor: 色, bgColor: 色 }
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
                const offset = parseFloat(button.getAttribute('data-adjust-detail'));
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

        // カラーパレットのイベントハンドラ
        this.initColorPalettes();
    }

    /**
     * カラーパレットの初期化
     */
    initColorPalettes() {
        // 文字色パレット
        if (this.detailTextColorPalette) {
            const textColorButtons = this.detailTextColorPalette.querySelectorAll('.color-btn');
            textColorButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const color = button.getAttribute('data-color');
                    this.selectTextColor(color, button);
                });
            });
        }

        // 背景色パレット
        if (this.detailBgColorPalette) {
            const bgColorButtons = this.detailBgColorPalette.querySelectorAll('.color-btn');
            bgColorButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const color = button.getAttribute('data-color');
                    this.selectBgColor(color, button);
                });
            });
        }
    }

    /**
     * 文字色を選択
     */
    selectTextColor(color, button) {
        this.selectedTextColor = color;

        // すべてのボタンから active クラスを削除
        const buttons = this.detailTextColorPalette.querySelectorAll('.color-btn');
        buttons.forEach(btn => btn.classList.remove('active'));

        // クリックされたボタンに active クラスを追加
        button.classList.add('active');
    }

    /**
     * 背景色を選択
     */
    selectBgColor(color, button) {
        this.selectedBgColor = color;

        // すべてのボタンから active クラスを削除
        const buttons = this.detailBgColorPalette.querySelectorAll('.color-btn');
        buttons.forEach(btn => btn.classList.remove('active'));

        // クリックされたボタンに active クラスを追加
        button.classList.add('active');
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
            bgColor: this.selectedBgColor
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
            bgColor: this.selectedBgColor
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
            const item = document.createElement('div');
            item.className = 'detail-text-item';

            // 時刻表示
            const timeDiv = document.createElement('div');
            timeDiv.className = 'detail-text-time';
            timeDiv.textContent = formatTime(detailTextObj.time);
            timeDiv.addEventListener('click', () => {
                if (videoPlayer) {
                    videoPlayer.seekTo(detailTextObj.time);
                }
            });

            // テキスト表示
            const textDiv = document.createElement('div');
            textDiv.className = 'detail-text-content';
            textDiv.textContent = detailTextObj.text || '（詳細テキストなし）';
            textDiv.style.color = detailTextObj.textColor;
            textDiv.style.backgroundColor = detailTextObj.bgColor;

            // 削除ボタン
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-delete';
            deleteBtn.textContent = '🗑 削除';
            deleteBtn.addEventListener('click', () => {
                this.deleteDetailText(index);
            });

            item.appendChild(timeDiv);
            item.appendChild(textDiv);
            item.appendChild(deleteBtn);

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
        if (this.addDetailTextBtn) this.addDetailTextBtn.disabled = false;
        if (this.addNoDetailTextBtn) this.addNoDetailTextBtn.disabled = false;

        this.timeAdjustButtons.forEach(button => button.disabled = false);
        if (this.syncDetailTimeBtn) this.syncDetailTimeBtn.disabled = false;
        if (this.resetDetailTimeBtn) this.resetDetailTimeBtn.disabled = false;
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
}

// グローバルインスタンス
const detailTextManager = new DetailTextManager();
