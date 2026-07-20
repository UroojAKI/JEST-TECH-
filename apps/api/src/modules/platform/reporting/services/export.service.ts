import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Readable } from 'stream';

export type ExportFormat = 'csv' | 'excel' | 'pdf';

export interface ExportResult {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  filename: string;
}

export interface ExportProvider {
  export(
    data: Record<string, any>[],
    columns: { field: string; label: string }[],
    reportName: string,
    format: ExportFormat,
  ): Promise<ExportResult>;
}

@Injectable()
export class ExportService implements ExportProvider {
  async export(
    data: Record<string, any>[],
    columns: { field: string; label: string }[],
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

  streamCsv(
    generator: AsyncGenerator<Record<string, any>, void, unknown>,
    columns: { field: string; label: string }[],
  ): Readable {
    const self = this;
    async function* csvGenerator() {
      // Header row
      yield columns.map((c) => c.label).join(',') + '\n';
      
      for await (const row of generator) {
        yield columns
          .map((col) => {
            const val = row[col.field] ?? '';
            const str = val instanceof Date ? val.toISOString() : String(val);
            return `"${str.replace(/"/g, '""')}"`;
          })
          .join(',') + '\n';
      }
    }
    return Readable.from(csvGenerator());
  }

  private isCurrencyField(field: string): boolean {
    const lower = field.toLowerCase();
    return (
      lower.includes('amount') ||
      lower.includes('premium') ||
      lower.includes('revenue') ||
      lower.includes('collected') ||
      lower.includes('paid') ||
      lower.includes('fee') ||
      lower.includes('settlement')
    );
  }

  private exportCsv(data: Record<string, any>[], columns: { field: string; label: string }[], reportName: string): ExportResult {
    const header = columns.map((c) => c.label).join(',');
    const rows = data.map((row) =>
      columns
        .map((col) => {
          const val = row[col.field] ?? '';
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

  private async exportExcel(data: Record<string, any>[], columns: { field: string; label: string }[], reportName: string): Promise<ExportResult> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'JEST Policy CRM';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(reportName.substring(0, 31));

    // Header row
    sheet.addRow(columns.map((c) => c.label));
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    headerRow.alignment = { vertical: 'middle' };
    headerRow.height = 22;

    // Auto-size columns
    sheet.columns = columns.map((col) => ({
      key: col.field,
      width: Math.max(col.label.length + 4, 16),
    }));

    // Data rows
    for (const row of data) {
      const rowValues = columns.map((col) => {
        const val = row[col.field];
        if (val instanceof Date) return val.toLocaleDateString('en-IN');
        if (val === null || val === undefined) return '';
        return val;
      });
      const addedRow = sheet.addRow(rowValues);
      addedRow.height = 18;

      // Apply currency formatting to matching numeric columns
      columns.forEach((col, idx) => {
        if (this.isCurrencyField(col.field)) {
          const cell = addedRow.getCell(idx + 1);
          const cellVal = row[col.field];
          if (typeof cellVal === 'number') {
            cell.value = cellVal;
            cell.numFmt = '₹#,##0.00';
          }
        }
      });
    }

    // Totals row for numeric columns
    const numericCols = columns.filter((col) => data.length > 0 && typeof data[0][col.field] === 'number');
    if (numericCols.length > 0) {
      const totals = columns.map((col) => {
        if (numericCols.some((nc) => nc.field === col.field)) {
          return data.reduce((sum, row) => sum + (Number(row[col.field]) || 0), 0);
        }
        return col === columns[0] ? 'TOTAL' : '';
      });
      const totalRow = sheet.addRow(totals);
      totalRow.font = { bold: true };
      totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

      columns.forEach((col, idx) => {
        if (this.isCurrencyField(col.field)) {
          const cell = totalRow.getCell(idx + 1);
          if (typeof cell.value === 'number') {
            cell.numFmt = '₹#,##0.00';
          }
        }
      });
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return {
      buffer,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
      filename: `${this.slugify(reportName)}_${this.dateStamp()}.xlsx`,
    };
  }

  private async exportPdf(data: Record<string, any>[], columns: { field: string; label: string }[], reportName: string): Promise<ExportResult> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PdfPrinter = require('pdfmake');
    const fonts = {
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    };
    const printer = new PdfPrinter(fonts);

    const tableBody: any[] = [];
    // Header Row
    tableBody.push(
      columns.map((c) => ({
        text: c.label,
        bold: true,
        fillColor: '#4F46E5',
        color: '#FFFFFF',
        margin: [4, 4, 4, 4],
      })),
    );

    // Data Rows
    for (const row of data) {
      tableBody.push(
        columns.map((col) => {
          const val = row[col.field];
          let str = '';
          if (val instanceof Date) {
            str = val.toLocaleDateString('en-IN');
          } else if (typeof val === 'number' && this.isCurrencyField(col.field)) {
            str = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
          } else {
            str = String(val ?? '');
          }
          return {
            text: str,
            margin: [4, 4, 4, 4],
          };
        }),
      );
    }

    const docDefinition = {
      pageOrientation: columns.length > 6 ? 'landscape' : 'portrait',
      header: (currentPage: number) => {
        if (currentPage === 1) return null;
        return {
          text: `JEST Policy CRM — ${reportName}`,
          alignment: 'right',
          fontSize: 8,
          color: '#94A3B8',
          margin: [40, 15, 40, 0],
        };
      },
      footer: (currentPage: number, pageCount: number) => {
        return {
          text: `Page ${currentPage} of ${pageCount}`,
          alignment: 'center',
          fontSize: 8,
          color: '#94A3B8',
          margin: [0, 0, 0, 15],
        };
      },
      content: [
        { text: reportName, style: 'header' },
        { text: `Generated: ${new Date().toLocaleString('en-IN')}`, style: 'subheader' },
        { text: `Total Records: ${data.length}`, style: 'subheader', margin: [0, 0, 0, 15] },
        {
          table: {
            headerRows: 1,
            body: tableBody,
          },
        },
      ],
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 9,
      },
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          margin: [0, 0, 0, 5],
        },
        subheader: {
          fontSize: 10,
          color: '#666666',
        },
      },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      pdfDoc.on('data', (chunk: any) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', (err: any) => reject(err));
      pdfDoc.end();
    });

    return {
      buffer,
      mimeType: 'application/pdf',
      extension: 'pdf',
      filename: `${this.slugify(reportName)}_${this.dateStamp()}.pdf`,
    };
  }

  private slugify(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  private dateStamp(): string {
    return new Date().toISOString().split('T')[0];
  }
}
