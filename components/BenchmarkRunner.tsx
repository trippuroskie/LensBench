
import React, { useState } from 'react';
import { Prompt, Receipt, ModelId, CustomModel } from '../types';
import { MODEL_CONFIGS } from '../constants';

interface BenchmarkRunnerProps {
  prompts: Prompt[];
  receipts: Receipt[];
  customModels: Record<string, CustomModel>;
  onAddCustomModel: (model: CustomModel) => void;
  onRunBatch: (promptIds: string[], modelIds: ModelId[], receiptIds: string[]) => Promise<void>;
}

const BenchmarkRunner: React.FC<BenchmarkRunnerProps> = ({ 
  prompts, 
  receipts, 
  customModels, 
  onAddCustomModel, 
  onRunBatch 
}) => {
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>(prompts[0] ? [prompts[0].id] : []);
  const [selectedModels, setSelectedModels] = useState<ModelId[]>(['google/gemini-2.0-flash-001']);
  const [selectedReceipts, setSelectedReceipts] = useState<string[]>([]);
  
  // Custom Model Form State
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');

  const allConfigs = { ...MODEL_CONFIGS, ...customModels };

  const toggleReceipt = (id: string) => {
    setSelectedReceipts(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const togglePrompt = (id: string) => {
    setSelectedPrompts(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const toggleModel = (id: ModelId) => {
    setSelectedModels(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const handleAddCustomModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelId || !newModelName) return;
    
    const model: CustomModel = {
      id: newModelId,
      name: newModelName,
      inputPrice: 0.1 / 1_000_000, // Default to a low price if unknown
      outputPrice: 0.4 / 1_000_000,
      color: 'bg-slate-100 text-slate-700 border-slate-200'
    };
    
    onAddCustomModel(model);
    setSelectedModels(prev => [...prev, model.id]);
    setNewModelId('');
    setNewModelName('');
    setIsAddingModel(false);
  };

  const handleLaunch = () => {
    if (selectedPrompts.length === 0 || selectedModels.length === 0 || selectedReceipts.length === 0) return;
    onRunBatch(selectedPrompts, selectedModels, selectedReceipts);
  };

  const canRun = selectedPrompts.length > 0 && selectedModels.length > 0 && selectedReceipts.length > 0;
  const totalRuns = selectedPrompts.length * selectedModels.length * selectedReceipts.length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Run New Experiment</h2>
        <p className="text-slate-500 mt-1">Select multiple prompts, models, and datasets to run a comprehensive benchmark.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          {/* Step 1: Prompts */}
          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
               <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Step 1: Choose Prompts</h3>
               <button onClick={() => setSelectedPrompts(prompts.map(p => p.id))} className="text-[10px] font-bold text-indigo-600 hover:underline">Select All</button>
            </div>
            <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar pr-1">
              {prompts.map(p => {
                const isSelected = selectedPrompts.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePrompt(p.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                      isSelected ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                      {isSelected && <i className="fas fa-check text-white text-[8px]"></i>}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{p.name}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">v{p.version}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Step 2: Models */}
          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
             <div className="flex items-center justify-between mb-4">
               <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Step 2: Select Models</h3>
               <button 
                onClick={() => setIsAddingModel(!isAddingModel)}
                className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
               >
                 <i className={`fas ${isAddingModel ? 'fa-times' : 'fa-plus'}`}></i> {isAddingModel ? 'Cancel' : 'Add Model'}
               </button>
            </div>

            {isAddingModel && (
              <form onSubmit={handleAddCustomModel} className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 animate-in slide-in-from-top-2">
                <input 
                  type="text" 
                  placeholder="OpenRouter ID (e.g. x-ai/grok-2)" 
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newModelId}
                  onChange={(e) => setNewModelId(e.target.value)}
                />
                <input 
                  type="text" 
                  placeholder="Display Name (e.g. Grok 2)" 
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                />
                <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg text-xs font-bold">Add to List</button>
              </form>
            )}

            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
              {(Object.keys(allConfigs) as ModelId[]).map(mId => {
                const isSelected = selectedModels.includes(mId);
                const config = allConfigs[mId];
                return (
                  <button
                    key={mId}
                    onClick={() => toggleModel(mId)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3 ${
                      isSelected ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                      {isSelected && <i className="fas fa-check text-white text-[8px]"></i>}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{config.name}</p>
                      <p className="text-[9px] text-slate-400 font-mono truncate max-w-[150px]">{mId}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <button
            onClick={handleLaunch}
            disabled={!canRun}
            className={`w-full py-4 rounded-2xl font-bold text-lg shadow-xl transition-all flex flex-col items-center justify-center ${
              canRun ? 'bg-indigo-600 text-white shadow-indigo-200 hover:scale-[1.02] active:scale-[0.98]' : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
            }`}
          >
            <span>Launch Benchmark</span>
            {canRun && <span className="text-xs opacity-80 font-normal mt-1">{totalRuns} Runs Queued</span>}
          </button>
        </div>

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
                  <div className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedReceipts.includes(r.id) ? 'bg-indigo-600 border-indigo-600' : 'bg-white/50 border-white'}`}>
                    {selectedReceipts.includes(r.id) && <i className="fas fa-check text-white text-[10px]"></i>}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-white text-[10px] font-bold truncate">{r.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default BenchmarkRunner;
