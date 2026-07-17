'use client';

import React, { useState, useEffect } from 'react';

interface ChartCardProps {
  title: string;
  data: { stage: string; count: number }[];
}

export default function ChartCard({ title, data }: ChartCardProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="glass rounded-xl p-6 h-80 flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-6">
        {title}
      </h3>
      <div className="h-64 w-full flex items-end gap-3 pt-4">
        {data.map((item, index) => {
          const heightPct = (item.count / maxCount) * 100;
          return (
            <div key={index} className="flex-1 flex flex-col items-center gap-2 group">
              <div className="relative w-full flex items-end justify-center" style={{ height: '200px' }}>
                <div
                  style={{ height: `${heightPct}%` }}
                  className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-md opacity-80 group-hover:opacity-100 transition-all duration-500 shadow-lg shadow-indigo-500/10 min-h-[4px]"
                />
                {/* Tooltip on hover */}
                <div className="absolute bottom-full mb-2 bg-slate-900 border border-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl">
                  {item.stage}: {item.count}
                </div>
              </div>
              <span className="text-[10px] text-slate-500 font-bold uppercase truncate max-w-full">
                {item.stage}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
