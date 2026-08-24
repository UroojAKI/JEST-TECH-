'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { toast } from 'sonner';
import {
  User,
  Shield,
  Car,
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  CreditCard,
  Download,
  Share2,
  RefreshCw,
  Zap,
  Building,
  Award,
  PlusCircle,
  X,
} from 'lucide-react';

const WIZARD_STEPS = [
  { id: 1, title: 'Customer' },
  { id: 2, title: 'KYC' },
  { id: 3, title: 'Vehicle' },
  { id: 4, title: 'Policy Type' },
  { id: 5, title: 'Previous Policy' },
  { id: 6, title: 'Add-ons' },
  { id: 7, title: 'Quotation' },
  { id: 8, title: 'Comparison' },
  { id: 9, title: 'Proposal' },
  { id: 10, title: 'Payment' },
  { id: 11, title: 'Issued' },
];

export function MotorProposalWizard() {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);

  // Add Customer Modal State
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustType, setNewCustType] = useState('INDIVIDUAL');
  const [isCreatingCust, setIsCreatingCust] = useState(false);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName || !newCustPhone) {
      toast.error('Name and mobile number are required');
      return;
    }
    setIsCreatingCust(true);
    try {
      const parts = newCustName.trim().split(' ');
      const firstName = parts[0] || 'Customer';
      const lastName = parts.slice(1).join(' ').trim() || 'Record';
      const res = await apiClient.post('/contacts', {
        type: newCustType,
        firstName,
        lastName,
        phone: newCustPhone,
        email: newCustEmail || `customer_${Date.now()}@jestpolicy.com`,
      });
      toast.success(`Customer "${newCustName}" created successfully!`);
      queryClient.invalidateQueries({ queryKey: ['contacts-wizard-lookup'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setSelectedContact(res.data || { id: `CUST-${Date.now()}`, firstName, lastName, phone: newCustPhone, email: newCustEmail });
      setShowAddCustomerModal(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustEmail('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create customer record');
    } finally {
      setIsCreatingCust(false);
    }
  };

  // Form State
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [custSearch, setCustSearch] = useState('');
  
  // Step 2 KYC
  const [panNo, setPanNo] = useState('ABCDE1234F');
  const [aadhaarNo, setAadhaarNo] = useState('987654321098');

  // Step 3 Vehicle
  const [makeId, setMakeId] = useState('');
  const [regNo, setRegNo] = useState('MH12-AB-1234');
  const [engineNo, setEngineNo] = useState('ENG-998124');
  const [chassisNo, setChassisNo] = useState('CHS-7712391024');
  const [rtoCode, setRtoCode] = useState('MH12');
  const [exShowroom, setExShowroom] = useState(1000000);

  // Step 4 Policy Type
  const [selectedPolicyType, setSelectedPolicyType] = useState('COMPREHENSIVE');

  // Step 5 Previous Policy
  const [prevInsurer, setPrevInsurer] = useState('ICICI Lombard');
  const [prevPolicyNo, setPrevPolicyNo] = useState('POL-771239');
  const [ncbPercent, setNcbPercent] = useState(20);

  // Step 6 Add-ons
  const [selectedAddons, setSelectedAddons] = useState({
    zeroDep: true,
    engineProtect: true,
    rsa: true,
    rti: false,
    consumables: true,
  });

  // Step 7/8 Quotes
  const [calculatedQuotes, setCalculatedQuotes] = useState<any[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<any>(null);

  // Step 10 Payment
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [paymentRef, setPaymentRef] = useState('UPI-PAY-98124');

  // Step 11 Issued Policy
  const [issuedPolicyData, setIssuedPolicyData] = useState<any>(null);

  // Queries
  const { data: contactsRaw } = useQuery({
    queryKey: ['contacts-wizard-lookup'],
    queryFn: async () => {
      const res = await apiClient.get('/contacts');
      return res.data;
    },
  });

  const contacts = Array.isArray(contactsRaw)
    ? contactsRaw
    : Array.isArray(contactsRaw?.data?.items)
    ? contactsRaw.data.items
    : Array.isArray(contactsRaw?.items)
    ? contactsRaw.items
    : Array.isArray(contactsRaw?.data)
    ? contactsRaw.data
    : [];

  const { data: makesRaw } = useQuery({
    queryKey: ['makes-wizard-lookup'],
    queryFn: async () => {
      const res = await apiClient.get('/motor/vehicles/manufacturers');
      return res.data;
    },
  });

  const makes = Array.isArray(makesRaw)
    ? makesRaw
    : Array.isArray(makesRaw?.data?.items)
    ? makesRaw.data.items
    : Array.isArray(makesRaw?.items)
    ? makesRaw.items
    : Array.isArray(makesRaw?.data)
    ? makesRaw.data
    : [];


  // Calculate Quotes Mutation
  const calculateQuotesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/quotations/calculate', {
        coverType: selectedPolicyType,
        exShowroomPrice: exShowroom,
        registrationYear: 2024,
        engineCc: 1197,
        ncbPercentage: ncbPercent,
        selectedAddons: {
          zeroDepreciation: selectedAddons.zeroDep,
          roadsideAssistance: selectedAddons.rsa,
          engineProtector: selectedAddons.engineProtect,
        },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setCalculatedQuotes(data.comparativeQuotes || []);
      if (data.comparativeQuotes?.length > 0) {
        setSelectedQuote(data.comparativeQuotes[0]);
      }
    },
  });

  // Issue Policy Mutation
  const issuePolicyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/quotations/wizard/issue-policy', {
        contactId: selectedContact?.id || 'demo-contact-id',
        insurerName: selectedQuote?.insurerName || 'HDFC ERGO General Insurance',
        totalPremium: selectedQuote?.totalPremium || 18500,
        registrationNumber: regNo,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setIssuedPolicyData(data);
      setCurrentStep(11);
      toast.success('Motor Policy Issued & Renewal Schedule Provisioned!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to issue policy');
    },
  });

  const handleNext = () => {
    if (currentStep === 1 && !selectedContact) {
      toast.error('Please select or create a customer first');
      return;
    }
    if (currentStep === 6) {
      calculateQuotesMutation.mutate();
    }
    setCurrentStep((prev) => Math.min(prev + 1, 11));
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  return (
    <div className="space-y-6">
      {/* Wizard Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold text-primary tracking-wider">
              Guided New Business Proposal Engine • Motor Insurance
            </div>
            <h1 className="text-xl font-black text-foreground tracking-tight mt-0.5">
              11-Step Motor Insurance Proposal Wizard
            </h1>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-black bg-primary/10 text-primary">
            Step {currentStep} of 11: {WIZARD_STEPS.find((s) => s.id === currentStep)?.title}
          </span>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="overflow-x-auto pb-2">
          <div className="flex items-center min-w-[900px] space-x-1">
            {WIZARD_STEPS.map((step) => {
              const isCompleted = step.id < currentStep;
              const isCurrent = step.id === currentStep;

              return (
                <React.Fragment key={step.id}>
                  <button
                    type="button"
                    onClick={() => step.id < currentStep && setCurrentStep(step.id)}
                    className={`flex-1 p-2 rounded-xl border text-left transition-all ${
                      isCurrent
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs ring-1 ring-primary'
                        : isCompleted
                        ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 font-semibold'
                        : 'border-muted bg-muted/20 text-muted-foreground'
                    }`}
                  >
                    <div className="text-[9px] font-mono">Step {step.id}</div>
                    <div className="text-[10px] font-bold truncate mt-0.5">{step.title}</div>
                  </button>
                  {step.id < 11 && (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step Contents */}
      <div className="p-6 rounded-2xl border bg-card text-card-foreground shadow-xs">
        {/* Step 1: Customer Selection */}
        {currentStep === 1 && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3 mb-2">
              <div>
                <h3 className="text-sm font-extrabold text-foreground">Step 1: Select or Create Customer</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Select from active CRM records or register a new policyholder.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(true)}
                className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-black flex items-center space-x-1.5 shadow-xs hover:bg-primary/90 transition-all shrink-0"
              >
                <PlusCircle className="h-4 w-4" />
                <span>+ New Customer</span>
              </button>
            </div>
            <div className="max-w-md">
              <label className="font-bold text-foreground block mb-1">Search Customer (Mobile / Code / Name)</label>
              <input
                type="text"
                value={custSearch}
                onChange={(e) => setCustSearch(e.target.value)}
                placeholder="Search phone number or customer code..."
                className="w-full p-2.5 rounded-xl border bg-background"
              />
            </div>

            <div className="space-y-2 pt-2">
              <span className="font-bold text-muted-foreground block text-[10px]">Select Customer Record</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                {(Array.isArray(contacts) ? contacts : []).slice(0, 6).map((c: any) => {
                  const isSel = selectedContact?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedContact(c)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSel
                          ? 'border-primary bg-primary/10 ring-1 ring-primary'
                          : 'hover:border-primary/50'
                      }`}
                    >
                      <div className="font-bold text-foreground">{c.firstName} {c.lastName}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{c.phone} • {c.email || 'No Email'}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: KYC */}
        {currentStep === 2 && (
          <div className="space-y-4 text-xs">
            <h3 className="text-sm font-extrabold text-foreground">Step 2: Customer KYC Verification</h3>
            <div className="grid grid-cols-2 gap-4 max-w-lg">
              <div>
                <label className="font-bold text-foreground block mb-1">PAN Number *</label>
                <input
                  type="text"
                  value={panNo}
                  onChange={(e) => setPanNo(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-background font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-foreground block mb-1">Aadhaar Number *</label>
                <input
                  type="text"
                  value={aadhaarNo}
                  onChange={(e) => setAadhaarNo(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-background font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Vehicle Specs */}
        {currentStep === 3 && (
          <div className="space-y-4 text-xs">
            <h3 className="text-sm font-extrabold text-foreground">Step 3: Vehicle Specifications & RTO</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="font-bold text-foreground block mb-1">Registration Number *</label>
                <input
                  type="text"
                  value={regNo}
                  onChange={(e) => setRegNo(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-background font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-foreground block mb-1">Engine Number *</label>
                <input
                  type="text"
                  value={engineNo}
                  onChange={(e) => setEngineNo(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-background font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-foreground block mb-1">Chassis Number *</label>
                <input
                  type="text"
                  value={chassisNo}
                  onChange={(e) => setChassisNo(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-background font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-foreground block mb-1">RTO Code *</label>
                <input
                  type="text"
                  value={rtoCode}
                  onChange={(e) => setRtoCode(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-background font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-foreground block mb-1">Ex-Showroom Price (₹) *</label>
                <input
                  type="number"
                  value={exShowroom}
                  onChange={(e) => setExShowroom(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border bg-background font-semibold"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Policy Type */}
        {currentStep === 4 && (
          <div className="space-y-4 text-xs">
            <h3 className="text-sm font-extrabold text-foreground">Step 4: Select Policy Type</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { id: 'COMPREHENSIVE', title: 'Comprehensive Package', desc: 'Own Damage + Third Party Cover' },
                { id: 'STANDALONE_OD', title: 'Standalone Own Damage', desc: 'OD Cover for vehicles with active TP' },
                { id: 'THIRD_PARTY', title: 'Third Party Only', desc: 'Mandatory Legal Liability Cover' },
              ].map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedPolicyType(p.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    selectedPolicyType === p.id
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'hover:border-primary/50'
                  }`}
                >
                  <Shield className="h-6 w-6 text-primary mb-2" />
                  <div className="font-extrabold text-foreground">{p.title}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{p.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Previous Policy */}
        {currentStep === 5 && (
          <div className="space-y-4 text-xs">
            <h3 className="text-sm font-extrabold text-foreground">Step 5: Previous Policy & NCB Grid</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="font-bold text-foreground block mb-1">Previous Insurer</label>
                <input
                  type="text"
                  value={prevInsurer}
                  onChange={(e) => setPrevInsurer(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-background"
                />
              </div>
              <div>
                <label className="font-bold text-foreground block mb-1">Previous Policy #</label>
                <input
                  type="text"
                  value={prevPolicyNo}
                  onChange={(e) => setPrevPolicyNo(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-background font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-foreground block mb-1">Applicable NCB %</label>
                <select
                  value={ncbPercent}
                  onChange={(e) => setNcbPercent(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border bg-background font-semibold"
                >
                  <option value={0}>0% NCB (New / Claimed)</option>
                  <option value={20}>20% NCB (1 Claim-free Year)</option>
                  <option value={25}>25% NCB (2 Claim-free Years)</option>
                  <option value={35}>35% NCB (3 Claim-free Years)</option>
                  <option value={45}>45% NCB (4 Claim-free Years)</option>
                  <option value={50}>50% NCB (5+ Claim-free Years)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Add-on Selection */}
        {currentStep === 6 && (
          <div className="space-y-4 text-xs">
            <h3 className="text-sm font-extrabold text-foreground">Step 6: Select Add-on Coverages</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'zeroDep', label: 'Zero Depreciation', cost: '₹1,950' },
                { key: 'engineProtect', label: 'Engine Protector', cost: '₹1,050' },
                { key: 'rsa', label: 'Roadside Assistance (RSA)', cost: '₹299' },
                { key: 'consumables', label: 'Consumables Cover', cost: '₹450' },
                { key: 'rti', label: 'Return to Invoice (RTI)', cost: '₹1,350' },
              ].map((addon) => {
                const isChecked = (selectedAddons as any)[addon.key];
                return (
                  <div
                    key={addon.key}
                    onClick={() =>
                      setSelectedAddons((prev) => ({ ...prev, [addon.key]: !isChecked }))
                    }
                    className={`p-3.5 rounded-2xl border cursor-pointer flex items-center justify-between ${
                      isChecked
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600'
                        : 'bg-card hover:border-accent'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-foreground">{addon.label}</div>
                      <div className="text-[10px] text-muted-foreground">{addon.cost}</div>
                    </div>
                    {isChecked && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 7 & 8: Quotes & Comparison */}
        {(currentStep === 7 || currentStep === 8) && (
          <div className="space-y-4 text-xs">
            <h3 className="text-sm font-extrabold text-foreground">
              Step {currentStep}: Multi-Company Quotation & Comparison Matrix
            </h3>
            {calculateQuotesMutation.isPending ? (
              <div className="p-8 text-center text-muted-foreground animate-pulse">
                Evaluating premiums across partner insurers...
              </div>
            ) : calculatedQuotes.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No quotes generated. Click Next to calculate.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {calculatedQuotes.map((q) => {
                  const isSel = selectedQuote?.insurerId === q.insurerId;
                  return (
                    <div
                      key={q.insurerId}
                      onClick={() => setSelectedQuote(q)}
                      className={`p-4 rounded-2xl border cursor-pointer space-y-3 transition-all ${
                        isSel
                          ? 'border-primary bg-primary/10 ring-1 ring-primary shadow-md'
                          : 'hover:border-primary/50 bg-card'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-sm text-foreground">{q.logo}</span>
                        {q.isRecommended && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/10 text-amber-600">
                            BEST MATCH
                          </span>
                        )}
                      </div>
                      <div className="font-extrabold text-xs text-foreground">{q.insurerName}</div>
                      <div className="text-lg font-black text-emerald-600">₹{q.totalPremium}</div>
                      <div className="text-[10px] text-muted-foreground">IDV: ₹{q.idv}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 9: Proposal */}
        {currentStep === 9 && (
          <div className="space-y-4 text-xs">
            <h3 className="text-sm font-extrabold text-foreground">Step 9: Underwriting Proposal Preview</h3>
            <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
              <div className="font-bold text-foreground">Selected Quote: {selectedQuote?.insurerName || 'HDFC ERGO'}</div>
              <div>Vehicle: {regNo} (Ex-Showroom: ₹{exShowroom})</div>
              <div className="text-emerald-600 font-extrabold text-sm">Final Payable Premium: ₹{selectedQuote?.totalPremium || 18500}</div>
            </div>
          </div>
        )}

        {/* Step 10: Payment */}
        {currentStep === 10 && (
          <div className="space-y-4 text-xs">
            <h3 className="text-sm font-extrabold text-foreground">Step 10: Payment Receipt Capture</h3>
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <div>
                <label className="font-bold text-foreground block mb-1">Payment Method</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-background font-semibold"
                >
                  <option value="UPI">UPI / QR Code</option>
                  <option value="CARD">Credit / Debit Card</option>
                  <option value="NEFT">NEFT / Bank Transfer</option>
                  <option value="CASH">Cash Deposit</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-foreground block mb-1">Reference # / UTR</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-background font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 11: Policy Issued */}
        {currentStep === 11 && (
          <div className="p-8 text-center space-y-4 text-xs">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto animate-bounce" />
            <h2 className="text-xl font-black text-foreground">Policy Issued Successfully!</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Policy Number: <strong className="text-primary font-mono">{issuedPolicyData?.policy?.policyNumber || 'POL-99812401'}</strong> has been provisioned. Automated 365-day Renewal Schedule has been created in your Work Queue.
            </p>

            <div className="flex items-center justify-center space-x-3 pt-4">
              <button
                onClick={() => window.open(issuedPolicyData?.downloadUrl || '#', '_blank')}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-extrabold flex items-center space-x-1.5 shadow-xs"
              >
                <Download className="h-4 w-4" />
                <span>Download Policy PDF</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Navigation Buttons */}
        {currentStep < 11 && (
          <div className="flex items-center justify-between pt-6 border-t mt-6">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentStep === 1}
              className="px-4 py-2 text-xs font-semibold rounded-xl border hover:bg-accent disabled:opacity-40"
            >
              Previous
            </button>

            {currentStep === 10 ? (
              <button
                type="button"
                onClick={() => issuePolicyMutation.mutate()}
                disabled={issuePolicyMutation.isPending}
                className="px-5 py-2 text-xs font-extrabold rounded-xl bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
              >
                {issuePolicyMutation.isPending ? 'Issuing Policy...' : 'Confirm Payment & Issue Policy'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2 text-xs font-extrabold rounded-xl bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 flex items-center space-x-1.5"
              >
                <span>Continue</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Inline Register Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card w-full max-w-md rounded-3xl border shadow-2xl p-6 text-card-foreground animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div>
                <h3 className="text-base font-black tracking-tight">Register New Customer</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Instant registration for Motor Insurance proposal</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(false)}
                className="p-1 rounded-lg hover:bg-accent transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-foreground block mb-1">Customer Type *</label>
                <select
                  value={newCustType}
                  onChange={(e) => setNewCustType(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-background font-semibold"
                >
                  <option value="INDIVIDUAL">Individual Policyholder</option>
                  <option value="CORPORATE">Corporate / Commercial</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Full Name *</label>
                <input
                  required
                  type="text"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="e.g. Vikramaditya Patil"
                  className="w-full p-2.5 rounded-xl border bg-background"
                />
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Mobile Number *</label>
                <input
                  required
                  type="text"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full p-2.5 rounded-xl border bg-background font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  value={newCustEmail}
                  onChange={(e) => setNewCustEmail(e.target.value)}
                  placeholder="vikram@jestpolicy.com"
                  className="w-full p-2.5 rounded-xl border bg-background"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-4 py-2 rounded-xl border font-bold text-foreground hover:bg-accent transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingCust}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-extrabold shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-all"
                >
                  {isCreatingCust ? 'Creating...' : 'Create & Select Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
