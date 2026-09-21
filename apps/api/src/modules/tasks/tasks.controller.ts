import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RoleType, BackOfficeTaskStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/decorators/current-user.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { CreateBackOfficeTaskDto } from './dto/create-back-office-task.dto';
import { ResolveBackOfficeTaskDto } from './dto/resolve-back-office-task.dto';
import { ParseUUIDPipe } from '../../common/utils/parse-uuid.pipe';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('today')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({
    summary: 'Get operational tasks due today and overdue for caller',
  })
  getTasksToday(@CurrentUser() user: RequestUser) {
    return this.tasksService.getTasksToday(user);
  }

  @Get('back-office/queue')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get back office operational task queue' })
  getBackOfficeQueue(
    @Query('status') status?: BackOfficeTaskStatus,
    @Query('assignedToId') assignedToId?: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.tasksService.getBackOfficeQueue(status, assignedToId, user);
  }

  @Get('back-office/:id')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get back office task detail by ID' })
  getBackOfficeTaskById(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.getBackOfficeTaskById(id);
  }

  @Post('back-office')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a back office verification task' })
  createBackOfficeTask(
    @Body() dto: CreateBackOfficeTaskDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.createBackOfficeTask(dto, user);
  }

  @Patch('back-office/:id/assign')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Assign back office task to executive' })
  assignBackOfficeTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('assignedToId', ParseUUIDPipe) assignedToId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.assignBackOfficeTask(id, assignedToId, user);
  }

  @Patch('back-office/:id/resolve')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({
    summary: 'Resolve (Verify, Reject, Complete) back office task',
  })
  resolveBackOfficeTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveBackOfficeTaskDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.resolveBackOfficeTask(id, dto, user);
  }

  @Get()
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'List tasks with pagination and filtering' })
  findAll(@Query() query: TaskQueryDto, @CurrentUser() user: RequestUser) {
    return this.tasksService.findAll(query, user);
  }

  @Get(':id')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'Get task by ID' })
  findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.findById(id, user);
  }

  @Post()
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new task' })
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: RequestUser) {
    return this.tasksService.create(dto, user);
  }

  @Patch(':id')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'Update task details' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.update(id, dto, user);
  }

  @Patch(':id/complete')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'Mark task completed' })
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.complete(id, user);
  }
}
