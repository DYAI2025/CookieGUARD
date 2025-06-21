"""Pytest configuration and shared fixtures."""
import pytest
from unittest.mock import Mock


@pytest.fixture
def sample_html():
    """Sample HTML content for testing."""
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Test Website</title>
        <meta name="description" content="This is a test website">
        <link rel="stylesheet" href="https://example.com/style.css">
        <link rel="stylesheet" href="/local/style.css">
    </head>
    <body>
        <h1>Welcome to Test Site</h1>
        <script src="https://example.com/script.js"></script>
        <script src="/local/script.js"></script>
    </body>
    </html>
    """


@pytest.fixture
def sample_url():
    """Sample URL for testing."""
    return "https://example.com"


@pytest.fixture
def sample_metadata():
    """Sample metadata dictionary for testing."""
    return {
        "url": "https://example.com",
        "title": "Test Website",
        "description": "This is a test website",
        "css": ["https://example.com/style.css", "/local/style.css"],
        "js": ["https://example.com/script.js", "/local/script.js"],
    }


@pytest.fixture
def mock_response():
    """Mock HTTP response for testing."""
    response = Mock()
    response.text = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Mock Website</title>
        <meta name="description" content="Mock description">
    </head>
    <body>
        <h1>Mock Content</h1>
    </body>
    </html>
    """
    response.raise_for_status = Mock()
    return response 