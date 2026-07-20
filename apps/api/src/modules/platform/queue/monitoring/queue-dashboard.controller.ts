import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { QueueDashboardService } from './queue-dashboard.service';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { JobStatus } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN') // Only admins can access queue dashboard
@Controller('queue')
export class QueueDashboardController {
  constructor(private readonly queueDashboardService: QueueDashboardService) {}

  @Get('jobs')
  async getJobs(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('status') status?: JobStatus,
  ) {
    return this.queueDashboardService.getJobs(
      skip ? parseInt(skip, 10) : 0,
      take ? parseInt(take, 10) : 20,
      status,
    );
  }

  @Get('statistics')
  async getStatistics() {
    return this.queueDashboardService.getStatistics();
  }

  @Get('jobs/:id')
  async getJobDetails(@Param('id') id: string) {
    return this.queueDashboardService.getJobDetails(id);
  }

  @Post('jobs/:id/retry')
  async retryJob(@Param('id') id: string) {
    return this.queueDashboardService.retryJob(id);
  }

  @Delete('jobs/:id')
  async deleteJob(@Param('id') id: string) {
    return this.queueDashboardService.deleteJob(id);
  }
}
