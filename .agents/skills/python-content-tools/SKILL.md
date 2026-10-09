---
name: python-content-tools
description: "Work with this repo's Layer 3 tooling: the Python scripts under tools/ that generate calendars and images. Covers the argparse flag contract, the JSON stdout/output-file protocol the Next.js routes depend on, camelCase payload keys, and the Pillow and threading caveats."
risk: safe
source: project
date_added: "2026-10-09"
---

# Python Content Tools

`tools/` holds the atomic, deterministic Layer 3 engines. `tools/generate_calendar.py` is the
only one invoked at request time - `src/app/api/calendar/generate/route.ts` spawns it as a
child process - so its interface is effectively a public API of the app.

## Use this skill when

- Changing `tools/generate_calendar.py` or adding another tool under `tools/`
- Debugging calendar or image generation from the app
- Adding a flag, or a new generation mode
- Changing per-platform image sizes or prompt rules

## Do not use this skill when

- The task is about the HTTP route or DB persistence around the tool (see the `raw-postgres-pg` skill)
- The task is about publishing to a social platform (see `social-publishing-apis`)

## Instructions

### 1. The process contract

The route runs `spawn('python', pythonArgs)` and then reads the result like this:

```ts
if (exitCode === 0 && fs.existsSync(outputPath)) {
  calendar = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
} else if (stdoutData) {
  try { calendar = JSON.parse(stdoutData); } catch { calendar = null; }
}
```

So a tool must:

- exit `0` on success via `sys.exit(main())`
- write the payload as JSON to the path given by `--output`
- **also** `print(json.dumps(...))` the same payload to stdout

Printing to stdout is not debugging noise - it is the fallback path when the output file is
missing. Keep it a single JSON document; anything else on stdout breaks the fallback parse.

### 2. Failure protocol

Failures are structured JSON, never a traceback, and never a non-zero-only exit:

```python
print(json.dumps({"ok": False, "error": "no image API key available (set OPENAI_API_KEY)"}))
return
```

Always name the missing input. Image failures are collected, not fatal -
`image_summary.errors` accumulates per-post strings while content generation still succeeds.

### 3. Argument names are camelCase and must match the route

`argparse` flags mirror the route's `pythonArgs` array exactly. Renaming one without the other
silently breaks the feature (the flag falls back to its default).

Current flags: `--niche --audience --tone --provider --apiKey --days --pillars --goals
--screenName --persona --imageProvider --imageApiKey --imageQuality --imageDir --maxImages
--calendarId --output --singleImage --singleImagePrompt --singleImageOut --reference
--campaignImage --campaignPrompt --campaignPlatforms --campaignOutDir --campaignPrefix
--imagePerPlatform`.

Note the convention: camelCase for multi-word flags (`--apiKey`, `--maxImages`,
`--calendarId`, `--screenName`), not `--api-key`.

### 4. Output keys are camelCase too

`calendarId`, `batchStatus`, `dayIndex`, `mediaPrompt`, `mediaUrl`, `scheduledTime`,
`imageSize`, `imageActualSize`, `imageResized`, `providerUsed`, `horizonDays`,
`imageSummary`. These are consumed directly by the UI and the DB insert, so keep camelCase in
JSON even though the SQL columns are snake_case.

### 5. The server owns dates, times and ids

`generate_calendar.py` emits its own `date`, `scheduledTime` and post ids, and the route
**overwrites all of them**. Day 1 is always tomorrow, days are consecutive, each platform has a
fixed slot hour (X 14:00, LinkedIn 15:00, Instagram 18:00) converted from the user's timezone
to UTC, and every post id becomes `post_<calendarId>_<dayIndex>_<platform>`.

Consequence: do not spend effort making the model produce accurate dates, and do not rely on
the ids the tool invents. The generated `calendarId` is replaced as well.

### 6. Modes

- **Batch** (default) - `--days`, one content + image set per day per platform
- **Single image** - `--singleImage <PLATFORM>` regenerates one post's image through the same
  path a batch uses (platform size -> provider -> resize)
- **Reference** - `--reference <path>` (repeatable, or comma separated) feeds the user's own
  input image(s) to the image model's edit endpoint instead of a text prompt alone
- **Campaign** - `--campaignImage --campaignPrompt ...` generates one image and derives an
  exact per-platform size, or one generation per platform with `--imagePerPlatform`

### 7. Images

- Written under `media/generated/<calendarId>/` and referenced as
  `/api/media/generated/<calendarId>/<file>.png`; served by `src/app/api/media/[...path]`
- Sizes come from `PLATFORM_SPECS`: X 1600x900, LinkedIn 1200x1200, Instagram 1080x1350.
  `openai_size` is what the image model can produce, and `resize_to_exact()` derives the exact
  feed size from it. Keep `PLATFORM_SPECS` here in step with `src/lib/platformSpecs.ts`
- Generation is parallel: `ThreadPoolExecutor(max_workers=4)`
- Model is `os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1")`
- DeepSeek has **no** image endpoint, so content and image providers are resolved separately
- BYOK wins: when the caller supplies an image key, never fall back to the server's

### 8. Pillow is imported lazily - and may be absent

`from PIL import Image` appears **inside** the functions that need it, so the tool still runs
without Pillow; only the resize step degrades (the image keeps the API's size and
`imageResized` is `false`). Do not hoist those imports to module scope - that would turn a
degraded resize into a hard failure.

On this machine Python is 3.14 and **Pillow is not installed**. Install it with
`python -m pip install Pillow` when exact platform sizing is required.

### 9. Artifacts

Output goes to `.tmp/` (gitignored) by default:
`<repo>/.tmp/generated_calendar.json`, or `calendar_<timestamp>.json` when the route passes
`--output`. Clean these up; the route never reads old ones.

### 10. Other tools

`tools/scheduler_worker.js` is Node, not Python. It POSTs `/api/scheduler/run` (`--once` for
Task Scheduler, `--loop` to poll) and authenticates with the `x-scheduler-secret` header
matching `SCHEDULER_SECRET`. Without that header the endpoint requires an admin session and the
headless tick gets 401.

## Resources

- `tools/generate_calendar.py` - the generator and its `PLATFORM_SPECS`
- `src/app/api/calendar/generate/route.ts` - the caller, and the arg construction to match
- `tools/scheduler_worker.js` - the Node scheduler tick

## Limitations

- There is no test suite for the tools; exercise them by running the script directly.
- Chinese-language model output and provider rate limits are not handled here.
- Image generation costs money per call - use `--maxImages 0` when validating the pipeline.
