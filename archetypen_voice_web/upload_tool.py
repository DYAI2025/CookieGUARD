#!/usr/bin/env python3
"""
🔥 Archetypen-Schmied Upload Tool
Lädt die Web-App zu einem kostenlosen Hosting-Service hoch
"""

import os
import zipfile
import requests
import json
from pathlib import Path

def create_zip():
    """Erstellt ein ZIP-Archiv mit allen notwendigen Dateien"""
    print("📦 Erstelle ZIP-Archiv...")
    
    files_to_include = [
        'index.html',
        'styles.css', 
        'script.js',
        'SChmiedAmFeuer.mp4',
        'fire-flames-isolated-black-background-abstract-blaze-fire-flame-texture.jpg',
        'ChatGPT portrait.jpg'
    ]
    
    with zipfile.ZipFile('archetypen_schmied.zip', 'w', zipfile.ZIP_DEFLATED) as zipf:
        for file in files_to_include:
            if os.path.exists(file):
                zipf.write(file)
                print(f"✅ {file} hinzugefügt")
            else:
                print(f"⚠️  {file} nicht gefunden")
    
    print("📦 ZIP-Archiv erstellt: archetypen_schmied.zip")
    return 'archetypen_schmied.zip'

def upload_to_fileio():
    """Lädt zu file.io hoch (14 Tage kostenlos)"""
    print("🚀 Lade zu file.io hoch...")
    
    zip_file = create_zip()
    
    try:
        with open(zip_file, 'rb') as f:
            response = requests.post('https://file.io', files={'file': f})
            
        if response.status_code == 200:
            data = response.json()
            if data['success']:
                print(f"✅ Upload erfolgreich!")
                print(f"🔗 Download-Link: {data['link']}")
                print(f"📅 Verfügbar für 14 Tage")
                
                # Erstelle HTML-Seite mit Download-Link
                create_download_page(data['link'], "file.io", "14 Tage")
                
                return data['link']
            else:
                print(f"❌ Upload-Fehler: {data}")
        else:
            print(f"❌ HTTP-Fehler: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Fehler beim Upload: {e}")
    
    return None

def upload_to_0x0():
    """Alternative: 0x0.st (365 Tage)"""
    print("🚀 Lade zu 0x0.st hoch...")
    
    zip_file = create_zip()
    
    try:
        with open(zip_file, 'rb') as f:
            response = requests.post('https://0x0.st', files={'file': f})
            
        if response.status_code == 200:
            link = response.text.strip()
            print(f"✅ Upload erfolgreich!")
            print(f"🔗 Download-Link: {link}")
            print(f"📅 Verfügbar für 365 Tage")
            
            # Erstelle HTML-Seite mit Download-Link
            create_download_page(link, "0x0.st", "365 Tage")
            
            return link
        else:
            print(f"❌ HTTP-Fehler: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Fehler beim Upload: {e}")
    
    return None

