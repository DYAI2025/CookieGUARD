/**
 * DIYrigent Analytics - Kundendaten-Analyse und Muster-Erkennung
 * @author Benjamin Poersch
 * @description Intelligente Analyse von Website-Besuchern und Kundenverhalten
 */

class DIYrigentAnalytics {
    constructor(config = {}) {
        this.config = {
            apiEndpoint: config.apiEndpoint || '/api/analytics',
            trackingId: config.trackingId || 'DIY-' + Date.now(),
            sessionTimeout: config.sessionTimeout || 30 * 60 * 1000, // 30 Minuten
            ...config
        };
        
        this.sessionData = {
            sessionId: this.generateSessionId(),
            startTime: new Date(),
            pageViews: [],
            interactions: [],
            userProfile: {},
            leadScore: 0
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.identifyUser();
        this.trackPageView();
        this.startSessionTracking();
    }
    
    // Session Management
    generateSessionId() {
        return 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }
    
    setupEventListeners() {
        // Scroll-Tracking
        let scrollDepth = 0;
        window.addEventListener('scroll', () => {
            const currentDepth = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
            if (currentDepth > scrollDepth && currentDepth % 25 === 0) {
                scrollDepth = currentDepth;
                this.trackEvent('scroll_depth', { depth: scrollDepth });
            }
        });
        
        // Click-Tracking
        document.addEventListener('click', (e) => {
            this.trackClick(e);
        });
        
        // Form-Tracking
        document.addEventListener('submit', (e) => {
            this.trackFormSubmission(e);
        });
        
        // Time on Page
        this.startTimeTracking();
    }
    
    // User Identification
    identifyUser() {
        // Check for returning user
        const userId = localStorage.getItem('diyrigent_user_id');
        if (userId) {
            this.sessionData.userId = userId;
            this.loadUserProfile(userId);
        } else {
            // Generate anonymous user ID
            const newUserId = 'anon_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('diyrigent_user_id', newUserId);
            this.sessionData.userId = newUserId;
        }
        
        // Collect user context
        this.collectUserContext();
    }
    
    collectUserContext() {
        const context = {
            userAgent: navigator.userAgent,
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            screenResolution: `${screen.width}x${screen.height}`,
            referrer: document.referrer,
            utmParams: this.getUtmParams(),
            deviceType: this.getDeviceType(),
            browserInfo: this.getBrowserInfo()
        };
        
        this.sessionData.userContext = context;
    }
    
    getUtmParams() {
        const params = new URLSearchParams(window.location.search);
        return {
            source: params.get('utm_source'),
            medium: params.get('utm_medium'),
            campaign: params.get('utm_campaign'),
            term: params.get('utm_term'),
            content: params.get('utm_content')
        };
    }
    
    getDeviceType() {
        const width = window.innerWidth;
        if (width < 768) return 'mobile';
        if (width < 1024) return 'tablet';
        return 'desktop';
    }
    
    getBrowserInfo() {
        const ua = navigator.userAgent;
        let browser = 'unknown';
        
        if (ua.includes('Chrome')) browser = 'chrome';
        else if (ua.includes('Firefox')) browser = 'firefox';
        else if (ua.includes('Safari')) browser = 'safari';
        else if (ua.includes('Edge')) browser = 'edge';
        
        return browser;
    }
    
    // Event Tracking
    trackPageView() {
        const pageData = {
            url: window.location.href,
            title: document.title,
            timestamp: new Date(),
            referrer: document.referrer
        };
        
        this.sessionData.pageViews.push(pageData);
        this.calculateLeadScore();
        
        // Send to server
        this.sendAnalytics('page_view', pageData);
    }
    
    trackEvent(eventName, properties = {}) {
        const eventData = {
            event: eventName,
            properties: properties,
            timestamp: new Date(),
            page: window.location.pathname
        };
        
        this.sessionData.interactions.push(eventData);
        this.calculateLeadScore();
        
        // Send to server
        this.sendAnalytics('event', eventData);
    }
    
    trackClick(event) {
        const element = event.target;
        const clickData = {
            element: element.tagName,
            text: element.textContent?.slice(0, 100),
            classes: element.className,
            id: element.id,
            href: element.href,
            position: {
                x: event.clientX,
                y: event.clientY
            }
        };
        
        // Special tracking for important elements
        if (element.classList.contains('cta-button')) {
            this.trackEvent('cta_click', clickData);
        } else if (element.tagName === 'A') {
            this.trackEvent('link_click', clickData);
        } else if (element.type === 'submit') {
            this.trackEvent('form_submit_click', clickData);
        }
    }
    
    trackFormSubmission(event) {
        const form = event.target;
        const formData = new FormData(form);
        const formFields = {};
        
        for (let [key, value] of formData.entries()) {
            formFields[key] = value;
        }
        
        this.trackEvent('form_submission', {
            formId: form.id,
            formFields: formFields,
            formAction: form.action
        });
        
        // Update lead score significantly for form submissions
        this.sessionData.leadScore += 50;
    }
    
    // Lead Scoring
    calculateLeadScore() {
        let score = 0;
        
        // Page-based scoring
        const currentPage = window.location.pathname;
        const pageScores = {
            '/services': 20,
            '/agile-coaching': 25,
            '/scrum-training': 25,
            '/case-studies': 15,
            '/about': 10,
            '/contact': 30,
            '/blog': 5
        };
        
        Object.keys(pageScores).forEach(page => {
            if (currentPage.includes(page)) {
                score += pageScores[page];
            }
        });
        
        // Time-based scoring
        const timeOnSite = (new Date() - this.sessionData.startTime) / 1000;
        if (timeOnSite > 60) score += 10;
        if (timeOnSite > 180) score += 20;
        if (timeOnSite > 300) score += 30;
        
        // Interaction-based scoring
        const interactions = this.sessionData.interactions;
        score += interactions.filter(i => i.event === 'cta_click').length * 20;
        score += interactions.filter(i => i.event === 'scroll_depth').length * 2;
        score += interactions.filter(i => i.event === 'form_submission').length * 50;
        
        // Traffic source scoring
        const utmSource = this.sessionData.userContext?.utmParams?.source;
        const sourceScores = {
            'google': 10,
            'linkedin': 25,
            'direct': 15,
            'email': 30,
            'referral': 20
        };
        
        if (sourceScores[utmSource]) {
            score += sourceScores[utmSource];
        }
        
        this.sessionData.leadScore = Math.min(score, 100); // Cap at 100
        
        // Trigger events based on score
        if (score >= 70 && !this.sessionData.highValueTriggered) {
            this.triggerHighValueProspect();
            this.sessionData.highValueTriggered = true;
        }
    }
    
    triggerHighValueProspect() {
        // Show personalized offer or contact form
        this.showPersonalizedMessage();
        
        // Notify sales team
        this.notifySalesTeam();
    }
    
    showPersonalizedMessage() {
        const message = document.createElement('div');
        message.className = 'high-value-notification';
        message.innerHTML = `
            <div style="position: fixed; top: 20px; right: 20px; background: #667eea; color: white; padding: 20px; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); z-index: 10000; max-width: 300px;">
                <h4>🎯 Individuelle Beratung gewünscht?</h4>
                <p>Basierend auf Ihrem Interesse bieten wir Ihnen ein kostenloses Erstgespräch an.</p>
                <button onclick="this.parentElement.parentElement.remove(); document.getElementById('contact').scrollIntoView({behavior: 'smooth'});" style="background: #ff6b6b; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                    Jetzt Termin buchen
                </button>
                <button onclick="this.parentElement.parentElement.remove()" style="background: transparent; color: white; border: 1px solid white; padding: 8px 16px; border-radius: 5px; cursor: pointer; margin-left: 10px;">
                    Später
                </button>
            </div>
        `;
        
        document.body.appendChild(message);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (message.parentElement) {
                message.remove();
            }
        }, 10000);
    }
    
    notifySalesTeam() {
        const notification = {
            type: 'high_value_prospect',
            sessionId: this.sessionData.sessionId,
            userId: this.sessionData.userId,
            leadScore: this.sessionData.leadScore,
            userContext: this.sessionData.userContext,
            pageViews: this.sessionData.pageViews,
            interactions: this.sessionData.interactions,
            timestamp: new Date()
        };
        
        this.sendAnalytics('sales_notification', notification);
    }
    
    // Time Tracking
    startTimeTracking() {
        this.timeTracker = setInterval(() => {
            this.trackEvent('time_on_page', {
                duration: (new Date() - this.sessionData.startTime) / 1000,
                page: window.location.pathname
            });
        }, 30000); // Every 30 seconds
    }
    
    // Session Tracking
    startSessionTracking() {
        // Save session data periodically
        setInterval(() => {
            this.saveSessionData();
        }, 60000); // Every minute
        
        // Save on page unload
        window.addEventListener('beforeunload', () => {
            this.endSession();
        });
    }
    
    saveSessionData() {
        localStorage.setItem('diyrigent_session', JSON.stringify(this.sessionData));
    }
    
    endSession() {
        this.sessionData.endTime = new Date();
        this.sessionData.duration = (this.sessionData.endTime - this.sessionData.startTime) / 1000;
        
        // Send final session data
        this.sendAnalytics('session_end', this.sessionData);
        
        // Clear time tracker
        if (this.timeTracker) {
            clearInterval(this.timeTracker);
        }
    }
    
    // User Profile Management
    loadUserProfile(userId) {
        // Load from localStorage or API
        const profile = localStorage.getItem(`diyrigent_profile_${userId}`);
        if (profile) {
            this.sessionData.userProfile = JSON.parse(profile);
        }
    }
    
    updateUserProfile(data) {
        this.sessionData.userProfile = { ...this.sessionData.userProfile, ...data };
        localStorage.setItem(`diyrigent_profile_${this.sessionData.userId}`, JSON.stringify(this.sessionData.userProfile));
    }
    
    // Company Detection
    detectCompany() {
        // Try to detect company from email domain or IP
        const email = this.sessionData.userProfile.email;
        if (email) {
            const domain = email.split('@')[1];
            if (domain && !['gmail.com', 'yahoo.com', 'outlook.com', 'web.de'].includes(domain)) {
                this.sessionData.userProfile.company_domain = domain;
                this.enrichCompanyData(domain);
            }
        }
    }
    
    enrichCompanyData(domain) {
        // Call API to enrich company data
        fetch(`/api/company-enrichment?domain=${domain}`)
            .then(response => response.json())
            .then(data => {
                this.updateUserProfile({
                    company_name: data.name,
                    company_size: data.size,
                    industry: data.industry,
                    location: data.location
                });
            })
            .catch(error => {
                console.log('Company enrichment failed:', error);
            });
    }
    
    // A/B Testing
    getABTestVariant(testName) {
        const userId = this.sessionData.userId;
        const hash = this.hashCode(userId + testName);
        
        const tests = {
            'homepage_cta': {
                variants: ['control', 'variant_a', 'variant_b'],
                weights: [0.33, 0.33, 0.34]
            },
            'pricing_display': {
                variants: ['table', 'cards'],
                weights: [0.5, 0.5]
            }
        };
        
        if (!tests[testName]) return 'control';
        
        const test = tests[testName];
        const random = Math.abs(hash) / 2147483647; // Normalize hash to 0-1
        
        let cumulative = 0;
        for (let i = 0; i < test.variants.length; i++) {
            cumulative += test.weights[i];
            if (random <= cumulative) {
                this.trackEvent('ab_test_assignment', {
                    test: testName,
                    variant: test.variants[i]
                });
                return test.variants[i];
            }
        }
        
        return test.variants[0];
    }
    
    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash;
    }
    
    // Analytics API
    sendAnalytics(eventType, data) {
        const payload = {
            eventType: eventType,
            sessionId: this.sessionData.sessionId,
            userId: this.sessionData.userId,
            timestamp: new Date().toISOString(),
            data: data
        };
        
        // Send to server
        if (navigator.sendBeacon) {
            navigator.sendBeacon(this.config.apiEndpoint, JSON.stringify(payload));
        } else {
            fetch(this.config.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            }).catch(error => {
                console.log('Analytics send failed:', error);
            });
        }
    }
    
    // Public API Methods
    identify(userId, traits = {}) {
        this.sessionData.userId = userId;
        this.updateUserProfile(traits);
        localStorage.setItem('diyrigent_user_id', userId);
        
        this.trackEvent('user_identified', { userId, traits });
        this.detectCompany();
    }
    
    track(eventName, properties = {}) {
        this.trackEvent(eventName, properties);
    }
    
    getLeadScore() {
        return this.sessionData.leadScore;
    }
    
    getSessionData() {
        return this.sessionData;
    }
    
    // Heatmap Data Collection
    collectHeatmapData() {
        const clicks = [];
        const scrollDepth = [];
        
        document.addEventListener('click', (e) => {
            clicks.push({
                x: e.clientX,
                y: e.clientY,
                timestamp: new Date(),
                element: e.target.tagName
            });
        });
        
        window.addEventListener('scroll', () => {
            scrollDepth.push({
                depth: window.scrollY,
                timestamp: new Date()
            });
        });
        
        // Send heatmap data every 2 minutes
        setInterval(() => {
            if (clicks.length > 0 || scrollDepth.length > 0) {
                this.sendAnalytics('heatmap_data', {
                    clicks: clicks.splice(0),
                    scrollDepth: scrollDepth.splice(0),
                    page: window.location.pathname
                });
            }
        }, 120000);
    }
}

// Initialize Analytics
window.DIYrigentAnalytics = DIYrigentAnalytics;

// Auto-initialize if not already done
if (typeof window.diyrigentAnalytics === 'undefined') {
    window.diyrigentAnalytics = new DIYrigentAnalytics({
        apiEndpoint: '/api/analytics',
        trackingId: 'DIY-ANALYTICS-2025'
    });
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DIYrigentAnalytics;
} 