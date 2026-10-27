// 四行结论单行展示卡片（指标 + 本期/上年同期 + 同比）
import React from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { MetricItem } from '@/types/report';
import { cn } from '@/lib/utils';

interface MetricRowProps {
  label: string;
  icon: React.ReactNode;
  data: MetricItem;
}

function yoyTone(yoy: string): 'up' | 'down' | 'flat' | 'unknown' {
  if (!yoy || yoy === 'N/A' || yoy.includes('未披露')) return 'unknown';
  if (yoy.startsWith('+')) return 'up';
  if (yoy.startsWith('-')) return 'down';
  return 'flat';
}

export const MetricRow: React.FC<MetricRowProps> = ({ label, icon, data }) => {
  const tone = yoyTone(data.yoy);
  return (
    <div className="terminal-panel flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-primary/40 text-primary">
          {icon}
        </span>
        <span className="font-pixel text-glow text-sm text-primary">{label}</span>
        {tone !== 'unknown' && (
          <span
            className={cn(
              'ml-auto flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium',
              tone === 'up' && 'border-success/40 text-success',
              tone === 'down' && 'border-destructive/40 text-destructive',
              tone === 'flat' && 'border-border text-muted-foreground'
            )}
          >
            {tone === 'up' && <ArrowUpRight className="h-3.5 w-3.5" />}
            {tone === 'down' && <ArrowDownRight className="h-3.5 w-3.5" />}
            {tone === 'flat' && <Minus className="h-3.5 w-3.5" />}
            {data.yoy}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-medium text-foreground">{data.current}</span>
          <span className="text-xs text-muted-foreground">本期</span>
          <span className="text-border">|</span>
          <span className="text-muted-foreground">{data.previous}</span>
          <span className="text-xs text-muted-foreground">上年同期</span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
          {data.comment}
        </p>
      </div>
    </div>
  );
};

export const RiskRow: React.FC<{ risks: string[] }> = ({ risks }) => (
  <div className="terminal-panel flex flex-col gap-2 border-warning/30 p-4">
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-warning/40 text-warning">
        <AlertTriangle className="h-4 w-4" />
      </span>
      <span className="font-pixel text-glow-accent text-sm text-warning">
        核心风险点
      </span>
    </div>
    <ul className="flex flex-col gap-1.5">
      {risks.map((risk, i) => (
        <li key={i} className="flex gap-2 text-xs leading-relaxed">
          <span className="shrink-0 font-pixel text-warning">[!]</span>
          <span className="min-w-0 text-foreground/90 text-pretty">{risk}</span>
        </li>
      ))}
    </ul>
  </div>
);

export default MetricRow;
