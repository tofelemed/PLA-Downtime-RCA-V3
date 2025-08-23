import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RCATemplates from './rca-settings/RCATemplates';
import CauseLibraries from './rca-settings/CauseLibraries';
import VerificationChecklists from './rca-settings/VerificationChecklists';

const RCASettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('templates');
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="templates">RCA Templates</TabsTrigger>
        <TabsTrigger value="causes">Cause Libraries</TabsTrigger>
        <TabsTrigger value="checklists">Verification Checklists</TabsTrigger>
      </TabsList>
      <TabsContent value="templates">
        <RCATemplates />
      </TabsContent>
      <TabsContent value="causes">
        <CauseLibraries />
      </TabsContent>
      <TabsContent value="checklists">
        <VerificationChecklists />
      </TabsContent>
    </Tabs>
  );
};

export default RCASettings; 