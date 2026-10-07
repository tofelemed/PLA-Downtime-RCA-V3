import React, { useState, useEffect } from 'react';
import { ImpactCode, OEECode, RCACauseCode, VerificationStatusCode } from '../services/MasterDataService';
import { masterDataService } from '../services/MasterDataService';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit, Trash2, Save, X, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import RCACauseLibraryTree from './rca-settings/RCACauseLibraryTree';
import ReasonCodeLibraryTree from './reason-codes/ReasonCodeLibraryTree';

type CodeType = 'impact' | 'oee' | 'reason';

interface CodeFormData {
  code: string;
  name: string;
  description?: string;
  category?: string;
  costPerHour?: number;
  costPerUnit?: number;
  costBasis?: 'perHour' | 'perUnit';
  impactType?: string;
  color?: string;
  parentId?: string;
}

const CodesManagement: React.FC = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<CodeType>('impact');
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCode, setEditingCode] = useState<any>(null);
  const [formData, setFormData] = useState<CodeFormData>({
    code: '',
    name: '',
    description: '',
    category: '',
    costPerHour: 0,
    impactType: '',
    color: '#3B82F6',
    parentId: undefined,
    costPerUnit: 0,
    costBasis: 'perHour',
  });

  // Data states
  const [impactCodes, setImpactCodes] = useState<ImpactCode[]>([]);
  const [oeeCodes, setOEECodes] = useState<OEECode[]>([]);

  useEffect(() => {
    // Always load codes, even if tenant ID is not set yet
    loadCodes();
  }, [session, activeTab]);

  const loadCodes = async () => {
    console.log('🔍 CodesManagement: Loading codes for tab:', activeTab);
    console.log('   Session Tenant ID:', session?.tenant?.id);
    
    try {
      // Load ALL codes without tenant filter (Master Data should show all codes)
      // This allows viewing and managing codes across all tenants
      
      switch (activeTab) {
        case 'impact':
          const impacts = await masterDataService.getImpactCodes({});
          console.log(`   ✅ Loaded ${impacts.length} impact codes (ALL tenants)`);
          setImpactCodes(impacts);
          break;
        case 'oee':
          const oees = await masterDataService.getOEECodes({});
          console.log(`   ✅ Loaded ${oees.length} OEE codes (ALL tenants)`);
          setOEECodes(oees);
          break;
      }
    } catch (error) {
      console.error('❌ Failed to load codes:', error);
      toast({
        title: 'Error',
        description: 'Failed to load codes',
        variant: 'destructive',
      });
    }
  };

  const getFilteredCodes = () => {
    const codes = getCurrentCodes();
    console.log(`📊 CodesManagement: Filtering ${codes.length} codes for tab ${activeTab}`);
    if (!searchQuery) return codes;
    
    return codes.filter(code => 
      code.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      code.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      code.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const getCurrentCodes = () => {
    switch (activeTab) {
      case 'impact': 
        console.log(`   Impact codes array length: ${impactCodes.length}`);
        return impactCodes;
      case 'oee': 
        console.log(`   OEE codes array length: ${oeeCodes.length}`);
        return oeeCodes;
      default: 
        return [];
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      category: '',
      costPerHour: 0,
      impactType: '',
      color: '#3B82F6',
      parentId: undefined,
      costPerUnit: 0,
      costBasis: 'perHour',
    });
    setEditingCode(null);
  };

  const handleCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (code: any) => {
    setEditingCode(code);
    setFormData({
      code: code.code,
      name: code.name,
      description: code.description || '',
      category: code.category || '',
      costPerHour: code.costPerHour || 0,
      impactType: code.impactType || '',
      color: code.color || '#3B82F6',
      parentId: code.parentId || undefined,
      costPerUnit: code.costPerUnit || 0,
      costBasis: code.costBasis || 'perHour',
    });
    setShowForm(true);
  };

  const handleDelete = async (code: any) => {
    if (!window.confirm(`Are you sure you want to delete "${code.name}"?`)) return;

    try {
      switch (activeTab) {
        case 'impact':
          await masterDataService.deleteImpactCode(code.id);
          break;
        case 'oee':
          await masterDataService.deleteOEECode(code.id);
          break;
      }

      toast({
        title: 'Success',
        description: 'Code deleted successfully',
      });
      loadCodes();
    } catch (error) {
      console.error('Failed to delete code:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete code',
        variant: 'destructive',
      });
    }
  };

  const handleSave = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    if (!session?.tenant?.id) return;

    try {
      const baseData = {
        code: formData.code,
        name: formData.name,
        description: formData.description,
        tenantId: session.tenant.id,
      };

      if (editingCode) {
        // Update existing code
        switch (activeTab) {
          case 'impact':
            await masterDataService.updateImpactCode(editingCode.id, {
              ...baseData,
              category: formData.category as any,
              costPerHour: formData.costPerHour || 0,
              costPerUnit: formData.costPerUnit || 0,
              costBasis: formData.costBasis || 'perHour',
            });
            break;
          case 'oee':
            await masterDataService.updateOEECode(editingCode.id, {
              ...baseData,
              category: formData.category as any,
              impactType: formData.impactType as any,
            });
            break;
        }
      } else {
        // Create new code
        switch (activeTab) {
          case 'impact':
            await masterDataService.createImpactCode({
              ...baseData,
              category: formData.category as any,
              costPerHour: formData.costPerHour || 0,
              costPerUnit: formData.costPerUnit || 0,
              costBasis: formData.costBasis || 'perHour',
            });
            break;
          case 'oee':
            await masterDataService.createOEECode({
              ...baseData,
              category: formData.category as any,
              impactType: formData.impactType as any,
            });
            break;
        }
      }

      toast({
        title: 'Success',
        description: `Code ${editingCode ? 'updated' : 'created'} successfully`,
      });
      
      setShowForm(false);
      setTimeout(() => {
        resetForm();
      }, 200);
      loadCodes();
    } catch (error) {
      console.error('Failed to save code:', error);
      toast({
        title: 'Error',
        description: 'Failed to save code',
        variant: 'destructive',
      });
    }
  };

  const renderCodeCard = (code: any) => (
    <Card key={code.id} className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div>
              <CardTitle className="text-lg">{code.name}</CardTitle>
              <CardDescription className="text-sm">
                Code: {code.code}
              </CardDescription>
            </div>
            {code.color && (
              <div 
                className="w-4 h-4 rounded-full border-2 border-gray-300"
                style={{ backgroundColor: code.color }}
              />
            )}
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEdit(code)}
              className="text-blue-600 hover:text-blue-700"
            >
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDelete(code)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {code.description && (
            <p className="text-sm text-gray-600">{code.description}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {code.category && (
              <Badge variant="secondary">{code.category}</Badge>
            )}
            {code.impactType && (
              <Badge variant="outline">{code.impactType}</Badge>
            )}
            {code.costPerHour && (
              <Badge variant="outline">${code.costPerHour}/hr</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderForm = () => (
    <Dialog open={showForm} onOpenChange={setShowForm}>
      <DialogContent
        className={
          activeTab === 'reason'
            ? 'w-screen h-screen max-w-none max-h-none rounded-none p-0 flex flex-col'
            : 'max-w-lg w-full rounded-xl p-6 flex flex-col'
        }
      >
        <DialogHeader />
        <div className="flex flex-1 overflow-hidden">
          {/* Only show RCA Cause Library tree for RCA cause codes, not for impact or OEE codes */}
          {activeTab === 'reason' && (
            <div className="w-3/5 h-full p-6 overflow-y-auto bg-gray-50 border-r flex flex-col">
              <h2 className="text-xl font-semibold mb-4">RCA Cause Library</h2>
              <RCACauseLibraryTree />
            </div>
          )}
          {/* Right: Edit/Create form */}
          <div className={
            activeTab === 'reason'
              ? 'w-2/5 h-full p-8 flex flex-col justify-between bg-white'
              : 'w-full h-full p-0 flex flex-col justify-between bg-white'
          }>
            <h2 className="text-xl font-semibold mb-4">{editingCode ? (activeTab === 'impact' ? 'Edit Impact Code' : activeTab === 'oee' ? 'Edit OEE Code' : 'Edit Cause') : (activeTab === 'impact' ? 'Add Impact Code' : activeTab === 'oee' ? 'Add OEE Code' : 'Add New Cause')}</h2>
            <form className="space-y-4 flex-1 flex flex-col justify-between" onSubmit={handleSave}>
              {/* Form fields go here */}
              <div className="space-y-2">
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="Enter code"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter description"
                  rows={3}
                />
              </div>

              {/* Tab-specific fields */}
              {activeTab === 'impact' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select 
                      value={formData.category} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Quality">Quality</SelectItem>
                        <SelectItem value="Availability">Availability</SelectItem>
                        <SelectItem value="Performance">Performance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="costPerUnit">Cost per Unit ($)</Label>
                    <Input
                      id="costPerUnit"
                      type="number"
                      value={formData.costPerUnit || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, costPerUnit: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="costPerHour">Cost per Hour ($)</Label>
                    <Input
                      id="costPerHour"
                      type="number"
                      value={formData.costPerHour || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, costPerHour: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="costBasis">Default Cost Basis</Label>
                    <Select
                      value={formData.costBasis || 'perHour'}
                      onValueChange={(value: 'perHour' | 'perUnit') => setFormData(prev => ({ ...prev, costBasis: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select basis" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="perUnit">Per Unit</SelectItem>
                        <SelectItem value="perHour">Per Hour</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {activeTab === 'oee' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select 
                      value={formData.category} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Planned">Planned</SelectItem>
                        <SelectItem value="Unplanned">Unplanned</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="impactType">Impact Type *</Label>
                    <Select 
                      value={formData.impactType} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, impactType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select impact type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Availability">Availability</SelectItem>
                        <SelectItem value="Performance">Performance</SelectItem>
                        <SelectItem value="Quality">Quality</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 mt-8">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit">{editingCode ? 'Update' : 'Create'}</Button>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Codes Management</h2>
          <p className="text-muted-foreground">
            Manage impact codes, OEE codes, RCA cause codes, and verification status codes
          </p>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            if (session?.tenant?.id) {
              await masterDataService.initializeSampleData(session.tenant.id);
              if (activeTab === 'reason') window.location.reload();
            }
          }}
        >
          Seed Reason Codes
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as CodeType)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="impact">Impact Codes</TabsTrigger>
          <TabsTrigger value="oee">OEE Codes</TabsTrigger>
          <TabsTrigger value="reason">Reason Codes</TabsTrigger>
        </TabsList>

        <TabsContent value="impact" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex space-x-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search codes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Button onClick={handleCreate} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Create Code
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getFilteredCodes().map(renderCodeCard)}
          </div>

          {getFilteredCodes().length === 0 && (
            <Card className="text-center py-12">
              <CardContent>
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Filter className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">
                  {searchQuery ? 'No codes found' : 'No codes yet'}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchQuery 
                    ? 'Try adjusting your search criteria'
                    : 'Create your first code to get started'
                  }
                </p>
                {!searchQuery && (
                  <Button onClick={handleCreate}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Code
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="oee" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex space-x-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search codes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Button onClick={handleCreate} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Create Code
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getFilteredCodes().map(renderCodeCard)}
          </div>

          {getFilteredCodes().length === 0 && (
            <Card className="text-center py-12">
              <CardContent>
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Filter className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">
                  {searchQuery ? 'No codes found' : 'No codes yet'}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchQuery 
                    ? 'Try adjusting your search criteria'
                    : 'Create your first code to get started'
                  }
                </p>
                {!searchQuery && (
                  <Button onClick={handleCreate}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Code
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="reason" className="space-y-4">
          <ReasonCodeLibraryTree />
        </TabsContent>
      </Tabs>

      {showForm && renderForm()}
    </div>
  );
};

export default CodesManagement; 