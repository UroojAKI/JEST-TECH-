# Domain M — Documents, Uploads & PDF Generation Audit

**Audit Date:** October 19, 2026  
**Auditor:** Antigravity Production Readiness Agent  
**Domain:** Domain M — Documents, Uploads & PDF Generation  
**Scope:** Whole-repository audit of file upload handling, Multer security configurations, object storage providers (Local, MinIO, S3, Dual), PDF generation engine, document access controls, audit trail compliance, and motor inspection photographic workflows.  
**Repository Path:** `e:\JEST TECH\JEST POLICY\jest-policy-crm`  
**Overall Domain Verdict:** **HIGH RISK (P0 CRITICAL DEFECTS IDENTIFIED IN PDF PERSISTENCE; REMEDIATION REQUIRED)**

---

## Summary

A comprehensive, code-level and test-backed audit of Domain M was conducted across all upload endpoints, storage providers, PDF generation pipelines, access control policies, and inspection workflows.

### Key Strengths
1. **Resilient Dual Storage Architecture**: `DualStorageProvider` implements primary/secondary failover (MinIO with Local fallback) and automatic Read-Repair with SHA-256 integrity verification. All 17 tests in `src/modules/documents` pass cleanly.
2. **SSRF-Free Deterministic PDF Generation**: `PdfService` generates policy schedules and quotations using pure `pdf-lib` primitives without headless browser dependencies (Puppeteer/wkhtmltopdf), eliminating Server-Side Request Forgery (SSRF) and external network calls.
3. **Fail-Closed Document Access Controls**: `DocumentService.getAuthorizedDocument` enforces strict organization tenant isolation. In addition, agent ownership is strictly enforced: an agent cannot download another agent's customer documents via `GET /documents/:id/download`.
4. **Enforced Inspection Photo Slots**: Motor inspection photo management strictly enforces a 7-slot invariant (`front`, `back`, `left`, `right`, `windshield`, `chassis`, `odometer`) with SHA-256 cryptographic provenance logging.

### Critical Vulnerabilities & Architectural Gaps
1. **P0 CRITICAL: Generated PDF Buffers are Discarded and Never Uploaded to Storage**: In both `GenerateQuotationService` (`generate-quotation.service.ts:232-274`) and `IssuePolicyService` (`issue-policy.service.ts:404-450`), `PdfService.generateDocumentPdf(...)` generates PDF binaries in memory and creates database reference records with `fileKey`, but **never calls `storage.uploadFile()`**. The binary buffer is discarded from memory immediately. Furthermore, no download endpoint exists in the API for `QuotationDocument` or `PolicyDocument`. Any attempt to retrieve these files will fail with 404 / NoSuchKey.
2. **P1 HIGH: Vehicle Master Import Endpoint Completely Unprotected**: `POST /motor-admin/variants/import` uses `@UseInterceptors(FileInterceptor('file'))` without any `fileFilter`, without MIME validation, and without file size limits, immediately reading the entire upload buffer into memory (`file.buffer.toString('utf-8')`), creating a denial-of-service (OOM) attack vector.
3. **P1 HIGH: Central AuditLog Bypass & Missing KYC Purpose Logging**: The documents module writes exclusively to an isolated `DocumentAccessLog` table and never writes to the platform's central `AuditLog` table. Furthermore, document upload operations are recorded with `action: VIEW` due to schema limitations, and sensitive KYC documents (Aadhaar/PAN) lack mandatory DPDP Act 2023 consent capture and purpose logging.
4. **P2 MEDIUM: MIME Type Validation Relies on Spoofable HTTP Headers**: In `DocumentsController`, MIME validation checks only the client-supplied `file.mimetype` header without inspecting file magic bytes/signatures. An executable file renamed with a PDF MIME type passes validation.
5. **P2 MEDIUM: In-Memory In-Band Document Streaming Instead of Signed URLs**: While `MinioStorageProvider.getFileUrl` is implemented with a 1-hour TTL, it is never called. Documents are streamed directly through NestJS server memory, posing severe memory scalability bottlenecks.

---

## Findings

