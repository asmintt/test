# フォント選択機能 - 実装提案

## 📝 推奨フォント（3種類）

### 1. **Noto Sans JP**（推奨度：★★★）
- **特徴**: Googleが開発した高品質な日本語フォント
- **印象**: モダン、クリーン、プロフェッショナル
- **読みやすさ**: ★★★★★
- **用途**: ニュース、解説動画、ビジネス
- **太さ**: Medium（500）を推奨
- **URL**: https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@500;700&display=swap

**サンプル表示:**
```
これはNoto Sans JPのサンプルです
12345 ABCDEF
```

---

### 2. **M PLUS Rounded 1c**（推奨度：★★★）
- **特徴**: 角丸で柔らかい印象のゴシック体
- **印象**: フレンドリー、親しみやすい、カジュアル
- **読みやすさ**: ★★★★☆
- **用途**: エンタメ、子供向け、カジュアル動画
- **太さ**: Bold（700）を推奨
- **URL**: https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@500;700&display=swap

**サンプル表示:**
```
これはM PLUS Rounded 1cのサンプルです
12345 ABCDEF
```

---

### 3. **Zen Kaku Gothic New**（推奨度：★★★）
- **特徴**: シャープでコントラストが高いゴシック体
- **印象**: 力強い、クッキリ、インパクト
- **読みやすさ**: ★★★★★
- **用途**: スポーツ、ドキュメンタリー、重要な情報
- **太さ**: Bold（700）を推奨
- **URL**: https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@500;700&display=swap

**サンプル表示:**
```
これはZen Kaku Gothic Newのサンプルです
12345 ABCDEF
```

---

## 🎨 UI配置案（3パターン）

### 【案A】テキスト入力の直後に配置（推奨）

**配置場所**: テキスト入力欄と文字色パレットの間

**メリット:**
- テキスト入力 → フォント選択 → 色選択 という自然な流れ
- 文字のスタイルに関する設定が上から順に並ぶ
- 直感的で使いやすい

**デメリット:**
- なし

**UIイメージ:**
```
┌─────────────────────────────────┐
│ テキスト注釈                      │
├─────────────────────────────────┤
│ 現在位置: 00:00:00.0              │
│ [時刻調整ボタン群]                 │
│                                  │
│ [注釈テキスト入力欄]    ← 既存    │
│                                  │
│ フォント:                   ← 新規 │
│ [Noto Sans JP ▼]                │
│                                  │
│ 文字色: [●●●●●●●●●●●●]← 既存    │
│ 背景色: [●●●●●●●●●●●●]← 既存    │
│                                  │
│ [📌 追加] [注釈なし]      ← 既存   │
└─────────────────────────────────┘
```

---

### 【案B】色選択パレットの後に配置

**配置場所**: 背景色パレットと追加ボタンの間

**メリット:**
- 既存のUIレイアウトを変更せずに追加できる
- 色とフォントがまとまって見やすい

**デメリット:**
- テキスト入力から離れて分かりにくい
- スタイル設定の順序が不自然

**UIイメージ:**
```
┌─────────────────────────────────┐
│ [注釈テキスト入力欄]              │
│ 文字色: [●●●●●●●●●●●●]         │
│ 背景色: [●●●●●●●●●●●●]         │
│                                  │
│ フォント:                   ← 新規 │
│ [Noto Sans JP ▼]                │
│                                  │
│ [📌 追加] [注釈なし]              │
└─────────────────────────────────┘
```

---

### 【案C】テキスト入力欄と同じ行に配置（コンパクト）

**配置場所**: テキスト入力欄の右側（横並び）

**メリット:**
- 省スペース
- 入力とフォント選択が同時に見える

**デメリット:**
- 画面幅が狭い場合に窮屈
- 入力欄が短くなる可能性

**UIイメージ:**
```
┌──────────────────────────────────────┐
│ [注釈テキスト入力欄   ] [Noto Sans▼] │
│                                      │
│ 文字色: [●●●●●●●●●●●●]             │
│ 背景色: [●●●●●●●●●●●●]             │
└──────────────────────────────────────┘
```

---

## 🎯 推奨配置

### **案A を推奨します**

**理由:**
1. **自然な操作フロー**
   - テキスト入力 → フォント選択 → 色選択 → 追加
   - ユーザーの思考プロセスに沿っている

2. **視認性が高い**
   - フォント選択が独立した行にあり、見つけやすい
   - ドロップダウンが十分な幅を確保できる

3. **一貫性**
   - 色選択パレットと同じスタイルでラベル＋コントロールを配置
   - 既存UIとの統一感がある

4. **拡張性**
   - 将来的にフォントサイズや太さの選択を追加しやすい

---

## 💻 実装方法

### 1. HTMLの変更

**場所**: `src/index.html` の行184の後に追加

```html
<!-- テキスト入力 -->
<input type="text" id="annotationText" placeholder="注釈テキスト" disabled>

<!-- フォント選択（新規追加） -->
<div class="font-selection-section">
    <label>フォント:</label>
    <select id="textFontSelect" disabled>
        <option value="Noto Sans JP">Noto Sans JP（標準）</option>
        <option value="M PLUS Rounded 1c">M PLUS Rounded 1c（丸ゴシック）</option>
        <option value="Zen Kaku Gothic New">Zen Kaku Gothic New（角ゴシック）</option>
    </select>
</div>

<!-- 文字色選択 -->
<div class="color-palette-section">
    ...
```

