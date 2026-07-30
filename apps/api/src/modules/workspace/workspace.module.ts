import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { WorkspaceController } from './controllers/workspace.controller';
import { WorkspaceService } from './services/workspace.service';
import { WorkspaceFactory } from './factories/workspace.factory';

@Module({
  imports: [DatabaseModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, WorkspaceFactory],
  exports: [WorkspaceService, WorkspaceFactory],
})
export class WorkspaceModule {}
