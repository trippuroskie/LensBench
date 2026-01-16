
import React, { useState } from 'react';
import { Prompt, Receipt, ModelId } from '../types';
import { MODEL_CONFIGS } from '../constants';

interface BenchmarkRunnerProps {
  prompts: Prompt[];
  receipts: Receipt[];
  onRun: (promptId: string, modelId: ModelId, receiptId: string) => Promise<void>;
}

const BenchmarkRunner: React.FC<BenchmarkRunnerProps> = ({ prompts, receipts, onRun }) => {
  const [selectedPrompt, setSelectedPrompt] = useState<string>(prompts[0]?.id || '');
  const [selectedModel, setSelectedModel] = useState<ModelId>(ModelId.GEMINI_FLASH);
  const [selectedReceipts, setSelectedReceipts] = useState<string[]>([]);

  const toggleReceipt = (id: string) => {
    setSelectedReceipts(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const handleRunAll = async () => {
    if (!selectedPrompt || selectedReceipts.length === 0) return;
    
    // Process sequentially to keep track of state easily
    for (const receiptId of selectedReceipts) {
      await onRun(selectedPrompt, selectedModel, receiptId);
    }
  };

  const canRun = selectedPrompt && selectedReceipts.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Run New Experiment</h2>
        <p className="text-slate-500 mt-1">Select your pipeline components and launch the evaluation.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 space-y-6">
          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Step 1: Choose Prompt</h3>
            <div className="space-y-2">
              {prompts.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPrompt(p.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selectedPrompt === p.id 
                    ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' 
                    : 'border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <p className="font-bold text-slate-900 text-sm">{p.name}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">v{p.version}</p>
                </button>
              ))}
              {prompts.length === 0 && <p className="text-xs text-rose-500 italic">No prompts available. Create one first.</p>}
            </div>
          </section>

          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Step 2: Select Model</h3>
            <div className="space-y-2">
              {(Object.keys(MODEL_CONFIGS) as ModelId[]).map(mId => (
                <button
                  key={mId}
                  onClick={() => setSelectedModel(mId)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selectedModel === mId 
                    ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' 
                    : 'border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900 text-sm">{MODEL_CONFIGS[mId].name}</p>
                    <i className={`fas ${selectedModel === mId ? 'fa-circle-dot text-indigo-600' : 'fa-circle text-slate-200'}`}></i>
                  </div>
                  <p className="text-[10px] text-slate-500">Fast, efficient vision-language model</p>
                </button>
              ))}
            </div>
          </section>

          <button
            onClick={handleRunAll}
            disabled={!canRun}
            className={`w-full py-4 rounded-2xl font-bold text-lg shadow-xl transition-all ${
              canRun 
              ? 'bg-indigo-600 text-white shadow-indigo-200 hover:scale-[1.02] active:scale-[0.98]' 
              : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
            }`}
          >
            Launch Benchmark ({selectedReceipts.length})
          </button>
        </div>

        {/* Dataset Selection */}
        <div className="lg:col-span-2">
          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Step 3: Select Dataset</h3>
              <button 
                onClick={() => setSelectedReceipts(selectedReceipts.length === receipts.length ? [] : receipts.map(r => r.id))}
                className="text-xs font-bold text-indigo-600 hover:underline"
              >
                {selectedReceipts.length === receipts.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {receipts.map(r => (
                <div 
                  key={r.id}
                  onClick={() => toggleReceipt(r.id)}
                  className={`relative aspect-[3/4] rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                    selectedReceipts.includes(r.id) ? 'border-indigo-600 ring-4 ring-indigo-50' : 'border-slate-100 hover:border-indigo-200'
                  }`}
                >
                  <img src={r.imageUrl} className="w-full h-full object-cover" />
                  <div className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedReceipts.includes(r.id) ? 'bg-indigo-600 border-indigo-600' : 'bg-white/50 border-white'
                  }`}>
                    {selectedReceipts.includes(r.id) && <i className="fas fa-check text-white text-[10px]"></i>}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-white text-[10px] font-bold truncate">{r.name}</p>
                  </div>
                </div>
              ))}
              {receipts.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-400">
                  <p>No receipts available to test.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default BenchmarkRunner;
