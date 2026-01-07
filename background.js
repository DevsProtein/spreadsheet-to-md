// ポップアップからのメッセージを受信
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'convertSelection') {
    handleConversion(sendResponse);
    return true; // 非同期レスポンスを示す
  }
  if (request.action === 'getSheetName') {
    getSheetName(sendResponse);
    return true; // 非同期レスポンスを示す
  }
});

async function handleConversion(sendResponse) {
  try {
    // 現在のアクティブタブを取得
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      sendResponse({ success: false, error: 'アクティブなタブが見つかりません' });
      return;
    }

    // コンテンツスクリプトを注入して選択範囲をコピー
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: copySelectionToClipboard
    });

    if (!results || results.length === 0) {
      sendResponse({ success: false, error: 'スクリプトの実行に失敗しました' });
      return;
    }

    const result = results[0].result;

    if (!result.success) {
      sendResponse({ success: false, error: result.error });
      return;
    }

    // クリップボードのデータを変換
    sendResponse({ success: true, message: 'コピー操作を実行しました' });

  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// ページ上で実行される関数
function copySelectionToClipboard() {
  try {
    // 選択範囲をコピー（Ctrl+C/Cmd+Cと同等）
    const success = document.execCommand('copy');
    if (!success) {
      return { success: false, error: 'コピーコマンドの実行に失敗しました' };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// シート名を取得する処理
async function getSheetName(sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      sendResponse({ success: false, error: 'アクティブなタブが見つかりません' });
      return;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractSheetName
    });

    if (!results || results.length === 0) {
      sendResponse({ success: false, error: 'スクリプトの実行に失敗しました' });
      return;
    }

    const result = results[0].result;
    sendResponse(result);

  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// ページからシート名を抽出する関数
function extractSheetName() {
  try {
    // Google スプレッドシートの場合
    const googleSheetTab = document.querySelector('.docs-sheet-tab.docs-sheet-active-tab .docs-sheet-tab-name');
    if (googleSheetTab) {
      return { success: true, sheetName: googleSheetTab.textContent.trim() };
    }

    // Google スプレッドシートの別パターン（新しいUI）
    const googleSheetTab2 = document.querySelector('[aria-selected="true"] .docs-sheet-tab-name');
    if (googleSheetTab2) {
      return { success: true, sheetName: googleSheetTab2.textContent.trim() };
    }

    // Excel Onlineの場合
    const excelSheetTab = document.querySelector('[role="tab"][aria-selected="true"] [data-content]');
    if (excelSheetTab) {
      return { success: true, sheetName: excelSheetTab.getAttribute('data-content') || excelSheetTab.textContent.trim() };
    }

    // Excel Onlineの別パターン
    const excelSheetTab2 = document.querySelector('.sheet-tab.active, .ewcs-SheetTab.ewcs-selected');
    if (excelSheetTab2) {
      return { success: true, sheetName: excelSheetTab2.textContent.trim() };
    }

    return { success: false, error: 'シート名が見つかりません' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
