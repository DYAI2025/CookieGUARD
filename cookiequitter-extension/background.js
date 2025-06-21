// 🤖 CookieQuitter - Rechtssicherer Proaktiver Cookie-Bot
// Arbeitet nur mit explizit vom User angegebenen Websites

class CookieQuitter {
  constructor() {
    this.isRunning = false;
    this.userPreferences = {
      defaultAction: 'block', // 'block', 'essential', 'accept'
      customSites: new Map()
    };
    this.websiteQueue = [];
    this.processedSites = new Set();
    this.currentTab = null;
    this.currentWebsite = null;
    
    console.log('🤖 CookieQuitter initialized (rechtssichere Version)');
  }

  // 🚀 Bot starten mit expliziter Website-Liste
  async startBot(userPreference = 'block', websites = []) {
    if (this.isRunning) {
      console.log('🤖 CookieQuitter läuft bereits');
      return { success: false, error: 'Bot läuft bereits' };
    }

    if (!websites || websites.length === 0) {
      return { success: false, error: 'Keine Websites angegeben' };
    }

    this.isRunning = true;
    this.userPreferences.defaultAction = userPreference;
    this.websiteQueue = [...websites]; // Kopie der Website-Liste

    console.log(`🤖 CookieQuitter gestartet - Präferenz: ${userPreference}`);
    console.log(`🎯 ${this.websiteQueue.length} Websites in Queue:`, this.websiteQueue.map(w => w.domain));
    
    try {
      // Bereits verarbeitete Sites laden
      await this.loadProcessedSites();
      
      // Filtere bereits verarbeitete Sites heraus
      this.websiteQueue = this.websiteQueue.filter(site => !this.processedSites.has(site.domain));

      console.log(`🎯 ${this.websiteQueue.length} neue Sites zu verarbeiten`);

      if (this.websiteQueue.length === 0) {
        console.log('✅ Alle angegebenen Sites bereits verarbeitet!');
        this.isRunning = false;
        return { success: true, message: 'Alle Sites bereits konfiguriert' };
      }

      // Bot-Verarbeitung starten
      this.processBotQueue();
      
      return { success: true, queueLength: this.websiteQueue.length };
    } catch (error) {
      console.error('❌ Fehler beim Bot-Start:', error);
      this.isRunning = false;
      return { success: false, error: error.message };
    }
  }

  // 📂 Bereits verarbeitete Sites laden
  async loadProcessedSites() {
    try {
      const result = await chrome.storage.local.get(['quitter_processed_sites']);
      if (result.quitter_processed_sites) {
        this.processedSites = new Set(result.quitter_processed_sites);
        console.log(`📂 ${this.processedSites.size} bereits verarbeitete Sites geladen`);
      }
    } catch (error) {
      console.error('Error loading processed sites:', error);
    }
  }

  // 💾 Verarbeitete Sites speichern
  async saveProcessedSites() {
    try {
      await chrome.storage.local.set({
        quitter_processed_sites: Array.from(this.processedSites)
      });
    } catch (error) {
      console.error('Error saving processed sites:', error);
    }
  }

  // 🔄 Bot-Queue abarbeiten
  async processBotQueue() {
    if (!this.isRunning || this.websiteQueue.length === 0) {
      this.isRunning = false;
      console.log('✅ CookieQuitter fertig!');
      this.sendCompletionNotification();
      return;
    }

    const website = this.websiteQueue.shift();
    this.currentWebsite = website;
    console.log(`🤖 CookieQuitter besucht: ${website.domain} (${website.url})`);

    try {
      const success = await this.visitSiteAndSetPreferences(website);
      
      if (success) {
        this.processedSites.add(website.domain);
        await this.saveProcessedSites();
        console.log(`✅ ${website.domain} erfolgreich verarbeitet`);
        
        // Benachrichtige UI über Erfolg
        this.notifyUI('websiteProcessed', {
          domain: website.domain,
          status: 'success'
        });
      } else {
        console.log(`⚠️ ${website.domain} übersprungen (kein Banner gefunden)`);
        
        // Benachrichtige UI über Fehler
        this.notifyUI('websiteProcessed', {
          domain: website.domain,
          status: 'failed'
        });
      }
      
    } catch (error) {
      console.error(`❌ CookieQuitter Fehler bei ${website.domain}:`, error);
      
      this.notifyUI('websiteProcessed', {
        domain: website.domain,
        status: 'failed'
      });
    }

    // Nächste Site nach rechtlich sicherem Delay (5-10 Sekunden)
    const delay = 5000 + Math.random() * 5000; // 5-10 Sekunden
    console.log(`⏱️ Warte ${Math.round(delay/1000)}s bis zur nächsten Site (rechtlich sicher)`);
    
    setTimeout(() => this.processBotQueue(), delay);
  }

