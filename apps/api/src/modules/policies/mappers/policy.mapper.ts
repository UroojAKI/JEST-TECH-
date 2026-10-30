import { PolicyResponseDto } from '../dto/policy-response.dto';
import { PolicyWithRelations } from '../repositories/policy.repository';

export class PolicyMapper {
  static toResponse(p: PolicyWithRelations, directDocs?: any[]): PolicyResponseDto {
    const dto = new PolicyResponseDto();
    dto.id = p.id;
    dto.policyNumber = p.policyNumber;
    dto.status = p.status;
    dto.quotationId = p.quotationId;
    dto.contactId = p.contactId;
    dto.accountId = p.accountId;
    dto.premiumAmount = Number(p.premiumAmount);
    dto.effectiveDate = p.effectiveDate;
    dto.expiryDate = p.expiryDate;
    dto.createdById = p.createdById;
    dto.updatedById = p.updatedById;
    dto.createdAt = p.createdAt;
    dto.updatedAt = p.updatedAt;

    const rawProposer =
      (p as any).motorMetadata?.proposerDetails?.customerName ||
      (p.quotation as any)?.motorMetadata?.proposerDetails?.customerName ||
      (p as any).proposerDetails?.customerName ||
      (p.quotation as any)?.proposerDetails?.customerName;
    const proposerName = rawProposer
      ? String(rawProposer).replace(/\u00a0/g, ' ').trim()
      : null;

    const contact =
      p.contact ||
      (p.quotation as any)?.contact ||
      (p.quotation as any)?.lead?.contact;
    const customer = (p as any).customer || (p.quotation as any)?.customer;

    const rawContactName = contact
      ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
      : null;
    const rawCustomerName = customer
      ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim()
      : null;

    dto.contactName =
      proposerName ||
      rawContactName ||
      rawCustomerName ||
      (p as any).customerName ||
      null;
    dto.contactPhone =
      (p as any).motorMetadata?.proposerDetails?.mobileNumber ||
      (p.quotation as any)?.motorMetadata?.proposerDetails?.mobileNumber ||
      contact?.phone ||
      customer?.mobile ||
      null;
    dto.contactEmail =
      (p as any).motorMetadata?.proposerDetails?.emailId ||
      (p.quotation as any)?.motorMetadata?.proposerDetails?.emailId ||
      contact?.email ||
      customer?.email ||
      null;
    dto.customerName =
      proposerName ||
      rawCustomerName ||
      dto.contactName;
    dto.customerId = p.customerId || null;

    dto.insurerName =
      (p as any).insurerDetail?.insurerName ||
      p.quotation?.insurerName ||
      (p as any).activeTpInsurer ||
      (p.quotation as any)?.activeTpInsurer ||
      (p as any).motorMetadata?.insurerName ||
      (p.quotation as any)?.motorMetadata?.insurerName ||
      (p.quotation?.calculationSnapshot as any)?.inputs?.insurer ||
      '—';
    dto.productLine =
      p.policyType ||
      p.quotation?.productType ||
      p.quotation?.policyType ||
      (p as any).motorMetadata?.policyType ||
      'MOTOR COMPREHENSIVE';
    dto.policyType = p.policyType || p.quotation?.policyType || null;

    const actualPrem = (p as any).actualPremium;
    const actualPremNum =
      actualPrem !== null && actualPrem !== undefined ? Number(actualPrem) : 0;
    const premAmountNum =
      p.premiumAmount !== null && p.premiumAmount !== undefined
        ? Number(p.premiumAmount)
        : 0;
    const quotePremNum =
      p.quotation?.totalPremium !== null && p.quotation?.totalPremium !== undefined
        ? Number(p.quotation.totalPremium)
        : 0;

    dto.totalPremium =
      actualPremNum > 0
        ? actualPremNum
        : premAmountNum > 0
        ? premAmountNum
        : quotePremNum > 0
        ? quotePremNum
        : 0;

    dto.netPayable = dto.totalPremium;
    dto.quotationCode = p.quotation?.quotationCode || null;

    const snap = (p.quotation?.calculationSnapshot as Record<string, any>) || {};
    const snapSummary = snap.outputs?.summary || snap.summary || {};
    const snapOutputs = snap.outputs || {};

    const basePrem =
      p.quotation?.basePremium !== null && p.quotation?.basePremium !== undefined
        ? Number(p.quotation.basePremium)
        : null;
    dto.netPremium =
      basePrem !== null && basePrem > 0
        ? basePrem
        : Number(snapSummary.netPremium || snap.netPremium || 0);

    dto.odPremium = Number(
      snapOutputs.od?.net ??
      snapOutputs.odGrossPremium ??
      snap.gstBreakdown?.od?.base ??
      (p as any).motorMetadata?.odPremium ??
      0
    );

    dto.tpPremium = Number(
      snapOutputs.tp?.net ??
      snapOutputs.tpGrossPremium ??
      snap.gstBreakdown?.tp?.base ??
      (p as any).motorMetadata?.tpPremium ??
      0
    );

    dto.addonPremium = Number(
      snapOutputs.addonPremium ??
      snapOutputs.od?.addons ??
      snap.addonPremium ??
      0
    );

    const disc =
      p.quotation?.discountAmount !== null && p.quotation?.discountAmount !== undefined
        ? Number(p.quotation.discountAmount)
        : null;
    dto.discountAmount =
      disc !== null && disc > 0
        ? disc
        : Number(snapSummary.totalDiscount || snap.totalDiscount || 0);

    dto.ncbPercentage =
      p.quotation?.ncbPercentage ??
      snap.inputs?.effectiveNcb ??
      0;

    const gst =
      p.quotation?.gstAmount !== null && p.quotation?.gstAmount !== undefined
        ? Number(p.quotation.gstAmount)
        : null;
    dto.gstAmount =
      gst !== null && gst > 0
        ? gst
        : Number(snapSummary.totalGst || snap.totalGst || 0);

    if ((!dto.netPremium || dto.netPremium <= 0) && dto.totalPremium > 0) {
      if (dto.gstAmount && dto.totalPremium > dto.gstAmount) {
        dto.netPremium = Math.round(dto.totalPremium - dto.gstAmount);
      } else {
        dto.netPremium = Math.round(dto.totalPremium / 1.18);
      }
    }

    dto.idvValue = Number(snap.idv || snap.outputs?.idv || 0);

    dto.startDate = (p as any).startDate || p.effectiveDate;
    dto.endDate = (p as any).endDate || p.expiryDate;
    dto.odStartDate = (p as any).odStartDate || null;
    dto.odExpiryDate = (p as any).odExpiryDate || null;
    dto.tpStartDate = (p as any).tpStartDate || null;
    dto.tpExpiryDate = (p as any).tpExpiryDate || null;

    dto.paymentStatus =
      (p as any).paymentStatus ||
      (p.payments && p.payments.length > 0 ? 'PAID' : 'PENDING');
    const totalPayments =
      p.payments?.reduce((sum, pay) => sum + Number(pay.amount || 0), 0) || 0;
    const quotationPayment = (p.quotation as any)?.motorPaymentRecord?.amount
      ? Number((p.quotation as any).motorPaymentRecord.amount)
      : 0;
    const effectivePaid =
      totalPayments > 0
        ? totalPayments
        : quotationPayment > 0
        ? quotationPayment
        : dto.paymentStatus === 'PAID' || (p as any).paymentStatus === 'SUCCESS'
        ? dto.totalPremium
        : 0;

    dto.paidAmount = effectivePaid;
    dto.receiptAmount = effectivePaid;
    dto.outstandingBalance = Math.max(0, dto.totalPremium - dto.paidAmount);

    const agentUser = (p as any).agent?.user;
    dto.renewalExecutive = agentUser
      ? `${agentUser.firstName || ''} ${agentUser.lastName || ''}`.trim()
      : null;

    const claimsList = (p as any).claims || [];
    dto.claimsCount = claimsList.length;

    const vehicle = (p as any).vehicle;
    if (vehicle) {
      dto.vehicle = {
        id: vehicle.id,
        registrationNumber: vehicle.registrationNumber || null,
        makeModel: vehicle.makeModel || null,
        manufactureYearMonth: vehicle.manufactureYearMonth || null,
        engineNumber: vehicle.engineNumber || null,
        chassisNumber: vehicle.chassisNumber || null,
        fuelType: vehicle.fuelType || null,
        rtoLocation: vehicle.rtoLocation || null,
        category: vehicle.category || null,
      };
    }

    if (claimsList.length > 0) {
      dto.claims = claimsList.map((c: any) => ({
        id: c.id,
        claimNumber: c.claimNumber,
        status: c.status,
        incidentDate: c.incidentDate || null,
        claimAmount: Number(c.claimAmount || 0),
        approvedAmount: c.approvedAmount !== null && c.approvedAmount !== undefined ? Number(c.approvedAmount) : null,
        description: c.description || null,
        createdAt: c.createdAt,
      }));
    }

    const endorsementsList = (p as any).endorsements || [];
    if (endorsementsList.length > 0) {
      dto.endorsements = endorsementsList.map((e: any) => ({
        id: e.id,
        endorsementNumber: e.endorsementNumber || null,
        type: e.type,
        status: e.status,
        reason: e.reason || null,
        createdAt: e.createdAt,
      }));
    }

    if (p.members) {
      dto.members = p.members.map((m) => ({
        id: m.id,
        firstName: m.firstName,
        lastName: m.lastName,
        relation: m.relation,
        dateOfBirth: m.dateOfBirth,
      }));
    }

    if (p.nominees) {
      dto.nominees = p.nominees.map((n) => ({
        id: n.id,
        firstName: n.firstName,
        lastName: n.lastName,
        relation: n.relation,
        percentage: Number(n.percentage),
      }));
    }

    if (p.renewals) {
      dto.renewals = p.renewals.map((r) => ({
        id: r.id,
        renewalNumber: r.renewalNumber,
        previousExpiry: r.previousExpiry,
        newExpiry: r.newExpiry,
        premiumAmount: Number(r.premiumAmount),
        createdAt: r.createdAt,
      }));
    }

    if (p.payments) {
      dto.payments = p.payments.map((pay) => ({
        id: pay.id,
        amount: Number(pay.amount),
        paymentDate: pay.paymentDate,
        transactionId: pay.transactionId,
        paymentMethod: pay.paymentMethod,
        status: pay.status,
      }));
    }

    const unifiedDocs: any[] = [];
    const seenIds = new Set<string>();

    if (Array.isArray(p.documents)) {
      for (const doc of p.documents) {
        if (!seenIds.has(doc.id)) {
          seenIds.add(doc.id);
          unifiedDocs.push({
            id: doc.id,
            documentId: null,
            documentType: doc.documentType || 'POLICY_DOCUMENT',
            fileKey: doc.fileKey,
            fileName: doc.fileName || doc.documentType || 'Policy Document',
            fileSize: doc.fileSize || 0,
            createdAt: doc.createdAt,
            source: 'POLICY',
            verificationStatus: 'VERIFIED',
          });
        }
      }
    }

    const quote = p.quotation as any;
    if (quote?.motorDocuments && Array.isArray(quote.motorDocuments)) {
      for (const mDoc of quote.motorDocuments) {
        const idKey = mDoc.documentId || mDoc.id;
        if (!seenIds.has(idKey)) {
          seenIds.add(idKey);
          const coreDoc = mDoc.document;
          unifiedDocs.push({
            id: mDoc.id,
            documentId: mDoc.documentId || null,
            documentType: mDoc.documentType || 'MOTOR_DOCUMENT',
            fileKey: coreDoc?.fileKey || coreDoc?.fileUrl || '',
            fileName: coreDoc?.originalFileName || coreDoc?.fileName || coreDoc?.name || mDoc.documentType || 'Quotation Document',
            fileSize: coreDoc?.fileSize || coreDoc?.size || 0,
            mimeType: coreDoc?.mimeType || 'application/pdf',
            createdAt: mDoc.createdAt || coreDoc?.createdAt || p.createdAt,
            source: 'QUOTATION',
            verificationStatus: mDoc.verificationStatus || 'PENDING',
          });
        }
      }
    }

    if (quote?.healthDocuments && Array.isArray(quote.healthDocuments)) {
      for (const hDoc of quote.healthDocuments) {
        const idKey = hDoc.documentId || hDoc.id;
        if (!seenIds.has(idKey)) {
          seenIds.add(idKey);
          const coreDoc = hDoc.document;
          unifiedDocs.push({
            id: hDoc.id,
            documentId: hDoc.documentId || null,
            documentType: hDoc.documentType || 'HEALTH_DOCUMENT',
            fileKey: coreDoc?.fileKey || coreDoc?.fileUrl || '',
            fileName: coreDoc?.originalFileName || coreDoc?.fileName || coreDoc?.name || hDoc.documentType || 'Health Document',
            fileSize: coreDoc?.fileSize || coreDoc?.size || 0,
            mimeType: coreDoc?.mimeType || 'application/pdf',
            createdAt: hDoc.createdAt || coreDoc?.createdAt || p.createdAt,
            source: 'QUOTATION',
            verificationStatus: hDoc.verificationStatus || 'PENDING',
          });
        }
      }
    }

    const caseDocs = [
      ...(Array.isArray(quote?.case?.documents) ? quote.case.documents : []),
      ...(Array.isArray(quote?.healthCase?.documents) ? quote.healthCase.documents : []),
    ];
    for (const cDoc of caseDocs) {
      const idKey = cDoc.documentId || cDoc.id;
      if (!seenIds.has(idKey)) {
        seenIds.add(idKey);
        const coreDoc = cDoc.document;
        unifiedDocs.push({
          id: cDoc.id,
          documentId: cDoc.documentId || null,
          documentType: cDoc.documentType || 'CASE_DOCUMENT',
          fileKey: coreDoc?.fileKey || coreDoc?.fileUrl || '',
          fileName: coreDoc?.originalFileName || coreDoc?.fileName || coreDoc?.name || cDoc.documentType || 'Case Document',
          fileSize: coreDoc?.fileSize || coreDoc?.size || 0,
          mimeType: coreDoc?.mimeType || 'application/pdf',
          createdAt: cDoc.createdAt || coreDoc?.createdAt || p.createdAt,
          source: 'QUOTATION',
          verificationStatus: cDoc.verificationStatus || 'PENDING',
        });
      }
    }

    if (quote?.documents && Array.isArray(quote.documents)) {
      for (const qDoc of quote.documents) {
        if (!seenIds.has(qDoc.id)) {
          seenIds.add(qDoc.id);
          unifiedDocs.push({
            id: qDoc.id,
            documentId: null,
            documentType: qDoc.documentType || 'QUOTATION_DOCUMENT',
            fileKey: qDoc.fileKey || '',
            fileName: qDoc.fileKey ? qDoc.fileKey.split('/').pop() || qDoc.documentType : 'Quotation Document',
            fileSize: 0,
            createdAt: qDoc.createdAt || p.createdAt,
            source: 'QUOTATION',
            verificationStatus: 'VERIFIED',
          });
        }
      }
    }

    // 6. Direct Documents from core Document table (matching policy, quote, or inspection)
    if (directDocs && Array.isArray(directDocs)) {
      for (const d of directDocs) {
        if (!seenIds.has(d.id)) {
          seenIds.add(d.id);
          const isPolicyDoc = d.entityType === 'POLICY' || d.entityType === 'ENDORSEMENT';
          unifiedDocs.push({
            id: d.id,
            documentId: d.id,
            documentType: d.name || (isPolicyDoc ? 'POLICY_DOCUMENT' : 'QUOTATION_DOCUMENT'),
            fileKey: d.storageKey || d.fileUrl || '',
            fileName: d.originalFileName || d.name || 'Document',
            fileSize: d.size || 0,
            mimeType: d.mimeType || 'application/pdf',
            createdAt: d.createdAt || p.createdAt,
            source: isPolicyDoc ? 'POLICY' : 'QUOTATION',
            verificationStatus: d.verificationStatus || 'VERIFIED',
          });
        }
      }
    }

    dto.documents = unifiedDocs;

    if (p.histories) {
      dto.histories = p.histories.map((h) => ({
        id: h.id,
        status: h.status,
        comments: h.comments,
        createdById: h.createdById,
        createdAt: h.createdAt,
      }));
    }

    const policyNextActions: Record<
      string,
      { waitingFor: string; nextAction: string }
    > = {
      ISSUED: {
        waitingFor: 'Policy Inception Date',
        nextAction: 'Awaiting coverage effective date',
      },
      ACTIVE: {
        waitingFor: 'Renewal Window',
        nextAction:
          'Policy currently active; monitor for endorsements or renewal',
      },
      CANCELLED: {
        waitingFor: 'None',
        nextAction: 'Policy terminated and archived',
      },
      EXPIRED: {
        waitingFor: 'Customer Renewal Action',
        nextAction: 'Engage customer for lapsed renewal recovery',
      },
    };
    const pAction = policyNextActions[p.status] || {
      waitingFor: 'Review',
      nextAction: 'Monitor policy status',
    };
    dto.workflowState = {
      status: p.status,
      ownerId: p.createdById,
      ownerName: null,
      waitingFor: pAction.waitingFor,
      nextAction: pAction.nextAction,
      blocker: null,
      dueAt: p.expiryDate,
      lastTransitionAt: p.updatedAt,
    };

    return dto;
  }

  static toResponseList(
    policies: PolicyWithRelations[],
    directDocsMap?: Map<string, any[]>,
  ): PolicyResponseDto[] {
    return policies.map((p) =>
      this.toResponse(p, directDocsMap ? directDocsMap.get(p.id) : undefined),
    );
  }
}
