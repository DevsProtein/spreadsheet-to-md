// クリップボードのデータを保持する変数
let originalClipboardText = '';
let currentSheetName = '';

// i18nテキストを適用する関数
function applyI18n() {
  document.getElementById('description').textContent = chrome.i18n.getMessage('popupDescription');
  document.getElementById('loading').textContent = chrome.i18n.getMessage('loading');
  document.getElementById('copyNoHeaderBtn').textContent = chrome.i18n.getMessage('copyNoHeaderButton');
  document.getElementById('copyWithSheetNameBtn').textContent = chrome.i18n.getMessage('copyWithSheetNameButton');
}

// ポップアップが開かれた瞬間に自動実行
document.addEventListener('DOMContentLoaded', async () => {
  // i18nテキストを適用
  applyI18n();

  await performConversion();

  // ヘッダーなしコピーボタンのイベントリスナーを設定
  document.getElementById('copyNoHeaderBtn').addEventListener('click', async () => {
    await copyWithoutHeader();
  });

  // シート名付きコピーボタンのイベントリスナーを設定
  document.getElementById('copyWithSheetNameBtn').addEventListener('click', async () => {
    await copyWithSheetName();
  });
});

async function performConversion() {
  const statusEl = document.getElementById('status');
  const previewEl = document.getElementById('preview');
  const loadingEl = document.getElementById('loading');
  const copySectionEl = document.getElementById('copySection');

  try {
    // ローディング表示
    loadingEl.style.display = 'block';

    // シート名を取得
    const sheetNameResponse = await chrome.runtime.sendMessage({ action: 'getSheetName' });
    if (sheetNameResponse.success) {
      currentSheetName = sheetNameResponse.sheetName;
    }

    // background.jsにメッセージを送信して、現在のタブで選択範囲をコピー
    const response = await chrome.runtime.sendMessage({ action: 'convertSelection' });

    if (!response.success) {
      throw new Error(response.error || chrome.i18n.getMessage('errorCopyFailed'));
    }

    // 少し待ってからクリップボードを読み取る（コピー操作が完了するのを待つ）
    await new Promise(resolve => setTimeout(resolve, 100));

    // クリップボードからテキストを読み取る
    const clipboardText = await navigator.clipboard.readText();

    if (!clipboardText) {
      throw new Error(chrome.i18n.getMessage('errorNoClipboard'));
    }

    // 元のテキストを保存
    originalClipboardText = clipboardText;

    // タブ区切りデータをMarkdownテーブルに変換（デフォルトはシート名なし）
    const markdown = convertToMarkdown(clipboardText, null);

    if (!markdown) {
      throw new Error(chrome.i18n.getMessage('errorNoTable'));
    }

    // 変換結果をクリップボードに書き込む
    await navigator.clipboard.writeText(markdown);

    // 成功メッセージを表示
    loadingEl.style.display = 'none';
    statusEl.textContent = chrome.i18n.getMessage('successConverted');
    statusEl.className = 'status success';

    // プレビューを表示
    previewEl.textContent = markdown;
    previewEl.style.display = 'block';

    // ヘッダーなしコピーセクションを表示
    copySectionEl.style.display = 'block';

  } catch (error) {
    loadingEl.style.display = 'none';
    statusEl.textContent = chrome.i18n.getMessage('errorPrefix') + error.message;
    statusEl.className = 'status error';
  }
}

// TSV形式のテキストをパースする関数（セル内改行対応）
function parseTSV(text) {
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // エスケープされた引用符
          currentCell += '"';
          i += 2;
          continue;
        } else {
          // 引用符の終了
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        // 引用符内の文字（改行含む）
        currentCell += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        // 引用符の開始
        inQuotes = true;
        i++;
        continue;
      } else if (char === '\t') {
        // タブ区切り
        currentRow.push(currentCell);
        currentCell = '';
        i++;
        continue;
      } else if (char === '\r' && nextChar === '\n') {
        // CRLF改行
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        i += 2;
        continue;
      } else if (char === '\n') {
        // LF改行
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        i++;
        continue;
      } else {
        currentCell += char;
        i++;
        continue;
      }
    }
  }

  // 最後のセルと行を追加
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

// セルを処理する関数
function processCell(cell) {
  let processed = cell.trim();
  // Markdownテーブル内のパイプ文字をエスケープ
  processed = processed.replace(/\|/g, '\\|');
  // セル内改行を<br>に変換
  processed = processed.replace(/\r?\n/g, '<br>');
  return processed;
}

