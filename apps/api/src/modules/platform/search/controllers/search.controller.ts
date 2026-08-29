import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiQuery,
  ApiOperation,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { RoleType } from '@prisma/client';
import { SearchService, SearchResult } from '../services/search.service';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  RoleType.SUPER_ADMIN,
  RoleType.ADMIN,
  RoleType.BRANCH_MANAGER,
  RoleType.TEAM_LEADER,
  RoleType.SALES_AGENT,
  RoleType.OPERATIONS,
  RoleType.UNDERWRITER,
  RoleType.CLAIMS_OFFICER,
  RoleType.FINANCE,
  RoleType.SUPPORT,
)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary:
      'Global Search across Customers, Policies, Vehicles, Leads, and Quotes',
  })
  @ApiQuery({ name: 'q', required: true, type: String })
  search(@Query('q') query: string): Promise<SearchResult> {
    return this.searchService.search(query);
  }
}
