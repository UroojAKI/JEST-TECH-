import { Injectable } from '@nestjs/common';
import { ReportDataProvider } from '../interfaces/report-provider.interface';

@Injectable()
export class ReportDataProviderRegistry {
  private readonly providersMap = new Map<string, ReportDataProvider>();

  register(provider: ReportDataProvider, codes: string[]) {
    for (const code of codes) {
      this.providersMap.set(code.toUpperCase(), provider);
    }
  }

  getProvider(reportCode: string): ReportDataProvider | undefined {
    return this.providersMap.get(reportCode.toUpperCase());
  }
}