function convertToMarkdown(text, sheetName = null) {
  // TSVをパース
  const rows = parseTSV(text.trim());

  if (rows.length === 0) {
    return null;
  }

  // 各セルを処理
  const processedRows = rows.map(row => row.map(cell => processCell(cell)));

  if (processedRows.length === 0 || processedRows[0].length === 0) {
    return null;
  }

  // 最大列数を計算
  const maxCols = Math.max(...processedRows.map(row => row.length));

  // 各行の列数を揃える
  const normalizedRows = processedRows.map(row => {
    while (row.length < maxCols) {
      row.push('');
    }
    return row;
  });

  // 各列の最大幅を計算（最小幅は3）
  const colWidths = [];
  for (let col = 0; col < maxCols; col++) {
    let maxWidth = 3;
    for (const row of normalizedRows) {
      const cellLength = row[col].length;
      if (cellLength > maxWidth) {
        maxWidth = cellLength;
      }
    }
    colWidths.push(maxWidth);
  }

  // Markdownテーブルを構築
  const markdownLines = [];

  // シート名を追加（オプション）
  if (sheetName) {
    markdownLines.push(`### ${sheetName}`);
    markdownLines.push('');
  }

  // ヘッダー行
  const headerCells = normalizedRows[0].map((cell, i) =>
    cell.padEnd(colWidths[i], ' ')
  );
  markdownLines.push('| ' + headerCells.join(' | ') + ' |');

  // 区切り行
  const separatorCells = colWidths.map(width => '-'.repeat(width));
  markdownLines.push('| ' + separatorCells.join(' | ') + ' |');

  // データ行
  for (let i = 1; i < normalizedRows.length; i++) {
    const dataCells = normalizedRows[i].map((cell, j) =>
      cell.padEnd(colWidths[j], ' ')
    );
    markdownLines.push('| ' + dataCells.join(' | ') + ' |');
  }

  return markdownLines.join('\n');
}

function convertToMarkdownNoHeader(text, sheetName = null) {
  // TSVをパース
  const rows = parseTSV(text.trim());

  if (rows.length === 0) {
    return null;
  }

  // 各セルを処理
  const processedRows = rows.map(row => row.map(cell => processCell(cell)));

  if (processedRows.length === 0 || processedRows[0].length === 0) {
    return null;
  }

  // 最大列数を計算
  const maxCols = Math.max(...processedRows.map(row => row.length));

  // 各行の列数を揃える
  const normalizedRows = processedRows.map(row => {
    while (row.length < maxCols) {
      row.push('');
    }
    return row;
  });

  // 各列の最大幅を計算（最小幅は3）
  const colWidths = [];
  for (let col = 0; col < maxCols; col++) {
    let maxWidth = 3;
    for (const row of normalizedRows) {
      const cellLength = row[col].length;
      if (cellLength > maxWidth) {
        maxWidth = cellLength;
      }
    }
    colWidths.push(maxWidth);
  }

  // Markdownテーブルを構築（ヘッダーなし）
  const markdownLines = [];

  // シート名を追加（オプション）
  if (sheetName) {
    markdownLines.push(`### ${sheetName}`);
    markdownLines.push('');
  }

  // 全ての行をデータ行として扱う
  for (let i = 0; i < normalizedRows.length; i++) {
    const dataCells = normalizedRows[i].map((cell, j) =>
      cell.padEnd(colWidths[j], ' ')
    );
    markdownLines.push('| ' + dataCells.join(' | ') + ' |');
  }

  return markdownLines.join('\n');
}

async function copyWithoutHeader() {
  const statusEl = document.getElementById('status');
  const previewEl = document.getElementById('preview');

  try {
    if (!originalClipboardText) {
      throw new Error(chrome.i18n.getMessage('errorNoOriginalData'));
    }

    // ヘッダーなし形式に変換（シート名なし）
    const markdownNoHeader = convertToMarkdownNoHeader(originalClipboardText, null);

    if (!markdownNoHeader) {
      throw new Error(chrome.i18n.getMessage('errorNoTable'));
    }

    // クリップボードにコピー
    await navigator.clipboard.writeText(markdownNoHeader);

    // プレビューを更新
    previewEl.textContent = markdownNoHeader;

    // 成功メッセージを表示
    statusEl.textContent = chrome.i18n.getMessage('successNoHeaderCopy');
    statusEl.className = 'status success';

  } catch (error) {
    statusEl.textContent = chrome.i18n.getMessage('errorPrefix') + error.message;
    statusEl.className = 'status error';
  }
}

async function copyWithSheetName() {
  const statusEl = document.getElementById('status');
  const previewEl = document.getElementById('preview');

  try {
    if (!originalClipboardText) {
      throw new Error(chrome.i18n.getMessage('errorNoOriginalData'));
    }

    if (!currentSheetName) {
      throw new Error(chrome.i18n.getMessage('sheetNameNotFound'));
    }

    // シート名付きでMarkdownに変換
    const markdown = convertToMarkdown(originalClipboardText, currentSheetName);

    if (!markdown) {
      throw new Error(chrome.i18n.getMessage('errorNoTable'));
    }

    // クリップボードにコピー
    await navigator.clipboard.writeText(markdown);

    // プレビューを更新
    previewEl.textContent = markdown;

    // 成功メッセージを表示
    statusEl.textContent = chrome.i18n.getMessage('successSheetNameCopy');
    statusEl.className = 'status success';

  } catch (error) {
    statusEl.textContent = chrome.i18n.getMessage('errorPrefix') + error.message;
    statusEl.className = 'status error';
  }
}
