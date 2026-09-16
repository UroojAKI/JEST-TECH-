# Master Remediation Plan

This document outlines the structured sprint-by-sprint implementation plan based on the 45-phase plan.

## Sprint 1: Security
| ID | Description | Status | Files Affected |
|----|-------------|--------|----------------|
| SEC-001 | Remove hardcoded PII encryption key | IMPLEMENTED | `apps/api/src/common/utils/encryption.util.ts` |
| SEC-002 | Fix Webhook signature bypass in non-production | IMPLEMENTED | `apps/api/src/modules/platform/integrations/webhooks/controllers/webhook-gateway/webhook-gateway.controller.ts` |
| SEC-003 | Remove Razorpay webhook fallback secret | IMPLEMENTED | `apps/api/src/modules/platform/integrations/webhooks/controllers/webhook-gateway/webhook-gateway.controller.ts` |
| SEC-004 | Add webhook replay protection | IMPLEMENTED | `apps/api/src/modules/platform/integrations/webhooks/controllers/webhook-gateway/webhook-gateway.controller.ts` |

## Sprint 2: Identity + RBAC
| ID | Description | Status | Files Affected |
|----|-------------|--------|----------------|
| ID-001 | Consolidate duplicate PII encryption implementation | IMPLEMENTED | `apps/api/src/common/utils/encryption.util.ts` |
| AUTH-001 | Remove JWT defaults in env schema | IMPLEMENTED | `apps/api/src/modules/platform/configuration/env.schema.ts` |
| AUTH-002 | Implement proper Role guards | IMPLEMENTED | `apps/api/src/modules/auth/guards/roles.guard.ts` |
| AUTH-003 | Restrict Agent from Back Office URLs | IMPLEMENTED | `apps/web/src/proxy.ts` |
| AUTH-004 | Restrict Agent from Admin URLs | IMPLEMENTED | `apps/web/src/proxy.ts` |

## Sprint 3: Workspace + Navigation
| ID | Description | Status | Files Affected |
|----|-------------|--------|----------------|
| WS-001 | Fix Workspace selector showing app sidebar | IMPLEMENTED | `apps/web/src/app/workspace/(selector)/layout.tsx` |
| NAV-001 | Unify sidebar systems | IMPLEMENTED | `apps/web/src/components/workspace/UnifiedSidebar.tsx` |
| NAV-002 | Fix navigation inconsistency | IMPLEMENTED | `apps/web/src/components/workspace/WorkspaceAppContainer.tsx` |
| NAV-003 | Add Breadcrumbs | IMPLEMENTED | `apps/web/src/components/workspace/WorkspaceBreadcrumb.tsx` |
| NAV-004 | Route protection based on workspace | IMPLEMENTED | `apps/web/src/proxy.ts` |

## Sprint 4: CRM Foundation
| ID | Description | Status | Files Affected |
|----|-------------|--------|----------------|
| CRM-001 | Fix Quote.contactId not always set | IMPLEMENTED | `apps/api/src/modules/quotation/services/commands/generate-quotation.service.ts` |
| CRM-002 | Normalize Vehicle registration | IMPLEMENTED | `apps/web/src/components/leads/motor-quote/VehicleDetailsForm.tsx`, `apps/api/src/modules/motor/services/motor-policy-issuance.service.ts` |
| CRM-003 | Enforce Lead must reference Contact | IMPLEMENTED | `apps/api/src/modules/leads/services/leads.service.ts` |
| CRM-004 | Enforce Agent identity from User FK | IMPLEMENTED | `apps/api/src/modules/contacts/services/contacts.service.ts` |
| CRM-005 | Remove Mock data fallbacks in production UI | IMPLEMENTED | `apps/web/src/repositories/` |
| CRM-006 | Add server-side pagination | IMPLEMENTED | `apps/api/src/common/pagination/` |
| CRM-007 | Implement Audit log for state transitions | IMPLEMENTED | `apps/api/src/modules/platform/audit/services/audit.service.ts`, `apps/api/src/modules/leads/services/leads.service.ts` |

## Sprint 5: Data Truth
| ID | Description | Status | Files Affected |
|----|-------------|--------|----------------|
| DATA-001 | Consolidate Contact as single customer identity | IMPLEMENTED | `apps/api/src/modules/contacts/services/contacts.service.ts`, `apps/api/src/modules/customer/customer-360/` |
| DATA-002 | Fix previous claims null treated as zero | IMPLEMENTED | `apps/api/src/modules/motor/services/motor-calculation.service.ts` |
| DATA-003 | Store monetary amounts in paise | OPEN | `apps/api/prisma/schema.prisma` |
| DATA-004 | Require idempotency keys for payments | IMPLEMENTED | `apps/api/src/modules/finance/revenue/services/payment/payment.service.ts`, `apps/api/src/modules/motor/services/motor-payment-tracking.service.ts` |
| DATA-005 | Ensure Policy originates from valid Quote | IMPLEMENTED | `apps/api/src/modules/motor/services/motor-policy-issuance.service.ts` |

