"""Tests for the metadata module."""
import datetime
from unittest.mock import Mock, patch

import pytest
import requests

from clone_brief_builder.metadata import build_template, extract_metadata, fetch_page


class TestFetchPage:
    """Tests for the fetch_page function."""

    @patch("clone_brief_builder.metadata.requests.get")
    def test_fetch_page_success(self, mock_get, mock_response):
        """Test successful page fetching."""
        mock_get.return_value = mock_response
        
        result = fetch_page("https://example.com")
        
        assert "Mock Website" in result
        mock_get.assert_called_once()

    @patch("clone_brief_builder.metadata.requests.get")
    def test_fetch_page_http_error(self, mock_get):
        """Test HTTP error handling."""
        mock_response = Mock()
        mock_response.raise_for_status.side_effect = requests.HTTPError("404 Not Found")
        mock_get.return_value = mock_response
        
        with pytest.raises(requests.HTTPError):
            fetch_page("https://example.com/nonexistent")

    @patch("clone_brief_builder.metadata.requests.get")
    def test_fetch_page_timeout(self, mock_get):
        """Test timeout handling."""
        mock_get.side_effect = requests.Timeout("Request timed out")
        
        with pytest.raises(requests.Timeout):
            fetch_page("https://slow-website.com")


class TestExtractMetadata:
    """Tests for the extract_metadata function."""

    def test_extract_metadata_complete(self, sample_url, sample_html):
        """Test metadata extraction with complete HTML."""
        result = extract_metadata(sample_url, sample_html)
        
        assert result["url"] == sample_url
        assert result["title"] == "Test Website"
        assert result["description"] == "This is a test website"
        assert "https://example.com/style.css" in result["css"]
        assert "/local/style.css" in result["css"]
        assert "https://example.com/script.js" in result["js"]
        assert "/local/script.js" in result["js"]

    def test_extract_metadata_minimal_html(self, sample_url):
        """Test metadata extraction with minimal HTML."""
        minimal_html = "<html><head></head><body></body></html>"
        
        result = extract_metadata(sample_url, minimal_html)
        
        assert result["url"] == sample_url
        assert result["title"] == ""
        assert result["description"] == ""
        assert result["css"] == []
        assert result["js"] == []


class TestBuildTemplate:
    """Tests for the build_template function."""

    @patch("clone_brief_builder.metadata.datetime")
    def test_build_template_complete_data(self, mock_datetime, sample_metadata):
        """Test template building with complete metadata."""
        mock_datetime.date.today.return_value.isoformat.return_value = "2024-01-15"
        
        result = build_template(sample_metadata)
        
        assert "BRIEFING-TEMPLATE" in result
        assert "Test Website" in result
        assert "https://example.com" in result
        assert "This is a test website" in result
        assert "2024-01-15" in result

    @patch("clone_brief_builder.metadata.datetime")
    def test_build_template_minimal_data(self, mock_datetime):
        """Test template building with minimal metadata."""
        mock_datetime.date.today.return_value.isoformat.return_value = "2024-01-15"
        
        minimal_data = {
            "url": "https://minimal.com",
            "title": "",
            "description": "",
            "css": [],
            "js": [],
        }
        
        result = build_template(minimal_data)
        
        assert "https://minimal.com" in result
        assert "(keine externen Stylesheets)" in result
        assert "(keine externen Skripte)" in result 