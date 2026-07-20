import { Injectable, NotFoundException } from '@nestjs/common';
import { ReportsRepository } from '../repositories/reports.repository';
import { ReportBuilderService } from '../services/report-builder.service';
import { GetReportQuery, GetReportsQuery, PreviewReportQuery, GetExecutionHistoryQuery } from './report.queries';

@Injectable()
export class ReportQueriesService {
  constructor(
    private readonly repository: ReportsRepository,
    private readonly builder: ReportBuilderService,
  ) {}

  async handleGetReport(query: GetReportQuery) {
    let report = await this.repository.findById(query.idOrCode);
    if (!report) {
      report = await this.repository.findByCode(query.idOrCode);
    }
    if (!report) {
      throw new NotFoundException(`Report with ID or Code '${query.idOrCode}' not found`);
    }
    return report;
  }

  async handleGetReports(query: GetReportsQuery) {
    return this.repository.findAll(query.filters);
  }

  async handlePreviewReport(query: PreviewReportQuery) {
    const report = await this.repository.findById(query.reportId);
    if (!report) {
      throw new NotFoundException(`Report with ID ${query.reportId} not found`);
    }

    return this.builder.buildReportData(report, query.parameters, {
      limit: 20,
      search: query.search,
    });
  }

  async handleGetExecutionHistory(query: GetExecutionHistoryQuery) {
    return this.repository.getExecutions(query.reportId);
  }

  async favoriteReport(reportId: string, userId: string) {
    return this.repository.favorite(reportId, userId);
  }

  async unfavoriteReport(reportId: string, userId: string) {
    return this.repository.unfavorite(reportId, userId);
  }

  async getFavorites(userId: string) {
    return this.repository.getFavorites(userId);
  }

  async saveFilter(reportId: string, userId: string, name: string, filters: any) {
    return this.repository.saveFilter(reportId, userId, name, filters);
  }

  async getSavedFilters(reportId: string, userId: string) {
    return this.repository.getSavedFilters(reportId, userId);
  }

  async deleteSavedFilter(filterId: string, userId: string) {
    return this.repository.deleteSavedFilter(filterId, userId);
  }
}
