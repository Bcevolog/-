import { describe, it, expect } from 'vitest';
import * as pdfjsLib from 'pdfjs-dist';
import { extractPdfText } from '@/lib/pdfExtract';
// Properly generated text PDF (reportlab) with >200 non-whitespace chars
const PDF_BASE64 =
  'JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMSAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL0NvbnRlbnRzIDcgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgNiAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNCAwIG9iago8PAovUGFnZU1vZGUgL1VzZU5vbmUgL1BhZ2VzIDYgMCBSIC9UeXBlIC9DYXRhbG9nCj4+CmVuZG9iago1IDAgb2JqCjw8Ci9BdXRob3IgKGFub255bW91cykgL0NyZWF0aW9uRGF0ZSAoRDoyMDI2MTAyNzIzMDMyMSswOCcwMCcpIC9DcmVhdG9yIChhbm9ueW1vdXMpIC9LZXl3b3JkcyAoKSAvTW9kRGF0ZSAoRDoyMDI2MTAyNzIzMDMyMSswOCcwMCcpIC9Qcm9kdWNlciAoUmVwb3J0TGFiIFBERiBMaWJyYXJ5IC0gXChvcGVuc291cmNlXCkpIAogIC9TdWJqZWN0ICh1bnNwZWNpZmllZCkgL1RpdGxlICh1bnRpdGxlZCkgL1RyYXBwZWQgL0ZhbHNlCj4+CmVuZG9iago2IDAgb2JqCjw8Ci9Db3VudCAxIC9LaWRzIFsgMyAwIFIgXSAvVHlwZSAvUGFnZXMKPj4KZW5kb2JqCjcgMCBvYmoKPDwKL0ZpbHRlciBbIC9BU0NJSTg1RGVjb2RlIC9GbGF0ZURlY29kZSBdIC9MZW5ndGggNDExCj4+CnN0cmVhbQpHYiIvZFl0aTFqJ0xkNVtpZjplY0BRLiQxJ2FZV2U4MTZdMVM8cTdGWiZBIlZiMjs1WUthZTdJZEJbPCtjW1BVUFNgTVZrRU8jKmY4KVYsI2gnMyReQlI/dGBXNmRgZ1R0VTt0YzdUYXFcdTwpY2JLdUoiZyhEcVRGPGlYU0hMJnAuMDg3RD5fTFwmZDZFaWFobEcqYkBfUm42Ij1iQ3U0IzFBTTppU3I8WEtgVHE/S0NTTjYlKVA3aDMjKi9FVzwrXmVpbmE7WF5sYV9yVTpAQFUzWW9PNVk2VChsLiduTz9JUigrKCNxK11qSzxxZzIhci9lbG1PQFduMVMiI18qdD4nPDNmN1BtaXNESyJxZTNLNTgzcXNLNidyLihbLy47UjQ1KkQ0IlJEY15JODdyNDgxJlFlbClhWEJpS2BaKWtXP1xHTiQhcnNabGB0IklxLSQnV20hNDViSVllSDttQlUhYlZCcFY8TG05aUBgYF1iLFwoIT5scSwxJURLPkZyQSVCXzdQRG5UYUI/dScwaXAkb1VuOWphfj5lbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA4CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDA2MSAwMDAwMCBuIAowMDAwMDAwMDkyIDAwMDAwIG4gCjAwMDAwMDAxOTkgMDAwMDAgbiAKMDAwMDAwMDQwMiAwMDAwMCBuIAowMDAwMDAwNDcwIDAwMDAwIG4gCjAwMDAwMDA3MzEgMDAwMDAgbiAKMDAwMDAwMDc5MCAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9JRCAKWzxlMDY2MjUwYjc4OGZkNWE1ZWQyMjM1YWMyMDhhYzhkMD48ZTA2NjI1MGI3ODhmZDVhNWVkMjIzNWFjMjA4YWM4ZDA+XQolIFJlcG9ydExhYiBnZW5lcmF0ZWQgUERGIGRvY3VtZW50IC0tIGRpZ2VzdCAob3BlbnNvdXJjZSkKCi9JbmZvIDUgMCBSCi9Sb290IDQgMCBSCi9TaXplIDgKPj4Kc3RhcnR4cmVmCjEyOTEKJSVFT0YK';

function base64ToFile(): File {
  const bin = atob(PDF_BASE64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], 'sample.pdf', { type: 'application/pdf' });
}

describe('Bug修复: PDF文本提取改用主线程模式绕开跨域Worker', () => {
  it('主线程模式: 启用后 globalThis.pdfjsWorker 可用且能解析文档', async () => {
    // extractPdfText 内部会启用主线程模式；先跑一次完整提取
    const first = await extractPdfText(base64ToFile());
    expect(first.pageCount).toBe(1);
    const g = globalThis as { pdfjsWorker?: { WorkerMessageHandler?: unknown } };
    expect(g.pdfjsWorker?.WorkerMessageHandler).toBeTruthy();

    // 主线程模式下直接调用 pdfjs API 也应正常工作（不依赖 Worker）
    const file = base64ToFile();
    const buffer = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    expect(content.items.length).toBeGreaterThan(0);
  }, 60000);

  it('应该: 成功提取文字版PDF文本(>200字符)', async () => {
    const result = await extractPdfText(base64ToFile());
    expect(result.pageCount).toBe(1);
    expect(result.text.replace(/\s/g, '').length).toBeGreaterThan(200);
  }, 60000);
});