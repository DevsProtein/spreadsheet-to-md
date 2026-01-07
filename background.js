// ポップアップからのメッセージを受信
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'convertSelection') {
    handleConversion(sendResponse);
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