## Sprint 6: Motor Underwriting
| ID | Description | Status | Files Affected |
|----|-------------|--------|----------------|
| MOTOR-001 | Backend rule engine unification | OPEN | `apps/api/src/modules/motor/rule-engine.service.ts` |
| MOTOR-002 | Remove frontend rule engine duplicates | OPEN | `apps/web/src/lib/rules.ts` |
| MOTOR-003 | Implement IDV calculation | OPEN | `apps/api/src/modules/motor/idv.service.ts` |
| MOTOR-004 | NCBM calculation | OPEN | `apps/api/src/modules/motor/ncbm.service.ts` |
| MOTOR-005 | Add-on premium calculation | OPEN | `apps/api/src/modules/motor/premium.service.ts` |
| MOTOR-006 | Third-party integrations for Motor | OPEN | `apps/api/src/modules/motor/integrations/` |

## Sprint 7: Inspection
| ID | Description | Status | Files Affected |
|----|-------------|--------|----------------|
| INS-001 | Enforce Inspection state machine | OPEN | `apps/api/src/modules/motor/inspection.service.ts` |
| INS-002 | Assign inspector | OPEN | `apps/api/src/modules/motor/inspection.service.ts` |
| INS-003 | Upload inspection evidence | OPEN | `apps/api/src/modules/documents/document.service.ts` |
| INS-004 | Approve/Fail inspection | OPEN | `apps/api/src/modules/motor/inspection.service.ts` |
| INS-005 | Integration with insurer inspection API | OPEN | `apps/api/src/modules/motor/integrations/` |
| INS-006 | Self-inspection flow | OPEN | `apps/api/src/modules/motor/inspection.service.ts` |
| INS-007 | Notify customer on inspection status | OPEN | `apps/api/src/modules/notifications/` |

## Sprint 8: Policy
| ID | Description | Status | Files Affected |
|----|-------------|--------|----------------|
| POL-001 | Policy issuance workflow | OPEN | `apps/api/src/modules/policies/policy.service.ts` |
| POL-002 | Generate Policy schedule PDF | OPEN | `apps/api/src/modules/documents/pdf.service.ts` |
| POL-003 | Endorsement flow | OPEN | `apps/api/src/modules/endorsements/endorsement.service.ts` |
| POL-004 | Cancellation flow | OPEN | `apps/api/src/modules/policies/policy.service.ts` |
| POL-005 | Policy synchronization with insurers | OPEN | `apps/api/src/modules/policies/sync.service.ts` |

## Sprint 9: Renewal
| ID | Description | Status | Files Affected |
|----|-------------|--------|----------------|
| REN-001 | Fix Renewal date uses estimation | OPEN | `apps/api/src/modules/policies/renewal.service.ts` |
| REN-002 | Make Renewal scheduler idempotent | OPEN | `apps/api/src/modules/policies/renewal.cron.ts` |
| REN-003 | Generate upcoming renewal list | OPEN | `apps/api/src/modules/policies/renewal.service.ts` |
| REN-004 | Send renewal reminders | OPEN | `apps/api/src/modules/notifications/` |
| REN-005 | Automate renewal requote | OPEN | `apps/api/src/modules/policies/renewal.service.ts` |
| REN-006 | Track renewal payment | OPEN | `apps/api/src/modules/finance/payment.service.ts` |
| REN-007 | Renewal status update | OPEN | `apps/api/src/modules/policies/renewal.service.ts` |
| REN-008 | Dashboard metrics for renewals | OPEN | `apps/api/src/modules/dashboard/dashboard.service.ts` |

## Sprint 10: Audit + Hardening
| ID | Description | Status | Files Affected |
|----|-------------|--------|----------------|
| AUD-001 | Complete audit trail coverage | OPEN | `apps/api/src/modules/audit/audit.service.ts` |
| AUD-002 | Export audit logs | OPEN | `apps/api/src/modules/audit/audit.service.ts` |
| AUD-003 | Rate limiting and throttling | OPEN | `apps/api/src/common/guards/throttler.guard.ts` |
| AUD-004 | Penetration test fixes | OPEN | Varies |
| AUD-005 | Performance optimization | OPEN | Varies |
| AUD-006 | Final security review | OPEN | All |
