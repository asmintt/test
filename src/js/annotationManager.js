// annotationManager.js - テキスト注釈管理
// 動画の特定時刻にテキスト注釈を追加・編集・削除する機能

class AnnotationManager {
    constructor() {
        // DOM要素
        this.annotationText = document.getElementById('annotationText');
        this.textColor = document.getElementById('textColor');
        this.bgColor = document.getElementById('bgColor');
        this.addAnnotationBtn = document.getElementById('addAnnotationBtn');
        this.addBlankAnnotationBtn = document.getElementById('addBlankAnnotationBtn');
        this.annotationList = document.getElementById('annotationList');

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
    }

    /**
     * 動画読み込み時の設定
     */
    onVideoLoaded() {
        // UIを有効化
        setEnabledMultiple([
            this.annotationText,
            this.textColor,
            this.bgColor,
            this.addAnnotationBtn,
            this.addBlankAnnotationBtn
        ], true);

        // 注釈リストをクリア
        this.annotations = [];
        this.renderAnnotationList();
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
        const textColor = this.textColor.value;
        const bgColor = this.bgColor.value;

        // 注釈オブジェクトを作成
        const annotation = {
            time: currentTime,
            text: text,
            textColor: textColor,
            bgColor: bgColor
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

        // 各注釈を描画
        this.annotations.forEach((annotation, index) => {
            const item = this.createAnnotationItem(annotation, index);
            this.annotationList.appendChild(item);
        });
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
        item.appendChild(deleteBtn);

        return item;
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
}

// グローバルインスタンス
const annotationManager = new AnnotationManager();
