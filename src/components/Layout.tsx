import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigation } from './Navigation';
import PlantSelector from './PlantSelector';
import { Button } from '@/components/ui/button';
import { LogOut, User, Bell, Settings, Search } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { session, logout } = useAuth();
  const [plantSelection, setPlantSelection] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  if (!session) {
    return <div>{children}</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-pink-50">
      {/* Enhanced Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-30 bg-gradient-to-r from-white via-blue-50 to-pink-50 border-b border-blue-200 shadow-xl h-20 flex items-center backdrop-blur-sm">
        <div className="px-6 py-4 w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              {/* Enhanced Logo Section */}
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-sm">PA</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-blue-800 to-pink-600 bg-clip-text text-transparent">
                    Pro-Act
                  </h1>
                  <p className="text-xs text-gray-600 font-medium">Production Loss Analysis</p>
                </div>
              </div>
              
              {/* Enhanced Plant Selector */}
              <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-blue-200 shadow-sm">
                <PlantSelector />
              </div>
            </div>
            
            {/* Enhanced Right Section */}
            <div className="flex items-center space-x-4">
              {/* Search Bar */}
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="pl-10 pr-4 py-2 bg-white/80 backdrop-blur-sm border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent w-64"
                />
              </div>
              
              {/* Notifications */}
              <Button 
                variant="ghost" 
                size="sm" 
                className="relative p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
              </Button>
              
              {/* Settings */}
              <Button 
                variant="ghost" 
                size="sm" 
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200"
              >
                <Settings className="w-5 h-5" />
              </Button>
              
              {/* Enhanced User Profile */}
              <div className="flex items-center space-x-3 bg-white/80 backdrop-blur-sm rounded-xl border border-blue-200 px-4 py-2 shadow-sm">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-pink-400 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="hidden md:block">
                  <div className="text-sm font-semibold text-gray-800">{session.user.name}</div>
                  <div className="text-xs text-gray-500">{session.user.role}</div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={logout}
                  className="text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex pt-20 h-screen overflow-hidden">
        {/* Enhanced Fixed Sidebar */}
        <aside className={`fixed top-20 left-0 bottom-0 z-20 ${sidebarCollapsed ? 'w-20' : 'w-64'} bg-gradient-to-b from-white via-blue-50 to-pink-50 border-r border-blue-200 min-h-0 h-[calc(100vh-5rem)] shadow-xl backdrop-blur-sm`}>
          <Navigation collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
        </aside>
        {/* Enhanced Main Content */}
        <main className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'ml-20' : 'ml-64'} h-[calc(100vh-5rem)] overflow-y-auto p-6 bg-gradient-to-br from-gray-50 via-blue-50 to-pink-50`}>
          {children}
        </main>
      </div>
    </div>
  );
};
