import { Test, TestingModule } from '@nestjs/testing';
import { MeterialsService } from './meterials.service';

describe('MeterialsService', () => {
  let service: MeterialsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MeterialsService],
    }).compile();

    service = module.get<MeterialsService>(MeterialsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
