'use client';

import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Table,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Activity,
  LayoutGrid,
  Filter,
} from 'lucide-react';

export type ChartType = 'TABLE' | 'KPI' | 'BAR' | 'LINE' | 'AREA' | 'PIE' | 'DONUT';

interface VisualizationStudioProps {
  data: Record<string, any>[];
  columns: { key: string; label: string; dataType?: string }[];
  title?: string;
  categoryKey?: string;
  valueKey?: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export function VisualizationStudio({
  data,
  columns,
  title = 'Report Analytics Visualization',
  categoryKey = columns[0]?.key || 'name',
  valueKey = columns[1]?.key || 'value',
}: VisualizationStudioProps) {
  const [chartType, setChartType] = useState<ChartType>('BAR');

  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center border rounded-xl bg-card text-muted-foreground text-xs">
        No dataset rows available to visualize.
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl border bg-card shadow-sm space-y-4">
      {/* Studio Header & Chart Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-3">
        <div>
          <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> {title}
          </h3>
          <p className="text-[11px] text-muted-foreground">Dynamic Business Intelligence & Data Studio</p>
        </div>

        {/* Chart Type Selector */}
        <div className="flex items-center space-x-1 border rounded-lg p-1 bg-muted/20 text-xs">
          {[
            { id: 'BAR', label: 'Bar', icon: BarChart3 },
            { id: 'LINE', label: 'Line', icon: LineChartIcon },
            { id: 'AREA', label: 'Area', icon: Activity },
            { id: 'PIE', label: 'Pie', icon: PieChartIcon },
            { id: 'KPI', label: 'KPI', icon: LayoutGrid },
            { id: 'TABLE', label: 'Table', icon: Table },
          ].map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.id}
                onClick={() => setChartType(type.id as ChartType)}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  chartType === type.id
                    ? 'bg-primary text-primary-foreground shadow'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="text-[11px]">{type.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Render Selected View */}
      <div className="pt-2 min-h-[300px] flex flex-col justify-center">
        {chartType === 'BAR' && (
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey={categoryKey} stroke="#888888" fontSize={11} />
                <YAxis stroke="#888888" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend />
                <Bar dataKey={valueKey} fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {chartType === 'LINE' && (
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey={categoryKey} stroke="#888888" fontSize={11} />
                <YAxis stroke="#888888" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend />
                <Line type="monotone" dataKey={valueKey} stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {chartType === 'AREA' && (
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey={categoryKey} stroke="#888888" fontSize={11} />
                <YAxis stroke="#888888" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey={valueKey} stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {chartType === 'PIE' && (
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey={valueKey} nameKey={categoryKey} cx="50%" cy="50%" outerRadius={100} label>
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {chartType === 'KPI' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-2">
            {data.slice(0, 4).map((row, idx) => (
              <div key={idx} className="p-4 rounded-xl border bg-muted/10 space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">{String(row[categoryKey])}</span>
                <div className="text-xl font-extrabold text-primary font-mono">
                  {typeof row[valueKey] === 'number' ? row[valueKey].toLocaleString('en-IN') : String(row[valueKey])}
                </div>
              </div>
            ))}
          </div>
        )}

        {chartType === 'TABLE' && (
          <div className="border rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
                  {columns.map((col) => (
                    <th key={col.key} className="p-3">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.map((row, idx) => (
                  <tr key={idx} className="hover:bg-accent/40">
                    {columns.map((col) => (
                      <td key={col.key} className="p-3">
                        {typeof row[col.key] === 'number' ? row[col.key].toLocaleString('en-IN') : String(row[col.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
