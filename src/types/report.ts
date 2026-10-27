// 财报速读相关类型定义

export interface MetricItem {
  current: string;
  previous: string;
  yoy: string;
  comment: string;
}

export interface ReportAnalysis {
  company_name: string;
  report_period: string;
  revenue: MetricItem;
  net_profit: MetricItem;
  cash_flow: MetricItem;
  risks: string[];
}

export type MetricKey = 'revenue' | 'net_profit' | 'cash_flow';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export type AnalysisStatus = 'idle' | 'extracting' | 'analyzing' | 'done' | 'error';

export const MODEL_OPTIONS = [
  { value: 'MiniMax-M3.1-Flash', label: 'MiniMax-M3.1-Flash（默认）' },
  { value: 'MiniMax-M3', label: 'MiniMax-M3' },
] as const;
