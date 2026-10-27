// 财报速读分析 Edge Function：接收前端提取的 PDF 文本，调用 MiniMax 大模型生成四行结论及同比
import { serve } from "https://deno.land/std/http/server.ts";

const GATEWAY_URL =
  "https://app-fdpjtyejjs3l-api-rLobPAn0n7m9-gateway.miaoda.online/v1/chat/completions";

const ALLOWED_MODELS = ["MiniMax-M3.1-Flash", "MiniMax-M3"] as const;

// 输入文本上限：优先保留财报前部（含"主要会计数据"与经营分析）
const MAX_INPUT_CHARS = 200000;

const SYSTEM_PROMPT = `你是一名资深证券分析师，擅长快速阅读上市公司财报（年报/半年报/季报）。
用户将提供从财报 PDF 中提取的文本。请基于文本严格输出以下 JSON（不要输出任何其他内容、不要使用 Markdown 代码块）：
{
  "company_name": "公司简称",
  "report_period": "报告期，如 2025年半年度",
  "revenue": { "current": "本期营业收入（带单位）", "previous": "上年同期营业收入（带单位）", "yoy": "同比变动百分比（如 +12.3%），无法获取则填 N/A", "comment": "一句话点评收入表现" },
  "net_profit": { "current": "本期净利润（带单位）", "previous": "上年同期净利润（带单位）", "yoy": "同比变动百分比", "comment": "一句话点评利润表现" },
  "cash_flow": { "current": "本期经营活动产生的现金流量净额（带单位）", "previous": "上年同期数值（带单位）", "yoy": "同比变动百分比", "comment": "一句话点评现金流质量" },
  "risks": ["风险点1（含具体数据或事实）", "风险点2", "风险点3"]
}
要求：
1. 所有数字必须来自财报文本，找不到的填 "财报未披露"，禁止编造。
2. 同比数据若财报已直接披露"比上年同期增减"就用披露值。
3. risks 提炼 2-4 条最重要的风险或异常点（如营收下滑、现金流恶化、应收激增、商誉减值、审计意见等）。
4. comment 每条不超过 40 字。`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractJson(content: string): unknown {
  let text = content.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("响应中未找到 JSON");
  }
  return JSON.parse(text.slice(start, end + 1));
}

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
    if (typeof body.text !== "string" || body.text.trim().length < 50) {
      throw new Error("Invalid text");
    }
  } catch {
    return new Response(
      JSON.stringify({ error: "请求体无效：缺少财报文本内容" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const model = typeof body.model === "string" ? body.model : "MiniMax-M3.1-Flash";
  if (!ALLOWED_MODELS.includes(model as (typeof ALLOWED_MODELS)[number])) {
    return new Response(JSON.stringify({ error: "不支持的模型" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "服务器配置错误" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const reportText = body.text.slice(0, MAX_INPUT_CHARS);

  let upstream: Response;
  try {
    upstream = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        thinking: { type: "adaptive" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `以下是财报文本：\n\n${reportText}` },
        ],
        max_completion_tokens: 3000,
      }),
    });
  } catch {
    return new Response(JSON.stringify({ error: "AI 服务请求失败，请重试" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const raw = await upstream.text();
  if (!upstream.ok) {
    return new Response(JSON.stringify({ error: "AI 接口响应异常，请重试" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const json = JSON.parse(raw);
    if (json.base_resp?.status_code && json.base_resp.status_code !== 0) {
      return new Response(
        JSON.stringify({ error: `AI 业务错误 ${json.base_resp.status_code}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("Empty content");
    }
    const analysis = extractJson(content);
    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "AI 返回内容无法解析为结构化结论，请重试" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
