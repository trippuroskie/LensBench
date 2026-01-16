
import React, { useState } from 'react';
import { BenchmarkResult, Prompt, Receipt } from '../types';
import { MODEL_CONFIGS } from '../constants';
import { getFlatKeys, getValueByPath, findValueRecursively } from '../utils/evaluator';
import { GeminiOCRService } from '../services/gemini';

interface ResultsHistoryProps {
  results: BenchmarkResult[];
  prompts: Prompt[];
  receipts: Receipt[];
  onClear: () => void;
}

const ResultsHistory: React.FC<ResultsHistoryProps> = ({ results, prompts, receipts, onClear }) => {
  const [selectedResult, setSelectedResult] = useState<BenchmarkResult | null>(null);
  const [refinement, setRefinement] = useState<string | null>(null);
  const [isRefining, setIsRefining] = useState(false);

  const getPrompt = (id: string) => prompts.find(p => p.id === id);
  
  const getPromptName = (id: string) => {
    const p = getPrompt(id);
    return p ? `${p.name} (v${p.version})` : 'Unknown Prompt';
  };

  const getReceipt = (id: string) => {
    return receipts.find(r => r.id === id);
  };

  const handleRefine = async () => {
    if (!selectedResult) return;
    const prompt = getPrompt(selectedResult.promptId);
    const receipt = getReceipt(selectedResult.receiptId);
    if (!prompt || !receipt) return;

    setIsRefining(true);
    try {
      const ocrService = new GeminiOCRService();
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Benchmark History</h2>
          <p className="text-slate-500 mt-1">Detailed breakdown of every OCR extraction attempt.</p>
        </div>
        <button 
          onClick={onClear}
          className="text-slate-400 hover:text-rose-500 font-bold text-sm flex items-center gap-2 transition-colors"
        >
          <i className="fas fa-trash-can"></i> Clear History
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Model / Time</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Prompt & Receipt</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Accuracy</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Latency</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Cost</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map(result => (
                <tr key={result.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${MODEL_CONFIGS[result.modelId].color}`}>
                        {MODEL_CONFIGS[result.modelId].name.split(' ').pop()}
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
              ))}
              {results.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-400 italic">
                    No results yet. Run a benchmark to see history.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comparison Modal */}
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
                      <p className="text-[10px] text-slate-400 uppercase">Latency</p>
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
