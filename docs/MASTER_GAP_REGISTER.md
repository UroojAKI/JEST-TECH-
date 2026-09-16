# Master Gap Register

| Gap ID | Description | Severity | Category | Status | Sprint | Acceptance Criteria |
|--------|-------------|----------|----------|--------|--------|---------------------|
| G001 | Hardcoded PII encryption key | CRITICAL | SECURITY | IMPLEMENTED | Sprint 1 | Key is loaded securely from env without hardcoding |
| G002 | Webhook signature bypass in non-production | CRITICAL | SECURITY | IMPLEMENTED | Sprint 1 | Signatures enforced in all environments |
| G003 | Razorpay webhook fallback secret | CRITICAL | SECURITY | IMPLEMENTED | Sprint 1 | No fallback secret is used for Razorpay |
| G004 | No webhook replay protection | HIGH | SECURITY | IMPLEMENTED | Sprint 1 | Webhooks reject replayed payloads |
| G005 | Two sidebar systems creating navigation inconsistency | HIGH | UI | IMPLEMENTED | Sprint 3 | A single, unified sidebar system is used |
| G006 | Workspace selector shows app sidebar | HIGH | UI/UX | IMPLEMENTED | Sprint 3 | Workspace selector does not bleed into app sidebar |
| G007 | Agent can access Back Office URLs | CRITICAL | RBAC | IMPLEMENTED | Sprint 2 | Agents are forbidden from Back Office routes |
| G008 | Agent can access Admin URLs | CRITICAL | RBAC | IMPLEMENTED | Sprint 2 | Agents are forbidden from Admin routes |
| G009 | Quote.contactId not always set | HIGH | DATA | OPEN | Sprint 4 | Quote creation mandates contactId |
| G010 | Vehicle registration not normalized at persistence | MEDIUM | DATA | OPEN | Sprint 4 | Registrations are saved uppercase, no spaces |
| G011 | Frontend rule engine duplicates backend | HIGH | WORKFLOW | OPEN | Sprint 6 | Rules are computed on backend only |
| G012 | Renewal date uses estimation not actual insurer dates | HIGH | WORKFLOW | OPEN | Sprint 9 | Renewal relies on insurer-confirmed dates |
| G013 | Renewal scheduler not idempotent | MEDIUM | WORKFLOW | OPEN | Sprint 9 | Scheduler can run safely multiple times |
| G014 | Previous claims null treated as zero | MEDIUM | DATA | OPEN | Sprint 5 | Claims track states properly, not just numerical zero |
| G015 | Free-text agent code instead of User FK | HIGH | DATA | OPEN | Sprint 4 | Agent identity uses User foreign key |
| G016 | Mock data fallbacks in production UI | HIGH | DATA | OPEN | Sprint 4 | No mock data is used in production builds |
| G017 | No server-side pagination on major lists | MEDIUM | PERFORMANCE | OPEN | Sprint 4 | APIs support limits, offsets, and return totals |
| G018 | Inspection state machine not enforced | HIGH | WORKFLOW | OPEN | Sprint 7 | Transitions validate against proper state machine |
| G019 | PII duplicate encryption implementation | MEDIUM | SECURITY | IMPLEMENTED | Sprint 2 | Only EncryptionUtil is used for PII |
| G020 | JWT defaults in env schema | MEDIUM | SECURITY | IMPLEMENTED | Sprint 2 | JWT secret explicitly required from env |
