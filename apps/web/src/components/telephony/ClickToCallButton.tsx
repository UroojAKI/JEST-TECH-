'use client';

import React, { useState } from 'react';
import { Loader2, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { telephonyRepository } from '../../repositories/telephony.repository';

interface ClickToCallButtonProps {
  /** What is being called: a contact or a customer record */
  target: 'contact' | 'customer';
  id: string | undefined | null;
  /** Hide the button text (for table rows) */
  compact?: boolean;
  className?: string;
}

/**
 * Click-to-call via Exotel: rings the agent's phone first, then the customer.
 * Same behaviour as the Call button on the lead page.
 */
export function ClickToCallButton({ target, id, compact, className }: ClickToCallButtonProps) {
  const [isCalling, setIsCalling] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    // Table rows open the record on click; don't do that when calling
    e.stopPropagation();
    if (!id || isCalling) return;
    setIsCalling(true);
    try {
      if (target === 'contact') {
        await telephonyRepository.callContact(id);
      } else {
        await telephonyRepository.callCustomer(id);
      }
      toast.success('Calling… your phone will ring first. Answer it to connect to the customer.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not start the call. Please try again.');
    } finally {
      setIsCalling(false);
    }
  };

  const size = compact ? 'px-2.5 py-1 text-[11px] rounded-lg' : 'px-3.5 py-2 text-xs rounded-xl';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isCalling || !id}
      title="Call (your phone rings first)"
      className={`${size} font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 ${className ?? ''}`}
    >
      {isCalling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />}
      <span>{isCalling ? 'Calling…' : 'Call'}</span>
    </button>
  );
}
