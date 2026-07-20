import { WorkflowEntityType } from '@prisma/client';

export interface WorkflowEntityAdapter {
  supports(entityType: WorkflowEntityType): boolean;
  getCurrentState(entityId: string): Promise<string>;
  updateState(entityId: string, stateCode: string, tx?: any): Promise<void>;
  getVariables(entityId: string): Promise<Record<string, any>>;
}
