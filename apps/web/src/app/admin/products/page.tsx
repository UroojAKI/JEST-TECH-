'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { toast } from 'sonner';
import { AppShell } from '../../../components/layout/app-shell';
import { PageLoadingState, PageErrorState } from '../../../components/ui/page-states';
import {
  Layers,
  PlusCircle,
  Search,
  Power,
  Pencil,
} from 'lucide-react';

export default function ProductMasterAdminPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Form State
  const [insurerId, setInsurerId] = useState('');
  const [productName, setProductName] = useState('');
  const [code, setCode] = useState('');
  const [vehicleType, setVehicleType] = useState('FOUR_WHEELER');
  const [policyType, setPolicyType] = useState('PACKAGE_COMPREHENSIVE');

  // Queries
  const { data: products = [], isLoading: isProductsLoading, isError: isProductsError, refetch: refetchProducts } = useQuery({
    queryKey: ['admin-products-master'],
    queryFn: async () => {
      const res = await apiClient.get('/motor/rating/insurance-products');
      return res.data || [];
    },
  });

  const { data: insurers = [] } = useQuery({
    queryKey: ['admin-insurers-lookup'],
    queryFn: async () => {
      const res = await apiClient.get('/motor/rating/insurers');
      return res.data || [];
    },
  });

  // Mutations
  const createProductMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post('/motor/rating/insurance-products', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products-master'] });
      toast.success('Insurance Product master record created!');
      setShowModal(false);
      setProductName('');
      setCode('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create product record');
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiClient.put('/motor/rating/insurance-products/' + id, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products-master'] });
      toast.success('Insurance product updated.');
      setShowModal(false);
      setEditingProductId(null);
      setProductName('');
      setCode('');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update product'),
  });

  const toggleProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.patch('/motor/rating/insurance-products/' + id + '/toggle');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products-master'] });
      toast.success('Product status updated.');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update product status'),
  });

  const openEditModal = (product: any) => {
    setEditingProductId(product.id);
    setInsurerId(product.insurerId || product.insurer?.id || '');
    setProductName(product.productName || '');
    setCode(product.code || '');
    setVehicleType(product.vehicleType || 'FOUR_WHEELER');
    setPolicyType(product.policyType || 'PACKAGE_COMPREHENSIVE');
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingProductId(null);
    setProductName('');
    setCode('');
    setInsurerId('');
    setVehicleType('FOUR_WHEELER');
    setPolicyType('PACKAGE_COMPREHENSIVE');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!insurerId || !productName || !code) {
      toast.error('Insurer, Product Name, and Product Code are required');
      return;
    }
    const productFields = {
      productName: productName.trim(),
      code: code.trim().toUpperCase(),
      vehicleType,
      policyType,
    };
    if (editingProductId) {
      // The insurer-product association is immutable in the current API contract.
      updateProductMutation.mutate({ id: editingProductId, data: productFields });
    } else {
      createProductMutation.mutate({ insurerId, ...productFields });
    }
  };

  if (isProductsLoading) return <AppShell><PageLoadingState message="Loading products..." /></AppShell>;
  if (isProductsError) return <AppShell><PageErrorState message="Failed to load products. Please try again." onRetry={refetchProducts} /></AppShell>;

  const filteredProducts = (Array.isArray(products) ? products : ((products as any)?.data || (products as any)?.items || [])).filter(
    (p: any) =>
      p.productName.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.insurer?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="p-6 rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase font-bold text-primary tracking-wider">
              Administration • Master Data Management
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight mt-0.5">
              Insurance Product Master
            </h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Maintain insurer-linked products using the API-supported vehicle categories and policy types. Product activation affects future selection; it does not rewrite issued policies.
            </p>
          </div>

          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-extrabold flex items-center space-x-1.5 shadow-xs hover:bg-primary/90 transition-all"
            aria-label="Add new insurance product"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Add Insurance Product</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product name, code, or insurer..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border bg-background focus:ring-1 focus:ring-primary"
              aria-label="Search products"
            />
          </div>
          <div className="text-xs font-bold text-muted-foreground">
            Total Products Configured: <span className="text-foreground font-extrabold">{Array.isArray(products) ? products.length : ((products as any)?.data || (products as any)?.items || []).length}</span>
          </div>
        </div>

        {/* Products Master Table */}
        <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs overflow-hidden">
          {isProductsLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
              Loading Product Master Records...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Layers className="h-10 w-10 text-muted-foreground mx-auto" />
              <h3 className="text-sm font-bold text-foreground">No Products Configured</h3>
              <p className="text-xs text-muted-foreground">Click "Add Insurance Product" to configure product lines.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <caption className="sr-only">Products list</caption>
                <thead>
                  <tr className="border-b text-[10px] uppercase font-bold text-muted-foreground bg-muted/20">
                    <th className="py-3 px-3">Product Code</th>
                    <th className="py-3 px-3">Product Name</th>
                    <th className="py-3 px-3">Belongs To (Insurer)</th>
                    <th className="py-3 px-3">Vehicle Category</th>
                    <th className="py-3 px-3">Policy Type</th>
                            <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs font-semibold">
                  {filteredProducts.map((p: any) => (
                    <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-primary">{p.code}</td>
                      <td className="py-3 px-3 text-foreground font-bold">{p.productName}</td>
                      <td className="py-3 px-3 text-muted-foreground">{p.insurer?.name || 'Partner Insurer'}</td>
                      <td className="py-3 px-3">{p.vehicleType || 'FOUR_WHEELER'}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                          {p.policyType || 'Not configured'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.isActive
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-rose-500/10 text-rose-600'
                          }`}
                        >
                          {p.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => openEditModal(p)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-[10px] font-semibold hover:bg-accent" aria-label={'Edit ' + p.productName}>
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                          <button type="button" onClick={() => toggleProductMutation.mutate(p.id)} disabled={toggleProductMutation.isPending} className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-[10px] font-semibold hover:bg-accent disabled:opacity-50" aria-label={(p.isActive ? 'Deactivate ' : 'Activate ') + p.productName}>
                            <Power className="h-3 w-3" /> {p.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add Product Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md p-6 rounded-2xl border bg-card shadow-2xl space-y-4 text-xs">
              <div className="flex items-center space-x-2 text-primary">
                <Layers className="h-5 w-5" />
                <h3 className="text-sm font-extrabold text-foreground">{editingProductId ? 'Edit Insurance Product' : 'Add Insurance Product'}</h3>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">{editingProductId ? 'Insurer (cannot be changed here)' : 'Select Insurer *'}</label>
                  <select
                    required
                    disabled={Boolean(editingProductId)}
                    value={insurerId}
                    onChange={(e) => setInsurerId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-background font-semibold disabled:bg-muted"
                  >
                    <option value="">-- Choose Partner Insurer --</option>
                    {insurers.filter((ins: any) => ins.isActive !== false).map((ins: any) => (
                      <option key={ins.id} value={ins.id}>
                        {ins.name} ({ins.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">Product Name *</label>
                  <input
                    required
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g. Private Car Package Policy"
                    className="w-full p-2.5 rounded-xl border bg-background"
                  />
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">Product Code *</label>
                  <input
                    required
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. PC-PKG-01"
                    className="w-full p-2.5 rounded-xl border bg-background font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-foreground block mb-1">Vehicle Category</label>
                    <select
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      className="w-full p-2.5 rounded-xl border bg-background font-semibold"
                    >
                      <option value="FOUR_WHEELER">Private Car</option>
                      <option value="TWO_WHEELER">Two Wheeler</option>
                      <option value="COMMERCIAL_GCV">Goods Carrier (GCV)</option>
                      <option value="TRACTOR">Tractor</option>
                      <option value="AUTO_RICKSHAW">Auto Rickshaw</option>
                      <option value="TAXI">Taxi</option>
                      <option value="BUS_COACH">Bus / Coach</option>
                      <option value="MISC_CLASS_D">Miscellaneous Class D</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-foreground block mb-1">Policy Type</label>
                    <select
                      value={policyType}
                      onChange={(e) => setPolicyType(e.target.value)}
                      className="w-full p-2.5 rounded-xl border bg-background font-semibold"
                    >
                      <option value="PACKAGE_COMPREHENSIVE">Comprehensive Package</option>
                      <option value="STANDALONE_OWN_DAMAGE">Standalone OD</option>
                      <option value="THIRD_PARTY_ONLY">Third Party Only</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); resetForm(); }}
                    className="px-3.5 py-1.5 font-semibold rounded-xl border hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createProductMutation.isPending || updateProductMutation.isPending}
                    className="px-4 py-1.5 font-extrabold rounded-xl bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50"
                  >
                    {createProductMutation.isPending || updateProductMutation.isPending ? 'Saving…' : editingProductId ? 'Update Product' : 'Save Product Record'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
