
import React, { useState, useEffect } from 'react';
import { ViewState, Receipt, Prompt, BenchmarkResult, ModelId } from './types';
import { MODEL_CONFIGS, SYSTEM_PROMPT_PREFIX } from './constants';
import { OpenRouterService } from './services/openrouter';
import { calculateAccuracy, estimateTokens } from './utils/evaluator';

// Components
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import PromptManager from './components/PromptManager';
import ReceiptManager from './components/ReceiptManager';
import BenchmarkRunner from './components/BenchmarkRunner';
import ResultsHistory from './components/ResultsHistory';
import Leaderboard from './components/Leaderboard';

// Simple IndexedDB wrapper for large binary data
const dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('LensBenchDB', 1);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains('receipts')) {
      db.createObjectStore('receipts', { keyPath: 'id' });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('dashboard');
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [customModels, setCustomModels] = useState<Record<string, any>>({});
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [benchmarkProgress, setBenchmarkProgress] = useState<{
    isRunning: boolean;
    current: number;
    total: number;
    message: string;
  } | null>(null);

  // Initialize data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load metadata from localStorage
        const savedPrompts = localStorage.getItem('ocr_prompts');
        const savedResults = localStorage.getItem('ocr_results');
        const savedModels = localStorage.getItem('ocr_custom_models');
        if (savedPrompts) setPrompts(JSON.parse(savedPrompts));
        if (savedResults) setResults(JSON.parse(savedResults));
        if (savedModels) setCustomModels(JSON.parse(savedModels));

        // Load large receipt data from IndexedDB
        const db = await dbPromise;
        const tx = db.transaction('receipts', 'readonly');
        const store = tx.objectStore('receipts');
        const request = store.getAll();
        request.onsuccess = () => {
          setReceipts(request.result || []);
        };
      } catch (error) {
        console.error("Failed to load data:", error);
      }
    };
    loadData();
  }, []);

  // Persist receipts to IndexedDB
  const saveReceiptToDB = async (receipt: Receipt) => {
    try {
      const db = await dbPromise;
      const tx = db.transaction('receipts', 'readwrite');
      tx.objectStore('receipts').put(receipt);
    } catch (e) {
      console.error("Failed to save receipt to DB:", e);
    }
  };

  const deleteReceiptFromDB = async (id: string) => {
    try {
      const db = await dbPromise;
      const tx = db.transaction('receipts', 'readwrite');
      tx.objectStore('receipts').delete(id);
    } catch (e) {
      console.error("Failed to delete receipt from DB:", e);
    }
  };

  // Persist small metadata to localStorage
  useEffect(() => {
    try {
      if (prompts.length > 0) localStorage.setItem('ocr_prompts', JSON.stringify(prompts));
      if (results.length > 0) localStorage.setItem('ocr_results', JSON.stringify(results));
      if (Object.keys(customModels).length > 0) localStorage.setItem('ocr_custom_models', JSON.stringify(customModels));
    } catch (e) {
      console.error("Failed to save metadata to localStorage:", e);
    }
  }, [prompts, results]);

  const addReceipt = (newReceipt: Receipt) => {
    setReceipts(prev => [...prev, newReceipt]);
    saveReceiptToDB(newReceipt);
  };

  const deleteReceipt = (id: string) => {
    setReceipts(prev => prev.filter(r => r.id !== id));
    deleteReceiptFromDB(id);
  };

  const updateReceiptGroundTruth = (id: string, json: string) => {
    const updated = receipts.map(r => r.id === id ? { ...r, groundTruthJson: json } : r);
    setReceipts(updated);
    const item = updated.find(r => r.id === id);
    if (item) saveReceiptToDB(item);
  };

  const addPrompt = (newPrompt: Prompt) => {
    setPrompts(prev => [...prev, newPrompt]);
  };

  const deletePrompt = (id: string) => {
    setPrompts(prev => prev.filter(p => p.id !== id));
  };

  const handleBatchRun = async (promptIds: string[], modelIds: ModelId[], receiptIds: string[]) => {
    // 1. Generate all task combinations
    const tasks: any[] = [];
    const allConfigs = { ...MODEL_CONFIGS, ...customModels };

    for (const modelId of modelIds) {
      for (const promptId of promptIds) {
        for (const receiptId of receiptIds) {
          const prompt = prompts.find(p => p.id === promptId);
          const receipt = receipts.find(r => r.id === receiptId);
          if (prompt && receipt) {
            tasks.push({ 
              modelId, 
              prompt, 
              receipt, 
              config: allConfigs[modelId] || { name: modelId, inputPrice: 0, outputPrice: 0 } 
            });
          }
        }
      }
    }

    const total = tasks.length;
    let completed = 0;
    setBenchmarkProgress({ isRunning: true, current: 0, total, message: 'Initializing batch run...' });

    const CONCURRENCY_LIMIT = 5; 

    // Helper to process a single task
    const processTask = async (task: any) => {
      try {
        const ocrService = new OpenRouterService();
        const { text, duration, rawResponse } = await ocrService.runOCR(
          task.modelId,
          SYSTEM_PROMPT_PREFIX + task.prompt.content,
          task.receipt.base64,
          task.receipt.mimeType
        );

        const accuracy = calculateAccuracy(text, task.receipt.groundTruthJson);
        const inputTokens = rawResponse?.usage?.prompt_tokens || estimateTokens(task.prompt.content + task.receipt.base64.length / 4);
        const outputTokens = rawResponse?.usage?.completion_tokens || estimateTokens(text);
        const totalTokens = inputTokens + outputTokens;
        
        const cost = (inputTokens * (task.config.inputPrice || 0)) + (outputTokens * (task.config.outputPrice || 0));
        const tps = outputTokens / (duration / 1000);

        const result: BenchmarkResult = {
          id: crypto.randomUUID(),
          promptId: task.prompt.id,
          modelId: task.modelId,
          receiptId: task.receipt.id,
          outputJson: text,
          timestamp: Date.now(),
          metrics: { latencyMs: duration, accuracy, tokensUsed: totalTokens, costUsd: cost, tokensPerSecond: tps }
        };

        setResults(prev => [result, ...prev]);
      } catch (error: any) {
        console.error(`Benchmark failed for ${task.modelId}:`, error);
        const errorMsg = error.message || '';
        if (errorMsg.includes('402') || errorMsg.includes('Quota') || errorMsg.includes('insufficient_quota')) {
           throw new Error(`CRITICAL_STOP: ${errorMsg}`);
        }
      } finally {
        completed++;
        setBenchmarkProgress(prev => prev ? { ...prev, current: completed, message: `Processed ${completed}/${total}` } : null);
      }
    };

    // 2. Process with concurrency limit
    try {
      for (let i = 0; i < tasks.length; i += CONCURRENCY_LIMIT) {
        const chunk = tasks.slice(i, i + CONCURRENCY_LIMIT);
        await Promise.all(chunk.map(task => processTask(task)));
      }
    } catch (e: any) {
      if (e.message && e.message.includes('CRITICAL_STOP')) {
        alert(`Benchmark Aborted: Insufficient Credits.\n${e.message}`);
        setBenchmarkProgress(null);
        return;
      }
    }

    setBenchmarkProgress(null);
    setView('results');
  };

  const clearResults = () => {
    if (confirm("Are you sure you want to clear all benchmark history?")) {
      setResults([]);
      localStorage.removeItem('ocr_results');
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar currentView={view} setView={setView} />
      
      <main className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden relative">
        {benchmarkProgress && (
          <div className="absolute inset-0 bg-white/80 z-50 flex flex-col items-center justify-center backdrop-blur-sm p-4">
            <div className="w-full max-w-md space-y-4">
              <div className="flex items-center justify-between text-sm font-bold text-slate-700">
                <span>{benchmarkProgress.message}</span>
                <span>{Math.round((benchmarkProgress.current / benchmarkProgress.total) * 100)}%</span>
              </div>
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-600 transition-all duration-300 ease-out"
                  style={{ width: `${(benchmarkProgress.current / benchmarkProgress.total) * 100}%` }}
                ></div>
              </div>
              <p className="text-center text-xs text-slate-400">
                Completed {benchmarkProgress.current} of {benchmarkProgress.total} runs
              </p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-6xl mx-auto w-full min-h-full">
            {view === 'dashboard' && (
              <Dashboard 
                receiptsCount={receipts.length} 
                promptsCount={prompts.length} 
                results={results} 
                onStartBenchmark={() => setView('benchmark')}
                customModels={customModels}
              />
            )}
            {view === 'prompts' && (
              <PromptManager prompts={prompts} onAddPrompt={addPrompt} onDeletePrompt={deletePrompt} />
            )}
            {view === 'receipts' && (
              <ReceiptManager 
                receipts={receipts} 
                onAddReceipt={addReceipt} 
                onDeleteReceipt={deleteReceipt} 
                onUpdateGroundTruth={updateReceiptGroundTruth}
              />
            )}
            {view === 'benchmark' && (
              <BenchmarkRunner 
                prompts={prompts} 
                receipts={receipts} 
                customModels={customModels}
                onAddCustomModel={(m) => setCustomModels(prev => ({ ...prev, [m.id]: m }))}
                onRunBatch={handleBatchRun} 
              />
            )}
            {view === 'results' && (
              <ResultsHistory 
                results={results} 
                prompts={prompts} 
                receipts={receipts} 
                customModels={customModels}
                onClear={clearResults}
              />
            )}
            {view === 'leaderboard' && (
              <Leaderboard results={results} customModels={customModels} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
