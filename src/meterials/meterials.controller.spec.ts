import { Test, TestingModule } from '@nestjs/testing';
import { MeterialsController } from './meterials.controller';

describe('MeterialsController', () => {
  let controller: MeterialsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeterialsController],
    }).compile();

    controller = module.get<MeterialsController>(MeterialsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
