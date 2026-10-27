// 财报速读服务层：Edge Function 调用 + 分析记录持久化
import { supabase } from '@/db/supabase';
import type { ReportAnalysis } from '@/types/report';

export interface AnalyzeResult {
  analysis: ReportAnalysis;
}

/** 调用 report-analyze Edge Function 生成四行结论 */
export async function analyzeReport(
  text: string,
  model: string
): Promise<ReportAnalysis> {
  const { data, error } = await supabase.functions.invoke<AnalyzeResult>(
    'report-analyze',
    { body: { text, model } }
  );

  if (error) {
    const detail = await error.context?.text().catch(() => '');
    const msg = extractError(detail);
    throw new Error(msg || '解析失败，请重试');
  }
  if (!data?.analysis) {
    throw new Error('AI 未返回有效结论，请重试');
  }
  return data.analysis;
}

/** 将分析结果写入 report_analyses 表 */
export async function saveAnalysis(
  fileName: string,
  analysis: ReportAnalysis,
  textLength: number
): Promise<void> {
  try {
    await supabase.from('report_analyses').insert({
      file_name: fileName,
      company_name: analysis.company_name || null,
      report_period: analysis.report_period || null,
      analysis,
      text_length: textLength,
    });
  } catch {
    // 持久化失败不影响主流程
  }
}

function extractError(raw: string | undefined): string {
  if (!raw) return '';
  try {
    const json = JSON.parse(raw);
    return typeof json.error === 'string' ? json.error : '';
  } catch {
    return '';
  }
}
