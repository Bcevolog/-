-- 财报速读分析记录表
CREATE TABLE report_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  company_name text,
  report_period text,
  analysis jsonb NOT NULL,
  text_length int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX report_analyses_created_at_idx ON report_analyses (created_at DESC);

ALTER TABLE report_analyses ENABLE ROW LEVEL SECURITY;

-- 匿名访客可提交并查看分析结果（无登录体系的轻量工具）
CREATE POLICY "anon can read analyses" ON report_analyses
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon can insert analyses" ON report_analyses
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "authenticated can read analyses" ON report_analyses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated can insert analyses" ON report_analyses
  FOR INSERT TO authenticated WITH CHECK (true);