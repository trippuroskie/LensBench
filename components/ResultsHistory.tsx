
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BenchmarkResult, Prompt, Receipt, ModelId } from '../types';
import { MODEL_CONFIGS } from '../constants';
import { getFlatKeys, getValueByPath, findValueRecursively } from '../utils/evaluator';
import { OpenRouterService } from '../services/openrouter';

interface ResultsHistoryProps {
  results: BenchmarkResult[];
  prompts: Prompt[];
  receipts: Receipt[];
  customModels: Record<string, any>;
  onClear: () => void;
}

const ResultsHistory: React.FC<ResultsHistoryProps> = ({ results, prompts, receipts, customModels, onClear }) => {
  const [selectedResult, setSelectedResult] = useState<BenchmarkResult | null>(null);
  const [refinement, setRefinement] = useState<string | null>(null);
  const [isRefining, setIsRefining] = useState(false);

  const allConfigs = { ...MODEL_CONFIGS, ...customModels };

  // Filters
  const [filterModels, setFilterModels] = useState<ModelId[]>([]);
  const [filterPrompts, setFilterPrompts] = useState<string[]>([]);
  const [filterReceipts, setFilterReceipts] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<'all' | '30d' | '7d' | '24h'>('all');
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isPromptMenuOpen, setIsPromptMenuOpen] = useState(false);
  const [isReceiptMenuOpen, setIsReceiptMenuOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement | null>(null);
  const promptMenuRef = useRef<HTMLDivElement | null>(null);
  const receiptMenuRef = useRef<HTMLDivElement | null>(null);
  
  // Helpers
  const getPrompt = (id: string) => prompts.find(p => p.id === id);
  const getPromptName = (id: string) => {
    const p = getPrompt(id);
    return p ? `${p.name} (v${p.version})` : 'Unknown Prompt';
  };
  const getReceipt = (id: string) => receipts.find(r => r.id === id);

  // Derived Data
  const filteredResults = useMemo(() => {
    const now = Date.now();
    const rangeMs =
      dateRange === '30d' ? 30 * 24 * 60 * 60 * 1000 :
      dateRange === '7d' ? 7 * 24 * 60 * 60 * 1000 :
      dateRange === '24h' ? 24 * 60 * 60 * 1000 :
      null;

    return results.filter(r => {
      if (filterModels.length > 0 && !filterModels.includes(r.modelId)) return false;
      if (filterPrompts.length > 0 && !filterPrompts.includes(r.promptId)) return false;
      if (filterReceipts.length > 0 && !filterReceipts.includes(r.receiptId)) return false;
      if (rangeMs != null && now - r.timestamp > rangeMs) return false;
      return true;
    });
  }, [results, filterModels, filterPrompts, filterReceipts, dateRange]);

  const uniqueModelIds = useMemo(() => Array.from(new Set(results.map(r => r.modelId))), [results]);
  const uniquePromptIds = useMemo(() => Array.from(new Set(results.map(r => r.promptId))), [results]);
  const uniqueReceiptIds = useMemo(() => Array.from(new Set(results.map(r => r.receiptId))), [results]);

  const allModelsSelected = uniqueModelIds.length > 0 && filterModels.length === uniqueModelIds.length;
  const allPromptsSelected = uniquePromptIds.length > 0 && filterPrompts.length === uniquePromptIds.length;
  const allReceiptsSelected = uniqueReceiptIds.length > 0 && filterReceipts.length === uniqueReceiptIds.length;

  useEffect(() => {
    setFilterModels(prev => {
      if (uniqueModelIds.length === 0) return [];
      const next = prev.filter(id => uniqueModelIds.includes(id));
      return next.length ? next : uniqueModelIds;
    });
  }, [uniqueModelIds]);

  useEffect(() => {
    setFilterPrompts(prev => {
      if (uniquePromptIds.length === 0) return [];
      const next = prev.filter(id => uniquePromptIds.includes(id));
      return next.length ? next : uniquePromptIds;
    });
  }, [uniquePromptIds]);

  useEffect(() => {
    setFilterReceipts(prev => {
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
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isModelMenuOpen, isPromptMenuOpen, isReceiptMenuOpen]);

  const stats = useMemo(() => {
    if (filteredResults.length === 0) return { accuracy: 0, latency: 0, cost: 0 };
    const total = filteredResults.reduce((acc, r) => ({
      accuracy: acc.accuracy + r.metrics.accuracy,
      latency: acc.latency + r.metrics.latencyMs,
      cost: acc.cost + r.metrics.costUsd
    }), { accuracy: 0, latency: 0, cost: 0 });
    
    return {
      accuracy: total.accuracy / filteredResults.length,
      latency: total.latency / filteredResults.length,
      cost: total.cost / filteredResults.length
    };
  }, [filteredResults]);

  // Actions
  const toggleModelFilter = (id: ModelId) => {
    setFilterModels(prev => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter(m => m !== id) : prev;
      }
      return [...prev, id];
    });
  };

  const togglePromptFilter = (id: string) => {
    setFilterPrompts(prev => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter(p => p !== id) : prev;
      }
      return [...prev, id];
    });
  };

  const toggleReceiptFilter = (id: string) => {
    setFilterReceipts(prev => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter(r => r !== id) : prev;
      }
      return [...prev, id];
    });
  };

  const toggleAllModels = () => {
    if (uniqueModelIds.length === 0) return;
    setFilterModels(prev => (prev.length === uniqueModelIds.length ? [uniqueModelIds[0]] : uniqueModelIds));
  };

  const toggleAllPrompts = () => {
    if (uniquePromptIds.length === 0) return;
    setFilterPrompts(prev => (prev.length === uniquePromptIds.length ? [uniquePromptIds[0]] : uniquePromptIds));
  };

  const toggleAllReceipts = () => {
    if (uniqueReceiptIds.length === 0) return;
    setFilterReceipts(prev => (prev.length === uniqueReceiptIds.length ? [uniqueReceiptIds[0]] : uniqueReceiptIds));
  };

  const resetFilters = () => {
    setFilterModels(uniqueModelIds);
    setFilterPrompts(uniquePromptIds);
    setFilterReceipts(uniqueReceiptIds);
    setDateRange('all');
  };

  const handleRefine = async () => {
    if (!selectedResult) return;
    const prompt = getPrompt(selectedResult.promptId);
    const receipt = getReceipt(selectedResult.receiptId);
    if (!prompt || !receipt) return;

    setIsRefining(true);
    try {
      const ocrService = new OpenRouterService();
      const suggestion = await ocrService.refinePrompt(
        prompt.content,
        receipt.groundTruthJson,
        selectedResult.outputJson
      );
      setRefinement(suggestion);
    } catch (error) {
      console.error("Refinement failed:", error);
      alert("Failed to generate suggestions.");
    } finally {
      setIsRefining(false);
    }
  };

  const getAccuracyColor = (score: number) => {
    if (score >= 0.9) return 'text-emerald-600 bg-emerald-50';
    if (score >= 0.7) return 'text-amber-600 bg-amber-50';
    return 'text-rose-600 bg-rose-50';
  };

  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.9) return 'bg-emerald-500';
    if (conf >= 0.7) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Benchmark History</h2>
          <p className="text-slate-500 mt-1">Detailed breakdown of every OCR extraction attempt.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {filteredResults.length > 0 && (
            <div className="flex gap-3">
              <div className="bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100 flex flex-col items-start min-w-[100px]">
                 <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Avg Accuracy</span>
                 <span className="text-lg font-bold text-emerald-700">{Math.round(stats.accuracy * 100)}%</span>
              </div>
              <div className="bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100 flex flex-col items-start min-w-[100px]">
                 <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Avg Inference Time</span>
                 <span className="text-lg font-bold text-indigo-700">{(stats.latency / 1000).toFixed(2)}s</span>
              </div>
              <div className="bg-amber-50 px-4 py-2 rounded-lg border border-amber-100 flex flex-col items-start min-w-[100px]">
                 <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Avg Cost</span>
                 <span className="text-lg font-bold text-amber-700">${stats.cost.toFixed(5)}</span>
              </div>
            </div>
          )}
          <button 
            onClick={onClear}
            className="ml-auto md:ml-0 text-slate-400 hover:text-rose-500 font-bold text-sm flex items-center gap-2 transition-colors px-3 py-2"
          >
            <i className="fas fa-trash-can"></i> Clear
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      {results.length > 0 && (
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

          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-bold text-rose-500 hover:underline ml-auto"
          >
            Reset Filters
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Model / Time</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Prompt & Receipt</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Accuracy</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Inference Time</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Cost</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredResults.map(result => {
                const modelConfig = allConfigs[result.modelId] || { name: result.modelId, color: 'bg-slate-50 text-slate-500 border-slate-200' };
                return (
                  <tr key={result.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`px-2 py-1 rounded text-[9px] font-bold border ${modelConfig.color}`}>
                          {modelConfig.name}
                        </div>
                        <span className="text-xs text-slate-400 font-mono">
                          {new Date(result.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-800 truncate max-w-[200px]">{getPromptName(result.promptId)}</p>
                      <p className="text-[11px] text-slate-400 italic truncate max-w-[200px]">{getReceipt(result.receiptId)?.name}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${getAccuracyColor(result.metrics.accuracy)}`}>
                        {Math.round(result.metrics.accuracy * 100)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-medium text-slate-600">{(result.metrics.latencyMs / 1000).toFixed(2)}s</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-bold text-slate-900">${result.metrics.costUsd.toFixed(5)}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => {
                          setSelectedResult(result);
                          setRefinement(null);
                        }}
                        className="text-indigo-600 hover:text-indigo-800 font-bold text-xs bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredResults.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-400 italic">
                    {results.length > 0 ? 'No results match your filters.' : 'No results yet. Run a benchmark to see history.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comparison Modal (Unchanged) */}
      {selectedResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white rounded-[2rem] w-full max-w-6xl h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${getAccuracyColor(selectedResult.metrics.accuracy)}`}>
                  {Math.round(selectedResult.metrics.accuracy * 100)}% Match
                </div>
                <h3 className="text-xl font-bold text-slate-900">Analysis: {getReceipt(selectedResult.receiptId)?.name}</h3>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleRefine}
                  disabled={isRefining || refinement !== null}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-md ${
                    isRefining || refinement !== null
                    ? 'bg-slate-100 text-slate-400'
                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  }`}
                >
                  {isRefining ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-wand-magic-sparkles"></i>}
                  {isRefining ? 'Analyzing Accuracy...' : (refinement ? 'Suggestions Ready' : 'Refine Prompt')}
                </button>
                <button 
                  onClick={() => setSelectedResult(null)} 
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors"
                >
                  <i className="fas fa-times text-slate-500"></i>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
              {/* Receipt Preview */}
              <div className="lg:w-1/3 bg-slate-100 p-6 flex flex-col gap-4 border-r border-slate-200">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Source Receipt</p>
                <div className="flex-1 rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-white">
                  <img 
                    src={getReceipt(selectedResult.receiptId)?.imageUrl} 
                    className="w-full h-full object-contain" 
                    alt="Source"
                  />
                </div>
                
                {/* Refinement Suggestions Panel */}
                {refinement && (
                  <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 animate-in slide-in-from-bottom duration-300 overflow-y-auto max-h-[300px] custom-scrollbar">
                    <h4 className="text-amber-800 font-bold text-sm mb-3 flex items-center gap-2">
                      <i className="fas fa-lightbulb"></i> AI Refinement Suggestions
                    </h4>
                    <div className="prose prose-sm prose-amber">
                      <div className="text-[12px] leading-relaxed whitespace-pre-wrap text-amber-900/80">
                        {refinement}
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        const newPrompt = refinement.split('### 📝 Proposed Refinement')[1]?.trim();
                        if (newPrompt) {
                          navigator.clipboard.writeText(newPrompt);
                          alert("Refined prompt copied to clipboard!");
                        }
                      }}
                      className="mt-4 w-full bg-amber-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors"
                    >
                      Copy Proposed Prompt
                    </button>
                  </div>
                )}
                
                <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Run Snapshot</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase">Cost</p>
                      <p className="text-sm font-bold text-slate-900">${selectedResult.metrics.costUsd.toFixed(5)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase">Inference Time</p>
                      <p className="text-sm font-bold text-slate-900">{(selectedResult.metrics.latencyMs / 1000).toFixed(2)}s</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Comparison */}
              <div className="lg:w-2/3 p-6 overflow-y-auto custom-scrollbar">
                {(() => {
                  const receipt = getReceipt(selectedResult.receiptId);
                  if (!receipt) return null;
                  
                  let groundTruth: any = {};
                  let actual: any = {};
                  try {
                    groundTruth = JSON.parse(receipt.groundTruthJson);
                    actual = JSON.parse(selectedResult.outputJson);
                  } catch (e) {
                    return <div className="p-10 text-center text-rose-500 font-bold">Error: Failed to parse extraction JSON.</div>;
                  }
                  
                  const keys = getFlatKeys(groundTruth);

                  return (
                    <div className="flex flex-col h-full space-y-6">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Extraction Comparison</p>
                          <div className="flex gap-4">
                            <span className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> High Confidence
                            </span>
                            <span className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                              <span className="w-2 h-2 rounded-full bg-rose-500"></span> Low Confidence
                            </span>
                          </div>
                        </div>
                        
                        <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="bg-slate-100/50 text-left border-b border-slate-200">
                                <th className="px-4 py-3 font-bold text-slate-500">Field Path</th>
                                <th className="px-4 py-3 font-bold text-slate-500">Expected (Ground Truth)</th>
                                <th className="px-4 py-3 font-bold text-slate-500">Actual (LLM Output)</th>
                                <th className="px-4 py-3 font-bold text-slate-500 text-center">Confidence</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {keys.map(key => {
                                const expectedVal = getValueByPath(groundTruth, key);
                                const actualRaw = findValueRecursively(actual, key);
                                
                                let actualVal = actualRaw;
                                let confidence = 0;
                                
                                if (actualRaw && typeof actualRaw === 'object' && 'value' in actualRaw) {
                                  actualVal = actualRaw.value;
                                  confidence = actualRaw.confidence || 0;
                                }

                                const isMatch = actualVal !== undefined && actualVal !== null && 
                                  String(expectedVal).toLowerCase().trim() === String(actualVal).toLowerCase().trim();

                                return (
                                  <tr key={key} className={isMatch ? 'bg-white' : 'bg-rose-50/30'}>
                                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400">{key}</td>
                                    <td className="px-4 py-3 text-slate-700 font-medium">{String(expectedVal)}</td>
                                    <td className="px-4 py-3 font-bold">
                                      <div className="flex items-center gap-2">
                                        {isMatch ? (
                                          <i className="fas fa-check-circle text-emerald-500 text-xs"></i>
                                        ) : (
                                          <i className="fas fa-times-circle text-rose-500 text-xs"></i>
                                        )}
                                        <span className={isMatch ? 'text-slate-900' : 'text-rose-600'}>
                                          {actualVal === undefined ? 'undefined' : (actualVal === null ? 'null' : String(actualVal))}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <div className="flex items-center justify-center gap-2">
                                        <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                          <div 
                                            className={`h-full ${getConfidenceColor(confidence)}`} 
                                            style={{ width: `${confidence * 100}%` }}
                                          ></div>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-500">
                                          {Math.round(confidence * 100)}%
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col">
                         <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Raw JSON Output</p>
                         <div className="flex-1 bg-slate-900 rounded-2xl p-4 overflow-y-auto custom-scrollbar border border-slate-800 shadow-xl">
                            <pre className="text-[12px] text-emerald-400 font-mono leading-relaxed">
                              {JSON.stringify(actual, null, 2)}
                            </pre>
                         </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsHistory;