### M-01: File MIME Type Validation Relies Exclusively on Client Headers — RISK
**Severity**: P2  
**File**: `apps/api/src/modules/documents/controllers/documents.controller.ts:46-60`  
**Observed**:  
The `fileInterceptorOptions` checks `file.mimetype` against `ALLOWED_MIME_TYPES`:
```typescript
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const fileInterceptorOptions = {
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (
    _req: any,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype))
      return cb(
        new BadRequestException(`File type ${file.mimetype} is not allowed`),
        false,
      );
    cb(null, true);
  },
};
```
Multer populates `file.mimetype` directly from the user-controlled `Content-Type` multipart header. There is no magic byte / file signature verification on the incoming buffer.  
**Expected**:  
File uploads should validate actual binary signatures/magic bytes (e.g., via `file-type` or buffer magic number inspection) before storing files in object storage to prevent malicious executable files from masquerading as PDF or images.  
**Evidence**:  
Code inspection of `documents.controller.ts:46-60`. No magic byte checking library or logic is invoked in controller or service before `this.storage.uploadFile(...)`.  
**Impact**:  
An attacker can upload malicious executables (`.exe`, `.sh`, `.php`) by setting the `Content-Type` header to `application/pdf` or `image/jpeg`.  
**Recommendation**:  
Implement magic byte verification in `DocumentService.uploadDocument` before passing buffer to storage provider, rejecting mismatches between file extension, magic numbers, and declared MIME type.

---

### M-02: Unbounded and Unfiltered File Upload on Vehicle Master Import — FAIL
**Severity**: P1  
**File**: `apps/api/src/modules/motor-admin/controllers/vehicle-master.controller.ts:153-163`  
**Observed**:  
The variant import endpoint does not configure any file interceptor options, size limits, or MIME filters:
```typescript
  @Post('variants/import')
  @Roles(RoleType.ADMIN)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importVariants(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }
    const csvContent = file.buffer.toString('utf-8');
    return this.vehicleService.importVariantsFromCSV(csvContent);
  }
```
**Expected**:  
File upload endpoints must enforce an explicit file size limit (e.g. 5 MB) and MIME/extension filter to prevent memory exhaustion and server crashes.  
**Evidence**:  
`apps/api/src/modules/motor-admin/controllers/vehicle-master.controller.ts:156` uses raw `@UseInterceptors(FileInterceptor('file'))` and calls `file.buffer.toString('utf-8')` on whatever file is submitted.  
**Impact**:  
A privileged user or compromised Admin token can upload a multi-gigabyte file, causing Node.js to exhaust heap memory (OOM crash) and taking down the API service.  
**Recommendation**:  
Apply Multer limits (`limits: { fileSize: 5 * 1024 * 1024 }`) and `fileFilter` validating `file.mimetype === 'text/csv'` or extension `.csv`.

---

### M-03: Object Storage Keys Accept Unsanitized Original Filename — RISK
**Severity**: P2  
**File**: `apps/api/src/modules/documents/services/document.service.ts:228, 308`  
**Observed**:  
In `DocumentService.uploadDocument` and `replaceDocument`:
```typescript
const uniqueId = crypto.randomUUID();
const storageKey = `${entityType}/${entityId}/${uniqueId}-${file.originalname}`;
```
The client-provided `file.originalname` is concatenated directly into `storageKey`.  
- For `LocalStorageProvider`: A `safePath(key)` method resolves the path and rejects `relative.startsWith('..')`.
- For `MinioStorageProvider` and `S3StorageProvider`: There is no sanitization of `file.originalname`. Traversal characters (`../`), spaces, emojis, or control characters are transmitted directly to MinIO/S3 object stores.  
**Expected**:  
`file.originalname` should be sanitized (using `path.basename` and stripping special characters) before constructing the storage key.  
**Evidence**:  
`document.service.ts:228` and `document.service.ts:308`. Note that while `downloadDocument` sanitizes `originalFileName` when setting the `Content-Disposition` header, the storage key creation does not sanitize it.  
**Impact**:  
Potential creation of malformed or traversal object keys in S3/MinIO buckets, and potential filename injection if keys are exposed in logs or headers.  
**Recommendation**:  
Sanitize `file.originalname` before storage key assembly:
```typescript
const cleanFileName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
const storageKey = `${entityType}/${entityId}/${uniqueId}-${cleanFileName}`;
```

---

