"""Functions to fetch a webpage and build a Claude briefing template."""
from __future__ import annotations

import datetime
import textwrap
from typing import Dict, List, Optional

import requests
from bs4 import BeautifulSoup

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

def fetch_page(url: str) -> str:
    """Download the raw HTML of the given URL."""
    resp = requests.get(url, timeout=20, headers={"User-Agent": USER_AGENT})
    resp.raise_for_status()
    return resp.text

def extract_metadata(url: str, html: str) -> Dict[str, object]:
    """Extract title, meta-description and external CSS/JS links."""
    soup = BeautifulSoup(html, "html5lib")

    title = (soup.title.string or "").strip() if soup.title else ""

    meta_desc_tag = soup.find("meta", attrs={"name": "description"})
    meta_desc = meta_desc_tag.get("content", "").strip() if meta_desc_tag else ""

    css_links: List[str] = [
        link.get("href")
        for link in soup.find_all("link", rel="stylesheet")
        if link.get("href")
    ]

    js_links: List[str] = [
        script.get("src")
        for script in soup.find_all("script")
        if script.get("src")
    ]

    return {
        "url": url,
        "title": title,
        "description": meta_desc,
        "css": css_links,
        "js": js_links,
    }

def build_template(data: Dict[str, object], snapshot_info: Optional[Dict] = None) -> str:
    """Insert metadata into the predefined Claude briefing template with snapshot references."""
    today = datetime.date.today().isoformat()

    css_block = "\n    ".join(data["css"]) if data["css"] else "(keine externen Stylesheets)"
    js_block = "\n    ".join(data["js"]) if data["js"] else "(keine externen Skripte)"

    # Snapshot information block
    snapshot_block = ""
    if snapshot_info:
        website_name = snapshot_info.get("website_name", "unknown")
        snapshot_path = snapshot_info.get("snapshot_path", "")
        screenshots = snapshot_info.get("screenshots", {})
        
        snapshot_block = f"""

VERFÜGBARE SNAPSHOT-DATEIEN:
  📁 Snapshot-Verzeichnis: {snapshot_path}/
  📄 HTML-Kopie: {snapshot_path}/index.html
  📦 Lokale Assets: {snapshot_path}/assets/
    ├── css/ (Stylesheets lokal verfügbar)
    ├── js/ (JavaScript-Dateien lokal verfügbar)  
    └── images/ (Bilder lokal verfügbar)
  📸 Screenshots:
    ├── Vollständige Seite: {screenshots.get('full_page', 'N/A')}
    └── Viewport-Ansicht: {screenshots.get('viewport', 'N/A')}
  🔌 API-Mocks: {snapshot_path}/mock_api/ (falls API-Calls abgefangen)
  📊 Metadaten: {snapshot_path}/metadata.json

WICHTIGER HINWEIS FÜR CLAUDE:
  Alle Assets (CSS, JS, Bilder) sind bereits lokal im assets/ Ordner verfügbar.
  Die HTML-Datei wurde angepasst, um relative Pfade zu verwenden.
  Screenshots zeigen das tatsächliche Erscheinungsbild der Website."""

    # Header customization block
    header_block = ""
    header_options = data.get('header_options')
    if header_options and header_options.get('new_header'):
        header_block = f"""

HEADER-ANPASSUNGEN:
  🎨 Neuer Header-Text: "{header_options['new_header']}"
  📝 Style beibehalten: {'Ja' if header_options.get('keep_style', True) else 'Nein'}"""
        
        if not header_options.get('keep_style') and header_options.get('font_family'):
            header_block += f"\n  🔤 Neue Schriftart: {header_options['font_family']}"
            
        header_block += """
  
  WICHTIG: Der Header wurde bereits im Snapshot angepasst. Die index.html enthält bereits den neuen Text."""

    tmpl = f"""
────────────────────  BRIEFING-TEMPLATE FÜR CLAUDE 4 OPUS  ────────────────────

AUFGABENTITEL:
  1:1-Klon von "{data['title'] or 'Seite ohne <title>'}"

KONTEXT:
  Ziel-URL: {data['url']}
  Gefundene Meta-Description: "{data['description'] or '–'}"
  Analyse-Datum: {today}

ZIEL / ERGEBNIS:
  Vollständige, semantisch identische Kopie der Originalseite (Stand von {today}).

BEDEUTUNG / IMPACT:
  Die Kopie dient als Ausgangsbasis für spätere manuelle Anpassungen, daher hat Pixel- und Code-Genauigkeit höchste Priorität.

OUTPUT-FORM:
  • Unveränderte HTML-Datei(en)
  • Original-Assets referenziert oder eingebettet (siehe Rahmenbedingungen)

RAHMENBEDINGUNGEN:
  Keine neuen Bibliotheken einbinden, keine inhaltlichen Änderungen vornehmen, keine Polyfills oder alternativen CDN-Links ergänzen.

HILFSMATERIAL:
  Externe Stylesheets:
    {css_block}

  Externe Skripte:
    {js_block}{snapshot_block}{header_block}

ERWARTETE SCHRITTIGKEIT (optional):
  1. Originalcode abrufen → 2. Dateien strukturieren → 3. Kurzes Review

KLARSTELLUNGSFRAGEN ERLAUBT? JA

───────────────────────────────────────────────────────────────────────────────
"""
    return textwrap.dedent(tmpl).lstrip() 