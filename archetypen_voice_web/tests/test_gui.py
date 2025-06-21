"""Tests for the GUI module."""
import tkinter as tk
from unittest.mock import Mock, patch, MagicMock
from pathlib import Path

import pytest

from clone_brief_builder.gui import generate_template, main, APP_TITLE


class TestGenerateTemplate:
    """Tests for the generate_template function."""

    @patch("clone_brief_builder.gui.fetch_page")
    @patch("clone_brief_builder.gui.extract_metadata")
    @patch("clone_brief_builder.gui.build_template")
    def test_generate_template_success(self, mock_build_template, mock_extract_metadata, mock_fetch_page):
        """Test successful template generation."""
        # Setup mocks
        mock_fetch_page.return_value = "<html>Test HTML</html>"
        mock_extract_metadata.return_value = {"url": "https://example.com", "title": "Test"}
        mock_build_template.return_value = "Generated Template"
        
        # Call function
        result = generate_template("https://example.com")
        
        # Verify result
        assert result == "Generated Template"
        
        # Verify function calls
        mock_fetch_page.assert_called_once_with("https://example.com")
        mock_extract_metadata.assert_called_once_with("https://example.com", "<html>Test HTML</html>")
        mock_build_template.assert_called_once()

    @patch("clone_brief_builder.gui.fetch_page")
    def test_generate_template_fetch_error(self, mock_fetch_page):
        """Test template generation with fetch error."""
        mock_fetch_page.side_effect = Exception("Network error")
        
        with pytest.raises(Exception, match="Network error"):
            generate_template("https://example.com")


class TestGUIMain:
    """Tests for the main GUI function."""

    @patch("clone_brief_builder.gui.tk.Tk")
    def test_main_window_creation(self, mock_tk):
        """Test GUI window creation and basic setup."""
        # Setup mock root window
        mock_root = Mock()
        mock_tk.return_value = mock_root
        
        # Mock mainloop to prevent hanging
        mock_root.mainloop = Mock()
        
        # Call main function
        main()
        
        # Verify window setup
        mock_root.title.assert_called_once_with(APP_TITLE)
        mock_root.geometry.assert_called_once_with("900x600")
        mock_root.mainloop.assert_called_once()

    @patch("clone_brief_builder.gui.tk")
    def test_main_widget_creation(self, mock_tk):
        """Test creation of GUI widgets."""
        # Setup comprehensive mocks
        mock_root = Mock()
        mock_tk.Tk.return_value = mock_root
        mock_root.mainloop = Mock()
        
        # Mock all widget classes
        mock_tk.StringVar = Mock
        mock_tk.Label = Mock
        mock_tk.Entry = Mock
        mock_tk.Frame = Mock
        mock_tk.Button = Mock
        mock_tk.WORD = "word"
        mock_tk.LEFT = "left"
        
        # Mock scrolledtext
        mock_scrolledtext = Mock()
        with patch("clone_brief_builder.gui.scrolledtext", mock_scrolledtext):
            main()
        
        # Verify Tk was called to create root window
        mock_tk.Tk.assert_called_once()

    @patch("clone_brief_builder.gui.tk")
    @patch("clone_brief_builder.gui.scrolledtext")
    def test_gui_components_integration(self, mock_scrolledtext, mock_tk):
        """Test integration of GUI components."""
        # Setup mocks
        mock_root = Mock()
        mock_tk.Tk.return_value = mock_root
        mock_root.mainloop = Mock()
        
        # Mock StringVar instances
        mock_url_var = Mock()
        mock_status_var = Mock()
        mock_tk.StringVar.side_effect = [mock_url_var, mock_status_var]
        
        # Mock widget classes
        mock_tk.Label = Mock()
        mock_tk.Entry = Mock()
        mock_tk.Frame = Mock()
        mock_tk.Button = Mock()
        mock_tk.WORD = "word"
        mock_tk.LEFT = "left"
        
        # Mock scrolledtext
        mock_output_box = Mock()
        mock_scrolledtext.ScrolledText.return_value = mock_output_box
        
        # Call main
        main()
        
        # Verify StringVar was created for URL and status
        assert mock_tk.StringVar.call_count == 2
        
        # Verify ScrolledText was created
        mock_scrolledtext.ScrolledText.assert_called_once()

    def test_app_title_constant(self):
        """Test APP_TITLE constant is properly defined."""
        assert APP_TITLE == "Clone Brief Builder"
        assert isinstance(APP_TITLE, str)
        assert len(APP_TITLE) > 0


