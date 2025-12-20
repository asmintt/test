// constants.js - アプリケーション全体で使用する定数
// グローバル定数として定義（モジュールシステムを使用していないため）

const APP_CONSTANTS = {
    // プロジェクト設定
    PROJECT_VERSION: '1.0',
    PROJECT_FILE_EXTENSION: '.mfs.json',
    DEFAULT_PROJECTS_PATH: 'MovieFrameSnap/Projects',

    // デフォルトの色
    DEFAULT_TEXT_COLOR: '#000000', // 黒
    DEFAULT_BG_COLOR: '#FFFFFF',   // 白

    // テキスト注釈の設定
    TEXT_AREA_HEIGHT: 150,         // テキスト表示エリアの高さ
    MAIN_TEXT_FONT_SIZE: 60,       // メインテキストのフォントサイズ
    DETAIL_TEXT_FONT_SIZE: 16,     // 詳細テキストのフォントサイズ

    // デバッグ設定
    DEBUG_MODE: true,              // デバッグログの有効/無効
    DEBUG_PREFIX: '[DEBUG]',       // デバッグログのプレフィックス

    // メッセージ
    MESSAGES: {
        ERROR: {
            NO_VIDEO: '動画ファイルが読み込まれていません',
            NO_VIDEO_FILE: '動画ファイルが見つかりません',
            NO_TITLE: 'プロジェクトタイトルを入力してください',
            NO_ELECTRON_API: 'この機能はデスクトップアプリ版でのみ利用できます',
            SAVE_FAILED: 'プロジェクトの保存に失敗しました',
            LOAD_FAILED: 'プロジェクトの読み込みに失敗しました'
        },
        SUCCESS: {
            PROJECT_SAVED: 'プロジェクトを保存しました',
            PROJECT_LOADED: 'プロジェクトを読み込みました'
        },
        CONFIRM: {
            OVERWRITE_TITLE: '確認',
            OVERWRITE_MESSAGE: 'このフォルダは既に存在します。',
            OVERWRITE_DETAIL: '上書きしますか？既存のファイルは削除されます。'
        }
    }
};

// 読み取り専用にする（変更を防ぐ）
Object.freeze(APP_CONSTANTS);
Object.freeze(APP_CONSTANTS.MESSAGES);
Object.freeze(APP_CONSTANTS.MESSAGES.ERROR);
Object.freeze(APP_CONSTANTS.MESSAGES.SUCCESS);
Object.freeze(APP_CONSTANTS.MESSAGES.CONFIRM);
