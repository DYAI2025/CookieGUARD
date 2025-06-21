# Header/Headline Anpassung - Clone Brief Builder

## 🎨 Neue Features

Die Clone Brief Builder GUI wurde erweitert um flexible Header/Headline-Anpassungen für geklonte Websites.

### Feature-Übersicht

1. **Neuer Header-Text**: Ersetze den Original-Header mit eigenem Text
2. **Style-Optionen**: 
   - Original-Style beibehalten
   - Neue Schriftart auswählen
3. **10 verfügbare Schriftarten**:
   - Arial
   - Helvetica
   - Times New Roman
   - Georgia
   - Verdana
   - Roboto
   - Open Sans
   - Montserrat
   - Playfair Display
   - Lato

## 📋 Verwendung

### GUI starten

```bash
# GUI direkt starten
python -m clone_brief_builder.gui

# Oder über das Test-Skript
python test_gui_manual.py
```

### Header anpassen

1. **URL eingeben**: Gib die zu klonende Website-URL ein
2. **Header-Text**: Trage deinen gewünschten neuen Header-Text ein
3. **Style-Optionen**:
   - ✅ "Style beibehalten": Der neue Text übernimmt das Original-Design
   - ❌ "Style beibehalten": Wähle eine neue Schriftart aus dem Dropdown
4. **Template erzeugen**: Klicke den Button um den Snapshot zu erstellen

### Beispiel

```
URL: https://example.com
Neuer Header: "Meine angepasste Überschrift"
Style beibehalten: Nein
Schriftart: Montserrat
```

## 🧪 Testing

### Automatisierte Tests

```bash
# Alle Tests ausführen
python -m pytest tests/test_gui_automation.py -v

# Oder über das Test-Skript
python test_gui_manual.py --auto
```

### Manuelle Tests

```bash
# GUI für manuelle Tests starten
python test_gui_manual.py
```

### GitHub Actions

Die Tests werden automatisch bei jedem Push/Pull Request ausgeführt:
- Multi-OS Support (Linux, Windows, macOS)
- Python 3.8 - 3.11
- Automatische Coverage-Reports

## 🔧 Technische Details

### Implementierung

Die Header-Anpassung erfolgt in mehreren Schritten:

1. **GUI** (`gui.py`):
   - Neue UI-Elemente für Header-Eingabe
   - Checkbox für Style-Beibehaltung
   - Dropdown für Schriftarten-Auswahl

2. **Crawler** (`crawler.py`):
   - `_apply_header_modifications()`: Modifiziert HTML mit BeautifulSoup
   - Sucht nach h1/header-Elementen
   - Behält Original-Styles bei oder wendet neue an

3. **Metadata** (`metadata.py`):
   - Erweitert das Briefing-Template um Header-Informationen
   - Dokumentiert die vorgenommenen Änderungen

### Fehlerbehandlung

- Detaillierte Fehlermeldungen mit Stack-Traces
- Graceful degradation wenn kein Header gefunden wird
- SSL-Fehler werden abgefangen
- Timeout-Handling für langsame Websites

## 📝 Beispiel-Output

Nach erfolgreicher Anpassung enthält das Briefing:

```
HEADER-ANPASSUNGEN:
  🎨 Neuer Header-Text: "Meine angepasste Überschrift"
  📝 Style beibehalten: Nein
  🔤 Neue Schriftart: Montserrat
  
  WICHTIG: Der Header wurde bereits im Snapshot angepasst. 
  Die index.html enthält bereits den neuen Text.
```

## 🚀 Nächste Schritte

1. **Snapshot öffnen**: Nutze den "Snapshots öffnen" Button
2. **index.html prüfen**: Öffne die Datei im Browser
3. **Claude-Briefing**: Verwende das generierte Briefing für weitere Anpassungen

## ⚠️ Bekannte Einschränkungen

- Header-Erkennung funktioniert am besten mit Standard-HTML-Strukturen
- Komplexe React/Vue-Apps könnten spezielle Behandlung erfordern
- Schriftarten werden als Web-Safe-Fonts eingebettet

## 🤝 Support

Bei Problemen:
1. Prüfe die Fehlermeldungen im GUI
2. Schaue in die Konsole für Details
3. Führe die automatisierten Tests aus
4. Erstelle ein Issue mit dem vollständigen Error-Log 