### M-04: Storage Provider Configuration and Environment Variables — PASS
**Severity**: P3 (Informational)  
**File**: `apps/api/src/modules/documents/storage/minio-storage.provider.ts:13-20`, `apps/api/src/modules/documents/storage/s3-storage.provider.ts:18-49`  
**Observed**:  
Storage provider credentials, endpoints, ports, regions, and buckets are loaded dynamically via `ConfigService`:
- `MINIO_HOST`, `MINIO_PORT`, `MINIO_BUCKET`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`
- `STORAGE_REGION`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_PROVIDER`
In `S3StorageProvider`, missing credentials in `production` environment throw an immediate initialization error:
```typescript
if (isProduction && (provider === 'S3' || provider === 'MINIO') && (!accessKeyId || !secretAccessKey)) {
  throw new Error('S3StorageProvider: STORAGE_ACCESS_KEY and STORAGE_SECRET_KEY must be configured in production');
}
```
**Expected**:  
No hardcoded secrets or endpoints in source code; strict production environment checks.  
**Evidence**:  
`minio-storage.provider.ts:13-20`, `s3-storage.provider.ts:18-49`.

---

### M-05: Bucket Policies and Document Exposure — PASS
**Severity**: P3 (Informational)  
**File**: `apps/api/src/modules/documents/storage/minio-storage.provider.ts:39`, `apps/api/src/modules/documents/storage/s3-storage.provider.ts:64-70`  
**Observed**:  
Buckets created via `client.makeBucket` in MinIO default to private. S3 uploads do not attach public ACLs (`PutObjectCommand` uses default bucket permissions). Neither provider sets any public bucket policy.  
**Expected**:  
Object storage buckets must remain private with fail-closed access.  
**Evidence**:  
Verified bucket creation and `PutObjectCommand` invocations in `minio-storage.provider.ts` and `s3-storage.provider.ts`.

---

### M-06: Signed URL Facility Implemented but Unused; In-Band Streaming Creates Memory Pressure — RISK
**Severity**: P2  
**File**: `apps/api/src/modules/documents/controllers/documents.controller.ts:202-217`, `apps/api/src/modules/documents/storage/minio-storage.provider.ts:74-76`  
**Observed**:  
`MinioStorageProvider` includes `getFileUrl(key, expiresInSeconds = 3600)` with a reasonable 1-hour signed URL TTL:
```typescript
async getFileUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  return this.client.presignedGetObject(this.bucket, key, expiresInSeconds);
}
```
However:
1. `getFileUrl` is not defined on `StorageProvider` interface.
2. `S3StorageProvider` and `DualStorageProvider` do not implement `getFileUrl`.
3. `getFileUrl` is **never called anywhere in the codebase**.
4. In `DocumentsController.downloadDocument`, all files are retrieved into a Node.js `Buffer` and streamed directly in-band via Express response:
```typescript
const { fileBuffer, originalFileName, mimeType } =
  await this.documentService.downloadDocument(id, user.id, ipAddress, user);
res.setHeader('Content-Type', mimeType);
res.setHeader('Content-Disposition', `attachment; filename="${safe}"`);
res.status(HttpStatus.OK).send(fileBuffer);
```
**Expected**:  
Large document downloads should leverage short-lived signed URLs (15 to 60 minutes) or streaming pipes, redirecting the client directly to the storage service rather than loading multi-megabyte buffers into API memory.  
**Evidence**:  
`Select-String` search for `getFileUrl` returned only its definition in `minio-storage.provider.ts:74`.  
**Impact**:  
Concurrent downloads of large files (e.g. 50 users downloading 10MB policy documents simultaneously) consume massive server heap memory (500MB+), leading to Event Loop lag and potential OOM crashes.  
**Recommendation**:  
Add `getFileUrl` to `StorageProvider` interface, implement it across S3 and MinIO providers, and update `downloadDocument` to redirect (HTTP 302) to signed URLs for object store downloads.

---

### M-07: Monolithic Bucket Shared Across Document Classifications — RISK
**Severity**: P2  
**File**: `apps/api/src/modules/documents/storage/minio-storage.provider.ts:13`, `apps/api/src/modules/documents/storage/s3-storage.provider.ts:23`  
**Observed**:  
A single bucket name (`jest-documents` or `jest-policy-crm`) is shared across all document categories: KYC identity proofs, inspection photos, claims documents, quotation PDFs, and policy schedules. Separation is maintained solely by object key prefixing (`${entityType}/${entityId}/...`).  
**Expected**:  
Sensitive customer KYC documents (Aadhaar, PAN scans) should be segregated into a dedicated private bucket with independent IAM policies, encryption-at-rest keys (KMS), and restricted access roles.  
**Evidence**:  
Both MinIO and S3 storage providers define a single `this.bucket` for all uploads.  
**Impact**:  
A single misconfigured bucket policy or compromised credential grants access to both generic quotations and sensitive regulatory identity proofs.  
**Recommendation**:  
Partition storage by classification: `DOCUMENTS_KYC_BUCKET`, `DOCUMENTS_POLICIES_BUCKET`, and `DOCUMENTS_GENERAL_BUCKET`.

