// PDF 文本提取（pdfjs-dist，浏览器端执行，PDF 不上传服务器）
import * as pdfjsLib from 'pdfjs-dist';

interface PdfWorkerGlobal {
  pdfjsWorker?: { WorkerMessageHandler?: unknown };
}

/**
 * 启用 pdfjs 主线程模式：动态加载 worker 模块（其副作用会把
 * WorkerMessageHandler 挂到 globalThis.pdfjsWorker），pdfjs 检测到后
 * 不再创建 Web Worker，直接在主线程解析。
 * 背景：沙箱 iframe / 受限 CSP 环境下 `new Worker(跨源URL, {type:"module"})`
 * 会同步抛 SecurityError，pdfjs 回退的动态 import(workerSrc) 同样跨域失败，
 * 导致 getDocument 永远 reject。主线程模式完全绕开该路径。
 */
async function enableMainThreadParsing(): Promise<void> {
  const g = globalThis as PdfWorkerGlobal;
  if (g.pdfjsWorker?.WorkerMessageHandler) return;
  const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs');
  if (!g.pdfjsWorker?.WorkerMessageHandler) {
    g.pdfjsWorker = workerModule;
  }
}

export interface PdfExtractResult {
  text: string;
  pageCount: number;
}

/** 超时保护：避免解析卡死时 promise 永远不 settle */
function withTimeout<T>(task: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(msg)), ms);
    task.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

/** 提取 PDF 全部文本；文本过少视为扫描件 */
export async function extractPdfText(file: File): Promise<PdfExtractResult> {
  await enableMainThreadParsing();
  const buffer = await file.arrayBuffer();
  const pdf = await withTimeout(
    pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise,
    30000,
    'PDF 解析超时，请重试或更换文件'
  );

  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    parts.push(pageText);
    page.cleanup();
  }

  const text = parts.join('\n');
  if (text.replace(/\s/g, '').length < 200) {
    throw new Error('无法识别文字内容（可能是扫描/图片版 PDF），请上传文字版财报');
  }
  return { text, pageCount: pdf.numPages };
}
