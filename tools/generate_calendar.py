import os
import sys
import json
import argparse
import urllib.request
import urllib.error
from pathlib import Path
from datetime import datetime, timedelta, timezone

def generate_via_gemini(api_key: str, niche: str, audience: str, tone: str) -> dict:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    prompt = f"""
You are an expert social media strategist.
Generate a 3-day content calendar for:
- Niche: {niche}
- Target Audience: {audience}
- Brand Tone: {tone}

For each day, produce 3 distinct posts:
1. TWITTER: punchy hook, concise, relevant hashtags.
2. LINKEDIN: thought-leadership storytelling, key takeaways, professional hashtags, and visual idea prompt.
3. INSTAGRAM: high-converting visual caption, call-to-action, photo concept description, 5-8 hashtags.

Return ONLY a raw valid JSON object matching this schema:
{{
  "calendarId": "cal_gemini_batch",
  "batchStatus": "PENDING_APPROVAL",
  "days": [
    {{
      "dayIndex": 1,
      "date": "2026-10-02",
      "theme": "Theme title",
      "posts": [
        {{
          "id": "post_1_tw",
          "platform": "TWITTER",
          "content": "tweet text",
          "mediaPrompt": null,
          "mediaUrl": null,
          "scheduledTime": "2026-10-02T14:00:00Z",
          "status": "PENDING_APPROVAL"
        }},
        {{
          "id": "post_1_li",
          "platform": "LINKEDIN",
          "content": "linkedin post text",
          "mediaPrompt": "visual concept description",
          "mediaUrl": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800",
          "scheduledTime": "2026-10-02T15:30:00Z",
          "status": "PENDING_APPROVAL"
        }},
        {{
          "id": "post_1_ig",
          "platform": "INSTAGRAM",
          "content": "instagram caption with #hashtags",
          "mediaPrompt": "photo concept description",
          "mediaUrl": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800",
          "scheduledTime": "2026-10-02T18:00:00Z",
          "status": "PENDING_APPROVAL"
        }}
      ]
    }}
  ]
}}
"""
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.7, "responseMimeType": "application/json"}
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=25) as resp:
        res_json = json.loads(resp.read().decode("utf-8"))
        text = res_json["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(text)

def generate_via_openai_compatible(api_key: str, endpoint: str, model: str, niche: str, audience: str, tone: str) -> dict:
    prompt = f"""
Generate a 3-day social media content calendar for:
- Niche: {niche}
- Audience: {audience}
- Tone: {tone}

Produce 3 distinct posts per day (TWITTER, LINKEDIN, INSTAGRAM) matching this JSON structure:
{{
  "calendarId": "cal_ai_batch",
  "batchStatus": "PENDING_APPROVAL",
  "days": [
    {{
      "dayIndex": 1,
      "date": "2026-10-02",
      "theme": "Theme title",
      "posts": [
        {{ "id": "p1_tw", "platform": "TWITTER", "content": "tweet text", "mediaPrompt": null, "mediaUrl": null, "scheduledTime": "2026-10-02T14:00:00Z", "status": "PENDING_APPROVAL" }},
        {{ "id": "p1_li", "platform": "LINKEDIN", "content": "linkedin post", "mediaPrompt": "concept", "mediaUrl": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800", "scheduledTime": "2026-10-02T15:30:00Z", "status": "PENDING_APPROVAL" }},
        {{ "id": "p1_ig", "platform": "INSTAGRAM", "content": "instagram caption", "mediaPrompt": "banner", "mediaUrl": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800", "scheduledTime": "2026-10-02T18:00:00Z", "status": "PENDING_APPROVAL" }}
      ]
    }}
  ]
}}
"""
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a professional social media manager. Output only valid JSON."},
            {"role": "user", "content": prompt}
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.7
    }

    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        },
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        res_json = json.loads(resp.read().decode("utf-8"))
        content = res_json["choices"][0]["message"]["content"]
        return json.loads(content)

