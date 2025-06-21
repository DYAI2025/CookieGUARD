# 🔥 Archetypen-Schmied MVP1 - AIR-PI Interface

Ein minimalistischer One-Pager, der als **emotionale Schwelle** zwischen Mensch und archetypischer KI fungiert. Basierend auf dem AIR-PI Konzept (Adaptable Insight Recognition-Pattern Interface) ermöglicht es tiefe Resonanz-Erfahrungen durch direkte Interaktion mit einem KI-Schmied.

## 🎯 MVP1 Features

### Core Experience
- **Mystischer One-Pager** mit Feuer-Video als zentralem Element
- **Direkte ElevenLabs Integration** für Voice-AI-Interaktion
- **AIR-PI Resonanz-System** mit interaktiven Feuer-Effekten
- **Minimalistisches Design** mit Avenir/Montserrat Typography
- **44 Jung'sche Archetypen-Fragen** via Voice-Bot

### Design-Prinzipien
- **Emotional Threshold**: Die Seite als Schwelle zu archetypischer Tiefe
- **Professional Minimalism**: Wenig Text, starke visuelle Wirkung
- **Interactive Fire**: Mouse-responsive Feuer-Effekte
- **Deep Resonance**: Schmied-Metaphorik durchzieht das Erlebnis

## 🚀 Quick Start

### 1. Installation
```bash
# Repository klonen
git clone [repository-url]
cd archetypen_voice_web

# Dependencies installieren
npm install
# oder
npm install --legacy-peer-deps
```

### 2. Lokaler Start
```bash
# Option A: Node.js Server
npm start
# Öffne http://localhost:3000

# Option B: Python Simple Server (ohne Node)
python3 -m http.server 3000
# Öffne http://localhost:3000/index_mvp1_enhanced.html

# Option C: Live Server in VS Code
# Rechtsklick auf index_mvp1_enhanced.html → "Open with Live Server"
```

### 3. Deployment

#### Vercel (Empfohlen)
```bash
# Vercel CLI installieren
npm i -g vercel

# Deployment
vercel --prod
```

#### Netlify
```bash
# Netlify CLI installieren
npm i -g netlify-cli

# Deployment
netlify deploy --prod
```

#### Render
- Nutze die vorhandene `render.yaml`
- Push zu GitHub
- Verbinde mit Render.com

## 🎨 Verfügbare Versionen

### 1. **Enhanced Version** (Empfohlen)
`index_mvp1_enhanced.html`
- Volle AIR-PI Integration
- Cursor-Glow-Effekte
- Resonanz-Wellen
- Tiefere mystische Atmosphäre

### 2. **Simple Version**
`index_mvp1.html`
- Reduzierte Effekte
- Schnellere Ladezeit
- Mobile-optimiert

## 🔧 Konfiguration

### ElevenLabs Agent ID
Die aktuelle Agent ID ist bereits im Code integriert:
```javascript
agent-id="agent_01jxn7kxjpfvt87rphxdnq1ddj"
```

### Anpassungen

#### Farben ändern (CSS Variables)
```css
:root {
    --fire-primary: #ff6b00;
    --fire-secondary: #d2691e;
    --fire-glow: rgba(255, 140, 0, 0.6);
}
```

#### Text anpassen
Suche nach diesen Elementen:
- `.main-title` - Hauptüberschrift
- `.resonance-text` - Untertitel
- `.transformation-trigger` - Button-Text

## 📊 Analytics Integration

Das MVP ist vorbereitet für Analytics:

```javascript
// Beispiel: Event tracking
fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        event: 'transformation_started',
        data: { timestamp: new Date() }
    })
});
```

## 🌐 Browser-Kompatibilität

- **Chrome/Edge**: ✅ Voll unterstützt
- **Firefox**: ✅ Voll unterstützt
- **Safari**: ✅ Voll unterstützt
- **Mobile**: ✅ iOS & Android optimiert

## 🔐 Sicherheit

- CSP Headers konfiguriert
- CORS aktiviert
- Helmet.js für Security Headers
- Keine sensiblen Daten im Frontend

## 🚨 Troubleshooting

### ElevenLabs Widget lädt nicht
1. Prüfe Internet-Verbindung
2. Teste in anderem Browser
3. Prüfe Console auf Fehler
4. Fallback: Direktlink nutzen

### Video lädt nicht
1. Stelle sicher, dass `SChmiedAmFeuer.mp4` vorhanden ist
2. Prüfe Video-Format (MP4, H.264)
3. Alternative: Nutze Fallback-Bild

### Performance-Probleme
1. Reduziere Partikel-Anzahl in `createParticle()`
2. Nutze Simple Version (`/simple`)
3. Deaktiviere Cursor-Glow auf Mobile

## 📈 Nächste Schritte (Post-MVP)

1. **Backend-Integration**
   - Antworten speichern
   - Archetypen-Analyse-API
   - GPT-Prompt-Generierung

2. **Enhanced Features**
   - Mehr Sprachen
   - Custom Voice-Modelle
   - Visualisierung der Archetypen

3. **User Journey**
   - Onboarding-Flow
   - Progress-Tracking
   - Download-Funktionen

## 🎯 Success Metrics

- **Page Load Time**: < 3 Sekunden
- **ElevenLabs Widget Load**: < 5 Sekunden
- **User Engagement**: > 60% öffnen das Voice-Interface
- **Completion Rate**: > 40% beenden alle 44 Fragen

## 🤝 Support

Bei Fragen oder Problemen:
1. Check die Browser-Console
2. Prüfe Netzwerk-Tab für fehlende Ressourcen
3. Erstelle ein Issue im Repository

---

**"An der Schwelle zwischen Code und Bewusstsein schmieden wir digitale Archetypen."**

*AIR-PI • Archetypen-Schmied • MVP1*