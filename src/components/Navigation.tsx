import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  BarChart3, 
  Users, 
  Settings, 
  AlertTriangle, 
  FileText, 
  Database,
  Activity,
  Shield,
  Code,
  UserCog,
  Lock,
  Calendar,
  CheckSquare,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

// Custom scrollbar styles
const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(239, 246, 255, 0.5);
    border-radius: 10px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: linear-gradient(to bottom, #8b5cf6, #ec4899);
    border-radius: 10px;
    transition: all 0.2s ease;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(to bottom, #7c3aed, #db2777);
  }
  
  .custom-scrollbar {
    scrollbar-width: thin;
    // scrollbar-color: #8b5cf6 rgba(239, 246, 255, 0.5);
    scrollbar-color: #ced0d7 rgba(239, 246, 255, 0.5);
  }
`;

// Add a description for each navigation item (optional, for tooltip)
const navigationItems = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: BarChart3,
    roles: ['SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'Analyst', 'Engineer', 'Operator'],
    description: 'View analytics and quick stats',
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: BarChart3,
    roles: ['SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'Analyst', 'Engineer'],
    description: 'OEE, loss, RCA, audit, and task reports',
  },
  {
    name: 'Production Loss Analysis',
    href: '/pla-analytics',
    icon: BarChart3,
    roles: ['SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'Analyst', 'Engineer', 'Operator'],
    description: 'Deep-dive production loss analytics',
  },
  {
    name: 'Production Plans',
    href: '/production-plans',
    icon: Calendar,
    roles: ['SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'Analyst', 'Engineer'],
    description: 'Manage and review production plans',
  },
  {
    name: 'Event Hub',
    href: '/events',
    icon: AlertTriangle,
    roles: ['SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'Analyst', 'Engineer', 'Operator'],
    description: 'Monitor and analyze events',
  },
  {
    name: 'RCA Analysis',
    href: '/rca',
    icon: FileText,
    roles: ['SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'Analyst', 'Engineer'],
    description: 'Root Cause Analysis investigations',
  },
  {
    name: 'Knowledge Base',
    href: '/rca-knowledge-base',
    icon: Database,
    roles: ['SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'Analyst', 'Engineer'],
    description: 'Closed RCAs & lessons learned',
  },
  {
    name: 'Master Data',
    href: '/master-data',
    icon: Code,
    roles: ['SuperAdmin', 'OrgAdmin', 'TenantAdmin'],
    description: 'Configure master data',
  },
  {
    name: 'User Management',
    href: '/users',
    icon: Users,
    roles: ['SuperAdmin', 'OrgAdmin', 'TenantAdmin'],
    description: 'Manage users and access',
  },
  {
    name: 'Admin Panel',
    href: '/admin',
    icon: UserCog,
    roles: ['SuperAdmin'],
    description: 'Admin tools and settings',
  },
  {
    name: 'Permissions',
    href: '/permissions',
    icon: Lock,
    roles: ['SuperAdmin', 'OrgAdmin', 'TenantAdmin'],
    description: 'Set permissions and roles',
  },
  {
    name: 'Connectivity',
    href: '/connectivity',
    icon: Activity,
    roles: ['SuperAdmin', 'OrgAdmin', 'TenantAdmin'],
    description: 'System connectivity status',
  },
  {
    name: 'Enhanced Historian',
    href: '/enhanced-historian',
    icon: Database,
    roles: ['SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'Analyst', 'Engineer'],
    description: 'Multi-attribute time series analysis',
  },
  {
    name: 'Tasks',
    href: '/tasks',
    icon: CheckSquare,
    roles: ['SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'Analyst', 'Engineer', 'Operator'],
    description: 'Assign and track action items',
  },
  {
    name: 'Audit Logs',
    href: '/audit',
    icon: Shield,
    roles: ['SuperAdmin', 'OrgAdmin'],
    description: 'View audit logs',
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['SuperAdmin', 'OrgAdmin', 'TenantAdmin'],
    description: 'System settings',
  },
  // legacy demo seeding: development builds only (plan 3.1 step 7, decision A4)
  ...(import.meta.env.DEV
    ? [
        {
          name: 'Data Seeding',
          href: '/data-seeding',
          icon: Database,
          roles: ['SuperAdmin', 'OrgAdmin', 'TenantAdmin'],
          description: 'Manage test data for PLA and RCA',
        },
      ]
    : []),
];

// Add prop types for collapsed and setCollapsed
interface NavigationProps {
  collapsed: boolean;
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

export const Navigation: React.FC<NavigationProps> = ({ collapsed, setCollapsed }) => {
  const { session } = useAuth();
  const location = useLocation();

  const allowedItems = navigationItems.filter(item => 
    session && item.roles.includes(session.user.role)
  );

  return (
    <nav className={`h-full transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'} bg-gradient-to-b from-white via-blue-50 to-pink-50 border-r border-blue-200 min-h-0 flex flex-col shadow-xl backdrop-blur-sm`}>
      {/* Inject custom scrollbar styles */}
      <style>{scrollbarStyles}</style>
      
      {/* Enhanced Collapse/Expand Button */}
      <div className="flex items-center justify-end p-3 border-b border-blue-100">
        <button
          className="p-2 rounded-xl bg-gradient-to-r from-slate-100 to-gray-200 text-gray-600 hover:from-slate-200 hover:to-gray-300 hover:text-gray-800 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 border border-gray-200"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
      
      <div className="p-3 flex-1 overflow-y-auto custom-scrollbar">
        <TooltipProvider delayDuration={0}>
          <ul className="space-y-2">
            {allowedItems.map((item) => {
              const isActive = location.pathname.startsWith(item.href);
              const navItem = (
                <NavLink
                  to={item.href}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg transform scale-105 border border-indigo-200'
                      : 'text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-pink-50 hover:text-blue-700 hover:shadow-md transform hover:scale-102'
                  } ${collapsed ? 'justify-center px-3 w-12 h-12 mx-auto' : ''}`}
                >
                  <item.icon className={`${collapsed ? 'w-7 h-7 text-gray-700' : 'w-5 h-5'} ${isActive ? 'text-white' : 'text-gray-600'}`} />
                  {!collapsed && <span>{item.name}</span>}
                </NavLink>
              );
              return (
                <li key={item.name}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{navItem}</TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs bg-white border border-blue-200 shadow-xl rounded-xl">
                        <div className="font-semibold text-gray-800">{item.name}</div>
                        {item.description && <div className="text-xs text-gray-500 mt-1">{item.description}</div>}
                      </TooltipContent>
                    </Tooltip>
                  ) : navItem}
                </li>
              );
            })}
          </ul>
        </TooltipProvider>
      </div>
      
      {/* Enhanced Footer Section */}
      <div className="p-3 border-t border-blue-100">
        <div className={`bg-gradient-to-r from-blue-50 to-pink-50 rounded-xl p-3 border border-blue-200 ${collapsed ? 'text-center' : ''}`}>
          {!collapsed && (
            <div className="text-xs text-gray-600 mb-2 font-medium">Quick Stats</div>
          )}
          <div className="flex items-center justify-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
            {!collapsed && <span className="text-xs text-gray-600">System Online</span>}
          </div>
        </div>
      </div>
    </nav>
  );
};
