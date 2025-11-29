// main.js - Electronのメインプロセス
// アプリケーションのライフサイクルとウィンドウ管理を担当

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

// FFmpegのパスを設定（ローカルで動作するようにする）
ffmpeg.setFfmpegPath(ffmpegStatic);

// メインウィンドウへの参照を保持
let mainWindow;

/**
 * メインウィンドウを作成する関数
 */
function createWindow() {
    // ブラウザウィンドウを作成
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
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
    // mainWindow.webContents.openDevTools();

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

            // テキスト注釈を含める場合
            if (includeAnnotations && annotations && annotations.length > 0) {
                // 注釈表示用のフィルタチェーンを構築
                const filters = buildAnnotationFilters(annotations, startTime, duration);
                if (filters) {
                    command = command.complexFilter(filters);
                }
            }

            // 出力設定
            command
                .outputOptions([
                    '-c:v libx264',
                    '-preset ultrafast',
                    '-crf 28'
                ])
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
 * @returns {Array} FFmpegのcomplexFilterに渡すフィルタ配列
 */
function buildAnnotationFilters(annotations, trimStartTime, trimDuration) {
    const filters = [];
    const textAreaHeight = 60; // テキスト表示エリアの高さ

    // 1. 動画の下に黒い領域を追加
    filters.push({
        filter: 'pad',
        options: {
            width: 'iw',
            height: `ih+${textAreaHeight}`,
            x: 0,
            y: 0,
            color: 'black'
        },
        outputs: 'padded'
    });

    let currentInput = 'padded';

    // 2. 各注釈に対してdrawtextフィルターを追加
    annotations.forEach((ann, index) => {
        // 「注釈なし」はスキップ
        if (!ann.text) return;

        // 注釈の表示開始時刻（トリミング開始時刻を基準とした相対時刻）
        const displayStartTime = Math.max(0, ann.time - trimStartTime);

        // 次の注釈または動画終了までの時間を計算
        let displayEndTime = trimDuration;
        for (let i = index + 1; i < annotations.length; i++) {
            if (annotations[i].time > ann.time) {
                // 次の注釈が「注釈なし」の場合、そこで終了
                if (!annotations[i].text) {
                    displayEndTime = Math.min(trimDuration, annotations[i].time - trimStartTime);
                    break;
                }
                // 次の注釈がテキストありの場合、そこまで継続
                // （次のループで上書きされる）
            }
        }

        // テキストを安全にエスケープ
        const escapedText = ann.text
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/:/g, '\\:');

        const outputLabel = `ann${index}`;

        filters.push({
            filter: 'drawtext',
            options: {
                text: escapedText,
                fontfile: '/System/Library/Fonts/ヒラギノ角ゴシック W4.ttc',
                fontsize: 30,
                fontcolor: ann.textColor || '#000000',
                box: 1,
                boxcolor: `${ann.bgColor || '#ffffff'}@1.0`,
                boxborderw: 15,
                x: '(w-text_w)/2',
                y: `h-${textAreaHeight/2}-text_h/2`,
                enable: `between(t,${displayStartTime},${displayEndTime})`
            },
            inputs: currentInput,
            outputs: outputLabel
        });

        currentInput = outputLabel;
    });

    return filters;
}
