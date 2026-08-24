'use client';

import React from 'react';
import Link from 'next/link';
import {
  Car,
  Bike,
  Truck,
  Tractor,
  Zap,
  Building2,
  ArrowRight,
} from 'lucide-react';

export function MotorProductCards({ onSelect }: { onSelect?: (categoryId: string) => void }) {
  const products = [
    {
      id: 'bike',
      title: 'Bike (2W)',
      subtitle: 'Two-Wheeler Insurance',
      icon: Bike,
      color: 'from-orange-600/10 via-amber-600/5 to-transparent text-orange-600 border-orange-500/20 hover:border-orange-500',
      badge: 'Fast Quote',
      badgeColor: 'bg-orange-600 text-white',
      href: '/sales/quotations?type=bike',
    },
    {
      id: 'private_car',
      title: 'Private Car',
      subtitle: 'Comprehensive & TP',
      icon: Car,
      color: 'from-blue-600/10 via-indigo-600/5 to-transparent text-blue-600 border-blue-500/20 hover:border-blue-500',
      badge: 'Popular',
      badgeColor: 'bg-blue-600 text-white',
      href: '/sales/quotations?type=private_car',
    },
    {
      id: 'gcv',
      title: 'GCV',
      subtitle: 'Goods Carrying Vehicle',
      icon: Truck,
      color: 'from-slate-600/10 via-zinc-600/5 to-transparent text-slate-600 border-slate-500/20 hover:border-slate-500',
      badge: 'Commercial',
      badgeColor: 'bg-slate-600 text-white',
      href: '/sales/quotations?type=gcv',
    },
    {
      id: 'tractor',
      title: 'Tractor',
      subtitle: 'Agriculture & Comm.',
      icon: Tractor,
      color: 'from-green-600/10 via-emerald-600/5 to-transparent text-green-600 border-green-500/20 hover:border-green-500',
      badge: 'Agri',
      badgeColor: 'bg-green-600 text-white',
      href: '/sales/quotations?type=tractor',
    },
    {
      id: 'auto',
      title: 'Auto',
      subtitle: 'Three-Wheeler',
      icon: Zap, // Zap used for Auto/Electric as placeholder
      color: 'from-yellow-600/10 via-amber-600/5 to-transparent text-yellow-600 border-yellow-500/20 hover:border-yellow-500',
      badge: 'Passenger',
      badgeColor: 'bg-yellow-600 text-white',
      href: '/sales/quotations?type=auto',
    },
    {
      id: 'taxi',
      title: 'Taxi',
      subtitle: 'Cabs & Aggregators',
      icon: Car,
      color: 'from-amber-600/10 via-yellow-600/5 to-transparent text-amber-600 border-amber-500/20 hover:border-amber-500',
      badge: 'Commercial',
      badgeColor: 'bg-amber-600 text-white',
      href: '/sales/quotations?type=taxi',
    },
    {
      id: 'bus',
      title: 'Bus & Coaches',
      subtitle: 'Staff & School Bus',
      icon: Truck, // Truck used for Bus as placeholder
      color: 'from-purple-600/10 via-violet-600/5 to-transparent text-purple-600 border-purple-500/20 hover:border-purple-500',
      badge: 'Heavy',
      badgeColor: 'bg-purple-600 text-white',
      href: '/sales/quotations?type=bus',
    },
    {
      id: 'misc',
      title: 'Miscellaneous',
      subtitle: 'Class D / Cranes',
      icon: Building2,
      color: 'from-rose-600/10 via-pink-600/5 to-transparent text-rose-600 border-rose-500/20 hover:border-rose-500',
      badge: 'Special',
      badgeColor: 'bg-rose-600 text-white',
      href: '/sales/quotations?type=misc',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
            Product Selection • Motor Insurance Wizard Entry
          </span>
          <h3 className="text-sm font-extrabold text-foreground tracking-tight">
            Select Insurance Line to Launch Motor Wizard
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {products.map((prod) => {
          const Icon = prod.icon;
          return (
            <button
              key={prod.id}
              onClick={() => onSelect?.(prod.id)}
              className={`p-4 rounded-2xl border bg-gradient-to-br transition-all hover:scale-[1.02] shadow-xs flex flex-col justify-between group text-left w-full h-full ${prod.color}`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-card border shadow-2xs group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="h-6 w-6 shrink-0" />
                  </div>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${prod.badgeColor}`}>
                    {prod.badge}
                  </span>
                </div>

                <div className="text-xs font-black text-foreground group-hover:text-primary transition-colors">
                  {prod.title}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {prod.subtitle}
                </div>
              </div>

              <div className="mt-4 pt-2 border-t border-muted/30 flex items-center justify-between text-[10px] font-extrabold text-primary w-full">
                <span>Start Policy</span>
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
