// 财报速读主页：上传 PDF → 30 秒内四行结论（收入/利润/现金流/风险点）+ 同比
import React, { useCallback, useState } from 'react';
import {
  Banknote,
  FileText,
  TrendingUp,
  Wallet,
  RotateCcw,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import ChatWidget from '@/components/report/ChatWidget';
import MetricRow, { RiskRow } from '@/components/report/MetricRow';
import { extractPdfText } from '@/lib/pdfExtract';
import { analyzeReport, saveAnalysis } from '@/services/reportService';
import { MODEL_OPTIONS, type AnalysisStatus, type ReportAnalysis } from '@/types/report';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<AnalysisStatus, string> = {
  idle: '等待上传',
  extracting: '正在提取 PDF 文本…',
  analyzing: 'AI 正在分析财报…',
  done: '解析完成',
  error: '解析失败',
};

const HomePage: React.FC = () => {
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [fileName, setFileName] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<ReportAnalysis | null>(null);
  const [model, setModel] = useState<string>(MODEL_OPTIONS[0].value);
  const [reportText, setReportText] = useState<string | null>(null);
  const [contextVersion, setContextVersion] = useState(0);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        toast.error('仅支持上传 PDF 格式的财报文件');
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        toast.error('文件过大，请上传 50MB 以内的 PDF');
        return;
      }

      setFileName(file.name);
      setAnalysis(null);
      setReportText(null);
      setStatus('extracting');

      try {
        const { text, pageCount: pages } = await extractPdfText(file);
        setPageCount(pages);
        setStatus('analyzing');

        const result = await analyzeReport(text, model);
        setAnalysis(result);
        setReportText(text);
        setContextVersion((v) => v + 1);
        setStatus('done');
        await saveAnalysis(file.name, result, text.length);
        toast.success(`已生成速读结论：${result.company_name} ${result.report_period}`);
      } catch (err) {
        setStatus('error');
        const msg = err instanceof Error ? err.message : '解析失败，请重试';
        toast.error(msg);
      }
    },
    [model]
  );

  const reset = () => {
    setStatus('idle');
    setFileName(null);
    setPageCount(null);
    setAnalysis(null);
    setReportText(null);
    setContextVersion((v) => v + 1);
  };

  const busy = status === 'extracting' || status === 'analyzing';

  return (
    <div className="min-h-screen">
      <div className="crt-overlay" aria-hidden="true" />

      <main className="mx-auto w-full max-w-3xl px-4 py-10 md:py-14">
        {/* 头部 */}
        <header className="mb-8">
          <h1 className="font-pixel text-glow text-lg text-primary md:text-xl">
            财报速读终端
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="text-primary">$</span> 上传上市公司财报 PDF，30 秒输出收入 / 利润 / 现金流 / 风险点四行结论，并同比对比去年
            <span className="cursor-block ml-1" aria-hidden="true" />
          </p>
        </header>

        {/* 上传区 */}
        <section
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!busy) handleFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            'terminal-panel flex flex-col items-center justify-center gap-3 px-4 py-10 text-center',
            dragging && 'border-primary/70 shadow-hover'
          )}
          aria-label="财报 PDF 上传区"
        >
          <Upload className={cn('h-8 w-8', busy ? 'text-muted-foreground' : 'text-primary')} />
          {status === 'idle' || status === 'error' ? (
            <>
              <p className="text-sm text-foreground">拖拽财报 PDF 到此处，或点击选择文件</p>
              <p className="text-xs text-muted-foreground">支持年报 / 半年报 / 季报 · 文字版 PDF · 50MB 以内</p>
              <label className="mt-1 cursor-pointer">
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
                <span className="inline-flex h-9 items-center rounded border border-primary/60 bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                  选择 PDF 文件
                </span>
              </label>
              {status === 'error' && (
                <p className="text-xs text-destructive">上次解析失败，可重新上传或换一份文件</p>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 min-w-0 max-w-full">
              <p className="flex items-center gap-2 text-sm text-foreground">
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{fileName}</span>
              </p>
              <p className="font-pixel text-xs text-warning">
                {STATUS_LABEL[status]}
                {pageCount ? ` · ${pageCount} 页` : ''}
                {busy && <span className="cursor-block ml-1" aria-hidden="true" />}
              </p>
              {status === 'done' && analysis && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={reset}
                  className="mt-1"
                >
                  <RotateCcw className="h-4 w-4" />
                  上传新财报
                </Button>
              )}
            </div>
          )}

          {/* 模型选择 */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">分析模型</span>
            <div className="flex gap-1">
              {MODEL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setModel(opt.value)}
                  disabled={busy}
                  className={cn(
                    'cursor-pointer rounded border px-2 py-1 text-xs transition-colors',
                    model === opt.value
                      ? 'border-primary/60 bg-secondary text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  {opt.value}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 结论展示区 */}
        {analysis && status === 'done' && (
          <section className="mt-8 flex flex-col gap-4 animate-fade-in" aria-label="速读结论">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-pixel text-sm text-primary">
                {analysis.company_name}
              </h2>
              <span className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                {analysis.report_period}
              </span>
            </div>

            <MetricRow
              label="营业收入"
              icon={<TrendingUp className="h-4 w-4" />}
              data={analysis.revenue}
            />
            <MetricRow
              label="净利润"
              icon={<Banknote className="h-4 w-4" />}
              data={analysis.net_profit}
            />
            <MetricRow
              label="现金流"
              icon={<Wallet className="h-4 w-4" />}
              data={analysis.cash_flow}
            />
            <RiskRow risks={analysis.risks} />
          </section>
        )}

        {/* 页脚说明 */}
        <footer className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
          <p>PDF 仅在浏览器本地解析文本，原文不上传服务器；分析结论由 AI 生成，仅供参考，不构成投资建议。</p>
        </footer>
      </main>

      {/* AI 聊天助手小窗口 */}
      <ChatWidget contextText={reportText} contextVersion={contextVersion} />
    </div>
  );
};

export default HomePage;
