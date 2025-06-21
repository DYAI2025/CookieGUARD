const { contextBridge, ipcRenderer } = require('electron');

// Exponiere sichere API für den Renderer-Prozess
contextBridge.exposeInMainWorld('multiAI', {
  // Agent-Management
  getAgents: () => ipcRenderer.invoke('get-agents'),
  addAgent: (agentConfig) => ipcRenderer.invoke('add-agent', agentConfig),
  removeAgent: (agentId) => ipcRenderer.invoke('remove-agent', agentId),
  
  // Chat-Funktionen
  sendMessage: (data) => ipcRenderer.invoke('send-message', data),
  
  // Projekt-Management
  getProjects: () => ipcRenderer.invoke('get-projects'),
  saveProject: (project) => ipcRenderer.invoke('save-project', project),
  
  // Event-Listener für Main-Process-Events
  on: (channel, callback) => {
    const validChannels = [
      'open-settings',
      'create-new-project',
      'open-project',
      'save-project',
      'export-project',
      'add-agent',
      'manage-agents',
      'connect-cursor-cloud',
      'chat-response',
      'agent-status-update'
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },
  
  // Event entfernen
  removeListener: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback);
  }
}); 