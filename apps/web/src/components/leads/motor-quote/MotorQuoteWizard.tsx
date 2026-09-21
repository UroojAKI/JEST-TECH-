'use client';

import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Save, Loader2, Car, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../../../lib/api-client';
import { leadsRepository } from '../../../repositories/leads.repository';

import { VehicleCategorySelector } from './VehicleCategorySelector';
import { VehicleDetailsForm } from './VehicleDetailsForm';
import { PolicyTypeSelector } from './PolicyTypeSelector';
import { PolicyFormTPOnlyForm } from './PolicyFormTP';
import { PolicyFormSAODForm } from './PolicyFormSAOD';
import { PolicyFormPackageForm } from './PolicyFormPackage';
import { PreviousPolicyForm } from './PreviousPolicyForm';
import { RuleEngineResult } from './RuleEngineResult';
import { InspectionDialog } from './InspectionDialog';
import { AgentSelector } from '../../agents/AgentSelector';

import { INSURER_OPTIONS, CATEGORY_LABEL, POLICY_TYPE_LABEL } from './motorFormConfig';
import type {
  VehicleCategory,
  PolicyType,
  ProposerDetails,
  PolicyFormTPOnly,
  PolicyFormSAOD,
  PolicyFormPackage,
  SavedMotorQuote,
  PreviousPolicyDetails,
  MotorRuleResult,
} from './motorFormTypes';

interface Props {
  isOpen: boolean;
  leadId?: string;
  contactId?: string;
  initialCategory?: VehicleCategory | null;
  cloneQuoteData?: { vehicleDetails?: any; proposerDetails?: any } | null;
  leadContact?: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    pan?: string;
    rm?: string;
  };
  onClose: () => void;
  onSaved: (quote: any) => void;
}

const STEPS = [
  { num: 1, label: 'Customer Info' },
  { num: 2, label: 'Vehicle Details' },
  { num: 3, label: 'Previous Policy' },
  { num: 4, label: 'Policy Type' },
  { num: 5, label: 'Rule Evaluation' },
  { num: 6, label: 'Premium & Coverages' },
];

function emptyProposer(contact?: Props['leadContact']): ProposerDetails {
  return {
    proposalDate: new Date().toISOString().slice(0, 10),
    leadSource: '',
    customerName: contact?.name || '',
    mobileNumber: contact?.phone || '',
    emailId: contact?.email || '',
    address: contact?.address || '',
    panNumber: contact?.pan || '',
    relationshipManager: contact?.rm || '',
  };
}

function emptyTP(): PolicyFormTPOnly {
  return {
    policyType: 'TP_ONLY',
    policyTenure: '',
    previousTPInsurerName: '',
    previousTPPolicyNumber: '',
    thirdPartyPremium: '',
    paCoverOwner: true,
    legalLiabilityPaidDriver: 'No',
    totalPremiumInclGST: '',
    policyStartDate: '',
    policyEndDate: '',
    commissionDiscountCalc: '',
  };
}

function emptySAOD(): PolicyFormSAOD {
  return {
    policyType: 'SAOD',
    tpVerification: {
      tpInsurer: '',
      tpPolicyNumber: '',
      tpStartDate: '',
      tpExpiryDate: '',
      verificationStatus: 'PENDING',
      verificationMethod: '',
      verifierNotes: '',
      evidenceDocumentUrl: '',
      verifiedByUserConfirmed: false,
    },
    activeTPInsurerName: '',
    activeTPPolicyNumberValidity: '',
    previousODInsurerName: '',
    previousODPolicyNumber: '',
    insuredDeclaredValue: '',
    ncbPercentage: '',
    claimInExpiringODPolicy: 'No',
    addonsSelected: [],
    odPremiumBase: '',
    odPremium: '',
    ncbDiscountAmount: '',
    addOnsPremium: '',
    gstAmount: '',
    totalPremiumInclGST: '',
    policyStartDate: '',
    policyEndDate: '',
    odCommissionPercent: '',
    commissionAmount: '',
    commissionDiscountCalc: '',
  };
}

