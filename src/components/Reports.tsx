import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Mic, Zap, ChevronDown, Check, Loader2, AlertCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { apiRequest } from '../lib/apiClient';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ReportsProps {
  readonly isDark: boolean;
  readonly isSidebarOpen: boolean;
}

type DimensionOption = { id: string; label: string };
type NodeHealth = { id: string; label: string; metric: number; status: 'active' | 'idle' | string };
type ChartPoint = { label: string; events: number; normalized: number; income: number; expense: number };

type IntelligencePayload = {
  generatedAt: string;
  query: {
    text: string;
    timeHorizon: string;
    entityScope: string;
    metrics: string[];
    startAt: string;
    endAt: string;
  };
  summary: {
    processLoadPct: number;
    throughputLabel: string;
    latencyMs: number;
    uptimePct: number;
    inflow: number;
    outflow: number;
    net: number;
    rateLabel: string;
  };
  chart: {
    maxEvents: number;
    points: ChartPoint[];
  };
  nodes: NodeHealth[];
  dimensions: {
    timeHorizons: DimensionOption[];
    entityScopes: DimensionOption[];
    metricOptions: DimensionOption[];
  };
  narrative: {
    title: string;
    overview: string;
    insights: string[];
    risks: string[];
    actions: string[];
  };
};

const EMPTY_DATA: IntelligencePayload = {
  generatedAt: new Date(0).toISOString(),
  query: {
    text: '',
    timeHorizon: 'q4_forecast',
    entityScope: 'global_operations',
    metrics: ['net_efficiency'],
    startAt: new Date(0).toISOString(),
    endAt: new Date(0).toISOString(),
  },
  summary: {
    processLoadPct: 0,
    throughputLabel: '0',
    latencyMs: 0,
    uptimePct: 0,
    inflow: 0,
    outflow: 0,
    net: 0,
    rateLabel: '-',
  },
  chart: { maxEvents: 0, points: [] },
  nodes: [],
  dimensions: {
    timeHorizons: [
      { id: 'q4_forecast', label: 'Q4 Forecast' },
      { id: 'q3', label: 'Q3' },
      { id: '90d', label: 'Last 90 days' },
      { id: '30d', label: 'Last 30 days' },
      { id: '12m', label: 'Last 12 months' },
    ],
    entityScopes: [
      { id: 'global_operations', label: 'Global Operations' },
      { id: 'finance', label: 'Finance' },
      { id: 'projects', label: 'Projects' },
      { id: 'crm', label: 'CRM' },
    ],
    metricOptions: [
      { id: 'net_efficiency', label: 'Net Efficiency' },
      { id: 'throughput_delay', label: 'Throughput Delay' },
      { id: 'hse_compliance', label: 'HSE Compliance' },
    ],
  },
  narrative: {
    title: 'ERP Intelligence Synthesis',
    overview: 'No data loaded.',
    insights: [],
    risks: [],
    actions: [],
  },
};

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value || 0);
}

