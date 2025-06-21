// API-Wrapper für die Kommunikation mit dem Main-Prozess
const api = {
  // Agent-Management
  agents: {
    getAll: async () => {
      try {
        return await window.multiAI.getAgents();
      } catch (error) {
        console.error('Fehler beim Abrufen der Agenten:', error);
        return [];
      }
    },

    add: async (agentConfig) => {
      try {
        return await window.multiAI.addAgent(agentConfig);
      } catch (error) {
        console.error('Fehler beim Hinzufügen des Agenten:', error);
        throw error;
      }
    },

    remove: async (agentId) => {
      try {
        return await window.multiAI.removeAgent(agentId);
      } catch (error) {
        console.error('Fehler beim Entfernen des Agenten:', error);
        throw error;
      }
    }
  },

  // Chat-Funktionen
  chat: {
    sendMessage: async (message, selectedAgents, projectId) => {
      try {
        return await window.multiAI.sendMessage({
          message,
          selectedAgents,
          projectId
        });
      } catch (error) {
        console.error('Fehler beim Senden der Nachricht:', error);
        throw error;
      }
    }
  },

  // Projekt-Management
  projects: {
    getAll: async () => {
      try {
        return await window.multiAI.getProjects();
      } catch (error) {
        console.error('Fehler beim Abrufen der Projekte:', error);
        return [];
      }
    },

    save: async (project) => {
      try {
        return await window.multiAI.saveProject(project);
      } catch (error) {
        console.error('Fehler beim Speichern des Projekts:', error);
        throw error;
      }
    }
  },

  // Event-Listener
  on: (event, callback) => {
    window.multiAI.on(event, callback);
  },

  removeListener: (event, callback) => {
    window.multiAI.removeListener(event, callback);
  }
};

// Utility-Funktionen
const utils = {
  // Formatiere Zeitstempel
  formatTime: (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  // Formatiere Datum
  formatDate: (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  },

  // Generiere eindeutige ID
  generateId: () => {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  // Escape HTML
  escapeHtml: (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // Parse Markdown (einfache Version)
  parseMarkdown: (text) => {
    return text
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Code blocks
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      // Inline code
      .replace(/`(.*?)`/g, '<code>$1</code>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      // Line breaks
      .replace(/\n/g, '<br>');
  },

  // Debounce-Funktion
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Local Storage Wrapper
  storage: {
    get: (key, defaultValue = null) => {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      } catch (error) {
        console.error('Fehler beim Lesen aus Local Storage:', error);
        return defaultValue;
      }
    },

    set: (key, value) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.error('Fehler beim Schreiben in Local Storage:', error);
      }
    },

    remove: (key) => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error('Fehler beim Löschen aus Local Storage:', error);
      }
    }
  },

  // Zeige Benachrichtigung
  showNotification: (message, type = 'info') => {
    // TODO: Implementiere Toast-Benachrichtigungen
    console.log(`[${type.toUpperCase()}] ${message}`);
  },

  // Kopiere Text in Zwischenablage
  copyToClipboard: async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      utils.showNotification('In Zwischenablage kopiert', 'success');
    } catch (error) {
      console.error('Fehler beim Kopieren:', error);
      utils.showNotification('Kopieren fehlgeschlagen', 'error');
    }
  }
};

// Model-Konfigurationen
const modelConfigs = {
  openai: {
    models: [
      { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo' },
      { id: 'gpt-4', name: 'GPT-4' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
      { id: 'gpt-3.5-turbo-16k', name: 'GPT-3.5 Turbo 16K' }
    ]
  },
  anthropic: {
    models: [
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
      { id: 'claude-2.1', name: 'Claude 2.1' }
    ]
  },
  google: {
    models: [
      { id: 'gemini-pro', name: 'Gemini Pro' },
      { id: 'gemini-pro-vision', name: 'Gemini Pro Vision' }
    ]
  },
  cursor: {
    models: [
      { id: 'cursor-fast', name: 'Cursor Fast' },
      { id: 'cursor-slow', name: 'Cursor Slow' },
      { id: 'gpt-4', name: 'GPT-4 (via Cursor)' },
      { id: 'claude-3-opus', name: 'Claude 3 Opus (via Cursor)' }
    ]
  }
};

// Exportiere API und Utilities
window.api = api;
window.utils = utils;
window.modelConfigs = modelConfigs; 