---

### M-08: Zero SSRF Risk in PDF Generation Engine — PASS
**Severity**: P3 (Informational)  
**File**: `apps/api/src/modules/quotation/engine/pdf.service.ts:1-35`, `apps/api/src/modules/platform/reporting/services/export.service.ts:203-213`  
**Observed**:  
PDF generation in `PdfService` utilizes pure `pdf-lib` vector primitives (`PDFDocument.create()`, `page.drawText()`, `page.drawRectangle()`). Reporting exports in `ExportService` utilize `pdfmake`. No headless browser (Puppeteer, Playwright, Chromium, wkhtmltopdf) is installed or used. No external URLs, HTML templates, or remote stylesheets are fetched during PDF compilation.  
**Expected**:  
PDF rendering pipelines must be protected against Server-Side Request Forgery (SSRF) and local file inclusion.  
**Evidence**:  
`apps/api/package.json` contains no Puppeteer/wkhtmltopdf dependencies. `pdf.service.ts` imports only `pdf-lib` and `StandardFonts`.  
**Impact**:  
SSRF attack surface is completely eliminated from document generation.

---

### M-09: Authoritative Database Data Backing and Hash Computation — PASS
**Severity**: P3 (Informational)  
**File**: `apps/api/src/modules/quotation/engine/pdf.service.ts:122-125`, `apps/api/src/modules/quotation/engine/pdf.service.spec.ts:58-176`  
**Observed**:  
PDF schedule generation is driven strictly by authoritative database entities (calculated premiums, statutory GST, verified payment transaction numbers, validated chassis and engine numbers). The service computes a cryptographic SHA-256 hash of the generated binary and embeds an electronically verified audit statement. Full field-by-field verification is validated in `pdf.service.spec.ts` (100% pass).  
**Expected**:  
PDF content must derive solely from authoritative backend data and maintain cryptographic tamper evidence.  
**Evidence**:  
`npm test -- src/modules/quotation/engine/pdf.service.spec.ts` passes with 2/2 tests verifying SHA-256 integrity and field equality.

---

### M-10: CRITICAL: Generated PDF Buffers are Never Uploaded to Storage — FAIL
**Severity**: P0  
**File**: `apps/api/src/modules/quotation/services/commands/generate-quotation.service.ts:232-274`, `apps/api/src/modules/policies/services/commands/issue-policy.service.ts:404-450`  
**Observed**:  
In `GenerateQuotationService`:
```typescript
// 6. Write Side-effects (Authoritative signed PDF)
const pdfDoc = await this.pdfService.generateDocumentPdf(
  'Motor Insurance Quotation',
  quotationCode,
  { ... },
);

await Promise.all([
  ...,
  this.quotationRepository.addDocument(
    quotation.id,
    'QUOTE_PDF',
    pdfDoc.fileKey,
    pdfDoc.fileName,
    pdfDoc.fileSize,
  ),
]);
```
In `IssuePolicyService`:
```typescript
const schedulePdf = await this.pdfService.generateDocumentPdf(
  'Policy Schedule',
  policyNumber,
  { ... },
);
const taxCertificatePdf = await this.pdfService.generateDocumentPdf(
  'Tax Exemption / GST Certificate',
  `${policyNumber}_TAX`,
  { ... },
);

await Promise.all([
  this.policyRepository.addDocument({
    policy: { connect: { id: policy.id } },
    documentType: 'POLICY_SCHEDULE',
    fileKey: schedulePdf.fileKey,
    fileName: schedulePdf.fileName,
    fileSize: schedulePdf.fileSize,
  }),
  this.policyRepository.addDocument({
    policy: { connect: { id: policy.id } },
    documentType: 'TAX_CERTIFICATE',
    fileKey: taxCertificatePdf.fileKey,
    fileName: taxCertificatePdf.fileName,
    fileSize: taxCertificatePdf.fileSize,
  }),
]);
```
**Neither service injects `StorageProvider` or calls `uploadFile` with the generated `pdfDoc.buffer` or `schedulePdf.buffer`!**  
The PDF buffer is constructed in memory, a row is written to `QuotationDocument` or `PolicyDocument` referencing a `fileKey`, and the buffer is garbage collected. Furthermore, there is **no download endpoint** anywhere in the API for `QuotationDocument` or `PolicyDocument` records.  
**Expected**:  
When generating authoritative PDFs, the binary buffer must be uploaded to object storage via `StorageProvider.uploadFile(pdfDoc.buffer, pdfDoc.fileKey, 'application/pdf')` before persisting the database record. In addition, an authorized endpoint must allow downloading policy schedules and quote PDFs.  
**Evidence**:  
Inspection of `GenerateQuotationService` constructor (`generate-quotation.service.ts:26-36`) shows no `StorageProvider` or `DocumentService` dependency. Inspection of `IssuePolicyService` constructor (`issue-policy.service.ts:37-48`) shows no `StorageProvider` or `DocumentService` dependency. Neither file contains `uploadFile`.  
**Impact**:  
Whenever an agent, underwriter, or customer attempts to retrieve an issued policy schedule or quotation PDF, the file does not exist in local, MinIO, or S3 storage. Production policy document download will fail 100% of the time.  
**Recommendation**:  
Inject `STORAGE_PROVIDER_TOKEN` into `GenerateQuotationService` and `IssuePolicyService`. Upload `pdfDoc.buffer` to storage prior to creating document records. Implement `GET /policies/:id/documents/:docId/download` and `GET /quotations/:id/documents/:docId/download` with proper tenant and role authorization.