def generate_deterministic_synthesis(niche: str, audience: str, tone: str) -> dict:
    now = datetime.now(timezone.utc)
    base_date = now + timedelta(days=1)
    
    themes = [
        f"The #1 Friction Point in {niche}",
        f"3 High-Leverage Systems for {audience}",
        f"The Future of {niche} in 2026 and Beyond"
    ]
    
    img_urls = [
        "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800",
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800",
        "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800"
    ]
    
    days = []
    for i in range(3):
        cur_date = base_date + timedelta(days=i)
        date_str = cur_date.strftime("%Y-%m-%d")
        theme = themes[i]
        
        tw_time = cur_date.replace(hour=14, minute=0, second=0).isoformat()
        li_time = cur_date.replace(hour=15, minute=30, second=0).isoformat()
        ig_time = cur_date.replace(hour=18, minute=0, second=0).isoformat()
        
        day_posts = [
            {
                "id": f"post_day{i+1}_tw",
                "platform": "TWITTER",
                "content": f"Most {audience} struggle with execution speed in {niche}.\n\nHere are 3 ways we solved it:\n1. Cut manual admin tasks\n2. Focused on high-leverage outputs\n3. Published consistently.\n\nWhat is your biggest bottleneck? 🧵👇",
                "mediaPrompt": None,
                "mediaUrl": None,
                "scheduledTime": tw_time,
                "status": "PENDING_APPROVAL"
            },
            {
                "id": f"post_day{i+1}_li",
                "platform": "LINKEDIN",
                "content": f"Why {niche} is undergoing a massive shift right now.\n\nFor {audience}, the reality is clear:\n\n• Systems beat sheer hustle every single time.\n• Consistent quality builds compounding authority.\n• Embracing AI frees mental bandwidth for deep strategy.\n\nHow is your organization adapting?\n\n#BusinessStrategy #{niche.replace(' ', '')} #Growth",
                "mediaPrompt": f"Minimalist professional infographic on modern {niche} growth curves, high contrast slate gray palette",
                "mediaUrl": img_urls[i % len(img_urls)],
                "scheduledTime": li_time,
                "status": "PENDING_APPROVAL"
            },
            {
                "id": f"post_day{i+1}_ig",
                "platform": "INSTAGRAM",
                "content": f"3 things every {audience} should implement today 🚀\n\n1️⃣ Simplify workflows\n2️⃣ Listen closely to audience feedback\n3️⃣ Ship without waiting for perfection\n\nSave this for your next planning session! 📌\n\n#{niche.replace(' ', '')} #ContentStrategy #CreatorEconomy #Automation",
                "mediaPrompt": f"High aesthetic 3D graphic banner with sleek typography reading '{theme}' on deep obsidian background",
                "mediaUrl": img_urls[(i+1) % len(img_urls)],
                "scheduledTime": ig_time,
                "status": "PENDING_APPROVAL"
            }
        ]
        
        days.append({
            "dayIndex": i + 1,
            "date": date_str,
            "theme": theme,
            "posts": day_posts
        })
        
    return {
        "calendarId": f"cal_{int(now.timestamp())}",
        "batchStatus": "PENDING_APPROVAL",
        "niche": niche,
        "audience": audience,
        "tone": tone,
        "generatedAt": now.isoformat(),
        "days": days
    }

def main():
    parser = argparse.ArgumentParser(description="Deterministic LLM Content Calendar Generator")
    parser.add_argument("--niche", type=str, default="AI Productivity & SaaS")
    parser.add_argument("--audience", type=str, default="Solopreneurs and creators")
    parser.add_argument("--tone", type=str, default="Insightful, practical, engaging")
    parser.add_argument("--provider", type=str, default="gemini")
    parser.add_argument("--apiKey", type=str, default="")
    parser.add_argument("--output", type=str, default="")
    args = parser.parse_args()
    
    root = Path(__file__).resolve().parent.parent
    output_path = Path(args.output) if args.output else (root / ".tmp" / "generated_calendar.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    calendar_data = None
    
    # 1. Check Gemini
    if args.provider.lower() == "gemini" and args.apiKey:
        try:
            calendar_data = generate_via_gemini(args.apiKey, args.niche, args.audience, args.tone)
        except Exception as e:
            print(f"[WARN] Gemini API call error: {e}. Falling back to deterministic synthesis.", file=sys.stderr)

    # 2. Check OpenAI
    elif args.provider.lower() == "openai" and args.apiKey:
        try:
            calendar_data = generate_via_openai_compatible(
                args.apiKey,
                "https://api.openai.com/v1/chat/completions",
                "gpt-4o-mini",
                args.niche,
                args.audience,
                args.tone
            )
        except Exception as e:
            print(f"[WARN] OpenAI API call error: {e}. Falling back to deterministic synthesis.", file=sys.stderr)

    # 3. Check DeepSeek
    elif args.provider.lower() == "deepseek" and args.apiKey:
        try:
            calendar_data = generate_via_openai_compatible(
                args.apiKey,
                "https://api.deepseek.com/chat/completions",
                "deepseek-chat",
                args.niche,
                args.audience,
                args.tone
            )
        except Exception as e:
            print(f"[WARN] DeepSeek API call error: {e}. Falling back to deterministic synthesis.", file=sys.stderr)
            
    if not calendar_data:
        calendar_data = generate_deterministic_synthesis(args.niche, args.audience, args.tone)
        
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(calendar_data, f, indent=2)
        
    print(json.dumps(calendar_data, indent=2))
    return 0

if __name__ == "__main__":
    sys.exit(main())
