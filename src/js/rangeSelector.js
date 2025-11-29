// rangeSelector.js - 動画範囲選択機能
// 開始・終了時刻の設定、範囲の再生、スライダー操作を管理

class RangeSelector {
    constructor() {
        // DOM要素
        this.startSlider = document.getElementById('startSlider');
        this.endSlider = document.getElementById('endSlider');
        this.startTimeInput = document.getElementById('startTime');
        this.endTimeInput = document.getElementById('endTime');
        this.setStartBtn = document.getElementById('setStartBtn');
        this.setEndBtn = document.getElementById('setEndBtn');
        this.playRangeBtn = document.getElementById('playRangeBtn');
        this.resetRangeBtn = document.getElementById('resetRangeBtn');
        this.rangeDisplay = document.getElementById('rangeDisplay');

        // 動画の長さ
        this.duration = 0;

        // 選択範囲（秒）
        this.startTime = 0;
        this.endTime = 0;

        // 範囲再生中かどうか
        this.isPlayingRange = false;

        // コールバック
        this.onRangeChangeCallback = null;
    }

    /**
     * 初期化
     */
    init() {
        // スライダー変更イベント
        if (this.startSlider) {
            this.startSlider.addEventListener('input', () => {
                this.handleStartSliderChange();
            });
        }

        if (this.endSlider) {
            this.endSlider.addEventListener('input', () => {
                this.handleEndSliderChange();
            });
        }

        // 時刻入力変更イベント
        if (this.startTimeInput) {
            this.startTimeInput.addEventListener('change', () => {
                this.handleStartTimeInputChange();
            });
        }

        if (this.endTimeInput) {
            this.endTimeInput.addEventListener('change', () => {
                this.handleEndTimeInputChange();
            });
        }

        // 現在位置ボタン
        if (this.setStartBtn) {
            this.setStartBtn.addEventListener('click', () => {
                this.setStartFromCurrentTime();
            });
        }

        if (this.setEndBtn) {
            this.setEndBtn.addEventListener('click', () => {
                this.setEndFromCurrentTime();
            });
        }

        // 範囲再生ボタン
        if (this.playRangeBtn) {
            this.playRangeBtn.addEventListener('click', () => {
                this.playRange();
            });
        }

        // 全範囲ボタン
        if (this.resetRangeBtn) {
            this.resetRangeBtn.addEventListener('click', () => {
                this.resetRange();
            });
        }
    }

    /**
     * 動画読み込み時の設定
     * @param {number} duration - 動画の長さ（秒）
     */
    setDuration(duration) {
        this.duration = duration;
        this.startTime = 0;
        this.endTime = duration;

        // スライダーの最大値を設定
        if (this.startSlider) {
            this.startSlider.max = duration;
            this.startSlider.value = 0;
        }

        if (this.endSlider) {
            this.endSlider.max = duration;
            this.endSlider.value = duration;
        }

        // 時刻入力を更新
        this.updateTimeInputs();

        // UIを有効化
        this.enableControls();

        // 範囲表示を更新
        this.updateRangeDisplay();
    }

    /**
     * 開始スライダー変更時の処理
     */
    handleStartSliderChange() {
        const value = parseFloat(this.startSlider.value);

        // 終了時刻より後にならないように
        if (value >= this.endTime) {
            this.startSlider.value = this.endTime - 0.1;
            return;
        }

        this.startTime = value;
        this.updateTimeInputs();
        this.updateRangeDisplay();
        this.notifyRangeChange();
    }

    /**
     * 終了スライダー変更時の処理
     */
    handleEndSliderChange() {
        const value = parseFloat(this.endSlider.value);

        // 開始時刻より前にならないように
        if (value <= this.startTime) {
            this.endSlider.value = this.startTime + 0.1;
            return;
        }

        this.endTime = value;
        this.updateTimeInputs();
        this.updateRangeDisplay();
        this.notifyRangeChange();
    }

    /**
     * 開始時刻入力変更時の処理
     */
    handleStartTimeInputChange() {
        const time = parseTime(this.startTimeInput.value);

        // 範囲チェック
        if (time < 0 || time >= this.endTime || time > this.duration) {
            this.updateTimeInputs();
            return;
        }

        this.startTime = time;
        this.startSlider.value = time;
        this.updateRangeDisplay();
        this.notifyRangeChange();
    }

