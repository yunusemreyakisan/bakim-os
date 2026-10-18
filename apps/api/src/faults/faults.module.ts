import { Module } from '@nestjs/common';
import { FaultsController } from './faults.controller';
import { FaultsService } from './faults.service';

@Module({
  controllers: [FaultsController],
  providers: [FaultsService],
})
export class FaultsModule {}
