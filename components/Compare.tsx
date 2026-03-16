import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BenchmarkResult, Prompt, Receipt, ModelId } from '../types';
import { MODEL_CONFIGS } from '../constants';
import { getFlatKeys, getValueByPath, findValueRecursively } from '../utils/evaluator';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine, Cell, LabelList, Legend } from 'recharts';

const getHexColor = (colorClass: string) => {
  if (!colorClass) return '#64748b';
  if (colorClass.includes('blue')) return '#3b82f6';
  if (colorClass.includes('cyan')) return '#06b6d4';
  if (colorClass.includes('indigo')) return '#6366f1';
  if (colorClass.includes('sky')) return '#0ea5e9';
  if (colorClass.includes('violet')) return '#8b5cf6';
  if (colorClass.includes('fuchsia')) return '#d946ef';
  if (colorClass.includes('green')) return '#22c55e';
  if (colorClass.includes('orange')) return '#f97316';
  if (colorClass.includes('red')) return '#ef4444';
  if (colorClass.includes('amber')) return '#f59e0b';
  return '#64748b';
};

const CustomLabel = (props: any) => {
  const { x, y, value, positionsRef, occupiedRef } = props;
  if (x == null || y == null || !value) return null;

  const charWidth = 6.5;
  const textWidth = value.length * charWidth;
  const textHeight = 16;

  let finalPos = positionsRef?.current?.[value];

  if (!finalPos && positionsRef && occupiedRef) {
    const positions = [
      { dx: 12, dy: 0, anchor: 'start' },
      { dx: -12, dy: 0, anchor: 'end' },
      { dx: 0, dy: -16, anchor: 'middle' },
      { dx: 0, dy: 16, anchor: 'middle' },
      { dx: 12, dy: -14, anchor: 'start' },
      { dx: 12, dy: 14, anchor: 'start' },
      { dx: -12, dy: -14, anchor: 'end' },
      { dx: -12, dy: 14, anchor: 'end' },
      { dx: 24, dy: 0, anchor: 'start' },
      { dx: -24, dy: 0, anchor: 'end' },
      { dx: 0, dy: -28, anchor: 'middle' },
      { dx: 0, dy: 28, anchor: 'middle' },
    ];

    let found = false;

    for (const pos of positions) {
      let boxX = x + pos.dx;
      let boxY = y + pos.dy;

      if (pos.anchor === 'start') {
        // boxX is left edge
      } else if (pos.anchor === 'end') {
        boxX -= textWidth;
      } else {
        boxX -= textWidth / 2;
      }
      
      const boxTop = boxY - textHeight / 2;

      const padding = 4;
      const isCollision = occupiedRef.current.some((rect: any) => {
        return !(
          boxX + textWidth + padding < rect.x ||
          boxX - padding > rect.x + rect.w ||
          boxTop + textHeight + padding < rect.y ||
          boxTop - padding > rect.y + rect.h
        );
      });

      if (!isCollision) {
        finalPos = pos;
        found = true;
        occupiedRef.current.push({ x: boxX, y: boxTop, w: textWidth, h: textHeight });
        break;
      }
    }

    if (!found) {
      finalPos = positions[0];
    }
    
    positionsRef.current[value] = finalPos;
  }

  if (!finalPos) {
    finalPos = { dx: 12, dy: 0, anchor: 'start' };
  }

  return (
    <g>
      {(Math.abs(finalPos.dx) > 12 || Math.abs(finalPos.dy) > 12) && (
        <line x1={x} y1={y} x2={x + finalPos.dx} y2={y + finalPos.dy} stroke="#94a3b8" strokeWidth={1} strokeDasharray="2 2" />
      )}
      <text 
        x={x + finalPos.dx} 
        y={y + finalPos.dy} 
        fill="#475569" 
        fontSize={11} 
        fontWeight={600} 
        textAnchor={finalPos.anchor as any} 
        dominantBaseline="central" 
        stroke="#ffffff" 
        strokeWidth={4} 
        strokeLinejoin="round"
      >
        {value}
      </text>
      <text 
        x={x + finalPos.dx} 
        y={y + finalPos.dy} 
        fill="#475569" 
        fontSize={11} 
        fontWeight={600} 
        textAnchor={finalPos.anchor as any} 
        dominantBaseline="central"
      >
        {value}
      </text>
    </g>
  );
};

