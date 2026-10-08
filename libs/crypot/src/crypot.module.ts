import { Module } from '@nestjs/common';
import { CrypotService } from './crypot.service.js';

@Module({
  providers: [CrypotService],
  exports: [CrypotService],
})
export class CrypotModule {}
