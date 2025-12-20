// test-font-selection.js - フォント選択機能のテスト

const fs = require('fs');
const path = require('path');

console.log('🧪 フォント選択機能テスト\n');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

// テスト関数
function test(name, condition, message = '') {
    if (condition) {
        console.log(`✅ PASS: ${name}`);
        passed++;
    } else {
        console.log(`❌ FAIL: ${name}`);
        if (message) console.log(`   ${message}`);
        failed++;
    }
}

// ファイル読み込み
const indexHtmlPath = path.join(__dirname, 'src', 'index.html');
const styleCssPath = path.join(__dirname, 'src', 'style.css');
const annotationManagerPath = path.join(__dirname, 'src', 'js', 'annotationManager.js');
const frameExtractorPath = path.join(__dirname, 'src', 'js', 'frameExtractor.js');

const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const styleCss = fs.readFileSync(styleCssPath, 'utf8');
const annotationManager = fs.readFileSync(annotationManagerPath, 'utf8');
const frameExtractor = fs.readFileSync(frameExtractorPath, 'utf8');

console.log('\n📋 テスト1: HTML - フォント選択UI追加');
console.log('─'.repeat(60));

// テスト1-1: フォント選択セクションが追加されているか
test(
    'font-selection-section が追加されている',
    indexHtml.includes('<div class="font-selection-section">'),
    'フォント選択セクションが見つかりません'
);

// テスト1-2: selectタグが追加されているか
test(
    'textFontSelect セレクトボックスが追加されている',
    indexHtml.includes('id="textFontSelect"'),
    'セレクトボックスが見つかりません'
);

// テスト1-3: Noto Sans JPオプションがあるか
test(
    'Noto Sans JP オプションがある',
    indexHtml.includes('value="Noto Sans JP"') && indexHtml.includes('Noto Sans JP（標準）'),
    'Noto Sans JPオプションが見つかりません'
);

// テスト1-4: M PLUS Rounded 1cオプションがあるか
test(
    'M PLUS Rounded 1c オプションがある',
    indexHtml.includes('value="M PLUS Rounded 1c"') && indexHtml.includes('M PLUS Rounded 1c（丸ゴシック）'),
    'M PLUS Rounded 1cオプションが見つかりません'
);

// テスト1-5: Zen Kaku Gothic Newオプションがあるか
test(
    'Zen Kaku Gothic New オプションがある',
    indexHtml.includes('value="Zen Kaku Gothic New"') && indexHtml.includes('Zen Kaku Gothic New（角ゴシック）'),
    'Zen Kaku Gothic Newオプションが見つかりません'
);

// テスト1-6: 配置が正しいか（テキスト入力の後、色選択の前）
const textInputPos = indexHtml.indexOf('id="annotationText"');
const fontSelectPos = indexHtml.indexOf('id="textFontSelect"');
const colorPalettePos = indexHtml.indexOf('id="textColorPalette"');
test(
    '配置が正しい（テキスト入力 → フォント選択 → 色選択）',
    textInputPos < fontSelectPos && fontSelectPos < colorPalettePos,
    '配置順序が正しくありません'
);

// テスト1-7: disabledがデフォルトで設定されているか
test(
    'セレクトボックスがデフォルトでdisabled',
    indexHtml.match(/<select id="textFontSelect" disabled>/),
    'disabled属性が設定されていません'
);

console.log('\n📋 テスト2: CSS - フォント選択スタイル追加');
console.log('─'.repeat(60));

// テスト2-1: Google Fontsのインポートがあるか
test(
    'Google Fonts のインポートがある',
    styleCss.includes('@import url') && styleCss.includes('fonts.googleapis.com'),
    'Google Fontsのインポートが見つかりません'
);

// テスト2-2: Noto Sans JPがインポートされているか
test(
    'Noto Sans JP がインポートされている',
    styleCss.includes('Noto+Sans+JP'),
    'Noto Sans JPのインポートが見つかりません'
);

// テスト2-3: M PLUS Rounded 1cがインポートされているか
test(
    'M PLUS Rounded 1c がインポートされている',
    styleCss.includes('M+PLUS+Rounded+1c'),
    'M PLUS Rounded 1cのインポートが見つかりません'
);

// テスト2-4: Zen Kaku Gothic Newがインポートされているか
test(
    'Zen Kaku Gothic New がインポートされている',
    styleCss.includes('Zen+Kaku+Gothic+New'),
    'Zen Kaku Gothic Newのインポートが見つかりません'
);

// テスト2-5: .font-selection-sectionスタイルがあるか
test(
    '.font-selection-section スタイルがある',
    styleCss.includes('.font-selection-section {'),
    '.font-selection-sectionスタイルが見つかりません'
);

// テスト2-6: selectボックスのスタイルがあるか
test(
    '.font-selection-section select スタイルがある',
    styleCss.includes('.font-selection-section select {'),
    'selectスタイルが見つかりません'
);

