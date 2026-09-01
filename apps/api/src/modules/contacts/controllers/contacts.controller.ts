import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import { CreateContactDto } from '../dto/create-contact.dto';
import { UpdateContactDto } from '../dto/update-contact.dto';
import { ContactsService } from '../services/contacts.service';
import { ParseUUIDPipe } from '../../../common/utils/parse-uuid.pipe';
import { PaginationDto } from '../../../common/pagination/pagination.dto';

const CONTACT_VIEW_ROLES: RoleType[] = [
  RoleType.SUPER_ADMIN,
  RoleType.ADMIN,
  RoleType.SYSTEM_ADMINISTRATOR,
  RoleType.MD_CEO,
  RoleType.BRANCH_MANAGER,
  RoleType.MARKETING_DIRECTOR,
  RoleType.TEAM_LEADER,
  RoleType.SALES_MANAGER,
  RoleType.SALES_AGENT,
  RoleType.SALES_EXECUTIVE,
  RoleType.POSP_ADVISOR,
  RoleType.AGENT_MANAGER,
  RoleType.OPERATIONS,
  RoleType.POLICY_ISSUANCE_EXECUTIVE,
  RoleType.UNDERWRITER,
  RoleType.CLAIMS_OFFICER,
  RoleType.RENEWAL_EXECUTIVE,
  RoleType.CUSTOMER_SERVICE_EXECUTIVE,
  RoleType.FINANCE,
  RoleType.FINANCE_ACCOUNTS_EXECUTIVE,
  RoleType.CHIEF_FINANCE_OFFICER,
  RoleType.SUPPORT,
];

const CONTACT_MANAGE_ROLES: RoleType[] = [
  RoleType.SUPER_ADMIN,
  RoleType.ADMIN,
  RoleType.SYSTEM_ADMINISTRATOR,
  RoleType.MD_CEO,
  RoleType.BRANCH_MANAGER,
  RoleType.MARKETING_DIRECTOR,
  RoleType.TEAM_LEADER,
  RoleType.SALES_MANAGER,
  RoleType.SALES_AGENT,
  RoleType.SALES_EXECUTIVE,
  RoleType.POSP_ADVISOR,
  RoleType.AGENT_MANAGER,
  RoleType.OPERATIONS,
  RoleType.POLICY_ISSUANCE_EXECUTIVE,
  RoleType.UNDERWRITER,
  RoleType.RENEWAL_EXECUTIVE,
  RoleType.CUSTOMER_SERVICE_EXECUTIVE,
  RoleType.SUPPORT,
];

@ApiTags('Contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  @Roles(...CONTACT_MANAGE_ROLES)
  create(@Body() dto: CreateContactDto, @CurrentUser() user: RequestUser) {
    return this.contactsService.create(dto, user.id, user);
  }

  @Get()
  @Roles(...CONTACT_VIEW_ROLES)
  findAll(@Query() pagination: PaginationDto, @CurrentUser() user: RequestUser) {
    return this.contactsService.findAll(pagination, user);
  }

  @Get(':id')
  @Roles(...CONTACT_VIEW_ROLES)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.contactsService.findById(id, user);
  }

  @Patch(':id')
  @Roles(...CONTACT_MANAGE_ROLES)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContactDto, @CurrentUser() user: RequestUser) {
    return this.contactsService.update(id, dto, user.id, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.SYSTEM_ADMINISTRATOR, RoleType.MD_CEO)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.contactsService.remove(id, user.id, user);
  }
}