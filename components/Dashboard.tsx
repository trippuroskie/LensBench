
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BenchmarkResult, ModelId, Prompt, Receipt } from '../types';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { MODEL_CONFIGS } from '../constants';

interface DashboardProps {
  receiptsCount: number;
  promptsCount: number;
  results: BenchmarkResult[];
  prompts: Prompt[];
  receipts: Receipt[];
  onStartBenchmark: () => void;
  customModels: Record<string, any>;
}

const Dashboard: React.FC<DashboardProps> = ({ receiptsCount, promptsCount, results, prompts, receipts, onStartBenchmark, customModels }) => {
  const allConfigs = { ...MODEL_CONFIGS, ...customModels };
  const allModelIds = [...Object.keys(MODEL_CONFIGS), ...Object.keys(customModels)] as ModelId[];
  const [activeModelFilters, setActiveModelFilters] = useState<ModelId[]>(allModelIds);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isPromptMenuOpen, setIsPromptMenuOpen] = useState(false);
  const [isReceiptMenuOpen, setIsReceiptMenuOpen] = useState(false);
  const [activePromptFilters, setActivePromptFilters] = useState<string[]>([]);
  const [activeReceiptFilters, setActiveReceiptFilters] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<'all' | '30d' | '7d' | '24h'>('all');
  const modelMenuRef = useRef<HTMLDivElement | null>(null);
  const promptMenuRef = useRef<HTMLDivElement | null>(null);
  const receiptMenuRef = useRef<HTMLDivElement | null>(null);

  const uniquePromptIds = useMemo(() => {
    const ids = Array.from(new Set(results.map(r => r.promptId)));
    return ids;
  }, [results]);
  const uniqueReceiptIds = useMemo(() => {
    const ids = Array.from(new Set(results.map(r => r.receiptId)));
    return ids;
  }, [results]);

  const getPromptDisplayName = (promptId: string) => {
    const prompt = prompts.find(p => p.id === promptId);
    return prompt ? `${prompt.name} (v${prompt.version})` : 'Unknown Prompt';
  };

  const getReceiptDisplayName = (receiptId: string) => {
    const receipt = receipts.find(r => r.id === receiptId);
    return receipt?.name || 'Unknown Receipt';
  };

  const allModelsSelected = activeModelFilters.length === allModelIds.length;

  const toggleModelFilter = (id: ModelId) => {
    setActiveModelFilters(prev => {
      if (prev.includes(id)) {
        // Keep at least one model selected
        return prev.length > 1 ? prev.filter(m => m !== id) : prev;
      }
      return [...prev, id];
    });
  };

  const toggleAllModels = () => {
    setActiveModelFilters(prev =>
      prev.length === allModelIds.length ? [allModelIds[0]] : allModelIds
    );
  };
  const allPromptsSelected = uniquePromptIds.length > 0 && activePromptFilters.length === uniquePromptIds.length;
  const allReceiptsSelected = uniqueReceiptIds.length > 0 && activeReceiptFilters.length === uniqueReceiptIds.length;

  const togglePromptFilter = (id: string) => {
    setActivePromptFilters(prev => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter(p => p !== id) : prev;
      }
      return [...prev, id];
    });
  };

  const toggleReceiptFilter = (id: string) => {
    setActiveReceiptFilters(prev => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter(r => r !== id) : prev;
      }
      return [...prev, id];
    });
  };

  const toggleAllPrompts = () => {
    if (uniquePromptIds.length === 0) return;
    setActivePromptFilters(prev =>
      prev.length === uniquePromptIds.length ? [uniquePromptIds[0]] : uniquePromptIds
    );
  };

  const toggleAllReceipts = () => {
    if (uniqueReceiptIds.length === 0) return;
    setActiveReceiptFilters(prev =>
      prev.length === uniqueReceiptIds.length ? [uniqueReceiptIds[0]] : uniqueReceiptIds
    );
  };

  useEffect(() => {
    setActivePromptFilters(prev => {
      if (uniquePromptIds.length === 0) return [];
      const next = prev.filter(id => uniquePromptIds.includes(id));
      return next.length ? next : uniquePromptIds;
    });
  }, [uniquePromptIds]);

  useEffect(() => {
    setActiveReceiptFilters(prev => {
      if (uniqueReceiptIds.length === 0) return [];
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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModelMenuOpen, isPromptMenuOpen, isReceiptMenuOpen]);

  // Filtered results based on selected models, prompt, and date range
  const filteredResults = useMemo(() => {
    const now = Date.now();
    const rangeMs =
      dateRange === '30d' ? 30 * 24 * 60 * 60 * 1000 :
      dateRange === '7d' ? 7 * 24 * 60 * 60 * 1000 :
      dateRange === '24h' ? 24 * 60 * 60 * 1000 :
      null;

    return results.filter(r => {
      if (!activeModelFilters.includes(r.modelId)) return false;
      if (activePromptFilters.length > 0 && !activePromptFilters.includes(r.promptId)) return false;
      if (activeReceiptFilters.length > 0 && !activeReceiptFilters.includes(r.receiptId)) return false;
      if (rangeMs != null && now - r.timestamp > rangeMs) return false;
      return true;
    });
  }, [results, activeModelFilters, activePromptFilters, activeReceiptFilters, dateRange]);

  const totalRuns = results.length;
  const activeModelsCount = useMemo(
    () => new Set(results.map(r => r.modelId)).size,
    [results]
  );

  const avgAccuracy = useMemo(() => {
    if (filteredResults.length === 0) return 0;
    return filteredResults.reduce((acc, r) => acc + r.metrics.accuracy, 0) / filteredResults.length;
  }, [filteredResults]);

  const avgCost = useMemo(() => {
    if (filteredResults.length === 0) return 0;
    return filteredResults.reduce((acc, r) => acc + r.metrics.costUsd, 0) / filteredResults.length;
  }, [filteredResults]);

  const avgLatencySeconds = useMemo(() => {
    if (filteredResults.length === 0) return 0;
    const total = filteredResults.reduce((acc, r) => acc + r.metrics.latencyMs, 0);
    return total / filteredResults.length / 1000;
  }, [filteredResults]);

  const chartData = useMemo(() => {
    // We take the last 15 filtered results (most recent first) to show trends
    const sorted = [...filteredResults].sort((a, b) => b.timestamp - a.timestamp);
    return sorted.slice(0, 15).reverse().map((r, i) => {
      const config = allConfigs[r.modelId] || { name: r.modelId, color: 'text-slate-700' };
      return {
        name: `Run ${i + 1}`,
        accuracy: Math.round(r.metrics.accuracy * 100),
        latency: Math.round(r.metrics.latencyMs / 100) / 10,
        modelName: config.name,
        modelColor: config.color.split(' ')[1]?.replace('text-', '').replace('-700', '') || 'slate',
        rawColor: (() => {
          const colorClass = config.color;
          if (colorClass.includes('green')) return '#16a34a';
          if (colorClass.includes('orange')) return '#ea580c';
          if (colorClass.includes('cyan')) return '#0891b2';
          if (colorClass.includes('indigo')) return '#4f46e5';
          if (colorClass.includes('sky')) return '#0284c7';
          if (colorClass.includes('violet')) return '#7c3aed';
          if (colorClass.includes('fuchsia')) return '#c026d3';
          return '#2563eb'; // Default Blue
        })()
      };
    });
  }, [filteredResults, allConfigs]);

  const latencyByModel = useMemo(() => {
    const map = new Map<string, { modelName: string; avgLatencyMs: number }>();
    filteredResults.forEach(r => {
      const key = r.modelId;
      const config = allConfigs[r.modelId] || { name: r.modelId };
      const existing = map.get(key);
      if (existing) {
        existing.avgLatencyMs = (existing.avgLatencyMs + r.metrics.latencyMs) / 2;
      } else {
        map.set(key, { modelName: config.name, avgLatencyMs: r.metrics.latencyMs });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.avgLatencyMs - b.avgLatencyMs);
  }, [filteredResults, allConfigs]);

  const recentResults = useMemo(() => {
    return [...results]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
  }, [results]);

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Benchmark Analytics
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Compare performance, accuracy and cost across your OCR models.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:block relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
              <i className="fas fa-search" />
            </span>
            <input
              type="text"
              placeholder="Search experiments..."
              className="pl-8 pr-3 py-2 bg-slate-100 border-none rounded-lg text-xs md:text-sm w-48 md:w-64 focus:ring-2 focus:ring-indigo-200 outline-none"
            />
          </div>
          <button
            onClick={onStartBenchmark}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95"
          >
            <i className="fas fa-plus text-xs" />
            <span>Run New Experiment</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl md:rounded-2xl shadow-sm px-3 md:px-4 py-3 flex flex-wrap items-center gap-3">
        {/* Models */}
        <div
          ref={modelMenuRef}
          className="relative flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200"
        >
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">
            Models:
          </span>
          <button
            type="button"
            onClick={() => setIsModelMenuOpen(prev => !prev)}
            className="text-xs md:text-sm font-medium text-slate-700 min-w-44 inline-flex items-center justify-between gap-3"
          >
            <span>
              {allModelsSelected
                ? `All Models (${allModelIds.length})`
                : `${activeModelFilters.length} selected`}
            </span>
            <i className={`fas fa-chevron-${isModelMenuOpen ? 'up' : 'down'} text-[10px] text-slate-400`} />
          </button>
          {isModelMenuOpen && (
            <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-20">
              <button
                type="button"
                onClick={toggleAllModels}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left"
              >
                <input
                  type="checkbox"
                  checked={allModelsSelected}
                  readOnly
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-slate-700">Select all</span>
              </button>
              <div className="my-1 border-t border-slate-100" />
              <div className="max-h-52 overflow-y-auto pr-1 space-y-0.5">
                {allModelIds.map(mId => {
                  const config = allConfigs[mId];
                  const checked = activeModelFilters.includes(mId);
                  return (
                    <button
                      key={mId}
                      type="button"
                      onClick={() => toggleModelFilter(mId)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        readOnly
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-slate-700 truncate">{config.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Prompts */}
        <div
          ref={promptMenuRef}
          className="relative flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 ml-auto"
        >
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">
            Prompts:
          </span>
          <button
            type="button"
            onClick={() => setIsPromptMenuOpen(prev => !prev)}
            className="text-xs md:text-sm font-medium text-slate-700 min-w-40 inline-flex items-center justify-between gap-3"
          >
            <span>
              {allPromptsSelected
                ? `All Prompts (${uniquePromptIds.length})`
                : `${activePromptFilters.length} selected`}
            </span>
            <i className={`fas fa-chevron-${isPromptMenuOpen ? 'up' : 'down'} text-[10px] text-slate-400`} />
          </button>
          {isPromptMenuOpen && (
            <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-20">
              <button
                type="button"
                onClick={toggleAllPrompts}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left"
              >
                <input
                  type="checkbox"
                  checked={allPromptsSelected}
                  readOnly
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-slate-700">Select all</span>
              </button>
              <div className="my-1 border-t border-slate-100" />
              <div className="max-h-52 overflow-y-auto pr-1 space-y-0.5">
                {uniquePromptIds.map(id => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => togglePromptFilter(id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left"
                  >
                    <input
                      type="checkbox"
                      checked={activePromptFilters.includes(id)}
                      readOnly
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700 truncate">{getPromptDisplayName(id)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Receipts */}
        <div
          ref={receiptMenuRef}
          className="relative flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200"
        >
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">
            Receipts:
          </span>
          <button
            type="button"
            onClick={() => setIsReceiptMenuOpen(prev => !prev)}
            className="text-xs md:text-sm font-medium text-slate-700 min-w-40 inline-flex items-center justify-between gap-3"
          >
            <span>
              {allReceiptsSelected
                ? `All Receipts (${uniqueReceiptIds.length})`
                : `${activeReceiptFilters.length} selected`}
            </span>
            <i className={`fas fa-chevron-${isReceiptMenuOpen ? 'up' : 'down'} text-[10px] text-slate-400`} />
          </button>
          {isReceiptMenuOpen && (
            <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-20">
              <button
                type="button"
                onClick={toggleAllReceipts}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left"
              >
                <input
                  type="checkbox"
                  checked={allReceiptsSelected}
                  readOnly
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-slate-700">Select all</span>
              </button>
              <div className="my-1 border-t border-slate-100" />
              <div className="max-h-52 overflow-y-auto pr-1 space-y-0.5">
                {uniqueReceiptIds.map(id => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleReceiptFilter(id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left"
                  >
                    <input
                      type="checkbox"
                      checked={activeReceiptFilters.includes(id)}
                      readOnly
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700 truncate">{getReceiptDisplayName(id)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Date range */}
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

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard
          title="Total Runs"
          value={totalRuns}
          icon="fa-running"
          color="indigo"
          helper="+12% vs last period"
        />
        <StatCard
          title="Active Models"
          value={activeModelsCount}
          icon="fa-microchip"
          color="blue"
          helper="Using historical results"
        />
        <StatCard
          title="Avg. Accuracy"
          value={`${Math.round(avgAccuracy * 100)}%`}
          icon="fa-bullseye"
          color="emerald"
          helper={filteredResults.length ? 'Across filtered runs' : 'No data yet'}
        />
        <StatCard
          title="Avg. Inference Time"
          value={`${avgLatencySeconds.toFixed(1)}s`}
          icon="fa-stopwatch"
          color="rose"
          helper={filteredResults.length ? 'Completion time per run' : 'No data yet'}
        />
        <StatCard
          title="Avg. Cost"
          value={`$${avgCost.toFixed(4)}`}
          icon="fa-dollar-sign"
          color="blue"
          helper={filteredResults.length ? 'Cost per filtered run' : 'No data yet'}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Accuracy Trend */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm min-w-0">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <i className="fas fa-chart-line text-indigo-500"></i> Accuracy over Time
            </h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              Last {Math.min(chartData.length, 15) || 0} filtered runs
            </span>
          </div>
          <div className="h-[350px] w-full min-h-[350px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" hide />
                  <YAxis unit="%" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{data.modelName}</p>
                            <p className="text-lg font-bold text-slate-900">{payload[0].value}% Accuracy</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="accuracy" 
                    stroke="#6366f1" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorAcc)" 
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState />
            )}
          </div>
        </div>

        {/* Latency by Model */}
        <div className="bg-white p-6 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm min-w-0">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <i className="fas fa-bolt text-rose-500"></i> Inference Time Distribution (s)
            </h3>
            <i className="fas fa-ellipsis-h text-slate-400 text-sm" />
          </div>
          <div className="space-y-4">
            {latencyByModel.length ? (
              latencyByModel.map(entry => {
                const seconds = entry.avgLatencyMs / 1000;
                const width = Math.min((seconds / (latencyByModel[latencyByModel.length - 1].avgLatencyMs / 1000 || 1)) * 100, 100);
                return (
                  <div key={entry.modelName} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-600">{entry.modelName}</span>
                      <span className="text-slate-900 font-bold">
                        {seconds.toFixed(1)}s
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyChartState />
            )}
          </div>
        </div>
      </div>

      {/* Recent Experiments Table */}
      <div className="bg-white rounded-xl md:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Recent Experiments</h3>
          <button className="text-xs md:text-sm font-semibold text-indigo-600 hover:underline">
            View All
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 md:px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">
                  Model
                </th>
                <th className="px-4 md:px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">
                  Prompt Set
                </th>
                <th className="px-4 md:px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">
                  Accuracy
                </th>
                <th className="px-4 md:px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">
                  Inference Time
                </th>
                <th className="px-4 md:px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">
                  Cost
                </th>
                <th className="px-4 md:px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentResults.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 md:px-6 py-8 text-center text-sm text-slate-400"
                  >
                    No experiments have been run yet.
                  </td>
                </tr>
              )}
              {recentResults.map(result => {
                const config = allConfigs[result.modelId] || { name: result.modelId };
                const accuracyPct = result.metrics.accuracy * 100;
                return (
                  <tr
                    key={result.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 md:px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center">
                          <i className="fas fa-robot text-xs text-slate-500" />
                        </div>
                        <span className="text-sm font-semibold text-slate-900">
                          {config.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-sm text-slate-600">
                      {getPromptDisplayName(result.promptId)}
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {accuracyPct.toFixed(1)}%
                        </span>
                        <div className="w-12 h-1.5 bg-slate-100 rounded-full">
                          <div
                            className={`h-full rounded-full ${
                              accuracyPct > 95
                                ? 'bg-green-500'
                                : accuracyPct > 85
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(accuracyPct, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-sm font-medium text-slate-900">
                      {result.metrics.latencyMs.toLocaleString()}ms
                    </td>
                    <td className="px-4 md:px-6 py-4 text-sm text-slate-600">
                      ${result.metrics.costUsd.toFixed(4)}
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight bg-green-100 text-green-700 border border-green-200">
                        Success
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {results.length === 0 && (
        <div className="bg-indigo-50 border border-indigo-100 p-12 rounded-3xl text-center">
          <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fas fa-rocket text-3xl"></i>
          </div>
          <h3 className="text-xl font-bold text-indigo-900 mb-2">Ready to benchmark?</h3>
          <p className="text-indigo-700/70 mb-8 max-w-md mx-auto">Upload some receipts and create your first OCR extraction prompt to see your metrics appear here.</p>
          <button 
            onClick={onStartBenchmark}
            className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold shadow-xl shadow-indigo-200 hover:scale-105 active:scale-95 transition-all"
          >
            Create My First Experiment
          </button>
        </div>
      )}
    </div>
  );
};

const EmptyChartState = () => (
  <div className="h-full flex flex-col items-center justify-center text-slate-300 italic border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/40">
    <i className="fas fa-chart-area text-4xl mb-2 opacity-30"></i>
    <p className="text-sm">No filtered data to visualize</p>
  </div>
);

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  helper?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, helper }) => {
  const colorMap: any = {
    indigo: 'bg-indigo-50 text-indigo-600',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600'
  };

  return (
    <div className="bg-white p-5 md:p-6 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
      <div className="absolute right-2 top-2 opacity-5 text-4xl">
        <i className={`fas ${icon}`}></i>
      </div>
      <div className="flex items-center gap-4 relative">
        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          <i className={`fas ${icon} text-xl`}></i>
        </div>
        <div>
          <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest">{title}</p>
          <h4 className="text-xl md:text-2xl font-bold text-slate-900">{value}</h4>
          {helper && (
            <p className="text-[11px] text-slate-400 mt-1">
              {helper}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
