const fs = require('fs');
const path = require('path');

// SVGデザインを反映したPNG生成
function createPNG(size) {
  const scale = size / 128;

  // RGBAピクセルデータを作成
  const pixels = new Uint8Array(size * size * 4);

  // 色定義
  const green = { r: 76, g: 175, b: 80 };
  const white = { r: 255, g: 255, b: 255 };

  // 各ピクセルを描画
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // デフォルトは緑（背景）
      let color = green;
      let alpha = 255;

      // 座標を128x128スケールに変換
      const sx = x / scale;
      const sy = y / scale;

      // 角丸の判定（rx=16）
      const cornerRadius = 16;
      let inBackground = true;

      // 四隅の角丸チェック
      if (sx < cornerRadius && sy < cornerRadius) {
        const dx = cornerRadius - sx;
        const dy = cornerRadius - sy;
        if (dx * dx + dy * dy > cornerRadius * cornerRadius) {
          inBackground = false;
        }
      } else if (sx > 128 - cornerRadius && sy < cornerRadius) {
        const dx = sx - (128 - cornerRadius);
        const dy = cornerRadius - sy;
        if (dx * dx + dy * dy > cornerRadius * cornerRadius) {
          inBackground = false;
        }
      } else if (sx < cornerRadius && sy > 128 - cornerRadius) {
        const dx = cornerRadius - sx;
        const dy = sy - (128 - cornerRadius);
        if (dx * dx + dy * dy > cornerRadius * cornerRadius) {
          inBackground = false;
        }
      } else if (sx > 128 - cornerRadius && sy > 128 - cornerRadius) {
        const dx = sx - (128 - cornerRadius);
        const dy = sy - (128 - cornerRadius);
        if (dx * dx + dy * dy > cornerRadius * cornerRadius) {
          inBackground = false;
        }
      }

      if (!inBackground) {
        alpha = 0;
      } else {
        // テーブルエリア（白い背景）
        if (sx >= 20 && sx <= 108 && sy >= 30 && sy <= 98) {
          // 小さな角丸（rx=4）
          const tableCorner = 4;
          let inTable = true;

          if (sx < 24 && sy < 34) {
            const dx = 24 - sx;
            const dy = 34 - sy;
            if (dx * dx + dy * dy > tableCorner * tableCorner) {
              inTable = false;
            }
          } else if (sx > 104 && sy < 34) {
            const dx = sx - 104;
            const dy = 34 - sy;
            if (dx * dx + dy * dy > tableCorner * tableCorner) {
              inTable = false;
            }
          } else if (sx < 24 && sy > 94) {
            const dx = 24 - sx;
            const dy = sy - 94;
            if (dx * dx + dy * dy > tableCorner * tableCorner) {
              inTable = false;
            }
          } else if (sx > 104 && sy > 94) {
            const dx = sx - 104;
            const dy = sy - 94;
            if (dx * dx + dy * dy > tableCorner * tableCorner) {
              inTable = false;
            }
          }

          if (inTable) {
            // 白い背景（opacity 0.9）
            color = { r: 230, g: 243, b: 231 }; // 少し緑がかった白

            // 水平線
            const lineWidth = 2;
            if ((sy >= 47 && sy <= 49) || (sy >= 63 && sy <= 65) || (sy >= 79 && sy <= 81)) {
              color = green;
            }

            // 垂直線
            if ((sx >= 49 && sx <= 51) || (sx >= 77 && sx <= 79)) {
              color = green;
            }
          }
        }

        // MDテキスト（シンプルな表現）
        if (sy >= 108 && sy <= 123) {
          // "M"の描画
          if (sx >= 45 && sx <= 48) color = white;
          if (sx >= 52 && sx <= 55) color = white;
          if (sy >= 108 && sy <= 112 && sx >= 48 && sx <= 52) color = white;

          // "D"の描画
          if (sx >= 60 && sx <= 63) color = white;
          if (sy >= 108 && sy <= 111 && sx >= 63 && sx <= 70) color = white;
          if (sy >= 120 && sy <= 123 && sx >= 63 && sx <= 70) color = white;
          if (sx >= 70 && sx <= 73 && sy >= 111 && sy <= 120) color = white;
        }
      }

      pixels[idx] = color.r;
      pixels[idx + 1] = color.g;
      pixels[idx + 2] = color.b;
      pixels[idx + 3] = alpha;
    }
  }

  return createPNGFromRGBA(pixels, size, size);
}

function createPNGFromRGBA(pixels, width, height) {
  // PNG署名
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDRチャンク
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);        // bit depth
  ihdrData.writeUInt8(6, 9);        // color type (RGBA)
  ihdrData.writeUInt8(0, 10);       // compression
  ihdrData.writeUInt8(0, 11);       // filter
  ihdrData.writeUInt8(0, 12);       // interlace

  const ihdr = createChunk('IHDR', ihdrData);

  // IDATチャンク
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // フィルターバイト
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      rawData.push(pixels[idx], pixels[idx + 1], pixels[idx + 2], pixels[idx + 3]);
    }
  }

  const zlibData = createUncompressedZlib(Buffer.from(rawData));
  const idat = createChunk('IDAT', zlibData);

  // IENDチャンク
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function createUncompressedZlib(data) {
  const header = Buffer.from([0x78, 0x01]);
  const blocks = [];
  let offset = 0;
  const maxBlockSize = 65535;

  while (offset < data.length) {
    const blockSize = Math.min(maxBlockSize, data.length - offset);
    const isLast = offset + blockSize >= data.length;

    const blockHeader = Buffer.alloc(5);
    blockHeader.writeUInt8(isLast ? 1 : 0, 0);
    blockHeader.writeUInt16LE(blockSize, 1);
    blockHeader.writeUInt16LE(blockSize ^ 0xFFFF, 3);

    blocks.push(blockHeader);
    blocks.push(data.slice(offset, offset + blockSize));

    offset += blockSize;
  }

  const adler = adler32(data);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(adler, 0);

  return Buffer.concat([header, ...blocks, checksum]);
}

function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = getCRC32Table();

  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function getCRC32Table() {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xEDB88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    table[n] = c;
  }
  return table;
}

function adler32(data) {
  let a = 1, b = 0;
  const MOD = 65521;

  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % MOD;
    b = (b + a) % MOD;
  }

  return ((b << 16) | a) >>> 0;
}

// アイコンを生成
const sizes = [16, 48, 128];
const iconsDir = path.join(__dirname, 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir);
}

sizes.forEach(size => {
  const png = createPNG(size);
  const filePath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Generated: ${filePath}`);
});

console.log('All icons generated with SVG design!');
