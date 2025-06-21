"""Automated GUI tests for Clone Brief Builder with header customization."""
import pytest
import asyncio
import sys
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import tkinter as tk
from tkinter import ttk

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from clone_brief_builder.gui import main, AsyncTaskManager, generate_template, generate_template_with_snapshot, AVAILABLE_FONTS
from clone_brief_builder.metadata import build_template, extract_metadata


class TestGUIAutomation:
    """Automated tests for GUI functionality."""
    
    @pytest.fixture
    def mock_tk_root(self):
        """Create a mock Tk root window."""
        with patch('tkinter.Tk') as mock_tk:
            root = MagicMock()
            root.title = MagicMock()
            root.geometry = MagicMock()
            root.mainloop = MagicMock()
            root.after = MagicMock()
            root.protocol = MagicMock()
            root.destroy = MagicMock()
            mock_tk.return_value = root
            yield root
    
    def test_available_fonts(self):
        """Test that all required fonts are available."""
        assert len(AVAILABLE_FONTS) == 10
        assert "Arial" in AVAILABLE_FONTS
        assert "Helvetica" in AVAILABLE_FONTS
        assert "Times New Roman" in AVAILABLE_FONTS
        assert "Roboto" in AVAILABLE_FONTS
    
    def test_async_task_manager(self):
        """Test AsyncTaskManager functionality."""
        manager = AsyncTaskManager()
        assert manager.current_task is None
        assert manager.current_thread is None
        
        # Test cancel functionality
        manager.cancel_current_task()
        assert manager.current_task is None
    
    @patch('clone_brief_builder.metadata.fetch_page')
    @patch('clone_brief_builder.metadata.extract_metadata')
    @patch('clone_brief_builder.metadata.build_template')
    def test_generate_template_with_header(self, mock_build, mock_extract, mock_fetch):
        """Test template generation with header options."""
        # Setup mocks
        mock_fetch.return_value = "<html><h1>Original Header</h1></html>"
        mock_extract.return_value = {
            "url": "https://example.com",
            "title": "Test Page",
            "description": "Test description",
            "css": [],
            "js": []
        }
        mock_build.return_value = "Test briefing template"
        
        # Test without header options
        result = generate_template("https://example.com")
        assert result == "Test briefing template"
        assert mock_extract.call_args[0][0] == "https://example.com"
        
        # Test with header options
        header_options = {
            'new_header': 'New Custom Header',
            'keep_style': False,
            'font_family': 'Arial'
        }
        result = generate_template("https://example.com", header_options)
        
        # Verify header options were passed
        call_args = mock_build.call_args[0][0]
        assert 'header_options' in call_args
        assert call_args['header_options'] == header_options
    
    @pytest.mark.asyncio
    async def test_generate_template_with_snapshot_header(self):
        """Test async snapshot generation with header options."""
        with patch('clone_brief_builder.crawler.crawl_website') as mock_crawl:
            # Setup mock response
            mock_crawl.return_value = {
                "url": "https://example.com",
                "website_name": "example_com",
                "html": "<html><h1>Test</h1></html>",
                "assets": {"css": [], "js": [], "images": []},
                "api_calls": 0,
                "snapshot_path": "snapshots/example_com",
                "screenshots": {
                    "full_page": "snapshots/example_com/screenshots/full_page.png",
                    "viewport": "snapshots/example_com/screenshots/viewport.png"
                },
                "header_options": {
                    'new_header': 'Custom Header',
                    'keep_style': True
                }
            }
            
            # Test with header options
            header_options = {
                'new_header': 'Custom Header',
                'keep_style': True
            }
            
            template, result = await generate_template_with_snapshot(
                "https://example.com",
                "snapshots",
                header_options
            )
            
            # Verify the crawler was called with header options
            mock_crawl.assert_called_with(
                "https://example.com",
                output_dir="snapshots",
                header_options=header_options
            )
            
            # Verify result contains header options
            assert result['header_options'] == header_options
    
    def test_header_options_in_template(self):
        """Test that header options are included in the briefing template."""
        data = {
            "url": "https://example.com",
            "title": "Test Page",
            "description": "Test description",
            "css": ["style.css"],
            "js": ["script.js"],
            "header_options": {
                'new_header': 'My New Header',
                'keep_style': False,
                'font_family': 'Helvetica'
            }
        }
        
        template = build_template(data)
        
        # Check that header information is in the template
        assert "HEADER-ANPASSUNGEN:" in template
        assert "My New Header" in template
        assert "Style beibehalten: Nein" in template
        assert "Neue Schriftart: Helvetica" in template
    
    def test_header_options_keep_style(self):
        """Test header options when keeping original style."""
        data = {
            "url": "https://example.com",
            "title": "Test Page",
            "description": "Test description",
            "css": [],
            "js": [],
            "header_options": {
                'new_header': 'Another Header',
                'keep_style': True
            }
        }
        
        template = build_template(data)
        
        # Check that header information is in the template
        assert "HEADER-ANPASSUNGEN:" in template
        assert "Another Header" in template
        assert "Style beibehalten: Ja" in template
        assert "Neue Schriftart:" not in template  # Should not mention font when keeping style
    
    @pytest.mark.integration
    def test_gui_components_creation(self):
        """Test that all GUI components are created properly."""
        # This is a simplified test that checks component creation logic
        # In a real scenario, you'd use a GUI testing framework
        
        # Test StringVar creation
        url_var = tk.StringVar()
        assert url_var.get() == ""
        
        # Test BooleanVar creation
        snapshot_var = tk.BooleanVar(value=True)
        assert snapshot_var.get() is True
        
        keep_style_var = tk.BooleanVar(value=True)
        assert keep_style_var.get() is True
        
        # Test font selection
        font_var = tk.StringVar(value=AVAILABLE_FONTS[0])
        assert font_var.get() == "Arial"


