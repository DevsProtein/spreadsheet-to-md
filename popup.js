// クリップボードのデータを保持する変数
let originalClipboardText = '';

// i18nテキストを適用する関数
function applyI18n() {
  document.getElementById('description').textContent = chrome.i18n.getMessage('popupDescription');
  document.getElementById('loading').textContent = chrome.i18n.getMessage('loading');
  document.getElementById('copyNoHeaderText').textContent = chrome.i18n.getMessage('copyNoHeaderSection');
  document.getElementById('copyNoHeaderBtn').textContent = chrome.i18n.getMessage('copyNoHeaderButton');
}

// ポップアップが開かれた瞬間に自動実行
document.addEventListener('DOMContentLoaded', async () => {
  // i18nテキストを適用
  applyI18n();

  await performConversion();

  // ヘッダーなしコピーボタンのイベントリスナーを設定
  const copyNoHeaderBtn = document.getElementById('copyNoHeaderBtn');
  copyNoHeaderBtn.addEventListener('click', async () => {
    await copyWithoutHeader();
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

    // タブ区切りデータをMarkdownテーブルに変換
    const markdown = convertToMarkdown(clipboardText);

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

function convertToMarkdown(text) {
  // 行に分割
  const lines = text.trim().split('\n');

  if (lines.length === 0) {
    return null;
  }

  // 各行をタブで分割してセルを取得
  const rows = lines.map(line => {
    // タブ区切りで分割
    const cells = line.split('\t');
    // 各セルをトリムして、パイプ文字をエスケープ
    return cells.map(cell => {
      let trimmed = cell.trim();
      // Markdownテーブル内のパイプ文字をエスケープ
      trimmed = trimmed.replace(/\|/g, '\\|');
      // 改行を<br>に変換
      trimmed = trimmed.replace(/\r?\n/g, '<br>');
      return trimmed;
    });
  });

  if (rows.length === 0 || rows[0].length === 0) {
    return null;
  }

  // 最大列数を計算
  const maxCols = Math.max(...rows.map(row => row.length));

  // 各行の列数を揃える
  const normalizedRows = rows.map(row => {
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

function convertToMarkdownNoHeader(text) {
  // 行に分割
  const lines = text.trim().split('\n');

  if (lines.length === 0) {
    return null;
  }

  // 各行をタブで分割してセルを取得
  const rows = lines.map(line => {
    // タブ区切りで分割
    const cells = line.split('\t');
    // 各セルをトリムして、パイプ文字をエスケープ
    return cells.map(cell => {
      let trimmed = cell.trim();
      // Markdownテーブル内のパイプ文字をエスケープ
      trimmed = trimmed.replace(/\|/g, '\\|');
      // 改行を<br>に変換
      trimmed = trimmed.replace(/\r?\n/g, '<br>');
      return trimmed;
    });
  });

  if (rows.length === 0 || rows[0].length === 0) {
    return null;
  }

  // 最大列数を計算
  const maxCols = Math.max(...rows.map(row => row.length));

  // 各行の列数を揃える
  const normalizedRows = rows.map(row => {
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

  try {
    if (!originalClipboardText) {
      throw new Error(chrome.i18n.getMessage('errorNoOriginalData'));
    }

    // ヘッダーなし形式に変換
    const markdownNoHeader = convertToMarkdownNoHeader(originalClipboardText);

    if (!markdownNoHeader) {
      throw new Error(chrome.i18n.getMessage('errorNoTable'));
    }

    // クリップボードにコピー
    await navigator.clipboard.writeText(markdownNoHeader);

    // 成功メッセージを表示
    statusEl.textContent = chrome.i18n.getMessage('successNoHeaderCopy');
    statusEl.className = 'status success';

  } catch (error) {
    statusEl.textContent = chrome.i18n.getMessage('errorPrefix') + error.message;
    statusEl.className = 'status error';
  }
}
