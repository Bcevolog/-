/// <reference types="vite/client" />

// pdfjs worker 模块无独立类型声明（运行时副作用：挂载 globalThis.pdfjsWorker）
declare module 'pdfjs-dist/build/pdf.worker.min.mjs' {
  export const WorkerMessageHandler: unknown;
}
