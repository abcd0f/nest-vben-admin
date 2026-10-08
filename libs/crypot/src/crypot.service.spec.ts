import { Test, TestingModule } from '@nestjs/testing';
import { CrypotService } from './crypot.service.js';

describe('crypotService', () => {
  let service: CrypotService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CrypotService],
    }).compile();

    service = module.get<CrypotService>(CrypotService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
