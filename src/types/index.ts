export type UserRole = 'SUPER_ADMIN' | 'CREATOR';

export type PlanTier = 'FREE_TRIAL' | 'PRO_CREATOR' | 'AGENCY_SCALE';

export interface SubscriptionInfo {
  tier: PlanTier;
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  maxSocialAccounts: number;
  maxMonthlyPosts: number;
  currentPostUsage: number;
  byokAllowed: boolean;
  autoSchedulingEnabled: boolean;
  currentPeriodEnd?: string;
}

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  subscription?: SubscriptionInfo;
}

export type Platform = 'TWITTER' | 'LINKEDIN' | 'INSTAGRAM';

export interface SocialConnection {
  platform: Platform;
  handle: string;
  accountName: string;
  connected: boolean;
  isSandbox: boolean;
  lastSync?: string;
}

export type LLMProvider = 'GEMINI' | 'OPENAI' | 'DEEPSEEK';

export interface LLMConfig {
  mode: 'SYSTEM_DEFAULT' | 'BYOK';
  provider: LLMProvider;
  apiKey?: string;
  model: string;
}

export interface PostItem {
  id: string;
  platform: Platform;
  content: string;
  mediaPrompt?: string | null;
  mediaUrl?: string | null;
  scheduledTime: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED';
  externalUrl?: string;
  publishedAt?: string;
}

export interface CalendarDay {
  dayIndex: number;
  date: string;
  theme: string;
  posts: PostItem[];
}

export interface ContentCalendar {
  calendarId: string;
  batchStatus: 'PENDING_APPROVAL' | 'APPROVED' | 'SCHEDULED' | 'COMPLETED';
  niche: string;
  audience: string;
  tone: string;
  generatedAt: string;
  days: CalendarDay[];
}

export interface PublishedAuditRecord {
  platform: Platform;
  postId: string;
  status: string;
  isSandbox: boolean;
  publishedAt: string;
  externalId: string;
  externalUrl: string;
  content: string;
  mediaUrl?: string;
  author?: string;
  caption?: string;
}