const Reports: React.FC<ReportsProps> = ({ isDark }) => {
  const [queryText, setQueryText] = useState('');
  const [timeHorizon, setTimeHorizon] = useState('q4_forecast');
  const [entityScope, setEntityScope] = useState('global_operations');
  const [metrics, setMetrics] = useState<string[]>(['net_efficiency']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<IntelligencePayload>(EMPTY_DATA);

  const loadIntelligence = useCallback(async (mode: 'fetch' | 'synthesize' = 'fetch') => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'synthesize') {
        const response = await apiRequest<{ intelligence: IntelligencePayload }>('/api/v1/reports/intelligence/synthesize', {
          method: 'POST',
          body: {
            query: queryText,
            timeHorizon,
            entityScope,
            metrics,
          },
        });
        setData(response.intelligence ?? EMPTY_DATA);
      } else {
        const params = new URLSearchParams();
        if (queryText.trim()) params.set('query', queryText.trim());
        params.set('timeHorizon', timeHorizon);
        params.set('entityScope', entityScope);
        metrics.forEach((metric) => params.append('metric', metric));

        const response = await apiRequest<{ intelligence: IntelligencePayload }>(`/api/v1/reports/intelligence?${params.toString()}`);
        setData(response.intelligence ?? EMPTY_DATA);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load reports intelligence.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [entityScope, metrics, queryText, timeHorizon]);

  useEffect(() => {
    void loadIntelligence('fetch');
  }, [loadIntelligence]);

  const barHeights = useMemo(() => {
    if (!data.chart.points.length) return Array.from({ length: 14 }, () => 6);
    return data.chart.points.map((point) => Math.max(6, Math.min(100, point.normalized || 0)));
  }, [data.chart.points]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, NodeHealth>();
    for (const node of data.nodes) map.set(node.id, node);
    return map;
  }, [data.nodes]);

  const primaryNodes = [
    { id: 'FINANCE_DB', x: 150, y: 120, label: 'FINANCE_DB', type: 'primary', iconColor: '#2dd4bf', accent: '#0ea5e9' },
    { id: 'CORE_ENGINE', x: 450, y: 240, label: 'CORE_ENGINE_v4.2', type: 'engine', iconColor: '#ff2d9b', accent: '#ff2d9b' },
    { id: 'SCM_FLOW', x: 740, y: 280, label: 'SCM_FLOW', type: 'primary', iconColor: '#8b5cf6', accent: '#8b5cf6' },
    { id: 'SYS_GATEWAY', x: 710, y: 90, label: 'SYS_GATEWAY', type: 'primary', iconColor: '#3b82f6', accent: '#3b82f6' },
  ] as const;

  const secondaryNodes = [
    { id: 's1', x: 80, y: 280 }, { id: 's2', x: 280, y: 80 }, { id: 's3', x: 580, y: 120 },
    { id: 's4', x: 350, y: 380 }, { id: 's5', x: 840, y: 130 }, { id: 's6', x: 220, y: 320 },
    { id: 's7', x: 520, y: 70 }, { id: 's8', x: 700, y: 380 }, { id: 's9', x: 420, y: 120 },
    { id: 's10', x: 820, y: 360 },
  ];

  const allNodes = [...primaryNodes, ...secondaryNodes];

  const connections = useMemo(() => {
    const value: [typeof allNodes[number], typeof allNodes[number]][] = [];
    allNodes.forEach((node, i) => {
      const dists = allNodes
        .map((other, j) => ({
          node: other,
          d: i === j ? Infinity : Math.hypot(node.x - other.x, node.y - other.y),
        }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 3);

      dists.forEach((dist) => {
        const exists = value.some((pair) => (pair[0].id === node.id && pair[1].id === dist.node.id) || (pair[0].id === dist.node.id && pair[1].id === node.id));
        if (!exists) value.push([node, dist.node]);
      });
    });
    return value;
  }, [allNodes]);

  const toggleMetric = (metricId: string) => {
    setMetrics((current) => {
      if (current.includes(metricId)) {
        if (current.length === 1) return current;
        return current.filter((id) => id !== metricId);
      }
      return [...current, metricId];
    });
  };

  return (
    <div className="bg-app" style={{ display: 'grid', gridTemplateRows: '52px 1fr 220px', height: 'calc(100vh - 64px)', gap: '16px', padding: '24px', overflow: 'hidden' }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes oscillation { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.4; } }
            @keyframes rotation { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.3); opacity: 0.8; } }
            .mesh-line { animation: oscillation 3s ease-in-out infinite; }
            .engine-ring { animation: rotation 6s linear infinite; transform-origin: center; }
            .engine-pulse { animation: pulse 2s ease-in-out infinite; transform-origin: center; }
            .node-badge { background: rgba(0,0,0,0.75); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; padding: 3px 8px; font-size: 10px; color: #fff; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.25); }
            .node-badge-light { background: rgba(255,255,255,0.95); border-color: rgba(15,23,42,0.15); color: #0f172a; }
          `,
        }}
      />

      <div className="flex items-center gap-4 w-full">
        <div className="flex-1 flex items-center gap-3 px-4 h-11 rounded-lg border transition-all focus-within:ring-2 focus-within:ring-sky-500/20 bg-surface border-input">
          <Search size={16} className="opacity-40" />
          <input
            type="text"
            value={queryText}
            onChange={(event) => setQueryText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void loadIntelligence('synthesize');
              }
            }}
            placeholder="Query ERP Intelligence with natural language..."
            className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder:text-muted"
          />
          {loading ? <Loader2 size={16} className="opacity-60 animate-spin" /> : <Mic size={16} className="opacity-30" />}
        </div>
        <button
          type="button"
          onClick={() => void loadIntelligence('synthesize')}
          disabled={loading}
          className="h-10 px-5 rounded-md bg-sky-600 hover:bg-sky-500 text-primary text-sm font-semibold shadow-sm flex items-center gap-2 disabled:opacity-60"
        >
          Synthesize report <Zap size={14} className="fill-white" />
        </button>
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-4 min-h-0 h-full overflow-hidden">
        <div className="rounded-xl border relative overflow-hidden h-full bg-card border-border/70">
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `radial-gradient(circle, ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'} 1px, transparent 1px)`, backgroundSize: '28px 28px' }} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 240px 180px at 50% 50%, rgba(255,45,155,0.08), transparent)' }} />

          <svg className="w-full h-full relative z-10" viewBox="0 0 920 450" preserveAspectRatio="xMidYMid slice">
            <g>
              {connections.map(([n1, n2], idx) => (
                <line key={`edge-${idx}`} x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} stroke={isDark ? 'rgba(200,220,255,0.25)' : 'rgba(100,130,180,0.2)'} strokeWidth="0.8" className="mesh-line" />
              ))}
            </g>
            <g>
              {secondaryNodes.map((node) => (
                <circle key={node.id} cx={node.x} cy={node.y} r={3.5} fill={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.2)'} />
              ))}
            </g>

            {primaryNodes.map((node) => {
              const nodeState = nodeMap.get(node.id);
              const metricLabel = typeof nodeState?.metric === 'number' ? ` - ${nodeState.metric}` : '';
              return (
                <g key={node.id}>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.type === 'engine' ? 32 : 26}
                    fill={isDark ? 'rgba(30,40,60,0.85)' : 'rgba(240,244,248,0.9)'}
                    stroke={nodeState?.status === 'active' ? 'rgba(16,185,129,0.5)' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)')}
                    style={{ filter: `drop-shadow(0 0 10px ${node.accent}33)` }}
                  />

                  {node.type === 'primary' && (
                    <rect x={node.x - 7} y={node.y - 7} width={14} height={14} rx={2} fill={node.iconColor} className="opacity-80" style={{ filter: `drop-shadow(0 0 12px ${node.iconColor}66)` }} />
                  )}

                  {node.type === 'engine' && (
                    <>
                      <circle cx={node.x} cy={node.y} r={28} fill="none" stroke={node.accent} strokeWidth="1.5" strokeDasharray="45 15" className="engine-ring" />
                      <circle cx={node.x} cy={node.y} r={7} fill={node.accent} className="engine-pulse" />
                    </>
                  )}

                  <foreignObject x={node.x - 74} y={node.y + (node.type === 'engine' ? 42 : 36)} width={148} height={30}>
                    <div className="flex justify-center">
                      <div className={cn('node-badge', !isDark && 'node-badge-light')}>
                        {node.label}{metricLabel}
                      </div>
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="rounded-xl border p-6 flex flex-col gap-6 h-full overflow-hidden bg-card border-border/70">
          <h3 className="text-sm font-semibold">Synthesis Configuration</h3>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Primary Dimensions</p>
              <div className="space-y-1.5">
                <label className="text-xs text-muted ml-1">Time Horizon</label>
                <div className="relative">
                  <select
                    value={timeHorizon}
                    onChange={(event) => setTimeHorizon(event.target.value)}
                    className="w-full appearance-none px-3 py-2.5 rounded-md border text-xs bg-surface border-input"
                  >
                    {(data.dimensions.timeHorizons.length ? data.dimensions.timeHorizons : EMPTY_DATA.dimensions.timeHorizons).map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="opacity-30 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted ml-1">Entity Scope</label>
                <div className="relative">
                  <select
                    value={entityScope}
                    onChange={(event) => setEntityScope(event.target.value)}
                    className="w-full appearance-none px-3 py-2.5 rounded-md border text-xs bg-surface border-input"
                  >
                    {(data.dimensions.entityScopes.length ? data.dimensions.entityScopes : EMPTY_DATA.dimensions.entityScopes).map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="opacity-30 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Metrics & Coverage</p>
              {(data.dimensions.metricOptions.length ? data.dimensions.metricOptions : EMPTY_DATA.dimensions.metricOptions).map((metric) => {
                const selected = metrics.includes(metric.id);
                return (
                  <button
                    key={metric.id}
                    type="button"
                    onClick={() => toggleMetric(metric.id)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md border text-xs transition-all bg-transparent border-border/70 hover:bg-surface"
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn('w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors', selected ? 'bg-sky-600 border-sky-600' : 'border-input')}>
                        {selected && <Check size={10} className="text-primary" />}
                      </div>
                      <span className={cn(selected ? 'text-primary' : 'text-muted')}>{metric.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className={cn('p-4 rounded-lg border flex flex-col gap-2', isDark ? 'bg-sky-500/5 border-sky-500/10' : 'bg-sky-50 border-sky-500/10')}>
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-sky-600">{data.narrative.title}</span>
                <span className="text-[10px] text-muted">{new Date(data.generatedAt).toLocaleString()}</span>
              </div>
              <p className="text-[10px] text-muted leading-tight">{data.narrative.overview}</p>
              {error ? (
                <p className="text-[11px] text-rose-500 flex items-center gap-2"><AlertCircle size={12} /> {error}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_320px] rounded-xl border p-5 overflow-hidden gap-10 h-full bg-card border-border/70">
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex justify-between items-center mb-3 flex-none">
            <div className="flex items-center gap-3">
              <h3 className="text-xs font-semibold">Live System Performance</h3>
              <div className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/10">
                <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest">DB Feed</span>
              </div>
            </div>
            <span className="text-[10px] text-muted">{data.summary.rateLabel}</span>
          </div>

          <div className="flex-1 relative flex items-end gap-1 px-1">
            {barHeights.map((height, index) => {
              const point = data.chart.points[index];
              const isExpenseDominant = point ? point.expense > point.income : false;
              return (
                <motion.div
                  key={`bar-${index}`}
                  initial={false}
                  animate={{ height: `${height}%` }}
                  className={cn('flex-1 rounded-t-sm', isExpenseDominant ? 'bg-rose-500/70 shadow-[0_0_10px_rgba(244,63,94,0.3)]' : 'bg-sky-500/30')}
                  title={point ? `${point.label}: ${point.events} event(s)` : `P${index + 1}`}
                />
              );
            })}
          </div>

          {data.narrative.insights.length > 0 ? (
            <div className="mt-3 text-[11px] text-muted truncate">{data.narrative.insights[0]}</div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 grid-rows-3 gap-3 h-full py-1">
          {[
            { label: 'Process Load', val: `${data.summary.processLoadPct.toFixed(1)}%`, color: 'text-sky-500' },
            { label: 'Throughput', val: data.summary.throughputLabel, color: 'text-primary' },
            { label: 'Latency', val: `${data.summary.latencyMs}ms`, color: 'text-sky-500' },
            { label: 'Uptime', val: `${data.summary.uptimePct.toFixed(1)}%`, color: 'text-emerald-500' },
            { label: 'Expected Inflow', val: formatMoney(data.summary.inflow), color: 'text-emerald-500' },
            { label: 'Expected Outflow', val: formatMoney(data.summary.outflow), color: 'text-rose-500' },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col justify-center">
              <p className="text-[10px] text-muted uppercase font-medium">{stat.label}</p>
              <p className={cn('text-xl font-bold font-mono tracking-tight', stat.color)}>{stat.val}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Reports;
