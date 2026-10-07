import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { OrganizationService } from '../organization/organization.service';
import { TenantService } from '../tenant/tenant.service';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private organizationService: OrganizationService,
    private tenantService: TenantService,
  ) {}

  async validateUser(email: string, pass: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (user && await bcrypt.compare(pass, user.passwordHash)) {
      return user;
    }
    return null;
  }

  async login(user: User) {
    const payload = { 
      sub: user.id, 
      email: user.email, 
      role: user.role,
      tenantId: user.tenantId,
      organizationId: user.organizationId
    };
    
    // Log JWT_SECRET status when signing (don't log the actual secret)
    const jwtSecretLength = process.env.JWT_SECRET?.length || 0;
    console.log(`[AuthService] Signing token with JWT_SECRET length: ${jwtSecretLength}`);
    
    const access_token = this.jwtService.sign(payload, { expiresIn: '24h' });
    const refresh_token = this.jwtService.sign({ sub: user.id }, { expiresIn: '7d' });
    
    console.log(`[AuthService] Token signed successfully for user: ${user.email}`);
    console.log(`[AuthService] Token preview: ${access_token.substring(0, 30)}...`);
    
    return {
      access_token,
      refresh_token,
      expires_in: 86400, // 24 hours in seconds
      token_type: 'Bearer',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        tenantId: user.tenantId,
        organizationId: user.organizationId,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.usersService.findOne(payload.sub);
      
      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      
      return this.login(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      return payload;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async register(data: Partial<User> & { 
    password: string;
    organizationName?: string;
    tenantName?: string;
  }) {
    if (!data.email || !data.password || !data.name || !data.role) {
      throw new BadRequestException('Missing required fields');
    }
    const existing = await this.usersService.findByEmail(data.email);
    if (existing) throw new ConflictException('Email already in use');

    let organizationId = data.organizationId;
    let tenantId = data.tenantId;

    // Auto-create organization if name is provided but ID is not
    if (!organizationId && data.organizationName) {
      const orgCode = data.organizationName.toLowerCase().replace(/\s+/g, '-').substring(0, 50);
      // Check if organization with this code already exists
      const existingOrg = await this.organizationService.findByCode(orgCode);
      if (existingOrg) {
        organizationId = existingOrg.id;
      } else {
        const newOrg = await this.organizationService.create({
          name: data.organizationName,
          code: orgCode,
          // isActive column doesn't exist in database schema
          // isActive: true,
        });
        organizationId = newOrg.id;
      }
    }

    // Auto-create tenant if name is provided but ID is not
    // Tenant requires organizationId
    if (!tenantId && data.tenantName) {
      if (!organizationId) {
        throw new BadRequestException('Organization ID or name is required to create a tenant');
      }
      const tenantCode = data.tenantName.toLowerCase().replace(/\s+/g, '-').substring(0, 50);
      // Check if tenant with this code already exists in this organization
      const existingTenant = await this.tenantService.findByCodeAndOrganization(tenantCode, organizationId);
      if (existingTenant) {
        tenantId = existingTenant.id;
      } else {
        const newTenant = await this.tenantService.create({
          name: data.tenantName,
          code: tenantCode,
          organizationId: organizationId!,
          // isActive column doesn't exist in database schema
          // isActive: true,
        });
        tenantId = newTenant.id;
      }
    }

    // For SuperAdmin role, allow registration without org/tenant
    // For other roles, require at least organization
    if (data.role !== 'SuperAdmin' && !organizationId) {
      throw new BadRequestException('Organization ID or name is required for non-SuperAdmin users');
    }

    const user = await this.usersService.create({ 
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role,
      tenantId: tenantId,
      organizationId: organizationId,
      // phone and department columns don't exist in database schema
      // phone: data.phone,
      // department: data.department,
      isActive: data.isActive,
    });
    return this.login(user);
  }
} 