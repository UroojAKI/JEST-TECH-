import { Injectable } from '@nestjs/common';
import { WorkflowEntityType } from '@prisma/client';
import { WorkflowEntityAdapter } from '../interfaces/workflow-entity-adapter.interface';

@Injectable()
export class WorkflowAdapterRegistry {
  private readonly adapters = new Map<
    WorkflowEntityType,
    WorkflowEntityAdapter
  >();

  register(entityType: WorkflowEntityType, adapter: WorkflowEntityAdapter) {
    this.adapters.set(entityType, adapter);
  }

  getAdapter(
    entityType: WorkflowEntityType,
  ): WorkflowEntityAdapter | undefined {
    return this.adapters.get(entityType);
  }
}
