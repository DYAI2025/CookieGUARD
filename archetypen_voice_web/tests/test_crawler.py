"""Tests for the crawler module."""
import asyncio
import json
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from clone_brief_builder.crawler import WebCrawler, crawl_website


class TestWebCrawler:
    """Test cases for WebCrawler class."""
    
    def test_init(self):
        """Test WebCrawler initialization."""
        crawler = WebCrawler("test_output")
        assert crawler.output_dir == Path("test_output")
        assert crawler.assets_dir == Path("test_output/assets")
        assert crawler.mock_api_dir == Path("mock_api")
        assert crawler.downloaded_assets == set()
        assert crawler.api_calls == []
    
    def test_is_api_call(self):
        """Test API call detection."""
        crawler = WebCrawler()
        
        # Positive cases
        assert crawler._is_api_call("https://example.com/api/users")
        assert crawler._is_api_call("https://example.com/rest/data")
        assert crawler._is_api_call("https://example.com/graphql")
        assert crawler._is_api_call("https://example.com/data.json")
        assert crawler._is_api_call("https://example.com/v1/endpoint")
        
        # Negative cases
        assert not crawler._is_api_call("https://example.com/page.html")
        assert not crawler._is_api_call("https://example.com/style.css")
        assert not crawler._is_api_call("https://example.com/script.js")
    
    @pytest.mark.asyncio
    async def test_create_mock_response(self):
        """Test mock response creation."""
        crawler = WebCrawler()
        
        # User endpoint
        user_call = {"url": "https://example.com/api/user/123"}
        response = await crawler._create_mock_response(user_call)
        assert response["status"] == 200
        assert "application/json" in response["headers"]["Content-Type"]
        body_data = json.loads(response["body"])
        assert "id" in body_data
        assert "name" in body_data
        
        # Product endpoint
        product_call = {"url": "https://example.com/api/product/456"}
        response = await crawler._create_mock_response(product_call)
        body_data = json.loads(response["body"])
        assert "price" in body_data
        
        # Generic endpoint
        generic_call = {"url": "https://example.com/api/generic"}
        response = await crawler._create_mock_response(generic_call)
        body_data = json.loads(response["body"])
        assert body_data["status"] == "success"
    
    @pytest.mark.asyncio
    async def test_create_snapshot(self):
        """Test snapshot creation."""
        with tempfile.TemporaryDirectory() as temp_dir:
            crawler = WebCrawler(temp_dir)
            
            test_html = "<html><body>Test</body></html>"
            test_assets = {
                "css": ["style.css"],
                "js": ["script.js"],
                "images": ["image.jpg"],
                "fonts": [],
                "other": []
            }
            
            await crawler._create_snapshot("https://example.com", test_html, test_assets)
            
            # Check HTML file
            html_path = Path(temp_dir) / "index.html"
            assert html_path.exists()
            assert html_path.read_text(encoding="utf-8") == test_html
            
            # Check metadata file
            metadata_path = Path(temp_dir) / "metadata.json"
            assert metadata_path.exists()
            metadata = json.loads(metadata_path.read_text())
            assert metadata["url"] == "https://example.com"
            assert metadata["assets"] == test_assets
    
    @pytest.mark.asyncio
    async def test_save_api_mocks(self):
        """Test API mock saving."""
        with tempfile.TemporaryDirectory() as temp_dir:
            crawler = WebCrawler(temp_dir)
            crawler.mock_api_dir = Path(temp_dir) / "mock_api"
            
            # Add some mock API calls
            crawler.api_calls = [
                {"url": "https://api.example.com/users", "method": "GET"},
                {"url": "https://api.example.com/products", "method": "POST"}
            ]
            
            await crawler._save_api_mocks()
            
            mock_path = crawler.mock_api_dir / "api_calls.json"
            assert mock_path.exists()
            
            saved_calls = json.loads(mock_path.read_text())
            assert len(saved_calls) == 2
            assert saved_calls[0]["url"] == "https://api.example.com/users"
    
    @pytest.mark.asyncio
    async def test_save_api_mocks_no_calls(self):
        """Test API mock saving with no calls."""
        with tempfile.TemporaryDirectory() as temp_dir:
            crawler = WebCrawler(temp_dir)
            crawler.mock_api_dir = Path(temp_dir) / "mock_api"
            
            await crawler._save_api_mocks()
            
            mock_path = crawler.mock_api_dir / "api_calls.json"
            assert not mock_path.exists()


class TestCrawlerIntegration:
    """Integration tests for crawler functionality."""
    
    @pytest.mark.asyncio
    @patch('clone_brief_builder.crawler.async_playwright')
    async def test_crawl_website_function(self, mock_playwright):
        """Test the crawl_website convenience function."""
        # Mock the entire playwright chain
        mock_browser = AsyncMock()
        mock_context = AsyncMock()
        mock_page = AsyncMock()
        
        mock_playwright.return_value.__aenter__.return_value.chromium.launch.return_value = mock_browser
        mock_browser.new_context.return_value = mock_context
        mock_context.new_page.return_value = mock_page
        
        # Mock page responses
        mock_page.content.return_value = "<html><body>Test</body></html>"
        mock_page.query_selector_all.return_value = []
        
        with tempfile.TemporaryDirectory() as temp_dir:
            result = await crawl_website("https://example.com", temp_dir)
            
            assert result["url"] == "https://example.com"
            assert "html" in result
            assert "assets" in result
            assert result["snapshot_path"] == temp_dir


class TestCrawlerErrorHandling:
    """Test error handling in crawler."""
    
    @pytest.mark.asyncio
    async def test_download_asset_failure(self):
        """Test handling of asset download failures."""
        with tempfile.TemporaryDirectory() as temp_dir:
            crawler = WebCrawler(temp_dir)
            
            # This should not raise an exception, just print an error
            await crawler._download_asset("https://nonexistent-domain-12345.com/asset.css", "css")
            
            # Asset should not be in downloaded set
            assert "https://nonexistent-domain-12345.com/asset.css" not in crawler.downloaded_assets


@pytest.mark.asyncio
async def test_async_integration():
    """Test that async functions work correctly together."""
    crawler = WebCrawler()
    
    # Test that we can create mock responses
    mock_call = {"url": "https://example.com/api/test"}
    response = await crawler._create_mock_response(mock_call)
    
    assert response["status"] == 200
    assert "application/json" in response["headers"]["Content-Type"] 