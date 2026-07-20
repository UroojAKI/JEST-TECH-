import { CreateReportDto, UpdateReportDto, CreateScheduleDto, UpdateScheduleDto } from '../dto/report.dto';

export class CreateReportCommand {
  constructor(
    public readonly dto: CreateReportDto,
    public readonly userId: string,
  ) {}
}

export class UpdateReportCommand {
  constructor(
    public readonly id: string,
    public readonly dto: UpdateReportDto,
    public readonly userId: string,
  ) {}
}

export class DeleteReportCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}

export class ExecuteReportCommand {
  constructor(
    public readonly reportId: string,
    public readonly parameters: Record<string, any>,
    public readonly userId: string | null,
  ) {}
}

export class CreateScheduleCommand {
  constructor(
    public readonly reportId: string,
    public readonly dto: CreateScheduleDto,
  ) {}
}

export class UpdateScheduleCommand {
  constructor(
    public readonly id: string,
    public readonly dto: UpdateScheduleDto,
  ) {}
}

export class DeleteScheduleCommand {
  constructor(
    public readonly id: string,
  ) {}
}
