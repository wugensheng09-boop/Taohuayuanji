/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, dialog } = require("electron");
const { appendFileSync, existsSync, mkdirSync } = require("node:fs");
const { fork } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");

const APP_NAME = "入画文游";
const SERVER_START_TIMEOUT_MS = 60000;

let mainWindow = null;
let serverProcess = null;
let appUrl = null;
let appIsQuitting = false;
let logFilePath = null;

function resolveLogFilePath() {
  if (logFilePath) {
    return logFilePath;
  }

  try {
    const logDir = path.join(app.getPath("userData"), "logs");
    mkdirSync(logDir, { recursive: true });
    logFilePath = path.join(logDir, "desktop-runtime.log");
    return logFilePath;
  } catch {
    return null;
  }
}

function writeLog(message) {
  try {
    const target = resolveLogFilePath();
    if (!target) return;
    appendFileSync(target, `[${new Date().toISOString()}] ${message}\n`, "utf8");
  } catch {
    // ignore logging failures
  }
}

function getProjectRoot() {
  return path.join(__dirname, "..");
}

function getRuntimeDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "app-runtime");
  }
  return path.join(getProjectRoot(), ".next", "standalone");
}

function getPackagedNodePath() {
  if (!app.isPackaged) {
    return null;
  }
  return path.join(getRuntimeDir(), "runtime-deps");
}

function getServerEntry() {
  return path.join(getRuntimeDir(), "server.js");
}

function getConfiguredPort() {
  const raw = process.env.DESKTOP_PORT?.trim();
  if (!raw) {
    return null;
  }

  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    return null;
  }

  return port;
}

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("failed-to-resolve-port")));
        return;
      }

      const port = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function waitForServer(url, timeoutMs = SERVER_START_TIMEOUT_MS) {
  const startedAt = Date.now();
  writeLog(`waitForServer:start url=${url} timeoutMs=${timeoutMs}`);

  while (Date.now() - startedAt < timeoutMs) {
    if (serverProcess && serverProcess.exitCode !== null) {
      writeLog(`waitForServer:server-exited-early code=${serverProcess.exitCode}`);
      throw new Error(`server-exited-early:${serverProcess.exitCode}`);
    }

    try {
      const response = await fetch(`${url}/api/health`, {
        method: "GET",
        cache: "no-store",
      });
      if (response.ok) {
        writeLog(`waitForServer:healthy status=${response.status}`);
        return;
      }
    } catch {
      // Keep polling until the server is ready.
    }

    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  writeLog("waitForServer:timeout");
  throw new Error("server-start-timeout");
}

function stopServer() {
  if (!serverProcess || serverProcess.killed) {
    return;
  }

  writeLog("stopServer:kill");
  serverProcess.kill();
  setTimeout(() => {
    if (serverProcess && !serverProcess.killed) {
      writeLog("stopServer:sigkill");
      serverProcess.kill("SIGKILL");
    }
  }, 3000).unref();
}

async function ensureAppUrl() {
  if (appUrl) {
    return appUrl;
  }

  if (!app.isPackaged && process.env.NEXT_DESKTOP_DEV_URL) {
    appUrl = process.env.NEXT_DESKTOP_DEV_URL;
    return appUrl;
  }

  const runtimeDir = getRuntimeDir();
  const serverEntry = getServerEntry();
  writeLog(`ensureAppUrl:runtimeDir=${runtimeDir}`);
  writeLog(`ensureAppUrl:serverEntry=${serverEntry}`);

  if (!existsSync(serverEntry)) {
    writeLog("ensureAppUrl:missing-server-entry");
    throw new Error(`missing-server-entry:${serverEntry}`);
  }

  const port = getConfiguredPort() ?? (await findAvailablePort());
  const packagedNodePath = getPackagedNodePath();
  writeLog(`ensureAppUrl:port=${port}`);
  writeLog(`ensureAppUrl:nodePath=${packagedNodePath ?? "none"}`);

  serverProcess = fork(serverEntry, [], {
    cwd: runtimeDir,
    env: {
      ...process.env,
      NODE_ENV: "production",
      ...(packagedNodePath ? { NODE_PATH: packagedNodePath } : {}),
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      APP_RUNTIME_DIR: runtimeDir,
      NEXT_TELEMETRY_DISABLED: "1",
    },
    silent: true,
  });

  serverProcess.stdout?.on("data", (chunk) => {
    writeLog(`server:stdout ${String(chunk).trim()}`);
  });
  serverProcess.stderr?.on("data", (chunk) => {
    writeLog(`server:stderr ${String(chunk).trim()}`);
  });
  serverProcess.on("error", (error) => {
    writeLog(`server:error ${error instanceof Error ? error.message : String(error)}`);
  });
  serverProcess.on("exit", (code) => {
    writeLog(`server:exit code=${code ?? "unknown"}`);
    if (!appIsQuitting && code !== 0) {
      dialog.showErrorBox(APP_NAME, `内置服务异常退出，退出码：${code ?? "unknown"}`);
    }
  });

  appUrl = `http://127.0.0.1:${port}`;
  await waitForServer(appUrl);
  return appUrl;
}

async function createMainWindow() {
  const targetUrl = await ensureAppUrl();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#120a05",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(targetUrl);
}

app.whenReady().then(async () => {
  try {
    app.setName(APP_NAME);
    writeLog("app:ready");
    await createMainWindow();
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown-error";
    writeLog(`app:start-failed ${message}`);
    dialog.showErrorBox(APP_NAME, `桌面应用启动失败：${message}`);
    app.quit();
  }

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("before-quit", () => {
  appIsQuitting = true;
  stopServer();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
