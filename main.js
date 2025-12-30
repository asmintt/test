// main.js - Electronのメインプロセス
// アプリケーションのライフサイクルとウィンドウ管理を担当

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

// FFmpegのパスを設定（パッケージ化対応）
// asarUnpackされたパスを正しく解決
const ffmpegPath = ffmpegStatic.replace('app.asar', 'app.asar.unpacked');
ffmpeg.setFfmpegPath(ffmpegPath);

// メインウィンドウへの参照を保持
let mainWindow;

/**
 * メインウィンドウを作成する関数
 */
function createWindow() {
    // ブラウザウィンドウを作成（MacBook Air 13インチに最適化）
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 850,
        minWidth: 1200,
        minHeight: 700,
        title: 'MovieFrameSnap Lite',
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'src', 'preload.js'),
            contextIsolation: true, // セキュリティ強化
            nodeIntegration: false,  // セキュリティ強化
            cache: false             // 開発モード: キャッシュを無効化
        }
    });

    // 開発モード: キャッシュをクリア
    mainWindow.webContents.session.clearCache().then(() => {
        console.log('キャッシュをクリアしました');
    });

    // index.htmlを読み込む
    mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

    // 開発者ツールを開く（開発時のみ）
    mainWindow.webContents.openDevTools(); // 開発モード: 自動的に開発者ツールを開く

    // ウィンドウが閉じられたときの処理
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

/**
 * Electronアプリが準備完了したときの処理
 */
