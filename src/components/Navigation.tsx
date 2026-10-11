import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useFlag } from '@/api/v2/queries/feature-flags';
import type { FeatureFlagKey } from '@/api/v2/types/flags';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { visibleNavigationItems, type NavigationItem } from '@/features/auth/navigation-items';

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
    scrollbar-color: #ced0d7 rgba(239, 246, 255, 0.5);
  }
`;

// Add prop types for collapsed and setCollapsed
interface NavigationProps {
  collapsed: boolean;
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

/** The sidebar: items by capability in the selected plant (features/auth), v2 screens behind their flags. */
export const Navigation: React.FC<NavigationProps> = ({ collapsed, setCollapsed }) => {
  const capabilities = useCapabilities();
  const location = useLocation();

  const flagsOn: Partial<Record<FeatureFlagKey, boolean>> = {
    'v2.downtimeAnalysis': useFlag('v2.downtimeAnalysis').enabled,
    'v2.plansProfilesCalendars': useFlag('v2.plansProfilesCalendars').enabled,
    'v2.codesAdmin': useFlag('v2.codesAdmin').enabled,
  };
  const allowedItems = visibleNavigationItems(capabilities, flagsOn);

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
            {allowedItems.map((item) => (
              <li key={item.name}>
                <NavigationEntry item={item} collapsed={collapsed} active={location.pathname.startsWith(item.href)} />
              </li>
            ))}
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

interface NavigationEntryProps {
  item: NavigationItem;
  collapsed: boolean;
  active: boolean;
}

const NavigationEntry: React.FC<NavigationEntryProps> = ({ item, collapsed, active }) => {
  const navItem = (
    <NavLink
      to={item.href}
      className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
        active
          ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg transform scale-105 border border-indigo-200'
          : 'text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-pink-50 hover:text-blue-700 hover:shadow-md transform hover:scale-102'
      } ${collapsed ? 'justify-center px-3 w-12 h-12 mx-auto' : ''}`}
    >
      <item.icon className={`${collapsed ? 'w-7 h-7 text-gray-700' : 'w-5 h-5'} ${active ? 'text-white' : 'text-gray-600'}`} />
      {!collapsed && <span>{item.name}</span>}
    </NavLink>
  );
  if (!collapsed) return navItem;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{navItem}</TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs bg-white border border-blue-200 shadow-xl rounded-xl">
        <div className="font-semibold text-gray-800">{item.name}</div>
        {item.description && <div className="text-xs text-gray-500 mt-1">{item.description}</div>}
      </TooltipContent>
    </Tooltip>
  );
};
