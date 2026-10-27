// AI 聊天助手悬浮小窗口（SSE 流式 + 模型选择）
import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { streamChat, type StreamChatMessage } from '@/services/chatService';
import { MODEL_OPTIONS, type ChatMessage } from '@/types/report';
import { cn } from '@/lib/utils';

interface ChatWidgetProps {
  /** 财报文本上下文（重新上传后更新并重置会话） */
  contextText: string | null;
  /** 分析完成标记，用于重置会话 */
  contextVersion: number;
}

let seq = 0;
const nextId = () => `msg-${Date.now()}-${seq++}`;

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  contextText,
  contextVersion,
}) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [model, setModel] = useState<string>(MODEL_OPTIONS[0].value);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 财报上下文更新（重新上传）时重置会话
  useEffect(() => {
    setMessages([]);
    abortRef.current?.abort();
    setStreaming(false);
  }, [contextVersion]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const send = async () => {
    const question = input.trim();
    if (!question || streaming || !contextText) return;

    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: question };
    const assistantId = nextId();
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '' },
    ]);
    setInput('');
    setStreaming(true);

    const history: StreamChatMessage[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: question },
    ];

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat(
        [
          {
            role: 'system',
            content: `你是财报分析助手。以下是用户上传的上市公司财报文本，请仅基于该内容回答问题；财报未提及的信息请明确说明"财报中未披露"。回答保持简洁专业。\n\n【财报文本】\n${contextText.slice(0, 150000)}`,
          },
          ...history,
        ],
        model,
        (delta) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + delta } : m
            )
          );
        },
        controller.signal
      );
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content:
                  m.content ||
                  (aborted ? '（已停止生成）' : '回答失败，请重试。'),
              }
            : m
        )
      );
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  return (
    <>
      {/* 悬浮按钮 */}
      <button
        type="button"
        aria-label="打开 AI 聊天助手"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center',
          'rounded-full border border-primary/50 bg-secondary text-primary',
          'shadow-[0_0_16px_hsl(var(--primary)/0.35)] transition-all hover:shadow-hover',
          'cursor-pointer'
        )}
      >
        {open ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
      </button>

      {/* 聊天窗口 */}
      {open && (
        <div
          className={cn(
            'fixed bottom-20 right-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col',
            'animate-fade-in rounded border bg-card shadow-card',
            'max-h-[70vh]'
          )}
          role="dialog"
          aria-label="AI 聊天助手"
        >
          {/* 标题栏 */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-pixel text-primary text-glow text-xs">
                AI_ASSISTANT
              </span>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger
                  aria-label="选择模型"
                  className="h-7 w-[11.5rem] border-border bg-secondary text-[11px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <button
              type="button"
              aria-label="关闭聊天窗口"
              onClick={() => setOpen(false)}
              className="shrink-0 cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 消息列表 */}
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
                <p className="font-pixel text-xs text-muted-foreground">
                  {contextText
                    ? '> 财报已解析完毕，输入问题开始提问'
                    : '> 请先上传并解析财报 PDF'}
                </p>
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'mb-3 flex flex-col gap-1',
                  m.role === 'user' ? 'items-end' : 'items-start'
                )}
              >
                <span className="font-pixel text-[10px] text-muted-foreground">
                  {m.role === 'user' ? 'YOU' : 'AI'}
                </span>
                <div
                  className={cn(
                    'max-w-[90%] whitespace-pre-wrap break-words rounded px-2 py-1.5 text-xs leading-relaxed',
                    m.role === 'user'
                      ? 'bg-secondary text-secondary-foreground'
                      : 'border border-border bg-background text-foreground'
                  )}
                >
                  {m.content || (streaming ? <span className="cursor-block" /> : '')}
                </div>
              </div>
            ))}
          </div>

          {/* 输入区 */}
          <div className="shrink-0 border-t border-border p-2">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="就当前财报提问…"
                disabled={!contextText || streaming}
                className="min-h-[2.5rem] max-h-24 flex-1 resize-none border-border bg-input px-2 py-1.5 text-xs"
                rows={1}
              />
              {streaming ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="停止生成"
                  onClick={stop}
                  className="h-9 w-9 shrink-0"
                >
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="icon"
                  aria-label="发送"
                  onClick={send}
                  disabled={!input.trim() || !contextText}
                  className="h-9 w-9 shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatWidget;
