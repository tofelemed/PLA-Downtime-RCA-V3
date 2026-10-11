import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, Wrench, Shield, Factory, ClipboardList, PackageCheck, Eye, EyeOff } from 'lucide-react';

interface TabVisibilitySettingsProps {
  isOpen: boolean;
  onClose: () => void;
  visibleTabs: {
    ProductionLoss: boolean;
    IOW: boolean;
    SOL: boolean;
    APM: boolean;
    FailureWO: boolean;
    ProductionOutput: boolean;
  };
  onToggle: (tabName: keyof TabVisibilitySettingsProps['visibleTabs'], visible: boolean) => void;
  onReset: () => void;
  eventCounts: {
    ProductionLoss: number;
    IOW: number;
    SOL: number;
    APM: number;
    FailureWO: number;
    ProductionOutput: number;
  };
}

const tabConfig = [
  {
    key: 'ProductionLoss' as const,
    label: 'Production Loss',
    icon: TrendingDown,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
  },
  {
    key: 'IOW' as const,
    label: 'IOW (Instrumentation Out of Work)',
    icon: Wrench,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
  },
  {
    key: 'SOL' as const,
    label: 'SOL (Safety Operating Limit)',
    icon: Shield,
    color: 'text-pink-500',
    bgColor: 'bg-pink-50',
  },
  {
    key: 'APM' as const,
    label: 'APM Events',
    icon: Factory,
    color: 'text-green-500',
    bgColor: 'bg-green-50',
  },
  {
    key: 'FailureWO' as const,
    label: 'Failure Work Orders',
    icon: ClipboardList,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50',
  },
  {
    key: 'ProductionOutput' as const,
    label: 'Production Output',
    icon: PackageCheck,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-50',
  },
];

export const TabVisibilitySettings: React.FC<TabVisibilitySettingsProps> = ({
  isOpen,
  onClose,
  visibleTabs,
  onToggle,
  onReset,
  eventCounts,
}) => {
  const visibleCount = Object.values(visibleTabs).filter(Boolean).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-600" />
            Customize Event Tabs
          </DialogTitle>
          <DialogDescription>
            Choose which event type tabs to display. Your preferences will be saved automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                {visibleCount} of {tabConfig.length} tabs visible
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              className="text-xs"
            >
              Reset to Default
            </Button>
          </div>

          {/* Tab Controls */}
          <div className="space-y-2">
            {tabConfig.map((tab) => {
              const Icon = tab.icon;
              const isVisible = visibleTabs[tab.key];
              const count = eventCounts[tab.key];

              return (
                <div
                  key={tab.key}
                  className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                    isVisible
                      ? `${tab.bgColor} border-${tab.color.replace('text-', '')}-300`
                      : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Icon className={`w-5 h-5 ${isVisible ? tab.color : 'text-gray-400'}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={`toggle-${tab.key}`}
                          className={`text-sm font-semibold cursor-pointer ${
                            isVisible ? 'text-gray-900' : 'text-gray-500'
                          }`}
                        >
                          {tab.label}
                        </Label>
                        <Badge
                          variant={isVisible ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {count} events
                        </Badge>
                      </div>
                      {!isVisible && (
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <EyeOff className="w-3 h-3" />
                          Tab hidden from view
                        </p>
                      )}
                    </div>
                  </div>
                  <Switch
                    id={`toggle-${tab.key}`}
                    checked={isVisible}
                    onCheckedChange={(checked) => onToggle(tab.key, checked)}
                  />
                </div>
              );
            })}
          </div>

          {/* Warning if all tabs are hidden */}
          {visibleCount === 0 && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center gap-2 text-orange-800">
                <EyeOff className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Warning: All tabs are hidden. Enable at least one tab to view events.
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="default" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