// テスト2-7: hoverスタイルがあるか
test(
    'hover スタイルがある',
    styleCss.includes('.font-selection-section select:hover:not(:disabled)'),
    'hoverスタイルが見つかりません'
);

// テスト2-8: disabledスタイルがあるか
test(
    'disabled スタイルがある',
    styleCss.includes('.font-selection-section select:disabled'),
    'disabledスタイルが見つかりません'
);

console.log('\n📋 テスト3: annotationManager.js - フォント選択ロジック追加');
console.log('─'.repeat(60));

// テスト3-1: textFontSelectがconstructorで定義されているか
test(
    'constructor で textFontSelect を定義している',
    annotationManager.includes('this.textFontSelect = document.getElementById(\'textFontSelect\')'),
    'textFontSelectの定義が見つかりません'
);

// テスト3-2: selectedFontがconstructorで初期化されているか
test(
    'constructor で selectedFont を初期化している',
    annotationManager.includes('this.selectedFont = \'Noto Sans JP\''),
    'selectedFontの初期化が見つかりません'
);

// テスト3-3: コメントにfontが追加されているか
test(
    'コメントに font が追加されている',
    annotationManager.includes('各注釈: { time: 秒数, text: テキスト, textColor: 色, bgColor: 色, font: フォント }'),
    'コメントにfontが追加されていません'
);

