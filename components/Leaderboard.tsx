
import React, { useMemo, useState } from 'react';
import { BenchmarkResult, CustomModel } from '../types';
import { MODEL_CONFIGS } from '../constants';

type SortMetric = 'accuracy' | 'latency' | 'cost' | 'tokensPerSecond';

const METRIC_CONFIG: Record<
  SortMetric,
  { label: string; key: keyof BenchmarkResult['metrics']; higherBetter: boolean; format: (v: number) => string }
> = {
  accuracy: {
    label: 'Accuracy',
    key: 'accuracy',
    higherBetter: true,
    format: (v) => `${Math.round(v * 100)}%`,
  },
  latency: {
    label: 'Latency',
    key: 'latencyMs',
    higherBetter: false,
    format: (v) => `${(v / 1000).toFixed(2)}s`,
  },
  cost: {
    label: 'Cost',
    key: 'costUsd',
    higherBetter: false,
    format: (v) => `$${v.toFixed(5)}`,
  },
  tokensPerSecond: {
    label: 'Tokens/sec',
    key: 'tokensPerSecond',
    higherBetter: true,
    format: (v) => v.toFixed(1),
  },
};

interface LeaderboardProps {
  results: BenchmarkResult[];
  customModels: Record<string, CustomModel>;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ results, customModels }) => {
  const [sortBy, setSortBy] = useState<SortMetric>('accuracy');

  const allConfigs = { ...MODEL_CONFIGS, ...customModels };

  // Aggregate by model: average each metric
  const modelStats = useMemo(() => {
    const byModel = new Map<
      string,
      { runs: number; accuracy: number; latencyMs: number; costUsd: number; tokensPerSecond: number }
    >();
    for (const r of results) {
      const cur = byModel.get(r.modelId);
      const m = r.metrics;
      if (!cur) {
        byModel.set(r.modelId, {
          runs: 1,
          accuracy: m.accuracy,
          latencyMs: m.latencyMs,
          costUsd: m.costUsd,
          tokensPerSecond: m.tokensPerSecond,
        });
      } else {
        cur.runs += 1;
        cur.accuracy += m.accuracy;
        cur.latencyMs += m.latencyMs;
        cur.costUsd += m.costUsd;
        cur.tokensPerSecond += m.tokensPerSecond;
      }
    }
    return Array.from(byModel.entries()).map(([modelId, agg]) => ({
      modelId,
      runs: agg.runs,
      accuracy: agg.accuracy / agg.runs,
      latencyMs: agg.latencyMs / agg.runs,
      costUsd: agg.costUsd / agg.runs,
      tokensPerSecond: agg.tokensPerSecond / agg.runs,
    }));
  }, [results]);

  const sorted = useMemo(() => {
    const config = METRIC_CONFIG[sortBy];
    const key = config.key as keyof typeof modelStats[0];
    return [...modelStats].sort((a, b) => {
      const va = a[key as keyof typeof a] as number;
      const vb = b[key as keyof typeof b] as number;
      if (config.higherBetter) return vb - va;
      return va - vb;
    });
  }, [modelStats, sortBy]);

  const currentConfig = METRIC_CONFIG[sortBy];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Model Leaderboard</h2>
        <p className="text-slate-500 mt-1">
          Models ranked by your benchmark results. Switch metrics to compare accuracy, speed, and cost.
        </p>
      </div>

      {/* Metric tabs — similar to Artificial Analysis */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(METRIC_CONFIG) as SortMetric[]).map((metric) => {
          const cfg = METRIC_CONFIG[metric];
          const isActive = sortBy === metric;
          return (
            <button
              key={metric}
              onClick={() => setSortBy(metric)}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/20'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-700'
              }`}
            >
              {cfg.label}
              <span className="ml-2 text-[10px] opacity-80">
                {cfg.higherBetter ? '↑ higher better' : '↓ lower better'}
              </span>
            </button>
          );
        })}
      </div>

      {sorted.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-trophy text-3xl text-slate-400"></i>
          </div>
          <p className="text-slate-500 font-medium">No benchmark data yet</p>
          <p className="text-sm text-slate-400 mt-1">Run a benchmark to see models ranked by {currentConfig.label}.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Ranked by {currentConfig.label} · {currentConfig.higherBetter ? 'Higher is better' : 'Lower is better'}
            </p>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-16">#</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Model</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                    {METRIC_CONFIG.accuracy.label}
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                    {METRIC_CONFIG.latency.label}
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                    {METRIC_CONFIG.cost.label}
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                    {METRIC_CONFIG.tokensPerSecond.label}
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                    Runs
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((row, index) => {
                  const config = allConfigs[row.modelId] || { name: row.modelId, color: 'bg-slate-100 text-slate-600 border-slate-200' };
                  const rank = index + 1;
                  return (
                    <tr key={row.modelId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex w-8 h-8 rounded-lg items-center justify-center text-sm font-bold ${
                            rank === 1
                              ? 'bg-amber-100 text-amber-700'
                              : rank === 2
                                ? 'bg-slate-200 text-slate-600'
                                : rank === 3
                                  ? 'bg-amber-50 text-amber-800'
                                  : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {rank}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`inline-flex px-3 py-1.5 rounded-lg text-sm font-bold border ${config.color}`}>
                          {config.name}
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-1 truncate max-w-[200px]">{row.modelId}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`font-bold ${
                            row.accuracy >= 0.9 ? 'text-emerald-600' : row.accuracy >= 0.7 ? 'text-amber-600' : 'text-rose-600'
                          }`}
                        >
                          {METRIC_CONFIG.accuracy.format(row.accuracy)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-slate-700 font-medium">
                        {METRIC_CONFIG.latency.format(row.latencyMs)}
                      </td>
                      <td className="px-6 py-4 text-center text-slate-700 font-medium">
                        {METRIC_CONFIG.cost.format(row.costUsd)}
                      </td>
                      <td className="px-6 py-4 text-center text-slate-700 font-medium">
                        {METRIC_CONFIG.tokensPerSecond.format(row.tokensPerSecond)}
                      </td>
                      <td className="px-6 py-4 text-center text-slate-500 text-sm">{row.runs}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
