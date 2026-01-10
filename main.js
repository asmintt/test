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
        // キャッシュクリア後にindex.htmlを読み込む
        mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
    });

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
        arrows,             // 方向矢印データ
        videoScale,         // 動画のスケール情報
        speed,              // 再生速度
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

        // テキスト注釈、図形、詳細テキスト、または方向矢印を含める場合
        const hasAnnotations = includeAnnotations && (annotations?.length > 0 || shapes?.length > 0 || detailTexts?.length > 0 || arrows?.length > 0);
        const needsSpeedChange = speed && speed !== 1.0;
        const needsTwoStepProcess = hasAnnotations && needsSpeedChange;

        // 2段階処理が必要な場合（注釈あり + 速度変更あり）
        if (needsTwoStepProcess) {
            console.log('2段階処理を実行: 注釈適用 → 速度変更');
            return processTwoStep(tempInputPath, outputPath, {
                startTime, duration, includeAudio,
                annotations, shapes, detailTexts, arrows, videoScale, speed
            });
        }

        // 1段階処理（注釈のみ、または速度変更のみ、または両方なし）
        return processOneStep(tempInputPath, outputPath, {
            startTime, duration, includeAudio, hasAnnotations,
            annotations, shapes, detailTexts, arrows, videoScale, speed, needsSpeedChange
        });

    } catch (error) {
        console.error('トリミングエラー:', error);
        return { success: false, error: error.message };
    }
});

/**
 * 1段階処理: 注釈または速度変更のいずれか（または両方なし）
 */
function processOneStep(tempInputPath, outputPath, options) {
    const fs = require('fs');
    const {
        startTime, duration, includeAudio, hasAnnotations,
        annotations, shapes, detailTexts, arrows, videoScale, speed, needsSpeedChange
    } = options;

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

            // 注釈を含める場合
            if (hasAnnotations) {
                const filters = buildCombinedFilters(annotations, shapes, detailTexts, arrows, startTime, duration, videoScale);
                if (filters) {
                    command = command.complexFilter(filters);
                }
            }

            // 再生速度の変更（注釈がない場合のみ）
            if (needsSpeedChange && !hasAnnotations) {
                const videoFilter = `setpts=PTS/${speed}`;
                command = command.videoFilter(videoFilter);

                if (includeAudio) {
                    const audioFilter = buildAtempoFilter(speed);
                    command = command.audioFilter(audioFilter);
                }
            }

            // 出力設定
            const outputOpts = [
                '-c:v libx264',
                '-preset ultrafast',
                '-crf 28',
                '-pix_fmt yuv420p'
            ];

            if (includeAudio) {
                outputOpts.push('-c:a aac');
                outputOpts.push('-b:a 128k');
            }

            command.outputOptions(outputOpts)
                .on('start', (commandLine) => {
                    console.log('FFmpeg開始:', commandLine);
                })
                .on('progress', (progress) => {
                    if (progress.percent) {
                        mainWindow.webContents.send('trim-progress', {
                            percent: Math.min(Math.round(progress.percent), 100)
                        });
                    }
                })
                .on('end', () => {
                    console.log('トリミング完了');
                    try {
                        fs.unlinkSync(tempInputPath);
                    } catch (e) {
                        console.error('一時ファイル削除エラー:', e);
                    }
                    resolve({ success: true, outputPath });
                })
                .on('error', (err) => {
                    console.error('FFmpegエラー:', err);
                    try {
                        fs.unlinkSync(tempInputPath);
                    } catch (e) {
                        console.error('一時ファイル削除エラー:', e);
                    }
                    reject(err);
                })
                .save(outputPath);

        } catch (error) {
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
}

/**
 * 2段階処理: 注釈適用 → 速度変更
 */