---

### M-11: Lack of Cryptographic X.509 Digital Signatures on Policy Schedules — RISK
**Severity**: P2  
**File**: `apps/api/src/modules/quotation/engine/pdf.service.ts:104-120`  
**Observed**:  
The PDF footer prints:
`"This document is electronically verified and digitally bound to the authoritative audit trail."`
While the SHA-256 hash is logged and recorded in the database, the PDF file itself does not contain an embedded cryptographic Digital Signature (PKCS#7 / CMS / X.509 certificate) or digital signature dictionary.  
**Expected**:  
In Indian insurance regulatory contexts (IRDAI), policy schedule documents issued electronically require a valid Digital Signature Certificate (DSC) or Electronic Signature (e-Sign) embedded into the PDF format.  
**Evidence**:  
`PdfService.generateDocumentPdf` only embeds text strings and computes a hash; it does not sign the PDF with a private key.  
**Impact**:  
Non-compliance with regulatory electronic document issuance standards where digitally signed PDF schedules are legally required.  
**Recommendation**:  
Integrate a digital signing step using an enterprise HSM or digital signature service to append an X.509 certificate to policy schedule PDFs prior to storage.

---

### M-12: Document Access Authorization and Cross-Agent Scoping — PASS
**Severity**: P3 (Informational)  
**File**: `apps/api/src/modules/documents/services/document.service.ts:38-74`, `apps/api/src/common/policies/document.policy.ts:13-49`  
**Observed**:  
`DocumentService.getAuthorizedDocument(id, actor)` implements rigorous fail-closed tenant checking:
```typescript
const owner = doc.uploadedBy;
const ownerOrg = owner?.companyId || owner?.branch?.zone?.region?.company?.id;

// Strict fail-closed tenant boundary
if (!ownerOrg || ownerOrg !== actorOrg)
  throw new ForbiddenException('Document belongs to another organization');

const role = actor.role;
// ADMIN and BACK_OFFICE can see all org documents
if (role === RoleType.ADMIN || role === RoleType.BACK_OFFICE) return doc;
// AGENT can only see their own documents
if (owner?.id !== actor.userId)
  throw new ForbiddenException('Document belongs to another owner');
```
In `GET /documents/:id/download`, an agent attempting to download a document uploaded by another agent is rejected with `ForbiddenException('Document belongs to another owner')`.  
In `GET /documents/entity/:entityType/:entityId`, `ownerScope = isElevatedRole ? {} : { uploadedById: actor.userId }` ensures agents only receive their own uploads.  
**Expected**:  
Agents must never access or download documents uploaded by other agents, even within the same tenant.  
**Evidence**:  
Code verification in `document.service.ts:38-74` and passing test suite in `documents.controller.spec.ts`.

---

### M-13: Motor Quotation Document Association and Metadata IDOR — RISK
**Severity**: P2  
**File**: `apps/api/src/modules/motor/services/motor-quotation-document.service.ts:25-45, 65-80`  
**Observed**:  
In `MotorQuotationDocumentService`:
1. `getQuotationDocuments(quotationId, user)`: Only filters by `{ quotationId, companyId: user.companyId }`. It does not check whether an agent is assigned to or created the quotation. Any agent within the company can enumerate attached documents and their metadata for any other agent's quotation.
2. `attachDocument(quotationId, dto, user)`: Allows attaching any document where `uploadedBy: { companyId: user.companyId }`. An agent can attach another agent's uploaded document to their own quotation if they know its UUID.  
**Expected**:  
Quotation document retrieval and attachment must verify that the requesting agent is either the creator or assigned agent of the quotation (`quotation.createdById === user.id || quotation.agentId === user.id`), and that documents attached were uploaded by that agent or an elevated user.  
**Evidence**:  
`motor-quotation-document.service.ts:26-45` and `motor-quotation-document.service.ts:66-79`.  
**Impact**:  
Information disclosure of document metadata across agents within the same tenant, and unauthorized cross-attachment of customer documents.  
**Recommendation**:  
Enforce agent ownership validation in `MotorQuotationDocumentService` for all `AGENT` role requests.

---

### M-14: Document Operations Completely Bypass Central AuditLog — FAIL
**Severity**: P1  
**File**: `apps/api/src/modules/documents/services/document.service.ts:286-293`, `apps/api/prisma/schema.prisma:491-501`  
**Observed**:  
`DocumentService` records operations in a dedicated table `DocumentAccessLog`:
```typescript
await this.prisma.documentAccessLog.create({
  data: {
    documentId: doc.id,
    userId: uploadedById,
    action: DocumentAccessAction.VIEW,
    ipAddress,
  },
});
```
The documents module has no dependency on `AuditService` or `prisma.auditLog`. Document uploads, replacements, downloads, and deletions are invisible to the centralized `AuditLog` table queried by compliance and security dashboards (`/api/v1/audit`).  
**Expected**:  
All document lifecycle actions (upload, replace, delete, restore, verify) must be published or recorded in the primary system `AuditLog` table.  
**Evidence**:  
`Select-String` search in `apps/api/src/modules/documents` found zero references to `auditLog` or `AuditService`.  
**Impact**:  
Compliance blindspot: security administrators inspecting system audit logs cannot trace document uploads or deletions.  
**Recommendation**:  
Inject `AuditService` or emit outbox domain events (`document.uploaded`, `document.deleted`, `document.verified`) to ensure centralized audit recording.

---

### M-15: Semantically Inaccurate Audit Logging on Document Upload — FAIL
**Severity**: P2  
**File**: `apps/api/src/modules/documents/services/document.service.ts:290`, `apps/api/prisma/schema.prisma:1862-1867`  
**Observed**:  
In `prisma/schema.prisma`:
```prisma
enum DocumentAccessAction {
  VIEW
  DOWNLOAD
  DELETE
  RESTORE
}
```
Because the enum lacks `UPLOAD` and `REPLACE` values, `DocumentService.uploadDocument` logs uploads as `VIEW`:
```typescript
await this.prisma.documentAccessLog.create({
  data: {
    documentId: doc.id,
    userId: uploadedById,
    action: DocumentAccessAction.VIEW,
    ipAddress,
  },
});
```
Similarly, `replaceDocument` logs a replacement as `VIEW`.  
**Expected**:  
`DocumentAccessAction` must contain explicit `UPLOAD` and `REPLACE` enum values so that audit logs accurately reflect document modifications.  
**Evidence**:  
`document.service.ts:290` and `document.service.ts:363`.  
**Impact**:  
Auditors and forensic investigators cannot distinguish between a user simply viewing a document and a user uploading or replacing a document.  
**Recommendation**:  
Add `UPLOAD` and `REPLACE` to `DocumentAccessAction` enum in Prisma schema and record the correct action.

---

### M-16: Missing Explicit Consent and Purpose Logging for Sensitive KYC Documents — FAIL
**Severity**: P1  
**File**: `apps/api/src/modules/documents/controllers/documents.controller.ts:81-127`, `apps/api/src/modules/documents/services/document.service.ts:193-275`  
**Observed**:  
`POST /documents/upload` accepts `name`, `entityType`, `entityId`, `category`, `expiryDate`, and `tags`.  
There is no parameter or validation for:
1. Customer consent capture (e.g. checkbox/timestamp/consent token).
2. Explicit purpose specification (e.g. "Identity verification for Motor Policy issuance").
3. Aadhaar masking / redaction validation (storing full 12-digit Aadhaar scans violates UIDAI guidelines and DPDP Act 2023).  
**Expected**:  
Under the Digital Personal Data Protection Act (DPDP) 2023 and IRDAI KYC guidelines, identity documents (Aadhaar, PAN) require documented customer consent, purpose logging, and Aadhaar masking.  
**Evidence**:  
Inspection of `uploadDocument` parameters and database schema in `schema.prisma:1869-1922` shows no consent reference or masking flag fields.  
**Impact**:  
Regulatory non-compliance with UIDAI Aadhaar Regulations and DPDP Act 2023.  
**Recommendation**:  
Require a `consentToken` and `processingPurpose` on KYC document uploads, and implement automated or manual masking verification for Aadhaar numbers.

---

### M-17: Strictly Bounded Motor Inspection Photo Slots and Provenance — PASS
**Severity**: P3 (Informational)  
**File**: `apps/api/src/modules/motor/services/motor-inspection.service.ts:51-62, 351-477`  
**Observed**:  
Vehicle inspection photo uploads are strictly bounded to exactly 7 photographic slots:
```typescript
export const MANDATORY_PHOTO_FIELDS: Array<{
  key: string;
  type: InspectionPhotoType;
}> = [
  { key: 'frontImageKey', type: 'front' },
  { key: 'backImageKey', type: 'back' },
  { key: 'leftImageKey', type: 'left' },
  { key: 'rightImageKey', type: 'right' },
  { key: 'windshieldImageKey', type: 'windshield' },
  { key: 'chassisImageKey', type: 'chassis' },
  { key: 'odometerImageKey', type: 'odometer' },
];
```
Photos map directly to dedicated database columns (`frontImageKey`, `backImageKey`, etc.) on `MotorInspection`. The submission gate (`submitForReview`) verifies that all 7 slots are filled before back-office review can begin. Cryptographic SHA-256 provenance is computed and persisted in `motorInspectionHistory`.  
**Expected**:  
Inspections must bound photo counts to defined slots and prevent arbitrary or unverified photo associations.  
**Evidence**:  
Verified in `motor-inspection.service.ts` and test suite `src/modules/motor/services/motor-inspection.service.spec.ts` (29/29 passed).

---

### M-18: Non-Orphaned Atomic State Machine for Inspection Photos — PASS
**Severity**: P3 (Informational)  
**File**: `apps/api/src/modules/motor/services/motor-inspection.service.ts:419-477`  
**Observed**:  
In `recordPhoto`, the method verifies:
1. Inspection existence and tenant ownership (`inspection.companyId === actor.companyId`).
2. Contributor assignment (`assertInspectionContributor`).
3. State machine transition (`validateTransition(inspection.status, 'UPLOAD_PHOTO')`).
4. Updates the inspection record and writes `motorInspectionHistory` in a single atomic `$transaction`.  
Photos cannot be orphaned because they are written directly to the target `MotorInspection` row.  
**Expected**:  
Photos must be bound to the authoritative inspection entity within an atomic transaction.  
**Evidence**:  
`motor-inspection.service.ts:452-477`.

---

### M-19: Absence of Storage Verification and MIME Type Checking in `recordPhoto` — RISK
**Severity**: P2  
**File**: `apps/api/src/modules/motor/controllers/motor-inspection.controller.ts:68-89`, `apps/api/src/modules/motor/services/motor-inspection.service.ts:358-417`  
**Observed**:  
`recordPhoto` accepts a JSON body containing `storageKey` and optional `sha256`:
```typescript
async recordPhoto(
  @Param('id') inspectionId: string,
  @Body() body: {
    photoType: InspectionPhotoType;
    storageKey: string;
    sha256?: string;
    photoHash?: string;
  },
  @CurrentUser() actor: ActorContext,
)
```
While `recordPhoto` validates that `storageKey` does not contain external URL schemes (`://`), path traversal (`..`), or cross-tenant prefixes, it **never checks whether the object actually exists in storage** and does not validate file extensions or MIME types. A caller can submit `storageKey: "documents/dummy.exe"` or a non-existent key, and the system records it as a valid inspection photo.  
**Expected**:  
`recordPhoto` should confirm that the `storageKey` corresponds to an existing object in storage, and that its Content-Type is a valid image (`image/jpeg`, `image/png`).  
**Evidence**:  
`motor-inspection.service.ts:358-417` checks string structure only, without calling `storage.downloadFile` or `prisma.document.findFirst`.  
**Impact**:  
Ghost/corrupt photos can be attached to inspection records, only discovered later during underwriting review.  
**Recommendation**:  
Verify that `storageKey` resolves to an existing file in `Document` table or object store with an image MIME type before transitioning the inspection state.

---

## Audit Checklist Verification Matrix

| Checklist Item | Description | Status | Severity | Primary File Reference |
|---|---|---|---|---|
| **M-01.1** | Upload endpoints identified across codebase | PASS | Info | `documents.controller.ts:78, 129`, `vehicle-master.controller.ts:153` |
| **M-01.2** | File MIME type validated (allowlist) | RISK | P2 | `documents.controller.ts:46` (Header-only; no magic bytes) |
| **M-01.3** | Vehicle Master import endpoint security | FAIL | P1 | `vehicle-master.controller.ts:156` (No limits, no MIME filter) |
| **M-01.4** | File size limits enforced | PASS / FAIL | P1 | Pass on Documents (10MB); Fail on Vehicle Master (unlimited) |
| **M-01.5** | Original filename sanitized before storage | RISK | P2 | `document.service.ts:228` (Concat without regex/basename sanitization) |
| **M-01.6** | Executables explicitly rejected | RISK | P2 | Dependent on client `Content-Type` header; spoofable |
| **M-02.1** | MinIO/S3 endpoint loaded from env vars | PASS | Info | `minio-storage.provider.ts:13-20`, `s3-storage.provider.ts:18-49` |
| **M-02.2** | Bucket policies set to private | PASS | Info | `minio-storage.provider.ts:39`, `s3-storage.provider.ts:64` |
| **M-02.3** | Signed URL TTL reasonable | PASS / RISK | P2 | 3600s TTL implemented in MinIO, but completely unused |
| **M-02.4** | Separate buckets for document types (KYC/policies) | RISK | P2 | `minio-storage.provider.ts:13` (Single monolithic bucket used) |
| **M-03.1** | PDF generation engine identified | PASS | Info | `pdf.service.ts` (pdf-lib), `export.service.ts` (pdfmake) |
| **M-03.2** | PDF generated from authoritative database data | PASS | Info | `pdf.service.ts:20-137`, `issue-policy.service.ts:404-434` |
| **M-03.3** | SSRF risk in PDF generation | PASS | Info | Pure vector libraries (`pdf-lib`, `pdfmake`); no browser engine |
| **M-03.4** | PDF stored with correct policy/claim reference | PASS | Info | `quotation.repository.ts:186`, `policy.repository.ts:165` |
| **M-03.5** | Generated PDF buffers uploaded to storage | FAIL | P0 | `generate-quotation.service.ts:268`, `issue-policy.service.ts:436` |
| **M-03.6** | Policy schedule PDFs digitally signed | RISK | P2 | `pdf.service.ts:111` (SHA-256 hash only; no X.509 DSC) |
| **M-04.1** | Authorization check before returning document | PASS | Info | `document.service.ts:38-74` (Fail-closed tenant & owner check) |
| **M-04.2** | Documents served via signed URLs vs direct | RISK | P2 | Streamed in-band through NestJS memory; signed URLs unused |
| **M-04.3** | Agent cannot download another agent's documents | PASS | Info | `document.service.ts:71` (`owner.id !== actor.userId` throws 403) |
| **M-04.4** | Motor quotation document agent scoping | RISK | P2 | `motor-quotation-document.service.ts:65` (Tenant-only, not agent) |
| **M-05.1** | Document uploads logged in central AuditLog | FAIL | P1 | `document.service.ts:286` (Writes to isolated table only) |
| **M-05.2** | Document downloads/views logged | PASS | Info | `document.service.ts:402` (Logs DOWNLOAD with userId and IP) |
| **M-05.3** | Accurate upload audit action in enum | FAIL | P2 | `document.service.ts:290` (Logged as `VIEW` due to schema gap) |
| **M-05.4** | KYC consent & purpose logging (Aadhaar/PAN) | FAIL | P1 | `documents.controller.ts:81` (No consent token or purpose field) |
| **M-06.1** | Motor inspection photo upload handling | PASS | Info | `motor-inspection.service.ts:351-477` |
| **M-06.2** | Photos limited to image MIME types | RISK | P2 | `motor-inspection.service.ts:358` (No file existence or MIME check) |
| **M-06.3** | Maximum number of photos per inspection | PASS | Info | Strictly bounded to 7 mandatory slots |
| **M-06.4** | Photos associated with correct inspection (no orphan) | PASS | Info | Atomic transaction on `MotorInspection` entity columns |
