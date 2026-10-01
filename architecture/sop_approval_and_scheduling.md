# SOP: Approval Gate & Automated Scheduling

## 1. Goal
Enforce human-in-the-loop review before any post is published, and automatically dispatch approved posts at their scheduled time.

## 2. State Machine Transitions
`DRAFT` -> `PENDING_APPROVAL` -> `APPROVED` -> `SCHEDULED` -> `PUBLISHED`
                     │
                     └──> `FAILED` (with retry loop)

## 3. Approval Rules
- A batch cannot transition to `SCHEDULED` until the creator clicks "Approve Batch" or approves individual posts.
- The creator can edit the text, hashtags, scheduled time, and media prompt directly in the card interface.
- One-click "Regenerate Post" allows rerunning the LLM on a single item.

## 4. Scheduling Logic
- When a post is marked `APPROVED`, its state moves to `SCHEDULED`.
- The background runner (`tools/scheduler_worker.py` or Node scheduler) polls every 30 seconds for posts where `scheduledTime <= NOW()` and `status == 'SCHEDULED'`.
- Upon reaching timestamp, dispatches to platform adapter.
