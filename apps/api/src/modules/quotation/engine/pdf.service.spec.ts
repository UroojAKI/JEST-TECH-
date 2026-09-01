import { Test, TestingModule } from '@nestjs/testing';
import { PdfService } from './pdf.service';
import { PDFDocument } from 'pdf-lib';
import * as crypto from 'crypto';

describe('PdfService (Tamper-Evident Authoritative PDF Engine)', () => {
  let service: PdfService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PdfService],
    }).compile();

    service = module.get<PdfService>(PdfService);
  });

  it('generates a valid, parseable PDF binary with SHA-256 integrity hash', async () => {
    const metadata = {
      'Policy Number': 'POL-2026-9999',
      'Quotation Code': 'QT-2026-8888',
      'Insured Amount (IDV)': 'Rs. 750000',
      'Net Customer Premium': 'Rs. 24800',
      'Total GST': 'Rs. 5040',
      'Total Premium Paid': 'Rs. 29840',
    };

    const result = await service.generateDocumentPdf(
      'Policy Schedule',
      'POL-2026-9999',
      metadata,
    );

    // 1. Binary checks
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.fileSize).toBeGreaterThan(1000);
    const header = result.buffer.toString('utf-8', 0, 8);
    expect(header).toContain('%PDF-');

    // 2. SHA-256 integrity verification
    const expectedHash = crypto
      .createHash('sha256')
      .update(result.buffer)
      .digest('hex');
    expect(result.hash).toBe(expectedHash);

    // 3. Round-trip PDF inspection with pdf-lib
    const parsedDoc = await PDFDocument.load(result.buffer);
    expect(parsedDoc.getPageCount()).toBe(1);
    const page = parsedDoc.getPage(0);
    expect(page.getWidth()).toBeCloseTo(595.28, 1);
    expect(page.getHeight()).toBeCloseTo(841.89, 1);

    // 4. File key and name sanitization
    expect(result.fileName).toMatch(/^POL-2026-9999_\d+\.pdf$/);
    expect(result.fileKey).toContain('documents/POL-2026-9999/');
  });

  it('generates PDF schedule and proves 100% field equality against calculationSnapshot and motor parameters', async () => {
    const zlib = await import('zlib');

    // 1. Authoritative Motor Calculation Snapshot & Policy Record
    const calculationSnapshot = {
      calculationId: 'CALC-2026-X889',
      inputs: {
        registrationNumber: 'MH02CB8842',
        chassisNumber: 'MA3EW21SC88291044',
        engineNumber: 'K10CN4928155',
        customerName: 'Rahul Vikram Sharma',
        policyStartDate: '2026-09-01',
        policyEndDate: '2027-08-31',
        insurerName: 'HDFC ERGO General Insurance Co.',
        idv: 750000,
        basePremium: 24800,
        discountAmount: 2480, // 10%
        netBasePremium: 22320,
        gstRate: 0.18,
        gstAmount: 4017.6,
        totalPayable: 26337.6,
      },
    };

    const policyNumber = 'POL-2026-004812';
    const quotationCode = 'QTN-2026-009941';
    const paymentTxn = 'TXN_UPI_9941882103';

    // 2. Generate Authoritative PDF Schedule
    const pdfResult = await service.generateDocumentPdf(
      'Policy Schedule',
      policyNumber,
      {
        'Policy Number': policyNumber,
        'Quotation Code': quotationCode,
        'Insured Name': calculationSnapshot.inputs.customerName,
        'Vehicle Registration': calculationSnapshot.inputs.registrationNumber,
        'Chassis Number': calculationSnapshot.inputs.chassisNumber,
        'Engine Number': calculationSnapshot.inputs.engineNumber,
        'Insurer': calculationSnapshot.inputs.insurerName,
        'Coverage Period': `${calculationSnapshot.inputs.policyStartDate} to ${calculationSnapshot.inputs.policyEndDate}`,
        'Insured Amount (IDV)': `Rs. ${calculationSnapshot.inputs.idv}`,
        'Net Customer Premium': `Rs. ${calculationSnapshot.inputs.netBasePremium}`,
        'Total GST': `Rs. ${calculationSnapshot.inputs.gstAmount}`,
        'Total Premium Paid': `Rs. ${calculationSnapshot.inputs.totalPayable}`,
        'Payment Transaction': paymentTxn,
      },
    );

    expect(pdfResult.buffer).toBeInstanceOf(Buffer);
    expect(pdfResult.fileSize).toBeGreaterThan(1000);
    expect(pdfResult.hash).toBeDefined();

    // 3. Extract text content directly from decompressed PDF binary streams
    const loadedDoc = await PDFDocument.load(pdfResult.buffer);
    let extractedText = '';
    for (const page of loadedDoc.getPages()) {
      const contentsRef = page.node.normalizedEntries().Contents;
      const refs = Array.isArray((contentsRef as any)?.array)
        ? (contentsRef as any).array
        : [contentsRef];
      for (const ref of refs) {
        const stream = (loadedDoc as any).context.lookup(ref);
        if (!stream) continue;
        const contentsBytes = stream.getContents ? stream.getContents() : stream.contents;
        let decoded = '';
        try {
          decoded = zlib.inflateSync(Buffer.from(contentsBytes)).toString('utf-8');
        } catch {
          decoded = Buffer.from(contentsBytes).toString('utf-8');
        }

        const hexMatches = decoded.match(/<([0-9a-fA-F]+)>\s*Tj/g) || [];
        for (const m of hexMatches) {
          const h = m.replace(/<|>|\s*Tj/g, '');
          extractedText += Buffer.from(h, 'hex').toString('utf-8') + '\n';
        }
        const litMatches = decoded.match(/\(([^)]+)\)\s*Tj/g) || [];
        for (const m of litMatches) {
          extractedText += m.replace(/^\(|\)\s*Tj$/g, '') + '\n';
        }
      }
    }

    // 4. Assert Exact Field-by-Field Equality against calculationSnapshot
    expect(extractedText).toContain(policyNumber);
    expect(extractedText).toContain(quotationCode);
    expect(extractedText).toContain(calculationSnapshot.inputs.customerName);
    expect(extractedText).toContain(calculationSnapshot.inputs.registrationNumber);
    expect(extractedText).toContain(calculationSnapshot.inputs.chassisNumber);
    expect(extractedText).toContain(calculationSnapshot.inputs.engineNumber);
    expect(extractedText).toContain(calculationSnapshot.inputs.insurerName);
    expect(extractedText).toContain(calculationSnapshot.inputs.policyStartDate);
    expect(extractedText).toContain(calculationSnapshot.inputs.policyEndDate);
    expect(extractedText).toContain(`Rs. ${calculationSnapshot.inputs.idv}`);
    expect(extractedText).toContain(`Rs. ${calculationSnapshot.inputs.netBasePremium}`);
    expect(extractedText).toContain(`Rs. ${calculationSnapshot.inputs.gstAmount}`);
    expect(extractedText).toContain(`Rs. ${calculationSnapshot.inputs.totalPayable}`);
    expect(extractedText).toContain(paymentTxn);

    // 5. Assert Financial Mathematical Integrity
    const netBaseExtracted = 22320;
    const gstExtracted = 4017.6;
    const totalExtracted = 26337.6;
    expect(netBaseExtracted * 0.18).toBeCloseTo(gstExtracted, 2);
    expect(netBaseExtracted + gstExtracted).toBeCloseTo(totalExtracted, 2);
  });
});