interface CompareProps {
  results: BenchmarkResult[];
  prompts: Prompt[];
  receipts: Receipt[];
  customModels: Record<string, any>;
}

const Compare: React.FC<CompareProps> = ({ results, prompts, receipts, customModels }) => {
  const allConfigs = { ...MODEL_CONFIGS, ...customModels };

  const [filterModels, setFilterModels] = useState<string[]>([]);
  const [filterPrompts, setFilterPrompts] = useState<string[]>([]);
  const [filterReceipts, setFilterReceipts] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<'all' | '30d' | '7d' | '24h'>('all');
  const [xAxisMetric, setXAxisMetric] = useState<'cost' | 'latency'>('cost');
  const [useLogScale, setUseLogScale] = useState(false);
  const [baselineModelId, setBaselineModelId] = useState<string | null>(null);

  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isPromptMenuOpen, setIsPromptMenuOpen] = useState(false);
  const [isReceiptMenuOpen, setIsReceiptMenuOpen] = useState(false);
  
  const modelMenuRef = useRef<HTMLDivElement | null>(null);
  const promptMenuRef = useRef<HTMLDivElement | null>(null);
  const receiptMenuRef = useRef<HTMLDivElement | null>(null);

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

  // Find unique values that have results
  const uniqueModelIds = useMemo(() => Array.from(new Set(results.map(r => r.modelId))), [results]);
  const uniquePromptIds = useMemo(() => Array.from(new Set(results.map(r => r.promptId))), [results]);
  const uniqueReceiptIds = useMemo(() => Array.from(new Set(results.map(r => r.receiptId))), [results]);

  // Default to everything selected when first loading
  const hasInitializedModels = useRef(false);
  const hasInitializedPrompts = useRef(false);
  const hasInitializedReceipts = useRef(false);

  useEffect(() => {
    if (uniqueModelIds.length > 0 && !hasInitializedModels.current) {
      setFilterModels([...uniqueModelIds]);
      hasInitializedModels.current = true;
    }
  }, [uniqueModelIds]);
  
  useEffect(() => {
    if (uniquePromptIds.length > 0 && !hasInitializedPrompts.current) {
      setFilterPrompts([...uniquePromptIds]);
      hasInitializedPrompts.current = true;
    }
  }, [uniquePromptIds]);
  
  useEffect(() => {
    if (uniqueReceiptIds.length > 0 && !hasInitializedReceipts.current) {
      setFilterReceipts([...uniqueReceiptIds]);
      hasInitializedReceipts.current = true;
    }
  }, [uniqueReceiptIds]);

  const allModelsSelected = uniqueModelIds.length > 0 && filterModels.length === uniqueModelIds.length;
  const allPromptsSelected = uniquePromptIds.length > 0 && filterPrompts.length === uniquePromptIds.length;
  const allReceiptsSelected = uniqueReceiptIds.length > 0 && filterReceipts.length === uniqueReceiptIds.length;

  const toggleModelFilter = (id: string) => {
    setFilterModels(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const togglePromptFilter = (id: string) => {
    setFilterPrompts(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const toggleReceiptFilter = (id: string) => {
    setFilterReceipts(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const toggleAllModels = () => {
    if (uniqueModelIds.length === 0) return;
    setFilterModels(prev => (prev.length === uniqueModelIds.length ? [] : [...uniqueModelIds]));
  };

  const toggleAllPrompts = () => {
    if (uniquePromptIds.length === 0) return;
    setFilterPrompts(prev => (prev.length === uniquePromptIds.length ? [] : [...uniquePromptIds]));
  };

  const toggleAllReceipts = () => {
    if (uniqueReceiptIds.length === 0) return;
    setFilterReceipts(prev => (prev.length === uniqueReceiptIds.length ? [] : [...uniqueReceiptIds]));
  };

  const resetFilters = () => {
    setFilterModels(uniqueModelIds);
    setFilterPrompts(uniquePromptIds);
    setFilterReceipts(uniqueReceiptIds);
    setDateRange('all');
  };

  // Filter results based on selection
  const comparisonResults = useMemo(() => {
    if (filterModels.length === 0 || filterPrompts.length === 0 || filterReceipts.length === 0) return [];
    
    const now = Date.now();
    const rangeMs =
      dateRange === '30d' ? 30 * 24 * 60 * 60 * 1000 :
      dateRange === '7d' ? 7 * 24 * 60 * 60 * 1000 :
      dateRange === '24h' ? 24 * 60 * 60 * 1000 :
      null;

    // Filter all results by the selected criteria
    const validResults = results.filter(r => {
      if (!filterModels.includes(r.modelId)) return false;
      if (!filterPrompts.includes(r.promptId)) return false;
      if (!filterReceipts.includes(r.receiptId)) return false;
      if (rangeMs != null && now - r.timestamp > rangeMs) return false;
      return true;
    });

    // Aggregate metrics per model
    const modelAggregates = filterModels.map(modelId => {
      const modelResults = validResults.filter(r => r.modelId === modelId);
      if (modelResults.length === 0) return null;

      const avgAccuracy = modelResults.reduce((acc, r) => acc + r.metrics.accuracy, 0) / modelResults.length;
      const avgLatency = modelResults.reduce((acc, r) => acc + r.metrics.latencyMs, 0) / modelResults.length;
      const avgCost = modelResults.reduce((acc, r) => acc + r.metrics.costUsd, 0) / modelResults.length;

      // We need to return an object that looks like a BenchmarkResult for the UI, 
      // or we can just return the aggregate data. The UI expects a result object.
      // We'll return the latest result for the "outputJson" if we need it, but for metrics we use averages.
      const latestResult = [...modelResults].sort((a, b) => b.timestamp - a.timestamp)[0];

      return {
        ...latestResult,
        metrics: {
          ...latestResult.metrics,
          accuracy: avgAccuracy,
          latencyMs: avgLatency,
          costUsd: avgCost
        },
        runCount: modelResults.length
      };
    }).filter(Boolean) as (BenchmarkResult & { runCount: number })[];
    
    return modelAggregates;
  }, [results, filterModels, filterPrompts, filterReceipts, dateRange]);

  const selectedReceipt = filterReceipts.length === 1 ? receipts.find(r => r.id === filterReceipts[0]) : null;
  
  let groundTruth: any = {};
  let keys: string[] = [];
  if (selectedReceipt) {
    try {
      groundTruth = JSON.parse(selectedReceipt.groundTruthJson);
      keys = getFlatKeys(groundTruth);
    } catch (e) {
      // ignore
    }
  }

  const getAccuracyColor = (score: number) => {
    if (score >= 0.9) return 'text-emerald-600 bg-emerald-50';
    if (score >= 0.7) return 'text-amber-600 bg-amber-50';
    return 'text-rose-600 bg-rose-50';
  };

  const chartData = useMemo(() => {
    return comparisonResults.map(r => {
      const config = allConfigs[r.modelId] || { name: r.modelId, color: 'bg-slate-100 text-slate-700' };
      return {
        id: r.modelId,
        name: config.name,
        cost: Math.max(r.metrics.costUsd, 0.00001),
        latency: Math.max(r.metrics.latencyMs / 1000, 0.001),
        accuracy: Math.round(r.metrics.accuracy * 100),
        color: getHexColor(config.color || '')
      };
    });
  }, [comparisonResults, allConfigs]);

  const labelPositionsRef = useRef<Record<string, {dx: number, dy: number, anchor: string}>>({});
  const occupiedSpacesRef = useRef<{x: number, y: number, w: number, h: number}[]>([]);

  useEffect(() => {
    labelPositionsRef.current = {};
    occupiedSpacesRef.current = [];
  }, [chartData, xAxisMetric, useLogScale]);

  const avgCost = chartData.length > 0 ? chartData.reduce((acc, curr) => acc + curr.cost, 0) / chartData.length : 0;
  const avgLatency = chartData.length > 0 ? chartData.reduce((acc, curr) => acc + curr.latency, 0) / chartData.length : 0;
  const avgAccuracy = chartData.length > 0 ? chartData.reduce((acc, curr) => acc + curr.accuracy, 0) / chartData.length : 0;
  
  const currentAvgX = xAxisMetric === 'cost' ? avgCost : avgLatency;

  const getPrompt = (id: string) => prompts.find(p => p.id === id);
  const getPromptName = (id: string) => {
    const p = getPrompt(id);
    return p ? `${p.name} (v${p.version})` : 'Unknown Prompt';
  };
  const getReceipt = (id: string) => receipts.find(r => r.id === id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Compare Models</h2>
        <p className="text-slate-500 mt-1">Compare model performance and extraction results across your dataset.</p>
      </div>

      {results.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl md:rounded-2xl shadow-sm px-3 md:px-4 py-3 flex flex-wrap items-center gap-3">
          <div ref={modelMenuRef} className="relative flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">Models:</span>
            <button
              type="button"
              onClick={() => setIsModelMenuOpen(prev => !prev)}
              className="text-xs md:text-sm font-medium text-slate-700 min-w-44 inline-flex items-center justify-between gap-3"
            >
              <span>{allModelsSelected ? `All Models (${uniqueModelIds.length})` : `${filterModels.length} selected`}</span>
              <i className={`fas fa-chevron-${isModelMenuOpen ? 'up' : 'down'} text-[10px] text-slate-400`} />
            </button>
            {isModelMenuOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-20">
                <button type="button" onClick={toggleAllModels} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left">
                  <input type="checkbox" checked={allModelsSelected} readOnly className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm font-medium text-slate-700">Select all</span>
                </button>
                <div className="my-1 border-t border-slate-100" />
                <div className="max-h-52 overflow-y-auto pr-1 space-y-0.5">
                  {uniqueModelIds.map(id => (
                    <button key={id} type="button" onClick={() => toggleModelFilter(id)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left">
                      <input type="checkbox" checked={filterModels.includes(id)} readOnly className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-slate-700 truncate">{(allConfigs[id] || { name: id }).name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div ref={promptMenuRef} className="relative flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 ml-auto">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">Prompts:</span>
            <button
              type="button"
              onClick={() => setIsPromptMenuOpen(prev => !prev)}
              className="text-xs md:text-sm font-medium text-slate-700 min-w-40 inline-flex items-center justify-between gap-3"
            >
              <span>{allPromptsSelected ? `All Prompts (${uniquePromptIds.length})` : `${filterPrompts.length} selected`}</span>
              <i className={`fas fa-chevron-${isPromptMenuOpen ? 'up' : 'down'} text-[10px] text-slate-400`} />
            </button>
            {isPromptMenuOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-20">
                <button type="button" onClick={toggleAllPrompts} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left">
                  <input type="checkbox" checked={allPromptsSelected} readOnly className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm font-medium text-slate-700">Select all</span>
                </button>
                <div className="my-1 border-t border-slate-100" />
                <div className="max-h-52 overflow-y-auto pr-1 space-y-0.5">
                  {uniquePromptIds.map(id => (
                    <button key={id} type="button" onClick={() => togglePromptFilter(id)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left">
                      <input type="checkbox" checked={filterPrompts.includes(id)} readOnly className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-slate-700 truncate">{getPromptName(id)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div ref={receiptMenuRef} className="relative flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">Receipts:</span>
            <button
              type="button"
              onClick={() => setIsReceiptMenuOpen(prev => !prev)}
              className="text-xs md:text-sm font-medium text-slate-700 min-w-40 inline-flex items-center justify-between gap-3"
            >
              <span>{allReceiptsSelected ? `All Receipts (${uniqueReceiptIds.length})` : `${filterReceipts.length} selected`}</span>
              <i className={`fas fa-chevron-${isReceiptMenuOpen ? 'up' : 'down'} text-[10px] text-slate-400`} />
            </button>
            {isReceiptMenuOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-20">
                <button type="button" onClick={toggleAllReceipts} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left">
                  <input type="checkbox" checked={allReceiptsSelected} readOnly className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm font-medium text-slate-700">Select all</span>
                </button>
                <div className="my-1 border-t border-slate-100" />
                <div className="max-h-52 overflow-y-auto pr-1 space-y-0.5">
                  {uniqueReceiptIds.map(id => (
                    <button key={id} type="button" onClick={() => toggleReceiptFilter(id)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left">
                      <input type="checkbox" checked={filterReceipts.includes(id)} readOnly className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-slate-700 truncate">{getReceipt(id)?.name || 'Unknown Receipt'}</span>
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

          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">Baseline:</span>
            <select
              className="bg-transparent border-none text-xs md:text-sm font-medium focus:ring-0 p-0 pr-6 cursor-pointer"
              value={baselineModelId || ''}
              onChange={e => setBaselineModelId(e.target.value || null)}
            >
              <option value="">None</option>
              {filterModels.map(id => (
                <option key={id} value={id}>{(allConfigs[id] || { name: id }).name}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-bold text-rose-500 hover:underline ml-auto"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
          <p className="text-slate-500">No benchmark results available to compare.</p>
        </div>
      )}

      {comparisonResults.length > 0 && (
        <div className="space-y-6">
          {/* Scatter Plot Quadrants */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Accuracy vs. {xAxisMetric === 'cost' ? 'Cost' : 'Inference Time'}</h3>
                <p className="text-xs text-slate-500 mt-1">Compare model performance against execution {xAxisMetric === 'cost' ? 'cost' : 'time'}.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <button 
                    onClick={() => setXAxisMetric('cost')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${xAxisMetric === 'cost' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Cost
                  </button>
                  <button 
                    onClick={() => setXAxisMetric('latency')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${xAxisMetric === 'latency' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Inference Time
                  </button>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <button 
                    onClick={() => setUseLogScale(!useLogScale)}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${useLogScale ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Log Scale
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                  <span className="w-3 h-3 bg-[#dcfce7] border border-[#bbf7d0] rounded-sm"></span>
                  Most attractive quadrant
                </div>
              </div>
            </div>
            
            <div className="h-[450px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 150, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis 
                    type="number" 
                    dataKey={xAxisMetric}
                    name={xAxisMetric === 'cost' ? 'Cost' : 'Inference Time'}
                    unit={xAxisMetric === 'cost' ? '$' : 's'}
                    stroke="#94a3b8"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(val) => xAxisMetric === 'cost' ? `$${val.toFixed(4)}` : `${val.toFixed(2)}s`}
                    scale={useLogScale ? 'log' : 'linear'}
                    domain={useLogScale ? [(dataMin: number) => dataMin / 2, (dataMax: number) => dataMax * 2] : [0, 'auto']}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="accuracy" 
                    name="Accuracy" 
                    unit="%" 
                    stroke="#94a3b8"
                    tick={{ fontSize: 12 }}
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-lg">
                            <p className="font-bold text-sm text-slate-800">{data.name}</p>
                            <div className="mt-2 space-y-1">
                              <p className="text-xs text-slate-600 flex justify-between gap-4">
                                <span>Accuracy:</span> <span className="font-bold text-slate-900">{data.accuracy}%</span>
                              </p>
                              <p className="text-xs text-slate-600 flex justify-between gap-4">
                                <span>{xAxisMetric === 'cost' ? 'Cost:' : 'Inference Time:'}</span> 
                                <span className="font-bold text-slate-900">
                                  {xAxisMetric === 'cost' ? `$${data.cost.toFixed(5)}` : `${data.latency.toFixed(2)}s`}
                                </span>
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  
                  {chartData.length > 0 && (
                    <>
                      {/* Top-Left Quadrant: High Accuracy, Low Cost/Latency */}
                      <ReferenceArea 
                        x1={useLogScale ? (xAxisMetric === 'cost' ? 0.00001 : 0.001) : 0} 
                        x2={currentAvgX} 
                        y1={avgAccuracy} 
                        y2={100} 
                        fill="#dcfce7" 
                        fillOpacity={0.6} 
                      />
                      {/* Quadrant dividers */}
                      <ReferenceLine x={currentAvgX} stroke="#cbd5e1" strokeDasharray="3 3" />
                      <ReferenceLine y={avgAccuracy} stroke="#cbd5e1" strokeDasharray="3 3" />
                    </>
                  )}
                  
                  {chartData.map((entry) => (
                    <Scatter key={entry.id} name={entry.name} data={[entry]} fill={entry.color}>
                      <LabelList dataKey="name" content={(props: any) => <CustomLabel {...props} positionsRef={labelPositionsRef} occupiedRef={occupiedSpacesRef} />} />
                    </Scatter>
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Metrics Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {comparisonResults.map(result => {
              const config = allConfigs[result.modelId] || { name: result.modelId };
              
              let accuracyDelta = null;
              let latencyDelta = null;
              let costDelta = null;
              
              if (baselineModelId && baselineModelId !== result.modelId) {
                const baselineResult = comparisonResults.find(r => r.modelId === baselineModelId);
                if (baselineResult) {
                  accuracyDelta = (result.metrics.accuracy - baselineResult.metrics.accuracy) * 100;
                  
                  // Calculate percentage differences
                  if (baselineResult.metrics.latencyMs > 0) {
                    latencyDelta = ((result.metrics.latencyMs - baselineResult.metrics.latencyMs) / baselineResult.metrics.latencyMs) * 100;
                  } else {
                    latencyDelta = 0;
                  }
                  
                  if (baselineResult.metrics.costUsd > 0) {
                    costDelta = ((result.metrics.costUsd - baselineResult.metrics.costUsd) / baselineResult.metrics.costUsd) * 100;
                  } else {
                    costDelta = 0;
                  }
                }
              }
              
              return (
                <div key={result.id} className={`bg-white border ${baselineModelId === result.modelId ? 'border-indigo-400 shadow-md ring-1 ring-indigo-400' : 'border-slate-200 shadow-sm'} rounded-2xl p-4 flex flex-col gap-3 relative`}>
                  {baselineModelId === result.modelId && (
                    <div className="absolute -top-2.5 right-4 bg-indigo-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Baseline
                    </div>
                  )}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="font-bold text-slate-800 text-sm">{config.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-medium">({result.runCount} runs)</span>
                      <div className="flex flex-col items-end">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${getAccuracyColor(result.metrics.accuracy)}`}>
                          {Math.round(result.metrics.accuracy * 100)}% Match
                        </span>
                        {accuracyDelta !== null && (
                          <span className={`text-[10px] font-bold mt-1 ${accuracyDelta > 0 ? 'text-emerald-500' : accuracyDelta < 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                            {accuracyDelta > 0 ? '+' : ''}{accuracyDelta.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-50 p-2 rounded-lg flex flex-col justify-between">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Avg Inference Time</p>
                      <div className="flex items-end justify-between mt-1">
                        <p className="text-sm font-bold text-slate-700">{(result.metrics.latencyMs / 1000).toFixed(2)}s</p>
                        {latencyDelta !== null && (
                          <span className={`text-[10px] font-bold ${latencyDelta < 0 ? 'text-emerald-500' : latencyDelta > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                            {latencyDelta > 0 ? '+' : ''}{latencyDelta.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg flex flex-col justify-between">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Avg Cost</p>
                      <div className="flex items-end justify-between mt-1">
                        <p className="text-sm font-bold text-slate-700">${result.metrics.costUsd.toFixed(5)}</p>
                        {costDelta !== null && (
                          <span className={`text-[10px] font-bold ${costDelta < 0 ? 'text-emerald-500' : costDelta > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                            {costDelta > 0 ? '+' : ''}{costDelta.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Field-by-Field Comparison */}
          {selectedReceipt ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50">
                <h3 className="text-sm font-bold text-slate-800">Field-by-Field Comparison</h3>
                <p className="text-xs text-slate-500 mt-1">Showing latest run for exactly one selected receipt.</p>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-max">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50 z-10 border-r border-slate-200">Field Path</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border-r border-slate-200">Ground Truth</th>
                      {comparisonResults.map(result => {
                        const config = allConfigs[result.modelId] || { name: result.modelId };
                        return (
                          <th key={result.id} className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
                            {config.name}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {keys.map(key => {
                      const expectedVal = getValueByPath(groundTruth, key);
                      
                      return (
                        <tr key={key} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-500 sticky left-0 bg-white group-hover:bg-slate-50 border-r border-slate-200 z-10">
                            {key}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-800 border-r border-slate-200 bg-slate-50/30">
                            {String(expectedVal)}
                          </td>
                          {comparisonResults.map(result => {
                            let actual: any = {};
                            try {
                              actual = JSON.parse(result.outputJson);
                            } catch (e) {}
                            
                            const actualRaw = findValueRecursively(actual, key);
                            let actualVal = actualRaw;
                            if (actualRaw && typeof actualRaw === 'object' && 'value' in actualRaw) {
                              actualVal = actualRaw.value;
                            }

                            const isMatch = actualVal !== undefined && actualVal !== null && 
                              String(expectedVal).toLowerCase().trim() === String(actualVal).toLowerCase().trim();

                            return (
                              <td key={result.id} className={`px-4 py-3 text-sm text-center ${isMatch ? 'bg-emerald-50/20' : 'bg-rose-50/20'}`}>
                                <div className="flex flex-col items-center gap-1">
                                  <span className={`font-medium ${isMatch ? 'text-emerald-700' : 'text-rose-600'}`}>
                                    {actualVal === undefined ? <span className="text-slate-300 italic">undefined</span> : (actualVal === null ? <span className="text-slate-300 italic">null</span> : String(actualVal))}
                                  </span>
                                  {isMatch ? (
                                    <i className="fas fa-check-circle text-emerald-500 text-[10px]"></i>
                                  ) : (
                                    <i className="fas fa-times-circle text-rose-500 text-[10px]"></i>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-8 text-center">
              <i className="fas fa-table-list text-3xl text-slate-300 mb-3"></i>
              <p className="text-sm font-bold text-slate-700">Field-by-Field Comparison Unavailable</p>
              <p className="text-xs text-slate-500 mt-1">Select exactly one receipt to view the field-by-field extraction breakdown.</p>
            </div>
          )}
        </div>
      )}
      
      {comparisonResults.length === 0 && filterModels.length > 0 && (
        <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl">
          <i className="fas fa-inbox text-4xl text-slate-300 mb-3"></i>
          <p className="text-slate-500 font-medium">No comparison data available for the selected filters.</p>
        </div>
      )}
    </div>
  );
};

export default Compare;
