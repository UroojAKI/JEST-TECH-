import { Module } from '@nestjs/common';
import { NotificationsModule } from '../platform/notifications/notifications.module';

import { UserRepository } from './repositories/user.repository';
import { UsersController } from './controllers/users.controller';
import { UsersService } from './services/users.service';

@Module({
  imports: [NotificationsModule],
  controllers: [UsersController],
  providers: [UsersService, UserRepository],
  exports: [UsersService],
})
export class UsersModule {}
