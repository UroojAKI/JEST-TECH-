'use client';

import React from 'react';
import { useAuth } from '@/hooks/useAuth';

export default function AgentWorkspacePage() {
  const { user } = useAuth();
  
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Agent & POSP Management</h1>
          <p className="text-gray-500 mt-1">POSP onboarding, licensing compliance, and production leaderboards</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center items-center h-32">
          <h3 className="text-lg font-semibold text-gray-700">Active Agents</h3>
          <p className="text-4xl font-bold text-blue-600 mt-2">142</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center items-center h-32">
          <h3 className="text-lg font-semibold text-gray-700">Pending Onboarding</h3>
          <p className="text-4xl font-bold text-amber-500 mt-2">18</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center items-center h-32">
          <h3 className="text-lg font-semibold text-gray-700">Monthly Premium</h3>
          <p className="text-4xl font-bold text-emerald-600 mt-2">₹12.4L</p>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-500 mt-6">
        <p>Dashboard registry metrics and SOP pipelines are loading...</p>
      </div>
    </div>
  );
}
