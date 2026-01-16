
import React, { useState } from 'react';
import { Prompt } from '../types';

interface PromptManagerProps {
  prompts: Prompt[];
  onAddPrompt: (prompt: Prompt) => void;
  onDeletePrompt: (id: string) => void;
}

const PromptManager: React.FC<PromptManagerProps> = ({ prompts, onAddPrompt, onDeletePrompt }) => {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !content) return;

    // Auto-calculate version based on name
    const existingCount = prompts.filter(p => p.name === name).length;
    
    const newPrompt: Prompt = {
      id: crypto.randomUUID(),
      name,
      version: existingCount + 1,
      content,
      createdAt: Date.now()
    };

    onAddPrompt(newPrompt);
    setName('');
    setContent('');
    setIsAdding(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Prompt Library</h2>
          <p className="text-slate-500 mt-1">Design and version control your OCR extraction logic.</p>
        </div>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2"
          >
            <i className="fas fa-plus"></i> New Prompt
          </button>
        )}
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Prompt Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Standard OCR v1"
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Prompt Content</label>
            <textarea 
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Return a JSON with the merchant name, date, and items list..."
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-sm"
            ></textarea>
            <p className="text-xs text-slate-400 mt-2">
              <i className="fas fa-info-circle mr-1"></i> Gemini Flash/Pro will be instructed to return JSON based on this prompt.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button 
              type="button" 
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-50 rounded-lg"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-indigo-100"
            >
              Save Prompt
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4">
        {prompts.length === 0 ? (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-12 rounded-2xl text-center">
            <p className="text-slate-500">No prompts found. Create one to get started.</p>
          </div>
        ) : (
          prompts.map((prompt) => (
            <div key={prompt.id} className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-300 transition-colors shadow-sm group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                    <i className="fas fa-terminal"></i>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{prompt.name} <span className="text-indigo-500 ml-2 text-xs bg-indigo-50 px-2 py-0.5 rounded-full">v{prompt.version}</span></h4>
                    <p className="text-xs text-slate-400">Created {new Date(prompt.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <button 
                  onClick={() => onDeletePrompt(prompt.id)}
                  className="p-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <i className="fas fa-trash-can"></i>
                </button>
              </div>
              <div className="mt-4 bg-slate-50 p-3 rounded-lg border border-slate-100 max-h-32 overflow-y-auto custom-scrollbar">
                <code className="text-sm text-slate-600 whitespace-pre-wrap">{prompt.content}</code>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PromptManager;
