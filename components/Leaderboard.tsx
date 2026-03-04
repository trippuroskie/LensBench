
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BenchmarkResult, CustomModel, Prompt, Receipt } from '../types';
import { MODEL_CONFIGS } from '../constants';

type SortMetric = 'accuracy' | 'latency' | 'cost' | 'tokensPerSecond';

const METRIC_CONFIG: Record<
  SortMetric,
  { label: string; key: keyof BenchmarkResult['metrics']; higherBetter: boolean; format: (v: number) => string }
> = {
  accuracy: {
    label: 'Accuracy',
    key: 'accuracy',
    higherBetter: true,
    format: (v) => `${Math.round(v * 100)}%`,
  },
  latency: {
    label: 'Latency',
    key: 'latencyMs',
    higherBetter: false,
    format: (v) => `${(v / 1000).toFixed(2)}s`,
  },
  cost: {
    label: 'Cost',
    key: 'costUsd',
    higherBetter: false,
    format: (v) => `$${v.toFixed(5)}`,
  },
  tokensPerSecond: {
    label: 'Tokens/sec',
    key: 'tokensPerSecond',
    higherBetter: true,
    format: (v) => v.toFixed(1),
  },
};

interface LeaderboardProps {
  results: BenchmarkResult[];
  customModels: Record<string, CustomModel>;
  prompts: Prompt[];
  receipts: Receipt[];
}

