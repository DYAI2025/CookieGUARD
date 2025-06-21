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


class WebCrawler:
    """Headless browser crawler with cookie handling and asset extraction."""
    
    def __init__(self, output_dir: str = "snapshots"):
        self.base_output_dir = Path(output_dir)
        # Initialize fresh state for each instance
        self.downloaded_assets: Set[str] = set()
        self.api_calls: List[Dict] = []
        self.output_dir = None
        self.assets_dir = None
        self.mock_api_dir = None
        self.screenshots_dir = None
        self.header_options = None
        
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
    
    async def crawl_site(self, url: str, handle_cookies: bool = True, header_options: dict = None) -> Dict[str, any]:
        """Main crawling method with organized output structure."""
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
                browser = await playwright.chromium.launch(
                    headless=True,
                    args=['--no-sandbox', '--disable-setuid-sandbox']  # Better compatibility
                )
                context = await browser.new_context(
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
                    viewport={"width": 1920, "height": 1080},
                    ignore_https_errors=True  # Handle SSL issues
                )
                
                # Setup API interception
                await self._setup_api_interception(context)
                
                page = await context.new_page()
                
                # Navigate to page with timeout
                print(f"🌐 Navigiere zu {url}...")
                await page.goto(url, wait_until="networkidle", timeout=30000)
                
                # Handle cookie banners
                if handle_cookies:
                    await self._handle_cookie_banners(page)
                    # Wait a bit for any animations to finish
                    await page.wait_for_timeout(2000)
                
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


# Convenience function for CLI usage
async def crawl_website(url: str, output_dir: str = "snapshots", header_options: dict = None) -> Dict:
    """Simple interface for crawling a website."""
    # Create fresh crawler instance for each call
    crawler = WebCrawler(output_dir)
    return await crawler.crawl_site(url, header_options=header_options) 