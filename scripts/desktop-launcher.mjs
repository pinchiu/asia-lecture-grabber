import { spawn } from 'node:child_process';
import http from 'node:http';

const PORT = process.env.PORT || 5199;
const URL = `http://127.0.0.1:${PORT}`;

console.log(`[桌面啟動器] 正在啟動服務，網址：${URL}`);

// 啟動伺服器程序
const serverProcess = spawn(process.execPath, ['src/server.mjs'], {
  stdio: 'inherit',
  env: process.env
});

serverProcess.on('error', (err) => {
  console.error('[桌面啟動器] 伺服器啟動失敗：', err.message);
  process.exit(1);
});

// 輪詢等待伺服器準備完成後開啟瀏覽器
function waitForServer(retries = 20) {
  if (retries <= 0) {
    console.log('[桌面啟動器] 伺服器可能需要更長時間啟動，請手動開啟瀏覽器：', URL);
    return;
  }

  http
    .get(URL, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 500) {
        console.log('[桌面啟動器] 服務就緒，正在喚起瀏覽器視窗...');
        openBrowser(URL);
      } else {
        setTimeout(() => waitForServer(retries - 1), 300);
      }
    })
    .on('error', () => {
      setTimeout(() => waitForServer(retries - 1), 300);
    });
}

function openBrowser(targetUrl) {
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  if (isWin) {
    // 優先以 Chrome App 視窗模式開啟（若有安裝），否則使用預設瀏覽器
    const chrome = spawn('cmd', ['/c', 'start', 'chrome', `--app=${targetUrl}`], { detached: true, stdio: 'ignore' });
    chrome.on('error', () => {
      spawn('cmd', ['/c', 'start', targetUrl], { detached: true, stdio: 'ignore' });
    });
  } else if (isMac) {
    spawn('open', [targetUrl], { detached: true, stdio: 'ignore' });
  } else {
    spawn('xdg-open', [targetUrl], { detached: true, stdio: 'ignore' });
  }
}

waitForServer();
