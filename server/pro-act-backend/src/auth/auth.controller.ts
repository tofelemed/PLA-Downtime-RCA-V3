import { Controller, Post, Body, Request, UseGuards, Get, UnauthorizedException, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ApiBody, ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { Public, PublicIf } from '../common/decorators/public.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'User login' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() body: LoginDto) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }
    return this.authService.login(user);
  }

  // Admin-only; public only while AUTH_ALLOW_PUBLIC_REGISTRATION=true (local dev / e2e).
  // The first SuperAdmin of an empty database comes from `npm run db:bootstrap-admin`.
  @PublicIf('AUTH_ALLOW_PUBLIC_REGISTRATION')
  @Roles('SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'manager_approver')
  @Post('register')
  @ApiOperation({ summary: 'Register new user (admin roles; a caller cannot grant a role above its own). Can auto-create organization and tenant if names are provided.' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async register(@Body() body: RegisterDto) {
    return this.authService.register({
      name: body.name,
      email: body.email,
      password: body.password,
      role: body.role,
      tenantId: body.tenantId && body.tenantId.trim() !== '' ? body.tenantId : undefined,
      organizationId: body.organizationId && body.organizationId.trim() !== '' ? body.organizationId : undefined,
      organizationName: body.organizationName,
      tenantName: body.tenantName,
      isActive: true,
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refreshToken(body.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Return user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async profile(@CurrentUser() user: any) {
    return {
      userId: user.userId,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      organizationId: user.organizationId
    };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Logout: revokes the refresh token family sent in the body; the client discards its tokens' })
  @ApiBody({ type: LogoutDto, required: false })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(@Body() body: LogoutDto) {
    await this.authService.logout(body?.refreshToken);
    return { message: 'Logout successful. Please discard your token.' };
  }

  @Public()
  @Post('validate-token')
  @HttpCode(200)
  @ApiOperation({ summary: 'Validate token' })
  @ApiResponse({ status: 200, description: 'Token is valid' })
  @ApiResponse({ status: 401, description: 'Token is invalid' })
  async validateToken(@Body() body: { token: string }) {
    const payload = await this.authService.validateToken(body.token);
    return { valid: true, payload };
  }
} 