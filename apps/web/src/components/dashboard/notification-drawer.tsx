'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { X, Check, Trash2, Bell, Sparkles, ShieldCheck, AlertOctagon, RefreshCw } from 'lucide-react';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationDrawer({ isOpen, onClose }: NotificationDrawerProps) {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications');
      return res.data;
    },
    enabled: isOpen,
  });

  const readMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });

  const readAllMutation = useMutation({
    mutationFn: async () => {
      await api.patch('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/notifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });

  if (!isOpen) return null;

  const getIcon = (type: string) => {
    if (type.startsWith('CLAIM_')) return <AlertOctagon className="h-5 w-5 text-rose-400" />;
    if (type.startsWith('POLICY_RENEWAL_')) return <RefreshCw className="h-5 w-5 text-amber-400" />;
    if (type.startsWith('POLICY_')) return <ShieldCheck className="h-5 w-5 text-emerald-400" />;
    return <Sparkles className="h-5 w-5 text-indigo-400" />;
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'border-l-4 border-l-red-500';
      case 'HIGH':
        return 'border-l-4 border-l-rose-400';
      case 'MEDIUM':
        return 'border-l-4 border-l-indigo-500';
      default:
        return 'border-l-4 border-l-slate-700';
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-950 border-l border-slate-900 shadow-2xl flex flex-col transition-all duration-300">
        {/* Header */}
        <div className="p-6 border-b border-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">Notifications</h2>
          </div>
          <div className="flex items-center gap-4">
            {notifications.some((n) => !n.isRead) && (
              <button
                onClick={() => readAllMutation.mutate()}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
              >
                <Check className="h-3 w-3" /> Mark all read
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 text-center">
              <Bell className="h-8 w-8 text-slate-700 mb-3" />
              <p className="text-sm font-bold text-slate-400">All caught up!</p>
              <p className="text-xs text-slate-600 mt-1">No new alerts requiring your attention.</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`glass rounded-xl p-4 flex gap-4 transition-all hover:bg-slate-900/45 ${getPriorityStyle(
                  notif.priority,
                )} ${notif.isRead ? 'opacity-60' : ''}`}
              >
                <div className="shrink-0 mt-0.5">{getIcon(notif.type)}</div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2 justify-between">
                    {notif.title}
                    {!notif.isRead && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />}
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{notif.message}</p>
                  <div className="mt-3 flex items-center gap-3">
                    {!notif.isRead && (
                      <button
                        onClick={() => readMutation.mutate(notif.id)}
                        className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer"
                      >
                        Mark Read
                      </button>
                    )}
                    <button
                      onClick={() => deleteMutation.mutate(notif.id)}
                      className="text-[10px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer ml-auto"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