function emptyPackage(): PolicyFormPackage {
  return {
    policyType: 'PACKAGE',
    policyTenure: '',
    insuredDeclaredValue: '',
    ncbPercentage: '',
    previousInsurerName: '',
    previousPolicyNumber: '',
    claimInExpiringPolicy: 'No',
    ownDamagePremium: '',
    thirdPartyPremium: '',
    paCoverOwner: true,
    addonsSelected: [],
    totalPremiumInclGST: '',
    policyStartDate: '',
    policyEndDate: '',
    tpCommissionCalc: '',
    odCommissionCalc: '',
    finalCommissionCalc: '',
  };
}

export function MotorQuoteWizard({ isOpen, leadId, contactId, initialCategory, cloneQuoteData, leadContact, onClose, onSaved }: Props) {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [insurerName, setInsurerName] = useState('');
  const [proposer, setProposer] = useState<ProposerDetails>(() => emptyProposer(leadContact));
  const [vehicleCategory, setVehicleCategory] = useState<VehicleCategory | null>(initialCategory || null);
  const [vehicleDetails, setVehicleDetails] = useState<Record<string, string>>({});
  
  const [previousPolicy, setPreviousPolicy] = useState<PreviousPolicyDetails>({
    policyExpiryDate: '',
    expiredMoreThan90Days: false,
    ownershipTransfer: false,
    claimInPreviousYear: false,
    eligibleNcbPercentage: 0,
  });
  
  const [policyType, setPolicyType] = useState<PolicyType | null>(null);
  
  const [ruleResult, setRuleResult] = useState<MotorRuleResult | null>(null);
  const [ruleLoading, setRuleLoading] = useState(false);
  
  const [tpForm, setTpForm] = useState<PolicyFormTPOnly>(emptyTP());
  const [saodForm, setSaodForm] = useState<PolicyFormSAOD>(emptySAOD());
  const [packageForm, setPackageForm] = useState<PolicyFormPackage>(emptyPackage());
  
  const [savedQuotationId, setSavedQuotationId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedAgentCode, setSelectedAgentCode] = useState<string>('');
  const [showInspectionDialog, setShowInspectionDialog] = useState(false);
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [prefilledFromLeadCode, setPrefilledFromLeadCode] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (cloneQuoteData) {
        setVehicleDetails(cloneQuoteData.vehicleDetails || {});
        setProposer(cloneQuoteData.proposerDetails || emptyProposer(leadContact));
        setStep(3); // Skip to Previous Policy
      } else {
        setVehicleDetails({});
        setProposer(emptyProposer(leadContact));
        setStep(1);
      }
      setIsSaving(false);
      setInsurerName('');
      setVehicleCategory(initialCategory || null);
      setPreviousPolicy({
        policyExpiryDate: '',
        expiredMoreThan90Days: false,
        ownershipTransfer: false,
        claimInPreviousYear: false,
        eligibleNcbPercentage: 0,
      });
      setPolicyType(null);
      setRuleResult(null);
      setTpForm(emptyTP());
      setSaodForm(emptySAOD());
      setPackageForm(emptyPackage());
      setSavedQuotationId(null);
      setSelectedAgentId('');
      setSelectedAgentCode('');
      setShowInspectionDialog(false);
      setPrefilledFromLeadCode(null);

      // Automatically fetch authoritative Lead Context when leadId is provided
      if (leadId && !cloneQuoteData) {
        setIsContextLoading(true);
        leadsRepository
          .getLeadContext(leadId)
          .then((ctx) => {
            if (ctx) {
              setPrefilledFromLeadCode(ctx.leadCode);
              if ((ctx as any).agentId) {
                setSelectedAgentId((ctx as any).agentId);
              }
              setProposer((prev) => ({
                ...prev,
                customerName: ctx.contact?.fullName || ctx.title || prev.customerName,
                mobileNumber: ctx.contact?.phone || prev.mobileNumber,
                emailId: ctx.contact?.email || prev.emailId,
                panNumber: ctx.contact?.panNumber || prev.panNumber,
                relationshipManager: ctx.assignedTo ? `${ctx.assignedTo.firstName} ${ctx.assignedTo.lastName}` : prev.relationshipManager,
                leadSource: ctx.source || prev.leadSource,
              }));

              if (ctx.vehicle) {
                setVehicleDetails((prev) => ({
                  ...prev,
                  registrationNumber: ctx.vehicle.registrationNumber || '',
                  make: ctx.vehicle.make || '',
                  model: ctx.vehicle.model || '',
                  variant: ctx.vehicle.variant || '',
                  fuelType: ctx.vehicle.fuelType || '',
                  manufacturingYear: ctx.vehicle.manufacturingYear ? String(ctx.vehicle.manufacturingYear) : '',
                  engineNumber: ctx.vehicle.engineNumber || '',
                  chassisNumber: ctx.vehicle.chassisNumber || '',
                  rtoCode: ctx.vehicle.rtoCode || '',
                }));
              }
              toast.info(`Prefilled customer & vehicle data from Lead ${ctx.leadCode}`);
            }
          })
          .catch((err) => {
            console.warn('Failed to load lead context for prefill:', err);
          })
          .finally(() => {
            setIsContextLoading(false);
          });
      }
    }
  }, [isOpen, initialCategory, cloneQuoteData, leadContact, leadId]);

  useEffect(() => {
    if (leadContact && !cloneQuoteData) {
      setProposer((prev) => ({
        ...prev,
        customerName: leadContact.name || prev.customerName,
        mobileNumber: leadContact.phone || prev.mobileNumber,
        emailId: leadContact.email || prev.emailId,
        panNumber: leadContact.pan || prev.panNumber,
        address: leadContact.address || prev.address,
        relationshipManager: leadContact.rm || prev.relationshipManager,
      }));
    }
  }, [leadContact, cloneQuoteData]);

  if (!isOpen) return null;

  const registrationNumber = vehicleDetails['registrationNumber'] || vehicleDetails['regNumber'] || '';

  const canProceed = () => {
    if (step === 1) return !!(proposer.customerName && proposer.mobileNumber);
    if (step === 2) return !!vehicleCategory;
    if (step === 3) return !!previousPolicy.policyExpiryDate;
    if (step === 4) return !!policyType;
    if (step === 5) return !!ruleResult;
    if (step === 6) {
      if (policyType === 'SAOD') {
        const v = saodForm.tpVerification;
        if (!v.tpInsurer || !v.tpPolicyNumber || !v.tpStartDate || !v.tpExpiryDate) return false;
        if (!v.verificationMethod) return false;
        if (!v.verifiedByUserConfirmed) return false;
        if (new Date(v.tpExpiryDate) <= new Date()) return false;
      }
      return true;
    }
    return true;
  };

  const evaluateRules = async () => {
    setRuleLoading(true);
    try {
      let currentQuoteId = savedQuotationId;
      if (!currentQuoteId) {
        // Create initial draft quotation so rule evaluation is authoritatively recorded in database
        const prePayload = {
          vehicleCategory: vehicleCategory || 'PRIVATE_CAR',
          policyType: policyType || 'PACKAGE',
          registrationNumber: registrationNumber || '',
          insurerName: insurerName || 'Partner Insurer',
          leadId: leadId || undefined,
          contactId: contactId || undefined,
          agentId: selectedAgentId || undefined,
          totalPremium: getNetPayable() > 0 ? getNetPayable() : (getTotalPremium() || 1000),
          idv: getIDV() || 500000,
          ncbPercentage: getNCB(),
          proposerDetails: proposer,
          vehicleDetails,
          policyDetails: getPolicyDetails(),
          saodVerification: policyType === 'SAOD' ? {
            tpInsurer: 'DRAFT_INSURER',
            tpPolicyNumber: 'DRAFT123',
            tpStartDate: new Date().toISOString(),
            tpExpiryDate: new Date(Date.now() + 86400000).toISOString(),
          } : undefined,
          status: 'DRAFT',
        };
        const preRes = await apiClient.post('/quotations/motor-capture', prePayload);
        currentQuoteId = preRes.data?.id;
        setSavedQuotationId(currentQuoteId);
      }

      if (currentQuoteId) {
        const res = await apiClient.post(`/motor/quotations/${currentQuoteId}/previous-policy`, {
          ...previousPolicy,
          newPolicyType: policyType || 'PACKAGE',
          newInsurerName: insurerName,
        });
        setRuleResult(res.data?.ruleEvaluation || res.data);
      }
    } catch (e: any) {
      console.error('Rule engine API error:', e);
      toast.error(e?.response?.data?.message || 'Failed to evaluate underwriting rules on server.');
    } finally {
      setRuleLoading(false);
    }
  };

  const handleNext = async () => {
    if (!canProceed()) {
      toast.error('Please fill all mandatory fields before proceeding.');
      return;
    }
    
    if (step === 2 && vehicleDetails.vehicleStatus === 'NEW') {
      setStep(4);
      return;
    }

    if (step === 4) {
      await evaluateRules();
      setStep(5);
      return;
    }
    
    setStep((s) => Math.min(s + 1, 6));
  };

  const handleBack = () => {
    if (step === 4 && vehicleDetails.vehicleStatus === 'NEW') {
      setStep(2);
      return;
    }
    setStep((s) => Math.max(s - 1, 1));
  };

  const getPolicyDetails = () => {
    if (policyType === 'TP_ONLY') return tpForm;
    if (policyType === 'SAOD') return saodForm;
    return packageForm;
  };

  const getTotalPremium = () => {
    const pd = getPolicyDetails() as any;
    return (
      parseFloat(pd.calculatedResult?.outputs?.totalPremium || pd.totalPremiumInclGST || '0') || 0
    );
  };

  const getNetPayable = () => {
    const pd = getPolicyDetails() as any;
    return (
      parseFloat(pd.calculatedResult?.outputs?.finalPayableAmount || pd.finalPayableAmount || '0') || 0
    );
  };

  const getGst = () => {
    const pd = getPolicyDetails() as any;
    if (pd.calculatedResult?.outputs?.totalGst !== undefined) {
      return parseFloat(pd.calculatedResult.outputs.totalGst) || 0;
    }
    if (pd.finalGstAmount) return parseFloat(pd.finalGstAmount) || 0;
    return 0;
  };

  const getIDV = () => {
    const pd = getPolicyDetails() as any;
    return parseFloat(pd.insuredDeclaredValue || '0') || 0;
  };

  const getNCB = () => {
    const pd = getPolicyDetails() as any;
    return parseInt(pd.ncbPercentage || '0') || 0;
  };

  const handleSave = async () => {
    if (!vehicleCategory || !policyType) {
      toast.error('Vehicle category and policy type are required');
      return;
    }
    
    const pDetails = getPolicyDetails() as any;
    if (pDetails.policyStartDate && pDetails.policyEndDate) {
      const start = new Date(pDetails.policyStartDate);
      const end = new Date(pDetails.policyEndDate);
      if (end < start) {
        toast.error('Policy End Date cannot be before Policy Start Date');
        return;
      }
    }

    setIsSaving(true);
    try {
      const calcResult = pDetails.calculatedResult || {};
      const outputs = calcResult.outputs || {};
      const payload = {
        vehicleCategory,
        policyType,
        registrationNumber: registrationNumber || '',
        insurerName: insurerName || 'Partner Insurer',
        leadId: leadId || undefined,
        contactId: contactId || undefined,
        agentId: selectedAgentId || undefined,
        basePremium: outputs.basePremium ?? outputs.netOdPremium ?? outputs.netTpPremium,
        discountAmount: outputs.discountAmount ?? outputs.ncbDiscountAmount,
        gstAmount: outputs.totalGst ?? getGst(),
        totalPremium: outputs.finalPayableAmount ?? outputs.totalPremium ?? (getNetPayable() > 0 ? getNetPayable() : getTotalPremium()),
        calculationVersion: calcResult.calculationVersion || '1.0',
        rateConfigurationVersion: calcResult.rateConfigurationVersion || '1.0',
        snapshotId: calcResult.snapshotId,
        inputHash: calcResult.inputHash,
        calculationSnapshot: calcResult,
        idv: getIDV(),
        ncbPercentage: getNCB(),
        proposerDetails: proposer,
        vehicleDetails,
        policyDetails: getPolicyDetails(),
        status: ruleResult?.inspectionRequired ? 'PENDING_INSPECTION' : 'READY_FOR_PROPOSAL',
        // SAOD Verification
        ...(policyType === 'SAOD' && saodForm.tpVerification ? {
          saodVerification: {
            tpInsurer: saodForm.tpVerification.tpInsurer,
            tpPolicyNumber: saodForm.tpVerification.tpPolicyNumber,
            tpStartDate: saodForm.tpVerification.tpStartDate,
            tpExpiryDate: saodForm.tpVerification.tpExpiryDate,
            verificationMethod: saodForm.tpVerification.verificationMethod,
            verifierNotes: saodForm.tpVerification.verifierNotes,
          },
        } : {}),
      };

      const res = await apiClient.post('/quotations/motor-capture', payload);
      const saved = res.data;
      setSavedQuotationId(saved.id);

      // Persist previous policy evaluation to backend rule engine & create inspection / tasks
      const evalRes = await apiClient.post(`/motor/quotations/${saved.id}/previous-policy`, {
        ...previousPolicy,
        newPolicyType: policyType || 'PACKAGE',
        newInsurerName: insurerName,
      });

      const isInspectionMandatory =
        evalRes.data?.ruleEvaluation?.inspectionRequired ||
        ruleResult?.inspectionRequired;

      if (isInspectionMandatory) {
        toast.warning(
          `Quotation ${saved.quotationCode || ''} requires pre-issuance vehicle inspection. Opening inspection capture...`,
        );
        setShowInspectionDialog(true);
      } else {
        toast.success(
          `Quotation ${saved.quotationCode || ''} generated successfully! Ready for proposal.`,
        );
        onSaved(saved);
        onClose();
      }
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        'Failed to generate quotation. Please verify required fields and try again.';
      toast.error(Array.isArray(errorMsg) ? errorMsg.join(' | ') : errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-card rounded-xl border border-border shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
        {/* Header - Professional */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-card">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-base text-foreground tracking-tight">Generate Motor Quotation</h2>
              <p className="text-xs text-muted-foreground font-medium">
                {vehicleCategory ? `${CATEGORY_LABEL[vehicleCategory]} ` : ''}
                {policyType ? `— ${POLICY_TYPE_LABEL[policyType]}` : ''}
                {registrationNumber ? ` | ${registrationNumber}` : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Professional Stepper */}
        <div className="px-6 py-4 border-b bg-muted/10">
          <div className="flex items-center gap-2 overflow-x-auto">
            {STEPS.map((s, idx) => {
              const isDone = step > s.num;
              const isActive = step === s.num;
              return (
                <React.Fragment key={s.num}>
                  <div className={`flex items-center gap-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                    isActive ? 'text-primary' :
                    isDone ? 'text-foreground' :
                    'text-muted-foreground'
                  }`}>
                    <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isActive ? 'bg-primary text-primary-foreground' :
                      isDone ? 'bg-foreground text-background' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {isDone ? '✓' : s.num}
                    </div>
                    {s.label}
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={`h-px w-6 mx-1 ${step > s.num ? 'bg-foreground' : 'bg-border'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Insurer Selector — persistent bar */}
        {step >= 4 && (
          <div className="px-6 py-3 border-b bg-card flex items-center gap-4">
            <label className="text-xs font-bold text-foreground">Partner Insurer</label>
            <select
              value={insurerName}
              onChange={(e) => setInsurerName(e.target.value)}
              className="flex-1 max-w-sm px-3 py-1.5 rounded-md border text-sm font-medium bg-background border-border focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
            >
              <option value="">— Select Insurer —</option>
              {INSURER_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
        )}

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-background">
          <div className="max-w-3xl mx-auto space-y-6">
            {step === 1 && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-foreground border-b pb-2">Customer Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Customer Name <span className="text-destructive">*</span></label>
                    <input
                      type="text"
                      value={proposer.customerName || ''}
                      onChange={(e) => setProposer({...proposer, customerName: e.target.value})}
                      className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Mobile Number <span className="text-destructive">*</span></label>
                    <input
                      type="tel"
                      maxLength={10}
                      value={proposer.mobileNumber || ''}
                      onChange={(e) => setProposer({...proposer, mobileNumber: e.target.value.replace(/\D/g, '')})}
                      className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="10-digit number"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Email Address</label>
                    <input
                      type="email"
                      value={proposer.emailId || ''}
                      onChange={(e) => setProposer({...proposer, emailId: e.target.value})}
                      className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2 pt-2 border-t border-border">
                    <AgentSelector
                      value={selectedAgentId}
                      onChange={(agentId, agentCode) => {
                        setSelectedAgentId(agentId);
                        setSelectedAgentCode(agentCode);
                      }}
                      label="Authoritative Assigned Agent (Ownership & Commission)"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              vehicleCategory ? (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-foreground border-b pb-2">Vehicle Details</h3>
                  <VehicleDetailsForm
                    category={vehicleCategory}
                    data={vehicleDetails}
                    onChange={setVehicleDetails}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-foreground border-b pb-2">Select Vehicle Category</h3>
                  <div className="text-sm text-muted-foreground mb-4">Please select the type of vehicle to correctly populate the underwriting fields.</div>
                  <VehicleCategorySelector selected={vehicleCategory} onChange={(cat) => {
                    setVehicleCategory(cat);
                    setVehicleDetails({});
                  }} />
                </div>
              )
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-foreground border-b pb-2">Previous Policy Details</h3>
                <PreviousPolicyForm 
                  value={previousPolicy} 
                  onChange={setPreviousPolicy} 
                  newPolicyType={policyType} 
                />
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-foreground border-b pb-2">Policy Type</h3>
                <PolicyTypeSelector selected={policyType} onChange={setPolicyType} />
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-foreground border-b pb-2">Rule Engine Evaluation</h3>
                <RuleEngineResult 
                  result={ruleResult} 
                  isLoading={ruleLoading} 
                  onRetry={evaluateRules} 
                />
                {ruleResult?.inspectionRequired && (
                  <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-amber-600 dark:text-amber-400">
                        Pre-Issuance Vehicle Inspection Required
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Policy gap over 90 days or break-in detected. 7 real evidence photos must be captured.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowInspectionDialog(true)}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 shadow-xs"
                    >
                      Conduct Inspection Now
                    </button>
                  </div>
                )}
              </div>
            )}

            {step === 6 && vehicleCategory && policyType && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-foreground border-b pb-2">Premium & Coverages</h3>
                {policyType === 'TP_ONLY' && (
                  <PolicyFormTPOnlyForm category={vehicleCategory} vehicleStatus={vehicleDetails.vehicleStatus === 'NEW' ? 'NEW' : 'EXISTING'} data={tpForm} onChange={setTpForm} />
                )}
                {policyType === 'SAOD' && (
                  <PolicyFormSAODForm data={saodForm} onChange={setSaodForm} />
                )}
                {policyType === 'PACKAGE' && (
                  <PolicyFormPackageForm category={vehicleCategory} vehicleStatus={vehicleDetails.vehicleStatus === 'NEW' ? 'NEW' : 'EXISTING'} data={packageForm} onChange={setPackageForm} />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Navigation - Professional */}
        <div className="px-6 py-4 border-t bg-card flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 1}
            className="px-4 py-2 rounded-md border bg-background font-medium text-sm text-foreground disabled:opacity-40 hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            Back
          </button>

          <div className="flex items-center gap-4">
            {getTotalPremium() > 0 && (
              <div className="hidden sm:flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded bg-muted">
                {getNetPayable() > 0 ? (
                  <>
                    <span className="text-foreground font-bold">Net Payable: ₹{getNetPayable().toLocaleString('en-IN')}</span>
                    <span className="text-muted-foreground border-l pl-2">Tax: ₹{getGst().toLocaleString('en-IN')}</span>
                    <span className="text-muted-foreground border-l pl-2 line-through">Total: ₹{getTotalPremium().toLocaleString('en-IN')}</span>
                  </>
                ) : (
                  <span className="text-foreground">Total: ₹{getTotalPremium().toLocaleString('en-IN')}</span>
                )}
                {getIDV() > 0 && <span className="text-muted-foreground border-l pl-2">IDV: ₹{getIDV().toLocaleString('en-IN')}</span>}
              </div>
            )}

            {step < 6 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-5 py-2 rounded-md bg-foreground text-background font-medium text-sm hover:bg-foreground/90 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-foreground/50"
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Generate Quotation
              </button>
            )}
          </div>
        </div>
      </div>

      {showInspectionDialog && savedQuotationId && (
        <InspectionDialog
          isOpen={true}
          quotationId={savedQuotationId}
          onClose={() => {
            setShowInspectionDialog(false);
            onClose();
          }}
          onSuccess={() => {
            setShowInspectionDialog(false);
            toast.success('Inspection evidence captured successfully!');
            onSaved({ id: savedQuotationId });
            onClose();
          }}
        />
      )}
    </div>
  );
}
