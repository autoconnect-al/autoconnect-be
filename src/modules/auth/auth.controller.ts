import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { Throttle } from '@nestjs/throttler';
import { ConfirmPasswordResetDto } from './dto/confirm-reset.dto';
import { RequestPasswordResetDto } from './dto/request-reset.dto';

@Controller({
  path: 'auth',
  version: '1',
})
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({
    options: {
      limit: 5,
      ttl: 60,
    },
  })
  @ApiOperation({
    summary: 'User login',
    description:
      'Authenticate user with identifier and password. Returns JWT token.',
  })
  @ApiOkResponse({
    description: 'Login successful. Returns JWT token and user information.',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: '123',
          email: 'user@example.com',
          name: 'John Doe',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid credentials or validation error',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid username or password',
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.identifier, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Change password',
    description: 'Change the password of the authenticated user',
  })
  @ApiOkResponse({
    description: 'Password changed successfully',
    schema: {
      example: { message: 'Password changed successfully' },
    },
  })
  @ApiBadRequestResponse({
    description: 'Current password is incorrect or validation error',
  })
  @ApiUnauthorizedResponse({
    description: 'User not authenticated',
  })
  changePassword(@Req() req, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(
      BigInt(req.user.userId),
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Post('password-reset/request')
  @ApiOperation({
    summary: 'Request password reset',
    description:
      'Request a password reset token to be sent to the user email address',
  })
  @ApiOkResponse({
    description: 'Password reset email sent successfully',
    schema: {
      example: { message: 'Password reset email sent to your email address' },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid email or validation error',
  })
  requestReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('password-reset/confirm')
  @ApiOperation({
    summary: 'Confirm password reset',
    description: 'Reset password using the token sent to email',
  })
  @ApiOkResponse({
    description: 'Password reset successful',
    schema: {
      example: { message: 'Password reset successful' },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid or expired token',
  })
  confirmReset(@Body() dto: ConfirmPasswordResetDto) {
    return this.authService.confirmPasswordReset(dto.token, dto.newPassword);
  }
}
