import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { Navigation } from './Navigation';
import PlantSelector from './PlantSelector';
import { DisplayCurrencyToggle } from '@/features/display-currency/display-currency-toggle';
import { Button } from '@/components/ui/button';
import { LogOut, User, Bell, Settings, Search } from 'lucide-react';
import { brandingService, BrandingSettings } from '@/services/BrandingService';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { session, logout, isLoading: authLoading } = useAuth();
  const { isReadOnly } = useCapabilities();
  const [plantSelection, setPlantSelection] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [branding, setBranding] = useState<BrandingSettings | null>(null);

  // Load branding settings - wait for authentication
  useEffect(() => {
    if (authLoading || !session) {
      return;
    }
    
    const loadBranding = async () => {
      try {
        const settings = await brandingService.getBranding();
        setBranding(settings);
        // Apply branding to document
        brandingService.applyBrandingToDocument(settings);
      } catch (error) {
        console.error('Failed to load branding:', error);
      }
    };

    loadBranding();

    // Listen for branding updates
    const handleBrandingUpdate = () => {
      loadBranding();
    };

    window.addEventListener('brandingUpdated', handleBrandingUpdate);

    return () => {
      window.removeEventListener('brandingUpdated', handleBrandingUpdate);
    };
  }, []);

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
                <div 
                  className="flex items-center justify-center shadow-lg"
                  style={{
                    width: `${branding?.logoContainerSize || 40}px`,
                    height: `${branding?.logoContainerSize || 40}px`,
                    borderRadius: `${branding?.logoContainerRadius || 12}px`,
                    padding: `${branding?.logoContainerPadding || 0}px`,
                    background: branding 
                      ? `linear-gradient(to bottom right, ${branding.primaryColor || '#2563eb'}, ${branding.secondaryColor || '#ec4899'})`
                      : 'linear-gradient(to bottom right, #2563eb, #ec4899)',
                    opacity: branding?.logoBackgroundOpacity ?? 1,
                  }}
                >
                  {branding?.logoUrl ? (
                    <img 
                      src={branding.logoUrl} 
                      alt="Logo" 
                      style={{
                        width: `${branding?.logoSize || 32}px`,
                        height: `${branding?.logoSize || 32}px`,
                        objectFit: branding?.logoObjectFit || 'contain',
                        borderRadius: `${branding?.logoBorderRadius || 4}px`,
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const initials = (e.target as HTMLImageElement).nextElementSibling;
                        if (initials) {
                          (initials as HTMLElement).style.display = 'block';
                        }
                      }}
                    />
                  ) : null}
                  <span 
                    className="text-white font-bold"
                    style={{ 
                      display: branding?.logoUrl ? 'none' : 'block',
                      fontSize: `${(branding?.logoSize || 32) / 2.5}px`
                    }}
                  >
                    {branding?.logoInitials || 'UA'}
                  </span>
                </div>
                <div>
                  <h1 
                    className="text-xl font-bold bg-clip-text text-transparent"
                    style={{
                      backgroundImage: branding
                        ? `linear-gradient(to right, ${branding.primaryColor || '#2563eb'}, ${branding.secondaryColor || '#ec4899'})`
                        : 'linear-gradient(to right, #2563eb, #ec4899)'
                    }}
                  >
                    {branding?.appName || 'Unified APM'}
                  </h1>
                  <p className="text-xs text-gray-600 font-medium">
                    {branding?.appSubtitle || 'Asset Performance Management'}
                  </p>
                </div>
              </div>
              
              {/* Enhanced Plant Selector */}
              <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-blue-200 shadow-sm">
                <PlantSelector />
              </div>
            </div>
            
            {/* Enhanced Right Section */}
            <div className="flex items-center space-x-4">
              <DisplayCurrencyToggle className="bg-white/80 rounded-md" />
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
                  <div className="text-xs text-gray-500">
                    {session.user.role}
                    {isReadOnly && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800" title="Every role you hold in the selected plant is read-only; changes are refused by the server">
                        Read-only
                      </span>
                    )}
                  </div>
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