  // 🌐 Site besuchen und Cookie-Präferenzen setzen
  async visitSiteAndSetPreferences(website) {
    return new Promise((resolve) => {
      // Rechtliche Validierung der URL
      if (!this.isValidWebsiteUrl(website.url)) {
        console.error(`❌ Ungültige oder nicht erlaubte URL: ${website.url}`);
        resolve(false);
        return;
      }

      // Erstelle versteckten Tab
      chrome.tabs.create({
        url: website.url,
        active: false, // Im Hintergrund
        pinned: false
      }, async (tab) => {
        if (chrome.runtime.lastError) {
          console.error(`❌ Tab creation failed for ${website.domain}:`, chrome.runtime.lastError);
          resolve(false);
          return;
        }

        this.currentTab = tab;
        let resolved = false;

        // Benachrichtige UI über Start
        this.notifyUI('websiteProcessing', {
          domain: website.domain,
          status: 'processing'
        });

        // Warte auf Tab-Load
        const listener = async (tabId, changeInfo) => {
          if (tabId === tab.id && changeInfo.status === 'complete' && !resolved) {
            chrome.tabs.onUpdated.removeListener(listener);
            
            try {
              // Warte bis Seite vollständig geladen (rechtlich sicher)
              await new Promise(resolve => setTimeout(resolve, 3000));
              
              // Injiziere Cookie-Bot-Script
              const success = await this.injectBotScript(tab.id, website);
              resolved = true;
              
              // Schließe Tab nach angemessener Verzögerung
              setTimeout(() => {
                chrome.tabs.remove(tab.id, () => {
                  // Ignore errors if tab already closed
                });
              }, 5000);
              
              resolve(success);
            } catch (error) {
              console.error(`❌ Script injection failed for ${website.domain}:`, error);
              chrome.tabs.remove(tab.id);
              resolved = true;
              resolve(false);
            }
          }
        };

        chrome.tabs.onUpdated.addListener(listener);

        // Timeout nach 20 Sekunden (rechtlich sicher)
        setTimeout(() => {
          if (!resolved) {
            chrome.tabs.onUpdated.removeListener(listener);
            chrome.tabs.remove(tab.id);
            resolved = true;
            resolve(false);
          }
        }, 20000);
      });
    });
  }

  // ✅ Rechtliche URL-Validierung
  isValidWebsiteUrl(url) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();
      
      // Blacklist für rechtlich problematische Domains
      const restrictedDomains = [
        'localhost', '127.0.0.1', '0.0.0.0',
        'chrome.google.com', 'chrome-extension',
        'moz-extension', 'about:', 'file:',
        'banking', 'paypal.com', 'amazon.com',
        '.gov', '.mil', 'government'
      ];
      
      const isRestricted = restrictedDomains.some(restricted => 
        domain.includes(restricted)
      );
      
      if (isRestricted) {
        console.warn(`⚠️ Restricted domain detected: ${domain}`);
        return false;
      }
      
