// main.js - Electronのメインプロセス
// アプリケーションのライフサイクルとウィンドウ管理を担当

const { app, BrowserWindow, ipcMain } = require('electron');
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
    // ブラウザウィンドウを作成
    mainWindow = new BrowserWindow({
        width: 1800,
        height: 1000,
        minWidth: 1400,
        minHeight: 800,
        title: 'MovieFrameSnap Lite',
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'src', 'preload.js'),
            contextIsolation: true, // セキュリティ強化
            nodeIntegration: false   // セキュリティ強化
        }
    });

    // index.htmlを読み込む
    mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

    // 開発者ツールを開く（開発時のみ）
    // mainWindow.webContents.openDevTools(); // 本番環境では無効化

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
        videoScale,         // 動画のスケール情報
        filename            // 出力ファイル名
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

            // テキスト注釈または図形を含める場合
            if (includeAnnotations && (annotations?.length > 0 || shapes?.length > 0)) {
                // フィルタチェーンを構築（テキスト注釈と図形を統合）
                const filters = buildCombinedFilters(annotations, shapes, startTime, duration, videoScale);
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
                fontsize: 70,
                fontcolor: ann.textColor || '#000000',
                box: 1,
                boxcolor: `${ann.bgColor || '#ffffff'}@1.0`,
                boxborderw: 20,
                x: '(w-text_w)/2',
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
 * テキスト注釈と図形アノテーションを統合したフィルタチェーンを構築
 * @param {Array} annotations - テキスト注釈データの配列
 * @param {Array} shapes - 図形アノテーションデータの配列
 * @param {number} trimStartTime - トリミング開始時刻
 * @param {number} trimDuration - トリミング継続時間
 * @param {Object} videoScale - 動画のスケール情報 { actualWidth, actualHeight, displayWidth, displayHeight }
 * @returns {Array|null} FFmpegのcomplexFilterに渡すフィルタ配列、または null
 */
function buildCombinedFilters(annotations, shapes, trimStartTime, trimDuration, videoScale) {
    // テキストがある注釈のみをフィルタリング
    const textAnnotations = annotations ? annotations.filter(ann => ann.text && ann.text.trim() !== '') : [];

    // 図形がある注釈のみをフィルタリング
    const validShapes = shapes ? shapes.filter(s => s.type !== '') : [];

    // 両方ともない場合は null を返す
    if (textAnnotations.length === 0 && validShapes.length === 0) {
        console.log('テキスト注釈も図形もないため、フィルタを適用しません');
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

            filterObj = {
                filter: 'drawbox',
                options: {
                    x: x,
                    y: y,
                    w: w,
                    h: h,
                    color: shape.color,
                    t: Math.round(3 * scaleX),  // 線の太さもスケール
                    enable: `between(t,${displayStartTime},${displayEndTime})`
                },
                inputs: currentInput
            };
        } else if (shape.type === 'arrow') {
            // 矢印: →記号のみで描画（プレビューと統一）
            // 座標をスケール変換
            const x2 = Math.round(shape.x2 * scaleX);
            const y2 = Math.round(shape.y2 * scaleY);

            // →記号を描画
            filterObj = {
                filter: 'drawtext',
                options: {
                    text: '→',
                    fontsize: Math.round(40 * Math.min(scaleX, scaleY)),
                    fontcolor: shape.color,
                    x: x2 - Math.round(20 * scaleX),
                    y: y2 - Math.round(10 * scaleY),
                    enable: `between(t,${displayStartTime},${displayEndTime})`
                },
                inputs: currentInput
            };
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

        // テキストを安全にエスケープ
        const escapedText = ann.text
            .replace(/\\/g, '\\\\\\\\')
            .replace(/'/g, "\\\\'")
            .replace(/:/g, '\\\\:');

        const filterObj = {
            filter: 'drawtext',
            options: {
                text: escapedText,
                fontfile: '/System/Library/Fonts/ヒラギノ角ゴシック W4.ttc',
                fontsize: 70,
                fontcolor: ann.textColor || '#000000',
                box: 1,
                boxcolor: `${ann.bgColor || '#ffffff'}@1.0`,
                boxborderw: 20,
                x: '(w-text_w)/2',
                y: `h-${textAreaHeight/2}-text_h/2`,
                enable: `between(t,${displayStartTime},${displayEndTime})`
            },
            inputs: currentInput
        };

        filters.push(filterObj);
        filterIndex++;
    });

    // 4. 全フィルターに対して、最後以外に出力ラベルを設定
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
