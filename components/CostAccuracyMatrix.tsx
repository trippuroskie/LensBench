
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  Legend,
  ZAxis,
} from 'recharts';
import { BenchmarkResult, CustomModel, Prompt, Receipt } from '../types';
import { MODEL_CONFIGS } from '../constants';

function configColorToHex(colorClass: string): string {
  if (colorClass.includes('green')) return '#16a34a';
  if (colorClass.includes('orange')) return '#ea580c';
  if (colorClass.includes('cyan')) return '#0891b2';
  if (colorClass.includes('indigo')) return '#4f46e5';
  if (colorClass.includes('sky')) return '#0284c7';
  if (colorClass.includes('violet')) return '#7c3aed';
  if (colorClass.includes('fuchsia')) return '#c026d3';
  if (colorClass.includes('blue')) return '#2563eb';
  return '#64748b';
}

interface CostAccuracyMatrixProps {
  results: BenchmarkResult[];
  customModels: Record<string, CustomModel>;
  prompts: Prompt[];
  receipts: Receipt[];
}

const CostAccuracyMatrix: React.FC<CostAccuracyMatrixProps> = ({ results, customModels, prompts, receipts }) => {
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

  const toggleId = (id: string, selected: string[], setSelected: React.Dispatch<React.SetStateAction<string[]>>) => {
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

  // Aggregate by model: average accuracy and cost
  const modelStats = useMemo(() => {
    const byModel = new Map<
      string,
      { runs: number; accuracy: number; costUsd: number }
    >();
    for (const r of filteredResults) {
      const cur = byModel.get(r.modelId);
      const m = r.metrics;
      if (!cur) {
        byModel.set(r.modelId, {
          runs: 1,
          accuracy: m.accuracy,
          costUsd: m.costUsd,
        });
      } else {
        cur.runs += 1;
        cur.accuracy += m.accuracy;
        cur.costUsd += m.costUsd;
      }
    }
    return Array.from(byModel.entries()).map(([modelId, agg]) => ({
      modelId,
      runs: agg.runs,
      accuracy: agg.accuracy / agg.runs,
      costUsd: agg.costUsd / agg.runs,
    }));
  }, [filteredResults]);

  const pointsByModel = useMemo(() => {
    const map = new Map<
      string,
      { x: number; y: number; name: string; color: string; runs: number }
    >();
    for (const s of modelStats) {
      const config = allConfigs[s.modelId] || {
        name: s.modelId,
        color: 'bg-slate-100 text-slate-600 border-slate-200',
      };
      map.set(s.modelId, {
        x: s.costUsd,
        y: s.accuracy,
        name: config.name,
        color: configColorToHex(config.color),
        runs: s.runs,
      });
    }
    return map;
  }, [modelStats, allConfigs]);

  const scatterData = useMemo(
    () => Array.from(pointsByModel.entries()).map(([modelId, p]) => ({ ...p, modelId })),
    [pointsByModel]
  );

  const { costMax, costMin, accMin } = useMemo(() => {
    const costs = scatterData.map((d) => d.x);
    const accs = scatterData.map((d) => d.y);
    return {
      costMin: Math.min(0, ...costs),
      costMax: Math.max(0.001, ...costs) * 1.15,
      accMin: Math.min(0, ...accs),
    };
  }, [scatterData]);

  const medianCost =
    scatterData.length > 0
      ? [...scatterData].map((d) => d.x).sort((a, b) => a - b)[Math.floor(scatterData.length / 2)]
      : 0;
  const medianAcc =
    scatterData.length > 0
      ? [...scatterData].map((d) => d.y).sort((a, b) => a - b)[Math.floor(scatterData.length / 2)]
      : 0.5;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Cost vs Accuracy</h2>
        <p className="text-slate-500 mt-1">
          Compare models by extraction accuracy (Y) and average cost per run (X). Toggle models below to focus the comparison.
        </p>
      </div>

      {/* Filters Bar */}
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
                  <button key={id} type="button" onClick={() => toggleId(id, selectedModelIds, setSelectedModelIds)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left">
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
                  <button key={id} type="button" onClick={() => toggleId(id, selectedPromptIds, setSelectedPromptIds)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left">
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
                  <button key={id} type="button" onClick={() => toggleId(id, selectedReceiptIds, setSelectedReceiptIds)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left">
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

      {scatterData.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-chart-scatter text-3xl text-slate-400" />
          </div>
          <p className="text-slate-500 font-medium">No data to plot</p>
          <p className="text-sm text-slate-400 mt-1">
            {uniqueModelIds.length === 0
              ? 'Run a benchmark to see cost vs accuracy per model.'
              : 'Select at least one model above to show it on the chart.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Accuracy (Y) vs Avg cost per run in USD (X) · Top-left = best value
            </p>
          </div>
          <div className="p-4 md:p-6">
            <div className="h-[420px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="Cost (USD)"
                    unit=""
                    domain={[costMin, costMax]}
                    tickFormatter={(v) => `$${v.toFixed(4)}`}
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="Accuracy"
                    domain={[0, 1]}
                    tickFormatter={(v) => `${Math.round(v * 100)}%`}
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                  />
                  <ZAxis range={[80, 400]} />
                  {/* “Most attractive” quadrant: high accuracy, low cost */}
                  <ReferenceArea
                    x1={costMin}
                    x2={medianCost}
                    y1={medianAcc}
                    y2={1}
                    fill="#dcfce7"
                    fillOpacity={0.4}
                    strokeOpacity={0}
                  />
                  {scatterData.map((entry) => (
                    <Scatter
                      key={entry.modelId}
                      data={[entry]}
                      fill={entry.color}
                      name={entry.name}
                      shape="circle"
                      legendType="circle"
                    />
                  ))}
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3', stroke: '#94a3b8' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const p = payload[0].payload;
                        return (
                          <div className="bg-white p-4 rounded-xl shadow-xl border border-slate-200 min-w-[180px]">
                            <p className="font-bold text-slate-900 mb-2">{p.name}</p>
                            <p className="text-sm text-slate-600">
                              Accuracy: <span className="font-semibold">{Math.round(p.y * 100)}%</span>
                            </p>
                            <p className="text-sm text-slate-600">
                              Avg cost: <span className="font-semibold">${p.x.toFixed(5)}</span>
                            </p>
                            <p className="text-xs text-slate-400 mt-1">{p.runs} run(s)</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: 12 }}
                    formatter={(value) => value}
                    iconType="circle"
                    iconSize={8}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 text-center">
              Green zone = higher accuracy and lower cost (best value). Points are averaged over all runs per model.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostAccuracyMatrix;
