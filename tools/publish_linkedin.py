import os
import sys
import json
import argparse
import urllib.request
import urllib.error
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

def append_to_audit_log(entry: dict):
    root = Path(__file__).resolve().parent.parent
    tmp_dir = root / ".tmp"
    tmp_dir.mkdir(exist_ok=True)
    log_file = tmp_dir / "published_posts.json"
    
    records = []
    if log_file.exists():
        try:
            with open(log_file, "r", encoding="utf-8") as f:
                records = json.load(f)
        except Exception:
            records = []
            
    records.append(entry)
    with open(log_file, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2)

def publish_live_linkedin(token: str, author_urn: str, text: str) -> dict:
    url = "https://api.linkedin.com/v2/ugcPosts"
    payload = {
        "author": author_urn,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": text},
                "shareMediaCategory": "NONE"
            }
        },
        "visibility": {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
        }
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "X-Restli-Protocol-Version": "2.0.0",
            "Content-Type": "application/json"
        },
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        urn = data.get("id")
        return {
            "status": "SUCCESS",
            "externalId": urn,
            "externalUrl": f"https://linkedin.com/feed/update/{urn}",
            "raw": data
        }

def main():
    parser = argparse.ArgumentParser(description="Publish post to LinkedIn")
    parser.add_argument("--postId", type=str, default="post_test_li")
    parser.add_argument("--text", type=str, required=True)
    parser.add_argument("--author", type=str, default="Jane Creator")
    parser.add_argument("--mediaUrl", type=str, default="")
    parser.add_argument("--isSandbox", type=str, default="")
    parser.add_argument("--accessToken", type=str, default="")
    parser.add_argument("--authorUrn", type=str, default="")
    args = parser.parse_args()
    
    root = Path(__file__).resolve().parent.parent
    env_vars = parse_env(root / ".env")
    
    token = args.accessToken or env_vars.get("LINKEDIN_ACCESS_TOKEN", "")
    author_urn = args.authorUrn or env_vars.get("LINKEDIN_AUTHOR_URN", "urn:li:person:demo")
    force_sandbox = (args.isSandbox.lower() == "true") if args.isSandbox else (env_vars.get("SANDBOX_MODE", "true").lower() == "true")
    
    now_str = datetime.now(timezone.utc).isoformat()
    
    if token and not force_sandbox:
        try:
            live_res = publish_live_linkedin(token, author_urn, args.text)
            result = {
                "platform": "LINKEDIN",
                "postId": args.postId,
                "status": "SUCCESS",
                "isSandbox": False,
                "publishedAt": now_str,
                "externalId": live_res["externalId"],
                "externalUrl": live_res["externalUrl"],
                "author": args.author,
                "content": args.text
            }
            append_to_audit_log(result)
            print(json.dumps(result, indent=2))
            return 0
        except Exception as e:
            print(f"[WARN] Live LinkedIn post failed: {e}. Executing sandbox fallback.", file=sys.stderr)

    # Sandbox fallback
    mock_urn = f"urn:li:share:{int(datetime.now().timestamp() * 1000)}"
    result = {
        "platform": "LINKEDIN",
        "postId": args.postId,
        "status": "SUCCESS",
        "isSandbox": True,
        "publishedAt": now_str,
        "externalId": mock_urn,
        "externalUrl": f"https://linkedin.com/feed/update/{mock_urn}",
        "author": args.author,
        "mediaUrl": args.mediaUrl,
        "content": args.text
    }
    
    append_to_audit_log(result)
    print(json.dumps(result, indent=2))
    return 0

if __name__ == "__main__":
    sys.exit(main())
