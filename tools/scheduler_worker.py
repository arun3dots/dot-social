import os
import sys
import json
import argparse
import subprocess
from pathlib import Path
from datetime import datetime, timezone

def run_adapter(tool_name: str, args_list: list) -> dict:
    root = Path(__file__).resolve().parent.parent
    script = root / "tools" / tool_name
    cmd = [sys.executable, str(script)] + args_list
    
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return json.loads(proc.stdout)
    except subprocess.CalledProcessError as e:
        return {"status": "FAILED", "error": e.stderr}

def process_single_post(post: dict, is_sandbox: bool = True) -> dict:
    platform = post.get("platform", "").upper()
    post_id = post.get("id", "post_unknown")
    content = post.get("content", "")
    media_url = post.get("mediaUrl", "")
    
    sandbox_flag = "true" if is_sandbox else "false"
    
    if platform == "TWITTER":
        return run_adapter("publish_twitter.py", ["--postId", post_id, "--text", content, "--isSandbox", sandbox_flag])
    elif platform == "LINKEDIN":
        return run_adapter("publish_linkedin.py", ["--postId", post_id, "--text", content, "--mediaUrl", media_url or "", "--isSandbox", sandbox_flag])
    elif platform == "INSTAGRAM":
        return run_adapter("publish_instagram.py", ["--postId", post_id, "--caption", content, "--mediaUrl", media_url or "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800", "--isSandbox", sandbox_flag])
    else:
        return {"status": "ERROR", "message": f"Unsupported platform {platform}"}

def main():
    parser = argparse.ArgumentParser(description="Deterministic Scheduler Worker")
    parser.add_argument("--postJson", type=str, help="JSON string representing a single post")
    parser.add_argument("--batchFile", type=str, help="Path to JSON file containing a batch of posts")
    parser.add_argument("--forceNow", action="store_true", help="Publish immediately regardless of timestamp")
    args = parser.parse_args()
    
    results = []
    if args.postJson:
        post = json.loads(args.postJson)
        res = process_single_post(post)
        results.append(res)
    elif args.batchFile:
        batch_path = Path(args.batchFile)
        if not batch_path.exists():
            print(json.dumps({"status": "ERROR", "message": f"File {batch_path} not found"}), file=sys.stderr)
            return 1
        with open(batch_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        posts_to_process = []
        if isinstance(data, list):
            posts_to_process = data
        elif isinstance(data, dict) and "days" in data:
            for day in data["days"]:
                for post in day.get("posts", []):
                    posts_to_process.append(post)
                    
        for p in posts_to_process:
            if args.forceNow or p.get("status") in ["APPROVED", "SCHEDULED"]:
                res = process_single_post(p)
                p["status"] = "PUBLISHED"
                p["publishResult"] = res
                results.append(res)
                
    print(json.dumps({"processedCount": len(results), "results": results}, indent=2))
    return 0

if __name__ == "__main__":
    sys.exit(main())
