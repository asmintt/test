// annotationManager.js - テキスト注釈管理
// 動画の特定時刻にテキスト注釈を追加・編集・削除する機能

class AnnotationManager {
    constructor() {
        // DOM要素
        this.annotationText = document.getElementById('annotationText');
        this.textColorPalette = document.getElementById('textColorPalette');
        this.bgColorPalette = document.getElementById('bgColorPalette');
        this.addAnnotationBtn = document.getElementById('addAnnotationBtn');
        this.addBlankAnnotationBtn = document.getElementById('addBlankAnnotationBtn');
        this.annotationList = document.getElementById('annotationList');

        // 時刻調整ボタン
        this.timeAdjustButtons = document.querySelectorAll('[data-adjust]');
        this.syncAnnotationTimeBtn = document.getElementById('syncAnnotationTime');
        this.resetAnnotationTimeBtn = document.getElementById('resetAnnotationTime');

        // 選択された色
        this.selectedTextColor = '#000000'; // デフォルト: 黒
        this.selectedBgColor = '#FFFFFF';   // デフォルト: 白

        // 注釈データ（配列）
        // 各注釈: { time: 秒数, text: テキスト, textColor: 色, bgColor: 色 }
        this.annotations = [];

        // コールバック
        this.onAnnotationsChangeCallback = null;
    }

    /**
     * 初期化
     */
    init() {
        // 注釈追加ボタン
        if (this.addAnnotationBtn) {
            this.addAnnotationBtn.addEventListener('click', () => {
                this.addAnnotation();
            });
        }

        // 注釈なし追加ボタン
        if (this.addBlankAnnotationBtn) {
            this.addBlankAnnotationBtn.addEventListener('click', () => {
                this.addBlankAnnotation();
            });
        }

        // 時刻調整ボタン
        this.timeAdjustButtons.forEach(button => {
            button.addEventListener('click', () => {
                const offset = parseFloat(button.getAttribute('data-adjust'));
                this.adjustTime(offset);
            });
        });

        // 現在位置ボタン
        if (this.syncAnnotationTimeBtn) {
            this.syncAnnotationTimeBtn.addEventListener('click', () => {
                // 何もしない（既に動画の現在位置が表示されているため）
                // このボタンは主に視覚的な確認のため
            });
        }

        // リセットボタン
        if (this.resetAnnotationTimeBtn) {
            this.resetAnnotationTimeBtn.addEventListener('click', () => {
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
        if (this.textColorPalette) {
            const textColorButtons = this.textColorPalette.querySelectorAll('.color-btn');
            textColorButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const color = button.getAttribute('data-color');
                    this.selectTextColor(color, button);
                });
            });
        }

