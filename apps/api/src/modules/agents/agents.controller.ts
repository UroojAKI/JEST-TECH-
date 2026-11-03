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
  Headers,
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
import {
  AgentExternalCodeActionDto,
  AgentExternalCodeHistoryQueryDto,
  AgentExternalCodeQueryDto,
  CreateAgentExternalCodeDto,
  ResolveAgentIdentifierDto,
  UpdateAgentExternalCodeDto,
} from './dto/agent-external-code.dto';
import { AgentIdentityResolverService } from './agent-identity-resolver.service';
import { ParseUUIDPipe } from '../../common/utils/parse-uuid.pipe';

@ApiTags('Agents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('agents')
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly agentIdentityResolver: AgentIdentityResolverService,
  ) {}

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

  @Get('external-codes/resolve')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'Resolve an explicitly namespaced Agent identifier' })
  resolveAgentIdentifier(
    @Query() query: ResolveAgentIdentifierDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.agentIdentityResolver.resolveAgentIdentifier(query, user);
  }

  @Post(':id/external-codes')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register an external identifier for an Agent' })
  registerExternalCode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateAgentExternalCodeDto,
    @CurrentUser() user: RequestUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.agentIdentityResolver.registerExternalCode(id, dto, user, correlationId);
  }

  @Get(':id/external-codes')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'List an Agent’s registered external identifiers' })
  listExternalCodes(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AgentExternalCodeQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.agentIdentityResolver.listExternalCodes(id, query, user);
  }

  @Patch(':id/external-codes/:codeId')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Edit or verify an external Agent identifier' })
  updateExternalCode(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('codeId', ParseUUIDPipe) codeId: string,
    @Body() dto: UpdateAgentExternalCodeDto,
    @CurrentUser() user: RequestUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.agentIdentityResolver.updateExternalCode(id, codeId, dto, user, correlationId);
  }

  @Post(':id/external-codes/:codeId/deactivate')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate an external Agent identifier' })
  deactivateExternalCode(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('codeId', ParseUUIDPipe) codeId: string,
    @Body() dto: AgentExternalCodeActionDto,
    @CurrentUser() user: RequestUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.agentIdentityResolver.deactivateExternalCode(id, codeId, dto.reason, user, correlationId);
  }

  @Post(':id/external-codes/:codeId/reactivate')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate an external Agent identifier' })
  reactivateExternalCode(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('codeId', ParseUUIDPipe) codeId: string,
    @Body() dto: AgentExternalCodeActionDto,
    @CurrentUser() user: RequestUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.agentIdentityResolver.reactivateExternalCode(id, codeId, dto.reason, user, correlationId);
  }

  @Get(':id/external-codes/:codeId/history')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'View an external Agent identifier’s audit history' })
  externalCodeHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('codeId', ParseUUIDPipe) codeId: string,
    @Query() query: AgentExternalCodeHistoryQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.agentIdentityResolver.listExternalCodeHistory(id, codeId, query, user);
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
