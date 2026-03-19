import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, screen, Tray } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.join(__dirname, "..");
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const SETTINGS_PATH = path.join(app.getPath("userData"), "widget-settings.json");
const DEFAULT_SETTINGS = {
  position: null,
  launchAtLogin: false,
};

let widgetWindow = null;
let tray = null;
let isQuitting = false;
let settings = { ...DEFAULT_SETTINGS };

async function loadSettings() {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf8");
    settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    settings = {
      ...DEFAULT_SETTINGS,
      launchAtLogin: app.getLoginItemSettings().openAtLogin,
    };
  }
}

async function saveSettings() {
  try {
    await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
    await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf8");
  } catch {
    // Ignore settings persistence issues.
  }
}

function isPositionVisible(bounds) {
  if (!bounds) return false;
  return screen.getAllDisplays().some((display) => {
    const area = display.workArea;
    return (
      bounds.x >= area.x &&
      bounds.y >= area.y &&
      bounds.x + bounds.width <= area.x + area.width &&
      bounds.y + bounds.height <= area.y + area.height
    );
  });
}

function getDefaultBounds(win) {
  if (!win) return;
  const display = screen.getPrimaryDisplay();
  const { x, y, height } = display.workArea;
  const [width, windowHeight] = win.getSize();
  const margin = 22;
  return {
    x: x + margin,
    y: y + height - windowHeight - margin,
    width,
    height: windowHeight,
  };
}

function positionWidget(win, forceDefault = false) {
  if (!win) return;
  const preferred = !forceDefault && isPositionVisible(settings.position)
    ? settings.position
    : getDefaultBounds(win);
  win.setPosition(preferred.x, preferred.y, false);
  win.setAlwaysOnTop(true, "screen-saver");
}

function updateLaunchAtLogin(enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
  });
  settings.launchAtLogin = enabled;
  void saveSettings();
  refreshTrayMenu();
}

function showWidget() {
  if (!widgetWindow) {
    createWindow();
    return;
  }
  widgetWindow.show();
  widgetWindow.focus();
  widgetWindow.setAlwaysOnTop(true, "screen-saver");
}

function hideWidget() {
  widgetWindow?.hide();
}

function createTrayIcon() {
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#8b5cf6"/>
          <stop offset="100%" stop-color="#38bdf8"/>
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="52" height="52" rx="18" fill="url(#g)"/>
      <rect x="10" y="10" width="44" height="44" rx="16" fill="#09111d"/>
      <path d="M22 39V23h9.5c5.5 0 9 2.8 9 7.6 0 4.9-3.5 8.4-9.3 8.4H22Zm6-5h3c2.4 0 3.8-1.3 3.8-3.3 0-2-1.3-3.1-3.8-3.1h-3V34Z" fill="#eef5ff"/>
    </svg>
  `);
  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=UTF-8,${svg}`);
}

function refreshTrayMenu() {
  if (!tray) return;
  const visible = widgetWindow?.isVisible() ?? false;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: visible ? "Hide Widget" : "Show Widget", click: () => (visible ? hideWidget() : showWidget()) },
      { type: "separator" },
      {
        label: "Launch At Login",
        type: "checkbox",
        checked: Boolean(settings.launchAtLogin),
        click: (item) => updateLaunchAtLogin(item.checked),
      },
      { type: "separator" },
      { label: "Quit", click: () => { isQuitting = true; app.quit(); } },
    ]),
  );
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip("Reeza Buddy");
  tray.on("click", () => {
    if (widgetWindow?.isVisible()) hideWidget();
    else showWidget();
    refreshTrayMenu();
  });
  refreshTrayMenu();
}

function createWindow() {
  widgetWindow = new BrowserWindow({
    width: 260,
    height: 300,
    minWidth: 240,
    minHeight: 280,
    maxWidth: 300,
    maxHeight: 360,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    fullscreenable: false,
    maximizable: false,
    minimizable: false,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  positionWidget(widgetWindow);

  if (DEV_SERVER_URL) {
    widgetWindow.loadURL(DEV_SERVER_URL);
  } else {
    widgetWindow.loadFile(path.join(APP_ROOT, "dist", "index.html"));
  }

  widgetWindow.on("closed", () => {
    widgetWindow = null;
    refreshTrayMenu();
  });

  widgetWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    widgetWindow.hide();
    refreshTrayMenu();
  });

  widgetWindow.on("show", () => {
    refreshTrayMenu();
  });

  widgetWindow.on("hide", () => {
    refreshTrayMenu();
  });

  widgetWindow.on("moved", () => {
    if (!widgetWindow) return;
    const [x, y] = widgetWindow.getPosition();
    const [width, height] = widgetWindow.getSize();
    settings.position = { x, y, width, height };
    void saveSettings();
  });
}

app.whenReady().then(async () => {
  await loadSettings();
  updateLaunchAtLogin(Boolean(settings.launchAtLogin));
  createWindow();
  createTray();

  screen.on("display-metrics-changed", () => {
    positionWidget(widgetWindow, !isPositionVisible(settings.position));
  });

  screen.on("display-added", () => {
    positionWidget(widgetWindow, !isPositionVisible(settings.position));
  });

  screen.on("display-removed", () => {
    positionWidget(widgetWindow, !isPositionVisible(settings.position));
  });

  app.on("activate", () => {
    if (!widgetWindow) createWindow();
    else showWidget();
  });
});

app.on("window-all-closed", () => {
  // Keep the app alive in the tray.
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("second-instance", () => {
  showWidget();
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

ipcMain.handle("widget:pick-avatar", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Choose an avatar image",
    properties: ["openFile"],
    filters: [
      { name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] },
    ],
  });

  if (canceled || !filePaths[0]) return null;

  const filePath = filePaths[0];
  const ext = path.extname(filePath).slice(1).toLowerCase() || "png";
  const mimeType = ext === "jpg" ? "jpeg" : ext;
  const buffer = await fs.readFile(filePath);

  return {
    name: path.basename(filePath),
    dataUrl: `data:image/${mimeType};base64,${buffer.toString("base64")}`,
  };
});

ipcMain.handle("widget:get-settings", () => ({
  launchAtLogin: Boolean(settings.launchAtLogin),
}));

ipcMain.handle("widget:set-launch-at-login", async (_event, enabled) => {
  updateLaunchAtLogin(Boolean(enabled));
  return { launchAtLogin: Boolean(settings.launchAtLogin) };
});

ipcMain.handle("widget:hide", () => {
  hideWidget();
  refreshTrayMenu();
});
