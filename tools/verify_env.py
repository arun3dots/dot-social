import os
import json
import sys
from pathlib import Path

def parse_env_file(filepath: Path) -> dict:
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

def main():
    root = Path(__file__).resolve().parent.parent
    env_path = root / ".env"
    env_data = parse_env_file(env_path)
    
    sandbox_mode = env_data.get("SANDBOX_MODE", "true").lower() == "true"
    
    report = {
        "sandbox_mode": sandbox_mode,
        "database_url": env_data.get("DATABASE_URL", "not_set"),
        "llm_providers": {
            "gemini": {
                "configured": bool(env_data.get("GEMINI_API_KEY")),
                "role": "PRIMARY"
            },
            "openai": {
                "configured": bool(env_data.get("OPENAI_API_KEY")),
                "role": "BACKUP / BYOK"
            },
            "deepseek": {
                "configured": bool(env_data.get("DEEPSEEK_API_KEY")),
                "role": "BACKUP / BYOK"
            }
        },
        "social_platforms": {
            "twitter": {
                "configured": bool(env_data.get("TWITTER_CLIENT_ID")),
                "live_ready": bool(env_data.get("TWITTER_CLIENT_ID") and env_data.get("TWITTER_CLIENT_SECRET")),
                "sandbox_supported": True
            },
            "linkedin": {
                "configured": bool(env_data.get("LINKEDIN_CLIENT_ID")),
                "live_ready": bool(env_data.get("LINKEDIN_CLIENT_ID") and env_data.get("LINKEDIN_CLIENT_SECRET")),
                "sandbox_supported": True
            },
            "instagram": {
                "configured": bool(env_data.get("INSTAGRAM_APP_ID")),
                "live_ready": bool(env_data.get("INSTAGRAM_APP_ID") and env_data.get("INSTAGRAM_APP_SECRET")),
                "sandbox_supported": True
            }
        },
        "auth": {
            "google_oauth": bool(env_data.get("GOOGLE_CLIENT_ID") and env_data.get("GOOGLE_CLIENT_SECRET")),
            "demo_mode_ready": True
        }
    }
    
    out_dir = root / ".tmp"
    out_dir.mkdir(exist_ok=True)
    report_file = out_dir / "env_verification_report.json"
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
        
    print(json.dumps(report, indent=2))
    return 0

if __name__ == "__main__":
    sys.exit(main())
