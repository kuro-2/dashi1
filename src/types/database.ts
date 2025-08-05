export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  user_type: 'standard' | 'premium';
  has_active_subscription: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserAnalyticsEvent {
  id: string;
  user_id: string;
  event_type: string;
  event_category: string;
  event_action: string;
  event_path?: string;
  page_section?: string;
  event_data?: Record<string, any>;
  utm_campaign?: string;
  utm_source?: string;
  utm_medium?: string;
  created_at: string;
}

export interface UserWithSession extends User {
  user_sessions: UserSession[];
}

export interface AnalyticsOverview {
  totalUsers: number;
  activeUsers: number;
  subscriptionBreakdown: {
    active: number;
    inactive: number;
  };
  userTypeBreakdown: {
    standard: number;
    premium: number;
  };
}

export interface EventAnalytics {
  eventType: string;
  count: number;
  date: string;
}

export interface TrafficSource {
  utm_source: string;
  utm_medium?: string;
  utm_campaign?: string;
  count: number;
}

export interface PageAnalytics {
  page_path: string;
  visits: number;
  unique_users: number;
}

// NEW: Interface for the detailed session view
export interface SessionWithEvents {
  sessionId: string;
  user: User;
  events: UserAnalyticsEvent[];
  createdAt: string;
  subscription?: {
    plan_id: string;
    status: string;
    current_period_end: string;
    plan_type: string;
    is_trial: boolean;
  };
  pageVisits: Array<{
    page_path: string;
    visit_count: number;
    last_visited: string;
  }>;
  sessionStats: {
    total_events: number;
    session_duration?: string;
    unique_pages: number;
  };
}