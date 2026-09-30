import { Module } from '@nestjs/common';
import { WebsocketService } from './websocket.service.js';

@Module({
  providers: [WebsocketService],
  exports: [WebsocketService],
})
export class WebsocketModule {}
