'use client';

import React from 'react';

export function AppFooter() {
  return (
    <footer className="border-t bg-card/30 px-6 py-3 text-xs text-muted-foreground flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
      <div>
        <span>© 2026 JEST TECH. Enterprise Insurance Platform. All rights reserved.</span>
      </div>
      <div className="flex items-center space-x-4 text-[11px]">
        <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
        <a href="#" className="hover:text-foreground transition-colors">Security Compliance</a>
        <a href="#" className="hover:text-foreground transition-colors">Support Desk</a>
      </div>
    </footer>
  );
}
