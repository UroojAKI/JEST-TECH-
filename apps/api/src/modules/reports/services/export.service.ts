import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

export type ExportFormat = 'csv' | 'excel' | 'pdf';

export interface ExportResult {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  filename: string;
}

@Injectable()
export class ExportService {
  async export(
    data: Record<string, any>[],
    columns: string[],
    reportName: string,
    format: ExportFormat,
  ): Promise<ExportResult> {
    switch (format) {
      case 'csv':
        return this.exportCsv(data, columns, reportName);
      case 'excel':
        return this.exportExcel(data, columns, reportName);
      case 'pdf':
        return this.exportPdf(data, columns, reportName);
      default:
        return this.exportCsv(data, columns, reportName);
    }
  }

  private exportCsv(data: Record<string, any>[], columns: string[], reportName: string): ExportResult {
    const header = columns.join(',');
    const rows = data.map((row) =>
      columns
        .map((col) => {
          const val = row[col] ?? '';
          const str = val instanceof Date ? val.toISOString() : String(val);
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(','),
    );
    const csv = [header, ...rows].join('\n');
    const buffer = Buffer.from(csv, 'utf-8');
    return {
      buffer,
      mimeType: 'text/csv',
      extension: 'csv',
      filename: `${this.slugify(reportName)}_${this.dateStamp()}.csv`,
    };
  }

  private async exportExcel(data: Record<string, any>[], columns: string[], reportName: string): Promise<ExportResult> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'JEST Policy CRM';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(reportName.substring(0, 31));

    // Header row
    sheet.addRow(columns.map((c) => this.formatColumnHeader(c)));
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    headerRow.alignment = { vertical: 'middle' };
    headerRow.height = 22;

    // Auto-size columns
    sheet.columns = columns.map((col) => ({
      key: col,
      width: Math.max(col.length + 4, 16),
    }));

    // Data rows
    for (const row of data) {
      const rowValues = columns.map((col) => {
        const val = row[col];
        if (val instanceof Date) return val.toLocaleDateString('en-IN');
        if (val === null || val === undefined) return '';
        return val;
      });
      const addedRow = sheet.addRow(rowValues);
      addedRow.height = 18;
    }

    // Totals row for numeric columns
    const numericCols = columns.filter((col) => data.length > 0 && typeof data[0][col] === 'number');
    if (numericCols.length > 0) {
      const totals = columns.map((col) => {
        if (numericCols.includes(col)) {
          return data.reduce((sum, row) => sum + (Number(row[col]) || 0), 0);
        }
        return col === columns[0] ? 'TOTAL' : '';
      });
      const totalRow = sheet.addRow(totals);
      totalRow.font = { bold: true };
      totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return {
      buffer,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
      filename: `${this.slugify(reportName)}_${this.dateStamp()}.xlsx`,
    };
  }

  private exportPdf(data: Record<string, any>[], columns: string[], reportName: string): ExportResult {
    // Build a clean HTML table, convert to basic structured text format
    // pdfmake requires complex setup; we generate a clean text-based PDF structure
    const lines: string[] = [];
    lines.push(`JEST Policy CRM — ${reportName}`);
    lines.push(`Generated: ${new Date().toLocaleString('en-IN')}`);
    lines.push(`Total Records: ${data.length}`);
    lines.push('');
    lines.push(columns.map((c) => this.formatColumnHeader(c).padEnd(20)).join(' | '));
    lines.push('-'.repeat(columns.length * 22));

    for (const row of data.slice(0, 500)) { // PDF limit
      lines.push(
        columns
          .map((col) => {
            const val = row[col];
            let str = val instanceof Date ? val.toLocaleDateString('en-IN') : String(val ?? '');
            return str.substring(0, 20).padEnd(20);
          })
          .join(' | '),
      );
    }

    // Build minimal PDF using raw PDF syntax
    const content = lines.join('\n');
    const pdfContent = this.buildSimplePdf(reportName, content);
    const buffer = Buffer.from(pdfContent, 'binary');
    return {
      buffer,
      mimeType: 'application/pdf',
      extension: 'pdf',
      filename: `${this.slugify(reportName)}_${this.dateStamp()}.pdf`,
    };
  }

  private buildSimplePdf(title: string, content: string): string {
    // Minimal valid PDF structure
    const sanitized = content.replace(/[^\x20-\x7E\n]/g, '?');
    const lines = sanitized.split('\n');
    let y = 750;
    const pageHeight = 800;
    let streamContent = `BT\n/F1 8 Tf\n`;

    for (const line of lines) {
      if (y < 50) break;
      const escapedLine = line.replace(/\(/, '\\(').replace(/\)/, '\\)').replace(/\\/, '\\\\');
      streamContent += `72 ${y} Td\n(${escapedLine}) Tj\n0 -11 Td\n`;
      y -= 11;
    }
    streamContent += `ET`;

    const stream = streamContent;
    const streamLen = Buffer.byteLength(stream, 'binary');

    return `%PDF-1.4
1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj
2 0 obj<</Type /Pages /Kids [3 0 R] /Count 1>>endobj
3 0 obj<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>>endobj
4 0 obj<</Length ${streamLen}>>
stream
${stream}
endstream
endobj
5 0 obj<</Type /Font /Subtype /Type1 /BaseFont /Courier>>endobj
xref
0 6
0000000000 65535 f
trailer<</Size 6 /Root 1 0 R>>
startxref
0
%%EOF`;
  }

  private formatColumnHeader(col: string): string {
    return col.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim();
  }

  private slugify(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  private dateStamp(): string {
    return new Date().toISOString().split('T')[0];
  }
}
