// 财报 AI 聊天助手 Edge Function（SSE 流式透传 MiniMax）
import { serve } from "https://deno.land/std/http/server.ts";

const GATEWAY_URL =
  "https://app-fdpjtyejjs3l-api-rLobPAn0n7m9-gateway.miaoda.online/v1/chat/completions";

const ALLOWED_MODELS = ["MiniMax-M3.1-Flash", "MiniMax-M3"] as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      throw new Error("Missing messages");
    }
  } catch {
    return new Response(JSON.stringify({ error: "请求体无效" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const model = typeof body.model === "string" ? body.model : "MiniMax-M3.1-Flash";
  if (!ALLOWED_MODELS.includes(model as (typeof ALLOWED_MODELS)[number])) {
    return new Response(JSON.stringify({ error: "不支持的模型" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // M3.1-Flash 不接受 thinking.disabled / reasoning_split=false / service_tier
  if (
    model === "MiniMax-M3.1-Flash" &&
    ((body.thinking as { type?: string } | undefined)?.type === "disabled" ||
      body.reasoning_split === false ||
      body.service_tier !== undefined)
  ) {
    return new Response(
      JSON.stringify({ error: "与 MiniMax-M3.1-Flash 不兼容的参数" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "服务器配置错误" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const payload: Record<string, unknown> = {
    model,
    messages: body.messages,
    stream: true,
    stream_options: { include_usage: true },
    max_completion_tokens: 4000,
  };
  if (body.thinking !== undefined) payload.thinking = body.thinking;

  const upstream = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(JSON.stringify({ error: "AI 服务响应异常，请重试" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(upstream.body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
