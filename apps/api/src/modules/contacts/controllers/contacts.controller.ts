import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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

@ApiTags('Contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
  )
  create(@Body() dto: CreateContactDto, @CurrentUser() user: RequestUser) {
    return this.contactsService.create(dto, user.id);
  }

  @Get()
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
    RoleType.OPERATIONS,
  )
  findAll(@Query() pagination: PaginationDto) {
    return this.contactsService.findAll(pagination);
  }

  @Get(':id')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
    RoleType.OPERATIONS,
  )
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.contactsService.findById(id);
  }

  @Patch(':id')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
  )
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.contactsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.contactsService.remove(id, user.id);
  }
}