function processTwoStep(tempInputPath, outputPath, options) {
    const fs = require('fs');
    const os = require('os');
    const {
        startTime, duration, includeAudio,
        annotations, shapes, detailTexts, arrows, videoScale, speed
    } = options;

    // ステップ1用の一時ファイル（注釈付き、通常速度）
    const tempAnnotatedPath = path.join(os.tmpdir(), `annotated_${Date.now()}.mp4`);

    return new Promise((resolve, reject) => {
        // ステップ1: 注釈を適用して一時ファイルに出力
        let command1 = ffmpeg(tempInputPath)
            .setStartTime(startTime)
            .setDuration(duration);

        if (!includeAudio) {
            command1 = command1.noAudio();
        }

        const filters = buildCombinedFilters(annotations, shapes, detailTexts, arrows, startTime, duration, videoScale);
        if (filters) {
            command1 = command1.complexFilter(filters);
        }

        const outputOpts1 = [
            '-c:v libx264',
            '-preset ultrafast',
            '-crf 28',
            '-pix_fmt yuv420p'
        ];

        if (includeAudio) {
            outputOpts1.push('-c:a aac');
            outputOpts1.push('-b:a 128k');
        }

        command1.outputOptions(outputOpts1)
            .on('start', (commandLine) => {
                console.log('ステップ1/2: 注釈適用中...', commandLine);
            })
            .on('progress', (progress) => {
                if (progress.percent) {
                    // ステップ1は全体の50%まで
                    const overallPercent = Math.min(Math.round(progress.percent / 2), 50);
                    mainWindow.webContents.send('trim-progress', {
                        percent: overallPercent
                    });
                }
            })
            .on('end', () => {
                console.log('ステップ1完了: 注釈適用済み');

                // ステップ2: 速度変更を適用
                let command2 = ffmpeg(tempAnnotatedPath);

                const videoFilter = `setpts=PTS/${speed}`;
                command2 = command2.videoFilter(videoFilter);

                if (includeAudio) {
                    const audioFilter = buildAtempoFilter(speed);
                    command2 = command2.audioFilter(audioFilter);
                }

                const outputOpts2 = [
                    '-c:v libx264',
                    '-preset ultrafast',
                    '-crf 28',
                    '-pix_fmt yuv420p'
                ];

                if (includeAudio) {
                    outputOpts2.push('-c:a aac');
                    outputOpts2.push('-b:a 128k');
                }

                command2.outputOptions(outputOpts2)
                    .on('start', (commandLine) => {
                        console.log('ステップ2/2: 速度変更中...', commandLine);
                    })
                    .on('progress', (progress) => {
                        if (progress.percent) {
                            // ステップ2は50%から100%まで
                            const overallPercent = Math.min(Math.round(50 + progress.percent / 2), 100);
                            mainWindow.webContents.send('trim-progress', {
                                percent: overallPercent
                            });
                        }
                    })
                    .on('end', () => {
                        console.log('ステップ2完了: 速度変更済み');

                        // 一時ファイルを削除
                        try {
                            fs.unlinkSync(tempInputPath);
                            fs.unlinkSync(tempAnnotatedPath);
                        } catch (e) {
                            console.error('一時ファイル削除エラー:', e);
                        }

                        resolve({ success: true, outputPath });
                    })
                    .on('error', (err) => {
                        console.error('ステップ2エラー:', err);
                        try {
                            fs.unlinkSync(tempInputPath);
                            fs.unlinkSync(tempAnnotatedPath);
                        } catch (e) {
                            console.error('一時ファイル削除エラー:', e);
                        }
                        reject(err);
                    })
                    .save(outputPath);
            })
            .on('error', (err) => {
                console.error('ステップ1エラー:', err);
                try {
                    fs.unlinkSync(tempInputPath);
                    if (fs.existsSync(tempAnnotatedPath)) {
                        fs.unlinkSync(tempAnnotatedPath);
                    }
                } catch (e) {
                    console.error('一時ファイル削除エラー:', e);
                }
                reject(err);
            })
            .save(tempAnnotatedPath);
    });
}

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
    const textAreaHeight = 120;

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
 * 指定時刻で表示すべき図形を取得（continueFromPreviousを考慮）
 * @param {Array} shapes - 図形データの配列
 * @param {number} currentTime - 現在時刻（秒）
 * @returns {Array} 有効な図形の配列
 */