const Leaderboard: React.FC<LeaderboardProps> = ({ results, customModels, prompts, receipts }) => {
  const [sortBy, setSortBy] = useState<SortMetric>('accuracy');

  const allConfigs = { ...MODEL_CONFIGS, ...customModels };
  const [dateRange, setDateRange] = useState<'all' | '30d' | '7d' | '24h'>('all');
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isPromptMenuOpen, setIsPromptMenuOpen] = useState(false);
  const [isReceiptMenuOpen, setIsReceiptMenuOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement | null>(null);
  const promptMenuRef = useRef<HTMLDivElement | null>(null);
  const receiptMenuRef = useRef<HTMLDivElement | null>(null);

  const uniqueModelIds = useMemo(() => Array.from(new Set(results.map(r => r.modelId))), [results]);
  const uniquePromptIds = useMemo(() => Array.from(new Set(results.map(r => r.promptId))), [results]);
  const uniqueReceiptIds = useMemo(() => Array.from(new Set(results.map(r => r.receiptId))), [results]);

  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>([]);
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<string[]>([]);

  const allModelsSelected = uniqueModelIds.length > 0 && selectedModelIds.length === uniqueModelIds.length;
  const allPromptsSelected = uniquePromptIds.length > 0 && selectedPromptIds.length === uniquePromptIds.length;
  const allReceiptsSelected = uniqueReceiptIds.length > 0 && selectedReceiptIds.length === uniqueReceiptIds.length;

  const getPromptName = (id: string) => {
    const p = prompts.find(prompt => prompt.id === id);
    return p ? `${p.name} (v${p.version})` : 'Unknown Prompt';
  };
  const getReceiptName = (id: string) => receipts.find(r => r.id === id)?.name || 'Unknown Receipt';

  useEffect(() => {
    setSelectedModelIds(prev => {
      const next = prev.filter(id => uniqueModelIds.includes(id));
      return next.length ? next : uniqueModelIds;
    });
  }, [uniqueModelIds]);

  useEffect(() => {
    setSelectedPromptIds(prev => {
      const next = prev.filter(id => uniquePromptIds.includes(id));
      return next.length ? next : uniquePromptIds;
    });
  }, [uniquePromptIds]);

  useEffect(() => {
    setSelectedReceiptIds(prev => {
      const next = prev.filter(id => uniqueReceiptIds.includes(id));
      return next.length ? next : uniqueReceiptIds;
    });
  }, [uniqueReceiptIds]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (isModelMenuOpen && modelMenuRef.current && !modelMenuRef.current.contains(target)) {
        setIsModelMenuOpen(false);
      }
      if (isPromptMenuOpen && promptMenuRef.current && !promptMenuRef.current.contains(target)) {
        setIsPromptMenuOpen(false);
      }
      if (isReceiptMenuOpen && receiptMenuRef.current && !receiptMenuRef.current.contains(target)) {
        setIsReceiptMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isModelMenuOpen, isPromptMenuOpen, isReceiptMenuOpen]);

  const toggleId = (id: string, setSelected: React.Dispatch<React.SetStateAction<string[]>>) => {
    setSelected(prev => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter(v => v !== id) : prev;
      }
      return [...prev, id];
    });
  };

  const toggleAll = (allIds: string[], setSelected: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (allIds.length === 0) return;
    setSelected(prev => (prev.length === allIds.length ? [allIds[0]] : allIds));
  };

  const filteredResults = useMemo(() => {
    const now = Date.now();
    const rangeMs =
      dateRange === '30d' ? 30 * 24 * 60 * 60 * 1000 :
      dateRange === '7d' ? 7 * 24 * 60 * 60 * 1000 :
      dateRange === '24h' ? 24 * 60 * 60 * 1000 :
      null;

    return results.filter(r => {
      if (!selectedModelIds.includes(r.modelId)) return false;
      if (!selectedPromptIds.includes(r.promptId)) return false;
      if (!selectedReceiptIds.includes(r.receiptId)) return false;
      if (rangeMs != null && now - r.timestamp > rangeMs) return false;
      return true;
    });
  }, [results, selectedModelIds, selectedPromptIds, selectedReceiptIds, dateRange]);

  // Aggregate by model: average each metric
  const modelStats = useMemo(() => {
    const byModel = new Map<
      string,
      { runs: number; accuracy: number; latencyMs: number; costUsd: number; tokensPerSecond: number }
    >();
    for (const r of filteredResults) {
      const cur = byModel.get(r.modelId);
      const m = r.metrics;
      if (!cur) {
        byModel.set(r.modelId, {
          runs: 1,
          accuracy: m.accuracy,
          latencyMs: m.latencyMs,
          costUsd: m.costUsd,
          tokensPerSecond: m.tokensPerSecond,
        });
      } else {
        cur.runs += 1;
        cur.accuracy += m.accuracy;
        cur.latencyMs += m.latencyMs;
        cur.costUsd += m.costUsd;
        cur.tokensPerSecond += m.tokensPerSecond;
      }
    }
    return Array.from(byModel.entries()).map(([modelId, agg]) => ({
      modelId,
      runs: agg.runs,
      accuracy: agg.accuracy / agg.runs,
      latencyMs: agg.latencyMs / agg.runs,
      costUsd: agg.costUsd / agg.runs,
      tokensPerSecond: agg.tokensPerSecond / agg.runs,
    }));
  }, [filteredResults]);

  const sorted = useMemo(() => {
    const config = METRIC_CONFIG[sortBy];
    const key = config.key as keyof typeof modelStats[0];
    return [...modelStats].sort((a, b) => {
      const va = a[key as keyof typeof a] as number;
      const vb = b[key as keyof typeof b] as number;
      if (config.higherBetter) return vb - va;
      return va - vb;
    });
  }, [modelStats, sortBy]);

  const currentConfig = METRIC_CONFIG[sortBy];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Model Leaderboard</h2>
        <p className="text-slate-500 mt-1">
          Models ranked by your benchmark results. Switch metrics to compare accuracy, speed, and cost.
        </p>
      </div>

      {/* Metric tabs — similar to Artificial Analysis */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(METRIC_CONFIG) as SortMetric[]).map((metric) => {
          const cfg = METRIC_CONFIG[metric];
          const isActive = sortBy === metric;
          return (
            <button
              key={metric}
              onClick={() => setSortBy(metric)}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/20'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-700'
              }`}
            >
              {cfg.label}
              <span className="ml-2 text-[10px] opacity-80">
                {cfg.higherBetter ? '↑ higher better' : '↓ lower better'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      {results.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl md:rounded-2xl shadow-sm px-3 md:px-4 py-3 flex flex-wrap items-center gap-3">
          <div ref={modelMenuRef} className="relative flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">Models:</span>
            <button type="button" onClick={() => setIsModelMenuOpen(prev => !prev)} className="text-xs md:text-sm font-medium text-slate-700 min-w-44 inline-flex items-center justify-between gap-3">
              <span>{allModelsSelected ? `All Models (${uniqueModelIds.length})` : `${selectedModelIds.length} selected`}</span>
              <i className={`fas fa-chevron-${isModelMenuOpen ? 'up' : 'down'} text-[10px] text-slate-400`} />
            </button>
            {isModelMenuOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-20">
                <button type="button" onClick={() => toggleAll(uniqueModelIds, setSelectedModelIds)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left">
                  <input type="checkbox" checked={allModelsSelected} readOnly className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm font-medium text-slate-700">Select all</span>
                </button>
                <div className="my-1 border-t border-slate-100" />
                <div className="max-h-52 overflow-y-auto pr-1 space-y-0.5">
                  {uniqueModelIds.map(id => (
                    <button key={id} type="button" onClick={() => toggleId(id, setSelectedModelIds)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left">
                      <input type="checkbox" checked={selectedModelIds.includes(id)} readOnly className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-slate-700 truncate">{(allConfigs[id] || { name: id }).name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div ref={promptMenuRef} className="relative flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 ml-auto">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">Prompts:</span>
            <button type="button" onClick={() => setIsPromptMenuOpen(prev => !prev)} className="text-xs md:text-sm font-medium text-slate-700 min-w-40 inline-flex items-center justify-between gap-3">
              <span>{allPromptsSelected ? `All Prompts (${uniquePromptIds.length})` : `${selectedPromptIds.length} selected`}</span>
              <i className={`fas fa-chevron-${isPromptMenuOpen ? 'up' : 'down'} text-[10px] text-slate-400`} />
            </button>
            {isPromptMenuOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-20">
                <button type="button" onClick={() => toggleAll(uniquePromptIds, setSelectedPromptIds)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left">
                  <input type="checkbox" checked={allPromptsSelected} readOnly className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm font-medium text-slate-700">Select all</span>
                </button>
                <div className="my-1 border-t border-slate-100" />
                <div className="max-h-52 overflow-y-auto pr-1 space-y-0.5">
                  {uniquePromptIds.map(id => (
                    <button key={id} type="button" onClick={() => toggleId(id, setSelectedPromptIds)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left">
                      <input type="checkbox" checked={selectedPromptIds.includes(id)} readOnly className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-slate-700 truncate">{getPromptName(id)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div ref={receiptMenuRef} className="relative flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">Receipts:</span>
            <button type="button" onClick={() => setIsReceiptMenuOpen(prev => !prev)} className="text-xs md:text-sm font-medium text-slate-700 min-w-40 inline-flex items-center justify-between gap-3">
              <span>{allReceiptsSelected ? `All Receipts (${uniqueReceiptIds.length})` : `${selectedReceiptIds.length} selected`}</span>
              <i className={`fas fa-chevron-${isReceiptMenuOpen ? 'up' : 'down'} text-[10px] text-slate-400`} />
            </button>
            {isReceiptMenuOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-20">
                <button type="button" onClick={() => toggleAll(uniqueReceiptIds, setSelectedReceiptIds)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left">
                  <input type="checkbox" checked={allReceiptsSelected} readOnly className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm font-medium text-slate-700">Select all</span>
                </button>
                <div className="my-1 border-t border-slate-100" />
                <div className="max-h-52 overflow-y-auto pr-1 space-y-0.5">
                  {uniqueReceiptIds.map(id => (
                    <button key={id} type="button" onClick={() => toggleId(id, setSelectedReceiptIds)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left">
                      <input type="checkbox" checked={selectedReceiptIds.includes(id)} readOnly className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-slate-700 truncate">{getReceiptName(id)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <i className="fas fa-calendar-day text-slate-400 text-xs" />
            <select
              className="bg-transparent border-none text-xs md:text-sm font-medium focus:ring-0 p-0 pr-6 cursor-pointer"
              value={dateRange}
              onChange={e => setDateRange(e.target.value as any)}
            >
              <option value="30d">Last 30 Days</option>
              <option value="7d">Last 7 Days</option>
              <option value="24h">Last 24 Hours</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-trophy text-3xl text-slate-400"></i>
          </div>
          <p className="text-slate-500 font-medium">No benchmark data yet</p>
          <p className="text-sm text-slate-400 mt-1">Run a benchmark to see models ranked by {currentConfig.label}.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Ranked by {currentConfig.label} · {currentConfig.higherBetter ? 'Higher is better' : 'Lower is better'}
            </p>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-16">#</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Model</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                    {METRIC_CONFIG.accuracy.label}
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                    {METRIC_CONFIG.latency.label}
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                    {METRIC_CONFIG.cost.label}
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                    {METRIC_CONFIG.tokensPerSecond.label}
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                    Runs
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((row, index) => {
                  const config = allConfigs[row.modelId] || { name: row.modelId, color: 'bg-slate-100 text-slate-600 border-slate-200' };
                  const rank = index + 1;
                  return (
                    <tr key={row.modelId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex w-8 h-8 rounded-lg items-center justify-center text-sm font-bold ${
                            rank === 1
                              ? 'bg-amber-100 text-amber-700'
                              : rank === 2
                                ? 'bg-slate-200 text-slate-600'
                                : rank === 3
                                  ? 'bg-amber-50 text-amber-800'
                                  : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {rank}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`inline-flex px-3 py-1.5 rounded-lg text-sm font-bold border ${config.color}`}>
                          {config.name}
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-1 truncate max-w-[200px]">{row.modelId}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`font-bold ${
                            row.accuracy >= 0.9 ? 'text-emerald-600' : row.accuracy >= 0.7 ? 'text-amber-600' : 'text-rose-600'
                          }`}
                        >
                          {METRIC_CONFIG.accuracy.format(row.accuracy)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-slate-700 font-medium">
                        {METRIC_CONFIG.latency.format(row.latencyMs)}
                      </td>
                      <td className="px-6 py-4 text-center text-slate-700 font-medium">
                        {METRIC_CONFIG.cost.format(row.costUsd)}
                      </td>
                      <td className="px-6 py-4 text-center text-slate-700 font-medium">
                        {METRIC_CONFIG.tokensPerSecond.format(row.tokensPerSecond)}
                      </td>
                      <td className="px-6 py-4 text-center text-slate-500 text-sm">{row.runs}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
