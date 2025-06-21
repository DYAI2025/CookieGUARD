// Cookie Guardian Content Script
class CookieGuardianContent {
  constructor() {
    this.domain = window.location.hostname;
    this.bannerDetected = false;
    this.overlayShown = false;
    this.domainSetting = null;
    this.siteData = null; // Our crawled site data
    this.siteInfo = null; // Site-specific information
    this.retryCount = 0;
    this.maxRetries = 3;
    this.observer = null;
    
    // 🔧 NEW: Erweiterte Konfiguration
    this.useShadowDOM = false; // Experimentell
    this.overlayVisibilityObserver = null;
    
    // German cookie banner patterns
    this.bannerSelectors = [
      // OneTrust
      '#onetrust-consent-sdk',
      '.onetrust-pc-dark-filter',
      '.ot-sdk-container',
      '#onetrust-banner-sdk',
      
      // Usercentrics
      '#usercentrics-cmp',
      '.uc-banner',
      '.usercentrics-dialog',
      
      // Cookiebot
      '#CybotCookiebotDialog',
      '#Cookiebot',
      '.cookiebot-banner',
      
      // SourcePoint
      '#sp-cc',
      '.sp-cc-banner',
      '.sp-message-container',
      
      // Generic selectors
      '[id*="cookie"]',
      '[class*="cookie"]',
      '[id*="consent"]',
      '[class*="consent"]',
      '[aria-label*="cookie"]',
      '[aria-label*="Cookie"]',
      '.gdpr-banner',
      '.privacy-banner',
      '.cookie-notice',
      '.cookie-bar',
      
      // Zusätzliche häufige Selektoren
      '[id*="privacy"]',
      '[class*="privacy"]',
      '[id*="banner"]',
      '[class*="banner"]',
      '[id*="modal"]',
      '[class*="modal"]',
      '[data-testid*="cookie"]',
      '[data-testid*="consent"]',
      '[data-cy*="cookie"]',
      '[data-cy*="consent"]',
      '.cc-banner',
      '.cc-window',
      '.cookie-consent',
      '.consent-banner',
      '.privacy-notice',
      '.data-protection',
      '.cookie-policy',
      '.tracking-consent',
      '.gdpr-consent',
      '.cookie-overlay',
      '.consent-overlay',
      '.privacy-overlay',
      
      // Spezifische deutsche Begriffe
      '[class*="datenschutz"]',
      '[id*="datenschutz"]',
      '[class*="einwilligung"]',
      '[id*="einwilligung"]'
    ];

    // German button patterns
    this.buttonPatterns = {
      accept: [
        'alle akzeptieren',
        'cookies akzeptieren', 
        'einverstanden',
        'zustimmen',
        'accept all',
        'alle cookies',
        'geht klar',
        'akzeptieren'
      ],
      reject: [
        'alle ablehnen',
        'ablehnen',
        'nicht akzeptieren',
        'reject all',
        'deny',
        'nur erforderliche',
        'nur notwendige'
      ],
      settings: [
        'einstellungen',
        'auswahl bestätigen',
        'cookie-einstellungen',
        'datenschutz-einstellungen',
        'manage preferences',
        'weitere optionen'
      ]
    };

    this.crawlerSelectors = null; // Initialize crawler selectors

    this.init();
  }

  async init() {
    // Load site data from our crawled database
    await this.loadSiteData();
    
    // Check for existing domain setting
    this.domainSetting = await this.getDomainSetting();
    
    // Detect banners with retry logic
    this.startBannerDetection();
    
    // Update badge
    this.updateBadge();
    
    // Log problematic sites
    this.logProblematicSites();
    
    // Setup database update listener
    this.setupDatabaseUpdateListener();
  }

  async loadSiteData() {
    try {
      // Lade sowohl Crawler-Daten als auch Site-Database
      const result = await chrome.storage.local.get(['crawlerData', 'siteDatabase']);
      const crawlerData = result.crawlerData || {};
      const siteDatabase = result.siteDatabase || { sites: {} };
      
      // Hole Daten für die aktuelle Domain (mit und ohne www)
      this.siteData = crawlerData[this.domain];
      const cleanDomain = this.domain.replace('www.', '');
      this.siteInfo = siteDatabase.sites[cleanDomain] || siteDatabase.sites[this.domain];
      
      if (this.siteData) {
        console.log('🎯 Cookie Guardian: Using crawled data for', this.domain, this.siteData);
        
        // Nutze Crawler-Selektoren für bessere Banner-Erkennung
        this.enhanceBannerDetection();
      } else {
        console.log('⚠️ Cookie Guardian: No crawl data for', this.domain);
      }
      
      if (this.siteInfo) {
        console.log('📊 Cookie Guardian: Site info loaded for', cleanDomain, this.siteInfo);
        this.updateBadgeWithSiteInfo();
      }
      
    } catch (error) {
      console.error('Error loading site data:', error);
      this.siteData = null;
      this.siteInfo = null;
    }
  }

