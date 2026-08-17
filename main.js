const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

const PORT = 3000;

let win;
let server;

// 패키징된 앱에서는 main.js가 resources/app 안에 있고,
// 개발 중(npm run electron-dev)에는 프로젝트 루트에 있음.
const appRoot = app.isPackaged ? path.join(process.resourcesPath, "app") : __dirname;
const standaloneDir = path.join(appRoot, ".next", "standalone");
const serverEntry = path.join(standaloneDir, "server.js");

function startServer() {
  // standalone 서버는 순수 Node 스크립트라, Node.js가 따로 안 깔려 있어도
  // Electron 실행 파일 자체를 "ELECTRON_RUN_AS_NODE=1"로 띄우면 Node처럼 동작함.
  server = spawn(process.execPath, [serverEntry], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
    },
    windowsHide: true,
  });

  server.stdout.on("data", (data) => console.log(`[server] ${data}`));
  server.stderr.on("data", (data) => console.error(`[server] ${data}`));
  server.on("error", (err) => console.error("[server] failed to start:", err));
}

function waitForServer(timeoutMs = 30000, intervalMs = 400) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(`http://127.0.0.1:${PORT}`, (res) => {
        res.destroy();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error("서버가 제한 시간 안에 켜지지 않았습니다."));
        } else {
          setTimeout(tryOnce, intervalMs);
        }
      });
    };
    tryOnce();
  });
}

async function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    await waitForServer();
    win.loadURL(`http://127.0.0.1:${PORT}`);
  } catch (err) {
    console.error(err);
    dialog.showErrorBox(
      "서버 시작 실패",
      "내부 서버를 켜는 데 실패했습니다.\n" + err.message
    );
  }
}

app.whenReady().then(() => {
  startServer();
  createWindow();
});

app.on("window-all-closed", () => {
  if (server) server.kill();
  app.quit();
});

app.on("before-quit", () => {
  if (server) server.kill();
});
