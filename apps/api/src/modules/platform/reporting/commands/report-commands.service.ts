import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReportsRepository } from '../repositories/reports.repository';
import { ReportBuilderService } from '../services/report-builder.service';
import { ExportService } from '../services/export.service';
import {
  CreateReportCommand,
  UpdateReportCommand,
  DeleteReportCommand,
  ExecuteReportCommand,
  CreateScheduleCommand,
  UpdateScheduleCommand,
  DeleteScheduleCommand,
} from './report.commands';

@Injectable()
export class ReportCommandsService {
  constructor(
    private readonly repository: ReportsRepository,
    private readonly builder: ReportBuilderService,
    private readonly exporter: ExportService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async handleCreateReport(command: CreateReportCommand) {
    const existing = await this.repository.findByCode(command.dto.code);
    if (existing) {
      throw new BadRequestException(
        `Report template with code '${command.dto.code}' already exists`,
      );
    }

    return this.repository.create({
      ...command.dto,
      createdById: command.userId,
    });
  }

  async handleUpdateReport(command: UpdateReportCommand) {
    return this.repository.update(command.id, {
      ...command.dto,
      updatedById: command.userId,
    });
  }

  async handleDeleteReport(command: DeleteReportCommand) {
    return this.repository.softDelete(command.id);
  }

  async handleExecuteReport(
    command: ExecuteReportCommand,
    format: 'csv' | 'excel' | 'pdf' = 'csv',
  ) {
    const report = await this.repository.findById(command.reportId);
    if (!report) {
      throw new NotFoundException(
        `Report with ID ${command.reportId} not found`,
      );
    }

    const execution = await this.repository.createExecution({
      reportId: report.id,
      requestedById: command.userId,
      status: 'RUNNING',
      parameters: command.parameters,
    });

    const startTime = Date.now();

    try {
      // Build data using builder service
      const { rows, columns } = await this.builder.buildReportData(
        report,
        command.parameters,
      );

      // Export using export service
      const exported = await this.exporter.export(
        rows,
        columns,
        report.name,
        format,
      );

      const duration = Date.now() - startTime;

      // Update execution status
      await this.repository.updateExecution(execution.id, {
        status: 'COMPLETED',
        duration,
        recordCount: rows.length,
        completedAt: new Date(),
      });

      // Update statistics on the Report itself
      await this.repository.updateStats(report.id, duration);

      // Emit event
      this.eventEmitter.emit('report.executed', {
        executionId: execution.id,
        reportId: report.id,
        requestedById: command.userId,
        recordCount: rows.length,
        duration,
      });

      return {
        executionId: execution.id,
        ...exported,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.repository.updateExecution(execution.id, {
        status: 'FAILED',
        duration,
        completedAt: new Date(),
      });
      throw error;
    }
  }

  async handleCreateSchedule(command: CreateScheduleCommand) {
    const report = await this.repository.findById(command.reportId);
    if (!report) {
      throw new NotFoundException(
        `Report with ID ${command.reportId} not found`,
      );
    }

    return this.repository.createSchedule({
      reportId: command.reportId,
      cronExpression: command.dto.cronExpression,
      frequency: command.dto.frequency,
      timezone: command.dto.timezone,
    });
  }

  async handleUpdateSchedule(command: UpdateScheduleCommand) {
    return this.repository.updateSchedule(command.id, command.dto);
  }

  async handleDeleteSchedule(command: DeleteScheduleCommand) {
    return this.repository.deleteSchedule(command.id);
  }
}
