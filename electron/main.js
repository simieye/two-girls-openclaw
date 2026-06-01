/**
 * Two Girls Brew - macOS 桌面应用
 * Electron 主进程
 */
const { app, BrowserWindow, Menu, Tray, nativeImage, shell, dialog, globalShortcut } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow = null;
let tray = null;
let serverProcess = null;
const SERVER_PORT = 3456;
const isDev = !app.isPackaged;

// 获取关键路径（打包后和开发环境不同）
function getLayersPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'src', 'agents', 'layers');
  }
  return path.join(process.resourcesPath, 'agents', 'layers');
}

function getPublicPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'public');
  }
  return path.join(process.resourcesPath, 'app.asar', 'public');
}

function getServerPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'src', 'server.js');
  }
  return path.join(process.resourcesPath, 'app.asar', 'src', 'server.js');
}

// 启动后台服务器
function startServer() {
  return new Promise((resolve, reject) => {
    const serverPath = getServerPath();
    const layersPath = getLayersPath();
    const publicPath = getPublicPath();

    console.log('[Main] Server path:', serverPath);
    console.log('[Main] Layers path:', layersPath);
    console.log('[Main] Public path:', publicPath);
    console.log('[Main] Is packaged:', app.isPackaged);

    serverProcess = fork(serverPath, [], {
      env: {
        ...process.env,
        PORT: String(SERVER_PORT),
        LAYERS_PATH: layersPath,
        PUBLIC_PATH: publicPath
      },
      silent: true
    });

    serverProcess.stdout.on('data', (data) => {
      const msg = data.toString();
      console.log('[Server]', msg.trim());
      if (msg.includes('后台管理系统已启动') || msg.includes('已启动')) {
        resolve(true);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('[Server Error]', data.toString());
    });

    serverProcess.on('error', (err) => {
      console.error('[Server Process Error]', err);
      reject(err);
    });

    serverProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`[Server] Exited with code ${code}`);
      }
    });

    // 超时回退
    setTimeout(() => resolve(true), 5000);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Two Girls Brew - AI搭档后台',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0a1a',
    show: false
  });

  mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 在外部浏览器中打开链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function createTray() {
  // 使用简单的 16x16 PNG 图标
  const iconPath = path.join(__dirname, 'tray-icon.png');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      trayIcon = nativeImage.createEmpty();
    }
  } catch (e) {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Two Girls Brew AI 搭档');

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => { if (mainWindow) mainWindow.show(); } },
    { label: '隐藏窗口', click: () => { if (mainWindow) mainWindow.hide(); } },
    { type: 'separator' },
    {
      label: '在浏览器中打开',
      click: () => { shell.openExternal(`http://localhost:${SERVER_PORT}`); }
    },
    { type: 'separator' },
    {
      label: '关于 Two Girls Brew',
      click: () => {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: '关于 Two Girls Brew',
          message: 'Two Girls Brew AI 搭档系统 v3.2',
          detail: '9智能体 × 6层 = 54知识模块\n全流程自动化运营管理\n\nBuilt with ❤️ for Two Girls Brew\nEst.2012 · 厦门',
          buttons: ['确定']
        });
      }
    },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });
}

function createMenu() {
  const template = [
    {
      label: 'Two Girls Brew',
      submenu: [
        { label: '关于 Two Girls Brew', role: 'about' },
        { type: 'separator' },
        { label: '在浏览器中打开', click: () => shell.openExternal(`http://localhost:${SERVER_PORT}`) },
        { type: 'separator' },
        { label: '隐藏', role: 'hide' },
        { label: '隐藏其他', role: 'hideOthers' },
        { label: '显示全部', role: 'unhide' },
        { type: 'separator' },
        { label: '退出', accelerator: 'Cmd+Q', click: () => app.quit() }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'Cmd+Z', role: 'undo' },
        { label: '重做', accelerator: 'Shift+Cmd+Z', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', accelerator: 'Cmd+X', role: 'cut' },
        { label: '复制', accelerator: 'Cmd+C', role: 'copy' },
        { label: '粘贴', accelerator: 'Cmd+V', role: 'paste' },
        { label: '全选', accelerator: 'Cmd+A', role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', accelerator: 'Cmd+R', role: 'reload' },
        { label: '强制重新加载', accelerator: 'Shift+Cmd+R', role: 'forceReload' },
        { label: '开发者工具', accelerator: 'Alt+Cmd+I', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '放大', accelerator: 'Cmd+Plus', role: 'zoomIn' },
        { label: '缩小', accelerator: 'Cmd+-', role: 'zoomOut' },
        { label: '实际大小', accelerator: 'Cmd+0', role: 'resetZoom' },
        { type: 'separator' },
        { label: '全屏', accelerator: 'Ctrl+Cmd+F', role: 'togglefullscreen' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { label: '最小化', accelerator: 'Cmd+M', role: 'minimize' },
        { label: '关闭', accelerator: 'Cmd+W', role: 'close' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '项目文档',
          click: () => shell.openExternal('https://github.com')
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 应用生命周期
app.whenReady().then(async () => {
  createMenu();

  // 启动后端服务器
  console.log('🍺 启动 Two Girls Brew 后台服务...');
  try {
    await startServer();
    console.log('✅ 后台服务启动成功');
  } catch (err) {
    console.error('❌ 后台服务启动失败:', err);
    dialog.showErrorBox('启动失败', `后台服务启动失败: ${err.message}`);
  }

  createWindow();
  createTray();

  // 注册全局快捷键
  globalShortcut.register('Cmd+Shift+B', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  // macOS 下不退出应用，保持托盘运行
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // 清理
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
  globalShortcut.unregisterAll();
});

app.on('will-quit', () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
});
