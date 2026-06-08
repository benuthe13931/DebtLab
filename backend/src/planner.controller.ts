import { Body, Controller, Delete, ForbiddenException, Get, Headers, Param, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PlannerService } from './planner.service';
import type { DebtRecord, PaymentRecord, PlannerSettings } from './planner.types';

@Controller('api/planner')
export class PlannerController {
  constructor(private readonly plannerService: PlannerService) {}

  @Get()
  getPlanner(@Headers('x-session-token') token?: string) {
    return this.plannerService.getPlanner(this.plannerService.requireUserIdBySession(token));
  }

  @Get('simulation')
  getSimulation(@Headers('x-session-token') token?: string) {
    return this.plannerService.getPlanner(this.plannerService.requireUserIdBySession(token)).simulation;
  }

  @Get('reconciliation')
  getReconciliation(@Headers('x-session-token') token?: string) {
    const planner = this.plannerService.getPlanner(this.plannerService.requireUserIdBySession(token));
    return {
      snapshots: planner.snapshots,
      reconciliation: planner.reconciliation,
    };
  }

  @Put('settings')
  updateSettings(@Headers('x-session-token') token: string | undefined, @Body() body: Partial<PlannerSettings>) {
    return this.plannerService.updateSettings(this.plannerService.requireUserIdBySession(token), body);
  }

  @Post('debts')
  createDebt(@Headers('x-session-token') token: string | undefined, @Body() body: Partial<DebtRecord>) {
    return this.plannerService.createDebt(this.plannerService.requireUserIdBySession(token), body);
  }

  @Post('reset')
  resetPlanner(@Headers('x-session-token') token?: string) {
    return this.plannerService.resetPlanner(this.plannerService.requireUserIdBySession(token));
  }

  @Post('reset-all-dev')
  resetAllDev() {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Development reset is disabled in production.');
    }

    return this.plannerService.resetAllDevelopmentData();
  }

  @Post('import-snapshots')
  importSnapshots(@Headers('x-session-token') token: string | undefined, @Body() body: { csvText?: string }) {
    return this.plannerService.importSnapshots(this.plannerService.requireUserIdBySession(token), body.csvText ?? '');
  }

  @Post('parse-statement')
  @UseInterceptors(FileInterceptor('file'))
  parseStatement(@Headers('x-session-token') token: string | undefined, @UploadedFile() file?: Express.Multer.File) {
    return this.plannerService.parseStatementFile(this.plannerService.requireUserIdBySession(token), file);
  }

  @Put('debts/:id')
  updateDebt(@Headers('x-session-token') token: string | undefined, @Param('id') id: string, @Body() body: Partial<DebtRecord>) {
    return this.plannerService.updateDebt(this.plannerService.requireUserIdBySession(token), id, body);
  }

  @Delete('debts/:id')
  deleteDebt(@Headers('x-session-token') token: string | undefined, @Param('id') id: string) {
    return this.plannerService.deleteDebt(this.plannerService.requireUserIdBySession(token), id);
  }

  @Post('payments/batch')
  createPayments(@Headers('x-session-token') token: string | undefined, @Body() body: { payments?: Array<Partial<PaymentRecord>> }) {
    return this.plannerService.createPayments(this.plannerService.requireUserIdBySession(token), body.payments ?? []);
  }

  @Put('payments/:id')
  updatePayment(@Headers('x-session-token') token: string | undefined, @Param('id') id: string, @Body() body: Partial<PaymentRecord>) {
    return this.plannerService.updatePayment(this.plannerService.requireUserIdBySession(token), id, body);
  }

  @Delete('payments/:id')
  deletePayment(@Headers('x-session-token') token: string | undefined, @Param('id') id: string) {
    return this.plannerService.deletePayment(this.plannerService.requireUserIdBySession(token), id);
  }
}