// テスト3-4: changeイベントリスナーが追加されているか
test(
    'change イベントリスナーが追加されている',
    annotationManager.match(/this\.textFontSelect\.addEventListener\('change'/),
    'changeイベントリスナーが見つかりません'
);

// テスト3-5: selectedFontが更新されるか
test(
    'selectedFont が更新される',
    annotationManager.includes('this.selectedFont = this.textFontSelect.value'),
    'selectedFontの更新処理が見つかりません'
);

// テスト3-6: onVideoLoadedでtextFontSelectが有効化されるか
test(
    'onVideoLoaded で textFontSelect が有効化される',
    annotationManager.match(/setEnabledMultiple\(\[[^\]]*this\.textFontSelect/),
    'textFontSelectの有効化が見つかりません'
);

// テスト3-7: addAnnotationでfontがannotationオブジェクトに追加されるか
test(
    'addAnnotation で font が追加される',
    annotationManager.match(/const annotation = \{[\s\S]*?font: this\.selectedFont/m),
    'annotationオブジェクトへのfont追加が見つかりません'
);

// テスト3-8: addBlankAnnotationでもfontが追加されるか
const blankAnnotationMatch = annotationManager.match(/addBlankAnnotation\(\)[^}]*\{[^}]*const annotation = \{[^}]*font: this\.selectedFont/s);
test(
    'addBlankAnnotation でも font が追加される',
    blankAnnotationMatch !== null,
    'addBlankAnnotationでのfont追加が見つかりません'
);

console.log('\n📋 テスト4: frameExtractor.js - フォント適用ロジック追加');
console.log('─'.repeat(60));

// テスト4-1: drawTextAnnotationOnCanvasでfontFamilyを取得しているか
test(
    'annotation.font を取得している',
    frameExtractor.includes('const fontFamily = annotation.font'),
    'fontFamilyの取得が見つかりません'
);

// テスト4-2: デフォルトフォントが設定されているか
test(
    'デフォルトフォント が設定されている',
    frameExtractor.includes('annotation.font || \'Noto Sans JP\''),
    'デフォルトフォントの設定が見つかりません'
);

// テスト4-3: ctx.fontでfontFamilyが使われているか
test(
    'ctx.font で fontFamily が使われている',
    frameExtractor.match(/ctx\.font = `bold \$\{fontSize\}px "\$\{fontFamily\}"/),
    'ctx.fontでのfontFamily使用が見つかりません'
);

// テスト4-4: フォント名がダブルクォートで囲まれているか
test(
    'フォント名が ダブルクォート で囲まれている',
    frameExtractor.includes('"${fontFamily}"'),
    'フォント名のクォートが正しくありません'
);

console.log('\n📋 テスト5: 既存機能への影響確認');
console.log('─'.repeat(60));

// テスト5-1: textColorPaletteは維持されているか
test(
    'textColorPalette は維持されている',
    annotationManager.includes('this.textColorPalette = document.getElementById(\'textColorPalette\')'),
    'textColorPaletteが維持されていません'
);

// テスト5-2: bgColorPaletteは維持されているか
test(
    'bgColorPalette は維持されている',
    annotationManager.includes('this.bgColorPalette = document.getElementById(\'bgColorPalette\')'),
    'bgColorPaletteが維持されていません'
);

// テスト5-3: selectedTextColorは維持されているか
test(
    'selectedTextColor は維持されている',
    annotationManager.includes('this.selectedTextColor'),
    'selectedTextColorが維持されていません'
);

// テスト5-4: selectedBgColorは維持されているか
test(
    'selectedBgColor は維持されている',
    annotationManager.includes('this.selectedBgColor'),
    'selectedBgColorが維持されていません'
);

// テスト5-5: initColorPalettesは維持されているか
test(
    'initColorPalettes() は維持されている',
    annotationManager.includes('this.initColorPalettes()'),
    'initColorPalettes()が維持されていません'
);

// テスト5-6: createListItem関数は維持されているか
test(
    'createListItem() は維持されている',
    annotationManager.includes('createListItem({'),
    'createListItem()が維持されていません'
);

console.log('\n📋 テスト6: データ構造の後方互換性');
console.log('─'.repeat(60));

// テスト6-1: 古いannotationデータ（fontなし）でもエラーが出ないか
test(
    '古いデータ（fontなし）でもエラーが出ない設計',
    frameExtractor.includes('annotation.font || \'Noto Sans JP\''),
    'デフォルト値による後方互換性がありません'
);

// テスト6-2: textColorは維持されているか
test(
    'textColor プロパティは維持されている',
    annotationManager.includes('textColor: this.selectedTextColor'),
    'textColorが維持されていません'
);

// テスト6-3: bgColorは維持されているか
test(
    'bgColor プロパティは維持されている',
    annotationManager.includes('bgColor: this.selectedBgColor'),
    'bgColorが維持されていません'
);

console.log('\n📋 テスト7: UIの一貫性確認');
console.log('─'.repeat(60));

// テスト7-1: ラベルのスタイルが統一されているか
test(
    'label のスタイルが統一されている',
    styleCss.includes('.font-selection-section label') &&
    styleCss.includes('.color-palette-section label'),
    'ラベルスタイルの統一性が不足しています'
);

// テスト7-2: margin-bottomが統一されているか
const fontSectionMargin = styleCss.match(/\.font-selection-section \{[^}]*margin-bottom: (\d+)px/);
const colorSectionMargin = styleCss.match(/\.color-palette-section \{[^}]*margin-bottom: (\d+)px/);
test(
    'margin-bottom が統一されている',
    fontSectionMargin && colorSectionMargin && fontSectionMargin[1] === colorSectionMargin[1],
    'margin-bottomが統一されていません'
);

// テスト7-3: フォント選択とテキスト入力のpadding/font-sizeが近いか
test(
    'フォント選択とテキスト入力のスタイルが近い',
    styleCss.includes('.font-selection-section select') &&
    styleCss.match(/\.font-selection-section select[^}]*padding: 10px 12px/),
    'スタイルの統一性が不足しています'
);

console.log('\n📋 テスト8: コードの整合性確認');
console.log('─'.repeat(60));

// テスト8-1: textFontSelectが存在チェックされているか
test(
    'textFontSelect の存在チェックがある',
    annotationManager.includes('if (this.textFontSelect)'),
    'textFontSelectの存在チェックがありません'
);

// テスト8-2: 関数内のthisバインディングが正しいか
test(
    'this.selectedFont への参照が正しい',
    annotationManager.match(/this\.selectedFont = this\.textFontSelect\.value/),
    'thisバインディングが正しくありません'
);

// テスト8-3: フォント名が3つとも正しいか
const fontNames = ['Noto Sans JP', 'M PLUS Rounded 1c', 'Zen Kaku Gothic New'];
const allFontsPresent = fontNames.every(font =>
    indexHtml.includes(`value="${font}"`) &&
    styleCss.includes(font.replace(/ /g, '+'))
);
test(
    '全てのフォント名が正しく設定されている',
    allFontsPresent,
    '一部のフォント名が正しくありません'
);

console.log('\n' + '='.repeat(60));
console.log(`テスト結果: ${passed}件成功 / ${failed}件失敗`);
console.log(`成功率: ${Math.round((passed / (passed + failed)) * 100)}%`);
console.log('='.repeat(60));

if (failed === 0) {
    console.log('\n✅ すべてのテストに合格しました！');
    console.log('\n📊 実装された機能:');
    console.log('─'.repeat(60));
    console.log('✅ HTMLにフォント選択ドロップダウンを追加');
    console.log('✅ Google Fontsから3種類のフォントをインポート');
    console.log('✅ フォント選択セクションのCSSスタイル');
    console.log('✅ annotationManagerにフォント選択ロジック追加');
    console.log('✅ frameExtractorにフォント適用ロジック追加');
    console.log('✅ 既存機能との互換性維持');
    console.log('✅ 古いデータとの後方互換性');
    console.log('─'.repeat(60));
    console.log('\n🎨 選択可能なフォント:');
    console.log('  1. Noto Sans JP（標準） - モダン、クリーン');
    console.log('  2. M PLUS Rounded 1c（丸ゴシック） - フレンドリー、親しみやすい');
    console.log('  3. Zen Kaku Gothic New（角ゴシック） - 力強い、クッキリ');
    console.log('\n📍 配置: テキスト入力 → フォント選択 → 色選択（案A）');
} else {
    console.log('\n❌ 一部のテストが失敗しました');
}

process.exit(failed > 0 ? 1 : 0);
