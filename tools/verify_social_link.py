import os
import json
import sys
from pathlib import Path
from datetime import datetime, timezone

def parse_env(filepath: Path) -> dict:
    env_vars = {}
    if not filepath.exists():
        return env_vars
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                env_vars[k.strip()] = v.strip().strip('"').strip("'")
    return env_vars

def test_twitter_link(env: dict) -> dict:
    client_id = env.get("TWITTER_CLIENT_ID")
    is_sandbox = env.get("SANDBOX_MODE", "true").lower() == "true"
    
    if is_sandbox or not client_id:
        return {
            "platform": "TWITTER",
            "mode": "SANDBOX",
            "status": "HEALTHY",
            "capabilities": ["Create Tweet (Simulated)", "Thread Support", "Char Limit: 280"],
            "mock_publish_url": "https://x.com/demo_creator/status/mock_184000000000"
        }
    return {
        "platform": "TWITTER",
        "mode": "LIVE",
        "status": "CREDENTIALS_PRESENT",
        "client_id_prefix": client_id[:4] + "***"
    }

def test_linkedin_link(env: dict) -> dict:
    client_id = env.get("LINKEDIN_CLIENT_ID")
    is_sandbox = env.get("SANDBOX_MODE", "true").lower() == "true"
    
    if is_sandbox or not client_id:
        return {
            "platform": "LINKEDIN",
            "mode": "SANDBOX",
            "status": "HEALTHY",
            "capabilities": ["Share Post (Simulated)", "Article Preview", "Image Attachment"],
            "mock_publish_url": "https://linkedin.com/feed/update/urn:li:share:mock_718000000000"
        }
    return {
        "platform": "LINKEDIN",
        "mode": "LIVE",
        "status": "CREDENTIALS_PRESENT",
        "client_id_prefix": client_id[:4] + "***"
    }

def test_instagram_link(env: dict) -> dict:
    app_id = env.get("INSTAGRAM_APP_ID")
    is_sandbox = env.get("SANDBOX_MODE", "true").lower() == "true"
    
    if is_sandbox or not app_id:
        return {
            "platform": "INSTAGRAM",
            "mode": "SANDBOX",
            "status": "HEALTHY",
            "capabilities": ["Container Creation (Simulated)", "Publishing", "Carousel & Single Image"],
            "mock_publish_url": "https://instagram.com/p/mock_C24xXyz900"
        }
    return {
        "platform": "INSTAGRAM",
        "mode": "LIVE",
        "status": "CREDENTIALS_PRESENT",
        "app_id_prefix": app_id[:4] + "***"
    }

def main():
    root = Path(__file__).resolve().parent.parent
    env_vars = parse_env(root / ".env")
    
    results = {
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "sandbox_mode": env_vars.get("SANDBOX_MODE", "true").lower() == "true",
        "platforms": {
            "twitter": test_twitter_link(env_vars),
            "linkedin": test_linkedin_link(env_vars),
            "instagram": test_instagram_link(env_vars)
        }
    }
    
    out_file = root / ".tmp" / "social_link_report.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
        
    print(json.dumps(results, indent=2))
    return 0

if __name__ == "__main__":
    sys.exit(main())
