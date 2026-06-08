import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { PlannerController } from './planner.controller';
import { PlannerService } from './planner.service';

@Module({
  imports: [],
  controllers: [AuthController, PlannerController],
  providers: [PlannerService],
})
export class AppModule {}
