import { Injectable } from '@nestjs/common';

@Injectable()
export class PdfService {
  /**
   * Stub generator simulating quotation PDF file generation.
   * Returns metadata indicating document key, name, and size.
   */
  generatePdfStub(quotationCode: string): { fileName: string; fileKey: string; fileSize: number } {
    const cleanCode = quotationCode.replace(/[^a-zA-Z0-9]/g, '_');
    return {
      fileName: `quotation_${cleanCode}.pdf`,
      fileKey: `quotes/${cleanCode}_${Date.now()}.pdf`,
      fileSize: Math.floor(Math.random() * (150000 - 45000 + 1) + 45000), // size in bytes (45KB to 150KB)
    };
  }
}
