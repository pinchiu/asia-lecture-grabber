import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * 由 mobile/assets/icon 內的 SVG 主檔產生 Android 啟動圖示與 App 內共用圖示。
 *
 * 設計檔拆分為四層：
 * - app-icon.svg：滿版主檔（iOS、舊版 Android、對外預覽使用，主體比例較大）。
 * - app-icon-background.svg：自適應圖示背景層（含曜石黑底與暖光）。
 * - app-icon-foreground.svg：自適應圖示前景層（透明底，主體留存於安全圈內）。
 * - app-icon-monochrome.svg：Android 13+ 主題圖示單色層。
 *
 * 此腳本需要 ImageMagick 7（含 librsvg/RSVG 委派）才能正確渲染 SVG 濾鏡與漸層；
 * 應用程式本身仍維持零執行期相依。可用 MAGICK 環境變數指定執行檔路徑。
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const ICON_DIR = path.join(ROOT, 'mobile', 'assets', 'icon');
const ASSET_DIR = path.join(ROOT, 'mobile', 'assets');
const RES_DIR = path.join(ROOT, 'mobile', 'android', 'app', 'src', 'main', 'res');

const MAGICK = process.env.MAGICK || 'magick';
const MASTER_SVG = path.join(ICON_DIR, 'app-icon.svg');
const BACKGROUND_SVG = path.join(ICON_DIR, 'app-icon-background.svg');
const FOREGROUND_SVG = path.join(ICON_DIR, 'app-icon-foreground.svg');
const MONOCHROME_SVG = path.join(ICON_DIR, 'app-icon-monochrome.svg');

/** Android 各密度倍率，基準為 48dp 舊版圖示與 108dp 自適應圖示。 */
const DENSITIES = [
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4],
];

/** 舊版圖示圓角半徑比例，貼近 iOS 與 Android 啟動器的視覺慣例。 */
const LEGACY_CORNER_RATIO = 0.225;

function execute(args) {
  const result = spawnSync(MAGICK, args, {
    encoding: 'buffer',
    maxBuffer: 128 * 1024 * 1024,
    windowsHide: true,
  });

  if (result.error && result.error.code === 'ENOENT') {
    throw new Error(
      `找不到 ImageMagick 的「${MAGICK}」指令。\n` +
        '請先安裝 ImageMagick 7（需含 librsvg/RSVG 委派），或設定 MAGICK 環境變數指向執行檔。',
    );
  }

  if (result.status !== 0) {
    const stderr = result.stderr ? result.stderr.toString().trim() : '';
    throw new Error(`ImageMagick 執行失敗：${args.join(' ')}\n${stderr}`);
  }
}

function assertEnvironment() {
  const result = spawnSync(MAGICK, ['-version'], { encoding: 'utf8', windowsHide: true });
  if (result.error) {
    throw new Error(
      `找不到 ImageMagick 的「${MAGICK}」指令。\n` +
        '請先安裝 ImageMagick 7（需含 librsvg/RSVG 委派），或設定 MAGICK 環境變數指向執行檔。',
    );
  }
  if (result.status !== 0) {
    throw new Error('ImageMagick 無法正常執行，請確認安裝內容。');
  }
}

function renderSvg(svgPath, size, outputPath) {
  execute(['-background', 'none', svgPath, '-resize', `${size}x${size}`, outputPath]);
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function writeAdaptiveIconXml(includeMonochrome) {
  const lines = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<!-- 由 npm run mobile:icons 產生，請勿手動編輯。 -->',
    '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">',
    '    <background android:drawable="@mipmap/ic_launcher_background" />',
    '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />',
  ];
  if (includeMonochrome) {
    lines.push('    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />');
  }
  lines.push('</adaptive-icon>', '');
  return lines.join('\n');
}

function main() {
  assertEnvironment();

  for (const file of [MASTER_SVG, BACKGROUND_SVG, FOREGROUND_SVG, MONOCHROME_SVG]) {
    if (!fs.existsSync(file)) {
      throw new Error(`缺少圖示來源檔：${file}`);
    }
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'asia-icon-'));
  try {
    // 舊版 Android 圖示：以滿版主檔加上圓角遮罩，再縮放至各密度。
    const masterPath = path.join(tempDir, 'master.png');
    const maskPath = path.join(tempDir, 'mask.png');
    const roundedPath = path.join(tempDir, 'master-rounded.png');

    renderSvg(MASTER_SVG, 1024, masterPath);
    execute([
      '-size',
      '1024x1024',
      'xc:black',
      '-fill',
      'white',
      '-draw',
      `roundrectangle 0,0 1023,1023 ${Math.round(1024 * LEGACY_CORNER_RATIO)},${Math.round(1024 * LEGACY_CORNER_RATIO)}`,
      maskPath,
    ]);
    execute([masterPath, maskPath, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', roundedPath]);

    for (const [density, scale] of DENSITIES) {
      const size = Math.round(48 * scale);
      const outputDir = path.join(RES_DIR, `mipmap-${density}`);
      fs.mkdirSync(outputDir, { recursive: true });
      execute([roundedPath, '-resize', `${size}x${size}`, path.join(outputDir, 'ic_launcher.png')]);
    }

    // 自適應圖示：背景、前景與單色層需使用相同尺寸與座標系。
    for (const [density, scale] of DENSITIES) {
      const size = Math.round(108 * scale);
      const outputDir = path.join(RES_DIR, `mipmap-${density}`);
      fs.mkdirSync(outputDir, { recursive: true });
      renderSvg(BACKGROUND_SVG, size, path.join(outputDir, 'ic_launcher_background.png'));
      renderSvg(FOREGROUND_SVG, size, path.join(outputDir, 'ic_launcher_foreground.png'));
      renderSvg(MONOCHROME_SVG, size, path.join(outputDir, 'ic_launcher_monochrome.png'));
    }

    writeFile(path.join(RES_DIR, 'mipmap-anydpi-v26', 'ic_launcher.xml'), writeAdaptiveIconXml(false));
    writeFile(path.join(RES_DIR, 'mipmap-anydpi-v33', 'ic_launcher.xml'), writeAdaptiveIconXml(true));

    // App 內共用圖示（與 PWA 預覽一致），沿用圓角版本避免方形邊角過於生硬。
    for (const size of [192, 512]) {
      execute([roundedPath, '-resize', `${size}x${size}`, path.join(ASSET_DIR, `icon-${size}.png`)]);
    }

    console.log('已產生 Android 啟動圖示與 App 共用圖示：');
    console.log(`- ${path.relative(ROOT, RES_DIR)}/mipmap-*/ic_launcher.png`);
    console.log(`- ${path.relative(ROOT, RES_DIR)}/mipmap-*/ic_launcher_{background,foreground,monochrome}.png`);
    console.log(`- ${path.relative(ROOT, ASSET_DIR)}/icon-{192,512}.png`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