        // 背景色パレット
        if (this.bgColorPalette) {
            const bgColorButtons = this.bgColorPalette.querySelectorAll('.color-btn');
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
     * @param {string} color - 選択された色
     * @param {HTMLElement} button - クリックされたボタン
     */
    selectTextColor(color, button) {
        this.selectedTextColor = color;

        // すべてのボタンからactiveクラスを削除
        const allButtons = this.textColorPalette.querySelectorAll('.color-btn');
        allButtons.forEach(btn => btn.classList.remove('active'));

        // クリックされたボタンにactiveクラスを追加
        button.classList.add('active');
    }

    /**
     * 背景色を選択
     * @param {string} color - 選択された色
     * @param {HTMLElement} button - クリックされたボタン
     */
    selectBgColor(color, button) {
        this.selectedBgColor = color;

        // すべてのボタンからactiveクラスを削除
        const allButtons = this.bgColorPalette.querySelectorAll('.color-btn');
        allButtons.forEach(btn => btn.classList.remove('active'));

        // クリックされたボタンにactiveクラスを追加
        button.classList.add('active');
    }

    /**
     * 動画読み込み時の設定
     */
    onVideoLoaded() {
        // 最大文字数を計算してプレースホルダーを設定
        if (videoPlayer && videoPlayer.video) {
            const videoWidth = videoPlayer.video.videoWidth;
            const maxCharacters = Math.floor((videoWidth - 110) / 60);

            if (this.annotationText) {
                this.annotationText.placeholder = `文字数：${maxCharacters}文字まで`;
                this.annotationText.maxLength = maxCharacters;
            }
        }

        // UIを有効化
        setEnabledMultiple([
            this.annotationText,
            this.addAnnotationBtn,
            this.addBlankAnnotationBtn
        ], true);

        // 時刻調整ボタンを有効化
        this.timeAdjustButtons.forEach(button => {
            button.disabled = false;
        });
        if (this.syncAnnotationTimeBtn) this.syncAnnotationTimeBtn.disabled = false;
        if (this.resetAnnotationTimeBtn) this.resetAnnotationTimeBtn.disabled = false;

        // プロジェクト読み込み中でない場合のみ注釈リストをクリア
        if (projectManager && !projectManager.isLoadingProject) {
            console.log('[DEBUG] annotationManager: 注釈リストをクリアします');
            this.annotations = [];
        } else {
            console.log('[DEBUG] annotationManager: プロジェクト読み込み中のため注釈リストをクリアしません');
        }
        this.renderAnnotationList();
    }

    /**
     * 時刻を調整
     * @param {number} offset - 調整する秒数（正または負）
     */
    adjustTime(offset) {
        if (!videoPlayer) return;

        const currentTime = videoPlayer.getCurrentTime();
        const newTime = currentTime + offset;
        videoPlayer.setCurrentTime(newTime);
    }

    /**
     * 時刻をリセット
     */
    resetTime() {
        if (!videoPlayer) return;
        videoPlayer.setCurrentTime(0);
    }

    /**
     * 注釈を追加
     */
    addAnnotation() {
        if (!videoPlayer) return;

        const text = this.annotationText.value.trim();
        if (!text) {
            alert('注釈テキストを入力してください');
            return;
        }

        const currentTime = videoPlayer.getCurrentTime();

        // 注釈オブジェクトを作成
        const annotation = {
            time: currentTime,
            text: text,
            textColor: this.selectedTextColor,
            bgColor: this.selectedBgColor
        };

        // 配列に追加して時刻順にソート
        this.annotations.push(annotation);
        this.sortAnnotations();

        // リストを再描画
        this.renderAnnotationList();

        // 入力欄をクリア
        this.annotationText.value = '';

        // コールバック実行
        this.notifyChange();
    }

    /**
     * 注釈なしを追加（時刻のみ記録）
     */
    addBlankAnnotation() {
        if (!videoPlayer) return;

        const currentTime = videoPlayer.getCurrentTime();

        // 空のテキストで注釈を追加
        const annotation = {
            time: currentTime,
            text: '',
            textColor: '#000000',
            bgColor: '#ffffff'
        };

        this.annotations.push(annotation);
        this.sortAnnotations();
        this.renderAnnotationList();
        this.notifyChange();
    }

    /**
     * 注釈を時刻順にソート
     */
    sortAnnotations() {
        this.annotations.sort((a, b) => a.time - b.time);
    }

    /**
     * 注釈リストを描画
     */
    renderAnnotationList() {
        if (!this.annotationList) return;

        // リストをクリア
        this.annotationList.innerHTML = '';

        // 注釈がない場合
        if (this.annotations.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.className = 'empty-message';
            emptyMsg.textContent = '注釈が登録されていません';
            this.annotationList.appendChild(emptyMsg);
            return;
        }

        // 各注釈を降順で描画
        for (let i = this.annotations.length - 1; i >= 0; i--) {
            const item = this.createAnnotationItem(this.annotations[i], i);
            this.annotationList.appendChild(item);
        }
    }

    /**
     * 注釈アイテムのHTML要素を作成
     * @param {Object} annotation - 注釈オブジェクト
     * @param {number} index - インデックス
     * @returns {HTMLElement} 注釈アイテム要素
     */
    createAnnotationItem(annotation, index) {
        const item = document.createElement('div');
        item.className = 'annotation-item';

        // 時刻表示
        const timeLabel = document.createElement('div');
        timeLabel.className = 'annotation-time';
        timeLabel.textContent = formatTimeWithDecimal(annotation.time);
        timeLabel.style.cursor = 'pointer';
        timeLabel.addEventListener('click', () => {
            if (videoPlayer) {
                videoPlayer.setCurrentTime(annotation.time);
            }
        });

        // テキスト表示（色付き）
        const textLabel = document.createElement('div');
        textLabel.className = 'annotation-text';
        textLabel.textContent = annotation.text || '(注釈なし)';
        textLabel.style.color = annotation.textColor;
        textLabel.style.backgroundColor = annotation.bgColor;
        textLabel.style.padding = '2px 6px';
        textLabel.style.borderRadius = '3px';

        // 修正ボタン
        const editBtn = document.createElement('button');
        editBtn.className = 'btn-edit';
        editBtn.textContent = '修正';
        editBtn.addEventListener('click', () => {
            this.editAnnotation(index);
        });

        // 削除ボタン
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.textContent = '削除';
        deleteBtn.addEventListener('click', () => {
            this.deleteAnnotation(index);
        });

        // 要素を組み立て
        item.appendChild(timeLabel);
        item.appendChild(textLabel);
        item.appendChild(editBtn);
        item.appendChild(deleteBtn);

        return item;
    }

    /**
     * 注釈を編集
     * @param {number} index - 編集する注釈のインデックス
     */
    editAnnotation(index) {
        const annotation = this.annotations[index];

        // 入力フィールドに現在の値を設定
        this.annotationText.value = annotation.text;

        // 色を設定してボタンの状態を更新
        this.selectedTextColor = annotation.textColor;
        this.selectedBgColor = annotation.bgColor;

        // 文字色パレットのアクティブ状態を更新
        if (this.textColorPalette) {
            const textColorButtons = this.textColorPalette.querySelectorAll('.color-btn');
            textColorButtons.forEach(btn => {
                if (btn.getAttribute('data-color') === annotation.textColor) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        // 背景色パレットのアクティブ状態を更新
        if (this.bgColorPalette) {
            const bgColorButtons = this.bgColorPalette.querySelectorAll('.color-btn');
            bgColorButtons.forEach(btn => {
                if (btn.getAttribute('data-color') === annotation.bgColor) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        // 注釈を削除（再追加するため）
        this.annotations.splice(index, 1);
        this.renderAnnotationList();
        this.notifyChange();

        // 動画の時刻を設定
        if (videoPlayer) {
            videoPlayer.setCurrentTime(annotation.time);
        }

        // 入力フィールドにフォーカス
        this.annotationText.focus();
    }

    /**
     * 注釈を削除
     * @param {number} index - 削除する注釈のインデックス
     */
    deleteAnnotation(index) {
        this.annotations.splice(index, 1);
        this.renderAnnotationList();
        this.notifyChange();
    }

    /**
     * すべての注釈を取得
     * @returns {Array} 注釈の配列
     */
    getAnnotations() {
        return this.annotations;
    }

    /**
     * 特定時刻の注釈を取得
     * @param {number} time - 時刻（秒）
     * @param {number} tolerance - 許容誤差（秒）
     * @returns {Object|null} 注釈オブジェクトまたはnull
     */
    getAnnotationAtTime(time, tolerance = 0.1) {
        return this.annotations.find(ann => {
            return Math.abs(ann.time - time) < tolerance;
        }) || null;
    }

    /**
     * 現在時刻で有効な注釈を取得（継続表示用）
     * 現在時刻以前の最も近い注釈から、次の注釈または「注釈なし」まで継続表示
     * @param {number} currentTime - 現在時刻（秒）
     * @returns {Object|null} 有効な注釈オブジェクトまたはnull
     */
    getActiveAnnotationAtTime(currentTime) {
        if (this.annotations.length === 0) return null;

        // 現在時刻以前の注釈を取得
        const previousAnnotations = this.annotations.filter(ann => ann.time <= currentTime);

        if (previousAnnotations.length === 0) return null;

        // 最も近い注釈を取得
        const activeAnnotation = previousAnnotations[previousAnnotations.length - 1];

        // 次の注釈を取得
        const nextAnnotation = this.annotations.find(ann => ann.time > currentTime);

        // 次の注釈が「注釈なし」（text が空）の場合は表示しない
        if (nextAnnotation && nextAnnotation.text === '' && nextAnnotation.time <= currentTime) {
            return null;
        }

        // 現在の注釈が「注釈なし」の場合は表示しない
        if (activeAnnotation.text === '') {
            return null;
        }

        return activeAnnotation;
    }

    /**
     * 注釈変更時のコールバックを設定
     * @param {Function} callback - コールバック関数
     */
    onAnnotationsChange(callback) {
        this.onAnnotationsChangeCallback = callback;
    }

    /**
     * 注釈変更を通知
     */
    notifyChange() {
        if (this.onAnnotationsChangeCallback) {
            this.onAnnotationsChangeCallback(this.annotations);
        }
    }

    /**
     * アノテーションデータを読み込み
     * @param {Array} annotations - 読み込むアノテーションデータ
     */
    loadAnnotations(annotations) {
        if (!Array.isArray(annotations)) return;

        this.annotations = annotations;
        this.renderAnnotationList();
        console.log(`テキスト注釈を${annotations.length}件読み込みました`);
    }

    /**
     * アノテーションデータを取得
     * @returns {Array} アノテーションデータ
     */
    getAnnotations() {
        return this.annotations;
    }
}

// グローバルインスタンス
const annotationManager = new AnnotationManager();