def create_download_page(download_link, service, duration):
    """Erstellt eine HTML-Seite mit dem Download-Link für User"""
    html_content = f"""<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🔥 Archetypen-Schmied Download</title>
    <style>
        body {{
            background: linear-gradient(135deg, #1a0f0a, #2d1810);
            color: #ff8c00;
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 40px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }}
        .container {{
            background: rgba(26,15,10,0.9);
            padding: 40px;
            border-radius: 20px;
            border: 3px solid #ff8c00;
            box-shadow: 0 0 50px rgba(255,140,0,0.3);
            text-align: center;
            max-width: 600px;
        }}
        h1 {{
            font-size: 2.5em;
            margin-bottom: 20px;
            text-shadow: 0 0 20px #ff8c00;
        }}
        .download-btn {{
            background: linear-gradient(135deg, #ff8c00, #ff4500);
            color: white;
            border: none;
            padding: 20px 40px;
            font-size: 1.2em;
            border-radius: 15px;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            margin: 20px;
            box-shadow: 0 5px 20px rgba(255,140,0,0.4);
            transition: all 0.3s ease;
        }}
        .download-btn:hover {{
            transform: translateY(-3px);
            box-shadow: 0 8px 30px rgba(255,140,0,0.6);
        }}
        .info {{
            background: rgba(255,140,0,0.1);
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            border: 1px solid rgba(255,140,0,0.3);
        }}
        .copy-btn {{
            background: rgba(255,69,0,0.8);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            margin-left: 10px;
            font-size: 0.9em;
        }}
        .link-box {{
            background: rgba(0,0,0,0.5);
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
            word-break: break-all;
            font-family: monospace;
            border: 1px solid #ff8c00;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🔥 Archetypen-Schmied</h1>
        <h2>📦 Download bereit!</h2>
        
        <div class="info">
            <p><strong>Service:</strong> {service}</p>
            <p><strong>Verfügbar für:</strong> {duration}</p>
            <p><strong>Inhalt:</strong> Komplette Web-App mit Schmied-Video</p>
        </div>
        
        <a href="{download_link}" class="download-btn" target="_blank">
            📥 Archetypen-Schmied herunterladen
        </a>
        
        <div class="info">
            <h3>📋 Download-Link:</h3>
            <div class="link-box" id="linkBox">{download_link}</div>
            <button class="copy-btn" onclick="copyLink()">📋 Link kopieren</button>
        </div>
        
        <div class="info">
            <h3>📖 Anleitung:</h3>
            <p>1. ZIP-Datei herunterladen</p>
            <p>2. Entpacken</p>
            <p>3. index.html im Browser öffnen</p>
            <p>4. Mit dem Schmied sprechen! 🎙️</p>
        </div>
    </div>
    
    <script>
        function copyLink() {{
            const linkBox = document.getElementById('linkBox');
            const text = linkBox.textContent;
            
            navigator.clipboard.writeText(text).then(() => {{
                alert('✅ Link kopiert!');
            }}).catch(() => {{
                // Fallback für ältere Browser
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                alert('✅ Link kopiert!');
            }});
        }}
    </script>
</body>
</html>"""
    
    with open('download.html', 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f"📄 Download-Seite erstellt: download.html")
    print(f"🌐 Öffne im Browser: file://{os.path.abspath('download.html')}")

def create_simple_server():
    """Erstellt einen einfachen lokalen Server ohne Port-Konflikte"""
    import socket
    
    # Finde freien Port
    for port in range(8080, 8090):
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.bind(('localhost', port))
            sock.close()
            
            print(f"🌐 Starte lokalen Server auf Port {port}...")
            os.system(f"python3 -m http.server {port}")
            break
            
        except OSError:
            continue
    else:
        print("❌ Alle Ports belegt!")

def main():
    print("🔥 ARCHETYPEN-SCHMIED UPLOAD TOOL")
    print("=" * 40)
    print("1. 📦 Zu file.io hochladen (14 Tage) + HTML-Seite")
    print("2. 📦 Zu 0x0.st hochladen (365 Tage) + HTML-Seite")  
    print("3. 🌐 Lokaler Server (freier Port)")
    print("4. 📋 Nur ZIP erstellen")
    print("5. 🌐 Download-Seite im Browser öffnen")
    
    choice = input("\nWähle Option (1-5): ").strip()
    
    if choice == '1':
        upload_to_fileio()
    elif choice == '2':
        upload_to_0x0()
    elif choice == '3':
        create_simple_server()
    elif choice == '4':
        create_zip()
    elif choice == '5':
        if os.path.exists('download.html'):
            import webbrowser
            webbrowser.open(f"file://{os.path.abspath('download.html')}")
            print("🌐 Download-Seite im Browser geöffnet!")
        else:
            print("❌ Keine download.html gefunden! Erst Upload durchführen.")
    else:
        print("❌ Ungültige Auswahl!")

if __name__ == "__main__":
    main() 