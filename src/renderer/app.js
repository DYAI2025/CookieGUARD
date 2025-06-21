// Haupt-App-Initialisierung
document.addEventListener('DOMContentLoaded', () => {
  console.log('Multi-AI Desktop wird initialisiert...');
  
  // Initialisiere Settings
  initializeSettings();
  
  // Setup Modal-Schließen bei Klick außerhalb
  setupModalHandlers();
  
  // Setup Keyboard Shortcuts
  setupKeyboardShortcuts();
  
  // Enable Copy&Paste in Modals
  enableModalCopyPaste();
  
  console.log('Multi-AI Desktop bereit!');
});

// Settings-Initialisierung
function initializeSettings() {
  const settingsBtn = document.getElementById('btnSettings');
  const settingsModal = document.getElementById('settingsModal');
  const themeSelect = document.getElementById('themeSelect');
  
  // Settings Button
  settingsBtn.addEventListener('click', () => {
    showModal('settingsModal');
  });
  
  // Theme-Auswahl
  const savedTheme = utils.storage.get('theme', 'dark');
  themeSelect.value = savedTheme;
  applyTheme(savedTheme);
  
  themeSelect.addEventListener('change', (e) => {
    applyTheme(e.target.value);
  });
  
  // IPC Event
  api.on('open-settings', () => {
    showModal('settingsModal');
  });
}

// Theme anwenden
function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.style.setProperty('--bg-primary', '#ffffff');
    document.documentElement.style.setProperty('--bg-secondary', '#f5f5f5');
    document.documentElement.style.setProperty('--bg-tertiary', '#e8e8e8');
    document.documentElement.style.setProperty('--text-primary', '#1a1a1a');
    document.documentElement.style.setProperty('--text-secondary', '#666666');
    document.documentElement.style.setProperty('--border-color', '#d0d0d0');
  } else if (theme === 'dark') {
    // Zurück zu Standard Dark Theme
    document.documentElement.style.setProperty('--bg-primary', '#1e1e1e');
    document.documentElement.style.setProperty('--bg-secondary', '#252526');
    document.documentElement.style.setProperty('--bg-tertiary', '#2d2d30');
    document.documentElement.style.setProperty('--text-primary', '#cccccc');
    document.documentElement.style.setProperty('--text-secondary', '#969696');
    document.documentElement.style.setProperty('--border-color', '#464647');
  }
  
  utils.storage.set('theme', theme);
}

// Settings speichern
window.saveSettings = function() {
  const maxContextMessages = document.getElementById('maxContextMessages').value;
  utils.storage.set('maxContextMessages', parseInt(maxContextMessages));
  
  closeModal('settingsModal');
  utils.showNotification('Einstellungen gespeichert', 'success');
};

// Modal-Handler
function setupModalHandlers() {
  // Schließe Modal bei Klick außerhalb
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('show');
      }
    });
  });
  
  // ESC-Taste schließt Modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal.show').forEach(modal => {
        modal.classList.remove('show');
      });
    }
  });
}

// Keyboard Shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + N: Neues Projekt
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault();
      window.projectsManager.createNewProject();
    }
    
    // Cmd/Ctrl + S: Projekt speichern
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      window.projectsManager.saveCurrentProject();
    }
    
    // Cmd/Ctrl + Shift + A: Agent hinzufügen
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'A') {
      e.preventDefault();
      window.agentsManager.showAddAgentModal();
    }
    
    // Cmd/Ctrl + ,: Einstellungen
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault();
      showModal('settingsModal');
    }
  });
}

// Enable Copy&Paste in Modals
function enableModalCopyPaste() {
  // Füge spezielle Event-Handler für Copy&Paste in Modals hinzu
  document.addEventListener('keydown', (e) => {
    // Prüfe ob wir in einem Modal sind
    const activeModal = document.querySelector('.modal.show');
    if (!activeModal) return;
    
    // Prüfe ob ein Input/Textarea fokussiert ist
    const activeElement = document.activeElement;
    const isInputField = activeElement && (
      activeElement.tagName === 'INPUT' || 
      activeElement.tagName === 'TEXTAREA'
    );
    
    if (!isInputField) return;
    
    // Copy (Cmd/Ctrl + C)
    if ((e.metaKey || e.ctrlKey) && e.key === 'c' && !e.shiftKey) {
      e.stopPropagation();
      document.execCommand('copy');
    }
    
    // Cut (Cmd/Ctrl + X)
    if ((e.metaKey || e.ctrlKey) && e.key === 'x' && !e.shiftKey) {
      e.stopPropagation();
      document.execCommand('cut');
    }
    
    // Paste (Cmd/Ctrl + V)
    if ((e.metaKey || e.ctrlKey) && e.key === 'v' && !e.shiftKey) {
      e.stopPropagation();
      navigator.clipboard.readText().then(text => {
        if (text) {
          // Insert text at cursor position
          const start = activeElement.selectionStart;
          const end = activeElement.selectionEnd;
          const value = activeElement.value;
          activeElement.value = value.substring(0, start) + text + value.substring(end);
          activeElement.selectionStart = activeElement.selectionEnd = start + text.length;
          
          // Trigger input event
          activeElement.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    }
    
    // Select All (Cmd/Ctrl + A)
    if ((e.metaKey || e.ctrlKey) && e.key === 'a' && !e.shiftKey) {
      e.stopPropagation();
      activeElement.select();
    }
  }, true); // Use capture phase
}

// Auto-Save alle 5 Minuten
setInterval(() => {
  if (window.projectsManager?.currentProject) {
    window.projectsManager.saveCurrentProject();
  }
}, 5 * 60 * 1000);

// Warnung vor dem Schließen bei ungespeicherten Änderungen
window.addEventListener('beforeunload', (e) => {
  if (window.chatManager?.messages.length > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// Error Handler
window.addEventListener('error', (e) => {
  console.error('Globaler Fehler:', e.error);
  utils.showNotification('Ein Fehler ist aufgetreten', 'error');
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unbehandelte Promise-Ablehnung:', e.reason);
  utils.showNotification('Ein Fehler ist aufgetreten', 'error');
}); 