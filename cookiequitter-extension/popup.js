// 🤖 CookieQuitter - Rechtssichere UI mit manueller Website-Eingabe

class CookieQuitterUI {
  constructor() {
    this.websites = new Map(); // URL -> {status, preference, timestamp}
    this.isRunning = false;
    this.updateInterval = null;
    
    // DOM Elements
    this.elements = {
      websiteInput: document.getElementById('website-input'),
      addWebsite: document.getElementById('add-website'),
      websiteList: document.getElementById('website-list'),
      startBot: document.getElementById('start-bot'),
      stopBot: document.getElementById('stop-bot'),
      queueCount: document.getElementById('queue-count'),
      statusCard: document.getElementById('status-card'),
      statusIndicator: document.getElementById('status-indicator'),
      statusTitle: document.getElementById('status-title'),
      statusDetail: document.getElementById('status-detail'),
      progressContainer: document.getElementById('progress-container'),
      progressFill: document.getElementById('progress-fill'),
      progressText: document.getElementById('progress-text'),
      clearAll: document.getElementById('clear-all'),
      exportList: document.getElementById('export-list'),
      toast: document.getElementById('toast'),
      toastIcon: document.getElementById('toast-icon'),
      toastMessage: document.getElementById('toast-message')
    };
    
    this.initializeUI();
    this.bindEvents();
    this.loadWebsites();
    this.startStatusUpdates();
    
    console.log('🤖 CookieQuitter UI initialized (rechtssichere Version)');
  }

  initializeUI() {
    this.updateWebsiteList();
    this.updateBotControls(false);
    this.updateQueueCount();
  }