### 2. CSSの追加

**場所**: `src/style.css` に追加

```css
/* フォント選択セクション */
.font-selection-section {
    margin-bottom: 12px;
}

.font-selection-section label {
    display: block;
    font-size: 12px;
    color: #555;
    margin-bottom: 4px;
}

.font-selection-section select {
    width: 100%;
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 13px;
    background-color: white;
    cursor: pointer;
    transition: border-color 0.2s;
}

.font-selection-section select:hover:not(:disabled) {
    border-color: #4CAF50;
}

.font-selection-section select:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
}

/* フォントの読み込み */
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@500;700&family=M+PLUS+Rounded+1c:wght@500;700&family=Zen+Kaku+Gothic+New:wght@500;700&display=swap');
```

### 3. JavaScriptの変更

**場所**: `src/js/annotationManager.js` に以下を追加

```javascript
constructor() {
    // 既存のDOM要素
    this.annotationText = document.getElementById('annotationText');
    this.textColorPalette = document.getElementById('textColorPalette');
    this.bgColorPalette = document.getElementById('bgColorPalette');

    // 新規追加
    this.textFontSelect = document.getElementById('textFontSelect');

    // 既存の変数
    this.selectedTextColor = '#000000';
    this.selectedBgColor = '#FFFFFF';

    // 新規追加
    this.selectedFont = 'Noto Sans JP';
    ...
}

init() {
    // 既存の初期化
    ...

    // フォント選択イベント（新規追加）
    if (this.textFontSelect) {
        this.textFontSelect.addEventListener('change', () => {
            this.selectedFont = this.textFontSelect.value;
        });
    }
}

onVideoLoaded() {
    // 既存のUI有効化
    setEnabledMultiple([
        this.annotationText,
        this.addAnnotationBtn,
        this.addBlankAnnotationBtn,
        this.textFontSelect  // ← 新規追加
    ], true);
    ...
}

addAnnotation() {
    ...
    const annotation = {
        time: currentTime,
        text: text,
        textColor: this.selectedTextColor,
        bgColor: this.selectedBgColor,
        font: this.selectedFont  // ← 新規追加
    };
    ...
}
```

### 4. frameExtractor.jsでのフォント適用

**場所**: `src/js/frameExtractor.js` の `drawTextAnnotationOnCanvas` メソッド

```javascript
drawTextAnnotationOnCanvas(ctx, currentTime, video) {
    const annotation = annotationManager.getAnnotationAtTime(currentTime);
    if (!annotation || !annotation.text) return;

    // フォントサイズ計算
    const fontSize = Math.floor(video.videoHeight * 0.05);

    // フォント設定（変更）
    const fontFamily = annotation.font || 'Noto Sans JP';  // ← 新規追加
    ctx.font = `bold ${fontSize}px "${fontFamily}", sans-serif`;

    // 以降は既存のコード...
}
```

---

## 📊 実装スコープ

### フェーズ1: テキスト注釈のフォント選択
- テキスト注釈タブにフォント選択を追加
- 3種類のフォントから選択可能
- 画像抽出時にフォントを反映

### フェーズ2: 詳細テキストのフォント選択（オプション）
- 詳細テキストタブにも同様のフォント選択を追加
- 同じ3種類のフォントを使用

### フェーズ3: 動画トリミング時のフォント反映（今後の拡張）
- 動画にテキスト注釈を焼き込む際にフォントを反映

---

## 🎨 デザインプレビュー

実装後のUI（案A）:

```
┌───────────────────────────────────────────┐
│ テキスト注釈                                │
├───────────────────────────────────────────┤
│ 現在位置: 00:00:00.0                        │
│                                            │
│ [+10秒] [+1秒] [+0.1秒] [現在位置]         │
│ [-10秒] [-1秒] [-0.1秒] [リセット]         │
│                                            │
│ ┌────────────────────────────────┐        │
│ │ 注釈テキスト                    │        │
│ └────────────────────────────────┘        │
│                                            │
│ フォント:                                  │
│ ┌────────────────────────────────┐        │
│ │ Noto Sans JP（標準）            ▼│        │
│ └────────────────────────────────┘        │
│   ├ Noto Sans JP（標準）                   │
│   ├ M PLUS Rounded 1c（丸ゴシック）        │
│   └ Zen Kaku Gothic New（角ゴシック）      │
│                                            │
│ 文字色:                                    │
│ [●][○][●][●][●][●][●][●][●][●][●][●]   │
│                                            │
│ 背景色:                                    │
│ [●][●][●][●][●][●][●][●][●][●][●][●]   │
│                                            │
│ [📌 追加]  [注釈なし]                      │
└───────────────────────────────────────────┘
```

---

## ✅ 次のステップ

1. **案Aで実装を進めてよろしいですか？**
2. **詳細テキストにも同じフォント選択を追加しますか？**
3. **他に追加したい機能はありますか？**
   - フォントサイズ選択
   - フォントウェイト（太さ）選択
   - その他のフォント追加

---

**推奨**: 案Aで実装し、まずテキスト注釈のみに適用。動作確認後、詳細テキストにも展開。
