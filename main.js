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
    const {
        inputPath,      // 入力動画ファイルのパス
        outputPath,     // 出力動画ファイルのパス
        startTime,      // 開始時刻（秒）
        duration,       // 継続時間（秒）
        speed,          // 再生速度（1.0 = 通常）
        includeAudio,   // 音声を含むか
        annotations     // テキスト注釈データ（配列）
    } = data;

    return new Promise((resolve, reject) => {
        try {
            // FFmpegコマンドを構築
            let command = ffmpeg(inputPath)
                .setStartTime(startTime)
                .setDuration(duration);

            // 音声の有無
            if (!includeAudio) {
                command = command.noAudio();
            }

            // 再生速度の調整
            if (Math.abs(speed - 1.0) > 0.01) {
                const ptsMultiplier = 1.0 / speed;
                command = command.videoFilters(`setpts=${ptsMultiplier}*PTS`);

                if (includeAudio) {
                    // 音声の速度も調整
                    const atempoFilter = buildAtempoFilter(speed);
                    command = command.audioFilters(atempoFilter);
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
                    resolve({ success: true, outputPath });
                })
                .on('error', (err) => {
                    console.error('FFmpegエラー:', err);
                    reject(err);
                })
                .save(outputPath);

        } catch (error) {
            reject(error);
        }
    });
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
