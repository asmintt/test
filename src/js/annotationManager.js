// annotationManager.js - テキスト注釈管理
// 動画の特定時刻にテキスト注釈を追加・編集・削除する機能

class AnnotationManager {
    constructor() {
        // DOM要素
        this.annotationText = document.getElementById('annotationText1'); // DOM IDは互換性のため保持
        this.annotationUseSeq = document.getElementById('annotationText1UseSeq');
        this.textFontSelect = document.getElementById('textFontSelect');
        this.presetButtons = document.querySelectorAll('.annotation-preset-btn');
        this.customTextColor = document.getElementById('customTextColor');
        this.customBgColor = document.getElementById('customBgColor');
        this.textAlignButtons = document.querySelectorAll('.text-align-btn');
        this.addAnnotationBtn = document.getElementById('addAnnotationBtn');
        this.addBlankAnnotationBtn = document.getElementById('addBlankAnnotationBtn');
        this.annotationHistoryList = document.getElementById('annotationHistoryList');

        // 時刻調整ボタン
        this.timeAdjustButtons = document.querySelectorAll('[data-video-adjust]');

        // 選択された色とフォント
        this.selectedTextColor = '#000000'; // デフォルト: 黒
        this.selectedBgColor = '#FFFFFF';   // デフォルト: 白
        this.selectedFont = 'Noto Sans JP'; // デフォルト: Noto Sans JP
        this.selectedPreset = 'explanation'; // デフォルト: 説明
        this.selectedTextAlign = 'center';  // デフォルト: 中央

        // 注釈データ（配列）
        // 各注釈: { time: 秒数, text: テキスト, textColor: 色, bgColor: 色, font: フォント, textAlign: 文字位置, useSequenceNumber: 連番使用 }
        this.annotations = [];

        // 編集モード
        this.isEditMode = false;
        this.editingIndex = -1;
        this.originalAnnotation = null;

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
                const offset = parseFloat(button.getAttribute('data-video-adjust'));
                this.adjustTime(offset);
            });
        });

        // 配色コントロールのイベントハンドラ
        this.initColorControls();

        // フォント選択イベント
        if (this.textFontSelect) {
            this.textFontSelect.addEventListener('change', () => {
                this.selectedFont = this.textFontSelect.value;

                // 入力フィールドにフォントを適用（プレビュー）
                if (this.annotationText) {
                    this.annotationText.style.fontFamily = `"${this.selectedFont}", sans-serif`;
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

        // 初期値をHTMLのactive状態から読み取る
        const activeTextAlignButton = document.querySelector('.text-align-btn.active');
        if (activeTextAlignButton) {
            this.selectedTextAlign = activeTextAlignButton.getAttribute('data-align');
            console.log('[DEBUG] 文字配置の初期値をHTMLから読み取り:', this.selectedTextAlign);
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

        // 注釈カスタムボタンのダブルクリック → モーダルを開く
        const annotationCustomBtn = document.getElementById('annotationCustomPresetBtn');
        if (annotationCustomBtn) {
            annotationCustomBtn.addEventListener('dblclick', () => {
                this.openCustomSettingsModal();
            });
        }

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
        console.log(`[DEBUG] selectTextAlign呼び出し: ${align}`);
        console.log(`[DEBUG] 変更前: this.selectedTextAlign = ${this.selectedTextAlign}`);
        this.selectedTextAlign = align;
        console.log(`[DEBUG] 変更後: this.selectedTextAlign = ${this.selectedTextAlign}`);

        // 文字位置ボタンのactive状態を更新
        this.textAlignButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        console.log(`文字位置を${align}に変更しました`);
    }


    /**
     * 動画読み込み時の設定
     */
    onVideoLoaded() {
        console.log('[DEBUG] onVideoLoaded呼び出し');
        console.log('[DEBUG] this.textAlignButtons =', this.textAlignButtons);
        console.log('[DEBUG] this.textAlignButtons.length =', this.textAlignButtons.length);

        // UIを有効化
        setEnabledMultiple([
            this.annotationText,
            this.annotationUseSeq,
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
        console.log('[DEBUG] 文字位置ボタンを有効化します');
        this.textAlignButtons.forEach(button => {
            console.log('[DEBUG] ボタン有効化:', button);
            button.disabled = false;
        });

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
        this.timeAdjustButtons.forEach(button => {
            button.disabled = false;
        });

        // 初期フォントを入力フィールドに適用
        if (this.annotationText) {
            this.annotationText.style.fontFamily = `"${this.selectedFont}", sans-serif`;
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

        const text = this.annotationText.value.trim();

        if (!text) {
            alert('注釈テキストを入力してください');
            return;
        }

        const currentTime = videoPlayer.getCurrentTime();

        console.log(`[DEBUG] 注釈追加時の this.selectedTextAlign = ${this.selectedTextAlign}`);

        // 注釈オブジェクトを作成
        const annotation = {
            time: currentTime,
            text: text,
            textColor: this.selectedTextColor,
            bgColor: this.selectedBgColor,
            font: this.selectedFont,
            textAlign: this.selectedTextAlign,
            useSequenceNumber: this.annotationUseSeq.checked
        };

        console.log('[DEBUG] 作成した注釈オブジェクト:', annotation);

        // 編集モードの場合は上書き更新
        if (this.isEditMode && this.editingIndex >= 0) {
            console.log('編集モード: 注釈を上書き更新します。インデックス:', this.editingIndex);
            this.annotations[this.editingIndex] = annotation;

            // 編集モードを解除
            this.isEditMode = false;
            this.editingIndex = -1;
            this.originalAnnotation = null;
        } else {
            // 新規追加
            this.annotations.push(annotation);
        }

        this.sortAnnotations();

        // リストを再描画
        this.renderAnnotationList();

        // 入力欄をクリア
        this.annotationText.value = '';

        // プレビュー画面のフォントサイズを再計算
        if (videoPlayer && typeof videoPlayer.calculateGlobalScaleFactor === 'function') {
            videoPlayer.calculateGlobalScaleFactor();
        }

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
            bgColor: '#ffffff',
            font: this.selectedFont,
            textAlign: 'center',
            useSequenceNumber: false
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
        if (!this.annotationHistoryList) return;

        // リストをクリア
        this.annotationHistoryList.innerHTML = '';

        // 注釈がない場合
        if (this.annotations.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.className = 'empty-message';
            emptyMsg.textContent = '注釈が登録されていません';
            this.annotationHistoryList.appendChild(emptyMsg);
            return;
        }

        // 各注釈を降順で描画
        for (let i = this.annotations.length - 1; i >= 0; i--) {
            const item = this.createAnnotationHistoryItem(this.annotations[i], i);
            this.annotationHistoryList.appendChild(item);
        }
    }

    /**
     * 注釈履歴アイテムのHTML要素を作成（コンパクト版）
     * @param {Object} annotation - 注釈オブジェクト
     * @param {number} index - インデックス
     * @returns {HTMLElement} 注釈アイテム要素
     */
    createAnnotationHistoryItem(annotation, index) {
        const item = document.createElement('div');
        item.className = 'history-item';

        // ヘッダー行（時刻とボタン）
        const headerDiv = document.createElement('div');
        headerDiv.className = 'history-item-header';

        // 時刻表示
        const timeSpan = document.createElement('div');
        timeSpan.className = 'history-time';
        timeSpan.textContent = formatTimeWithDecimal(annotation.time);
        timeSpan.addEventListener('click', () => {
            if (videoPlayer) {
                videoPlayer.setCurrentTime(annotation.time);
            }
        });
        headerDiv.appendChild(timeSpan);

        // ボタン
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'history-buttons';

        const editBtn = document.createElement('button');
        editBtn.className = 'btn-edit';
        editBtn.textContent = '編集';
        editBtn.addEventListener('click', () => this.editAnnotation(index));
        buttonsDiv.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.textContent = '削除';
        deleteBtn.addEventListener('click', () => this.deleteAnnotation(index));
        buttonsDiv.appendChild(deleteBtn);

        headerDiv.appendChild(buttonsDiv);
        item.appendChild(headerDiv);

        // 注釈テキスト表示
        const contentDiv = document.createElement('div');
        contentDiv.className = 'history-content';

        // 連番を計算
        let seqNumber = '';
        if (annotation.useSequenceNumber && annotation.text) {
            // 時刻順で連番を計算
            const sortedAnnotations = this.annotations
                .filter(a => a.useSequenceNumber && a.text)
                .sort((a, b) => a.time - b.time);

            // 現在の注釈のインデックスを探す
            const seqIndex = sortedAnnotations.findIndex(a =>
                Math.abs(a.time - annotation.time) < 0.001 &&
                a.text === annotation.text
            );

            if (seqIndex !== -1) {
                seqNumber = `(${seqIndex + 1}) `;
            }
        }

        const displayText = annotation.text
            ? `${seqNumber}${annotation.text}`
            : '表示終了';
        contentDiv.textContent = displayText;
        contentDiv.style.color = annotation.textColor;
        contentDiv.style.backgroundColor = annotation.bgColor;
        contentDiv.style.padding = '2px 6px';
        contentDiv.style.borderRadius = '3px';
        contentDiv.style.whiteSpace = 'pre-line';
        item.appendChild(contentDiv);

        return item;
    }

    /**
     * 注釈を編集
     * @param {number} index - 編集する注釈のインデックス
     */
    editAnnotation(index) {
        const annotation = this.annotations[index];

        // 編集モードに入る
        this.isEditMode = true;
        this.editingIndex = index;
        this.originalAnnotation = JSON.parse(JSON.stringify(annotation));

        console.log('注釈編集モードに入ります。インデックス:', index);

        // 入力フィールドに現在の値を設定
        this.annotationText.value = annotation.text || '';

        // 色を設定
        this.selectedTextColor = annotation.textColor;
        this.selectedBgColor = annotation.bgColor;

        // フォントを設定
        if (annotation.font) {
            this.selectedFont = annotation.font;
            if (this.textFontSelect) {
                this.textFontSelect.value = annotation.font;
            }
        }

        // 文字位置を設定
        if (annotation.textAlign) {
            this.selectedTextAlign = annotation.textAlign;
            this.textAlignButtons.forEach(btn => {
                if (btn.getAttribute('data-align') === annotation.textAlign) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        // 連番チェックボックスを設定
        if (this.annotationUseSeq) {
            this.annotationUseSeq.checked = annotation.useSequenceNumber || false;
        }

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

        // プレビュー画面のフォントサイズを再計算
        if (videoPlayer && typeof videoPlayer.calculateGlobalScaleFactor === 'function') {
            videoPlayer.calculateGlobalScaleFactor();
        }

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

        // 次の注釈が「注釈なし」（textが空）の場合は表示しない
        if (nextAnnotation && !nextAnnotation.text && nextAnnotation.time <= currentTime) {
            return null;
        }

        // 現在の注釈が「注釈なし」の場合は表示しない
        if (!activeAnnotation.text) {
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

        // プレビュー画面のフォントサイズを再計算
        if (videoPlayer && typeof videoPlayer.calculateGlobalScaleFactor === 'function') {
            videoPlayer.calculateGlobalScaleFactor();
        }

        console.log(`テキスト注釈を${annotations.length}件読み込みました`);
    }

    /**
     * アノテーションデータを取得
     * @returns {Array} アノテーションデータ
     */
    getAnnotations() {
        return this.annotations;
    }

    /**
     * カスタム設定モーダルを開く
     */
    openCustomSettingsModal() {
        const modal = document.getElementById('customSettingsModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        const annotationCustomBtn = document.getElementById('annotationCustomPresetBtn');

        if (!modal || !modalTitle || !modalBody || !annotationCustomBtn) return;

        // モーダルタイトル
        modalTitle.textContent = '注釈カスタム設定';

        // モーダルコンテンツ
        const currentTextColor = annotationCustomBtn.getAttribute('data-text-color') || '#000000';
        const currentBgColor = annotationCustomBtn.getAttribute('data-bg-color') || '#FFFFFF';
        modalBody.innerHTML = `
            <label>文字色:</label>
            <input type="color" id="annotationCustomTextColorModal" value="${currentTextColor}">
            <label>背景色:</label>
            <input type="color" id="annotationCustomBgColorModal" value="${currentBgColor}">
            <button id="saveAnnotationCustomBtnModal" class="btn-primary">登録</button>
        `;

        // モーダル表示
        modal.style.display = 'flex';

        // 閉じるボタン
        const closeBtn = modal.querySelector('.modal-close-btn');
        if (closeBtn) {
            closeBtn.onclick = () => this.closeModal();
        }

        // オーバーレイクリックで閉じる
        modal.onclick = (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        };

        // 登録ボタン
        const saveBtn = document.getElementById('saveAnnotationCustomBtnModal');
        const textColorInput = document.getElementById('annotationCustomTextColorModal');
        const bgColorInput = document.getElementById('annotationCustomBgColorModal');
        if (saveBtn && textColorInput && bgColorInput) {
            saveBtn.onclick = () => {
                const textColor = textColorInput.value;
                const bgColor = bgColorInput.value;

                // カスタムボタンに色を保存
                annotationCustomBtn.setAttribute('data-text-color', textColor);
                annotationCustomBtn.setAttribute('data-bg-color', bgColor);
                annotationCustomBtn.style.color = textColor;
                annotationCustomBtn.style.backgroundColor = bgColor;

                console.log('注釈カスタム色を登録:', { textColor, bgColor });
                alert('カスタム色を登録しました！');
                this.closeModal();
            };
        }
    }

    /**
     * モーダルを閉じる
     */
    closeModal() {
        const modal = document.getElementById('customSettingsModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
}

// グローバルインスタンス
const annotationManager = new AnnotationManager();
