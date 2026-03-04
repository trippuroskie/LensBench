
import React, { useMemo, useState } from 'react';
import { BenchmarkResult, ModelId } from '../types';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, Legend, Cell 
} from 'recharts';
import { MODEL_CONFIGS } from '../constants';

interface DashboardProps {
  receiptsCount: number;
  promptsCount: number;
  results: BenchmarkResult[];
  onStartBenchmark: () => void;
  customModels: Record<string, any>;
}

const Dashboard: React.FC<DashboardProps> = ({ receiptsCount, promptsCount, results, onStartBenchmark, customModels }) => {
  const allConfigs = { ...MODEL_CONFIGS, ...customModels };
  const allModelIds = [...Object.keys(MODEL_CONFIGS), ...Object.keys(customModels)] as ModelId[];
  const [activeModelFilters, setActiveModelFilters] = useState<ModelId[]>(allModelIds);

  const toggleModelFilter = (id: ModelId) => {
    setActiveModelFilters(prev => 
      prev.includes(id) 
        ? (prev.length > 1 ? prev.filter(m => m !== id) : prev) 
        : [...prev, id]
    );
  };

  // Filtered results based on selected models
  const filteredResults = useMemo(() => {
    return results.filter(r => activeModelFilters.includes(r.modelId));
  }, [results, activeModelFilters]);

  const avgAccuracy = useMemo(() => {
    if (filteredResults.length === 0) return 0;
    return filteredResults.reduce((acc, r) => acc + r.metrics.accuracy, 0) / filteredResults.length;
  }, [filteredResults]);

  const avgCost = useMemo(() => {
    if (filteredResults.length === 0) return 0;
    return filteredResults.reduce((acc, r) => acc + r.metrics.costUsd, 0) / filteredResults.length;
  }, [filteredResults]);

  const chartData = useMemo(() => {
    // We take the last 15 filtered results to show trends
    return filteredResults.slice(0, 15).reverse().map((r, i) => {
      const config = allConfigs[r.modelId] || { name: r.modelId, color: 'text-slate-700' };
      return {
        name: `Run ${i + 1}`,
        accuracy: Math.round(r.metrics.accuracy * 100),
        latency: Math.round(r.metrics.latencyMs / 100) / 10,
        modelName: config.name,
        modelColor: config.color.split(' ')[1]?.replace('text-', '').replace('-700', '') || 'slate',
        rawColor: (() => {
          const colorClass = config.color;
          if (colorClass.includes('green')) return '#16a34a';
          if (colorClass.includes('orange')) return '#ea580c';
          if (colorClass.includes('cyan')) return '#0891b2';
          if (colorClass.includes('indigo')) return '#4f46e5';
          if (colorClass.includes('sky')) return '#0284c7';
          if (colorClass.includes('violet')) return '#7c3aed';
          if (colorClass.includes('fuchsia')) return '#c026d3';
          return '#2563eb'; // Default Blue
        })()
      };
    });
  }, [filteredResults, allConfigs]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Benchmark Analytics</h2>
          <p className="text-slate-500 mt-1">Cross-model performance comparison and cost analysis.</p>
        </div>
        <button 
          onClick={onStartBenchmark}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 self-start"
        >
          <i className="fas fa-play"></i> Run Experiment
        </button>
      </div>

      {/* Model Filter Bar */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-2">
        <span className="px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Filter Models:</span>
        {allModelIds.map(mId => {
          const config = allConfigs[mId];
          const isActive = activeModelFilters.includes(mId);
          return (
            <button
              key={mId}
              onClick={() => toggleModelFilter(mId)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border ${
                isActive 
                  ? `${config.color} ring-2 ring-offset-1 ring-indigo-100` 
                  : 'bg-slate-50 text-slate-500 border-transparent grayscale'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-current' : 'bg-slate-300'}`}></div>
              {config.name}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Samples" value={receiptsCount} icon="fa-images" color="indigo" />
        <StatCard title="Active Experiments" value={filteredResults.length} icon="fa-vial" color="blue" />
        <StatCard title="Avg. Accuracy" value={`${Math.round(avgAccuracy * 100)}%`} icon="fa-bullseye" color="emerald" />
        <StatCard title="Avg. Cost / Run" value={`$${avgCost.toFixed(4)}`} icon="fa-tags" color="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Accuracy Trend */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-w-0">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <i className="fas fa-chart-line text-indigo-500"></i> Accuracy over Time
            </h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Last 15 filtered runs</span>
          </div>
          <div className="h-[350px] w-full min-h-[350px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" hide />
                  <YAxis unit="%" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{data.modelName}</p>
                            <p className="text-lg font-bold text-slate-900">{payload[0].value}% Accuracy</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="accuracy" 
                    stroke="#6366f1" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorAcc)" 
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState />
            )}
          </div>
        </div>

        {/* Latency by Model */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-w-0">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <i className="fas fa-bolt text-rose-500"></i> Latency Distribution (s)
            </h3>
            <div className="flex gap-2">
               {activeModelFilters.map(mId => {
                 const config = allConfigs[mId];
                 return (
                   <div key={mId} className="flex items-center gap-1">
                     <div className="w-2 h-2 rounded-full" style={{ backgroundColor: (() => {
                       const colorClass = config.color;
                       if (colorClass.includes('green')) return '#16a34a';
                       if (colorClass.includes('orange')) return '#ea580c';
                       if (colorClass.includes('cyan')) return '#0891b2';
                       if (colorClass.includes('indigo')) return '#4f46e5';
                       if (colorClass.includes('sky')) return '#0284c7';
                       if (colorClass.includes('violet')) return '#7c3aed';
                       if (colorClass.includes('fuchsia')) return '#c026d3';
                       return '#2563eb';
                     })() }}></div>
                     <span className="text-[9px] font-bold text-slate-400 uppercase">{config.name.split(' ').pop()}</span>
                   </div>
                 );
               })}
            </div>
          </div>
          <div className="h-[350px] w-full min-h-[350px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" hide />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{data.modelName}</p>
                            <p className="text-lg font-bold text-slate-900">{payload[0].value}s Latency</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="latency" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.rawColor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState />
            )}
          </div>
        </div>
      </div>
      
      {results.length === 0 && (
        <div className="bg-indigo-50 border border-indigo-100 p-12 rounded-3xl text-center">
          <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fas fa-rocket text-3xl"></i>
          </div>
          <h3 className="text-xl font-bold text-indigo-900 mb-2">Ready to benchmark?</h3>
          <p className="text-indigo-700/70 mb-8 max-w-md mx-auto">Upload some receipts and create your first OCR extraction prompt to see your metrics appear here.</p>
          <button 
            onClick={onStartBenchmark}
            className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold shadow-xl shadow-indigo-200 hover:scale-105 active:scale-95 transition-all"
          >
            Create My First Experiment
          </button>
        </div>
      )}
    </div>
  );
};

const EmptyChartState = () => (
  <div className="h-full flex flex-col items-center justify-center text-slate-300 italic border-2 border-dashed border-slate-50 rounded-2xl bg-slate-50/30">
    <i className="fas fa-chart-area text-4xl mb-2 opacity-20"></i>
    <p className="text-sm">No filtered data to visualize</p>
  </div>
);

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => {
  const colorMap: any = {
    indigo: 'bg-indigo-50 text-indigo-600',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600'
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          <i className={`fas ${icon} text-xl`}></i>
        </div>
        <div>
          <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest">{title}</p>
          <h4 className="text-2xl font-bold text-slate-900">{value}</h4>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
