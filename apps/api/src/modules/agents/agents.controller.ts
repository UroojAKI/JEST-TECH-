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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/decorators/current-user.decorator';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { AgentQueryDto } from './dto/agent-query.dto';
import { ParseUUIDPipe } from '../../common/utils/parse-uuid.pipe';

@ApiTags('Agents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get('me')
  @Roles(RoleType.AGENT, RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get current user agent profile' })
  findMe(@CurrentUser() user: RequestUser) {
    return this.agentsService.findMe(user);
  }

  @Get()
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'List agents' })
  findAll(@Query() query: AgentQueryDto, @CurrentUser() user: RequestUser) {
    return this.agentsService.findAll(query, user);
  }

  @Get(':id')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'Get agent profile by ID' })
  findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.agentsService.findById(id, user);
  }

  @Get(':id/stats')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'Get agent performance statistics' })
  getStats(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.agentsService.getAgentStats(id, user);
  }

  @Post()
  @Roles(RoleType.ADMIN, RoleType.AGENT)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create or register agent profile' })
  create(@Body() dto: CreateAgentDto, @CurrentUser() user: RequestUser) {
    return this.agentsService.create(dto, user);
  }

  @Patch(':id')
  @Roles(RoleType.ADMIN, RoleType.AGENT)
  @ApiOperation({ summary: 'Update agent profile' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.agentsService.update(id, dto, user);
  }
}
