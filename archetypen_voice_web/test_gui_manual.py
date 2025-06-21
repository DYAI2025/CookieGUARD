#!/usr/bin/env python3
"""Manual GUI testing script for Clone Brief Builder."""

import sys
import time
from pathlib import Path

# Add current directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

def print_test_instructions():
    """Print test instructions for manual GUI testing."""
    print("=" * 80)
    print("🧪 CLONE BRIEF BUILDER - MANUELLER GUI TEST")
    print("=" * 80)
    print()
    print("📋 TEST-ANLEITUNG:")
    print()
    print("1. GRUNDFUNKTIONALITÄT:")
    print("   - Gib eine URL ein (z.B. https://example.com)")
    print("   - Klicke auf 'Template erzeugen'")
    print("   - Überprüfe, ob das Briefing erstellt wird")
    print()
    print("2. HEADER-ANPASSUNG:")
    print("   - Gib einen neuen Header-Text ein")
    print("   - Teste mit 'Style beibehalten' aktiviert/deaktiviert")
    print("   - Wähle verschiedene Schriftarten aus dem Dropdown")
    print()
    print("3. SNAPSHOT-FUNKTION:")
    print("   - Aktiviere 'Vollständigen Snapshot erstellen'")
    print("   - Klicke auf 'Template erzeugen'")
    print("   - Überprüfe die Snapshot-Info im zweiten Tab")
    print("   - Nutze 'Snapshots öffnen' um das Verzeichnis zu öffnen")
    print()
    print("4. TEST-URLS:")
    print("   • https://example.com (einfache Seite)")
    print("   • https://www.python.org (komplexere Seite)")
    print("   • https://github.com (moderne Web-App)")
    print()
    print("5. FEHLERBEHANDLUNG:")
    print("   - Teste ungültige URLs")
    print("   - Teste nicht erreichbare Seiten")
    print("   - Breche laufende Operationen ab")
    print()
    print("=" * 80)
    print()
    
    # Wait for user to read instructions
    input("Drücke ENTER um die GUI zu starten...")
    print()
    print("🚀 Starte GUI...")
    print()


def test_gui():
    """Launch the GUI for manual testing."""
    try:
        from clone_brief_builder.gui import main
        
        # Print instructions first
        print_test_instructions()
        
        # Start the GUI
        main()
        
    except ImportError as e:
        print(f"❌ Import-Fehler: {e}")
        print("Stelle sicher, dass alle Abhängigkeiten installiert sind:")
        print("pip install -r requirements.txt")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Fehler beim Starten der GUI: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def automated_test_sequence():
    """Run automated test sequence (requires GUI automation tools)."""
    print("🤖 AUTOMATISIERTE TEST-SEQUENZ")
    print("=" * 80)
    
    try:
        # Run unit tests
        import subprocess
        
        print("1. Führe Unit-Tests aus...")
        result = subprocess.run([
            sys.executable, "-m", "pytest", 
            "tests/test_gui_automation.py", 
            "-v", "--tb=short"
        ], capture_output=True, text=True)
        
        print(result.stdout)
        
        if result.returncode == 0:
            print("✅ Alle Unit-Tests bestanden!")
        else:
            print("❌ Einige Tests sind fehlgeschlagen!")
            print(result.stderr)
        
        print()
        print("2. Teste Import-Funktionalität...")
        
        # Test imports
        from clone_brief_builder.gui import AsyncTaskManager, AVAILABLE_FONTS
        from clone_brief_builder.crawler import WebCrawler
        from clone_brief_builder.metadata import build_template
        
        print("✅ Alle Importe erfolgreich!")
        print(f"✅ Verfügbare Schriftarten: {len(AVAILABLE_FONTS)}")
        
        # Test basic functionality
        print()
        print("3. Teste Basis-Funktionalität...")
        
        manager = AsyncTaskManager()
        print("✅ AsyncTaskManager erstellt")
        
        crawler = WebCrawler()
        print("✅ WebCrawler erstellt")
        
        # Test template generation
        test_data = {
            "url": "https://example.com",
            "title": "Test",
            "description": "Test description",
            "css": [],
            "js": [],
            "header_options": {
                "new_header": "Test Header",
                "keep_style": True
            }
        }
        
        template = build_template(test_data)
        assert "Test Header" in template
        print("✅ Template-Generierung funktioniert")
        
        print()
        print("=" * 80)
        print("✅ ALLE AUTOMATISIERTEN TESTS ERFOLGREICH!")
        print("=" * 80)
        
    except Exception as e:
        print(f"❌ Fehler bei automatisierten Tests: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--auto":
        # Run automated tests
        success = automated_test_sequence()
        if success:
            print()
            print("Möchtest du jetzt die GUI für manuelle Tests starten? (j/n)")
            if input().lower() == 'j':
                test_gui()
    else:
        # Run manual GUI test
        test_gui() 