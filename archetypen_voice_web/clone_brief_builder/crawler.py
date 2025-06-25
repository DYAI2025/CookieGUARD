"""Headless crawler with cookie handling, asset downloading and screenshot capture."""
from __future__ import annotations

import asyncio
import json
import os
import shutil
import urllib.parse
from pathlib import Path
from typing import Dict, List, Optional, Set
from urllib.parse import urljoin, urlparse

import aiofiles
from playwright.async_api import async_playwright, Page, BrowserContext

# Import des aggressiven Scanners
try:
    from ..aggressive_cookie_scanner import AggressiveCookieScanner
except ImportError:
    print("⚠️ Aggressiver Scanner nicht verfügbar. Normale Crawler-Funktionen bleiben verfügbar.")
    AggressiveCookieScanner = None


class WebCrawler:
    """Headless browser crawler with cookie handling and asset extraction."""
    
    def __init__(self, output_dir: str = "snapshots", enable_forensik: bool = False):
        self.base_output_dir = Path(output_dir)
        self.enable_forensik = enable_forensik
        
        # Initialize fresh state for each instance
        self.downloaded_assets: Set[str] = set()
        self.api_calls: List[Dict] = []
        self.output_dir = None
        self.assets_dir = None
        self.mock_api_dir = None
        self.screenshots_dir = None
        self.header_options = None
        
        # 🚨 AGGRESSIVE FORENSIK FEATURES 🚨
        self.tracking_evidence = {
            'cookies_placed': [],
            'tracking_requests': [],
            'fingerprinting_attempts': [],
            'dark_patterns': [],
            'gdpr_violations': [],
            'suspicious_scripts': []
        }
        
        # Aggressiver Scanner (falls aktiviert)
        if self.enable_forensik and AggressiveCookieScanner:
            self.forensik_scanner = AggressiveCookieScanner(str(self.base_output_dir / "forensik"))
            print("🚨 AGGRESSIVE FORENSIK MODE ENABLED 🚨")
        else:
            self.forensik_scanner = None
        
    def _reset_state(self):
        """Reset internal state for fresh crawl."""
        self.downloaded_assets.clear()
        self.api_calls.clear()
        
    def _get_website_name(self, url: str) -> str:
        """Extract clean website name from URL for folder naming."""
        parsed = urlparse(url)
        domain = parsed.netloc.replace('www.', '')
        
        # Clean domain for folder name
        clean_name = domain.replace('.', '_').replace('-', '_')
        
        # Add path if significant
        path = parsed.path.strip('/')
        if path and path != '':
            path_clean = path.replace('/', '_').replace('.', '_')[:50]  # Limit length
            clean_name += f"_{path_clean}"
        
        return clean_name
    
    async def crawl_site(self, url: str, handle_cookies: bool = True, header_options: dict = None, deep_forensik: bool = False) -> Dict[str, any]:
        """Main crawling method with organized output structure and optional aggressive forensik."""
        # Reset state for fresh crawl
        self._reset_state()
        self.header_options = header_options
        
        website_name = self._get_website_name(url)
        self.output_dir = self.base_output_dir / website_name
        self.assets_dir = self.output_dir / "assets"
        self.mock_api_dir = self.output_dir / "mock_api"
        self.screenshots_dir = self.output_dir / "screenshots"
        
        browser = None
        context = None
        page = None
        
        try:
            # Create output directories
            self.output_dir.mkdir(parents=True, exist_ok=True)
            self.assets_dir.mkdir(parents=True, exist_ok=True)
            
            async with async_playwright() as playwright:
                # 🚨 AGGRESSIVE BROWSER LAUNCH für Forensik
                if self.enable_forensik:
                    browser = await playwright.chromium.launch(
                        headless=True,
                        args=[
                            '--no-sandbox', 
                            '--disable-setuid-sandbox',
                            '--disable-web-security',  # Aggressive für Forensik
                            '--aggressive-cache-discard',
                            '--enable-logging',
                            '--enable-experimental-web-platform-features'
                        ]
                    )
                else:
                    browser = await playwright.chromium.launch(
                        headless=True,
                        args=['--no-sandbox', '--disable-setuid-sandbox']
                    )
                
                context = await browser.new_context(
                    user_agent=f"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 {'CookieForensik/1.0' if self.enable_forensik else 'Chrome/126.0.0.0'} Safari/537.36",
                    viewport={"width": 1920, "height": 1080},
                    ignore_https_errors=True
                )
                
                # 🚨 AGGRESSIVE API INTERCEPTION für Forensik
                if self.enable_forensik:
                    await self._setup_aggressive_interception(context, url)
                else:
                    await self._setup_api_interception(context)
                
                page = await context.new_page()
                
                # 🔍 FINGERPRINTING DETECTION INJECTION
                if self.enable_forensik:
                    await self._inject_forensik_monitoring(page)
                
                # Navigate to page with timeout
                print(f"🌐 Navigiere zu {url}...")
                await page.goto(url, wait_until="networkidle", timeout=30000)
                
                # 🚨 AGGRESSIVE COOKIE BANNER ANALYSIS
                if handle_cookies:
                    if self.enable_forensik:
                        await self._aggressive_cookie_banner_analysis(page)
                    else:
                        await self._handle_cookie_banners(page)
                    await page.wait_for_timeout(2000)
                
                # 🔬 FORENSIK-SPEZIFISCHE ANALYSEN
                if self.enable_forensik and deep_forensik:
                    await self._deep_forensik_analysis(page, url)
                
                # Take screenshots
                await self._take_screenshots(page)
                
                # Extract page content
                html_content = await page.content()
                
                # Extract and download assets
                assets = await self._extract_assets(page, url)
                
                # Process HTML to make assets relative and apply header options
                processed_html = await self._process_html_links(html_content, url)
                
                # Apply header modifications if requested
                if self.header_options:
                    processed_html = await self._apply_header_modifications(processed_html, page)
                
                # Create snapshot structure
                await self._create_snapshot(url, processed_html, assets, website_name)
                
                # Save API mocks
                await self._save_api_mocks()
                
                # 📊 SPEICHERE FORENSIK-DATEN
                if self.enable_forensik:
                    await self._save_forensik_evidence(website_name)
                
                result = {
                    "url": url,
                    "website_name": website_name,
                    "html": processed_html,
                    "assets": assets,
                    "api_calls": len(self.api_calls),
                    "snapshot_path": str(self.output_dir),
                    "screenshots": {
                        "full_page": str(self.screenshots_dir / "full_page.png"),
                        "viewport": str(self.screenshots_dir / "viewport.png")
                    },
                    "header_options": self.header_options
                }
                
                # 🚨 FÜGE FORENSIK-DATEN HINZU
                if self.enable_forensik:
                    result["forensik_evidence"] = self.tracking_evidence
                    result["forensik_summary"] = self._generate_forensik_summary()
                    print(f"🚨 Forensik-Analyse abgeschlossen: {result['forensik_summary']['risk_level']}")
                
                return result
                
        except Exception as e:
            print(f"❌ Crawler error: {e}")
            # Provide more detailed error information
            import traceback
            print(f"📋 Stack trace:\n{traceback.format_exc()}")
            raise e
        finally:
            # Ensure cleanup in all cases
            try:
                if page:
                    await page.close()
                if context:
                    await context.close()
                if browser:
                    await browser.close()
            except Exception as cleanup_error:
                print(f"⚠️ Cleanup warning: {cleanup_error}")
    
    async def _apply_header_modifications(self, html: str, page: Page) -> str:
        """Apply header text and style modifications."""
        if not self.header_options or not self.header_options.get('new_header'):
            return html
        
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, 'html.parser')
            
            # Find main header elements
            header_selectors = ['h1', 'header h1', 'header h2', '.header h1', '.header h2', '#header h1']
            header_element = None
            
            for selector in header_selectors:
                elements = soup.select(selector)
                if elements:
                    header_element = elements[0]
                    break
            
            if header_element:
                # Store original styles if needed
                original_style = header_element.get('style', '')
                original_class = header_element.get('class', [])
                
                # Update text
                header_element.string = self.header_options['new_header']
                
                # Apply font if not keeping style
                if not self.header_options.get('keep_style') and self.header_options.get('font_family'):
                    # Create or update style attribute
                    style_dict = {}
                    if original_style:
                        # Parse existing styles
                        for style in original_style.split(';'):
                            if ':' in style:
                                key, value = style.split(':', 1)
                                style_dict[key.strip()] = value.strip()
                    
                    # Add new font-family
                    style_dict['font-family'] = f"'{self.header_options['font_family']}', sans-serif"
                    
                    # Rebuild style string
                    new_style = '; '.join([f"{k}: {v}" for k, v in style_dict.items()])
                    header_element['style'] = new_style
                
                print(f"✏️ Header angepasst: {self.header_options['new_header']}")
            else:
                print("⚠️ Kein Header-Element gefunden zum Anpassen")
            
            return str(soup)
            
        except Exception as e:
            print(f"⚠️ Header-Anpassung fehlgeschlagen: {e}")
            return html
    
    async def _setup_api_interception(self, context: BrowserContext):
        """Setup network interception for API calls."""
        async def handle_route(route):
            try:
                request = route.request
                
                # Check if this is an API call
                if self._is_api_call(request.url):
                    # Record the API call
                    api_call = {
                        "url": request.url,
                        "method": request.method,
                        "headers": dict(request.headers),
                        "post_data": request.post_data
                    }
                    self.api_calls.append(api_call)
                    
                    # Create mock response
                    mock_response = await self._create_mock_response(api_call)
                    await route.fulfill(**mock_response)
                else:
                    # Continue with normal request
                    await route.continue_()
            except Exception as e:
                # If route handling fails, continue normally
                try:
                    await route.continue_()
                except:
                    pass
        
        await context.route("**/*", handle_route)
    
    def _is_api_call(self, url: str) -> bool:
        """Determine if URL is an API call."""
        api_indicators = [
            "/api/", "/rest/", "/graphql", "/ajax/",
            ".json", "/v1/", "/v2/", "/v3/"
        ]
        return any(indicator in url.lower() for indicator in api_indicators)
    
    async def _create_mock_response(self, api_call: Dict) -> Dict:
        """Create mock response for API call."""
        # Simple mock response based on endpoint
        if "user" in api_call["url"].lower():
            body = json.dumps({"id": 1, "name": "Mock User", "email": "mock@example.com"})
        elif "product" in api_call["url"].lower():
            body = json.dumps({"id": 1, "name": "Mock Product", "price": 99.99})
        else:
            body = json.dumps({"status": "success", "data": "mock_data"})
        
        return {
            "status": 200,
            "headers": {"Content-Type": "application/json"},
            "body": body
        }
    
    async def _handle_cookie_banners(self, page: Page):
        """Detect and handle cookie consent banners."""
        cookie_selectors = [
            # Common cookie banner selectors
            '[data-testid*="cookie"]',
            '[class*="cookie"]',
            '[id*="cookie"]',
            '[class*="consent"]',
            '[id*="consent"]',
            'button[aria-label*="Accept"]',
            'button[aria-label*="Akzeptieren"]',
            'button:has-text("Accept")',
            'button:has-text("Akzeptieren")',
            'button:has-text("Alle akzeptieren")',
            'button:has-text("Accept All")',
            '.gdpr-button',
            '#onetrust-accept-btn-handler',
            '[class*="accept"]',
            '[class*="agree"]'
        ]
        
        for selector in cookie_selectors:
            try:
                element = await page.query_selector(selector)
                if element:
                    await element.click()
                    await page.wait_for_timeout(1500)  # Wait for banner to disappear
                    print(f"✅ Cookie banner accepted via: {selector}")
                    break
            except Exception:
                continue
    
    async def _take_screenshots(self, page: Page):
        """Take full page and viewport screenshots."""
        try:
            self.screenshots_dir.mkdir(parents=True, exist_ok=True)
            
            # Full page screenshot
            await page.screenshot(
                path=str(self.screenshots_dir / "full_page.png"),
                full_page=True,
                timeout=10000
            )
            
            # Viewport screenshot
            await page.screenshot(
                path=str(self.screenshots_dir / "viewport.png"),
                full_page=False,
                timeout=10000
            )
            
            print(f"📸 Screenshots saved to {self.screenshots_dir}/")
        except Exception as e:
            print(f"⚠️ Screenshot failed: {e}")
    
    async def _extract_assets(self, page: Page, base_url: str) -> Dict[str, List[str]]:
        """Extract and categorize all page assets."""
        assets = {
            "css": [],
            "js": [],
            "images": [],
            "fonts": [],
            "other": []
        }
        
        try:
            # Extract CSS files
            css_links = await page.query_selector_all('link[rel="stylesheet"]')
            for link in css_links:
                href = await link.get_attribute("href")
                if href:
                    full_url = urljoin(base_url, href)
                    assets["css"].append(full_url)
                    await self._download_asset(full_url, "css")
            
            # Extract JS files
            js_scripts = await page.query_selector_all('script[src]')
            for script in js_scripts:
                src = await script.get_attribute("src")
                if src:
                    full_url = urljoin(base_url, src)
                    assets["js"].append(full_url)
                    await self._download_asset(full_url, "js")
            
            # Extract images
            images = await page.query_selector_all('img[src]')
            for img in images:
                src = await img.get_attribute("src")
                if src and not src.startswith('data:'):  # Skip data URLs
                    full_url = urljoin(base_url, src)
                    assets["images"].append(full_url)
                    await self._download_asset(full_url, "images")
        
        except Exception as e:
            print(f"⚠️ Asset extraction warning: {e}")
        
        return assets
    
    async def _download_asset(self, url: str, asset_type: str):
        """Download individual asset file."""
        if url in self.downloaded_assets or url.startswith('data:'):
            return
        
        try:
            import aiohttp
            timeout = aiohttp.ClientTimeout(total=10)  # 10 second timeout
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url, ssl=False) as response:  # Disable SSL verification for problematic sites
                    if response.status == 200:
                        content = await response.read()
                        
                        # Determine file path
                        parsed_url = urlparse(url)
                        filename = os.path.basename(parsed_url.path) or "index"
                        
                        # Add proper extension if missing
                        if asset_type == "css" and not filename.endswith(".css"):
                            filename += ".css"
                        elif asset_type == "js" and not filename.endswith(".js"):
                            filename += ".js"
                        
                        # Clean filename for filesystem
                        filename = "".join(c for c in filename if c.isalnum() or c in ".-_")[:100]
                        
                        asset_path = self.assets_dir / asset_type / filename
                        asset_path.parent.mkdir(parents=True, exist_ok=True)
                        
                        async with aiofiles.open(asset_path, "wb") as f:
                            await f.write(content)
                        
                        self.downloaded_assets.add(url)
                        print(f"📦 Downloaded: {asset_type}/{filename}")
            
        except Exception as e:
            print(f"⚠️ Failed to download {url}: {e}")
    
    async def _process_html_links(self, html: str, base_url: str) -> str:
        """Process HTML to make asset links relative."""
        # Simple replacements for making assets local
        processed_html = html
        
        # This is a basic implementation - could be enhanced with proper HTML parsing
        for asset_url in self.downloaded_assets:
            try:
                parsed = urlparse(asset_url)
                filename = os.path.basename(parsed.path)
                
                # Clean filename same as in download
                filename = "".join(c for c in filename if c.isalnum() or c in ".-_")[:100]
                
                # Determine asset type and create relative path
                if asset_url.endswith(('.css',)):
                    relative_path = f"assets/css/{filename}"
                elif asset_url.endswith(('.js',)):
                    relative_path = f"assets/js/{filename}"
                elif asset_url.endswith(('.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico')):
                    relative_path = f"assets/images/{filename}"
                else:
                    continue
                    
                processed_html = processed_html.replace(asset_url, relative_path)
            except Exception as e:
                print(f"⚠️ Link processing warning for {asset_url}: {e}")
        
        return processed_html
    
    async def _create_snapshot(self, url: str, html: str, assets: Dict, website_name: str):
        """Create the snapshot directory structure."""
        try:
            # Create directories
            self.output_dir.mkdir(parents=True, exist_ok=True)
            self.assets_dir.mkdir(parents=True, exist_ok=True)
            
            # Save main HTML
            html_path = self.output_dir / "index.html"
            async with aiofiles.open(html_path, "w", encoding="utf-8") as f:
                await f.write(html)
            
            # Save metadata
            metadata = {
                "url": url,
                "website_name": website_name,
                "assets": assets,
                "timestamp": str(asyncio.get_event_loop().time()),
                "downloaded_count": len(self.downloaded_assets),
                "header_options": self.header_options,
                "structure": {
                    "index.html": "Main website content",
                    "assets/": "Downloaded CSS, JS, and images",
                    "screenshots/": "Full page and viewport screenshots",
                    "mock_api/": "Mocked API responses",
                    "metadata.json": "This file with snapshot information"
                }
            }
            
            metadata_path = self.output_dir / "metadata.json"
            async with aiofiles.open(metadata_path, "w") as f:
                await f.write(json.dumps(metadata, indent=2))
        
        except Exception as e:
            print(f"⚠️ Snapshot creation warning: {e}")
    
    async def _save_api_mocks(self):
        """Save API mock data."""
        if not self.api_calls:
            return
        
        try:
            self.mock_api_dir.mkdir(parents=True, exist_ok=True)
            
            mock_path = self.mock_api_dir / "api_calls.json"
            async with aiofiles.open(mock_path, "w") as f:
                await f.write(json.dumps(self.api_calls, indent=2))
        except Exception as e:
            print(f"⚠️ API mock saving warning: {e}")

    async def _setup_aggressive_interception(self, context: BrowserContext, base_url: str):
        """🚨 Setup aggressive network interception für Forensik."""
        async def aggressive_route_handler(route):
            try:
                request = route.request
                url = request.url
                
                # Dokumentiere JEDEN Request
                request_data = {
                    "url": url,
                    "method": request.method,
                    "headers": dict(request.headers),
                    "timestamp": asyncio.get_event_loop().time(),
                    "post_data": request.post_data,
                    "is_third_party": self._is_third_party_request(url, base_url),
                    "is_tracking": self._is_aggressive_tracking_request(url)
                }
                
                # Sammle Tracking-Evidence
                if request_data["is_tracking"]:
                    self.tracking_evidence['tracking_requests'].append(request_data)
                    print(f"🚨 Tracking erkannt: {url}")
                
                # Cookie-Syncing Detection
                if any(keyword in url.lower() for keyword in ['sync', 'pixel', 'beacon', 'collect']):
                    self.tracking_evidence['tracking_requests'].append({
                        **request_data,
                        'type': 'cookie_syncing'
                    })
                
                # Check für verdächtige Scripts
                if request_data["is_third_party"] and url.endswith('.js'):
                    script_analysis = await self._analyze_suspicious_script(request)
                    if script_analysis['suspicious']:
                        self.tracking_evidence['suspicious_scripts'].append({
                            **request_data,
                            'analysis': script_analysis
                        })
                
                # API Call Detection (erweitert)
                if self._is_api_call(url):
                    api_call = {
                        **request_data,
                        "forensik_flags": self._analyze_api_call_forensik(request_data)
                    }
                    self.api_calls.append(api_call)
                    
                    # Erstelle Mock Response
                    mock_response = await self._create_mock_response(api_call)
                    await route.fulfill(**mock_response)
                else:
                    await route.continue_()
                    
            except Exception as e:
                print(f"⚠️ Aggressive interception error: {e}")
                try:
                    await route.continue_()
                except:
                    pass
        
        await context.route("**/*", aggressive_route_handler)
    
    async def _inject_forensik_monitoring(self, page: Page):
        """🔬 Injiziert aggressiven Forensik-Monitoring-Code."""
        await page.add_init_script("""
            // 🚨 AGGRESSIVE FINGERPRINTING DETECTION 🚨
            window.forensikData = {
                fingerprinting: [],
                cookieOperations: [],
                storageAccess: [],
                apiCalls: []
            };
            
            // Canvas Fingerprinting - AGGRESSIVE
            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function(...args) {
                const stack = new Error().stack;
                window.forensikData.fingerprinting.push({
                    type: 'canvas_toDataURL',
                    timestamp: Date.now(),
                    args: args,
                    stack: stack.split('\\n').slice(0, 10),
                    suspicious: true
                });
                console.warn('🚨 CANVAS FINGERPRINTING DETECTED');
                return originalToDataURL.apply(this, args);
            };
            
            // WebGL Fingerprinting
            const originalGetContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function(type, ...args) {
                if (type === 'webgl' || type === 'experimental-webgl') {
                    window.forensikData.fingerprinting.push({
                        type: 'webgl_context',
                        timestamp: Date.now(),
                        contextType: type
                    });
                    console.warn('🚨 WEBGL FINGERPRINTING DETECTED');
                }
                return originalGetContext.call(this, type, ...args);
            };
            
            // Audio Fingerprinting
            if (window.AudioContext) {
                const OriginalAudioContext = window.AudioContext;
                window.AudioContext = function(...args) {
                    window.forensikData.fingerprinting.push({
                        type: 'audio_context',
                        timestamp: Date.now()
                    });
                    console.warn('🚨 AUDIO FINGERPRINTING DETECTED');
                    return new OriginalAudioContext(...args);
                };
            }
            
            // Cookie Operations - AGGRESSIVE MONITORING
            const originalCookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
            Object.defineProperty(document, 'cookie', {
                get: function() {
                    window.forensikData.cookieOperations.push({
                        type: 'cookie_read',
                        timestamp: Date.now(),
                        stack: new Error().stack.split('\\n').slice(0, 5)
                    });
                    return originalCookieDescriptor.get.call(this);
                },
                set: function(value) {
                    window.forensikData.cookieOperations.push({
                        type: 'cookie_write',
                        value: value,
                        timestamp: Date.now(),
                        stack: new Error().stack.split('\\n').slice(0, 5),
                        suspicious: this._isTrackingCookie(value)
                    });
                    console.warn('🚨 COOKIE SET:', value);
                    return originalCookieDescriptor.set.call(this, value);
                }
            });
            
            // LocalStorage/SessionStorage Monitoring
            ['localStorage', 'sessionStorage'].forEach(storageType => {
                const originalSetItem = window[storageType].setItem;
                window[storageType].setItem = function(key, value) {
                    window.forensikData.storageAccess.push({
                        type: storageType + '_set',
                        key: key,
                        value: value.length > 100 ? value.substring(0, 100) + '...' : value,
                        timestamp: Date.now()
                    });
                    return originalSetItem.call(this, key, value);
                };
            });
            
            // Helper: Tracking-Cookie Detection
            window._isTrackingCookie = function(cookieString) {
                const trackingIndicators = ['_ga', '_gid', 'fbp', '_fbp', 'uuid', 'uid', 'user_id', 'session'];
                return trackingIndicators.some(indicator => cookieString.toLowerCase().includes(indicator));
            };
        """)
    
    async def _aggressive_cookie_banner_analysis(self, page: Page):
        """🎯 Aggressive Cookie-Banner-Analyse mit Dark Pattern Detection."""
        banner_selectors = [
            # Standard Selectors
            '[data-testid*="cookie"]', '[class*="cookie"]', '[id*="cookie"]',
            '[class*="consent"]', '[id*="consent"]',
            # Aggressive Discovery
            '[class*="banner"]', '[class*="modal"]', '[class*="popup"]',
            '[class*="overlay"]', '[id*="privacy"]', '[class*="privacy"]',
            # Bekannte Frameworks - AGGRESSIVE
            '#onetrust-consent-sdk', '.usercentrics-dialog', '.didomi-popup',
            '.cookiebot-bg', '.cc-window', '.cookie-alert-extended',
            '[class*="gdpr"]', '[id*="gdpr"]', '[class*="ccpa"]'
        ]
        
        banner_found = False
        dark_patterns_detected = []
        
        for selector in banner_selectors:
            try:
                banner = await page.query_selector(selector)
                if banner and await banner.is_visible():
                    banner_found = True
                    print(f"🎯 Cookie-Banner gefunden: {selector}")
                    
                    # AGGRESSIVE Dark Pattern Analysis
                    banner_text = await banner.inner_text()
                    banner_html = await banner.inner_html()
                    
                    # Dark Pattern Detection
                    dark_patterns = await self._detect_aggressive_dark_patterns(banner, banner_text)
                    dark_patterns_detected.extend(dark_patterns)
                    
                    # Versuche alle Buttons zu finden
                    buttons = await banner.query_selector_all('button, a[role="button"], [onclick], input[type="button"]')
                    
                    accept_found = False
                    reject_found = False
                    
                    for button in buttons:
                        button_text = await button.inner_text()
                        button_text_lower = button_text.lower()
                        
                        # Aggressive Button Classification
                        if any(word in button_text_lower for word in ['accept', 'akzeptieren', 'agree', 'zustimmen', 'alle']):
                            accept_found = True
                            try:
                                await button.click()
                                print(f"✅ Accept-Button geklickt: {button_text}")
                                break
                            except Exception as e:
                                print(f"⚠️ Accept-Button-Klick fehlgeschlagen: {e}")
                        elif any(word in button_text_lower for word in ['reject', 'ablehnen', 'deny', 'verweigern']):
                            reject_found = True
                    
                    # GDPR-Violation Detection
                    if accept_found and not reject_found:
                        dark_patterns_detected.append({
                            'type': 'missing_reject_option',
                            'severity': 'high',
                            'description': 'Keine gleichwertige Ablehnungsoption vorhanden'
                        })
                    
                    # Speichere Banner-Evidence
                    self.tracking_evidence['dark_patterns'].extend(dark_patterns_detected)
                    
                    await page.wait_for_timeout(1500)
                    break
                    
            except Exception as e:
                print(f"⚠️ Banner-Analyse Fehler bei {selector}: {e}")
                continue
        
        if not banner_found:
            print("ℹ️ Kein Cookie-Banner erkannt")
    
    async def _detect_aggressive_dark_patterns(self, banner, banner_text: str) -> List[Dict]:
        """🚨 Aggressive Dark Pattern Detection."""
        patterns = []
        text_lower = banner_text.lower()
        
        # 1. Confirmshaming Detection
        confirmshaming_phrases = [
            'no thanks', 'nein danke', 'skip', 'not interested', 'not now',
            'continue without', 'maybe later', 'i don\'t want', 'ich möchte nicht'
        ]
        if any(phrase in text_lower for phrase in confirmshaming_phrases):
            patterns.append({
                'type': 'confirmshaming',
                'severity': 'medium',
                'description': 'Confirmshaming-Sprache erkannt'
            })
        
        # 2. Misleading Language
        misleading_phrases = [
            'improve your experience', 'better experience', 'personalize',
            'relevant ads', 'enhance', 'optimize', 'necessary for functionality'
        ]
        if any(phrase in text_lower for phrase in misleading_phrases):
            patterns.append({
                'type': 'misleading_language',
                'severity': 'medium',
                'description': 'Irreführende Marketing-Sprache verwendet'
            })
        
        # 3. Pre-checked Boxes Detection
        try:
            checkboxes = await banner.query_selector_all('input[type="checkbox"]:checked')
            if checkboxes:
                patterns.append({
                    'type': 'prechecked_boxes',
                    'severity': 'high',
                    'description': f'{len(checkboxes)} vorangekreuzte Checkboxen gefunden'
                })
        except:
            pass
        
        # 4. Visual Hierarchy Manipulation
        try:
            buttons = await banner.query_selector_all('button')
            if len(buttons) >= 2:
                # Einfache Größenanalyse
                button_sizes = []
                for button in buttons:
                    try:
                        rect = await button.bounding_box()
                        if rect:
                            button_sizes.append(rect['width'] * rect['height'])
                    except:
                        button_sizes.append(0)
                
                if button_sizes and max(button_sizes) > min(button_sizes) * 2:
                    patterns.append({
                        'type': 'visual_hierarchy_manipulation',
                        'severity': 'medium',
                        'description': 'Signifikante Größenunterschiede zwischen Buttons'
                    })
        except:
            pass
        
        return patterns
    
    async def _deep_forensik_analysis(self, page: Page, url: str):
        """🔬 Tiefe Forensik-Analyse für maximale Evidence-Sammlung."""
        print("🔬 Starte Deep-Forensik-Analyse...")
        
        # 1. Sammle alle Fingerprinting-Evidence
        await page.wait_for_timeout(5000)  # Warte auf Fingerprinting-Aktivitäten
        
        fingerprint_data = await page.evaluate('window.forensikData || {}')
        if fingerprint_data.get('fingerprinting'):
            self.tracking_evidence['fingerprinting_attempts'].extend(fingerprint_data['fingerprinting'])
            print(f"🔬 {len(fingerprint_data['fingerprinting'])} Fingerprinting-Versuche erkannt")
        
        # 2. Cookie-Operations-Analyse
        if fingerprint_data.get('cookieOperations'):
            cookie_ops = fingerprint_data['cookieOperations']
            suspicious_cookies = [op for op in cookie_ops if op.get('suspicious')]
            self.tracking_evidence['cookies_placed'].extend(suspicious_cookies)
            print(f"🍪 {len(suspicious_cookies)} verdächtige Cookie-Operationen")
        
        # 3. Script-Analyse
        all_scripts = await page.query_selector_all('script[src]')
        for script in all_scripts:
            src = await script.get_attribute('src')
            if src and self._is_third_party_request(src, url):
                if self._is_aggressive_tracking_request(src):
                    self.tracking_evidence['suspicious_scripts'].append({
                        'src': src,
                        'type': 'third_party_tracking',
                        'timestamp': asyncio.get_event_loop().time()
                    })
        
        # 4. Hidden Element Discovery
        hidden_elements = await page.query_selector_all('[style*="display:none"], [style*="visibility:hidden"], [hidden]')
        for element in hidden_elements[:10]:  # Limit für Performance
            try:
                tag_name = await element.evaluate('el => el.tagName.toLowerCase()')
                if tag_name in ['img', 'iframe', 'script']:
                    src = await element.get_attribute('src')
                    if src and ('pixel' in src or 'track' in src or 'analytics' in src):
                        self.tracking_evidence['tracking_requests'].append({
                            'type': 'hidden_tracking_element',
                            'tag': tag_name,
                            'src': src,
                            'timestamp': asyncio.get_event_loop().time()
                        })
            except:
                continue
    
    def _is_third_party_request(self, request_url: str, base_url: str) -> bool:
        """Prüft ob Request von Drittanbieter kommt."""
        try:
            base_domain = urlparse(base_url).netloc
            request_domain = urlparse(request_url).netloc
            return base_domain != request_domain
        except:
            return False
    
    def _is_aggressive_tracking_request(self, url: str) -> bool:
        """Aggressive Tracking-Request-Detection."""
        # Erweiterte Liste bekannter Tracker + Heuristiken
        tracking_indicators = [
            # Major Tracker
            'google-analytics.com', 'googletagmanager.com', 'doubleclick.net',
            'googlesyndication.com', 'facebook.com', 'connect.facebook.net',
            'amazon-adsystem.com', 'twitter.com', 'linkedin.com',
            'pinterest.com', 'snapchat.com', 'tiktok.com',
            # Analytics & Tag Manager
            'analytics', 'tracking', 'gtag', 'gtm', 'segment.com', 'mixpanel',
            'amplitude.com', 'hotjar.com', 'crazyegg.com', 'fullstory.com',
            # Ad Networks
            'adsystem', 'doubleclick', 'googlesyndication', 'amazon-adsystem',
            'outbrain', 'taboola', 'criteo', 'pubmatic', 'rubiconproject',
            # Tracking Keywords
            'pixel', 'beacon', 'collect', 'track', 'event', 'metric', 'stats',
            'monitor', 'telemetry', 'usage', 'behavior', 'visitor'
        ]
        
        return any(indicator in url.lower() for indicator in tracking_indicators)
    
    async def _analyze_suspicious_script(self, request) -> Dict:
        """Analysiert verdächtige Scripts."""
        url = request.url
        suspicious_indicators = ['tracking', 'analytics', 'ads', 'pixel', 'fingerprint']
        
        suspicion_score = sum(1 for indicator in suspicious_indicators if indicator in url.lower())
        
        return {
            'suspicious': suspicion_score > 0,
            'suspicion_score': suspicion_score,
            'indicators': [ind for ind in suspicious_indicators if ind in url.lower()],
            'url': url
        }
    
    def _analyze_api_call_forensik(self, request_data: Dict) -> List[str]:
        """Forensik-Analyse von API-Calls."""
        flags = []
        url = request_data['url'].lower()
        
        if any(keyword in url for keyword in ['track', 'event', 'analytics']):
            flags.append('tracking_api')
        if any(keyword in url for keyword in ['user', 'profile', 'visitor']):
            flags.append('user_data_api')
        if request_data.get('post_data') and len(request_data['post_data']) > 1000:
            flags.append('large_payload')
        if request_data['is_third_party']:
            flags.append('third_party_api')
        
        return flags
    
    async def _save_forensik_evidence(self, website_name: str):
        """Speichert alle gesammelten Forensik-Daten."""
        forensik_dir = self.output_dir / "forensik_evidence"
        forensik_dir.mkdir(exist_ok=True)
        
        # Hauptreport
        forensik_file = forensik_dir / "tracking_evidence.json"
        async with aiofiles.open(forensik_file, 'w', encoding='utf-8') as f:
            await f.write(json.dumps(self.tracking_evidence, indent=2, ensure_ascii=False))
        
        # Summary Report
        summary = self._generate_forensik_summary()
        summary_file = forensik_dir / "forensik_summary.md"
        
        summary_content = f"""# 🚨 FORENSIK-ANALYSE: {website_name}

## Übersicht
- **Tracking-Requests**: {len(self.tracking_evidence['tracking_requests'])}
- **Dark Patterns**: {len(self.tracking_evidence['dark_patterns'])}
- **Fingerprinting-Versuche**: {len(self.tracking_evidence['fingerprinting_attempts'])}
- **Verdächtige Scripts**: {len(self.tracking_evidence['suspicious_scripts'])}
- **Cookie-Verstöße**: {len(self.tracking_evidence['cookies_placed'])}

## Risiko-Bewertung
- **Gesamt-Risiko**: {summary['risk_level']}
- **Privacy-Score**: {summary['privacy_score']}/100
- **GDPR-Konformität**: {summary['gdpr_compliant']}

## Empfehlungen
{chr(10).join(f"- {rec}" for rec in summary['recommendations'])}
"""
        
        async with aiofiles.open(summary_file, 'w', encoding='utf-8') as f:
            await f.write(summary_content)
        
        print(f"🔍 Forensik-Evidence gespeichert: {forensik_dir}")
    
    def _generate_forensik_summary(self) -> Dict:
        """Generiert Forensik-Summary."""
        total_violations = (
            len(self.tracking_evidence['tracking_requests']) +
            len(self.tracking_evidence['dark_patterns']) +
            len(self.tracking_evidence['fingerprinting_attempts']) +
            len(self.tracking_evidence['suspicious_scripts'])
        )
        
        privacy_score = max(0, 100 - (total_violations * 5))
        
        if total_violations >= 10:
            risk_level = "KRITISCH"
        elif total_violations >= 5:
            risk_level = "HOCH"
        elif total_violations >= 2:
            risk_level = "MITTEL"
        else:
            risk_level = "NIEDRIG"
        
        recommendations = []
        if len(self.tracking_evidence['dark_patterns']) > 0:
            recommendations.append("Cookie-Banner GDPR-konform gestalten")
        if len(self.tracking_evidence['tracking_requests']) > 5:
            recommendations.append("Third-Party-Tracking reduzieren")
        if len(self.tracking_evidence['fingerprinting_attempts']) > 0:
            recommendations.append("Fingerprinting-Praktiken eliminieren")
        
        return {
            'risk_level': risk_level,
            'privacy_score': privacy_score,
            'total_violations': total_violations,
            'gdpr_compliant': len(self.tracking_evidence['dark_patterns']) == 0,
            'recommendations': recommendations
        }


# Convenience function for CLI usage
async def crawl_website(url: str, output_dir: str = "snapshots", header_options: dict = None) -> Dict:
    """Simple interface for crawling a website."""
    # Create fresh crawler instance for each call
    crawler = WebCrawler(output_dir)
    return await crawler.crawl_site(url, header_options=header_options) 