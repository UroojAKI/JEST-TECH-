import { create } from 'zustand';
import { CustomerContextState } from '../types';

interface CustomerContextStore extends CustomerContextState {
  setActiveCustomer: (
    id: string | null,
    name?: string | null,
    type?: 'INDIVIDUAL' | 'CORPORATE' | null
  ) => void;
  clearActiveCustomer: () => void;
}

export const useCustomerContext = create<CustomerContextStore>((set) => ({
  activeCustomerId: null,
  activeCustomerName: null,
  activeCustomerType: null,

  setActiveCustomer: (id, name = null, type = null) =>
    set({
      activeCustomerId: id,
      activeCustomerName: name,
      activeCustomerType: type,
    }),

  clearActiveCustomer: () =>
    set({
      activeCustomerId: null,
      activeCustomerName: null,
      activeCustomerType: null,
    }),
}));
