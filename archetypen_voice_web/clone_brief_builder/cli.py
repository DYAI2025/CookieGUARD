"""Command-line interface for the clone brief builder."""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

from .crawler import crawl_website
from .metadata import build_template, extract_metadata, fetch_page


def create_parser() -> argparse.ArgumentParser:
    """Create the argument parser."""
    parser = argparse.ArgumentParser(
        description="Clone Brief Builder - Generate briefings for website cloning"
    )
    parser.add_argument("url", help="URL of the website to analyze")
    parser.add_argument(
        "-o", "--output", 
        default="claude_briefing.txt",
        help="Output file for the briefing (default: claude_briefing.txt)"
    )
    parser.add_argument(
        "--snapshot", "-s",
        action="store_true",
        help="Create full snapshot with headless crawler"
    )
    parser.add_argument(
        "--snapshot-dir",
        default="snapshots",
        help="Base directory for snapshots (default: snapshots)"
    )
    parser.add_argument(
        "--no-cookies",
        action="store_true", 
        help="Skip cookie banner handling"
    )
    return parser


async def async_main(args) -> int:
    """Async main function for crawler operations."""
    try:
        if args.snapshot:
            print(f"🕷️  Crawling {args.url} with headless browser...")
            print(f"📁 Snapshot base directory: {args.snapshot_dir}/")
            
            result = await crawl_website(
                args.url, 
                output_dir=args.snapshot_dir
            )
            
            website_name = result.get('website_name', 'unknown')
            snapshot_path = result.get('snapshot_path', 'N/A')
            
            print(f"✅ Snapshot created:")
            print(f"   🌐 Website: {result['url']}")
            print(f"   📁 Folder: {website_name}/")
            print(f"   📍 Path: {snapshot_path}")
            print(f"   📊 Assets: {len(result['assets']['css'])} CSS, {len(result['assets']['js'])} JS, {len(result['assets']['images'])} Images")
            print(f"   🔌 API Calls: {result['api_calls']}")
            print(f"   📸 Screenshots: {len(result.get('screenshots', {}))} files")
            
            # Generate briefing with snapshot info
            metadata = extract_metadata(args.url, result['html'])
            template = build_template(metadata, snapshot_info=result)
            
        else:
            print(f"📄 Fetching {args.url} with simple HTTP request...")
            html = fetch_page(args.url)
            metadata = extract_metadata(args.url, html)
            template = build_template(metadata)
        
        # Write briefing to file
        output_path = Path(args.output)
        output_path.write_text(template, encoding="utf-8")
        
        print(f"✅ Briefing saved to: {output_path}")
        
        if args.snapshot:
            print(f"")
            print(f"🎯 NEXT STEPS:")
            print(f"   1. Open {snapshot_path}/index.html in browser")
            print(f"   2. Review screenshots in {snapshot_path}/screenshots/")
            print(f"   3. Use briefing in {output_path} for Claude")
        
        return 0
        
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        return 1


def main() -> int:
    """Main entry point."""
    parser = create_parser()
    args = parser.parse_args()
    
    # Check if we need async execution
    if args.snapshot:
        return asyncio.run(async_main(args))
    else:
        # Sync execution for simple HTTP requests
        try:
            print(f"📄 Fetching {args.url} with HTTP request...")
            html = fetch_page(args.url)
            metadata = extract_metadata(args.url, html)
            template = build_template(metadata)
            
            output_path = Path(args.output)
            output_path.write_text(template, encoding="utf-8")
            
            print(f"✅ Briefing saved to: {output_path}")
            print(f"💡 Tip: Use --snapshot for full headless browser capture")
            return 0
            
        except Exception as e:
            print(f"❌ Error: {e}", file=sys.stderr)
            return 1


if __name__ == "__main__":
    sys.exit(main()) 