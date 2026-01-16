
import React, { useState, useEffect } from 'react';
import { ViewState, Receipt, Prompt, BenchmarkResult, ModelId } from './types';
import { MODEL_CONFIGS, SYSTEM_PROMPT_PREFIX } from './constants';
import { GeminiOCRService } from './services/gemini';
import { calculateAccuracy, estimateTokens } from './utils/evaluator';

// Components
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import PromptManager from './components/PromptManager';
import ReceiptManager from './components/ReceiptManager';
import BenchmarkRunner from './components/BenchmarkRunner';
import ResultsHistory from './components/ResultsHistory';

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
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load metadata from localStorage
        const savedPrompts = localStorage.getItem('ocr_prompts');
        const savedResults = localStorage.getItem('ocr_results');
        if (savedPrompts) setPrompts(JSON.parse(savedPrompts));
        if (savedResults) setResults(JSON.parse(savedResults));

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

  const handleRunBenchmark = async (promptId: string, modelId: ModelId, receiptId: string) => {
    const prompt = prompts.find(p => p.id === promptId);
    const receipt = receipts.find(r => r.id === receiptId);
    if (!prompt || !receipt) return;

    setIsLoading(true);
    try {
      const ocrService = new GeminiOCRService();
      const { text, duration } = await ocrService.runOCR(
        modelId,
        SYSTEM_PROMPT_PREFIX + prompt.content,
        receipt.base64,
        receipt.mimeType
      );

      const accuracy = calculateAccuracy(text, receipt.groundTruthJson);
      const inputTokens = estimateTokens(prompt.content + receipt.base64.length / 4);
      const outputTokens = estimateTokens(text);
      const totalTokens = inputTokens + outputTokens;
      
      const config = MODEL_CONFIGS[modelId];
      const cost = (inputTokens * config.inputPrice) + (outputTokens * config.outputPrice);
      const tps = outputTokens / (duration / 1000);

      const result: BenchmarkResult = {
        id: crypto.randomUUID(),
        promptId,
        modelId,
        receiptId,
        outputJson: text,
        timestamp: Date.now(),
        metrics: {
          latencyMs: duration,
          accuracy,
          tokensUsed: totalTokens,
          costUsd: cost,
          tokensPerSecond: tps
        }
      };

      setResults(prev => [result, ...prev]);
      setView('results');
    } catch (error) {
      console.error("Benchmark failed:", error);
      alert("Failed to run benchmark. Check your internet connection or API key.");
    } finally {
      setIsLoading(false);
    }
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
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
            <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-indigo-900 font-semibold animate-pulse text-lg">Running Benchmark Engine...</p>
            <p className="text-slate-500 text-sm mt-1">Analyzing receipt data using Gemini Vision</p>
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
                onRun={handleRunBenchmark} 
              />
            )}
            {view === 'results' && (
              <ResultsHistory 
                results={results} 
                prompts={prompts} 
                receipts={receipts} 
                onClear={clearResults}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