app.whenReady().then(() => {
    createWindow();

    // macOSでアプリがアクティブ化されたときの処理
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

/**
 * すべてのウィンドウが閉じられたときの処理
 */
app.on('window-all-closed', () => {
    // macOS以外ではアプリを終了
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

/**
 * IPC通信: 動画のトリミング処理
 * レンダラープロセスからのトリミングリクエストを受け取る
 */
ipcMain.handle('trim-video', async (event, data) => {
    const fs = require('fs');
    const os = require('os');

    const {
        videoData,          // 動画データ（ArrayBuffer）
        startTime,          // 開始時刻（秒）
        duration,           // 継続時間（秒）
        includeAudio,       // 音声を含むか
        includeAnnotations, // テキスト注釈を含むか
        annotations,        // 注釈データ
        shapes,             // 図形アノテーションデータ
        detailTexts,        // 詳細テキストデータ
        videoScale,         // 動画のスケール情報
        filename,           // 出力ファイル名
        arrowImages         // 矢印画像パス情報
    } = data;

    // 一時ファイルパスを生成
    const tempInputPath = path.join(os.tmpdir(), `input_${Date.now()}.mp4`);
    const outputPath = path.join(app.getPath('downloads'), `${filename}_trimmed.mp4`);

    try {
        // ArrayBufferを一時ファイルに書き込み
        console.log('動画データサイズ:', videoData ? videoData.byteLength : 'undefined');
        const buffer = Buffer.from(videoData);
        fs.writeFileSync(tempInputPath, buffer);
        console.log('一時ファイル作成:', tempInputPath);

        // FFmpegでトリミング処理を実行
        return new Promise((resolve, reject) => {
            try {
                // FFmpegコマンドを構築
                let command = ffmpeg(tempInputPath)
                .setStartTime(startTime)
                .setDuration(duration);

            // 音声の有無
            if (!includeAudio) {
                command = command.noAudio();
            }

            // テキスト注釈、図形、または詳細テキストを含める場合
            if (includeAnnotations && (annotations?.length > 0 || shapes?.length > 0 || detailTexts?.length > 0)) {
                // フィルタチェーンを構築（テキスト注釈、図形、詳細テキストを統合）
                const filters = buildCombinedFilters(annotations, shapes, detailTexts, startTime, duration, videoScale);
                if (filters) {
                    command = command.complexFilter(filters);
                }
            }

            // 出力設定
            const outputOpts = [
                '-c:v libx264',
                '-preset ultrafast',
                '-crf 28',
                '-pix_fmt yuv420p'  // QuickTime互換性のため
            ];

            // 音声を含める場合は音声コーデックを指定
            if (includeAudio) {
                outputOpts.push('-c:a aac');
                outputOpts.push('-b:a 128k');
            }

            command.outputOptions(outputOpts)
                .on('start', (commandLine) => {
                    console.log('FFmpeg開始:', commandLine);
                })
                .on('progress', (progress) => {
                    // 進捗をレンダラープロセスに送信
                    if (progress.percent) {
                        mainWindow.webContents.send('trim-progress', {
                            percent: Math.min(Math.round(progress.percent), 100)
                        });
                    }
                })
                .on('end', () => {
                    console.log('トリミング完了');
                    // 一時ファイルを削除
                    try {
                        fs.unlinkSync(tempInputPath);
                    } catch (e) {
                        console.error('一時ファイル削除エラー:', e);
                    }
                    // 矢印画像の一時ファイルを削除
                    if (arrowImages && arrowImages.length > 0) {
                        arrowImages.forEach(arrowImg => {
                            try {
                                if (fs.existsSync(arrowImg.imagePath)) {
                                    fs.unlinkSync(arrowImg.imagePath);
                                    console.log('矢印画像を削除:', arrowImg.imagePath);
                                }
                            } catch (e) {
                                console.error('矢印画像削除エラー:', e);
                            }
                        });
                    }
                    resolve({ success: true, outputPath });
                })
                .on('error', (err) => {
                    console.error('FFmpegエラー:', err);
                    // 一時ファイルを削除
                    try {
                        fs.unlinkSync(tempInputPath);
                    } catch (e) {
                        console.error('一時ファイル削除エラー:', e);
                    }
                    // 矢印画像の一時ファイルを削除
                    if (arrowImages && arrowImages.length > 0) {
                        arrowImages.forEach(arrowImg => {
                            try {
                                if (fs.existsSync(arrowImg.imagePath)) {
                                    fs.unlinkSync(arrowImg.imagePath);
                                }
                            } catch (e) {
                                console.error('矢印画像削除エラー:', e);
                            }
                        });
                    }
                    reject(err);
                })
                .save(outputPath);

        } catch (error) {
            // 一時ファイルを削除
            try {
                if (fs.existsSync(tempInputPath)) {
                    fs.unlinkSync(tempInputPath);
                }
            } catch (e) {
                console.error('一時ファイル削除エラー:', e);
            }
            reject(error);
        }
    });

    } catch (error) {
        console.error('トリミングエラー:', error);
        return { success: false, error: error.message };
    }
});

/**
 * atempo フィルターを構築
 * FFmpegのatempoは0.5～2.0の範囲のみサポート
 * @param {number} speed - 再生速度
 * @returns {string} atempo フィルター文字列
 */
function buildAtempoFilter(speed) {
    const filters = [];
    let remainingSpeed = speed;

    if (speed < 0.5) {
        while (remainingSpeed < 0.5) {
            filters.push('atempo=0.5');
            remainingSpeed /= 0.5;
        }
        if (Math.abs(remainingSpeed - 1.0) > 0.01) {
            filters.push(`atempo=${remainingSpeed.toFixed(4)}`);
        }
    } else if (speed > 2.0) {
        while (remainingSpeed > 2.0) {
            filters.push('atempo=2.0');
            remainingSpeed /= 2.0;
        }
        if (Math.abs(remainingSpeed - 1.0) > 0.01) {
            filters.push(`atempo=${remainingSpeed.toFixed(4)}`);
        }
    } else {
        filters.push(`atempo=${speed.toFixed(4)}`);
    }

    return filters.join(',');
}

/**
 * テキスト注釈を含むフィルタチェーンを構築
 * @param {Array} annotations - 注釈データの配列
 * @param {number} trimStartTime - トリミング開始時刻
 * @param {number} trimDuration - トリミング継続時間
 * @returns {Array|null} FFmpegのcomplexFilterに渡すフィルタ配列、または null
 */
function buildAnnotationFilters(annotations, trimStartTime, trimDuration) {
    // テキストがある注釈のみをフィルタリング
    const textAnnotations = annotations.filter(ann => ann.text && ann.text.trim() !== '');

    // テキスト注釈がない場合は null を返す
    if (textAnnotations.length === 0) {
        console.log('テキスト注釈がないため、フィルタを適用しません');
        return null;
    }

    const filters = [];
    // テキスト表示エリアの高さ（固定値）
    const textAreaHeight = 150;

    // 1. 動画の下に白い領域を追加
    filters.push({
        filter: 'pad',
        options: {
            width: 'iw',
            height: `ih+${textAreaHeight}`,
            x: 0,
            y: 0,
            color: 'white'
        },
        outputs: 'padded'
    });

    let currentInput = 'padded';
    let filterIndex = 0;

    // 2. 各注釈に対してdrawtextフィルターを追加
    textAnnotations.forEach((ann, index) => {
        // 注釈の表示開始時刻（トリミング開始時刻を基準とした相対時刻）
        const displayStartTime = Math.max(0, ann.time - trimStartTime);

        // 次の注釈または動画終了までの時間を計算
        let displayEndTime = trimDuration;

        // 元の配列から次の注釈を探す
        const currentIndex = annotations.indexOf(ann);
        for (let i = currentIndex + 1; i < annotations.length; i++) {
            if (annotations[i].time > ann.time) {
                // 次の注釈が「注釈なし」の場合、そこで終了
                if (!annotations[i].text || annotations[i].text.trim() === '') {
                    displayEndTime = Math.max(displayStartTime, Math.min(trimDuration, annotations[i].time - trimStartTime));
                    break;
                }
                // 次の注釈がテキストありの場合、そこまで継続
                // （次のループで上書きされる）
            }
        }

        // テキストを安全にエスケープ
        const escapedText = ann.text
            .replace(/\\/g, '\\\\\\\\')
            .replace(/'/g, "\\\\'")
            .replace(/:/g, '\\\\:');

        // 最後のフィルター以外は出力ラベルを設定
        const isLastFilter = index === textAnnotations.length - 1;

        const filterObj = {
            filter: 'drawtext',
            options: {
                text: escapedText,
                fontfile: '/System/Library/Fonts/ヒラギノ角ゴシック W4.ttc',
                fontsize: 60,
                fontcolor: ann.textColor || '#000000',
                box: 1,
                boxcolor: `${ann.bgColor || '#ffffff'}@1.0`,
                boxborderw: 15,
                x: '(w-text_w)/2', // 常に中央揃え
                y: `h-${textAreaHeight/2}-text_h/2`,
                enable: `between(t,${displayStartTime},${displayEndTime})`
            },
            inputs: currentInput
        };

        // 最後のフィルター以外は出力ラベルを設定
        if (!isLastFilter) {
            const outputLabel = `ann${filterIndex}`;
            filterObj.outputs = outputLabel;
            currentInput = outputLabel;
        }

        filters.push(filterObj);
        filterIndex++;
    });

    console.log('フィルタチェーン構築完了:', filters.length, 'フィルタ');
    return filters;
}

/**
 * テキスト注釈、図形アノテーション、詳細テキストを統合したフィルタチェーンを構築
 * @param {Array} annotations - テキスト注釈データの配列
 * @param {Array} shapes - 図形アノテーションデータの配列
 * @param {Array} detailTexts - 詳細テキストデータの配列
 * @param {number} trimStartTime - トリミング開始時刻
 * @param {number} trimDuration - トリミング継続時間
 * @param {Object} videoScale - 動画のスケール情報 { actualWidth, actualHeight, displayWidth, displayHeight }
 * @returns {Array|null} FFmpegのcomplexFilterに渡すフィルタ配列、または null
 */
function buildCombinedFilters(annotations, shapes, detailTexts, trimStartTime, trimDuration, videoScale) {
    // テキストがある注釈のみをフィルタリング（text1またはtext2がある場合）
    const textAnnotations = annotations ? annotations.filter(ann => (ann.text1 && ann.text1.trim() !== '') || (ann.text2 && ann.text2.trim() !== '')) : [];

    // 図形がある注釈のみをフィルタリング
    const validShapes = shapes ? shapes.filter(s => s.type !== '') : [];

    // 詳細テキストがある注釈のみをフィルタリング
    const validDetailTexts = detailTexts ? detailTexts.filter(dt => dt.text && dt.text.trim() !== '') : [];

    // すべてない場合は null を返す
    if (textAnnotations.length === 0 && validShapes.length === 0 && validDetailTexts.length === 0) {
        console.log('テキスト注釈、図形、詳細テキストともにないため、フィルタを適用しません');
        return null;
    }

    // 座標変換のためのスケール比率を計算
    const scaleX = videoScale ? (videoScale.actualWidth / videoScale.displayWidth) : 1;
    const scaleY = videoScale ? (videoScale.actualHeight / videoScale.displayHeight) : 1;
    console.log(`座標スケール: X=${scaleX.toFixed(2)}, Y=${scaleY.toFixed(2)}`);

    const filters = [];
    // テキスト表示エリアの高さ（固定値）
    const textAreaHeight = 150;

    // 1. 動画の下に白い領域を追加
    filters.push({
        filter: 'pad',
        options: {
            width: 'iw',
            height: `ih+${textAreaHeight}`,
            x: 0,
            y: 0,
            color: 'white'
        },
        outputs: 'padded'
    });

    let currentInput = 'padded';
    let filterIndex = 0;

    // 2. 図形アノテーションを追加（テキストより先に描画 = 背面）
    validShapes.forEach((shape, index) => {
        // 図形の表示開始時刻（トリミング開始時刻を基準とした相対時刻）
        const displayStartTime = Math.max(0, shape.time - trimStartTime);

        // 次の図形または動画終了までの時間を計算
        let displayEndTime = trimDuration;

        // 元の配列から次の図形を探す
        const currentIndex = shapes.indexOf(shape);
        for (let i = currentIndex + 1; i < shapes.length; i++) {
            if (shapes[i].time > shape.time) {
                // 時刻が異なる次の図形が来たら、そこで終了
                // （同じ時刻の図形は同時表示される）
                displayEndTime = Math.max(displayStartTime, Math.min(trimDuration, shapes[i].time - trimStartTime));
                break;
            }
        }

        // 図形タイプに応じてフィルターを構築
        let filterObj = null;

        if (shape.type === 'rectangle') {
            // 四角: drawbox フィルター
            // 座標をスケール変換
            const x = Math.round(Math.min(shape.x1, shape.x2) * scaleX);
            const y = Math.round(Math.min(shape.y1, shape.y2) * scaleY);
            const w = Math.round(Math.abs(shape.x2 - shape.x1) * scaleX);
            const h = Math.round(Math.abs(shape.y2 - shape.y1) * scaleY);

            // lineWidthを使用（後方互換性のため、なければ5）
            const lineWidth = shape.lineWidth || 5;

            filterObj = {
                filter: 'drawbox',
                options: {
                    x: x,
                    y: y,
                    w: w,
                    h: h,
                    color: shape.color,
                    t: Math.round(lineWidth * scaleX),  // shape.lineWidthを使用
                    enable: `between(t,${displayStartTime},${displayEndTime})`
                },
                inputs: currentInput
            };
        } else if (shape.type === 'arrow') {
            // 矢印: overlayフィルターで幾何学的矢印を描画
            // arrowImagesから該当する画像パスを取得
            const arrowImage = arrowImages && arrowImages.find(img => img.shapeIndex === shapeIndex);

            if (arrowImage && fs.existsSync(arrowImage.imagePath)) {
                // overlay filter を使用して矢印画像を重ねる
                filterObj = {
                    filter: 'overlay',
                    options: {
                        x: 0,
                        y: 0,
                        enable: `between(t,${displayStartTime},${displayEndTime})`
                    },
                    inputs: [currentInput, arrowImage.imagePath]
                };
                console.log(`矢印をoverlayで描画: ${arrowImage.imagePath}`);
            } else {
                console.warn(`矢印画像が見つかりません (index: ${shapeIndex})`);
            }
        }

        if (filterObj) {
            filters.push(filterObj);
            filterIndex++;
        }
    });

    // 3. テキスト注釈を追加（図形の上 = 前面）
    textAnnotations.forEach((ann, index) => {
        // 注釈の表示開始時刻（トリミング開始時刻を基準とした相対時刻）
        const displayStartTime = Math.max(0, ann.time - trimStartTime);

        // 次の注釈または動画終了までの時間を計算
        let displayEndTime = trimDuration;

        // 元の配列から次の注釈を探す
        const currentIndex = annotations.indexOf(ann);
        for (let i = currentIndex + 1; i < annotations.length; i++) {
            if (annotations[i].time > ann.time) {
                // 次の注釈（テキストあり・なし問わず）でこのテキストを終了
                displayEndTime = Math.max(displayStartTime, Math.min(trimDuration, annotations[i].time - trimStartTime));
                break;
            }
        }

        // フォント名からシステムフォントファイルパスへのマッピング
        const fontMapping = {
            'Noto Sans JP': '/System/Library/Fonts/ヒラギノ角ゴシック W4.ttc',
            'M PLUS Rounded 1c': '/System/Library/Fonts/ヒラギノ丸ゴ ProN W4.ttc',
            'Zen Kaku Gothic New': '/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc'
        };
        const fontFile = fontMapping[ann.font] || '/System/Library/Fonts/ヒラギノ角ゴシック W4.ttc';

        const fontSize = 60;

        // 動画の実際の高さを取得
        const videoHeight = videoScale ? videoScale.actualHeight : 1080;

        // 文字位置に応じたx座標を計算
        const textAlign = ann.textAlign || 'center';
        let xPosition;
        if (textAlign === 'left') {
            xPosition = '40'; // 左寄せ
        } else if (textAlign === 'right') {
            xPosition = 'w-text_w-40'; // 右寄せ
        } else {
            xPosition = '(w-text_w)/2'; // 中央揃え
        }

        // 1段目のテキストがある場合
        if (ann.text1 && ann.text1.trim() !== '') {
            const escapedText1 = ann.text1
                .replace(/\\/g, '\\\\\\\\')
                .replace(/'/g, "\\\\'")
                .replace(/:/g, '\\\\:');

            const filterObj1 = {
                filter: 'drawtext',
                options: {
                    text: escapedText1,
                    fontfile: fontFile,
                    fontsize: fontSize,
                    fontcolor: ann.textColor || '#000000',
                    box: 1,
                    boxcolor: `${ann.bgColor || '#ffffff'}@1.0`,
                    boxborderw: 15,
                    x: xPosition,
                    y: videoHeight + 20, // 1段目（白い領域の上部）
                    enable: `between(t,${displayStartTime},${displayEndTime})`
                },
                inputs: currentInput
            };

            filters.push(filterObj1);
            filterIndex++;
        }

        // 2段目のテキストがある場合
        if (ann.text2 && ann.text2.trim() !== '') {
            const escapedText2 = ann.text2
                .replace(/\\/g, '\\\\\\\\')
                .replace(/'/g, "\\\\'")
                .replace(/:/g, '\\\\:');

            const filterObj2 = {
                filter: 'drawtext',
                options: {
                    text: escapedText2,
                    fontfile: fontFile,
                    fontsize: fontSize,
                    fontcolor: ann.textColor || '#000000',
                    box: 1,
                    boxcolor: `${ann.bgColor || '#ffffff'}@1.0`,
                    boxborderw: 15,
                    x: xPosition,
                    y: videoHeight + 90, // 2段目（白い領域の中央下）
                    enable: `between(t,${displayStartTime},${displayEndTime})`
                },
                inputs: currentInput
            };

            filters.push(filterObj2);
            filterIndex++;
        }
    });

    // 4. 詳細テキストを追加（メインテキストの下、最下部）
    validDetailTexts.forEach((detail, index) => {
        // 詳細テキストの表示開始時刻（トリミング開始時刻を基準とした相対時刻）
        const displayStartTime = Math.max(0, detail.time - trimStartTime);

        // 次の詳細テキストまたは動画終了までの時間を計算
        let displayEndTime = trimDuration;

        // 元の配列から次の詳細テキストを探す
        const currentIndex = detailTexts.indexOf(detail);
        for (let i = currentIndex + 1; i < detailTexts.length; i++) {
            if (detailTexts[i].time > detail.time) {
                displayEndTime = Math.max(displayStartTime, Math.min(trimDuration, detailTexts[i].time - trimStartTime));
                break;
            }
        }

        // テキストを安全にエスケープ
        const escapedText = detail.text
            .replace(/\\/g, '\\\\\\\\')
            .replace(/'/g, "\\\\'")
            .replace(/:/g, '\\\\:');

        // 動画の実際の高さを取得
        const videoHeight = videoScale ? videoScale.actualHeight : 1080;

        // 背景透明度を取得（0.0-1.0、デフォルト1.0）
        const bgOpacity = detail.bgOpacity !== undefined ? detail.bgOpacity : 1.0;

        // 文字位置に応じたx座標を計算
        const detailTextAlign = detail.textAlign || 'left';
        let detailXPosition;
        if (detailTextAlign === 'left') {
            detailXPosition = '40'; // 左寄せ
        } else if (detailTextAlign === 'right') {
            detailXPosition = 'w-text_w-40'; // 右寄せ
        } else {
            detailXPosition = '(w-text_w)/2'; // 中央揃え
        }

        const filterObj = {
            filter: 'drawtext',
            options: {
                text: escapedText,
                fontfile: '/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc', // W4 → W6 (太字)
                fontsize: 16, // 12 → 16 に変更（数字の歪みを防ぐ）
                fontcolor: detail.textColor || '#000000',
                box: 1,
                boxcolor: `${detail.bgColor || '#ffffff'}@${bgOpacity.toFixed(2)}`,
                boxborderw: 3,
                x: detailXPosition,
                y: videoHeight - 25, // 動画エリアの最下部（白い領域の直前）
                enable: `between(t,${displayStartTime},${displayEndTime})`
            },
            inputs: currentInput
        };

        filters.push(filterObj);
        filterIndex++;
    });

    // 5. 全フィルターに対して、最後以外に出力ラベルを設定
    for (let i = 0; i < filters.length; i++) {
        if (i === 0) {
            // 最初のフィルター（pad）は既に出力ラベルを持っている
            continue;
        }

        if (i < filters.length - 1) {
            // 最後以外のフィルターに出力ラベルを設定
            const outputLabel = `filter${i}`;
            filters[i].outputs = outputLabel;

            // 次のフィルターの入力を設定
            if (i + 1 < filters.length) {
                filters[i + 1].inputs = outputLabel;
            }
        }
        // 最後のフィルターは出力ラベルなし（デフォルトの出力ストリーム）
    }

    console.log('統合フィルタチェーン構築完了:', filters.length, 'フィルタ');
    return filters;
}

/**
 * IPC通信: プロジェクトをフォルダとして保存
 * レンダラープロセスからのプロジェクト保存リクエストを受け取る
 */
ipcMain.handle('save-project-as-folder', async (event, data) => {
    const fs = require('fs');

    const {
        projectName,           // プロジェクト名（フォルダ名に使用）
        projectTitle,          // プロジェクトタイトル（ファイル名に使用）
        originalVideoFileName, // 元の動画ファイル名（JSONに保存用）
        videoFileName,         // 新しい動画ファイル名（タイトルベース）
        videoData,             // 動画データ（ArrayBuffer）
        jsonContent            // JSONデータ（文字列）
    } = data;

    try {
        // デフォルトのプロジェクト保存先
        const defaultProjectsPath = path.join(app.getPath('documents'), 'MovieFrameSnap', 'Projects');

        // プロジェクトフォルダのデフォルトパス
        const defaultFolderPath = path.join(defaultProjectsPath, projectName);

        // フォルダ選択ダイアログを表示
        const result = await dialog.showSaveDialog(mainWindow, {
            title: 'プロジェクトの保存場所を選択',
            defaultPath: defaultFolderPath,
            properties: ['createDirectory'],
            buttonLabel: '保存'
        });

        // キャンセルされた場合
        if (result.canceled) {
            return { success: false, canceled: true };
        }

        const folderPath = result.filePath;

        // フォルダが既に存在する場合、上書き確認
        if (fs.existsSync(folderPath)) {
            const overwriteResult = await dialog.showMessageBox(mainWindow, {
                type: 'warning',
                buttons: ['キャンセル', '上書き'],
                defaultId: 0,
                title: '確認',
                message: 'このフォルダは既に存在します。',
                detail: '上書きしますか？既存のファイルは削除されます。'
            });

            // キャンセルされた場合
            if (overwriteResult.response === 0) {
                return { success: false, canceled: true };
            }

            // 既存のフォルダを削除
            fs.rmSync(folderPath, { recursive: true, force: true });
        }

        // プロジェクトフォルダを作成
        fs.mkdirSync(folderPath, { recursive: true });

        // 動画ファイルを保存（タイトルベースのファイル名）
        const videoFilePath = path.join(folderPath, videoFileName);
        const videoBuffer = Buffer.from(videoData);
        fs.writeFileSync(videoFilePath, videoBuffer);

        // プロジェクトファイル（JSON）を保存（タイトルベースのファイル名）
        const jsonFileName = `${projectTitle}.mfs.json`;
        const jsonFilePath = path.join(folderPath, jsonFileName);
        fs.writeFileSync(jsonFilePath, jsonContent, 'utf8');

        console.log('プロジェクトを保存しました:', folderPath);
        console.log('  - 動画ファイル:', videoFileName);
        console.log('  - JSONファイル:', jsonFileName);
        return { success: true, folderPath: folderPath };

    } catch (error) {
        console.error('プロジェクト保存エラー:', error);
        return { success: false, error: error.message };
    }
});

/**
 * IPC通信: プロジェクトファイルの保存（旧版・互換性のため残す）
 * レンダラープロセスからのプロジェクト保存リクエストを受け取る
 */
ipcMain.handle('save-project-file', async (event, data) => {
    const fs = require('fs');

    const {
        jsonContent,      // JSONデータ（文字列）
        defaultFileName,  // デフォルトのファイル名
        videoFilePath     // 動画ファイルのパス（保存先のデフォルトに使用）
    } = data;

    try {
        // 保存ダイアログを表示
        const result = await dialog.showSaveDialog(mainWindow, {
            title: 'プロジェクトを保存',
            defaultPath: path.join(
                videoFilePath ? path.dirname(videoFilePath) : app.getPath('downloads'),
                defaultFileName
            ),
            filters: [
                { name: 'MovieFrameSnap Project', extensions: ['mfs.json'] },
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        // キャンセルされた場合
        if (result.canceled) {
            return { success: false, canceled: true };
        }

        // ファイルに書き込み
        const filePath = result.filePath;
        fs.writeFileSync(filePath, jsonContent, 'utf8');

        console.log('プロジェクトを保存しました:', filePath);
        return { success: true, filePath: filePath };

    } catch (error) {
        console.error('プロジェクト保存エラー:', error);
        return { success: false, error: error.message };
    }
});

/**
 * IPC通信: プロジェクトフォルダの読み込み（推奨）
 * フォルダを選択し、その中の動画とJSONファイルを自動的に読み込む
 */
ipcMain.handle('load-project-folder', async (event) => {
    const fs = require('fs');

    try {
        // デフォルトのプロジェクト保存先
        const defaultProjectsPath = path.join(app.getPath('documents'), 'MovieFrameSnap', 'Projects');

        // フォルダ選択ダイアログを表示
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'プロジェクト保存先のフォルダを選択',
            defaultPath: defaultProjectsPath,
            properties: ['openDirectory']  // フォルダ選択
        });

        // キャンセルされた場合
        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, canceled: true };
        }

        const folderPath = result.filePaths[0];

        // フォルダ内のファイルを取得
        const files = fs.readdirSync(folderPath);

        // JSONファイルを検索（.mfs.json で終わるファイル）
        const jsonFile = files.find(file => file.endsWith('.mfs.json'));
        if (!jsonFile) {
            return {
                success: false,
                error: 'プロジェクトファイル（.mfs.json）が見つかりませんでした。'
            };
        }

        // JSONファイルを読み込み
        const jsonPath = path.join(folderPath, jsonFile);
        const jsonContent = fs.readFileSync(jsonPath, 'utf8');
        const projectData = JSON.parse(jsonContent);

        // 動画ファイルを検索（一般的な動画拡張子）
        const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.MP4', '.MOV', '.AVI'];
        const videoFile = files.find(file =>
            videoExtensions.some(ext => file.endsWith(ext))
        );

        let videoData = null;
        let videoFileName = null;

        if (videoFile) {
            videoFileName = videoFile;
            const videoPath = path.join(folderPath, videoFile);
            videoData = fs.readFileSync(videoPath);
            console.log('動画ファイルを検出しました:', videoPath);
        } else {
            console.warn('動画ファイルが見つかりませんでした');
        }

        console.log('プロジェクトフォルダを読み込みました:', folderPath);
        return {
            success: true,
            folderPath: folderPath,
            projectData: projectData,
            videoData: videoData ? videoData.buffer : null,
            videoFileName: videoFileName
        };

    } catch (error) {
        console.error('プロジェクトフォルダ読み込みエラー:', error);
        return { success: false, error: error.message };
    }
});

/**
 * IPC通信: プロジェクトファイルの読み込み
 * レンダラープロセスからのプロジェクト読み込みリクエストを受け取る
 */
ipcMain.handle('load-project-file', async (event) => {
    const fs = require('fs');

    try {
        // デフォルトのプロジェクト保存先
        const defaultProjectsPath = path.join(app.getPath('documents'), 'MovieFrameSnap', 'Projects');

        // ファイル選択ダイアログを表示
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'プロジェクトを開く',
            defaultPath: defaultProjectsPath,
            filters: [
                { name: 'MovieFrameSnap Project', extensions: ['mfs.json'] },
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            properties: ['openFile']
        });

        // キャンセルされた場合
        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, canceled: true };
        }

        // ファイルを読み込み
        const filePath = result.filePaths[0];
        const jsonContent = fs.readFileSync(filePath, 'utf8');
        const projectData = JSON.parse(jsonContent);

        // 同じフォルダ内の動画ファイルを検索
        const projectDir = path.dirname(filePath);
        const videoFileName = projectData.videoFileName;
        let videoFilePath = null;
        let videoData = null;

        if (videoFileName) {
            const expectedVideoPath = path.join(projectDir, videoFileName);

            // 動画ファイルが存在するかチェック
            if (fs.existsSync(expectedVideoPath)) {
                videoFilePath = expectedVideoPath;
                // 動画ファイルを読み込み
                videoData = fs.readFileSync(videoFilePath);
                console.log('動画ファイルを検出しました:', videoFilePath);
            } else {
                console.warn('動画ファイルが見つかりません:', expectedVideoPath);
            }
        }

        console.log('プロジェクトを読み込みました:', filePath);
        return {
            success: true,
            filePath: filePath,
            projectData: projectData,
            videoFilePath: videoFilePath,
            videoData: videoData ? videoData.buffer : null,
            videoFileName: videoFileName
        };

    } catch (error) {
        console.error('プロジェクト読み込みエラー:', error);
        return { success: false, error: error.message };
    }
});

/**
 * 矢印画像を一時ファイルとして保存
 */
ipcMain.handle('save-arrow-image', async (event, dataUrl, filename) => {
    try {
        const os = require('os');
        const tmpDir = os.tmpdir();
        const filePath = path.join(tmpDir, filename);

        // base64データからBufferに変換
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // ファイルに保存
        fs.writeFileSync(filePath, buffer);

        console.log('矢印画像を保存しました:', filePath);
        return filePath;

    } catch (error) {
        console.error('矢印画像保存エラー:', error);
        throw error;
    }
});
