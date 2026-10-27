// AI 聊天流式服务：直连 report-chat Edge Function 读取 SSE
const CHAT_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/report-chat`;

export interface StreamChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 流式对话，onChunk 接收增量文本 */
export async function streamChat(
  messages: StreamChatMessage[],
  model: string,
  onChunk: (delta: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(CHAT_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ model, messages, thinking: { type: 'adaptive' } }),
    signal,
  });

  if (!response.ok || !response.body) {
    let msg = 'AI 服务响应异常，请重试';
    try {
      const raw = await response.text();
      const json = JSON.parse(raw);
      if (typeof json.error === 'string') msg = json.error;
    } catch {
      // 保留默认提示
    }
    throw new Error(msg);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload);
        const delta: string | undefined = json.choices?.[0]?.delta?.content;
        if (delta) onChunk(delta);
      } catch {
        // 忽略无法解析的块
      }
    }
  }
}
