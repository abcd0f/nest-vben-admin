import { AuthOnly, AuthService, CurrentUser, Public } from '@app/auth';
import { Body, Controller, Get, Post } from '@nestjs/common';
import { UserService } from '../system/user/user.service.js';
import { ChangePasswordDto, LoginDto } from './auth.dto.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UserService,
  ) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.username, dto.password);
  }

  @AuthOnly()
  @Get('me')
  async me(@CurrentUser() current: { userId: bigint }) {
    const user = await this.auth.assertActiveUser(current.userId);
    const { password: _password, deletedAt: _deletedAt, ...safe } = user;
    return { ...safe, userId: safe.userId.toString(), deptId: safe.deptId?.toString() ?? null };
  }

  @AuthOnly()
  @Post('logout')
  logout() {}

  @AuthOnly()
  @Post('password')
  changePassword(@CurrentUser() current: { userId: bigint }, @Body() dto: ChangePasswordDto) {
    return this.users.changeOwnPassword(current.userId, dto);
  }
}
