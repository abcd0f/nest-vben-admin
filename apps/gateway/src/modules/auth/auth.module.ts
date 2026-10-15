import { AuthModule as AuthLibraryModule } from '@app/auth';
import { Module } from '@nestjs/common';
import { UserModule } from '../system/user/user.module.js';
import { AuthController } from './auth.controller.js';

@Module({
  imports: [AuthLibraryModule, UserModule],
  controllers: [AuthController],
})
export class GatewayAuthModule {}
