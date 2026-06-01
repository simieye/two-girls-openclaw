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
let serverRestartAttempts = 0;
const SERVER_PORT = 3456;
const MAX_RESTART_ATTEMPTS = 3;
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

    let resolved = false;

    serverProcess.stdout.on('data', (data) => {
      const msg = data.toString();
      console.log('[Server]', msg.trim());
      if (!resolved && (msg.includes('后台管理系统已启动') || msg.includes('已启动'))) {
        resolved = true;
        serverRestartAttempts = 0;
        resolve(true);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('[Server Error]', data.toString());
    });

    serverProcess.on('error', (err) => {
      console.error('[Server Process Error]', err);
      if (!resolved) reject(err);
    });

    serverProcess.on('exit', (code, signal) => {
      console.log(`[Server] Exited with code ${code}, signal ${signal}`);
      // 如果非正常退出且未resolve，尝试重启
      if (!resolved && code !== 0 && code !== null) {
        serverRestartAttempts++;
        if (serverRestartAttempts <= MAX_RESTART_ATTEMPTS) {
          console.log(`[Main] 🔄 服务器异常退出，尝试重启 (${serverRestartAttempts}/${MAX_RESTART_ATTEMPTS})...`);
          // 等待1秒后重启
          setTimeout(() => {
            startServer().then(() => {
              console.log('[Main] ✅ 服务器重启成功');
              if (mainWindow) {
                mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);
              }
            }).catch(err => {
              console.error('[Main] ❌ 服务器重启失败:', err.message);
              if (!resolved) reject(err);
            });
          }, 1000);
        } else {
          console.error(`[Main] ❌ 服务器重启失败，已达最大重试次数 (${MAX_RESTART_ATTEMPTS})`);
          if (!resolved) {
            reject(new Error('服务器多次重启失败，请检查端口是否被占用'));
          }
        }
      }
    });

    // 超时回退
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(true);
      }
    }, 5000);
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
      sandbox: false,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0a1a',
    show: true  // 直接显示，不要等待 ready-to-show
  });

  mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);

  let loadFinished = false;

  // 页面加载完成
  mainWindow.webContents.on('did-finish-load', () => {
    loadFinished = true;
    console.log('[Main] ✅ 页面加载完成');
  });

  // 加载失败的兜底
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.log(`[Main] ⚠️ 页面加载失败: ${errorDescription}, URL: ${validatedURL}, 重试...`);
    if (!loadFinished) {
      setTimeout(() => {
        mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);
      }, 2000);
    }
  });

  // DOM准备好后的兜底显示
  mainWindow.webContents.on('dom-ready', () => {
    console.log('[Main] DOM ready');
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 在外部浏览器中打开链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 监听控制台消息（调试用）
  mainWindow.webContents.on('console-message', (event, level, message) => {
    if (message.includes('[Dashboard]') || message.includes('error') || message.includes('Error')) {
      console.log(`[Renderer] ${message}`);
    }
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
          message: 'Two Girls Brew AI 搭档系统 v3.3',
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

  // 预检：清理可能占用端口的旧进程
  console.log('🍺 启动 Two Girls Brew 后台服务...');
  try {
    // 尝试先清理端口
    if (!isDev) {
      const { execSync } = require('child_process');
      try {
        const result = execSync(`lsof -ti:${SERVER_PORT}`, { encoding: 'utf-8', timeout: 3000 }).trim();
        if (result) {
          const pids = result.split('\n').filter(p => p);
          console.log(`[Main] ⚠️ 端口 ${SERVER_PORT} 被进程占用: ${pids.join(', ')}，尝试释放...`);
          pids.forEach(pid => {
            try { process.kill(parseInt(pid), 'SIGTERM'); } catch (e) {}
          });
          // 等待端口释放
          await new Promise(r => setTimeout(r, 1500));
        }
      } catch (e) {
        // lsof 执行失败或端口空闲，忽略
      }
    }

    await startServer();
    console.log('✅ 后台服务启动成功');
  } catch (err) {
    console.error('❌ 后台服务启动失败:', err);
    dialog.showErrorBox('启动失败', `后台服务启动失败: ${err.message}\n\n请检查端口 ${SERVER_PORT} 是否被其他程序占用。`);
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
