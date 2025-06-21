"""Tests for the CLI module."""
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

from clone_brief_builder.cli import create_parser, main


class TestCLIMain:
    """Test the main CLI functionality."""

    @patch("clone_brief_builder.cli.fetch_page")
    @patch("clone_brief_builder.cli.extract_metadata")
    @patch("clone_brief_builder.cli.build_template")
    @patch("sys.argv", ["clone-brief", "https://example.com"])
    def test_main_print_output(self, mock_build_template, mock_extract_metadata, mock_fetch_page, capsys):
        """Test CLI output to stdout."""
        # Setup mocks
        mock_fetch_page.return_value = "<html>Mock HTML</html>"
        mock_extract_metadata.return_value = {"url": "https://example.com", "title": "Test"}
        mock_build_template.return_value = "Mock Template Output"

        # Run CLI
        result = main()
        assert result == 0
        
        # Verify function calls
        mock_fetch_page.assert_called_once_with("https://example.com")
        mock_extract_metadata.assert_called_once()
        mock_build_template.assert_called_once()

    @patch("clone_brief_builder.cli.fetch_page")
    @patch("clone_brief_builder.cli.extract_metadata")
    @patch("clone_brief_builder.cli.build_template")
    def test_main_save_to_file(self, mock_build_template, mock_extract_metadata, mock_fetch_page, tmp_path, capsys):
        """Test CLI saving output to file."""
        # Setup mocks
        mock_fetch_page.return_value = "<html>Mock HTML</html>"
        mock_extract_metadata.return_value = {"url": "https://example.com", "title": "Test"}
        mock_build_template.return_value = "Mock Template Content"

        # Create temp file path
        output_file = tmp_path / "test_output.txt"

        # Run CLI with output file
        with patch("sys.argv", ["clone-brief", "https://example.com", "-o", str(output_file)]):
            result = main()
            assert result == 0

        # Check file was created and contains expected content
        assert output_file.exists()
        content = output_file.read_text(encoding="utf-8")
        assert "Mock Template Content" in content

        # Verify function calls
        mock_fetch_page.assert_called_once_with("https://example.com")
        mock_extract_metadata.assert_called_once()
        mock_build_template.assert_called_once()

    @patch("clone_brief_builder.cli.fetch_page")
    def test_main_fetch_error(self, mock_fetch_page):
        """Test CLI handling of fetch errors."""
        mock_fetch_page.side_effect = Exception("Network error")

        with patch("sys.argv", ["clone-brief", "https://example.com"]):
            result = main()
            assert result == 1  # Error exit code

    def test_main_invalid_arguments(self):
        """Test CLI with invalid arguments."""
        with patch("sys.argv", ["clone-brief"]):  # No URL provided
            with pytest.raises(SystemExit):
                main()

    def test_main_help(self, capsys):
        """Test CLI help output."""
        with patch("sys.argv", ["clone-brief", "--help"]):
            with pytest.raises(SystemExit):
                main()

    @patch("clone_brief_builder.cli.fetch_page")
    @patch("clone_brief_builder.cli.extract_metadata")
    @patch("clone_brief_builder.cli.build_template")
    def test_main_long_output_flag(self, mock_build_template, mock_extract_metadata, mock_fetch_page, tmp_path):
        """Test CLI with long form output flag."""
        # Setup mocks
        mock_fetch_page.return_value = "<html>Mock HTML</html>"
        mock_extract_metadata.return_value = {"url": "https://example.com", "title": "Test"}
        mock_build_template.return_value = "Long Flag Test Content"

        # Create temp file path
        output_file = tmp_path / "long_flag_test.txt"

        # Run CLI with long form output flag
        with patch("sys.argv", ["clone-brief", "https://example.com", "--output", str(output_file)]):
            result = main()
            assert result == 0

        # Check file was created
        assert output_file.exists()
        content = output_file.read_text(encoding="utf-8")
        assert "Long Flag Test Content" in content

    @patch("clone_brief_builder.cli.fetch_page")
    @patch("clone_brief_builder.cli.extract_metadata")
    @patch("clone_brief_builder.cli.build_template")
    def test_main_with_complex_url(self, mock_build_template, mock_extract_metadata, mock_fetch_page):
        """Test CLI with complex URL containing parameters."""
        complex_url = "https://example.com/path?param=value&other=123#section"

        # Setup mocks
        mock_fetch_page.return_value = "<html>Complex URL Test</html>"
        mock_extract_metadata.return_value = {"url": complex_url, "title": "Complex"}
        mock_build_template.return_value = "Complex URL Template"

        # Run CLI
        with patch("sys.argv", ["clone-brief", complex_url]):
            result = main()
            assert result == 0

        # Verify correct URL was passed
        mock_fetch_page.assert_called_once_with(complex_url)

    def test_main_argument_parsing(self):
        """Test argument parsing functionality."""
        # Test with minimal args
        with patch("clone_brief_builder.cli.fetch_page"), \
             patch("clone_brief_builder.cli.extract_metadata"), \
             patch("clone_brief_builder.cli.build_template"):

            # This should not raise an exception
            with patch("sys.argv", ["clone-brief", "https://test.com"]):
                result = main()
                assert result == 0

    @patch("clone_brief_builder.cli.Path")
    @patch("clone_brief_builder.cli.fetch_page")
    @patch("clone_brief_builder.cli.extract_metadata")
    @patch("clone_brief_builder.cli.build_template")
    def test_main_file_write_error(self, mock_build_template, mock_extract_metadata, mock_fetch_page, mock_path):
        """Test CLI handling of file write errors."""
        # Setup mocks
        mock_fetch_page.return_value = "<html>Mock HTML</html>"
        mock_extract_metadata.return_value = {"url": "https://example.com", "title": "Test"}
        mock_build_template.return_value = "Template Content"

        # Mock Path to raise an error on write_text
        mock_path_instance = Mock()
        mock_path_instance.write_text.side_effect = PermissionError("Cannot write file")
        mock_path.return_value = mock_path_instance

        with patch("sys.argv", ["clone-brief", "https://example.com", "-o", "/invalid/path/file.txt"]):
            result = main()
            assert result == 1  # Error exit code


