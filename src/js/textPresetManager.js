// textPresetManager.js - テキストプリセット管理

class TextPresetManager {
    constructor() {
        // DOM要素
        this.manageBtn = document.getElementById('manageTextPresetBtn');
        this.modal = document.getElementById('textPresetModal');
        this.closeBtn = document.getElementById('closeTextPresetModal');
        this.saveBtn = document.getElementById('saveTextPresets');
        this.cancelBtn = document.getElementById('cancelTextPresets');
        this.presetList = document.getElementById('presetList');
        this.presetButtonsContainer = document.getElementById('textPresetButtons');

        // プリセットデータ（最大10個）
        this.presets = [];

        // 選択中のプリセット
        this.selectedPreset = null;

        // 一時保存用（キャンセル時に復元）
        this.tempPresets = null;
    }

    /**
     * 初期化
     */
    init() {
        // localStorageからプリセットを読み込み
        this.loadPresets();

        // プリセットボタンを生成
        this.renderPresetButtons();

        // イベントリスナーの設定
        if (this.manageBtn) {
            this.manageBtn.addEventListener('click', () => this.openModal());
        }

        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.closeModal());
        }

        if (this.saveBtn) {
            this.saveBtn.addEventListener('click', () => this.savePresets());
        }

        if (this.cancelBtn) {
            this.cancelBtn.addEventListener('click', () => this.closeModal());
        }

        // モーダル外をクリックで閉じる
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.closeModal();
                }
            });
        }

        console.log('TextPresetManager initialized');
    }

    /**
     * localStorageからプリセットを読み込み
     */
    loadPresets() {
        const saved = localStorage.getItem('textPresets');
        if (saved) {
            try {
                this.presets = JSON.parse(saved);
                console.log('テキストプリセットを読み込みました:', this.presets);
            } catch (e) {
                console.error('プリセットの読み込みに失敗しました:', e);
                this.presets = [];
            }
        } else {
            // デフォルトプリセット
            this.presets = [
                { text: 'ポイント', color: '#000000' },
                { text: '注目', color: '#000000' },
                { text: '重要', color: '#000000' }
            ];
        }
    }

    /**
     * localStorageに保存
     */
    savePresetsToStorage() {
        localStorage.setItem('textPresets', JSON.stringify(this.presets));
        console.log('テキストプリセットを保存しました');
    }

    /**
     * モーダルを開く
     */
    openModal() {
        // 現在のプリセットを一時保存
        this.tempPresets = JSON.parse(JSON.stringify(this.presets));

        // プリセット編集UIを描画
        this.renderPresetList();

        // モーダルを表示
        this.modal.style.display = 'flex';
    }

    /**
     * モーダルを閉じる（キャンセル）
     */
    closeModal() {
        // 一時保存から復元
        if (this.tempPresets) {
            this.presets = this.tempPresets;
            this.tempPresets = null;
        }

        this.modal.style.display = 'none';
    }

    /**
     * プリセットを保存して閉じる
     */
    savePresets() {
        // モーダル内の入力値を取得
        const items = this.presetList.querySelectorAll('.preset-item');
        this.presets = [];

        items.forEach((item, index) => {
            const textInput = item.querySelector('input[type="text"]');
            const colorInput = item.querySelector('input[type="color"]');

            if (textInput && textInput.value.trim()) {
                this.presets.push({
                    text: textInput.value.trim(),
                    color: colorInput.value
                });
            }
        });

        // localStorageに保存
        this.savePresetsToStorage();

        // プリセットボタンを再生成
        this.renderPresetButtons();

        // モーダルを閉じる
        this.modal.style.display = 'none';
        this.tempPresets = null;

        console.log('プリセットを保存しました:', this.presets);
    }

    /**
     * プリセット編集リストを描画
     */
    renderPresetList() {
        this.presetList.innerHTML = '';

        // 10個のスロットを作成
        for (let i = 0; i < 10; i++) {
            const preset = this.presets[i] || { text: '', color: '#000000' };

            const item = document.createElement('div');
            item.className = 'preset-item';

            item.innerHTML = `
                <span class="preset-item-number">${i + 1}.</span>
                <input type="text" placeholder="テキスト（10文字まで）" maxlength="10" value="${preset.text}">
                <input type="color" value="${preset.color}">
                <button class="preset-item-delete" data-index="${i}">削除</button>
            `;

            // 削除ボタンのイベントリスナー
            const deleteBtn = item.querySelector('.preset-item-delete');
            deleteBtn.addEventListener('click', () => {
                const textInput = item.querySelector('input[type="text"]');
                const colorInput = item.querySelector('input[type="color"]');
                textInput.value = '';
                colorInput.value = '#000000';
            });

            this.presetList.appendChild(item);
        }
    }

    /**
     * プリセットボタンを動的に生成
     */
    renderPresetButtons() {
        this.presetButtonsContainer.innerHTML = '';

        if (this.presets.length === 0) {
            this.presetButtonsContainer.innerHTML = '<p style="font-size: 0.7rem; color: #999; margin: 5px 0;">プリセットが登録されていません</p>';
            return;
        }

        this.presets.forEach((preset, index) => {
            const btn = document.createElement('button');
            btn.className = 'text-preset-btn';
            btn.textContent = preset.text;
            btn.style.color = preset.color;
            btn.style.borderColor = preset.color;
            btn.dataset.text = preset.text;
            btn.dataset.color = preset.color;
            btn.dataset.index = index;

            // クリックイベント
            btn.addEventListener('click', () => {
                this.selectPreset(preset, btn);
            });

            this.presetButtonsContainer.appendChild(btn);
        });
    }

    /**
     * プリセットを選択
     * @param {Object} preset - 選択されたプリセット
     * @param {HTMLElement} btn - クリックされたボタン
     */
    selectPreset(preset, btn) {
        // 選択状態を保存
        this.selectedPreset = preset;

        // すべてのボタンのactive状態を解除
        this.presetButtonsContainer.querySelectorAll('.text-preset-btn').forEach(b => {
            b.classList.remove('active');
        });

        // クリックされたボタンをactiveに
        btn.classList.add('active');

        // shapeAnnotationManagerに'text'タイプを選択させる
        if (typeof shapeAnnotationManager !== 'undefined') {
            shapeAnnotationManager.selectShape('text');
            shapeAnnotationManager.selectedTextPreset = preset;
            shapeAnnotationManager.selectedShapeColor = preset.color;

            console.log('テキストプリセットを選択:', preset);
        }
    }

    /**
     * 選択中のプリセットを取得
     * @returns {Object|null} - 選択中のプリセット
     */
    getSelectedPreset() {
        return this.selectedPreset;
    }

    /**
     * プリセットをすべて取得
     * @returns {Array} - プリセットの配列
     */
    getAllPresets() {
        return this.presets;
    }
}

// グローバルインスタンス
let textPresetManager = null;
