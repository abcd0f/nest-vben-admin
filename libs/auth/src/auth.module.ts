import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
