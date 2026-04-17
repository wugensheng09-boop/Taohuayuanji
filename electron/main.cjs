/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, dialog } = require("electron");
const { existsSync } = require("node:fs");
const { fork } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");

let mainWindow = null;
let serverProcess = null;
let appUrl = null;
let appIsQuitting = false;

function getProjectRoot() {
  return path.join(__dirname, "..");
}

function getRuntimeDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "app-runtime");
  }
  return path.join(getProjectRoot(), ".next", "standalone");
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

async function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (serverProcess && serverProcess.exitCode !== null) {
      throw new Error(`server-exited-early:${serverProcess.exitCode}`);
    }

    try {
      const response = await fetch(`${url}/api/health`, {
        method: "GET",
        cache: "no-store",
      });
      if (response.ok) {
        return;
      }
    } catch {
      // keep polling until the server is ready
    }

    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  throw new Error("server-start-timeout");
}

function stopServer() {
  if (!serverProcess || serverProcess.killed) {
    return;
  }

  serverProcess.kill();
  setTimeout(() => {
    if (serverProcess && !serverProcess.killed) {
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
  if (!existsSync(serverEntry)) {
    throw new Error(`missing-server-entry:${serverEntry}`);
  }

  const port = getConfiguredPort() ?? (await findAvailablePort());
  serverProcess = fork(serverEntry, [], {
    cwd: runtimeDir,
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      APP_RUNTIME_DIR: runtimeDir,
      NEXT_TELEMETRY_DISABLED: "1"
    },
    stdio: "inherit"
  });

  serverProcess.on("exit", (code) => {
    if (!appIsQuitting && code !== 0) {
      dialog.showErrorBox("课本世界穿越器", `内置服务异常退出，退出码：${code ?? "unknown"}`);
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
      sandbox: false
    }
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
    await createMainWindow();
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown-error";
    dialog.showErrorBox("课本世界穿越器", `桌面应用启动失败：${message}`);
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
