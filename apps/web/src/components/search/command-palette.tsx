'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, User, ShieldCheck, FileText, X, ArrowRight, Loader2 } from 'lucide-react';
import { useUIStore } from '../../store/ui-store';
import { useCustomerContext } from '../../store/customer-context';
import { useSearch } from '../../hooks/useSearch';

export function CommandPalette() {
  const router = useRouter();
  const { isCommandPaletteOpen, setCommandPaletteOpen } = useUIStore();
  const { setActiveCustomer } = useCustomerContext();
  const [query, setQuery] = useState('');

  const { results, isLoading } = useSearch(query);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
      }
      if (e.key === 'Escape' && isCommandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, setCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  const handleSelect = (item: any) => {
    if (item.type === 'CUSTOMER') {
      setActiveCustomer(item.id, item.title, 'CORPORATE');
    }
    setCommandPaletteOpen(false);
    if (item.link) {
      router.push(item.link);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-card border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search Bar Input */}
        <div className="flex items-center px-4 border-b bg-muted/20">
          <Search className="h-4 w-4 text-muted-foreground mr-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Customers, Policies, Claims, Leads, Documents... (Cmd+K)"
            className="w-full py-3.5 text-sm bg-transparent border-none focus:outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          {isLoading && <Loader2 className="h-4 w-4 text-primary animate-spin mr-2" />}
          <button
            onClick={() => setCommandPaletteOpen(false)}
            className="p-1 text-muted-foreground hover:bg-accent rounded-md"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results Container */}
        <div className="p-2 max-h-80 overflow-y-auto space-y-1">
          {query.trim().length < 2 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Type at least 2 characters to search across live database...
            </div>
          ) : results.length === 0 && !isLoading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No records found matching "{query}".
            </div>
          ) : (
            results.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-accent text-left transition-colors group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-md bg-primary/10 text-primary">
                    {item.type === 'CUSTOMER' && <BuildingIcon className="h-4 w-4" />}
                    {item.type === 'POLICY' && <ShieldCheck className="h-4 w-4" />}
                    {item.type === 'CLAIM' && <FileText className="h-4 w-4" />}
                    {item.type === 'LEAD' && <User className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-foreground">{item.title}</div>
                    <div className="text-[11px] text-muted-foreground">{item.subtitle}</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))
          )}
        </div>

        {/* Quick Navigation Footer */}
        <div className="px-4 py-2 bg-muted/40 border-t flex justify-between items-center text-[10px] text-muted-foreground">
          <span>Live Search connected to NestJS backend engine.</span>
          <div className="flex items-center space-x-2">
            <span>Press <kbd className="px-1 py-0.5 rounded border bg-background font-mono">ESC</kbd> to exit</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BuildingIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}
