'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, ChevronRight, ChevronLeft, Save, Loader2, Car, Shield, UserCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, getApiErrorMessage, showApiErrorToast } from '../../../lib/api-client';
import { useQuery } from '@tanstack/react-query';
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
import { SaodTpVerificationCard } from './SaodTpVerificationCard';

import { INSURER_OPTIONS, CATEGORY_LABEL, POLICY_TYPE_LABEL, VEHICLE_FIELDS } from './motorFormConfig';
import { useInsurers } from '../../../hooks/useInsurers';
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
  MotorEligibilityContext,
} from './motorFormTypes';

interface Props {
  isOpen: boolean;
  leadId?: string;
  contactId?: string;
  customerId?: string;
  caseId?: string;
  initialCategory?: VehicleCategory | null;
  cloneQuoteData?: {
    vehicleDetails?: any;
    proposerDetails?: any;
    previousPolicyDetails?: any;
    category?: VehicleCategory;
    policyType?: PolicyType;
    caseId?: string;
    policyDetails?: any;
  } | null;
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
    pincode: (contact as any)?.pincode || '',
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

/**
 * Computes the canonical MotorEligibilityContext from wizard state.
 * This is the single source of truth for all form children — they must
 * not independently re-derive these values from partial props.
 *
 * Domain modes:
 *  - NEW vehicle: no previous policy, no claim/NCB, no inspection from expiry
 *  - NOT_AVAILABLE: previous policy declared unavailable — no insurer/policy number/claim/NCB
 *  - AVAILABLE: full previous policy flow — expiry, claim, NCB, insurer details
 */
function computeEligibilityContext(
  vehicleDetails: Record<string, string>,
  previousPolicy: PreviousPolicyDetails,
  ruleResult: MotorRuleResult | null,
): MotorEligibilityContext {
  const vehicleStatus = (vehicleDetails.vehicleStatus === 'NEW' ? 'NEW' : 'EXISTING') as 'NEW' | 'EXISTING';
  const previousPolicyStatus = (previousPolicy.previousPolicyType === 'NOT_AVAILABLE' ? 'NOT_AVAILABLE' : 'AVAILABLE') as 'AVAILABLE' | 'NOT_AVAILABLE';

  const isNew = vehicleStatus === 'NEW';
  const isNotAvailable = previousPolicyStatus === 'NOT_AVAILABLE';
  const previousPolicyApplicable = !isNew && !isNotAvailable;

  // NCB is applicable only when previous policy is available AND no claim AND no ownership-transfer AND not expired >90d
  const ncbApplicable = previousPolicyApplicable &&
    !previousPolicy.claimInPreviousYear &&
    !previousPolicy.ownershipTransfer &&
    !previousPolicy.expiredMoreThan90Days;

  return {
    vehicleStatus,
    previousPolicyStatus,
    previousPolicyApplicable,
    ncbApplicable,
    claimHistoryApplicable: previousPolicyApplicable,
    previousPolicyDetailsApplicable: previousPolicyApplicable,
    inspectionApplicable: ruleResult?.inspectionRequired === true,
  };
}


export function MotorQuoteWizard({ isOpen, leadId, contactId, customerId, caseId, initialCategory, cloneQuoteData, leadContact, onClose, onSaved }: Props) {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const { insurerOptions } = useInsurers();

  const { data: currentUserPreference } = useQuery({
    queryKey: ['current-user-contact-preference'],
    queryFn: async () => (await apiClient.get('/users/me')).data,
    enabled: isOpen,
    staleTime: 60_000,
  });
  // Form state
  const [insurerName, setInsurerName] = useState('');
  const [proposer, setProposer] = useState<ProposerDetails>(() => emptyProposer(leadContact));
  const [vehicleCategory, setVehicleCategory] = useState<VehicleCategory | null>(initialCategory || null);
  const [vehicleDetails, setVehicleDetails] = useState<Record<string, string>>({
    vehicleStatus: 'EXISTING',
  });
  
  const [previousPolicy, setPreviousPolicy] = useState<PreviousPolicyDetails>({
    previousPolicyType: 'COMPREHENSIVE',
    policyExpiryDate: '',
    expiredMoreThan90Days: false,
    ownershipTransfer: false,
    claimInPreviousYear: false,
    eligibleNcbPercentage: 0,
  });
  
  const [policyType, setPolicyType] = useState<PolicyType | null>(null);
  
  const [ruleResult, setRuleResult] = useState<MotorRuleResult | null>(null);
  const [ruleLoading, setRuleLoading] = useState(false);
  const [ruleEvaluationKey, setRuleEvaluationKey] = useState<string | null>(null);
  const ruleEvaluationRequestIdRef = useRef(0);
  
  const [tpForm, setTpForm] = useState<PolicyFormTPOnly>(emptyTP());
  const [saodForm, setSaodForm] = useState<PolicyFormSAOD>(emptySAOD());
  const [packageForm, setPackageForm] = useState<PolicyFormPackage>(emptyPackage());
  
  const [savedQuotationId, setSavedQuotationId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedAgentCode, setSelectedAgentCode] = useState<string>('');
  const [selectedAgentCodeSystem, setSelectedAgentCodeSystem] = useState<string>('');
  const selectedAgentPreferenceQuery = useQuery({
    queryKey: ['agent-contact-preference', selectedAgentId],
    queryFn: async () => (await apiClient.get(`/agents/${selectedAgentId}`)).data,
    enabled: isOpen && Boolean(selectedAgentId),
    staleTime: 60_000,
  });
  const agentCollectsContacts = selectedAgentId
    ? Boolean(selectedAgentPreferenceQuery.data?.user?.collectContacts ?? selectedAgentPreferenceQuery.data?.collectContacts)
    : Boolean(currentUserPreference?.collectContacts);

  const [isManualAgent, setIsManualAgent] = useState(false);
  const [manualAgentDetails, setManualAgentDetails] = useState<{ name: string; code?: string; phone?: string } | null>(null);
  // ── Identity Resolution & Multi-Vehicle Asset State ────────────────────────
  const [identityStatus, setIdentityStatus] = useState<'IDLE' | 'LOADING' | 'MATCH' | 'AMBIGUOUS' | 'NEW'>('IDLE');
  const [identityMatch, setIdentityMatch] = useState<any | null>(null);
  const [matchedVehicles, setMatchedVehicles] = useState<any[]>([]);
  const [resolvedCustomerId, setResolvedCustomerId] = useState<string | null>(customerId || null);
  const [resolvedContactId, setResolvedContactId] = useState<string | null>(contactId || null);
  const [vehicleSelectionMode, setVehicleSelectionMode] = useState<'EXISTING' | 'NEW'>('EXISTING');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  // Debounced Identity Resolution Lookup
  useEffect(() => {
    const mobile = (proposer.mobileNumber || '').replace(/\D/g, '').trim();
    const email = (proposer.emailId || '').trim();

    if (mobile.length !== 10 && !email.includes('@')) {
      setIdentityStatus('IDLE');
      setIdentityMatch(null);
      setMatchedVehicles([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIdentityStatus('LOADING');
      try {
        const res = await apiClient.post('/contacts/resolve-identity', {
          phone: mobile.length === 10 ? mobile : undefined,
          email: email.includes('@') ? email : undefined,
        });
        const data = res.data;
        if (data.status === 'MATCH') {
          setIdentityStatus('MATCH');
          setIdentityMatch(data);
          setResolvedCustomerId(data.customer?.id || null);
          setResolvedContactId(data.contact?.id || null);
          if (Array.isArray(data.vehicles) && data.vehicles.length > 0) {
            setMatchedVehicles(data.vehicles);
            setVehicleSelectionMode('EXISTING');
          } else {
            setMatchedVehicles([]);
            setVehicleSelectionMode('NEW');
          }
        } else if (data.status === 'AMBIGUOUS') {
          setIdentityStatus('AMBIGUOUS');
          setIdentityMatch(data);
        } else {
          setIdentityStatus('NEW');
          setIdentityMatch(null);
          setMatchedVehicles([]);
          setVehicleSelectionMode('NEW');
        }
      } catch {
        setIdentityStatus('IDLE');
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [proposer.mobileNumber, proposer.emailId]);
  const [journeyId, setJourneyId] = useState<string | null>(null);
  const [showInspectionDialog, setShowInspectionDialog] = useState(false);
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [prefilledFromLeadCode, setPrefilledFromLeadCode] = useState<string | null>(null);

  const steps = useMemo(() => [
    { num: 1, label: 'Customer Info' },
    { num: 2, label: 'Vehicle Details' },
    { num: 3, label: 'Previous Policy' },
    { num: 4, label: 'Policy Type' },
    { num: 5, label: policyType === 'SAOD' ? 'TP Verification & Eligibility' : 'Rule Evaluation' },
    { num: 6, label: 'Premium & Coverages' },
  ], [policyType]);

  // ── Clone / Comparison Pre-Fill Hydration ──────────────────────────────────
  useEffect(() => {
    if (cloneQuoteData) {
      if (cloneQuoteData.proposerDetails) {
        setProposer((prev) => ({ ...prev, ...cloneQuoteData.proposerDetails }));
      }
      if (cloneQuoteData.vehicleDetails) {
        setVehicleDetails((prev) => ({ ...prev, ...cloneQuoteData.vehicleDetails }));
      }
      if (cloneQuoteData.previousPolicyDetails) {
        setPreviousPolicy((prev) => ({ ...prev, ...cloneQuoteData.previousPolicyDetails }));
      }
      if (cloneQuoteData.category) {
        setVehicleCategory(cloneQuoteData.category);
      }
      if (cloneQuoteData.policyType) {
        setPolicyType(cloneQuoteData.policyType);
      }
      if (cloneQuoteData.policyDetails) {
        if (cloneQuoteData.policyType === 'SAOD') {
          setSaodForm((prev) => ({ ...prev, ...cloneQuoteData.policyDetails }));
        } else if (cloneQuoteData.policyType === 'PACKAGE') {
          setPackageForm((prev) => ({ ...prev, ...cloneQuoteData.policyDetails }));
        } else if (cloneQuoteData.policyType === 'TP_ONLY') {
          setTpForm((prev) => ({ ...prev, ...cloneQuoteData.policyDetails }));
        }
      }
      // Advance directly to Policy Type / Insurer selection
      setStep(4);
    }
  }, [cloneQuoteData]);

  // ── Canonical Eligibility Context ─────────────────────────────────────────
  // Computed ONCE here in the parent and passed to all form children.
  // Do NOT re-derive in children — they must consume this context as truth.
  const eligibilityContext = useMemo(
    () => computeEligibilityContext(vehicleDetails, previousPolicy, ruleResult),
    [vehicleDetails, previousPolicy, ruleResult],
  );

  // ── Domain Mode Normalization ──────────────────────────────────────────────
  // When vehicleStatus changes to NEW, clear all previous-policy state and
  // normalize premium form fields — prevent stale renewal data from leaking.
  useEffect(() => {
    if (vehicleDetails.vehicleStatus === 'NEW') {
      setPreviousPolicy({
        previousPolicyType: 'NOT_AVAILABLE',
        policyExpiryDate: '',
        expiredMoreThan90Days: false,
        ownershipTransfer: false,
        claimInPreviousYear: false,
        eligibleNcbPercentage: 0,
      });
      // Normalize premium form fields — NCB, claim, and previous insurer cleared
      setPackageForm((prev) => ({
        ...prev,
        ncbPercentage: '0',
        claimInExpiringPolicy: 'No',
        previousInsurerName: '',
        previousPolicyNumber: '',
      }));
      setTpForm((prev) => ({
        ...prev,
        previousTPInsurerName: '',
        previousTPPolicyNumber: '',
      }));
    }
  // Only trigger when vehicleStatus changes, not on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleDetails.vehicleStatus]);

  // ── Auto-Sync Previous Policy Details to Premium Forms ───────────────────
  // Whenever the previous policy details change (e.g. user fills Previous Policy section),
  // automatically sync those details into the corresponding fields of the Premium forms.
  useEffect(() => {
    if (vehicleDetails.vehicleStatus === 'NEW') return; // Handled by Domain Mode Normalization

    if (previousPolicy.previousPolicyType === 'NOT_AVAILABLE') {
      setPackageForm((prev) => ({
        ...prev,
        ncbPercentage: '0',
        claimInExpiringPolicy: 'No',
        previousInsurerName: '',
        previousPolicyNumber: '',
      }));
      setTpForm((prev) => ({
        ...prev,
        previousTPInsurerName: '',
        previousTPPolicyNumber: '',
      }));
      setSaodForm((prev) => ({
        ...prev,
        ncbPercentage: '0',
        claimInExpiringODPolicy: 'No',
        previousODInsurerName: '',
        previousODPolicyNumber: '',
      }));
    } else {
      setPackageForm((prev) => ({
        ...prev,
        ncbPercentage: previousPolicy.eligibleNcbPercentage.toString(),
        claimInExpiringPolicy: previousPolicy.claimInPreviousYear ? 'Yes' : 'No',
        previousInsurerName: previousPolicy.previousInsurerName || '',
        previousPolicyNumber: previousPolicy.previousPolicyNumber || '',
      }));

      setTpForm((prev) => ({
        ...prev,
        previousTPInsurerName: previousPolicy.previousInsurerName || '',
        previousTPPolicyNumber: previousPolicy.previousPolicyNumber || '',
      }));

      setSaodForm((prev) => ({
        ...prev,
        ncbPercentage: previousPolicy.eligibleNcbPercentage.toString(),
        claimInExpiringODPolicy: previousPolicy.claimInPreviousYear ? 'Yes' : 'No',
        previousODInsurerName: previousPolicy.previousOdInsurerName || previousPolicy.previousInsurerName || '',
        previousODPolicyNumber: previousPolicy.previousOdPolicyNumber || previousPolicy.previousPolicyNumber || '',
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    previousPolicy.previousPolicyType,
    previousPolicy.eligibleNcbPercentage,
    previousPolicy.claimInPreviousYear,
    previousPolicy.previousInsurerName,
    previousPolicy.previousPolicyNumber,
    previousPolicy.previousOdInsurerName,
    previousPolicy.previousOdPolicyNumber,
    vehicleDetails.vehicleStatus
  ]);

  useEffect(() => {
    if (isOpen) {
      if (cloneQuoteData) {
        setVehicleDetails(cloneQuoteData.vehicleDetails || {});
        setProposer(cloneQuoteData.proposerDetails || emptyProposer(leadContact));
        setStep(3); // Skip to Previous Policy
      } else {
        setVehicleDetails({ vehicleStatus: 'EXISTING' });
        setProposer(emptyProposer(leadContact));
        setStep(1);
      }
      setIsSaving(false);
      setInsurerName('');
      setVehicleCategory(initialCategory || null);
      setPreviousPolicy({
        previousPolicyType: 'COMPREHENSIVE',
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
      setIsManualAgent(false);
      setManualAgentDetails(null);
      setJourneyId(null);
      setShowInspectionDialog(false);
      setPrefilledFromLeadCode(null);

      // Initialize authoritative Motor Journey
      apiClient
        .post('/motor/journeys', {
          leadId: leadId && leadId !== 'new' ? leadId : undefined,
          vehicleCategory: initialCategory || undefined,
        })
        .then((res) => {
          if (res.data?.journeyId) {
            setJourneyId(res.data.journeyId);
          }
        })
        .catch((err) => {
          console.warn('Failed to initialize motor journey session:', err);
        });

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

  const registrationNumber = vehicleDetails['registrationNumber'] || vehicleDetails['regNumber'] || '';

  const canProceed = () => {
    if (step === 1) {
      // When the agent preference is loading, block until we have an authoritative answer.
      // Do NOT assume OFF while a request is in flight.
      if (selectedAgentId && selectedAgentPreferenceQuery.isLoading) return false;

      if (agentCollectsContacts) {
        // Preference is ON: name and mobile are required
        const name = (proposer.customerName || '').trim();
        const mobile = (proposer.mobileNumber || '').replace(/\D/g, '').trim();
        if (!name) return false;
        if (!mobile || mobile.length !== 10) return false;
      }
      // Preference is OFF (or no agent selected yet): allow proceeding
      return true;
    }
    if (step === 2) {
      if (!vehicleCategory) return false;
      const fields = VEHICLE_FIELDS[vehicleCategory] || [];
      const requiredFieldsValid = fields
        .filter((field) =>
          field.mandatory === true &&
          !(vehicleDetails.vehicleStatus === 'NEW' && field.key === 'registrationNumber')
        )
        .every((field) => Boolean(String(vehicleDetails[field.key] || '').trim()));
      const selectedTrailerValid =
        vehicleDetails.attachmentUsed === 'Trailer 1'
          ? Boolean(String(vehicleDetails.trailer1RegistrationNumber || '').trim())
          : vehicleDetails.attachmentUsed === 'Trailer 2'
            ? Boolean(String(vehicleDetails.trailer2RegistrationNumber || '').trim())
            : true;
      return requiredFieldsValid && selectedTrailerValid;
    }
    if (step === 3) {
      return (
        previousPolicy.previousPolicyType === 'NOT_AVAILABLE' ||
        !!previousPolicy.policyExpiryDate
      );
    }
    if (step === 4) return !!policyType;
    if (step === 5) {
      if (policyType === 'SAOD') {
        const v = saodForm.tpVerification;
        if (!v?.tpInsurer || !v?.tpPolicyNumber || !v?.tpStartDate || !v?.tpExpiryDate) return false;
        if (!v?.verificationMethod) return false;
        if (!v?.verifiedByUserConfirmed) return false;
        if (new Date(v.tpExpiryDate) <= new Date()) return false;
        if (ruleLoading || !ruleResult) return false;
        if (ruleResult.saodTpValid !== true || ruleResult.nextStep === 'TP_VERIFICATION') return false;
        return true;
      }
      return !!ruleResult && !ruleLoading;
    }
    if (step === 6) {
      if (policyType === 'SAOD') {
        const v = saodForm.tpVerification;
        if (!v?.tpInsurer || !v?.tpPolicyNumber || !v?.tpStartDate || !v?.tpExpiryDate) return false;
        if (!v?.verificationMethod) return false;
        if (!v?.verifiedByUserConfirmed) return false;
        if (new Date(v.tpExpiryDate) <= new Date()) return false;
        if (ruleLoading || !ruleResult || ruleResult.saodTpValid !== true || ruleResult.nextStep === 'TP_VERIFICATION') return false;
      }
      return true;
    }
    return true;
  };

  const buildRuleEvaluationPayload = () => ({
    journeyId: journeyId || undefined,
    newPolicyType: policyType || 'PACKAGE',
    vehicleStatus: vehicleDetails.vehicleStatus || 'EXISTING',
    previousPolicyType: previousPolicy.previousPolicyType,
    policyExpiryDate: previousPolicy.policyExpiryDate,
    claimInPreviousYear: previousPolicy.claimInPreviousYear,
    ownershipTransfer: previousPolicy.ownershipTransfer,
    previousPolicyTransferred: previousPolicy.previousPolicyTransferred,
    eligibleNcbPercentage: previousPolicy.eligibleNcbPercentage,
    // SAOD rule evaluation is bound to the current active TP verification,
    // never the unrelated previous-policy expiry.
    tpExpiryDate: policyType === 'SAOD'
      ? (saodForm.tpVerification?.tpExpiryDate || undefined)
      : (previousPolicy.tpExpiryDate || undefined),
    activeTpInsurer: policyType === 'SAOD' ? saodForm.tpVerification?.tpInsurer : undefined,
    activeTpPolicyNumber: policyType === 'SAOD' ? saodForm.tpVerification?.tpPolicyNumber : undefined,
    activeTpStartDate: policyType === 'SAOD' ? saodForm.tpVerification?.tpStartDate : undefined,
    activeTpVerificationMethod: policyType === 'SAOD' ? saodForm.tpVerification?.verificationMethod : undefined,
    activeTpVerificationStatus: policyType === 'SAOD' ? saodForm.tpVerification?.verificationStatus : undefined,
    activeTpVerifiedByUserConfirmed: policyType === 'SAOD' ? saodForm.tpVerification?.verifiedByUserConfirmed : undefined,
    odExpiryDate: previousPolicy.odExpiryDate,
    newOwnerName: previousPolicy.newOwnerName,
  });

  const evaluateRules = async (): Promise<boolean> => {
    const requestId = ++ruleEvaluationRequestIdRef.current;
    const payload = buildRuleEvaluationPayload();
    const evaluationKey = JSON.stringify(payload);
    setRuleLoading(true);
    setRuleResult(null);
    setRuleEvaluationKey(null);
    try {
      const res = await apiClient.post('/motor/rules/evaluate', payload);
      const evaluated = res.data?.ruleEvaluation || res.data;
      if (
        requestId !== ruleEvaluationRequestIdRef.current ||
        !evaluated ||
        !['QUOTATION', 'INSPECTION', 'TP_VERIFICATION'].includes(evaluated.nextStep)
      ) {
        return false;
      }
      setRuleResult(evaluated);
      setRuleEvaluationKey(evaluationKey);
      if (typeof evaluated.ncb === 'number') {
        const authoritativeNcbStr = String(evaluated.ncb);
        setPackageForm((prev) => ({ ...prev, ncbPercentage: authoritativeNcbStr }));
        setSaodForm((prev) => ({ ...prev, ncbPercentage: authoritativeNcbStr }));
      }
      return true;
    } catch (e: any) {
      if (requestId === ruleEvaluationRequestIdRef.current) {
        console.warn('Rule engine API error:', e);
        setRuleResult(null);
        setRuleEvaluationKey(null);
        const msg = e?.response?.data?.message;
        toast.error(
          Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to evaluate underwriting rules on server.')
        );
      }
      return false;
    } finally {
      if (requestId === ruleEvaluationRequestIdRef.current) {
        setRuleLoading(false);
      }
    }
  };

  // SAOD Step 5 (and Step 6) evaluates active-TP details automatically.
  // When active TP details change and are confirmed, re-evaluate underwriting
  // rules on the server so the agent can immediately continue.
  useEffect(() => {
    if (!isOpen || policyType !== 'SAOD' || (step !== 5 && step !== 6)) return;
    const tp = saodForm.tpVerification;
    const hasVerifiedActiveTp = Boolean(
      tp?.tpInsurer &&
      tp?.tpPolicyNumber &&
      tp?.tpStartDate &&
      tp?.tpExpiryDate &&
      tp?.verificationMethod &&
      tp?.verificationStatus === 'VERIFIED' &&
      tp?.verifiedByUserConfirmed &&
      new Date(tp.tpExpiryDate) > new Date()
    );
    if (!hasVerifiedActiveTp) {
      ++ruleEvaluationRequestIdRef.current;
      setRuleResult(null);
      setRuleEvaluationKey(null);
      setRuleLoading(false);
      return;
    }
    const timeoutId = setTimeout(() => {
      void evaluateRules();
    }, 200);
    return () => clearTimeout(timeoutId);
    // evaluateRules intentionally reads the current wizard state; listed
    // dependencies are the facts that invalidate an underwriting result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    policyType,
    step,
    journeyId,
    vehicleDetails.vehicleStatus,
    previousPolicy.previousPolicyType,
    previousPolicy.policyExpiryDate,
    previousPolicy.claimInPreviousYear,
    previousPolicy.ownershipTransfer,
    previousPolicy.previousPolicyTransferred,
    previousPolicy.eligibleNcbPercentage,
    previousPolicy.odExpiryDate,
    previousPolicy.newOwnerName,
    saodForm.tpVerification?.tpInsurer,
    saodForm.tpVerification?.tpPolicyNumber,
    saodForm.tpVerification?.tpStartDate,
    saodForm.tpVerification?.tpExpiryDate,
    saodForm.tpVerification?.verificationMethod,
    saodForm.tpVerification?.verificationStatus,
    saodForm.tpVerification?.verifiedByUserConfirmed,
  ]);

  const handleNext = async () => {
    if (!canProceed()) {
      toast.error('Please fill all mandatory fields before proceeding.');
      return;
    }
    
    if (step === 2 && vehicleDetails.vehicleStatus === 'NEW') {
      setStep(4);
      return;
    }

    if (step === 2 && vehicleDetails.vehicleStatus !== 'NEW') {
      const regNo = (vehicleDetails.registrationNumber || vehicleDetails.regNumber || '')
        .toUpperCase()
        .replace(/[\s\-\.]/g, '');
      if (regNo && regNo.length >= 6) {
        try {
          const res = await apiClient.get('/quotations/check-vehicle', {
            params: { registrationNumber: regNo },
          });
          if (res.data?.hasExisting) {
            toast.error(res.data.message || `Vehicle ${regNo} already has an active policy issued.`);
            return;
          }
        } catch (err: any) {
          console.warn('Vehicle check validation failed on step 2:', err);
        }
      }
    }

    if (step === 4) {
      if (policyType === 'SAOD') {
        setRuleResult(null);
        setRuleEvaluationKey(null);
        setStep(5);
        return;
      }
      const evaluated = await evaluateRules();
      if (evaluated) setStep(5);
      return;
    }

    if (step === 5) {
      if (policyType === 'SAOD') {
        const currentRuleKey = JSON.stringify(buildRuleEvaluationPayload());
        if (!ruleResult || ruleEvaluationKey !== currentRuleKey || !ruleResult.saodTpValid || ruleResult.nextStep === 'TP_VERIFICATION') {
          const evaluated = await evaluateRules();
          if (!evaluated) return;
        }
      }
      setStep(6);
      return;
    }
    
    setStep((s) => Math.min(s + 1, 6));
  };

  const handleBack = () => {
    if (step === 6 && policyType === 'SAOD') {
      setStep(5);
      return;
    }
    if (step === 5 && policyType === 'SAOD') {
      setRuleResult(null);
      setRuleEvaluationKey(null);
      setStep(4);
      return;
    }
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
      parseFloat(
        pd.calculatedResult?.outputs?.finalPayableAmount ||
        pd.calculatedResult?.outputs?.totalPremium ||
        pd.finalPayableAmount ||
        pd.totalPremiumInclGST ||
        '0'
      ) || 0
    );
  };

  const getTotalDiscount = () => {
    const pd = getPolicyDetails() as any;
    return parseFloat(pd.calculatedResult?.outputs?.totalDiscount || '0') || 0;
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
    if (vehicleDetails.vehicleStatus === 'NEW') return 0;
    if (previousPolicy.previousPolicyType === 'NOT_AVAILABLE') return 0;
    if (ruleResult && typeof ruleResult.ncb === 'number') return ruleResult.ncb;
    const pd = getPolicyDetails() as any;
    return parseInt(pd.ncbPercentage || '0') || 0;
  };

  const handleSave = async () => {
    if (!vehicleCategory || !policyType) {
      toast.error('Vehicle category and policy type are required');
      return;
    }

    if (policyType === 'SAOD') {
      const tp = saodForm.tpVerification;
      if (
        !tp?.tpInsurer || !tp.tpPolicyNumber || !tp.tpStartDate || !tp.tpExpiryDate ||
        !tp.verificationMethod || tp.verificationStatus !== 'VERIFIED' ||
        !tp.verifiedByUserConfirmed || new Date(tp.tpExpiryDate) <= new Date()
      ) {
        toast.error('Complete and confirm active TP policy verification before saving the SAOD quotation.');
        return;
      }
      const currentRuleKey = JSON.stringify(buildRuleEvaluationPayload());
      if (ruleLoading || !ruleResult || ruleEvaluationKey !== currentRuleKey) {
        toast.error('SAOD underwriting is still being evaluated for the current TP details. Wait for the current result before saving.');
        return;
      }
      if (ruleResult.nextStep === 'TP_VERIFICATION' || !ruleResult.saodTpValid) {
        toast.error('Active TP policy verification has not passed. Resolve the TP verification issue before saving.');
        return;
      }
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

    // Address and PIN code: Optional at quotation stage (DEC-06); validate format only if provided
    if (proposer.pincode && proposer.pincode.trim() && !/^[1-9][0-9]{5}$/.test(proposer.pincode.trim())) {
      toast.error('Customer PIN code must be a valid 6-digit postal code');
      return;
    }

    // REQ-5: Renewal quotations allowed only from 45 days before expiry
    const prevExpiryStr = (previousPolicy as any)?.policyExpiryDate;
    if (prevExpiryStr && (previousPolicy as any)?.previousPolicyType !== 'NOT_AVAILABLE') {
      const prevExpiry = new Date(prevExpiryStr);
      if (!isNaN(prevExpiry.getTime())) {
        const now = new Date();
        const daysToExpiry = Math.ceil((prevExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysToExpiry > 45) {
          toast.error(
            `New renewal quotations can only be generated within 45 days of policy expiry. Expiring policy has ${daysToExpiry} days remaining.`,
          );
          return;
        }
      }
    }

    const calcResult = pDetails.calculatedResult;
    const authoritativeTotal = Number(
      pDetails.totalPremiumOverride ??
      calcResult?.outputs?.finalPayableAmount ??
      calcResult?.outputs?.totalPremium,
    );
    if (
      !calcResult?.outputs ||
      !Number.isFinite(authoritativeTotal) ||
      authoritativeTotal <= 0
    ) {
      toast.error('Cannot save this quotation: a successful current server-side premium calculation is required. Resolve tariff, add-on, or discount errors and retry.');
      return;
    }

    if (vehicleDetails.vehicleStatus !== 'NEW' && registrationNumber) {
      const cleanReg = registrationNumber.toUpperCase().replace(/[\s\-\.]/g, '');
      if (cleanReg && cleanReg.length >= 6) {
        try {
          const checkRes = await apiClient.get('/quotations/check-vehicle', {
            params: { registrationNumber: cleanReg },
          });
          if (checkRes.data?.hasExisting) {
            toast.error(checkRes.data.message || `Vehicle ${cleanReg} already has an active policy issued.`);
            return;
          }
        } catch (err: any) {
          console.warn('Vehicle check validation failed on save:', err);
        }
      }
    }

    setIsSaving(true);
    try {
      const outputs = calcResult.outputs;
      const payload = {
        journeyId: journeyId || undefined,
        caseId: caseId || cloneQuoteData?.caseId || undefined,
        vehicleCategory,
        policyType,
        registrationNumber: registrationNumber || '',
        insurerName: insurerName || 'Partner Insurer',
        leadId: leadId && leadId !== 'new' ? leadId : undefined,
        contactId: resolvedContactId || contactId || undefined,
        customerId: resolvedCustomerId || customerId || undefined,
        vehicleId: selectedVehicleId || undefined,
        agentId: isManualAgent ? undefined : (selectedAgentId || undefined),
        externalAgentCode: !isManualAgent ? selectedAgentCode || undefined : undefined,
        agentCodeSystem: !isManualAgent ? selectedAgentCodeSystem || undefined : undefined,
        manualAgent: isManualAgent ? {
          isManual: true,
          name: manualAgentDetails?.name,
          code: manualAgentDetails?.code,
          contact: manualAgentDetails?.phone,
        } : undefined,
        basePremium: outputs.basePremium ?? outputs.netOdPremium ?? outputs.netTpPremium,
        discountAmount: outputs.totalDiscount ?? outputs.discountAmount ?? outputs.ncbDiscount ?? 0,
        gstAmount: outputs.totalGst ?? getGst(),
        totalPremium: pDetails.totalPremiumOverride ?? outputs.finalPayableAmount ?? outputs.totalPremium ?? (getNetPayable() > 0 ? getNetPayable() : getTotalPremium()),
        calculationVersion: calcResult.calculationVersion || '1.0',
        rateConfigurationVersion: calcResult.rateConfigurationVersion || '1.0',
        snapshotId: calcResult.snapshotId,
        inputHash: calcResult.inputHash,
        calculationSnapshot: calcResult,
        idv: getIDV(),
        ncbPercentage: getNCB(),
        proposerDetails: proposer,
        vehicleDetails,
        previousPolicyDetails: previousPolicy,
        policyDetails: getPolicyDetails(),
        // NOTE: Do NOT send `status` from the client. The backend (CreateMotorQuotationCommand)
        // runs its own MotorRuleEngineService evaluation and sets the authoritative workflowState.
        // Client-driven status is a security and correctness violation.
        // SAOD Verification
        ...(policyType === 'SAOD' && saodForm.tpVerification ? {
          saodVerification: {
            tpInsurer: saodForm.tpVerification.tpInsurer,
            tpPolicyNumber: saodForm.tpVerification.tpPolicyNumber,
            tpStartDate: saodForm.tpVerification.tpStartDate,
            tpExpiryDate: saodForm.tpVerification.tpExpiryDate,
            verificationMethod: saodForm.tpVerification.verificationMethod,
            verificationStatus: saodForm.tpVerification.verificationStatus,
            verifiedByUserConfirmed: saodForm.tpVerification.verifiedByUserConfirmed,
            evidenceDocumentUrl: saodForm.tpVerification.evidenceDocumentUrl || undefined,
            verifierNotes: saodForm.tpVerification.verifierNotes,
          },
        } : {}),
      };

      // Single authoritative transactional quotation creation
      const res = await apiClient.post('/quotations/motor-capture', payload);
      const saved = res.data;
      setSavedQuotationId(saved.id);

      const isInspectionMandatory =
        saved.workflowState === 'INSPECTION_REQUIRED' ||
        saved.status === 'PENDING_INSPECTION' ||
        ruleResult?.inspectionRequired === true;

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
      const responseData = err.response?.data;
      const status = err.response?.status;
      const errorCode = responseData?.error?.errorCode || responseData?.errorCode;

      console.warn('Failed to capture motor quotation:', {
        message: err?.message,
        status,
        code: err?.code,
        errorCode,
        data: responseData,
        url: err?.config?.url,
      });

      // 1. Connection / Network / Offline Backend check
      if (
        err?.code === 'ERR_NETWORK' ||
        !err.response ||
        (status === 500 && (!responseData || (typeof responseData === 'object' && Object.keys(responseData).length === 0)))
      ) {
        toast.error(
          'Unable to reach backend service. Please ensure that the API server (http://localhost:4000) and database are running.',
        );
        return;
      }

      // 2. Conflict: Policy already running for this vehicle (Requirement 8)
      if (errorCode === 'VEHICLE_POLICY_ALREADY_RUNNING' || status === 409) {
        const policyNo = responseData?.error?.policyNumber || responseData?.policyNumber;
        const renewalDate = responseData?.error?.formattedRenewalDate || responseData?.formattedRenewalDate;
        toast.error(
          responseData?.error?.message ||
          responseData?.message ||
          (policyNo
            ? 'Vehicle already has an active policy issued (' + policyNo + (renewalDate ? ', expires ' + renewalDate : '') + '). Cannot issue a duplicate policy.'
            : 'A policy is already active for this vehicle.'),
        );
        return;
      }

      // 3. Contact details required by assigned agent
      if (errorCode === 'CONTACT_COLLECTION_REQUIRED') {
        const missing = responseData?.error?.missingFields || responseData?.missingFields || ['Customer Name', 'Mobile Number'];
        toast.error(
          'Customer details required: Please provide ' + (Array.isArray(missing) ? missing.join(' and ') : missing) + ' in Step 1.',
        );
        return;
      }

      // 4. Default user-friendly error toast preserving entered data
      showApiErrorToast(err, 'Failed to generate quotation. Please review the entered details and retry.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

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
            {steps.map((s, idx) => {
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
                      {isDone ? 'âœ“' : s.num}
                    </div>
                    {s.label}
                  </div>
                  {idx < steps.length - 1 && (
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
              {insurerOptions.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
        )}

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-background">
          <div className="max-w-3xl mx-auto space-y-6">
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-bold text-foreground">Customer Basic Information</h3>
                  {identityStatus === 'LOADING' && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying identity…
                    </span>
                  )}
                </div>

                {/* Live Identity Resolution Feedback */}
                {identityStatus === 'MATCH' && identityMatch && (
                  <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                        <span>Existing Customer: {identityMatch.customer?.firstName || identityMatch.contact?.firstName} {identityMatch.customer?.lastName || identityMatch.contact?.lastName}</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-200/50 dark:bg-emerald-800/40">
                          {identityMatch.customer?.customerCode || identityMatch.contact?.contactCode}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const c = identityMatch.customer || identityMatch.contact;
                          setProposer((prev) => ({
                            ...prev,
                            customerName: `${c.firstName || ''} ${c.lastName || ''}`.trim() || prev.customerName,
                            address: c.addressLine1 || c.address || prev.address,
                            pincode: c.pincode || prev.pincode,
                            panNumber: c.panNumber || prev.panNumber,
                          }));
                          toast.success('Customer details auto-filled from verified record.');
                        }}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
                      >
                        Auto-Fill Details
                      </button>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                      <span>Phone: <strong className="text-foreground">{identityMatch.customer?.mobile || identityMatch.contact?.phone || '—'}</strong></span>
                      <span>Email: <strong className="text-foreground">{identityMatch.customer?.email || identityMatch.contact?.email || '—'}</strong></span>
                      <span>Registered Assets: <strong className="text-foreground">{matchedVehicles.length} vehicle(s)</strong></span>
                    </div>
                  </div>
                )}

                {identityStatus === 'AMBIGUOUS' && identityMatch && (
                  <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs space-y-1">
                    <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                      <span>Identity Conflict Detected</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {identityMatch.conflictReason || 'The phone and email correspond to different customers. Please verify details to prevent incorrect association.'}
                    </p>
                  </div>
                )}

                {identityStatus === 'NEW' && (
                  <div className="p-2.5 rounded-lg border border-primary/20 bg-primary/5 text-xs text-primary font-medium flex items-center gap-2">
                    <UserCheck className="h-4 w-4 flex-shrink-0" />
                    <span>New Customer — Will be registered automatically in CRM when quotation is saved. No prior customer setup required.</span>
                  </div>
                )}
                {selectedAgentId && selectedAgentPreferenceQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading agent contact-collection preference…
                  </div>
                ) : agentCollectsContacts ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                    <span className="font-bold">Contact collection ON:</span> Customer name and mobile number are required before proceeding.
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Contact collection is <span className="font-semibold">OFF</span> for this agent. Name, mobile and email are optional.
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Customer Name {agentCollectsContacts ? <span className="text-red-500 ml-0.5">*</span> : <span className="text-muted-foreground/60">(Optional)</span>}
                    </label>
                    <input
                      type="text"
                      value={proposer.customerName || ''}
                      onChange={(e) => setProposer({...proposer, customerName: e.target.value})}
                      className={`w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 ${agentCollectsContacts && !(proposer.customerName || '').trim() ? 'border-red-400' : ''}`}
                      placeholder="e.g. John Doe"
                    />
                    {agentCollectsContacts && !(proposer.customerName || '').trim() && (
                      <p className="text-[10px] text-red-500">Customer name is required</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Mobile Number {agentCollectsContacts ? <span className="text-red-500 ml-0.5">*</span> : <span className="text-muted-foreground/60">(Optional)</span>}
                    </label>
                    <input
                      type="tel"
                      maxLength={10}
                      value={proposer.mobileNumber || ''}
                      onChange={(e) => setProposer({...proposer, mobileNumber: e.target.value.replace(/\D/g, '')})}
                      className={`w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 ${agentCollectsContacts && (proposer.mobileNumber || '').replace(/\D/g,'').length !== 10 ? 'border-red-400' : ''}`}
                      placeholder="10-digit number"
                    />
                    {agentCollectsContacts && (proposer.mobileNumber || '').replace(/\D/g,'').length !== 10 && (proposer.mobileNumber || '') !== '' && (
                      <p className="text-[10px] text-red-500">Valid 10-digit mobile number is required</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Email Address <span className="text-muted-foreground/60">(Optional)</span></label>
                    <input
                      type="email"
                      value={proposer.emailId || ''}
                      onChange={(e) => setProposer({...proposer, emailId: e.target.value})}
                      className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">
                      PIN Code <span className="text-muted-foreground/60">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={proposer.pincode || ''}
                      onChange={(e) => setProposer({...proposer, pincode: e.target.value.replace(/\D/g, '').slice(0, 6)})}
                      className={`w-full px-3 py-2 rounded-md border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 ${proposer.pincode && !/^[1-9][0-9]{5}$/.test(proposer.pincode.trim()) ? 'border-red-400' : ''}`}
                      placeholder="6-digit PIN (e.g. 400001)"
                    />
                    {proposer.pincode && !/^[1-9][0-9]{5}$/.test(proposer.pincode.trim()) && (
                      <p className="text-[10px] text-red-500">Must be a valid 6-digit Indian PIN code</p>
                    )}
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Communication Address <span className="text-muted-foreground/60">(Optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={proposer.address || ''}
                      onChange={(e) => setProposer({...proposer, address: e.target.value})}
                      className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                      placeholder="Full communication street address, building, locality (Optional for quotation; required at policy issuance)"
                    />
                    {proposer.address && proposer.address.trim().length > 0 && proposer.address.trim().length < 5 && (
                      <p className="text-[10px] text-red-500">Address must be at least 5 characters in length</p>
                    )}
                  </div>
                  <div className="space-y-1.5 md:col-span-2 pt-2 border-t border-border">
                    <AgentSelector
                      value={selectedAgentId}
                      onChange={(agentId, agentCode, codeSystem) => {
                        setSelectedAgentId(agentId);
                        setSelectedAgentCode(agentCode);
                        setSelectedAgentCodeSystem(codeSystem || '');
                      }}
                      isManualAgent={isManualAgent}
                      manualAgentName={manualAgentDetails?.name}
                      onManualAgentChange={(manual, details) => {
                        setIsManualAgent(manual);
                        if (details) setManualAgentDetails(details);
                      }}
                      label="Authoritative Assigned Agent (Ownership & Commission)"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                {matchedVehicles.length > 0 && (
                  <div className="flex items-center gap-2 p-1 bg-muted/40 rounded-lg border w-fit">
                    <button
                      type="button"
                      onClick={() => setVehicleSelectionMode('EXISTING')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                        vehicleSelectionMode === 'EXISTING'
                          ? 'bg-primary text-primary-foreground shadow'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Select Existing Vehicle ({matchedVehicles.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVehicleSelectionMode('NEW');
                        setSelectedVehicleId(null);
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                        vehicleSelectionMode === 'NEW'
                          ? 'bg-primary text-primary-foreground shadow'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      + Add New Vehicle
                    </button>
                  </div>
                )}

                {matchedVehicles.length > 0 && vehicleSelectionMode === 'EXISTING' ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-foreground border-b pb-2">Customer Registered Vehicles</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {matchedVehicles.map((v) => {
                        const isSelected = selectedVehicleId === v.id;
                        return (
                          <div
                            key={v.id}
                            onClick={() => {
                              setSelectedVehicleId(v.id);
                              setVehicleCategory(v.category as VehicleCategory);
                              setVehicleDetails({
                                vehicleStatus: 'EXISTING',
                                registrationNumber: v.registrationNumber || '',
                                makeModel: v.makeModel || '',
                                fuelType: v.fuelType || '',
                                manufactureYearMonth: v.manufactureYearMonth || '',
                                dateOfRegistration: v.dateOfRegistration ? new Date(v.dateOfRegistration).toISOString().slice(0, 10) : '',
                                engineNumber: v.engineNumber || '',
                                chassisNumber: v.chassisNumber || '',
                                rtoLocation: v.rtoLocation || '',
                              });
                              if (v.activePolicyNumber || v.activeInsurerName) {
                                setPreviousPolicy((prev) => ({
                                  ...prev,
                                  previousPolicyType: ((v.activePolicyType as any) || 'COMPREHENSIVE') as any,
                                  previousInsurerName: v.activeInsurerName || '',
                                  previousPolicyNumber: v.activePolicyNumber || '',
                                  policyExpiryDate: v.expiryDate ? v.expiryDate.slice(0, 10) : '',
                                }));
                              }
                            }}
                            className={`p-4 rounded-xl border cursor-pointer transition-all ${
                              isSelected
                                ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm'
                                : 'hover:border-foreground/30 hover:bg-muted/20'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-sm text-foreground">
                                {v.registrationNumber || 'Unregistered'}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground uppercase">
                                {v.category}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-foreground mt-1">{v.makeModel || 'Standard Specs'}</p>
                            <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                              <span>Fuel: <strong className="text-foreground">{v.fuelType || '—'}</strong></span>
                              {v.activePolicyStatus && (
                                <span>Policy: <strong className="text-emerald-600">{v.activePolicyStatus}</strong></span>
                              )}
                            </div>
                            {isSelected && (
                              <div className="mt-2.5 text-xs font-bold text-primary flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Selected for Quotation
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : vehicleCategory ? (
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
                      setVehicleDetails({ vehicleStatus: 'EXISTING' });
                    }} />
                  </div>
                )}
              </div>
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
                <PolicyTypeSelector
                  selected={policyType}
                  onChange={setPolicyType}
                  vehicleStatus={vehicleDetails.vehicleStatus}
                />
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-foreground border-b pb-2">
                  {policyType === 'SAOD' ? 'Active TP Verification & Eligibility' : 'Rule Engine Evaluation'}
                </h3>

                {policyType === 'SAOD' && (
                  <div className="space-y-4">
                    <div className="rounded-lg border bg-card p-3 space-y-1">
                      <h4 className="text-xs font-bold text-foreground">Active Third-Party Policy Verification</h4>
                      <p className="text-[11px] text-muted-foreground">
                        A Standalone Own Damage (SAOD) policy legally requires an active Third-Party policy in force. Enter and confirm the active TP details below to verify eligibility.
                      </p>
                    </div>

                    <SaodTpVerificationCard
                      value={saodForm.tpVerification}
                      onChange={(updated) => {
                        setSaodForm((prev) => ({
                          ...prev,
                          tpVerification: updated,
                          activeTPInsurerName: updated.tpInsurer,
                          activeTPPolicyNumberValidity: `${updated.tpPolicyNumber} | Valid Till ${updated.tpExpiryDate}`,
                        }));
                      }}
                    />

                    {saodForm.tpVerification?.verificationStatus === 'VERIFIED' &&
                    saodForm.tpVerification?.verifiedByUserConfirmed ? (
                      <RuleEngineResult
                        result={ruleResult}
                        isLoading={ruleLoading}
                        onRetry={() => { void evaluateRules(); }}
                      />
                    ) : (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300" role="status">
                        Complete all mandatory active TP details, ensure expiry date is in the future, and click &quot;I confirm this TP policy is active and verified&quot; to run underwriting checks.
                      </div>
                    )}
                  </div>
                )}

                {policyType !== 'SAOD' && (
                  <>
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
                  </>
                )}
              </div>
            )}

            {step === 6 && vehicleCategory && policyType && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-foreground border-b pb-2">Premium & Coverages</h3>
                {policyType === 'TP_ONLY' && (
                  <PolicyFormTPOnlyForm
                    category={vehicleCategory}
                    vehicleStatus={vehicleDetails.vehicleStatus === 'NEW' ? 'NEW' : 'EXISTING'}
                    data={tpForm}
                    onChange={setTpForm}
                    eligibility={eligibilityContext}
                  />
                )}
                {policyType === 'SAOD' && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                        <Shield className="h-4 w-4" />
                        Active TP Policy Details (SAOD)
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Edit these details here without leaving the quotation. Changes invalidate the previous verification and require confirmation again.
                      </p>
                    </div>
                    <SaodTpVerificationCard
                      key="saod-active-tp-quotation"
                      value={saodForm.tpVerification}
                      onChange={(updated) => {
                        setSaodForm((prev) => ({
                          ...prev,
                          tpVerification: updated,
                          activeTPInsurerName: updated.tpInsurer,
                          activeTPPolicyNumberValidity: `${updated.tpPolicyNumber} | Valid Till ${updated.tpExpiryDate}`,
                        }));
                      }}
                    />
                  </div>
                )}
                {policyType === 'SAOD' && (
                  <PolicyFormSAODForm
                    category={vehicleCategory}
                    vehicleStatus={vehicleDetails.vehicleStatus === 'NEW' ? 'NEW' : 'EXISTING'}
                    data={saodForm}
                    onChange={setSaodForm}
                    eligibility={eligibilityContext}
                  />
                )}
                {policyType === 'PACKAGE' && (
                  <PolicyFormPackageForm
                    category={vehicleCategory}
                    vehicleStatus={vehicleDetails.vehicleStatus === 'NEW' ? 'NEW' : 'EXISTING'}
                    data={packageForm}
                    onChange={setPackageForm}
                    eligibility={eligibilityContext}
                  />
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
            {getNetPayable() > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium px-3 py-1.5 rounded bg-muted">
                <span className="text-foreground font-bold">Net Payable: ₹{getNetPayable().toLocaleString('en-IN')}</span>
                <span className="text-muted-foreground border-l pl-2">Tax: ₹{getGst().toLocaleString('en-IN')}</span>
                {getTotalDiscount() > 0 && (
                  <span className="text-emerald-600 border-l pl-2 font-semibold">Saved: ₹{getTotalDiscount().toLocaleString('en-IN')}</span>
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
                disabled={
                  isSaving ||
                  !canProceed() ||
                  (policyType === 'SAOD' && (
                    ruleLoading ||
                    !ruleResult ||
                    ruleEvaluationKey !== JSON.stringify(buildRuleEvaluationPayload()) ||
                    ruleResult.nextStep === 'TP_VERIFICATION'
                  ))
                }
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