class TestCLISnapshot:
    """Test CLI snapshot-related functionality."""

    @patch("clone_brief_builder.cli.asyncio.run")
    @patch("clone_brief_builder.cli.crawl_website")
    def test_main_with_snapshot(self, mock_crawl_website, mock_asyncio_run):
        """Test CLI with snapshot option."""
        # Setup mock return value
        mock_crawl_result = {
            "url": "https://example.com",
            "html": "<html>Test</html>",
            "assets": {"css": [], "js": [], "images": []},
            "api_calls": 0,
            "snapshot_path": "snapshot"
        }
        mock_crawl_website.return_value = mock_crawl_result
        mock_asyncio_run.return_value = 0

        with patch("sys.argv", ["clone-brief", "https://example.com", "--snapshot"]):
            result = main()
            assert result == 0

        # Verify asyncio.run was called
        mock_asyncio_run.assert_called_once()


class TestCreateParser:
    """Test argument parser creation."""

    def test_create_parser(self):
        """Test parser creation and configuration."""
        parser = create_parser()
        
        # Test parser exists and has expected arguments
        assert parser is not None
        
        # Test parsing valid arguments
        args = parser.parse_args(["https://example.com"])
        assert args.url == "https://example.com"
        assert args.output == "claude_briefing.txt"
        assert args.snapshot is False
        
        # Test parsing with options
        args = parser.parse_args([
            "https://example.com", 
            "-o", "custom.txt", 
            "--snapshot",
            "--snapshot-dir", "custom_snapshot"
        ])
        assert args.url == "https://example.com"
        assert args.output == "custom.txt"
        assert args.snapshot is True
        assert args.snapshot_dir == "custom_snapshot" 