function getActiveShapesAtTime(shapes, currentTime) {
    if (!shapes || shapes.length === 0) return [];

    const activeShapes = [];

    // 現在時刻以前の図形を逆順で走査
    for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];

        // 現在時刻より未来の図形はスキップ
        if (shape.time > currentTime) continue;

        // 「図形なし」が見つかったらそれ以降の図形を無効化
        if (shape.type === '') {
            break;
        }

        // 図形を追加
        activeShapes.push(shape);

        // 継続フラグがfalseの場合、これ以上前の図形は表示しない
        if (shape.continueFromPrevious === false) {
            break;
        }

        // 継続フラグがundefined（古いデータ）の場合、同じタイムスタンプのみ表示（後方互換性）
        if (shape.continueFromPrevious === undefined) {
            const currentShapeTime = shape.time;
            // 同じタイムスタンプの図形をすべて追加
            for (let j = i - 1; j >= 0; j--) {
                if (shapes[j].time > currentTime) continue;
                if (shapes[j].type === '') break;
                if (shapes[j].time === currentShapeTime) {
                    activeShapes.push(shapes[j]);
                } else {
                    break;
                }
            }
            break;
        }
    }

    // 逆順で追加したので、元の順序に戻す
    return activeShapes.reverse();
}

/**
 * テキスト注釈、図形アノテーション、詳細テキスト、方向矢印を統合したフィルタチェーンを構築
 * @param {Array} annotations - テキスト注釈データの配列
 * @param {Array} shapes - 図形アノテーションデータの配列
 * @param {Array} detailTexts - 詳細テキストデータの配列
 * @param {Array} arrows - 方向矢印データの配列
 * @param {number} trimStartTime - トリミング開始時刻
 * @param {number} trimDuration - トリミング継続時間
 * @param {Object} videoScale - 動画のスケール情報 { actualWidth, actualHeight, displayWidth, displayHeight }
 * @returns {Array|null} FFmpegのcomplexFilterに渡すフィルタ配列、または null
 */
