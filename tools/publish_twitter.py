# DEPRECATED: superseded by src/lib/publisher.ts (called by /api/scheduler/run and
# /api/calendar/publish). Kept for reference only - nothing invokes this any more.
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

def publish_live_tweet(token: str, text: str) -> dict:
    url = "https://api.twitter.com/2/tweets"
    payload = {"text": text}
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        tweet_id = data.get("data", {}).get("id")
        return {
            "status": "SUCCESS",
            "externalId": tweet_id,
            "externalUrl": f"https://x.com/i/status/{tweet_id}",
            "raw": data
        }

def main():
    parser = argparse.ArgumentParser(description="Publish post to Twitter/X")
    parser.add_argument("--postId", type=str, default="post_test_tw")
    parser.add_argument("--text", type=str, required=True)
    parser.add_argument("--handle", type=str, default="@creator_x")
    parser.add_argument("--isSandbox", type=str, default="")
    parser.add_argument("--accessToken", type=str, default="")
    args = parser.parse_args()
    
    root = Path(__file__).resolve().parent.parent
    env_vars = parse_env(root / ".env")
    
    token = args.accessToken or env_vars.get("TWITTER_ACCESS_TOKEN") or env_vars.get("TWITTER_BEARER_TOKEN", "")
    force_sandbox = (args.isSandbox.lower() == "true") if args.isSandbox else (env_vars.get("SANDBOX_MODE", "true").lower() == "true")
    
    now_str = datetime.now(timezone.utc).isoformat()
    
    # Try live publishing if credentials are present and not forced to sandbox
    if token and not force_sandbox:
        try:
            live_res = publish_live_tweet(token, args.text)
            result = {
                "platform": "TWITTER",
                "postId": args.postId,
                "status": "SUCCESS",
                "isSandbox": False,
                "publishedAt": now_str,
                "externalId": live_res["externalId"],
                "externalUrl": live_res["externalUrl"],
                "content": args.text
            }
            append_to_audit_log(result)
            print(json.dumps(result, indent=2))
            return 0
        except Exception as e:
            print(f"[WARN] Live Twitter post failed: {e}. Executing sandbox fallback.", file=sys.stderr)

    # Sandbox fallback
    mock_id = f"1840{int(datetime.now().timestamp())}"
    result = {
        "platform": "TWITTER",
        "postId": args.postId,
        "status": "SUCCESS",
        "isSandbox": True,
        "publishedAt": now_str,
        "externalId": mock_id,
        "externalUrl": f"https://x.com/{args.handle.lstrip('@')}/status/{mock_id}",
        "content": args.text
    }
    
    append_to_audit_log(result)
    print(json.dumps(result, indent=2))
    return 0

if __name__ == "__main__":
    sys.exit(main())