class TestHeaderModification:
    """Test header modification functionality."""
    
    @pytest.mark.asyncio
    async def test_header_modification_in_html(self):
        """Test that headers are correctly modified in HTML."""
        from clone_brief_builder.crawler import WebCrawler
        
        crawler = WebCrawler()
        crawler.header_options = {
            'new_header': 'Modified Header Text',
            'keep_style': False,
            'font_family': 'Georgia'
        }
        
        # Test HTML with h1
        html = """
        <html>
        <head><title>Test</title></head>
        <body>
            <h1>Original Header</h1>
            <p>Some content</p>
        </body>
        </html>
        """
        
        # Mock page object
        mock_page = MagicMock()
        
        modified_html = await crawler._apply_header_modifications(html, mock_page)
        
        assert "Modified Header Text" in modified_html
        assert "font-family: 'Georgia', sans-serif" in modified_html
        assert "Original Header" not in modified_html
    
    @pytest.mark.asyncio
    async def test_header_modification_keep_style(self):
        """Test header modification when keeping original style."""
        from clone_brief_builder.crawler import WebCrawler
        
        crawler = WebCrawler()
        crawler.header_options = {
            'new_header': 'New Text Only',
            'keep_style': True
        }
        
        html = """
        <html>
        <body>
            <h1 style="color: red; font-size: 24px;">Original</h1>
        </body>
        </html>
        """
        
        mock_page = MagicMock()
        modified_html = await crawler._apply_header_modifications(html, mock_page)
        
        assert "New Text Only" in modified_html
        assert "color: red" in modified_html  # Original style should be preserved
        assert "font-family:" not in modified_html  # No new font should be added


def run_automated_tests():
    """Run all automated tests and generate report."""
    import subprocess
    
    print("🧪 Running automated GUI tests...")
    print("=" * 60)
    
    # Run pytest with coverage
    result = subprocess.run([
        sys.executable, "-m", "pytest", 
        __file__,
        "-v",
        "--tb=short",
        "-k", "not integration"  # Skip integration tests in automated run
    ], capture_output=True, text=True)
    
    print(result.stdout)
    if result.stderr:
        print("Errors:", result.stderr)
    
    if result.returncode == 0:
        print("\n✅ All tests passed!")
    else:
        print("\n❌ Some tests failed!")
    
    return result.returncode


if __name__ == "__main__":
    # Run automated tests when script is executed directly
    exit_code = run_automated_tests()
    sys.exit(exit_code) 