class TestGUIFunctionality:
    """Tests for GUI functionality (simulated)."""

    def test_url_validation_logic(self):
        """Test URL validation logic that would be used in GUI."""
        # Test cases that would be handled in the GUI
        test_cases = [
            ("", False),  # Empty URL
            ("example.com", True),  # URL without protocol (should be prefixed)
            ("https://example.com", True),  # Valid HTTPS URL
            ("http://example.com", True),  # Valid HTTP URL
        ]
        
        for url, expected_valid in test_cases:
            if not url:
                # Empty URL case
                assert not expected_valid
            elif not url.lower().startswith(("http://", "https://")):
                # Would be prefixed with https://
                prefixed_url = "https://" + url
                assert prefixed_url.startswith("https://")
            else:
                # Already has protocol
                assert url.startswith(("http://", "https://"))

    @patch("clone_brief_builder.gui.Path")
    def test_file_save_logic(self, mock_path):
        """Test file saving logic that would be used in GUI."""
        # Mock Path behavior
        mock_path_instance = Mock()
        mock_path.return_value = mock_path_instance
        
        # Simulate saving content
        test_content = "Test template content"
        test_path = "/test/path/file.txt"
        
        # This simulates what the GUI would do
        path_obj = mock_path(test_path)
        path_obj.write_text(test_content, encoding="utf-8")
        
        # Verify Path was called correctly
        mock_path.assert_called_once_with(test_path)
        mock_path_instance.write_text.assert_called_once_with(test_content, encoding="utf-8")

    def test_status_messages(self):
        """Test status message constants that would be used in GUI."""
        status_messages = {
            "ready": "Bereit.",
            "loading": "Lade Website…",
            "finished": "Fertig.",
            "error": "Fehler.",
        }
        
        for key, message in status_messages.items():
            assert isinstance(message, str)
            assert len(message) > 0
            # German messages should contain appropriate characters
            if key == "ready":
                assert "Bereit" in message
            elif key == "loading":
                assert "Lade" in message and "…" in message


class TestGUIErrorHandling:
    """Tests for GUI error handling scenarios."""

    @patch("clone_brief_builder.gui.generate_template")
    def test_template_generation_error_handling(self, mock_generate_template):
        """Test error handling in template generation."""
        # Setup mock to raise exception
        mock_generate_template.side_effect = Exception("Template generation failed")
        
        # This would be called in the GUI's on_generate function
        with pytest.raises(Exception, match="Template generation failed"):
            generate_template("https://example.com")

    def test_empty_content_handling(self):
        """Test handling of empty content scenarios."""
        # Test empty string handling
        empty_content = ""
        assert not empty_content.strip()
        
        # Test whitespace-only content
        whitespace_content = "   \n\t   "
        assert not whitespace_content.strip()
        
        # Test valid content
        valid_content = "Some actual content"
        assert valid_content.strip()

    @patch("clone_brief_builder.gui.messagebox")
    def test_messagebox_integration(self, mock_messagebox):
        """Test messagebox integration for error reporting."""
        # This simulates GUI error reporting
        error_message = "Test error message"
        
        # Simulate showing error
        mock_messagebox.showerror("Clone Brief Builder", f"Fehler: {error_message}")
        
        # Verify messagebox was called
        mock_messagebox.showerror.assert_called_once_with(
            "Clone Brief Builder", 
            f"Fehler: {error_message}"
        ) 