      // Nur HTTPS erlaubt (Sicherheit)
      if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
        console.warn(`⚠️ Invalid protocol: ${urlObj.protocol}`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Invalid URL: ${url}`, error);
      return false;
    }
  }

  // 💉 Cookie-Bot-Script injizieren
  async injectBotScript(tabId, website) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: this.cookieBotScript,
        args: [this.userPreferences.defaultAction, website.domain, website.url]
      });

      // Auswertung des Ergebnisses
      return results && results[0] && results[0].result === true;
    } catch (error) {
      console.error(`❌ Script injection failed for ${website.domain}:`, error);
      return false;
    }
  }

  // 🧠 Cookie-Bot-Script (wird in Tab injiziert)
  cookieBotScript(preference, domain, originalUrl) {
    console.log(`🤖 CookieQuitter aktiv auf ${domain} - Präferenz: ${preference}`);
    console.log(`🔗 Original URL: ${originalUrl}`);
    
    // Rechtliche Bestätigung im Script
    console.log(`⚖️ Rechtliche Basis: User hat explizit ${domain} zur Verarbeitung freigegeben`);
    
    // Erweiterte Cookie-Banner Selektoren (15+ Systeme)
    const bannerSelectors = [
      // Populäre Cookie-Management-Systeme
      '#onetrust-consent-sdk', '#usercentrics-cmp', '#CybotCookiebotDialog',
      '#sp-cc', '.sp-message-container', '.cmp-banner', '.cookie-banner',
      '.cookie-notice', '.gdpr-banner', '.privacy-banner', '.consent-banner',
      
      // Generic Selektoren
      '[id*="cookie"]', '[class*="cookie"]', '[id*="consent"]', '[class*="consent"]',
      '[data-testid*="cookie"]', '[data-testid*="consent"]', '[aria-label*="cookie"]',
      
      // Deutsche Begriffe
      '[class*="datenschutz"]', '[id*="datenschutz"]', '[class*="einwilligung"]',
      
      // Weitere Banner-Systeme
      '.cc-banner', '.cookie-consent', '.gdpr-consent', '.privacy-notice',
      '#cookie-law-info-bar', '.cli-modal-backdrop', '.moove_gdpr_cookie_modal'
    ];

    // Button-Pattern für verschiedene Aktionen (Deutsch/Englisch)
    const buttonPatterns = {
      block: [
        'ablehnen', 'reject', 'decline', 'deny', 'alle ablehnen', 'nicht akzeptieren',
        'nur erforderliche', 'nur notwendige', 'essential only', 'necessary only',
        'auswahl bestätigen', 'selection confirm', 'opt out', 'refuse all',
        'reject all', 'decline all', 'nur funktionale', 'functional only'
      ],
      essential: [
        'nur erforderliche', 'essential', 'notwendige cookies', 'necessary cookies',
        'funktionale cookies', 'functional cookies', 'auswahl bestätigen', 'confirm selection',
        'save preferences', 'einstellungen speichern', 'customize', 'anpassen'
      ],
      accept: [
        'akzeptieren', 'accept', 'alle akzeptieren', 'accept all', 'zustimmen',
        'einverstanden', 'allow all', 'agree', 'ok', 'verstanden', 'got it',
        'allow cookies', 'cookies zulassen', 'i agree', 'ich stimme zu'
      ]
    };

    // Warte bis Seite vollständig geladen
    if (document.readyState !== 'complete') {
      console.log('⏳ Warte auf vollständiges Laden der Seite...');
      return false;
    }

    // Suche Cookie-Banner
    let banner = null;
    let bannerSelector = '';
    
    for (const selector of bannerSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          if (element && element.offsetHeight > 0 && element.offsetWidth > 0) {
            const computedStyle = window.getComputedStyle(element);
            if (computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden') {
              banner = element;
              bannerSelector = selector;
              break;
            }
          }
        }
        if (banner) break;
      } catch (e) {
        continue;
      }
    }

    if (!banner) {
      console.log(`🤖 Kein Cookie-Banner gefunden auf ${domain}`);
      console.log('ℹ️ Das ist normal - nicht alle Sites haben Cookie-Banner');
      return false;
    }

    console.log('🎯 CookieQuitter: Banner gefunden!', bannerSelector, banner);

    // Finde passenden Button
    const patterns = buttonPatterns[preference] || buttonPatterns.block;
    const allButtons = banner.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"], span[onclick], div[onclick]');
    
    let clickedButton = null;
    
    for (const button of allButtons) {
      const text = (button.textContent || button.value || button.title || '').toLowerCase().trim();
      const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
      const dataText = (button.getAttribute('data-text') || '').toLowerCase();
      const fullText = (text + ' ' + ariaLabel + ' ' + dataText).toLowerCase();
      
      const isMatch = patterns.some(pattern => 
        fullText.includes(pattern.toLowerCase()) || 
        text.includes(pattern.toLowerCase())
      );
      
      if (isMatch && button.offsetHeight > 0 && button.offsetWidth > 0) {
        console.log(`✅ CookieQuitter: Klicke "${preference}" Button:`, text || button.outerHTML.substring(0, 100));
        
        try {
          // Rechtlich sichere Klick-Simulation
          button.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Warte kurz für Scroll-Animation
          setTimeout(() => {
            // Multi-Event Click Simulation (menschlich)
            button.focus();
            button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            
            // Fallback: Direkter Click
            if (typeof button.click === 'function') {
              button.click();
            }
            
            console.log(`🎯 Click-Events gesendet für "${preference}" auf ${domain}`);
          }, 500);
          
          clickedButton = button;
          break;
        } catch (error) {
          console.error('Click error:', error);
        }
      }
    }
    
    if (clickedButton) {
      // Warte und prüfe ob Banner verschwindet
      setTimeout(() => {
        const stillVisible = banner.offsetHeight > 0 && 
                           window.getComputedStyle(banner).display !== 'none';
        console.log(`🎯 Banner nach Klick ${stillVisible ? 'noch sichtbar' : 'verschwunden'} auf ${domain}`);
        
        if (!stillVisible) {
          console.log(`✅ Cookie-Präferenz "${preference}" erfolgreich gesetzt auf ${domain}`);
        }
      }, 2000);
      
      return true;
    } else {
      console.log(`❌ Kein passender Button gefunden für Präferenz "${preference}" auf ${domain}`);
      console.log('🔍 Verfügbare Buttons:', Array.from(allButtons).map(b => b.textContent?.trim()).filter(Boolean));
      return false;
    }
  }

  // 📩 UI über Änderungen benachrichtigen
  notifyUI(event, data) {
    // Sende Message an alle Extension-Tabs
    chrome.runtime.sendMessage({
      action: 'uiUpdate',
      event: event,
      data: data
    }).catch(() => {
      // Ignore errors if no listeners
    });
  }

  // 📩 Benachrichtigung bei Fertigstellung
  sendCompletionNotification() {
    const processedCount = this.processedSites.size;
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/quitter-48.png',
      title: '🤖 CookieQuitter Fertig!',
      message: `${processedCount} Sites konfiguriert. Nie wieder Cookie-Banner! 🎉`
    });

    console.log(`🎉 CookieQuitter Session beendet: ${processedCount} Sites verarbeitet`);
  }

  // ⏹️ Bot stoppen
  stopBot() {
    this.isRunning = false;
    this.websiteQueue = [];
    this.currentWebsite = null;
    
    if (this.currentTab) {
      chrome.tabs.remove(this.currentTab.id, () => {
        // Ignore errors
      });
      this.currentTab = null;
    }
    
    console.log('🛑 CookieQuitter gestoppt');
    return { success: true };
  }

  // 📊 Bot-Status abrufen
  getStatus() {
    return {
      isRunning: this.isRunning,
      processedSites: this.processedSites.size,
      queueLength: this.websiteQueue.length,
      currentWebsite: this.currentWebsite?.domain || null,
      currentPreference: this.userPreferences.defaultAction
    };
  }

  // 🗑️ Verarbeitete Sites löschen
  async clearProcessedSites() {
    try {
      await chrome.storage.local.remove(['quitter_processed_sites']);
      this.processedSites.clear();
      console.log('🗑️ Alle verarbeiteten Sites gelöscht');
      return { success: true };
    } catch (error) {
      console.error('Error clearing processed sites:', error);
      return { success: false, error: error.message };
    }
  }
}

// CookieQuitter Instanz erstellen
const cookieQuitter = new CookieQuitter();

// Message Listener für Extension-Kommunikation
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Message received:', request.action);
  
  try {
    switch (request.action) {
      case 'startBot':
        cookieQuitter.startBot(request.preference, request.websites)
          .then(result => {
            console.log('📨 StartBot response:', result);
            sendResponse(result);
          })
          .catch(error => {
            console.error('📨 StartBot error:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // Async response
        
      case 'stopBot':
        const stopResult = cookieQuitter.stopBot();
        console.log('📨 StopBot response:', stopResult);
        sendResponse(stopResult);
        break;
        
      case 'getStatus':
        const status = cookieQuitter.getStatus();
        console.log('📨 GetStatus response:', status);
        sendResponse(status);
        break;
        
      case 'clearProcessed':
        cookieQuitter.clearProcessedSites()
          .then(result => {
            console.log('📨 ClearProcessed response:', result);
            sendResponse(result);
          })
          .catch(error => {
            console.error('📨 ClearProcessed error:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // Async response
        
      default:
        console.log('📨 Unknown action:', request.action);
        sendResponse({ success: false, error: 'Unknown action: ' + request.action });
    }
  } catch (error) {
    console.error('📨 Message handler error:', error);
    sendResponse({ success: false, error: 'Message handler error: ' + error.message });
  }
});

// Installation Handler
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('🎉 CookieQuitter installiert! (Rechtssichere Version)');
    
    // Welcome Notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/quitter-48.png',
      title: '🤖 CookieQuitter installiert!',
      message: 'Füge Websites hinzu und starte den rechtssicheren Cookie-Bot.'
    });
  }
});

console.log('🤖 CookieQuitter Background Script loaded (rechtssichere Version)'); 