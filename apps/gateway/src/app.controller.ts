import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  constructor() {}

  /** 连通性检查，返回固定欢迎语 */
  @Get()
  getHello(): string {
    return '欢迎使用 nest-admin-backend ！';
  }
}
