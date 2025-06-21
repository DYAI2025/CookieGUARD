# Clone Brief Builder

Website-zu-Claude-Briefing System mit Headless Browser und Screenshot-Funktionalität.

## 🚀 **Features**

- ✅ **Headless Browser Crawling** mit Playwright
- ✅ **Automatische Screenshots** (Vollbild + Viewport)
- ✅ **Cookie-Banner Handling** 
- ✅ **Asset-Download** (CSS, JS, Images)
- ✅ **Website-spezifische Ordner** für jeden Snapshot
- ✅ **Dual Interface**: CLI + GUI
- ✅ **Claude-optimierte Templates**

## 📦 **Installation**

```bash
# Repository klonen
git clone https://github.com/USERNAME/clone-brief-builder.git
cd clone-brief-builder

# Dependencies installieren
pip install -e .

# Playwright Browser installieren
playwright install chromium
```

## 💻 **Verwendung**

### **CLI**
```bash
# Einfaches Briefing (nur HTTP)
clone-brief https://example.com

# Vollständiger Snapshot mit Headless Browser
clone-brief https://example.com --snapshot

# Custom Output
clone-brief https://example.com --snapshot -o briefing.txt --snapshot-dir my_snapshots
```

### **GUI**
```bash
clone-brief-gui
```

## 📁 **Snapshot-Struktur**

```
snapshots/
└── example_com/                    # Website-spezifischer Ordner
    ├── index.html                  # Haupt-HTML mit lokalen Asset-Links
    ├── assets/
    │   ├── css/                    # Stylesheets
    │   ├── js/                     # JavaScript
    │   └── images/                 # Bilder
    ├── screenshots/
    │   ├── full_page.png          # Vollständige Seite
    │   └── viewport.png           # Sichtbarer Bereich
    ├── mock_api/                   # API-Mocks (falls vorhanden)
    └── metadata.json              # Snapshot-Informationen
```

## 🎯 **Claude-Integration**

Das generierte Briefing enthält:
- Website-Metadaten (Titel, Description)
- Externe CSS/JS-Referenzen
- Pfade zu lokalen Snapshots
- Screenshot-Locations
- Strukturierte Anweisungen für Claude

## 🔧 **Requirements**

- Python 3.10+
- Playwright
- BeautifulSoup4
- Tkinter (für GUI)

## 📄 **Lizenz**

MIT License

---

**Version**: 0.1.0  
**Status**: Production Ready 