  async getDomainSetting() {
    try {
      // First check session storage for immediate access
      const sessionSetting = sessionStorage.getItem(`cookieguard_${this.domain}`);
      if (sessionSetting) {
        const setting = JSON.parse(sessionSetting);
        // Check if setting is still valid (less than 24h old)
        if (Date.now() - setting.timestamp < 24 * 60 * 60 * 1000) {
          return setting;
        }
      }
      
      // Then check chrome.storage.local for persistence
      const result = await chrome.storage.local.get(this.domain);
      const setting = result[this.domain];
      
      if (setting) {
        // Check if setting is still valid
        if (Date.now() - setting.timestamp < 24 * 60 * 60 * 1000) {
          // Cache in session storage
          sessionStorage.setItem(`cookieguard_${this.domain}`, JSON.stringify(setting));
          return setting;
        } else {
          // Remove expired setting
          await chrome.storage.local.remove(this.domain);
          sessionStorage.removeItem(`cookieguard_${this.domain}`);
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error getting domain setting:', error);
      return null;
    }
  }

  async saveDomainSetting(action) {
    const setting = {
      action: action,
      timestamp: Date.now(),
      domain: this.domain,
      userSet: true  // Markiere als vom Nutzer gesetzt
    };
    
    try {
      // Save to chrome.storage.local for persistence
      await chrome.storage.local.set({ [this.domain]: setting });
      
      // Update current setting
      this.domainSetting = setting;
      
      // Also save to session storage for immediate access
      sessionStorage.setItem(`cookieguard_${this.domain}`, JSON.stringify(setting));
      
      // Sync with other tabs
      chrome.runtime.sendMessage({
        type: 'SETTING_UPDATED',
        domain: this.domain,
        setting: setting
      });
      
      console.log('Cookie Guardian: Setting saved', setting);
    } catch (error) {
      console.error('Error saving setting:', error);
      // Fallback to session storage only
      sessionStorage.setItem(`cookieguard_${this.domain}`, JSON.stringify(setting));
    }
  }

  detectBanners() {
    console.log('🔍 Detecting banners on', this.domain);
    let bannersFound = 0;
    
    for (const selector of this.bannerSelectors) {
      const banner = document.querySelector(selector);
      if (banner && this.isVisible(banner)) {
        bannersFound++;
        console.log(`✅ Banner found with selector: ${selector}`, banner);
        this.handleBannerDetected(banner);
        return; // Stoppe bei erstem gefundenen Banner
      }
    }
    
    if (bannersFound === 0) {
      console.log('⚠️ No banners detected with standard selectors, trying fallback detection...');
      this.detectBannersFallback();
    }
  }

  observeForBanners() {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new MutationObserver((mutations) => {
      if (this.bannerDetected) return;

      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.checkNodeForBanner(node);
            }
          });
        }
        // Auch auf Attribut-Änderungen prüfen
        if (mutation.type === 'attributes' && mutation.target) {
          this.checkNodeForBanner(mutation.target);
        }
      });
    });

    // Beobachte das gesamte Dokument
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'id', 'hidden']
    });

    // Stoppe Beobachtung nach 60 Sekunden
    setTimeout(() => {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
        console.debug('CookieGuard: MutationObserver gestoppt.');
      }
    }, 60000);
  }

  checkNodeForBanner(element) {
    for (const selector of this.bannerSelectors) {
      if (element.matches && element.matches(selector)) {
        if (this.isVisible(element)) {
          this.handleBannerDetected(element);
          return;
        }
      }
      
      const banner = element.querySelector(selector);
      if (banner && this.isVisible(banner)) {
        this.handleBannerDetected(banner);
        return;
      }
    }
  }

  isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return rect.width > 0 && 
           rect.height > 0 && 
           style.display !== 'none' && 
           style.visibility !== 'hidden' &&
           style.opacity !== '0';
  }

  handleBannerDetected(banner) {
    if (this.bannerDetected) return;
    
    this.bannerDetected = true;
    this.currentBanner = banner;
    
    const riskLevel = this.assessRiskLevel(banner);
    
    // Zeige Overlay immer an, außer wenn explizit deaktiviert
    // Prüfe ob der Nutzer eine manuelle Einstellung vorgenommen hat
    const hasUserSetting = this.domainSetting && this.domainSetting.userSet !== false;
    
    if (!hasUserSetting) {
      // Zeige Guardian Overlay
      this.showGuardianOverlay(banner, riskLevel);
    } else {
      // Wende gespeicherte Einstellung an
      console.log(`🔄 Applying saved setting: ${this.domainSetting.action} for ${this.domain}`);
      setTimeout(() => {
        this.applySilentMode();
      }, 1000);
    }
    
    console.log('Cookie Guardian: Banner detected', {
      domain: this.domain,
      risk: riskLevel,
      banner: banner,
      hasSetting: !!this.domainSetting,
      hasUserSetting: hasUserSetting
    });
  }

  assessRiskLevel(banner) {
    // Use crawled data for accurate risk assessment
    if (this.siteData) {
      const rating = this.siteData.rating;
      console.log(`🎯 Using crawled rating: ${rating} for ${this.domain}`);
      return rating;
    }
    
    // Fallback to enhanced heuristic analysis
    let riskScore = 0;
    const bannerText = banner.textContent.toLowerCase();
    
    // High-risk indicators (weight: 3)
    const highRiskPatterns = [
      'marketing', 'werbung', 'personalisierung', 'targeting', 'werbepartner',
      'drittanbieter', 'social media', 'soziale medien', 'tracking', 'remarketing',
      'personalisiert', 'anpassen', 'empfehlungen', 'interessen', 'verhalten',
      'werbeanalyse', 'remarketing', 'retargeting', 'conversion tracking'
    ];
    
    highRiskPatterns.forEach(pattern => {
      if (bannerText.includes(pattern)) riskScore += 3;
    });
    
    // Medium-risk indicators (weight: 2)
    const mediumRiskPatterns = [
      'analyse', 'statistik', 'performance', 'tracking', 'optimierung',
      'präferenzen', 'einstellungen', 'verbessern', 'erfahrung', 'nutzung',
      'besucher', 'seitenaufrufe', 'klicks', 'verweildauer', 'navigation'
    ];
    
    mediumRiskPatterns.forEach(pattern => {
      if (bannerText.includes(pattern)) riskScore += 2;
    });
    
    // Third-party trackers (weight: 1)
    const commonTrackers = [
      'google', 'facebook', 'amazon', 'microsoft', 'linkedin', 'twitter',
      'instagram', 'pinterest', 'tiktok', 'snapchat', 'reddit', 'quora',
      'criteo', 'taboola', 'outbrain', 'adroll', 'adform', 'doubleclick'
    ];
    
    commonTrackers.forEach(tracker => {
      if (bannerText.includes(tracker)) riskScore += 1;
    });
    
    // Domain-based risk (weight: 1)
    const commercialPatterns = [
      '.com', 'shop', 'store', 'market', 'news', 'blog',
      'magazin', 'magazine', 'portal', 'platform', 'plattform'
    ];
    
    commercialPatterns.forEach(pattern => {
      if (this.domain.includes(pattern)) riskScore += 1;
    });
    
    // Check for privacy policy mentions
    if (bannerText.includes('datenschutz') || bannerText.includes('privacy')) {
      riskScore -= 1; // Slight reduction for transparency
    }
    
    // Return traffic light color based on weighted score
    if (riskScore >= 6) return 'red';
    if (riskScore >= 3) return 'yellow';
    return 'green';
  }

  getRiskText(riskLevel) {
    const texts = {
      red: {
        title: 'Hohes Risiko',
        icon: '🔴'
      },
      yellow: {
        title: 'Mittleres Risiko',
        icon: '🟡'
      },
      green: {
        title: 'Geringes Risiko',
        icon: '🟢'
      }
    };
    
    const text = texts[riskLevel] || { title: 'Unbekanntes Risiko', icon: '⚪' };
    return `${text.icon} ${text.title}`;
  }

  getRiskExplanation(riskLevel) {
    const explanations = {
      red: {
        title: 'Hohes Datenschutzrisiko',
        description: 'Diese Website gibt Nutzerdaten an Drittanbieter weiter. Es besteht ein hohes Risiko, dass diese Daten in nicht seriöse Hände geraten. Die Datenverarbeitung ist intransparent.',
        recommendation: 'Wir empfehlen, nur essentielle Cookies zu akzeptieren oder alle Cookies zu blockieren.'
      },
      yellow: {
        title: 'Mittleres Datenschutzrisiko',
        description: 'Diese Website verwendet Analyse-Tools und sammelt Nutzerdaten. Die Datenverarbeitung ist teilweise transparent.',
        recommendation: 'Sie können essentielle Cookies akzeptieren, sollten aber Marketing-Cookies ablehnen.'
      },
      green: {
        title: 'Geringes Datenschutzrisiko',
        description: 'Diese Website verwendet nur essentielle Cookies. Die Datenverarbeitung ist transparent und datenschutzfreundlich.',
        recommendation: 'Sie können alle Cookies akzeptieren, da keine datenschutzrelevanten Risiken bestehen.'
      }
    };
    
    const explanation = explanations[riskLevel] || {
      title: 'Unbekanntes Risiko',
      description: 'Die Risikobewertung dieser Website ist nicht möglich.',
      recommendation: 'Bitte treffen Sie eine vorsichtige Entscheidung.'
    };
    
    return `
      <strong>${explanation.title}</strong><br>
      ${explanation.description}<br>
      <em>${explanation.recommendation}</em>
    `;
  }

  showGuardianOverlay(banner, riskLevel) {
    if (this.overlayShown) return;
    this.overlayShown = true;

    // Entferne ggf. alte Overlays
    const oldOverlay = document.querySelector('.cookie-guardian-overlay');
    if (oldOverlay) oldOverlay.remove();

    const overlay = this.createOverlay(riskLevel);
    
    // 🔧 IMPROVED: Verbesserte Positionierung mit modernem z-index
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Sichere Positionierung mit calc(infinity) z-index
    overlay.style.cssText = `
      position: fixed !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      z-index: calc(infinity) !important;
      width: auto !important;
      max-width: 95vw !important;
      pointer-events: auto !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      isolation: isolate !important;
      contain: layout style paint !important;
    `;
    
    // Mobile Anpassungen
    if (viewportWidth < 768) {
      overlay.style.top = '20px';
      overlay.style.left = '20px';
      overlay.style.right = '20px';
      overlay.style.transform = 'none';
      overlay.style.width = 'calc(100vw - 40px)';
      overlay.style.maxWidth = 'calc(100vw - 40px)';
    }
    
    // Fallback für Browser ohne calc(infinity) Support
    setTimeout(() => {
      const computedZIndex = window.getComputedStyle(overlay).zIndex;
      if (!computedZIndex || computedZIndex === 'auto' || computedZIndex === '0') {
        overlay.style.zIndex = '2147483647';
        console.log('🎯 Fallback zu numerischem z-index');
      }
    }, 100);
    
    document.body.appendChild(overlay);

    console.log('🎯 Guardian Overlay angezeigt:', {
      position: overlay.style.position,
      top: overlay.style.top,
      left: overlay.style.left,
      zIndex: overlay.style.zIndex,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      banner: banner ? `${banner.getBoundingClientRect().top}-${banner.getBoundingClientRect().bottom}` : 'none'
    });

    // Add event listeners
    this.setupOverlayListeners(overlay);

    // 🔧 IMPROVED: Visibility monitoring
    if (window.IntersectionObserver) {
      this.overlayVisibilityObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.intersectionRatio < 0.8) {
            console.warn('🎯 Guardian Overlay teilweise verdeckt');
            // Repositionierung zu sicherer Position
            overlay.style.top = '50%';
            overlay.style.left = '50%';
            overlay.style.transform = 'translate(-50%, -50%)';
          }
        });
      }, { threshold: [0.8] });
      
      this.overlayVisibilityObserver.observe(overlay);
    }

    // Auto-hide nach 15 Sekunden, falls keine Interaktion
    setTimeout(() => {
      if (overlay.parentNode || (overlay.getRootNode && overlay.getRootNode() !== document)) {
        this.hideOverlay(overlay);
        // Setze Default-Einstellung und wende sie an
        this.saveDomainSetting('block').then(() => {
          this.applySilentMode();
        });
      }
    }, 15000);
  }

  createOverlay(riskLevel) {
    const overlay = document.createElement('div');
    overlay.className = 'cookie-guardian-overlay';
    overlay.innerHTML = `
      <div class="guardian-popup">
        <div class="guardian-header">
          <div class="guardian-logo">🛡️ Cookie Guardian</div>
          <div class="guardian-risk ${riskLevel}">
            <span class="risk-indicator ${riskLevel}"></span>
            ${this.getRiskText(riskLevel)}
          </div>
        </div>
        
        <div class="guardian-content">
          <h3>Cookie-Banner erkannt auf ${this.domain}</h3>
          <p class="risk-explanation">${this.getRiskExplanation(riskLevel)}</p>
          ${this.siteData ? this.getCrawlDataInfo() : ''}
          
          <div class="guardian-actions">
            <button class="guardian-btn block" data-action="block">
              🔴 Dauerhaft blockieren
              <small>Alle nicht-essentiellen Cookies ablehnen</small>
            </button>
            
            <button class="guardian-btn essential" data-action="essential">
              🟡 Nur notwendige Cookies
              <small>Funktionale Cookies erlauben</small>
            </button>
            
            <button class="guardian-btn accept" data-action="accept">
              🟢 Alle akzeptieren
              <small>Vollständige Zustimmung erteilen</small>
            </button>
          </div>
          
          <div class="guardian-footer">
            <small>Diese Einstellung wird für ${this.domain} gespeichert</small>
          </div>
        </div>
      </div>
    `;
    
    return overlay;
  }

  getCrawlDataInfo() {
    if (!this.siteData) return '';
    
    const stats = this.siteData.stats; // Updated structure
    let info = '<div class="crawl-info">';
    info += '<h4>🔍 Unsere Analyse:</h4>';
    info += `<div class="cookie-breakdown">`;
    
    if (stats.tracking > 0) {
      info += `<span class="cookie-type danger">🔴 ${stats.tracking} Tracking</span>`;
    }
    if (stats.analytics > 0) {
      info += `<span class="cookie-type warning">🟡 ${stats.analytics} Analytics</span>`;
    }
    if (stats.essential > 0) {
      info += `<span class="cookie-type safe">🟢 ${stats.essential} Essential</span>`;
    }
    
    info += '</div>';
    
    if (this.siteData.banner) {
      const banner = this.siteData.banner;
      info += '<div class="banner-info">';
      info += `<small>Banner: ${banner.buttons} Buttons`;
      if (banner.hasAccept) info += ' | ✅ Accept';
      if (banner.hasReject) info += ' | ❌ Reject';
      if (banner.hasSettings) info += ' | ⚙️ Settings';
      info += '</small></div>';
    }
    
    info += '</div>';
    return info;
  }

  positionOverlay(overlay, banner) {
    const bannerRect = banner.getBoundingClientRect();
    const overlayElement = overlay.querySelector('.guardian-popup');
    
    // Position overlay above or below banner based on available space
    if (bannerRect.top > window.innerHeight / 2) {
      // Position above banner
      overlayElement.style.top = Math.max(10, bannerRect.top - 350) + 'px';
    } else {
      // Position below banner
      overlayElement.style.top = Math.min(bannerRect.bottom + 10, window.innerHeight - 350) + 'px';
    }
    
    // Center horizontally
    overlayElement.style.left = '50%';
    overlayElement.style.transform = 'translateX(-50%)';
  }

  setupOverlayListeners(overlay) {
    const buttons = overlay.querySelectorAll('.guardian-btn');
    
    buttons.forEach(button => {
      button.addEventListener('click', async (e) => {
        const action = e.currentTarget.dataset.action;
        await this.handleUserChoice(action);
        this.hideOverlay(overlay);
      });
    });

    // Close on click outside
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.hideOverlay(overlay);
        this.applySilentMode('block'); // Default to block
      }
    });
  }

  async handleUserChoice(action) {
    // Prevent multiple clicks
    if (this.isProcessing) return;
    this.isProcessing = true;
    
    try {
      // Save user preference
      await this.saveDomainSetting(action);
      
      // Apply the choice to current banner
      this.applyBannerAction(action);
      
      // Update badge
      this.updateBadge(action);
      
      console.log('Cookie Guardian: User choice applied', {
        domain: this.domain,
        action: action
      });
    } finally {
      this.isProcessing = false;
    }
  }

  applyBannerAction(action) {
    if (!this.currentBanner) return;

    // Banner entfernen (aus dem DOM löschen)
    if (this.currentBanner.parentNode) {
      this.currentBanner.parentNode.removeChild(this.currentBanner);
      console.debug('CookieGuard: Banner aus DOM entfernt.');
    }

    // Overlay entfernen
    this.hideOverlay();

    // Apply the action (Button-Klicks etc.)
    let success = false;
    switch (action) {
      case 'block':
        success = this.clickBannerButton('reject');
        break;
      case 'essential':
        success = this.clickBannerButton('settings') || this.clickBannerButton('reject');
        break;
      case 'accept':
        success = this.clickBannerButton('accept');
        break;
    }

    // Kein Reload mehr, außer explizit nötig (hier nicht)

    // Wenn action fehlschlägt, versuche es erneut (max. 3x)
    if (!success && this.retryCount < this.maxRetries) {
      this.retryCount++;
      setTimeout(() => {
        this.applyBannerAction(action);
      }, 1000);
    } else {
      this.retryCount = 0;
    }
  }

  clickBannerButton(buttonType) {
    if (!this.siteData || !this.siteData.banner) {
      return this.clickBannerButtonFallback(buttonType);
    }
    
    // Use crawled data for precise button selection
    const bannerData = this.siteData.banner;
    const buttonSelectors = bannerData.buttons[buttonType];
    
    if (buttonSelectors && buttonSelectors.length > 0) {
      for (const selector of buttonSelectors) {
        const button = this.currentBanner.querySelector(selector);
        if (button) {
          return this.simulateHumanClick(button);
        }
      }
    }
    
    // Fallback to pattern matching if no button found
    return this.clickBannerButtonFallback(buttonType);
  }

  clickBannerButtonFallback(buttonType) {
    const patterns = this.buttonPatterns[buttonType];
    
    for (const pattern of patterns) {
      // Try direct button text matching
      const buttons = this.currentBanner.querySelectorAll('button, a, [role="button"]');
      
      for (const button of buttons) {
        const text = button.textContent.toLowerCase().trim();
        if (text.includes(pattern)) {
          return this.simulateHumanClick(button);
        }
      }
      
      // Try attribute matching
      const attrButton = this.currentBanner.querySelector(
        `[data-testid*="${pattern}"], [class*="${pattern}"], [id*="${pattern}"]`
      );
      
      if (attrButton) {
        return this.simulateHumanClick(attrButton);
      }
    }
    
    return false;
  }

  simulateHumanClick(element) {
    if (!element) return false;

    try {
      // Create and dispatch mouse events
      const events = ['mouseover', 'mouseenter', 'mousedown', 'mouseup', 'click'];
      events.forEach(eventType => {
        const event = new MouseEvent(eventType, {
          view: window,
          bubbles: true,
          cancelable: true
        });
        element.dispatchEvent(event);
      });

      // Also try programmatic click
      element.click();
      
      return true;
    } catch (error) {
      console.error('Error simulating click:', error);
      return false;
    }
  }

  applySilentMode() {
    if (!this.domainSetting || !this.bannerDetected) return;

    const action = this.domainSetting.action;
    console.log(`Applying silent mode: ${action} for ${this.domain}`);

    this.applySilentModeAsync(action);
  }

  async applySilentModeAsync(action) {
    try {
      // Nutze Crawler-Selektoren falls verfügbar
      const selectors = this.crawlerSelectors || {};
      
      switch (action) {
        case 'block':
          // Versuche zuerst Crawler-Selektoren, dann Fallback
          if (selectors.reject && selectors.reject.length > 0) {
            await this.clickCrawlerButton(selectors.reject);
          } else {
            this.clickBannerButton('reject');
          }
          break;
        case 'essential':
          if (selectors.settings && selectors.settings.length > 0) {
            await this.clickCrawlerButton(selectors.settings);
            setTimeout(() => this.selectEssentialOnly(), 1000);
          } else {
            this.clickBannerButton('settings');
            setTimeout(() => this.selectEssentialOnly(), 1000);
          }
          break;
        case 'accept':
          if (selectors.accept && selectors.accept.length > 0) {
            await this.clickCrawlerButton(selectors.accept);
          } else {
            this.clickBannerButton('accept');
          }
          break;
      }
    } catch (error) {
      console.error('Error applying silent mode:', error);
    }
  }

  /**
   * Klickt auf einen Button basierend auf Crawler-Selektoren
   */
  async clickCrawlerButton(selectors) {
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element && this.isVisible(element)) {
          console.log(`🎯 Clicking crawler selector: ${selector}`);
          this.simulateHumanClick(element);
          
          // Warte kurz und prüfe, ob Banner verschwunden ist
          await new Promise(resolve => setTimeout(resolve, 500));
          
          if (!this.isBannerVisible()) {
            console.log('✅ Banner successfully hidden with crawler selector');
            this.hideBanner();
            return true;
          }
        }
      } catch (error) {
        console.warn(`Failed to click crawler selector ${selector}:`, error);
      }
    }
    return false;
  }

  /**
   * Prüft, ob ein Banner noch sichtbar ist
   */
  isBannerVisible() {
    return this.bannerSelectors.some(selector => {
      const element = document.querySelector(selector);
      return element && this.isVisible(element);
    });
  }

  /**
   * Versteckt das Banner
   */
  hideBanner() {
    this.bannerDetected = false;
    if (this.currentBanner) {
      this.currentBanner.style.display = 'none';
      this.currentBanner = null;
    }
  }

  hideOverlay(overlay) {
    if (!overlay) overlay = document.querySelector('.cookie-guardian-overlay');
    if (overlay && overlay.parentNode) {
      overlay.remove();
    }
    this.overlayShown = false;
    console.debug('CookieGuard: Overlay entfernt.');
  }

  updateBadge(status = null) {
    chrome.runtime.sendMessage({
      action: 'updateBadge',
      status: status || (this.domainSetting ? this.domainSetting.action : null)
    }).catch(console.error);
  }

  // Listen for setting updates from other tabs
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'SETTING_UPDATED' && message.domain === this.domain) {
        this.domainSetting = message.setting;
        sessionStorage.setItem(`cookieguard_${this.domain}`, JSON.stringify(message.setting));
        
        // Re-apply setting if banner is present
        if (this.currentBanner) {
          this.applyBannerAction(message.setting.action);
        }
      }
    });
  }

  getCrawlerDataStructure() {
    return {
      domain: this.domain,
      banner: {
        // Banner-Erkennung
        selectors: {
          container: [], // CSS-Selektoren für Banner-Container
          accept: [],    // CSS-Selektoren für Akzeptieren-Buttons
          reject: [],    // CSS-Selektoren für Ablehnen-Buttons
          settings: [],  // CSS-Selektoren für Einstellungen-Buttons
          close: []      // CSS-Selektoren für Schließen-Buttons
        },
        
        // Banner-Verhalten
        behavior: {
          appearsOn: 'load', // 'load', 'scroll', 'click', 'timer'
          delay: 0,          // Verzögerung in ms
          reappears: false,  // Erscheint der Banner wieder?
          reappearDelay: 0,  // Verzögerung für Wiedererscheinen
          hideOnAccept: true,// Wird der Banner nach Akzeptieren versteckt?
          hideOnReject: true,// Wird der Banner nach Ablehnen versteckt?
          hideOnSettings: false // Wird der Banner nach Einstellungen versteckt?
        },
        
        // Cookie-Einstellungen
        settings: {
          hasCategories: false,    // Hat der Banner Cookie-Kategorien?
          categories: [],          // Liste der Kategorien
          defaultState: {},        // Standard-Zustand der Kategorien
          requiredCategories: [],  // Erforderliche Kategorien
          toggleSelectors: {},     // Selektoren für Kategorie-Toggles
          saveButton: ''           // Selektor für Speichern-Button
        }
      },
      
      // Cookie-Details
      cookies: {
        essential: {
          names: [],      // Namen der essentiellen Cookies
          purposes: [],   // Zwecke der essentiellen Cookies
          domains: []     // Domains der essentiellen Cookies
        },
        functional: {
          names: [],
          purposes: [],
          domains: []
        },
        analytics: {
          names: [],
          purposes: [],
          domains: []
        },
        marketing: {
          names: [],
          purposes: [],
          domains: []
        }
      },
      
      // Automatisierungsdaten
      automation: {
        // Erfolgreiche Klick-Sequenzen
        sequences: {
          accept: [],     // Sequenz für "Alle akzeptieren"
          reject: [],     // Sequenz für "Alle ablehnen"
          essential: [],  // Sequenz für "Nur essentielle"
          settings: []    // Sequenz für Einstellungen
        },
        
        // Timing-Informationen
        timing: {
          clickDelay: 0,      // Verzögerung zwischen Klicks
          animationDelay: 0,  // Verzögerung für Animationen
          loadDelay: 0        // Verzögerung nach Seitenladung
        },
        
        // Fehlerbehandlung
        errorHandling: {
          retryCount: 3,      // Anzahl der Wiederholungsversuche
          retryDelay: 1000,   // Verzögerung zwischen Wiederholungen
          fallbackActions: {} // Fallback-Aktionen bei Fehlern
        }
      },
      
      // Cookie-Speichermechanismen
      storage: {
        localStorage: {
          keys: [],           // Relevante localStorage-Keys
          patterns: []        // Muster für Cookie-bezogene Keys
        },
        sessionStorage: {
          keys: [],
          patterns: []
        },
        cookies: {
          patterns: [],       // Muster für Cookie-Namen
          domains: []         // Betroffene Domains
        }
      },
      
      // Cookie-Erneuerungsmechanismen
      renewal: {
        interval: 0,          // Intervall für Cookie-Erneuerung
        triggers: [],         // Auslöser für Cookie-Erneuerung
        patterns: []          // Muster für Cookie-Erneuerung
      },
      
      // Datenschutz-Informationen
      privacy: {
        hasPolicy: false,     // Hat die Seite eine Datenschutzerklärung?
        policyUrl: '',        // URL der Datenschutzerklärung
        cookiePolicyUrl: '',  // URL der Cookie-Richtlinie
        lastUpdated: '',      // Letztes Update der Datenschutzerklärung
        compliance: {         // DSGVO-Konformität
          gdpr: false,
          ccpa: false,
          eprivacy: false
        }
      }
    };
  }

  checkLegalCompliance(banner) {
    const compliance = {
      gdpr: {
        required: true,
        checks: {
          // Grundlegende Anforderungen
          hasConsent: false,        // Einwilligung erforderlich
          hasReject: false,         // Ablehnen-Option muss gleichwertig sein
          hasSettings: false,        // Detaillierte Einstellungen müssen möglich sein
          hasInfo: false,           // Ausreichende Informationen müssen vorhanden sein
          
          // Spezifische Anforderungen
          hasPurpose: false,        // Zweck der Datenverarbeitung muss angegeben sein
          hasDuration: false,       // Speicherdauer muss angegeben sein
          hasThirdParty: false,     // Drittanbieter müssen genannt werden
          hasWithdraw: false,       // Widerrufsmöglichkeit muss bestehen
          
          // Darstellungsanforderungen
          isVisible: false,         // Banner muss sichtbar sein
          isAccessible: false,      // Banner muss zugänglich sein
          hasContrast: false,       // Ausreichender Kontrast
          hasReadableFont: false,   // Lesbare Schriftgröße
          
          // Technische Anforderungen
          noPreTicked: false,       // Keine vorangekreuzten Boxen
          noForcedAccept: false,    // Kein Zwang zur Annahme
          hasSaveButton: false,     // Speichern-Button muss vorhanden sein
          hasCloseButton: false     // Schließen-Button muss vorhanden sein
        },
        violations: []
      },
      
      eprivacy: {
        required: true,
        checks: {
          hasCookieInfo: false,     // Cookie-Informationen müssen vorhanden sein
          hasTrackingInfo: false,   // Tracking-Informationen müssen vorhanden sein
          hasOptOut: false,         // Opt-Out-Möglichkeit muss bestehen
          hasStorageInfo: false     // Speicherinformationen müssen vorhanden sein
        },
        violations: []
      },
      
      ttDSG: {
        required: true,
        checks: {
          hasGermanInfo: false,     // Informationen auf Deutsch
          hasGermanSettings: false, // Einstellungen auf Deutsch
          hasGermanButtons: false,  // Buttons auf Deutsch
          hasGermanPrivacy: false   // Datenschutzerklärung auf Deutsch
        },
        violations: []
      }
    };

    // Überprüfe Banner-Sichtbarkeit und Zugänglichkeit
    compliance.gdpr.checks.isVisible = this.isVisible(banner);
    compliance.gdpr.checks.isAccessible = this.isAccessible(banner);
    
    // Überprüfe Kontrast und Lesbarkeit
    const styles = window.getComputedStyle(banner);
    compliance.gdpr.checks.hasContrast = this.checkContrast(styles);
    compliance.gdpr.checks.hasReadableFont = this.checkReadability(styles);
    
    // Überprüfe Banner-Inhalte
    const bannerText = banner.textContent.toLowerCase();
    const bannerHTML = banner.innerHTML.toLowerCase();
    
    // GDPR Checks
    compliance.gdpr.checks.hasConsent = this.checkConsent(bannerText);
    compliance.gdpr.checks.hasReject = this.checkReject(bannerText);
    compliance.gdpr.checks.hasSettings = this.checkSettings(bannerText);
    compliance.gdpr.checks.hasInfo = this.checkInfo(bannerText);
    compliance.gdpr.checks.hasPurpose = this.checkPurpose(bannerText);
    compliance.gdpr.checks.hasDuration = this.checkDuration(bannerText);
    compliance.gdpr.checks.hasThirdParty = this.checkThirdParty(bannerText);
    compliance.gdpr.checks.hasWithdraw = this.checkWithdraw(bannerText);
    
    // ePrivacy Checks
    compliance.eprivacy.checks.hasCookieInfo = this.checkCookieInfo(bannerText);
    compliance.eprivacy.checks.hasTrackingInfo = this.checkTrackingInfo(bannerText);
    compliance.eprivacy.checks.hasOptOut = this.checkOptOut(bannerText);
    compliance.eprivacy.checks.hasStorageInfo = this.checkStorageInfo(bannerText);
    
    // TTDSG Checks
    compliance.ttDSG.checks.hasGermanInfo = this.checkGermanLanguage(bannerText);
    compliance.ttDSG.checks.hasGermanSettings = this.checkGermanSettings(bannerText);
    compliance.ttDSG.checks.hasGermanButtons = this.checkGermanButtons(bannerText);
    compliance.ttDSG.checks.hasGermanPrivacy = this.checkGermanPrivacy(bannerText);
    
    // Sammle Verstöße
    this.collectViolations(compliance);
    
    return compliance;
  }

  // Hilfsmethoden für die Überprüfung
  checkConsent(text) {
    const consentPatterns = [
      'einwilligung', 'consent', 'zustimmung', 'akzeptieren',
      'einverstanden', 'erlauben', 'erlaubnis', 'genehmigung'
    ];
    return consentPatterns.some(pattern => text.includes(pattern));
  }

  checkReject(text) {
    const rejectPatterns = [
      'ablehnen', 'reject', 'verweigern', 'nicht akzeptieren',
      'nur notwendige', 'nur essentiell', 'nur erforderlich'
    ];
    return rejectPatterns.some(pattern => text.includes(pattern));
  }

  checkSettings(text) {
    const settingsPatterns = [
      'einstellungen', 'settings', 'präferenzen', 'auswahl',
      'anpassen', 'konfigurieren', 'verwalten', 'manage'
    ];
    return settingsPatterns.some(pattern => text.includes(pattern));
  }

  checkInfo(text) {
    const infoPatterns = [
      'datenschutz', 'privacy', 'cookies', 'tracking',
      'datenverarbeitung', 'zweck', 'dauer', 'speicherung'
    ];
    return infoPatterns.some(pattern => text.includes(pattern));
  }

  checkPurpose(text) {
    const purposePatterns = [
      'zweck', 'purpose', 'verwendung', 'nutzung',
      'verarbeitung', 'verwendungszweck', 'nutzungszweck'
    ];
    return purposePatterns.some(pattern => text.includes(pattern));
  }

  checkDuration(text) {
    const durationPatterns = [
      'dauer', 'duration', 'zeitraum', 'speicherdauer',
      'ablauf', 'expiry', 'gültigkeit', 'validity'
    ];
    return durationPatterns.some(pattern => text.includes(pattern));
  }

  checkThirdParty(text) {
    const thirdPartyPatterns = [
      'drittanbieter', 'third party', 'partner', 'dienstleister',
      'anbieter', 'provider', 'services', 'dienste'
    ];
    return thirdPartyPatterns.some(pattern => text.includes(pattern));
  }

  checkWithdraw(text) {
    const withdrawPatterns = [
      'widerruf', 'withdraw', 'zurückziehen', 'ändern',
      'ändern', 'change', 'modify', 'update'
    ];
    return withdrawPatterns.some(pattern => text.includes(pattern));
  }

  checkCookieInfo(text) {
    const cookiePatterns = [
      'cookie', 'cookies', 'browser-storage', 'speicherung',
      'local storage', 'session storage', 'web storage'
    ];
    return cookiePatterns.some(pattern => text.includes(pattern));
  }

  checkTrackingInfo(text) {
    const trackingPatterns = [
      'tracking', 'verfolgung', 'analyse', 'statistik',
      'messung', 'measurement', 'monitoring', 'überwachung'
    ];
    return trackingPatterns.some(pattern => text.includes(pattern));
  }

  checkOptOut(text) {
    const optOutPatterns = [
      'opt-out', 'ablehnen', 'deaktivieren', 'ausschalten',
      'nicht erlauben', 'nicht zustimmen', 'widerspruch'
    ];
    return optOutPatterns.some(pattern => text.includes(pattern));
  }

  checkStorageInfo(text) {
    const storagePatterns = [
      'speicherung', 'storage', 'speichern', 'save',
      'persistenz', 'persistence', 'dauerhaft', 'temporär'
    ];
    return storagePatterns.some(pattern => text.includes(pattern));
  }

  checkGermanLanguage(text) {
    const germanPatterns = [
      'datenschutz', 'cookies', 'einwilligung', 'zustimmung',
      'einstellungen', 'präferenzen', 'ablehnen', 'akzeptieren'
    ];
    return germanPatterns.some(pattern => text.includes(pattern));
  }

  checkGermanSettings(text) {
    const germanSettingsPatterns = [
      'einstellungen', 'präferenzen', 'auswahl', 'anpassen',
      'konfigurieren', 'verwalten', 'bearbeiten', 'ändern'
    ];
    return germanSettingsPatterns.some(pattern => text.includes(pattern));
  }

  checkGermanButtons(text) {
    const germanButtonPatterns = [
      'akzeptieren', 'ablehnen', 'einstellungen', 'speichern',
      'auswahl bestätigen', 'alle akzeptieren', 'nur notwendige'
    ];
    return germanButtonPatterns.some(pattern => text.includes(pattern));
  }

  checkGermanPrivacy(text) {
    const germanPrivacyPatterns = [
      'datenschutzerklärung', 'datenschutzrichtlinie', 'datenschutzbestimmungen',
      'datenschutzhinweise', 'datenschutzinformationen', 'datenschutzvereinbarung'
    ];
    return germanPrivacyPatterns.some(pattern => text.includes(pattern));
  }

  checkContrast(styles) {
    // Überprüfe Kontrast-Verhältnis
    const backgroundColor = styles.backgroundColor;
    const textColor = styles.color;
    // Implementiere Kontrast-Berechnung
    return true; // Vereinfachte Version
  }

  checkReadability(styles) {
    // Überprüfe Schriftgröße und -art
    const fontSize = parseInt(styles.fontSize);
    const fontFamily = styles.fontFamily;
    return fontSize >= 12 && fontFamily.includes('sans-serif');
  }

  isAccessible(element) {
    // Überprüfe ARIA-Attribute und Tastatur-Zugänglichkeit
    const hasAriaLabel = element.hasAttribute('aria-label');
    const hasRole = element.hasAttribute('role');
    const isFocusable = element.tabIndex >= 0;
    return hasAriaLabel || hasRole || isFocusable;
  }

  collectViolations(compliance) {
    // Sammle alle Verstöße
    Object.keys(compliance).forEach(regulation => {
      const checks = compliance[regulation].checks;
      Object.keys(checks).forEach(check => {
        if (!checks[check]) {
          compliance[regulation].violations.push(check);
        }
      });
    });
  }

  logProblematicSites() {
    // Liste von problematischen Domains (z. B. Pornoseiten)
    const problematicDomains = [
      'pornhub.com',
      'xvideos.com',
      'xhamster.com',
      'youporn.com',
      'redtube.com'
    ];
    
    if (problematicDomains.includes(this.domain)) {
      console.warn('⚠️ Cookie Guardian: Problematic site detected:', this.domain);
      console.warn('⚠️ Cookie Guardian: Diese Seite kann problematische Inhalte enthalten. Bitte beachten Sie die Datenschutzrichtlinien.');
      this.showBlockingError();
    }
  }

  showBlockingError() {
    const errorDiv = document.createElement('div');
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '10px';
    errorDiv.style.left = '10px';
    errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
    errorDiv.style.color = 'white';
    errorDiv.style.padding = '10px';
    errorDiv.style.borderRadius = '5px';
    errorDiv.style.zIndex = '9999';
    errorDiv.innerHTML = `
      <strong>Warnung:</strong> Die Seite ${this.domain} versucht CookieGuard zu blockieren. Wir arbeiten daran, dass solche Seiten bald keinen Ärger mehr machen.<br>
      <em>Hinweis:</em> Bitte beachten Sie, dass auf dieser Seite möglicherweise Datenschutzverletzungen auftreten können. Wir empfehlen, vorsichtig zu sein und Ihre Daten zu schützen.<br>
      <strong>Rote Ampel:</strong> Anbieter gibt Daten an Drittanbieter weiter. Wir empfehlen, nur essentielle Cookies zu aktivieren oder ganz zu blockieren.
    `;
    document.body.appendChild(errorDiv);
  }

  /**
   * Erweitert die Banner-Erkennung mit Crawler-Selektoren
   */
  enhanceBannerDetection() {
    if (!this.siteData || !this.siteData.banner) return;
    
    const bannerSelectors = this.siteData.banner.selectors;
    
    // Füge Crawler-Selektoren zu den Standard-Selektoren hinzu
    if (bannerSelectors.container && bannerSelectors.container.length > 0) {
      this.bannerSelectors = [...this.bannerSelectors, ...bannerSelectors.container];
    }
    
    // Speichere spezifische Button-Selektoren für automatische Aktionen
    this.crawlerSelectors = {
      accept: bannerSelectors.accept || [],
      reject: bannerSelectors.reject || [],
      settings: bannerSelectors.settings || [],
      close: bannerSelectors.close || []
    };
    
    console.log('🔧 Enhanced banner detection with crawler selectors:', this.crawlerSelectors);
  }
  
  /**
   * Aktualisiert das Badge mit Site-Informationen
   */
  updateBadgeWithSiteInfo() {
    if (!this.siteInfo) return;
    
    const rating = this.siteInfo.rating;
    const cookieCount = this.siteInfo.cookieCount;
    
    // Sende Badge-Update an Background-Script
    chrome.runtime.sendMessage({
      type: 'UPDATE_BADGE',
      rating: rating,
      cookieCount: cookieCount,
      domain: this.domain
    });
  }

  /**
   * Setup Message Listener für Database-Updates
   */
  setupDatabaseUpdateListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'DATABASE_UPDATED') {
        console.log(`📊 Database updated: ${message.newSites} new sites, ${message.updatedSites} updated`);
        
        // Lade Site-Daten neu
        this.loadSiteData();
        
        // Zeige kurze Benachrichtigung
        this.showUpdateNotification(message.newSites, message.updatedSites);
      }
    });
  }
  
  /**
   * Zeigt eine kurze Benachrichtigung über Database-Updates
   */
  showUpdateNotification(newSites, updatedSites) {
    if (newSites === 0 && updatedSites === 0) return;
    
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: opacity 0.3s ease;
    `;
    
    notification.innerHTML = `
      <strong>🔄 CookieGuard Database aktualisiert</strong><br>
      ${newSites > 0 ? `${newSites} neue Seiten, ` : ''}${updatedSites} Seiten aktualisiert
    `;
    
    document.body.appendChild(notification);
    
    // Entferne Benachrichtigung nach 3 Sekunden
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  /**
   * Fallback-Erkennung für Banner, die nicht mit Standard-Selektoren gefunden werden
   */
  detectBannersFallback() {
    // Suche nach Elementen mit Cookie-relevanten Texten
    const allElements = document.querySelectorAll('div, section, aside, header, footer, nav');
    const cookieKeywords = [
      'cookie', 'cookies', 'datenschutz', 'privacy', 'consent', 'einwilligung',
      'tracking', 'analytics', 'werbung', 'marketing', 'personalisierung'
    ];
    
    for (const element of allElements) {
      if (!this.isVisible(element)) continue;
      
      const text = element.textContent.toLowerCase();
      const hasKeywords = cookieKeywords.some(keyword => text.includes(keyword));
      
      if (hasKeywords && text.length > 50 && text.length < 2000) {
        // Prüfe ob es Buttons gibt
        const buttons = element.querySelectorAll('button, a, [role="button"]');
        if (buttons.length >= 1) {
          console.log(`🎯 Fallback banner detected:`, element);
          this.handleBannerDetected(element);
          return;
        }
      }
    }
    
    console.log('❌ No banners detected with fallback method either');
  }

  /**
   * Startet die Banner-Erkennung mit Retry-Logik
   */
  startBannerDetection() {
    // Sofortige Erkennung
    this.detectBanners();
    
    // Starte Observer für dynamische Banner
    this.observeForBanners();
    
    // Retry-Logik: Versuche Banner-Erkennung mehrmals
    const retryIntervals = [1000, 3000, 5000, 10000]; // 1s, 3s, 5s, 10s
    
    retryIntervals.forEach((delay, index) => {
      setTimeout(() => {
        if (!this.bannerDetected) {
          console.log(`🔄 Retry banner detection #${index + 1} after ${delay}ms`);
          this.detectBanners();
        }
      }, delay);
    });
    
    // Additional retry mechanism
    if (this.currentRetryCount < this.maxRetries) {
      this.currentRetryCount++;
      setTimeout(() => this.startBannerDetection(), 2000);
    }
  }

  // 🔧 NEW: Intelligente Overlay-Positionierung
  positionOverlayIntelligently(overlay, banner) {
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const bannerRect = banner ? banner.getBoundingClientRect() : null;
    
    let position = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)'
    };
    
    // Prüfe Banner-Position und Viewport
    if (bannerRect) {
      if (bannerRect.top > 400) {
        // Banner ist unten, Overlay oben
        position.top = '20px';
        position.transform = 'translateX(-50%)';
      } else if (bannerRect.bottom < viewportHeight - 400) {
        // Banner ist oben, Overlay darunter
        position.top = Math.min(bannerRect.bottom + 20, viewportHeight - 400) + 'px';
        position.transform = 'translateX(-50%)';
      }
    }
    
    // Mobile Anpassungen
    if (viewportWidth < 768) {
      position.top = '20px';
      position.left = '20px';
      position.transform = 'none';
      overlay.style.right = '20px';
      overlay.style.width = 'calc(100vw - 40px)';
    }
    
    // Positionierung anwenden
    overlay.style.position = 'fixed';
    overlay.style.top = position.top;
    overlay.style.left = position.left;
    overlay.style.transform = position.transform;
  }

  applyModernZIndex(overlay) {
    const modernZIndex = 'calc(infinity)';
    const fallbackZIndex = '2147483647';
    
    overlay.style.zIndex = modernZIndex;
    
    // Test für Browser-Kompatibilität
    const testElement = document.createElement('div');
    testElement.style.zIndex = modernZIndex;
    
    if (!testElement.style.zIndex || testElement.style.zIndex === '') {
      overlay.style.zIndex = fallbackZIndex;
      console.log('🎯 Fallback zu numerischem z-index');
    }
    
    // Zusätzliche Stacking-Context Eigenschaften
    overlay.style.isolation = 'isolate';
    overlay.style.contain = 'layout style paint';
  }

  attachOverlayToDOM(overlay) {
    // Standard DOM-Anhängen mit Verbesserungen
    overlay.style.pointerEvents = 'auto';
    overlay.style.boxSizing = 'border-box';
    overlay.style.margin = '0';
    overlay.style.padding = '0';
    
    document.body.appendChild(overlay);
    
    // Sicherstellen, dass Overlay sichtbar ist
    requestAnimationFrame(() => {
      if (overlay.offsetHeight === 0 || overlay.offsetWidth === 0) {
        console.warn('🎯 Overlay unsichtbar, repositioniere...');
        this.repositionOverlay(overlay);
      }
    });
  }

  setupOverlayVisibilityMonitoring(overlay) {
    if (!window.IntersectionObserver) return;
    
    this.overlayVisibilityObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.intersectionRatio < 0.8) {
          console.warn('🎯 Guardian Overlay teilweise verdeckt, korrigiere Position');
          this.repositionOverlay(overlay);
        }
      });
    }, {
      threshold: [0.1, 0.5, 0.8, 1.0]
    });
    
    this.overlayVisibilityObserver.observe(overlay);
  }
}

  // 🔧 NEW: Hilfsmethoden für verbesserte Overlay-Funktionalität
  getShadowDOMStyles() {
    return `
      /* Shadow DOM spezifische Styles */
      :host {
        all: initial;
        position: fixed !important;
        pointer-events: auto !important;
        z-index: calc(infinity) !important;
      }
    `;
  }

  setupOverlayVisibilityCheck(overlay) {
    if (!window.IntersectionObserver) return;
    
    this.overlayVisibilityObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.intersectionRatio < 0.1) {
          console.warn('🎯 Guardian Overlay teilweise verdeckt, korrigiere Position');
          this.repositionOverlay(overlay);
        }
      });
    }, {
      threshold: [0.1, 0.5, 0.9]
    });
    
    this.overlayVisibilityObserver.observe(overlay);
  }

  repositionOverlay(overlay) {
    const rect = overlay.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // Prüfe ob Overlay sichtbar ist
    if (rect.bottom > viewportHeight || rect.right > viewportWidth || rect.top < 0 || rect.left < 0) {
      // Repositioniere zu sicherer Position
      overlay.style.top = '20px';
      overlay.style.left = '50%';
      overlay.style.transform = 'translateX(-50%)';
      
      // Mobile Fallback
      if (viewportWidth < 768) {
        overlay.style.left = '10px';
        overlay.style.transform = 'none';
        overlay.style.right = '10px';
      }
      
      console.log('🎯 Overlay repositioniert:', {
        original: rect,
        viewport: `${viewportWidth}x${viewportHeight}`
      });
    }
  }

  // 🔧 IMPROVED: Erweiterte Banner-Erkennung mit besserer Retry-Logik
  detectBannersEnhanced() {
    const startTime = Date.now();
    
    // Prüfe alle bekannten Selektoren
    for (const selector of this.bannerSelectors) {
      const elements = document.querySelectorAll(selector);
      
      for (const element of elements) {
        if (this.isVisible(element) && !element.hasAttribute('data-guardian-processed')) {
          element.setAttribute('data-guardian-processed', 'true');
          
          console.log('🎯 Enhanced Banner Detection:', {
            selector: selector,
            element: element.tagName,
            dimensions: element.getBoundingClientRect(),
            timing: Date.now() - startTime
          });
          
          this.handleBannerDetected(element);
          return true;
        }
      }
    }
    
    // Erweiterte Heuristik für dynamische Banner
    return this.detectDynamicBanners();
  }

  detectDynamicBanners() {
    // Suche nach Elementen mit Cookie-bezogenen Texten
    const cookieTexts = [
      'cookie', 'cookies', 'datenschutz', 'privacy', 'consent', 
      'einwilligung', 'zustimmung', 'tracking', 'gdpr', 'dsgvo'
    ];
    
    const allElements = document.querySelectorAll('div, section, aside, footer, header');
    
    for (const element of allElements) {
      if (element.hasAttribute('data-guardian-processed')) continue;
      
      const text = element.textContent.toLowerCase();
      const hasButtons = element.querySelectorAll('button, a, [role="button"]').length >= 2;
      const isVisible = this.isVisible(element);
      const isLargeEnough = element.offsetWidth > 200 && element.offsetHeight > 50;
      
      if (isVisible && isLargeEnough && hasButtons) {
        const cookieTextMatches = cookieTexts.filter(term => text.includes(term)).length;
        
        if (cookieTextMatches >= 2) {
          element.setAttribute('data-guardian-processed', 'true');
          console.log('🎯 Dynamic Banner detected:', {
            element: element.tagName,
            matches: cookieTextMatches,
            buttons: hasButtons
          });
          
          this.handleBannerDetected(element);
          return true;
        }
      }
    }
    
    return false;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new CookieGuardianContent());
} else {
  new CookieGuardianContent();
}