  bindEvents() {
    // Website hinzufügen
    this.elements.addWebsite.addEventListener('click', () => this.addWebsite());
    this.elements.websiteInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addWebsite();
    });
    
    // Quick-Add Buttons
    document.querySelectorAll('.quick-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (action === 'history') this.addFromHistory();
        if (action === 'bookmarks') this.addFromBookmarks();
      });
    });
    
    // Bot Controls
    this.elements.startBot.addEventListener('click', () => this.startBot());
    this.elements.stopBot.addEventListener('click', () => this.stopBot());
    
    // Actions
    this.elements.clearAll.addEventListener('click', () => this.clearAllWebsites());
    this.elements.exportList.addEventListener('click', () => this.exportWebsiteList());
  }

  // 🌐 Website hinzufügen
  addWebsite() {
    const url = this.elements.websiteInput.value.trim();
    
    if (!url) {
      this.showToast('⚠️ Bitte gib eine URL ein', 'warning');
      return;
    }
    
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      const domain = urlObj.hostname.replace('www.', '');
      
      if (this.websites.has(domain)) {
        this.showToast('⚠️ Website bereits in der Liste', 'warning');
        return;
      }
      
      // Rechtliche Validierung
      if (this.isRestrictedDomain(domain)) {
        this.showToast('❌ Diese Domain ist nicht erlaubt', 'error');
        return;
      }
      
      this.websites.set(domain, {
        url: urlObj.href,
        status: 'pending',
        preference: null,
        timestamp: Date.now()
      });
      
      this.elements.websiteInput.value = '';
      this.updateWebsiteList();
      this.updateQueueCount();
      this.saveWebsites();
      
      this.showToast(`✅ ${domain} hinzugefügt`, 'success');
      console.log(`✅ Website hinzugefügt: ${domain}`);
      
    } catch (error) {
      this.showToast('❌ Ungültige URL', 'error');
      console.error('Invalid URL:', error);
    }
  }

  // 🚫 Rechtliche Domain-Validierung
  isRestrictedDomain(domain) {
    const restricted = [
      'localhost', '127.0.0.1', '0.0.0.0',
      'chrome.google.com', 'chrome-extension://',
      'moz-extension://', 'about:', 'file:',
      'banking', 'paypal.com', 'amazon.com',
      'government', '.gov', '.mil'
    ];
    
    return restricted.some(r => domain.includes(r));
  }

  // 📊 Aus Browser-Verlauf hinzufügen
  async addFromHistory() {
    try {
      const history = await chrome.history.search({
        text: '',
        maxResults: 100,
        startTime: Date.now() - (7 * 24 * 60 * 60 * 1000) // Letzte 7 Tage
      });

      const domains = new Set();
      history.forEach(item => {
        try {
          const url = new URL(item.url);
          const domain = url.hostname.replace('www.', '');
          if (!this.isRestrictedDomain(domain) && !this.websites.has(domain)) {
            domains.add(domain);
          }
        } catch (e) {
          // Ignore invalid URLs
        }
      });

      const topDomains = Array.from(domains).slice(0, 10);
      
      if (topDomains.length === 0) {
        this.showToast('ℹ️ Keine neuen Domains im Verlauf gefunden', 'info');
        return;
      }

      // Zeige Auswahl-Dialog
      this.showDomainSelector(topDomains, 'Browser-Verlauf');
      
    } catch (error) {
      this.showToast('❌ Verlauf-Zugriff fehlgeschlagen', 'error');
      console.error('History access error:', error);
    }
  }

  // ⭐ Aus Lesezeichen hinzufügen
  async addFromBookmarks() {
    try {
      const bookmarks = await chrome.bookmarks.getTree();
      const domains = new Set();
      
      const extractDomains = (nodes) => {
        nodes.forEach(node => {
          if (node.url) {
            try {
              const url = new URL(node.url);
              const domain = url.hostname.replace('www.', '');
              if (!this.isRestrictedDomain(domain) && !this.websites.has(domain)) {
                domains.add(domain);
              }
            } catch (e) {
              // Ignore invalid URLs
            }
          }
          if (node.children) {
            extractDomains(node.children);
          }
        });
      };
      
      extractDomains(bookmarks);
      const bookmarkDomains = Array.from(domains).slice(0, 10);
      
      if (bookmarkDomains.length === 0) {
        this.showToast('ℹ️ Keine neuen Domains in Lesezeichen gefunden', 'info');
        return;
      }

      this.showDomainSelector(bookmarkDomains, 'Lesezeichen');
      
    } catch (error) {
      this.showToast('❌ Lesezeichen-Zugriff fehlgeschlagen', 'error');
      console.error('Bookmarks access error:', error);
    }
  }

  // 📋 Domain-Auswahl Dialog
  showDomainSelector(domains, source) {
    const modal = document.createElement('div');
    modal.className = 'domain-selector-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>🌐 Domains aus ${source} auswählen</h3>
          <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">
          ${domains.map(domain => `
            <label class="domain-option">
              <input type="checkbox" value="${domain}">
              <span>${domain}</span>
            </label>
          `).join('')}
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline modal-cancel">Abbrechen</button>
          <button class="btn btn-primary modal-add">Ausgewählte hinzufügen</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event Listeners
    modal.querySelector('.modal-close').onclick = () => modal.remove();
    modal.querySelector('.modal-cancel').onclick = () => modal.remove();
    modal.querySelector('.modal-add').onclick = () => {
      const selected = Array.from(modal.querySelectorAll('input:checked')).map(cb => cb.value);
      selected.forEach(domain => {
        this.websites.set(domain, {
          url: `https://${domain}`,
          status: 'pending',
          preference: null,
          timestamp: Date.now()
        });
      });
      
      if (selected.length > 0) {
        this.updateWebsiteList();
        this.updateQueueCount();
        this.saveWebsites();
        this.showToast(`✅ ${selected.length} Websites hinzugefügt`, 'success');
      }
      
      modal.remove();
    };
    
    // CSS für Modal
    if (!document.querySelector('#modal-styles')) {
      const style = document.createElement('style');
      style.id = 'modal-styles';
      style.textContent = `
        .domain-selector-modal {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
          z-index: 10000;
        }
        .modal-content {
          background: white; border-radius: 12px; max-width: 400px; width: 90%;
          max-height: 80vh; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        .modal-header {
          padding: 20px; border-bottom: 1px solid #eee; display: flex;
          justify-content: space-between; align-items: center;
        }
        .modal-header h3 { margin: 0; font-size: 16px; }
        .modal-close {
          background: none; border: none; font-size: 18px; cursor: pointer;
          padding: 5px; border-radius: 4px;
        }
        .modal-close:hover { background: #f0f0f0; }
        .modal-body {
          padding: 20px; max-height: 300px; overflow-y: auto;
        }
        .domain-option {
          display: flex; align-items: center; gap: 10px; padding: 8px 0;
          cursor: pointer; border-bottom: 1px solid #f0f0f0;
        }
        .domain-option:hover { background: #f8f9fa; }
        .modal-footer {
          padding: 20px; border-top: 1px solid #eee; display: flex;
          gap: 10px; justify-content: flex-end;
        }
      `;
      document.head.appendChild(style);
    }
  }

  // 📝 Website-Liste aktualisieren
  updateWebsiteList() {
    const listContainer = this.elements.websiteList;
    
    if (this.websites.size === 0) {
      listContainer.innerHTML = `
        <div class="list-header">
          <span>Website</span>
          <span>Status</span>
          <span>Aktion</span>
        </div>
        <div class="empty-list">
          Noch keine Websites hinzugefügt.<br>
          Gib oben eine URL ein oder nutze die Schnell-Buttons.
        </div>
      `;
      return;
    }
    
    const header = `
      <div class="list-header">
        <span>Website</span>
        <span>Status</span>
        <span>Aktion</span>
      </div>
    `;
    
    const items = Array.from(this.websites.entries()).map(([domain, data]) => {
      const statusClass = `status-${data.status}`;
      const statusText = {
        'pending': 'Wartend',
        'processing': 'Läuft...',
        'success': 'Erfolg',
        'failed': 'Fehler'
      }[data.status] || data.status;
      
      return `
        <div class="website-item">
          <div class="website-url" title="${data.url}">${domain}</div>
          <div class="website-status ${statusClass}">${statusText}</div>
          <div class="website-actions">
            <button class="action-btn" onclick="cookieQuitterUI.removeWebsite('${domain}')" title="Entfernen">🗑️</button>
            <button class="action-btn" onclick="cookieQuitterUI.testWebsite('${domain}')" title="Testen">🔍</button>
          </div>
        </div>
      `;
    }).join('');
    
    listContainer.innerHTML = header + items;
  }

  // 🗑️ Website entfernen
  removeWebsite(domain) {
    if (confirm(`🗑️ Website "${domain}" wirklich entfernen?`)) {
      this.websites.delete(domain);
      this.updateWebsiteList();
      this.updateQueueCount();
      this.saveWebsites();
      this.showToast(`🗑️ ${domain} entfernt`, 'info');
    }
  }

  // 🔍 Website testen
  async testWebsite(domain) {
    const data = this.websites.get(domain);
    if (!data) return;
    
    this.showToast(`🔍 Teste ${domain}...`, 'info');
    
    try {
      // Öffne Website in neuem Tab zum Testen
      chrome.tabs.create({ url: data.url, active: true });
    } catch (error) {
      this.showToast('❌ Test fehlgeschlagen', 'error');
    }
  }

  // 🚀 Bot starten
  async startBot() {
    if (this.websites.size === 0) {
      this.showToast('⚠️ Keine Websites in der Liste', 'warning');
      return;
    }
    
    const selectedPreference = document.querySelector('input[name="preference"]:checked')?.value || 'block';
    const pendingWebsites = Array.from(this.websites.entries()).filter(([_, data]) => data.status === 'pending');
    
    if (pendingWebsites.length === 0) {
      this.showToast('ℹ️ Alle Websites bereits verarbeitet', 'info');
      return;
    }
    
    // Rechtliche Bestätigung
    const confirmed = confirm(`⚖️ RECHTLICHE BESTÄTIGUNG

Du bestätigst hiermit:
• Du bist berechtigt, Cookie-Einstellungen auf diesen ${pendingWebsites.length} Websites zu ändern
• Der Bot agiert in deinem Namen und Auftrag
• Du trägst die Verantwortung für alle Aktionen
• Du respektierst die Terms of Service der Websites

Möchtest du fortfahren?`);
    
    if (!confirmed) {
      this.showToast('ℹ️ Bot-Start abgebrochen', 'info');
      return;
    }
    
    this.elements.startBot.disabled = true;
    this.elements.startBot.innerHTML = '<span class="btn-icon">🔄</span>Startet...';
    
    try {
      const websiteList = pendingWebsites.map(([domain, data]) => ({
        domain,
        url: data.url
      }));
      
      const response = await this.sendMessage({
        action: 'startBot',
        preference: selectedPreference,
        websites: websiteList
      });
      
      if (response.success) {
        this.showToast('🚀 Bot gestartet!', 'success');
        console.log('✅ Bot gestartet:', response);
      } else {
        this.showToast(`❌ Fehler: ${response.error}`, 'error');
        console.error('❌ Bot-Start fehlgeschlagen:', response);
      }
    } catch (error) {
      this.showToast('❌ Verbindungsfehler', 'error');
      console.error('❌ Bot-Start Fehler:', error);
    }
    
    setTimeout(() => {
      this.elements.startBot.innerHTML = `<span class="btn-icon">🚀</span>Bot starten (<span id="queue-count">${this.getQueueCount()}</span> Sites)`;
      this.elements.startBot.disabled = false;
    }, 2000);
  }

  // ⏹️ Bot stoppen
  async stopBot() {
    this.elements.stopBot.disabled = true;
    
    try {
      const response = await this.sendMessage({ action: 'stopBot' });
      
      if (response.success) {
        this.showToast('⏹️ Bot gestoppt', 'info');
        console.log('✅ Bot gestoppt:', response);
      } else {
        this.showToast('❌ Fehler beim Stoppen', 'error');
      }
    } catch (error) {
      this.showToast('❌ Verbindungsfehler', 'error');
      console.error('❌ Bot-Stop Fehler:', error);
    }
    
    this.elements.stopBot.disabled = false;
  }

  // 🗑️ Alle Websites löschen
  clearAllWebsites() {
    if (this.websites.size === 0) {
      this.showToast('ℹ️ Liste ist bereits leer', 'info');
      return;
    }
    
    if (confirm(`🗑️ Wirklich alle ${this.websites.size} Websites löschen?`)) {
      this.websites.clear();
      this.updateWebsiteList();
      this.updateQueueCount();
      this.saveWebsites();
      this.showToast('🗑️ Alle Websites gelöscht', 'info');
    }
  }

  // 📤 Website-Liste exportieren
  exportWebsiteList() {
    if (this.websites.size === 0) {
      this.showToast('⚠️ Keine Websites zum Exportieren', 'warning');
      return;
    }
    
    const data = {
      exported: new Date().toISOString(),
      websites: Array.from(this.websites.entries()).map(([domain, data]) => ({
        domain,
        url: data.url,
        status: data.status,
        timestamp: data.timestamp
      }))
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cookiequitter-websites-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    this.showToast('📤 Liste exportiert', 'success');
  }

  // 📊 Queue-Count aktualisieren
  updateQueueCount() {
    const count = this.getQueueCount();
    this.elements.queueCount.textContent = count;
  }

  getQueueCount() {
    return Array.from(this.websites.values()).filter(data => data.status === 'pending').length;
  }

  // 🎛️ Bot-Kontrollen aktualisieren
  updateBotControls(isRunning) {
    if (isRunning) {
      this.elements.startBot.style.display = 'none';
      this.elements.stopBot.style.display = 'flex';
    } else {
      this.elements.startBot.style.display = 'flex';
      this.elements.stopBot.style.display = 'none';
    }
  }

  // 📊 Status aktualisieren
  async updateStatus() {
    try {
      const status = await this.sendMessage({ action: 'getStatus' });
      
      this.isRunning = status.isRunning;
      this.updateBotControls(status.isRunning);
      this.updateStatusCard(status);
      this.updateProgress(status);
      
    } catch (error) {
      console.error('❌ Status-Update Fehler:', error);
      this.updateStatusCard({ isRunning: false });
      this.updateBotControls(false);
    }
  }

  // 📱 Status-Karte aktualisieren
  updateStatusCard(status) {
    if (status.isRunning) {
      this.elements.statusCard.classList.add('running');
      this.elements.statusIndicator.textContent = '🤖';
      this.elements.statusTitle.textContent = 'Bot aktiv';
      this.elements.statusDetail.textContent = `Verarbeitet Websites mit "${status.currentPreference}" Präferenz`;
    } else {
      this.elements.statusCard.classList.remove('running');
      this.elements.statusIndicator.textContent = '⏹️';
      this.elements.statusTitle.textContent = 'Bot bereit';
      this.elements.statusDetail.textContent = 'Füge Websites hinzu und starte den Bot';
    }
  }

  // 📈 Progress aktualisieren
  updateProgress(status) {
    if (status.isRunning && status.queueLength > 0) {
      this.elements.progressContainer.style.display = 'block';
      
      const total = status.queueLength + status.processedSites;
      const processed = status.processedSites;
      const progress = total > 0 ? ((processed / total) * 100) : 0;
      
      this.elements.progressFill.style.width = `${Math.min(progress, 100)}%`;
      this.elements.progressText.textContent = `${processed} / ${total} Sites verarbeitet`;
    } else {
      this.elements.progressContainer.style.display = 'none';
    }
  }

  // 🔄 Auto-Updates starten
  startStatusUpdates() {
    this.updateInterval = setInterval(() => {
      this.updateStatus();
    }, 3000);
  }

  // 💾 Websites speichern
  async saveWebsites() {
    try {
      const data = Object.fromEntries(this.websites);
      await chrome.storage.local.set({ quitter_websites: data });
    } catch (error) {
      console.error('Error saving websites:', error);
    }
  }

  // 📂 Websites laden
  async loadWebsites() {
    try {
      const result = await chrome.storage.local.get(['quitter_websites']);
      if (result.quitter_websites) {
        this.websites = new Map(Object.entries(result.quitter_websites));
        this.updateWebsiteList();
        this.updateQueueCount();
        console.log(`📂 ${this.websites.size} Websites geladen`);
      }
    } catch (error) {
      console.error('Error loading websites:', error);
    }
  }

  // 📞 Message senden
  sendMessage(message) {
    return new Promise((resolve, reject) => {
      try {
        console.log('📞 Sending message:', message);
        
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            console.error('📞 Runtime error:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!response) {
            console.error('📞 No response received');
            reject(new Error('Keine Antwort vom Background-Script erhalten'));
          } else {
            console.log('📞 Response received:', response);
            resolve(response);
          }
        });
      } catch (error) {
        console.error('📞 Send message error:', error);
        reject(error);
      }
    });
  }

  // 🍞 Toast anzeigen
  showToast(message, type = 'info') {
    const icons = {
      success: '✅',
      error: '❌',
      info: 'ℹ️',
      warning: '⚠️'
    };
    
    this.elements.toastIcon.textContent = icons[type] || icons.info;
    this.elements.toastMessage.textContent = message;
    
    this.elements.toast.style.display = 'block';
    
    setTimeout(() => {
      this.elements.toast.style.display = 'none';
    }, 3000);
    
    console.log(`🍞 Toast: ${message}`);
  }

  // 🧹 Cleanup
  cleanup() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

// UI initialisieren
document.addEventListener('DOMContentLoaded', () => {
  console.log('🤖 CookieQuitter Popup geladen (rechtssichere Version)');
  
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    window.cookieQuitterUI = new CookieQuitterUI();
  } else {
    console.error('❌ Chrome Extension API nicht verfügbar');
    
    document.body.innerHTML = `
      <div style="padding: 20px; text-align: center; font-family: Arial, sans-serif;">
        <h2>🤖 CookieQuitter</h2>
        <p>Diese Extension muss in Chrome installiert werden.</p>
        <p style="font-size: 12px; color: #666; margin-top: 20px;">
          Entwicklungsmodus: Chrome Extension API nicht verfügbar
        </p>
      </div>
    `;
  }
});

// Cleanup
window.addEventListener('beforeunload', () => {
  if (window.cookieQuitterUI) {
    window.cookieQuitterUI.cleanup();
  }
});

console.log('🤖 CookieQuitter Popup Script loaded (rechtssichere Version)'); 
console.log('🤖 CookieQuitter Popup Script loaded'); 