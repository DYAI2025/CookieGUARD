"""Simple Tkinter GUI to generate the briefing template with snapshot functionality."""
from __future__ import annotations

import asyncio
import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, scrolledtext, ttk
import traceback

from .crawler import crawl_website
from .metadata import build_template, extract_metadata, fetch_page

APP_TITLE = "Clone Brief Builder"

# Verfügbare Schriftarten für das Dropdown
AVAILABLE_FONTS = [
    "Arial",
    "Helvetica", 
    "Times New Roman",
    "Georgia",
    "Verdana",
    "Roboto",
    "Open Sans",
    "Montserrat",
    "Playfair Display",
    "Lato"
]

class AsyncTaskManager:
    """Manages async tasks and prevents conflicts on multiple runs."""
    
    def __init__(self):
        self.current_task = None
        self.current_thread = None
    
    def cancel_current_task(self):
        """Cancel any running task."""
        if self.current_thread and self.current_thread.is_alive():
            # Note: We can't directly cancel the thread, but we can mark it
            self.current_task = None
    
    def run_async_task(self, coro, callback, root):
        """Run async task in separate thread with proper cleanup."""
        # Cancel any existing task
        self.cancel_current_task()
        
        def run_in_thread():
            # Create new event loop for this thread
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                # Store reference to this task
                self.current_task = coro
                
                try:
                    result = loop.run_until_complete(coro)
                    # Only callback if this is still the current task
                    if self.current_task == coro:
                        root.after(0, lambda: callback(result, None))
                except Exception as e:
                    # Only callback if this is still the current task
                    if self.current_task == coro:
                        root.after(0, lambda: callback(None, e))
                finally:
                    # Clean up
                    try:
                        # Cancel any remaining tasks
                        pending = asyncio.all_tasks(loop)
                        for task in pending:
                            task.cancel()
                        
                        # Wait for cancellation to complete
                        if pending:
                            loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
                    except:
                        pass
                    finally:
                        loop.close()
                        
            except Exception as e:
                if self.current_task == coro:
                    root.after(0, lambda: callback(None, e))
        
        self.current_thread = threading.Thread(target=run_in_thread)
        self.current_thread.daemon = True
        self.current_thread.start()

def generate_template(url: str, header_options: dict = None) -> str:
    html = fetch_page(url)
    data = extract_metadata(url, html)
    data['header_options'] = header_options
    return build_template(data)

async def generate_template_with_snapshot(url: str, snapshot_dir: str = "snapshots", header_options: dict = None) -> tuple[str, dict]:
    """Generate template with full snapshot."""
    result = await crawl_website(url, output_dir=snapshot_dir, header_options=header_options)
    data = extract_metadata(url, result['html'])
    data['header_options'] = header_options
    template = build_template(data, snapshot_info=result)
    return template, result

