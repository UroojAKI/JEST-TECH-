'use client';

import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

export type ChartType = 'AREA' | 'BAR' | 'PIE';

interface UnifiedChartProps {
  type: ChartType;
  data: any[];
  dataKey: string;
  categoryKey?: string;
  height?: number;
  colors?: string[];
}

const DEFAULT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function UnifiedChart({
  type,
  data,
  dataKey,
  categoryKey = 'name',
  height = 300,
  colors = DEFAULT_COLORS,
}: UnifiedChartProps) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        {type === 'AREA' ? (
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors[0]} stopOpacity={0.4} />
                <stop offset="95%" stopColor={colors[0]} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey={categoryKey} fontSize={11} tickLine={false} />
            <YAxis fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
            <Area type="monotone" dataKey={dataKey} stroke={colors[0]} fillOpacity={1} fill="url(#chartGradient)" strokeWidth={2} />
          </AreaChart>
        ) : type === 'BAR' ? (
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey={categoryKey} fontSize={11} tickLine={false} />
            <YAxis fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
            <Bar dataKey={dataKey} fill={colors[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : (
          <PieChart>
            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
            <Pie data={data} dataKey={dataKey} nameKey={categoryKey} cx="50%" cy="50%" outerRadius={80} label>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