    /**
     * 終了時刻入力変更時の処理
     */
    handleEndTimeInputChange() {
        const time = parseTime(this.endTimeInput.value);

        // 範囲チェック
        if (time <= this.startTime || time > this.duration) {
            this.updateTimeInputs();
            return;
        }

        this.endTime = time;
        this.endSlider.value = time;
        this.updateRangeDisplay();
        this.notifyRangeChange();
    }

    /**
     * 現在位置から開始時刻を設定
     */
    setStartFromCurrentTime() {
        if (!videoPlayer) return;

        const currentTime = videoPlayer.getCurrentTime();

        // 終了時刻より前であることをチェック
        if (currentTime >= this.endTime) {
            alert('開始時刻は終了時刻より前に設定してください');
            return;
        }

        this.startTime = currentTime;
        this.startSlider.value = currentTime;
        this.updateTimeInputs();
        this.updateRangeDisplay();
        this.notifyRangeChange();
    }

    /**
     * 現在位置から終了時刻を設定
     */
    setEndFromCurrentTime() {
        if (!videoPlayer) return;

        const currentTime = videoPlayer.getCurrentTime();

        // 開始時刻より後であることをチェック
        if (currentTime <= this.startTime) {
            alert('終了時刻は開始時刻より後に設定してください');
            return;
        }

        this.endTime = currentTime;
        this.endSlider.value = currentTime;
        this.updateTimeInputs();
        this.updateRangeDisplay();
        this.notifyRangeChange();
    }

    /**
     * 時刻入力フィールドを更新
     */
    updateTimeInputs() {
        if (this.startTimeInput) {
            this.startTimeInput.value = formatTime(this.startTime);
        }

        if (this.endTimeInput) {
            this.endTimeInput.value = formatTime(this.endTime);
        }
    }

    /**
     * 範囲表示を更新
     */
    updateRangeDisplay() {
        if (this.rangeDisplay) {
            const rangeDuration = this.endTime - this.startTime;
            this.rangeDisplay.textContent = formatTime(rangeDuration);
        }
    }

    /**
     * 範囲を再生
     */
    playRange() {
        if (!videoPlayer) return;

        // 開始位置に移動して再生
        videoPlayer.setCurrentTime(this.startTime);
        videoPlayer.play();

        // 範囲再生フラグ
        this.isPlayingRange = true;
    }

    /**
     * 範囲を全体にリセット
     */
    resetRange() {
        this.startTime = 0;
        this.endTime = this.duration;

        this.startSlider.value = 0;
        this.endSlider.value = this.duration;

        this.updateTimeInputs();
        this.updateRangeDisplay();
        this.notifyRangeChange();
    }

    /**
     * UIコントロールを有効化
     */
    enableControls() {
        setEnabledMultiple([
            this.startSlider,
            this.endSlider,
            this.startTimeInput,
            this.endTimeInput,
            this.setStartBtn,
            this.setEndBtn,
            this.playRangeBtn,
            this.resetRangeBtn
        ], true);
    }

    /**
     * 動画の時刻更新時のチェック（範囲再生終了判定）
     * @param {number} currentTime - 現在時刻
     */
    checkRangePlayback(currentTime) {
        if (this.isPlayingRange && currentTime >= this.endTime) {
            // 範囲の終了位置に達したら一時停止
            videoPlayer.pause();
            this.isPlayingRange = false;
        }
    }

    /**
     * 範囲変更時のコールバックを設定
     * @param {Function} callback - コールバック関数
     */
    onRangeChange(callback) {
        this.onRangeChangeCallback = callback;
    }

    /**
     * 範囲変更を通知
     */
    notifyRangeChange() {
        if (this.onRangeChangeCallback) {
            this.onRangeChangeCallback(this.startTime, this.endTime);
        }
    }

    /**
     * 開始時刻を取得
     * @returns {number} 開始時刻（秒）
     */
    getStartTime() {
        return this.startTime;
    }

    /**
     * 終了時刻を取得
     * @returns {number} 終了時刻（秒）
     */
    getEndTime() {
        return this.endTime;
    }
}

// グローバルインスタンス
const rangeSelector = new RangeSelector();
