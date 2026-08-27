import { SetMetadata } from '@nestjs/common';

export type WorkspaceCode =
  | 'SALES'
  | 'FINANCE'
  | 'BACK_OFFICE'
  | 'RENEWALS'
  | 'CLAIMS'
  | 'MANAGEMENT'
  | 'ADMINISTRATION'
  | 'PORTAL';

export const WORKSPACE_KEY = 'required_workspace';

/**
 * Decorator to require authorization for a specific operational workspace.
 *
 * Usage:
 *   @RequireWorkspace('SALES')
 *   @Get('sales-data')
 */
export const RequireWorkspace = (workspace: WorkspaceCode) =>
  SetMetadata(WORKSPACE_KEY, workspace);
