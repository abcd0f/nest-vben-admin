import { Test, TestingModule } from '@nestjs/testing';
import { SwaggerService } from './swagger.service.js';

describe('swaggerService', () => {
  let service: SwaggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SwaggerService],
    }).compile();

    service = module.get<SwaggerService>(SwaggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
