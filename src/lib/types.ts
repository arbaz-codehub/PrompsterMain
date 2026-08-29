export interface Prompt {
  id: string;
  slug: string;
  title: string;
  content: string;
  seoDescription?: string;
  prompts?: string[];
  tags: string[];
  category: string;
  images: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsData {
  totalVisitors: number;
  activeVisitors: number;
  monthlyVisitors: MonthlyCount[];
  sessions: VisitorSession[];
}

export interface MonthlyCount {
  month: string; // YYYY-MM
  count: number;
}

export interface VisitorSession {
  sessionId: string;
  startTime: string;
  lastSeen: string;
  pages: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}
