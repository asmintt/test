// arrowAnnotationManager.js - 方向矢印機能
// プレビュー動画上に「←左」「右→」の矢印を配置

class ArrowAnnotationManager {
    constructor() {
        // DOM要素
        this.arrowBtns = document.querySelectorAll('.arrow-btn');
        this.arrowSizeSelect = document.getElementById('arrowSizeSelect');
        this.arrowColorBtns = document.querySelectorAll('.arrow-color-btn');
        this.addArrowBtn = document.getElementById('addArrowBtn');
        this.arrowList = document.getElementById('arrowList');
        this.videoPreview = document.getElementById('videoPreview');

        // 状態
        this.arrows = []; // 矢印データの配列
        this.selectedArrowType = null; // 'left' or 'right'
        this.selectedSize = 5;
        this.selectedColor = {
            left: '#1976D2',
            right: '#FF9800'
        };

        // イベントハンドラをバインド
        this.handleArrowBtnClick = this.handleArrowBtnClick.bind(this);
        this.handleVideoClick = this.handleVideoClick.bind(this);
    }

    /**
     * 初期化
     */
    init() {
        // 方向ボタンのクリックイベント
        this.arrowBtns.forEach(btn => {
            btn.addEventListener('click', this.handleArrowBtnClick);
        });

        // サイズ選択
        if (this.arrowSizeSelect) {
            this.arrowSizeSelect.addEventListener('change', (e) => {
                this.selectedSize = parseInt(e.target.value);
            });
        }

        // 色ボタン（表示のみ、クリック不可）
        // 色は固定なので特にイベントは不要

        // 動画プレビューのクリックイベント
        if (this.videoPreview) {
            this.videoPreview.addEventListener('click', this.handleVideoClick);
        }
    }

    /**
     * 動画読み込み時の設定
     */
    onVideoLoaded() {
        // ボタンを有効化
        setEnabledMultiple([
            ...this.arrowBtns,
            this.arrowSizeSelect,
            this.addArrowBtn
        ], true);

        // リストをクリア
        this.clearArrows();
    }

    /**
     * 方向ボタンのクリック
     */
    handleArrowBtnClick(e) {
        const btn = e.currentTarget;
        const arrowType = btn.dataset.arrow;

        // すべてのボタンから active クラスを削除
        this.arrowBtns.forEach(b => b.classList.remove('active'));

        // クリックされたボタンに active クラスを追加
        btn.classList.add('active');

        // 選択された矢印タイプを保存
        this.selectedArrowType = arrowType;
    }

    /**
     * 動画プレビューのクリック
     */
    handleVideoClick(e) {
        if (!this.selectedArrowType) {
            return; // 矢印が選択されていない場合は何もしない
        }

        if (!videoPlayer || !videoPlayer.video) {
            return;
        }

        // クリック位置を取得
        const rect = this.videoPreview.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // 現在の時刻を取得
        const currentTime = videoPlayer.video.currentTime;

        // 矢印データを作成
        const arrow = {
            type: this.selectedArrowType,
            time: currentTime,
            x: x,
            y: y,
            size: this.selectedSize,
            color: this.selectedColor[this.selectedArrowType]
        };

        // 矢印を追加
        this.arrows.push(arrow);

        // リストを更新
        this.updateArrowList();

        // 選択を解除
        this.arrowBtns.forEach(b => b.classList.remove('active'));
        this.selectedArrowType = null;
    }

    /**
     * 矢印リストを更新
     */
    updateArrowList() {
        if (!this.arrowList) return;

        // リストをクリア
        this.arrowList.innerHTML = '';

        if (this.arrows.length === 0) {
            this.arrowList.innerHTML = '<p class="empty-message">方向矢印が登録されていません</p>';
            return;
        }

        // 矢印データをリストに追加
        this.arrows.forEach((arrow, index) => {
            const item = document.createElement('div');
            item.className = 'arrow-list-item';
            item.innerHTML = `
                <span class="arrow-info">
                    ${formatTime(arrow.time)} - ${arrow.type === 'left' ? '←左' : '右→'}
                    (${arrow.size}px)
                </span>
                <button class="btn-delete" data-index="${index}">削除</button>
            `;

            // 削除ボタンのイベント
            const deleteBtn = item.querySelector('.btn-delete');
            deleteBtn.addEventListener('click', () => {
                this.deleteArrow(index);
            });

            this.arrowList.appendChild(item);
        });
    }

    /**
     * 矢印を削除
     */
    deleteArrow(index) {
        this.arrows.splice(index, 1);
        this.updateArrowList();
    }

    /**
     * すべての矢印をクリア
     */
    clearArrows() {
        this.arrows = [];
        this.updateArrowList();
    }

    /**
     * 矢印データを取得
     */
    getArrows() {
        return this.arrows;
    }

    /**
     * 矢印データを設定（プロジェクト読み込み時）
     */
    setArrows(arrows) {
        this.arrows = arrows || [];
        this.updateArrowList();
    }
}

// グローバルインスタンス
const arrowAnnotationManager = new ArrowAnnotationManager();
