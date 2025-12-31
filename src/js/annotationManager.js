// annotationManager.js - テキスト注釈管理
// 動画の特定時刻にテキスト注釈を追加・編集・削除する機能

class AnnotationManager {
    constructor() {
        // DOM要素
        this.annotationText1 = document.getElementById('annotationText1');
        this.annotationText2 = document.getElementById('annotationText2');
        this.annotationText1UseSeq = document.getElementById('annotationText1UseSeq');
        this.textFontSelect = document.getElementById('textFontSelect');
        this.presetButtons = document.querySelectorAll('.preset-btn');
        this.customTextColor = document.getElementById('customTextColor');
        this.customBgColor = document.getElementById('customBgColor');
        this.textAlignButtons = document.querySelectorAll('.text-align-btn');
        this.saveCustomPresetBtn = document.getElementById('saveCustomPresetBtn');
        this.customPresetBtn = document.getElementById('customPresetBtn');
        this.addAnnotationBtn = document.getElementById('addAnnotationBtn');
        this.addBlankAnnotationBtn = document.getElementById('addBlankAnnotationBtn');
        this.annotationList = document.getElementById('annotationList');

        // 時刻調整ボタン
        this.timeAdjustButtons = document.querySelectorAll('[data-adjust]');
        this.syncAnnotationTimeBtn = document.getElementById('syncAnnotationTime');
        this.resetAnnotationTimeBtn = document.getElementById('resetAnnotationTime');

        // 選択された色とフォント
        this.selectedTextColor = '#000000'; // デフォルト: 黒
        this.selectedBgColor = '#FFFFFF';   // デフォルト: 白
        this.selectedFont = 'Noto Sans JP'; // デフォルト: Noto Sans JP
        this.selectedPreset = 'explanation'; // デフォルト: 説明
        this.selectedTextAlign = 'center';  // デフォルト: 中央

        // 注釈データ（配列）
        // 各注釈: { time: 秒数, text1: 1段目テキスト, text2: 2段目テキスト, textColor: 色, bgColor: 色, font: フォント, textAlign: 文字位置 }
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

        // 配色コントロールのイベントハンドラ
        this.initColorControls();

        // フォント選択イベント
        if (this.textFontSelect) {
            this.textFontSelect.addEventListener('change', () => {
                this.selectedFont = this.textFontSelect.value;

                // 入力フィールドにフォントを適用（プレビュー）
                if (this.annotationText1) {
                    this.annotationText1.style.fontFamily = `"${this.selectedFont}", sans-serif`;
                }
                if (this.annotationText2) {
                    this.annotationText2.style.fontFamily = `"${this.selectedFont}", sans-serif`;
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
    }

    /**
     * プリセットを選択
     * @param {string} preset - プリセット名
     * @param {string} textColor - 文字色
     * @param {string} bgColor - 背景色
     * @param {HTMLElement} button - クリックされたボタン
     */
    selectPreset(preset, textColor, bgColor, button) {
        this.selectedPreset = preset;
        this.selectedTextColor = textColor;
        this.selectedBgColor = bgColor;

        // 文字位置も取得
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
        this.customPresetBtn.setAttribute('data-text-align', this.selectedTextAlign);

        // ボタンに色を視覚的に反映
        this.customPresetBtn.style.color = this.selectedTextColor;
        this.customPresetBtn.style.backgroundColor = this.selectedBgColor;

        console.log('カスタムプリセットを登録しました:', {
            textColor: this.selectedTextColor,
            bgColor: this.selectedBgColor,
            textAlign: this.selectedTextAlign
        });

        alert('カスタム設定を登録しました！');
    }

    /**
     * 動画読み込み時の設定
     */
    onVideoLoaded() {
        // UIを有効化
        setEnabledMultiple([
            this.annotationText1,
            this.annotationText2,
            this.annotationText1UseSeq,
            this.textFontSelect,
            this.customTextColor,
            this.customBgColor,
            this.addAnnotationBtn,
            this.addBlankAnnotationBtn,
            this.saveCustomPresetBtn
        ], true);

        // プリセットボタンを有効化
        this.presetButtons.forEach(button => {
            button.disabled = false;
        });

        // 文字位置ボタンを有効化
        this.textAlignButtons.forEach(button => {
            button.disabled = false;
        });

        // 時刻調整ボタンを有効化
        this.timeAdjustButtons.forEach(button => {
            button.disabled = false;
        });
        if (this.syncAnnotationTimeBtn) this.syncAnnotationTimeBtn.disabled = false;
        if (this.resetAnnotationTimeBtn) this.resetAnnotationTimeBtn.disabled = false;

        // 初期フォントを入力フィールドに適用
        if (this.annotationText1) {
            this.annotationText1.style.fontFamily = `"${this.selectedFont}", sans-serif`;
        }
        if (this.annotationText2) {
            this.annotationText2.style.fontFamily = `"${this.selectedFont}", sans-serif`;
        }

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

        const text1 = this.annotationText1.value.trim();
        const text2 = this.annotationText2.value.trim();

        if (!text1 && !text2) {
            alert('注釈テキストを入力してください');
            return;
        }

        const currentTime = videoPlayer.getCurrentTime();

        // 注釈オブジェクトを作成
        const annotation = {
            time: currentTime,
            text1: text1,
            text2: text2,
            textColor: this.selectedTextColor,
            bgColor: this.selectedBgColor,
            font: this.selectedFont,
            textAlign: this.selectedTextAlign,
            useSequenceNumber: this.annotationText1UseSeq.checked
        };

        // 配列に追加して時刻順にソート
        this.annotations.push(annotation);
        this.sortAnnotations();

        // リストを再描画
        this.renderAnnotationList();

        // 入力欄をクリア
        this.annotationText1.value = '';
        this.annotationText2.value = '';

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
            text1: '',
            text2: '',
            textColor: '#000000',
            bgColor: '#ffffff',
            font: this.selectedFont,
            textAlign: 'center'
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
        // 2行テキストを改行で結合
        const displayText = (annotation.text1 || annotation.text2)
            ? `${annotation.text1 || ''}\n${annotation.text2 || ''}`
            : '(注釈なし)';

        return createListItem({
            itemClassName: 'annotation-item',
            time: annotation.time,
            useDecimalTime: true,
            onTimeClick: () => {
                if (videoPlayer) {
                    videoPlayer.setCurrentTime(annotation.time);
                }
            },
            text: displayText,
            textStyle: {
                color: annotation.textColor,
                backgroundColor: annotation.bgColor,
                padding: '2px 6px',
                borderRadius: '3px',
                whiteSpace: 'pre-line'
            },
            onEdit: () => this.editAnnotation(index),
            onDelete: () => this.deleteAnnotation(index)
        });
    }

    /**
     * 注釈を編集
     * @param {number} index - 編集する注釈のインデックス
     */
    editAnnotation(index) {
        const annotation = this.annotations[index];

        // 入力フィールドに現在の値を設定
        this.annotationText1.value = annotation.text1 || '';
        this.annotationText2.value = annotation.text2 || '';

        // 色を設定
        this.selectedTextColor = annotation.textColor;
        this.selectedBgColor = annotation.bgColor;

        // プリセットボタンの状態を更新
        let matchedPreset = false;
        this.presetButtons.forEach(btn => {
            const presetTextColor = btn.getAttribute('data-text-color');
            const presetBgColor = btn.getAttribute('data-bg-color');

            if (presetTextColor === annotation.textColor && presetBgColor === annotation.bgColor) {
                btn.classList.add('active');
                this.selectedPreset = btn.getAttribute('data-preset');
                matchedPreset = true;
            } else {
                btn.classList.remove('active');
            }
        });

        // プリセットと一致しない場合はカスタム色として扱う
        if (!matchedPreset) {
            this.selectedPreset = null;
        }

        // カスタムカラーピッカーを同期
        if (this.customTextColor) this.customTextColor.value = annotation.textColor;
        if (this.customBgColor) this.customBgColor.value = annotation.bgColor;

        // 注釈を削除（再追加するため）
        this.annotations.splice(index, 1);
        this.renderAnnotationList();
        this.notifyChange();

        // 動画の時刻を設定
        if (videoPlayer) {
            videoPlayer.setCurrentTime(annotation.time);
        }

        // 入力フィールドにフォーカス
        this.annotationText1.focus();
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

        // 次の注釈が「注釈なし」（text1とtext2が両方とも空）の場合は表示しない
        if (nextAnnotation && !nextAnnotation.text1 && !nextAnnotation.text2 && nextAnnotation.time <= currentTime) {
            return null;
        }

        // 現在の注釈が「注釈なし」の場合は表示しない
        if (!activeAnnotation.text1 && !activeAnnotation.text2) {
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
