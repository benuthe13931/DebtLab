import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { PlannerService } from './planner.service';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly plannerService: PlannerService) {}

  @Post('register')
  register(@Body() body: { email?: string; password?: string; displayName?: string }) {
    return this.plannerService.registerUser(body);
  }

  @Post('login')
  login(@Body() body: { email?: string; password?: string }) {
    return this.plannerService.loginUser(body);
  }

  @Get('session')
  session(@Headers('x-session-token') token?: string) {
    return this.plannerService.getSession(token ?? '');
  }

  @Post('logout')
  logout(@Headers('x-session-token') token?: string) {
    return this.plannerService.logoutSession(token ?? '');
  }
}
