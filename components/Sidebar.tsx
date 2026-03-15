
import React from 'react';
import { ViewState } from '../types';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
    { id: 'prompts', label: 'Prompts', icon: 'fa-terminal' },
    { id: 'receipts', label: 'Receipts', icon: 'fa-receipt' },
    { id: 'benchmark', label: 'New Benchmark', icon: 'fa-play' },
    { id: 'results', label: 'Results', icon: 'fa-list-check' },
    { id: 'compare', label: 'Compare', icon: 'fa-code-compare' },
    { id: 'leaderboard', label: 'Leaderboard', icon: 'fa-trophy' },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col border-r border-slate-800 h-full">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
            <i className="fas fa-microscope text-xl"></i>
          </div>
          <h1 className="text-xl font-bold tracking-tight">LensBench</h1>
        </div>
        
        <nav className="space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id as ViewState)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                currentView === item.id 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <i className={`fas ${item.icon} w-5 ${currentView === item.id ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}></i>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
      
      <div className="mt-auto p-6 border-t border-slate-800">
        <div className="bg-slate-800/50 p-4 rounded-xl">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Power Source</p>
          <div className="flex items-center gap-2">
            <i className="fas fa-bolt text-yellow-500"></i>
            <span className="text-sm font-medium">OpenRouter API</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
