import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Organization, Tenant, storageService } from '../services/StorageService';

interface AuthSession {
  user: User;
  organization: Organization | null;
  tenant: Tenant | null;
  token: string;
}

interface AuthContextType {
  session: AuthSession | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  selectTenant: (tenantId: string) => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await storageService.initialize();
        
        // Create demo data if not exists
        await createDemoData();
        
        // Check for existing session
        const savedSession = localStorage.getItem('proact_session');
        if (savedSession) {
          const sessionData = JSON.parse(savedSession);
          setSession(sessionData);
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const createDemoData = async () => {
    // Check if demo data already exists
    const existingUsers = await storageService.query<User>('users');
    if (existingUsers.length > 0) return;

    // Create demo organization
    const org = await storageService.create<Organization>('organizations', {
      name: 'Acme Manufacturing',
      code: 'ACME',
      description: 'Main manufacturing organization',
    });

    // Create demo tenant (plant)
    const tenant = await storageService.create<Tenant>('tenants', {
      name: 'Plant Alpha',
      code: 'PA01',
      organizationId: org.id,
      description: 'Primary production facility',
    });

    // Create demo users
    const users = [
      {
        name: 'Admin User',
        email: 'admin@acme.com',
        passwordHash: 'demo123',
        role: 'SuperAdmin' as const,
        organizationId: org.id,
        tenantId: tenant.id,
        isActive: true,
      },
      {
        name: 'Plant Manager',
        email: 'manager@acme.com',
        passwordHash: 'demo123',
        role: 'TenantAdmin' as const,
        organizationId: org.id,
        tenantId: tenant.id,
        isActive: true,
      },
      {
        name: 'Process Engineer',
        email: 'engineer@acme.com',
        passwordHash: 'demo123',
        role: 'Engineer' as const,
        organizationId: org.id,
        tenantId: tenant.id,
        isActive: true,
      },
      {
        name: 'Line Operator',
        email: 'operator@acme.com',
        passwordHash: 'demo123',
        role: 'Operator' as const,
        organizationId: org.id,
        tenantId: tenant.id,
        isActive: true,
      },
    ];

    for (const userData of users) {
      await storageService.create<User>('users', userData);
    }

    // Create demo production units
    const units = [
      {
        name: 'Production Line A',
        code: 'PLA',
        description: 'Main production line for Product A',
        capacity: 1000,
        unitOfMeasure: 'units/day',
        tenantId: tenant.id,
      },
      {
        name: 'Production Line B',
        code: 'PLB',
        description: 'Secondary production line for Product B',
        capacity: 800,
        unitOfMeasure: 'units/day',
        tenantId: tenant.id,
      },
    ];

    const createdUnits = [];
    for (const unitData of units) {
      const createdUnit = await storageService.create('units', unitData);
      createdUnits.push(createdUnit);
    }

    // Create demo products
    const products = [
      {
        name: 'Product Alpha',
        code: 'PA001',
        unitOfMeasure: 'units',
        description: 'High-quality product Alpha',
        standardCost: 25.50,
        organizationId: org.id,
      },
      {
        name: 'Product Beta',
        code: 'PB002',
        unitOfMeasure: 'units',
        description: 'Premium product Beta',
        standardCost: 45.75,
        organizationId: org.id,
      },
    ];

    const createdProducts = [];
    for (const productData of products) {
      const createdProduct = await storageService.create('products', productData);
      createdProducts.push(createdProduct);
    }

    // Create demo production plan templates
    const templates = [
      {
        name: 'Standard 8-Hour Shift Template',
        unitId: createdUnits[0].id,
        productIds: [createdProducts[0].id],
        planBasis: 'Time-based',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        recurrence: 'Daily',
        dataEntryFrequency: 'Hourly',
        usefulProductionTime: {
          'Monday': { start: '08:00', end: '16:00' },
          'Tuesday': { start: '08:00', end: '16:00' },
          'Wednesday': { start: '08:00', end: '16:00' },
          'Thursday': { start: '08:00', end: '16:00' },
          'Friday': { start: '08:00', end: '16:00' },
        },
        tenantId: tenant.id,
        orgId: org.id,
        version: 1,
      },
      {
        name: '24/7 Continuous Production Template',
        unitId: createdUnits[1].id,
        productIds: [createdProducts[1].id],
        planBasis: 'Quantity-based',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        recurrence: 'Daily',
        dataEntryFrequency: 'Daily',
        usefulProductionTime: {
          'Monday': { start: '00:00', end: '23:59' },
          'Tuesday': { start: '00:00', end: '23:59' },
          'Wednesday': { start: '00:00', end: '23:59' },
          'Thursday': { start: '00:00', end: '23:59' },
          'Friday': { start: '00:00', end: '23:59' },
          'Saturday': { start: '00:00', end: '23:59' },
          'Sunday': { start: '00:00', end: '23:59' },
        },
        tenantId: tenant.id,
        orgId: org.id,
        version: 1,
      },
    ];

    for (const templateData of templates) {
      await storageService.create('productionPlanTemplates', templateData);
    }

    // Create demo production plans from templates
    const plans = [
      {
        name: 'Q1 Production Plan - Product Alpha',
        unitId: createdUnits[0].id,
        productId: createdProducts[0].id,
        plannedQuantity: 6400, // 8 hours * 5 days * 16 weeks * 10 units/hour
        toleranceLimit: 5,
        startDate: '2024-01-01',
        endDate: '2024-03-31',
        planBasis: 'Time-based',
        recurrence: 'Daily',
        dataEntryFrequency: 'Hourly',
        usefulProductionTime: {
          'Monday': { start: '08:00', end: '16:00' },
          'Tuesday': { start: '08:00', end: '16:00' },
          'Wednesday': { start: '08:00', end: '16:00' },
          'Thursday': { start: '08:00', end: '16:00' },
          'Friday': { start: '08:00', end: '16:00' },
        },
        status: 'Active',
        tenantId: tenant.id,
      },
      {
        name: 'Q2 Production Plan - Product Beta',
        unitId: createdUnits[1].id,
        productId: createdProducts[1].id,
        plannedQuantity: 51840, // 24 hours * 7 days * 12 weeks * 25 units/hour
        toleranceLimit: 3,
        startDate: '2024-04-01',
        endDate: '2024-06-30',
        planBasis: 'Quantity-based',
        recurrence: 'Daily',
        dataEntryFrequency: 'Daily',
        usefulProductionTime: {
          'Monday': { start: '00:00', end: '23:59' },
          'Tuesday': { start: '00:00', end: '23:59' },
          'Wednesday': { start: '00:00', end: '23:59' },
          'Thursday': { start: '00:00', end: '23:59' },
          'Friday': { start: '00:00', end: '23:59' },
          'Saturday': { start: '00:00', end: '23:59' },
          'Sunday': { start: '00:00', end: '23:59' },
        },
        status: 'Planned',
        tenantId: tenant.id,
      },
    ];

    for (const planData of plans) {
      await storageService.create('productionPlans', planData);
    }

    console.log('Demo data created successfully');
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const users = await storageService.query<User>('users');
      const user = users.find(u => u.email === email && u.passwordHash === password && u.isActive);
      
      if (!user) return false;

      const organization = user.organizationId ? 
        await storageService.get<Organization>('organizations', user.organizationId) : null;
      
      const tenant = user.tenantId ? 
        await storageService.get<Tenant>('tenants', user.tenantId) : null;

      const newSession: AuthSession = {
        user,
        organization,
        tenant,
        token: `demo_token_${user.id}`,
      };

      setSession(newSession);
      localStorage.setItem('proact_session', JSON.stringify(newSession));

      // Log successful login
      await storageService.logAudit(user.id, 'LOGIN', 'USER', user.id, { email });

      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const logout = () => {
    if (session) {
      storageService.logAudit(session.user.id, 'LOGOUT', 'USER', session.user.id, {});
    }
    setSession(null);
    localStorage.removeItem('proact_session');
  };

  const selectTenant = async (tenantId: string) => {
    if (!session) return;

    const tenant = await storageService.get<Tenant>('tenants', tenantId);
    if (!tenant) return;

    const updatedSession = {
      ...session,
      tenant,
    };

    setSession(updatedSession);
    localStorage.setItem('proact_session', JSON.stringify(updatedSession));
  };

  return (
    <AuthContext.Provider value={{
      session,
      login,
      logout,
      selectTenant,
      isLoading,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
