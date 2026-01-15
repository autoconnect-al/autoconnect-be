import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { Throttle } from '@nestjs/throttler';

@Controller({
  path: 'auth',
  version: '1',
})
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle(5, 60)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.identifier, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(@Req() req, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(
      BigInt(req.user.userId),
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Post('password-reset/request')
  requestReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('password-reset/confirm')
  confirmReset(@Body() dto: ConfirmPasswordResetDto) {
    return this.authService.confirmPasswordReset(
      dto.token,
      dto.newPassword,
    );
  }

}