function buildCombinedFilters(annotations, shapes, detailTexts, arrows, trimStartTime, trimDuration, videoScale) {
    // テキストがある注釈のみをフィルタリング
    const textAnnotations = annotations ? annotations.filter(ann => ann.text && ann.text.trim() !== '') : [];

    // 図形がある注釈のみをフィルタリング
    const validShapes = shapes ? shapes.filter(s => s.type !== '') : [];

    // 詳細テキストがある注釈のみをフィルタリング
    const validDetailTexts = detailTexts ? detailTexts.filter(dt => dt.text && dt.text.trim() !== '') : [];

    // 方向矢印をフィルタリング
    const validArrows = arrows ? arrows : [];

    // すべてない場合は null を返す
    if (textAnnotations.length === 0 && validShapes.length === 0 && validDetailTexts.length === 0 && validArrows.length === 0) {
        console.log('テキスト注釈、図形、詳細テキスト、方向矢印ともにないため、フィルタを適用しません');
        return null;
    }

    // 座標変換のためのスケール比率を計算
    const scaleX = videoScale ? (videoScale.actualWidth / videoScale.displayWidth) : 1;
    const scaleY = videoScale ? (videoScale.actualHeight / videoScale.displayHeight) : 1;
    console.log(`座標スケール: X=${scaleX.toFixed(2)}, Y=${scaleY.toFixed(2)}`);

    // 動画の実際の幅と高さを取得
    const videoWidth = videoScale ? videoScale.actualWidth : 1920;
    const videoHeight = videoScale ? videoScale.actualHeight : 1080;

    const filters = [];
    // テキスト表示エリアの高さ（固定値）
    const textAreaHeight = 120;

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
    // continueFromPreviousを考慮した表示時間を計算
    validShapes.forEach((shape, index) => {
        // 図形の表示開始時刻（トリミング開始時刻を基準とした相対時刻）
        const displayStartTime = Math.max(0, shape.time - trimStartTime);

        // 表示終了時刻を計算
        let displayEndTime = trimDuration;

        // 元の配列から次の図形を探す
        const currentIndex = shapes.indexOf(shape);
        for (let i = currentIndex + 1; i < shapes.length; i++) {
            const nextShape = shapes[i];

            // 「図形なし」が来たら、そこで終了
            if (nextShape.type === '') {
                displayEndTime = Math.max(displayStartTime, Math.min(trimDuration, nextShape.time - trimStartTime));
                break;
            }

            // 次の図形の continueFromPrevious が false の場合、そこで終了
            if (nextShape.continueFromPrevious === false) {
                displayEndTime = Math.max(displayStartTime, Math.min(trimDuration, nextShape.time - trimStartTime));
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
        } else if (shape.type === 'line') {
            // 直線: drawbox フィルターで水平線または垂直線、それ以外は複数のdrawboxで近似
            const lineWidth = shape.lineWidth || 5;

            // 座標をスケール変換
            const x1 = Math.round(shape.x1 * scaleX);
            const y1 = Math.round(shape.y1 * scaleY);
            const x2 = Math.round(shape.x2 * scaleX);
            const y2 = Math.round(shape.y2 * scaleY);

            // スケール変換した線の太さ
            const scaledLineWidth = Math.round(lineWidth * Math.min(scaleX, scaleY));

            // 水平線または垂直線かを判定
            const dx = Math.abs(x2 - x1);
            const dy = Math.abs(y2 - y1);
            const threshold = 10; // 閾値: 10ピクセル以内なら水平/垂直とみなす

            if (dy <= threshold) {
                // 水平線
                const x = Math.min(x1, x2);
                const y = Math.round((y1 + y2) / 2 - scaledLineWidth / 2);
                const w = dx;
                const h = scaledLineWidth;

                filterObj = {
                    filter: 'drawbox',
                    options: {
                        x: x,
                        y: y,
                        w: w,
                        h: h,
                        color: shape.color,
                        t: 'fill',
                        enable: `between(t,${displayStartTime},${displayEndTime})`
                    },
                    inputs: currentInput
                };
            } else if (dx <= threshold) {
                // 垂直線
                const x = Math.round((x1 + x2) / 2 - scaledLineWidth / 2);
                const y = Math.min(y1, y2);
                const w = scaledLineWidth;
                const h = dy;

                filterObj = {
                    filter: 'drawbox',
                    options: {
                        x: x,
                        y: y,
                        w: w,
                        h: h,
                        color: shape.color,
                        t: 'fill',
                        enable: `between(t,${displayStartTime},${displayEndTime})`
                    },
                    inputs: currentInput
                };
            } else {
                // 斜め線: Bresenhamアルゴリズムで近似（小さなdrawboxを並べる）
                // 線の長さに応じてステップ数を決定
                const length = Math.sqrt(dx * dx + dy * dy);
                const steps = Math.ceil(length / scaledLineWidth);

                // 各ステップで小さな正方形を描画
                for (let i = 0; i <= steps; i++) {
                    const t = i / steps;
                    const x = Math.round(x1 + (x2 - x1) * t - scaledLineWidth / 2);
                    const y = Math.round(y1 + (y2 - y1) * t - scaledLineWidth / 2);

                    const boxFilter = {
                        filter: 'drawbox',
                        options: {
                            x: x,
                            y: y,
                            w: scaledLineWidth,
                            h: scaledLineWidth,
                            color: shape.color,
                            t: 'fill',
                            enable: `between(t,${displayStartTime},${displayEndTime})`
                        },
                        inputs: currentInput
                    };

                    filters.push(boxFilter);
                    currentInput = `[s${filters.length - 1}]`;
                }

                // filterObjはnullにして、後でスキップ
                filterObj = null;
            }
        } else if (shape.type && shape.type.startsWith('arrow')) {
            // 矢印: Unicode記号で描画
            const x2 = Math.round(shape.x2 * scaleX);
            const y2 = Math.round(shape.y2 * scaleY);

            // lineWidthをフォントサイズに変換（プレビューと同じ計算式）
            const lineWidth = shape.lineWidth || 5;
            const baseFontSize = 16 + (lineWidth * 3.0);
            const fontSize = Math.round(baseFontSize * Math.min(scaleX, scaleY));

            // テキスト付き矢印かどうかで、表示内容と色を決定
            let arrowText = '';
            let arrowColor = '';

            if (shape.isTextIncluded) {
                // テキスト付き矢印（プレビューと同じテキストと色）
                if (shape.type === 'arrow-left') {
                    arrowText = '⬅ 左';
                    arrowColor = '#1976D2'; // 青
                } else if (shape.type === 'arrow-right') {
                    arrowText = '右 ➡';
                    arrowColor = '#FF9800'; // 橙
                } else if (shape.type === 'arrow-up') {
                    arrowText = '⬆ 上';
                    arrowColor = '#4CAF50'; // 緑
                } else if (shape.type === 'arrow-down') {
                    arrowText = '⬇ 下';
                    arrowColor = '#F44336'; // 赤
                }
            } else {
                // 記号のみ矢印
                if (shape.type === 'arrow-left') arrowText = '⬅';
                else if (shape.type === 'arrow-up') arrowText = '⬆';
                else if (shape.type === 'arrow-down') arrowText = '⬇';
                else if (shape.type === 'arrow' || shape.type === 'arrow-right') arrowText = '➡';
                arrowColor = shape.color;
            }

            // フォントファイル
            const arrowFontFile = path.join(__dirname, 'src/fonts/NotoSansJP-Bold.ttf');

            filterObj = {
                filter: 'drawtext',
                options: {
                    text: arrowText,
                    fontfile: arrowFontFile,
                    fontsize: fontSize,
                    fontcolor: arrowColor,
                    x: x2 - Math.round((baseFontSize / 2) * scaleX),
                    y: y2 - Math.round((baseFontSize / 2) * scaleY),
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

        // 連番の処理
        let seqNumber = '';
        if (ann.useSequenceNumber) {
            // 時刻順で連番を計算
            const sortedAnnotations = annotations
                .filter(a => a.useSequenceNumber && a.text && a.text.trim() !== '')
                .sort((a, b) => a.time - b.time);

            // 現在の注釈のインデックスを探す
            const seqIndex = sortedAnnotations.findIndex(a =>
                Math.abs(a.time - ann.time) < 0.001 &&
                a.text === ann.text
            );

            if (seqIndex !== -1) {
                seqNumber = `(${seqIndex + 1}) `;
            }
        }

        // フォント名からフォントファイルパスへのマッピング
        const fontMapping = {
            'Noto Sans JP': path.join(__dirname, 'src/fonts/NotoSansJP-Bold.ttf'),
            'M PLUS Rounded 1c': path.join(__dirname, 'src/fonts/MPLUSRounded1c-Bold.ttf'),
            'Noto Serif JP': path.join(__dirname, 'src/fonts/NotoSerifJP-SemiBold.ttf'),
            'Klee One': path.join(__dirname, 'src/fonts/KleeOne-SemiBold.ttf'),
            'Yusei Magic': path.join(__dirname, 'src/fonts/YuseiMagic-Regular.ttf')
        };
        const fontFile = fontMapping[ann.font] || path.join(__dirname, 'src/fonts/NotoSansJP-Bold.ttf');

        // 20文字が収まるフォントサイズを計算（最小32px、最大80px）
        const fontSize = Math.max(32, Math.min(80, Math.floor(videoWidth / 28)));

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

        // テキストに連番を統合
        const textWithSeq = seqNumber + ann.text;
        const escapedText = textWithSeq
            .replace(/\\/g, '\\\\\\\\')
            .replace(/'/g, "\\\\'")
            .replace(/:/g, '\\\\:');

        const filterObj = {
            filter: 'drawtext',
            options: {
                text: escapedText,
                fontfile: fontFile,
                fontsize: fontSize,
                fontcolor: ann.textColor || '#000000',
                box: 1,
                boxcolor: `${ann.bgColor || '#ffffff'}@1.0`,
                boxborderw: 10,
                x: xPosition,
                y: videoHeight + 10,
                enable: `between(t,${displayStartTime},${displayEndTime})`
            }
        };

        filters.push(filterObj);
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

        // 背景透明度を70%に固定
        const bgOpacity = 0.7;

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

        // 注釈フォントの40%をサイズに（最小13px、最大32px）
        const annotationFontSize = Math.max(32, Math.min(80, Math.floor(videoWidth / 28)));
        const detailFontSize = Math.max(13, Math.min(32, Math.floor(annotationFontSize * 0.4)));

        // 詳細テキストのフォントマッピング
        const detailFontMapping = {
            'Noto Sans JP': path.join(__dirname, 'src/fonts/NotoSansJP-Bold.ttf'),
            'M PLUS Rounded 1c': path.join(__dirname, 'src/fonts/MPLUSRounded1c-Bold.ttf'),
            'Noto Serif JP': path.join(__dirname, 'src/fonts/NotoSerifJP-SemiBold.ttf'),
            'Klee One': path.join(__dirname, 'src/fonts/KleeOne-SemiBold.ttf'),
            'Yusei Magic': path.join(__dirname, 'src/fonts/YuseiMagic-Regular.ttf')
        };
        const detailFontFile = detailFontMapping[detail.font] || path.join(__dirname, 'src/fonts/NotoSansJP-Bold.ttf');

        const filterObj = {
            filter: 'drawtext',
            options: {
                text: escapedText,
                fontfile: detailFontFile,
                fontsize: detailFontSize,
                fontcolor: detail.textColor || '#000000',
                box: 1,
                boxcolor: `${detail.bgColor || '#ffffff'}@${bgOpacity.toFixed(2)}`,
                boxborderw: 5,
                x: detailXPosition,
                y: videoHeight + 90,
                enable: `between(t,${displayStartTime},${displayEndTime})`
            }
        };

        filters.push(filterObj);
    });

    // 5. 方向矢印を追加
    validArrows.forEach((arrow, index) => {
        // 方向矢印の表示開始時刻（トリミング開始時刻を基準とした相対時刻）
        const displayStartTime = Math.max(0, arrow.time - trimStartTime);

        // 方向矢印は常に表示（終了時刻 = トリミング終了時刻）
        const displayEndTime = trimDuration;

        // 座標をスケール変換
        const x = Math.round(arrow.x * scaleX);
        const y = Math.round(arrow.y * scaleY);

        // サイズに基づいてフォントサイズを計算（sizeはpx単位）
        const baseFontSize = 16 + (arrow.size * 6);
        const fontSize = Math.round(baseFontSize * Math.min(scaleX, scaleY));

        // 矢印テキストを作成
        const arrowText = arrow.type === 'left' ? '⬅左' : '右➡';

        // テキストを安全にエスケープ（Unicodeなのでエスケープ不要だが念のため）
        const escapedText = arrowText;

        // フォント選択
        const arrowFontFile = path.join(__dirname, 'src/fonts/NotoSansJP-Bold.ttf');

        const filterObj = {
            filter: 'drawtext',
            options: {
                text: escapedText,
                fontfile: arrowFontFile,
                fontsize: fontSize,
                fontcolor: arrow.color,
                x: x,
                y: y,
                enable: `between(t,${displayStartTime},${displayEndTime})`
            },
            inputs: currentInput
        };

        filters.push(filterObj);
        filterIndex++;
    });

    // 6. 全フィルターに対して、最後以外に出力ラベルを設定
    for (let i = 0; i < filters.length; i++) {
        if (i === 0) {
            // 最初のフィルター（pad）は既に出力ラベルを持っている
            continue;
        }

        // 2番目のフィルター（index=1）はpadフィルタの出力を入力とする
        if (i === 1) {
            filters[i].inputs = 'padded';
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
