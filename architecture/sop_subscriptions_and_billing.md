# SOP: Subscriptions & Package Quotas

## 1. Goal
Enforce multi-tier subscription quotas (Free Trial, Pro Creator, Agency Scale) across creators to gate social account connections, monthly generation volume, BYOK capabilities, and automated publishing.

## 2. Subscription Tiers & Feature Matrix
| Feature | FREE_TRIAL | PRO_CREATOR | AGENCY_SCALE |
| :--- | :--- | :--- | :--- |
| **Price** | $0/mo | $29/mo | $99/mo |
| **Max Social Accounts** | 1 Platform | 3 Platforms (All) | Unlimited Platforms |
| **Monthly Post Quota** | 9 Posts (1 Batch) | 100 Posts | Unlimited |
| **LLM Engine** | Platform Default (Gemini) | Gemini + BYOK (OpenAI, DeepSeek) | Priority LLM + BYOK |
| **Auto-Scheduling** | Manual review only | Automated Cron Dispatch | Automated Cron + Webhooks |
| **Analytics & Export** | Basic | 30-Day History | Full Audit Stream |

## 3. Enforcement Logic
- Before generating a calendar (`/api/calendar/generate`), verify remaining post quota.
- Before linking a social account (`/api/connections`), verify `connectedCount < maxSocialAccounts`.
- If creator chooses `BYOK` mode, verify plan tier is `PRO_CREATOR` or higher.
- Creator can view quota usage bar and trigger 1-click tier upgrades.
