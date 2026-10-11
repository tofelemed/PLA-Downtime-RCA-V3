import { httpClient } from './httpClient';

export type UserRole =
  | 'SuperAdmin'
  | 'OrgAdmin'
  | 'TenantAdmin'
  | 'Manager'
  | 'Analyst'
  | 'Engineer'
  | 'Operator';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  tenantId?: string;
  organizationId?: string;
  phone?: string;
  department?: string;
  passwordHash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  organizationId?: string;
  tenantId?: string;
  isActive?: boolean;
  phone?: string;
  department?: string;
}

/** `GET /users/assignable`: id and name of the acting tenant's active users, readable by any member. */
export type AssignableUser = Pick<UserRecord, 'id' | 'name'>;

export const userApi = {
  getUsers(params?: { tenantId?: string; organizationId?: string; isActive?: boolean }) {
    return httpClient.request<UserRecord[]>('users', {
      method: 'GET',
      query: params,
    });
  },

  getAssignableUsers() {
    return httpClient.request<AssignableUser[]>('users/assignable', { method: 'GET' });
  },

  createUser(payload: CreateUserPayload) {
    // Filter out invalid UUIDs (undefined, null, empty strings)
    // Only include fields that are actually defined and valid
    const body: any = {
      name: payload.name,
      email: payload.email,
      password: payload.password,
      role: payload.role,
      isActive: payload.isActive ?? true,
    };
    
    // Only include organizationId/tenantId if they are valid UUIDs
    // SuperAdmin users might not have org/tenant, so these are truly optional
    if (payload.organizationId && typeof payload.organizationId === 'string' && payload.organizationId.trim()) {
      body.organizationId = payload.organizationId.trim();
    }
    if (payload.tenantId && typeof payload.tenantId === 'string' && payload.tenantId.trim()) {
      body.tenantId = payload.tenantId.trim();
    }
    
    // Include optional fields only if provided
    if (payload.phone && payload.phone.trim()) {
      body.phone = payload.phone.trim();
    }
    if (payload.department && payload.department.trim()) {
      body.department = payload.department.trim();
    }
    
    return httpClient.request<UserRecord>('users', {
      method: 'POST',
      body,
    });
  },

  updateUser(id: string, payload: Partial<UserRecord> & { password?: string }) {
    // Filter out undefined/null values and only include defined fields
    const body: any = {};
    
    if (payload.name !== undefined) body.name = payload.name;
    if (payload.email !== undefined) body.email = payload.email;
    if (payload.role !== undefined) body.role = payload.role;
    if (payload.isActive !== undefined) body.isActive = payload.isActive;
    if (payload.password !== undefined && payload.password.trim()) body.password = payload.password;
    
    // Only include UUIDs if they're valid (don't send empty strings or invalid UUIDs)
    if (payload.organizationId !== undefined && payload.organizationId && payload.organizationId.trim()) {
      body.organizationId = payload.organizationId;
    }
    if (payload.tenantId !== undefined && payload.tenantId && payload.tenantId.trim()) {
      body.tenantId = payload.tenantId;
    }
    
    if (payload.phone !== undefined) body.phone = payload.phone;
    if (payload.department !== undefined) body.department = payload.department;
    
    return httpClient.request<UserRecord>(`users/${id}`, {
      method: 'PUT',
      body,
    });
  },

  deleteUser(id: string) {
    return httpClient.request<void>(`users/${id}`, {
      method: 'DELETE',
    });
  },
};