def main() -> None:
    root = tk.Tk()
    root.title(APP_TITLE)
    root.geometry("1200x800")
    
    # Initialize task manager
    task_manager = AsyncTaskManager()

    # URL Input
    url_var = tk.StringVar()
    tk.Label(root, text="Website-URL:", font=("Arial", 10, "bold")).pack(anchor="w", padx=10, pady=(10, 0))
    url_entry = tk.Entry(root, textvariable=url_var, width=100)
    url_entry.pack(fill="x", padx=10, pady=5)
    url_entry.focus_set()

    # Options Frame
    options_frame = tk.Frame(root)
    options_frame.pack(fill="x", padx=10, pady=5)
    
    # Snapshot option
    snapshot_var = tk.BooleanVar(value=True)  # Default to True for better functionality
    snapshot_check = tk.Checkbutton(options_frame, text="Vollständigen Snapshot erstellen (Headless Browser)", 
                                variable=snapshot_var)
    snapshot_check.pack(side=tk.LEFT)
    
    # Snapshot directory
    snapshot_dir_var = tk.StringVar(value="snapshots")
    tk.Label(options_frame, text="Snapshot-Basis-Verzeichnis:").pack(side=tk.LEFT, padx=(20, 5))
    snapshot_dir_entry = tk.Entry(options_frame, textvariable=snapshot_dir_var, width=20)
    snapshot_dir_entry.pack(side=tk.LEFT, padx=5)

    # Header/Headline Customization Frame
    header_frame = tk.LabelFrame(root, text="Header/Headline Anpassung", font=("Arial", 10, "bold"))
    header_frame.pack(fill="x", padx=10, pady=10)
    
    # New header text
    tk.Label(header_frame, text="Neuer Header-Text:").grid(row=0, column=0, sticky="w", padx=5, pady=5)
    header_text_var = tk.StringVar()
    header_text_entry = tk.Entry(header_frame, textvariable=header_text_var, width=50)
    header_text_entry.grid(row=0, column=1, columnspan=2, sticky="ew", padx=5, pady=5)
    
    # Keep style checkbox
    keep_style_var = tk.BooleanVar(value=True)
    keep_style_check = tk.Checkbutton(header_frame, text="Style beibehalten", variable=keep_style_var,
                                     command=lambda: toggle_font_options())
    keep_style_check.grid(row=1, column=0, sticky="w", padx=5, pady=5)
    
    # Font selection
    tk.Label(header_frame, text="Schriftart:").grid(row=1, column=1, sticky="w", padx=5, pady=5)
    font_var = tk.StringVar(value=AVAILABLE_FONTS[0])
    font_dropdown = ttk.Combobox(header_frame, textvariable=font_var, values=AVAILABLE_FONTS, state="readonly", width=20)
    font_dropdown.grid(row=1, column=2, sticky="w", padx=5, pady=5)
    
    # Configure grid weights
    header_frame.grid_columnconfigure(1, weight=1)
    
    def toggle_font_options():
        """Enable/disable font options based on keep_style checkbox."""
        if keep_style_var.get():
            font_dropdown.config(state="disabled")
        else:
            font_dropdown.config(state="readonly")
    
    # Initial state
    toggle_font_options()

    # Progress bar
    progress_var = tk.DoubleVar()
    progress_bar = ttk.Progressbar(root, variable=progress_var, mode='indeterminate')
    progress_bar.pack(fill="x", padx=10, pady=5)

    # Output area with tabs
    notebook = ttk.Notebook(root)
    notebook.pack(fill="both", expand=True, padx=10, pady=10)
    
    # Briefing tab
    briefing_frame = tk.Frame(notebook)
    notebook.add(briefing_frame, text="Claude Briefing")
    
    output_box = scrolledtext.ScrolledText(briefing_frame, wrap=tk.WORD, font=("Courier", 10))
    output_box.pack(fill="both", expand=True)
    
    # Snapshot info tab
    info_frame = tk.Frame(notebook)
    notebook.add(info_frame, text="Snapshot Info")
    
    info_box = scrolledtext.ScrolledText(info_frame, wrap=tk.WORD, font=("Courier", 10))
    info_box.pack(fill="both", expand=True)

    # Status bar
    status_var = tk.StringVar(value="Bereit.")
    status_label = tk.Label(root, textvariable=status_var, anchor="w", relief=tk.SUNKEN)
    status_label.pack(fill="x", padx=10, pady=(0, 10))

    # Generate button state
    generate_button = None

    def get_header_options():
        """Get header customization options."""
        if header_text_var.get().strip():
            return {
                'new_header': header_text_var.get().strip(),
                'keep_style': keep_style_var.get(),
                'font_family': font_var.get() if not keep_style_var.get() else None
            }
        return None

    def on_generate() -> None:
        url = url_var.get().strip()
        if not url:
            messagebox.showwarning(APP_TITLE, "Bitte eine URL eingeben.")
            return
        if not url.lower().startswith(("http://", "https://")):
            url_var.set("https://" + url)
            url = url_var.get()
        
        # Cancel any previous task
        task_manager.cancel_current_task()
        
        # Clear previous results
        output_box.delete("1.0", tk.END)
        info_box.delete("1.0", tk.END)
        
        # Get header options
        header_options = get_header_options()
        
        # Disable generate button during processing
        if generate_button:
            generate_button.config(state="disabled")
        
        if snapshot_var.get():
            # Use headless crawler
            status_var.set("Starte Headless Browser...")
            progress_bar.start()
            
            def handle_snapshot_result(result, error):
                # Re-enable generate button
                if generate_button:
                    generate_button.config(state="normal")
                
                progress_bar.stop()
                if error:
                    error_msg = f"Fehler: {str(error)}\n\nDetails:\n{traceback.format_exc()}"
                    messagebox.showerror(APP_TITLE, error_msg)
                    status_var.set("❌ Fehler beim Erstellen des Snapshots.")
                    return
                
                try:
                    template, snapshot_result = result
                    output_box.insert(tk.END, template)
                    
                    # Show snapshot info
                    website_name = snapshot_result.get('website_name', 'unknown')
                    snapshot_path = snapshot_result.get('snapshot_path', 'N/A')
                    screenshots = snapshot_result.get('screenshots', {})
                    
                    info_text = f"""✅ Snapshot erfolgreich erstellt!

🌐 Website: {snapshot_result['url']}
📁 Ordner: {website_name}/
📍 Pfad: {snapshot_path}

📁 STRUKTUR:
├── index.html                 # Hauptdatei (mit lokalen Asset-Links)
├── assets/
│   ├── css/                   # {len(snapshot_result['assets']['css'])} CSS-Dateien
│   ├── js/                    # {len(snapshot_result['assets']['js'])} JS-Dateien  
│   └── images/                # {len(snapshot_result['assets']['images'])} Bilder
├── screenshots/
│   ├── full_page.png          # Vollständige Seitendarstellung
│   └── viewport.png           # Sichtbarer Bereich
├── mock_api/                  # {snapshot_result['api_calls']} API-Aufrufe abgefangen
└── metadata.json              # Snapshot-Informationen

📸 SCREENSHOTS:
• Vollständige Seite: {screenshots.get('full_page', 'N/A')}
• Viewport: {screenshots.get('viewport', 'N/A')}

🎯 NUTZUNG:
1. Öffne {snapshot_path}/index.html im Browser
2. Alle Assets sind lokal verfügbar
3. Screenshots zeigen das Original-Aussehen
4. Claude-Briefing enthält alle Pfad-Referenzen

💡 TIPP: "Snapshot öffnen" Button nutzen für direkten Zugriff!
"""
                    info_box.insert(tk.END, info_text)
                    status_var.set(f"✅ Snapshot erstellt: {website_name}/")
                    
                    # Show header options if used
                    if header_options:
                        info_box.insert(tk.END, f"\n\n🎨 HEADER-ANPASSUNG:\n")
                        info_box.insert(tk.END, f"• Neuer Text: {header_options['new_header']}\n")
                        info_box.insert(tk.END, f"• Style beibehalten: {'Ja' if header_options['keep_style'] else 'Nein'}\n")
                        if not header_options['keep_style']:
                            info_box.insert(tk.END, f"• Neue Schriftart: {header_options['font_family']}\n")
                    
                except Exception as e:
                    error_msg = f"Fehler beim Verarbeiten der Ergebnisse: {str(e)}\n\nDetails:\n{traceback.format_exc()}"
                    messagebox.showerror(APP_TITLE, error_msg)
                    status_var.set("❌ Fehler beim Verarbeiten.")
            
            coro = generate_template_with_snapshot(url, snapshot_dir_var.get(), header_options)
            task_manager.run_async_task(coro, handle_snapshot_result, root)
            
        else:
            # Use simple HTTP request
            status_var.set("Lade Website...")
            root.update_idletasks()
            try:
                template = generate_template(url, header_options)
                output_box.insert(tk.END, template)
                status_var.set("✅ Briefing erstellt (nur HTTP-Modus).")
            except Exception as exc:
                error_msg = f"Fehler: {str(exc)}\n\nDetails:\n{traceback.format_exc()}"
                messagebox.showerror(APP_TITLE, error_msg)
                status_var.set("❌ Fehler.")
            finally:
                # Re-enable generate button
                if generate_button:
                    generate_button.config(state="normal")

    def on_save() -> None:
        current_tab = notebook.select()
        current_tab_text = notebook.tab(current_tab, "text")
        
        if current_tab_text == "Claude Briefing":
            content = output_box.get("1.0", tk.END)
            default_name = "claude_briefing.txt"
        else:
            content = info_box.get("1.0", tk.END)
            default_name = "snapshot_info.txt"
        
        if not content.strip():
            messagebox.showinfo(APP_TITLE, "Keine Daten zum Speichern.")
            return
            
        file_path = filedialog.asksaveasfilename(
            defaultextension=".txt",
            initialfile=default_name,
            filetypes=[("Textdatei", "*.txt"), ("Alle Dateien", "*.*")],
        )
        if file_path:
            try:
                Path(file_path).write_text(content, encoding="utf-8")
                status_var.set(f"💾 Gespeichert: {Path(file_path).name}")
            except Exception as e:
                messagebox.showerror(APP_TITLE, f"Fehler beim Speichern: {e}")

    def on_open_snapshot() -> None:
        """Open snapshot directory in file manager."""
        snapshot_path = Path(snapshot_dir_var.get())
        if snapshot_path.exists():
            import subprocess
            import sys
            try:
                if sys.platform == "darwin":  # macOS
                    subprocess.run(["open", str(snapshot_path)])
                elif sys.platform == "win32":  # Windows
                    subprocess.run(["explorer", str(snapshot_path)])
                else:  # Linux
                    subprocess.run(["xdg-open", str(snapshot_path)])
            except Exception as e:
                messagebox.showerror(APP_TITLE, f"Fehler beim Öffnen des Verzeichnisses: {e}")
        else:
            messagebox.showinfo(APP_TITLE, f"Snapshot-Verzeichnis {snapshot_path} existiert noch nicht.")

    def on_closing():
        """Handle application closing."""
        task_manager.cancel_current_task()
        root.destroy()

    # Buttons
    btn_frame = tk.Frame(root)
    btn_frame.pack(pady=5)
    generate_button = tk.Button(btn_frame, text="📄 Template erzeugen", command=on_generate, font=("Arial", 10, "bold"), bg="#4CAF50", fg="white")
    generate_button.pack(side=tk.LEFT, padx=5)
    tk.Button(btn_frame, text="💾 Speichern", command=on_save).pack(side=tk.LEFT, padx=5)
    tk.Button(btn_frame, text="📂 Snapshots öffnen", command=on_open_snapshot).pack(side=tk.LEFT, padx=5)

    # Handle window closing
    root.protocol("WM_DELETE_WINDOW", on_closing)
    
    root.mainloop()

if __name__ == "__main__":
    main() 