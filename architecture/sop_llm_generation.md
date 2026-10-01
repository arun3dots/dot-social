# SOP: Multi-Provider LLM Generation & 3-Day Content Calendar

## 1. Goal
Generate an intelligent, brand-tailored 3-day content calendar batch formatted strictly in JSON according to the Project Constitution.

## 2. LLM Routing Hierarchy
1. **Creator BYOK**: If creator configured their own key (OpenAI / DeepSeek / Gemini), use their key.
2. **Platform Default**: Use system Google Gemini API (`gemini-1.5-flash` or `gemini-2.0-flash`).
3. **Deterministic Fallback Engine**: If no external keys are configured, use the internal deterministic AI synthesis engine to generate context-rich posts matching the user's specific niche and prompt.

## 3. Post Requirements per Day
For each of the 3 days, generate platform-specific posts:
- **X (Twitter)**: Punchy, under 280 chars or 2-part thread, engaging hooks, relevant hashtags.
- **LinkedIn**: Professional storytelling, line breaks, strong takeaway, 2-3 targeted hashtags, media prompt.
- **Instagram**: High-converting visual caption, carousel/single photo prompt, 5-10 niche hashtags.

## 4. Structured Output Format
Strictly conforms to the schema in [claude.md](file:///d:/POC/Social-media/claude.md) Section 3.E.
