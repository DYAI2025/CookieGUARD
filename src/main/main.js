const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { AgentRegistry } = require('../services/agentRegistry');
const { ChatOrchestrator } = require('../services/chatOrchestrator');

// Initialisiere persistenten Store
const store = new Store();

// Globale Referenzen
let mainWindow;
let agentRegistry;
let chatOrchestrator;

// Entwicklungsmodus erkennen
const isDev = process.argv.includes('--dev');

function createWindow() {
  // Hauptfenster erstellen
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../../assets/icon.png'),
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1e1e1e'
  });

  // HTML laden
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // DevTools im Entwicklungsmodus öffnen
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Fenster-Events
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Menü erstellen
  createMenu();
}

function createMenu() {
  const isMac = process.platform === 'darwin';
  
  const template = [
    // App-Menü (nur auf Mac)
    ...(isMac ? [{
      label: app.getName(),
      submenu: [
        { label: 'Über Multi-AI Desktop', role: 'about' },
        { type: 'separator' },
        { label: 'Einstellungen', accelerator: 'Cmd+,', click: () => openSettings() },
        { type: 'separator' },
        { role: 'services', submenu: [] },
        { type: 'separator' },
        { label: 'Multi-AI Desktop ausblenden', role: 'hide' },
        { label: 'Andere ausblenden', role: 'hideOthers' },
        { label: 'Alle anzeigen', role: 'unhide' },
        { type: 'separator' },
        { label: 'Beenden', role: 'quit' }
      ]
    }] : []),
    
    // Bearbeiten-Menü (WICHTIG für Copy&Paste!)
    {
      label: 'Bearbeiten',
      submenu: [
        { label: 'Rückgängig', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Wiederholen', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Ausschneiden', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Kopieren', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Einfügen', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Alles auswählen', accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
        { type: 'separator' },
        { label: 'Suchen', accelerator: 'CmdOrCtrl+F', role: 'find' }
      ]
    },
    
    // Projekt-Menü
    {
      label: 'Projekt',
      submenu: [
        { label: 'Neues Projekt', accelerator: 'CmdOrCtrl+N', click: () => createNewProject() },
        { label: 'Projekt öffnen', accelerator: 'CmdOrCtrl+O', click: () => openProject() },
        { label: 'Projekt speichern', accelerator: 'CmdOrCtrl+S', click: () => saveProject() },
        { type: 'separator' },
        { label: 'Exportieren...', click: () => exportProject() }
      ]
    },
    
    // Agenten-Menü
    {
      label: 'Agenten',
      submenu: [
        { label: 'Agent hinzufügen', accelerator: 'CmdOrCtrl+Shift+A', click: () => addAgent() },
        { label: 'Agenten verwalten', click: () => manageAgents() },
        { type: 'separator' },
        { label: 'Cursor Cloud verbinden', click: () => connectCursorCloud() }
      ]
    },
    
    // Ansicht-Menü
    {
      label: 'Ansicht',
      submenu: [
        { label: 'Neu laden', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Erzwungenes Neuladen', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { label: 'Entwicklertools', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Tatsächliche Größe', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: 'Vergrößern', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Verkleinern', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Vollbild', role: 'togglefullscreen' }
      ]
    },
    
    // Fenster-Menü
    {
      label: 'Fenster',
      submenu: [
        { label: 'Minimieren', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
        { label: 'Schließen', accelerator: 'CmdOrCtrl+W', role: 'close' },
        ...(isMac ? [
          { type: 'separator' },
          { label: 'Alle nach vorne bringen', role: 'front' }
        ] : [])
      ]
    },
    
    // Hilfe-Menü
    {
      label: 'Hilfe',
      submenu: [
        {
          label: 'Dokumentation',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com/yourusername/multi-ai-desktop');
          }
        },
        { type: 'separator' },
        { label: 'Über Multi-AI Desktop', role: 'about' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App-Events
app.whenReady().then(() => {
  // Services initialisieren
  agentRegistry = new AgentRegistry(store);
  chatOrchestrator = new ChatOrchestrator(agentRegistry);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC-Handler für Renderer-Kommunikation
ipcMain.handle('get-agents', async () => {
  return agentRegistry.getAllAgents();
});

ipcMain.handle('add-agent', async (event, agentConfig) => {
  return agentRegistry.addAgent(agentConfig);
});

ipcMain.handle('remove-agent', async (event, agentId) => {
  return agentRegistry.removeAgent(agentId);
});

ipcMain.handle('send-message', async (event, { message, selectedAgents, projectId }) => {
  return chatOrchestrator.processMessage(message, selectedAgents, projectId);
});

ipcMain.handle('get-projects', async () => {
  return store.get('projects', []);
});

ipcMain.handle('save-project', async (event, project) => {
  const projects = store.get('projects', []);
  const index = projects.findIndex(p => p.id === project.id);
  
  if (index >= 0) {
    projects[index] = project;
  } else {
    projects.push(project);
  }
  
  store.set('projects', projects);
  return project;
});

// Hilfsfunktionen für Menü-Actions
function openSettings() {
  mainWindow.webContents.send('open-settings');
}

function createNewProject() {
  mainWindow.webContents.send('create-new-project');
}

function openProject() {
  mainWindow.webContents.send('open-project');
}

function saveProject() {
  mainWindow.webContents.send('save-project');
}

function exportProject() {
  mainWindow.webContents.send('export-project');
}

function addAgent() {
  mainWindow.webContents.send('add-agent');
}

function manageAgents() {
  mainWindow.webContents.send('manage-agents');
}

function connectCursorCloud() {
  mainWindow.webContents.send('connect-cursor-cloud');
} 