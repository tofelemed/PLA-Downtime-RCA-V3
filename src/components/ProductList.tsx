import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { masterDataService, Product } from '../services/MasterDataService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Search, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LegacyField } from '@/features/plans-profiles-calendars/legacy/legacy-field';

interface ProductFormData {
  name: string;
  code: string;
  unitOfMeasure: string;
  description: string;
  standardCost: number;
}

const ProductList: React.FC = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    code: '',
    unitOfMeasure: '',
    description: '',
    standardCost: 0,
  });
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<any>({});
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    loadData();
    return () => {
      isMounted.current = false;
    };
  }, [session]);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('🔍 ProductList: Loading products...');
      console.log('   Session Org ID:', session?.organization?.id);
      
      // Products are global (no organizationId field), so load all products
      const data = await masterDataService.getProducts({});
      console.log(`   Loaded ${data.length} products`);
      
      if (isMounted.current) setProducts(data);
    } catch (error) {
      console.error('Failed to load products:', error);
      toast({ title: 'Error', description: 'Failed to load products', variant: 'destructive' });
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  const getFilteredProducts = () => {
    if (!searchQuery) return products;
    return products.filter(product =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const resetForm = () => {
    setFormData({ name: '', code: '', unitOfMeasure: '', description: '', standardCost: 0 });
    setEditingProduct(null);
  };

  const handleCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      code: product.code,
      unitOfMeasure: product.unitOfMeasure,
      description: product.description || '',
      standardCost: product.standardCost || 0,
    });
    setShowForm(true);
  };

  const handleDelete = async (product: Product) => {
    if (!window.confirm(`Are you sure you want to delete "${product.name}"?`)) return;
    try {
      await masterDataService.deleteProduct(product.id);
      toast({ title: 'Success', description: 'Product deleted successfully' });
      loadData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete product', variant: 'destructive' });
    }
  };

  const validateForm = () => {
    const errors: any = {};
    if (!formData.name) errors.name = 'Name is required';
    if (!formData.code) errors.code = 'Code is required';
    if (!formData.unitOfMeasure) errors.unitOfMeasure = 'Unit of Measure is required';
    if (formData.standardCost < 0) errors.standardCost = 'Cost cannot be negative';
    // Uniqueness check
    const codeExists = products.some(p => p.code === formData.code && (!editingProduct || p.id !== editingProduct.id));
    if (codeExists) errors.code = 'Code must be unique';
    return errors;
  };

  const handleSave = async () => {
    const errors = validateForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setLoading(true);
    try {
      if (!session?.organization?.id) return;
      if (editingProduct) {
        await masterDataService.updateProduct(editingProduct.id, {
          name: formData.name,
          code: formData.code,
          unitOfMeasure: formData.unitOfMeasure,
          description: formData.description,
          standardCost: formData.standardCost,
        });
        toast({ title: 'Success', description: 'Product updated successfully' });
      } else {
        await masterDataService.createProduct({
          name: formData.name,
          code: formData.code,
          unitOfMeasure: formData.unitOfMeasure,
          description: formData.description,
          standardCost: formData.standardCost,
          organizationId: session.organization.id,
        });
        toast({ title: 'Success', description: 'Product created successfully' });
      }
      resetForm();
      setShowForm(false);
      loadData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save product', variant: 'destructive' });
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          Products
          <Button className="ml-auto" onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-1" /> Add Product
          </Button>
        </CardTitle>
        <CardDescription>Manage product catalog for your organization</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center py-12"><Loader2 className="animate-spin w-8 h-8 text-gray-400" /></div>
        ) : (
          <>
            <div className="mb-4 flex items-center">
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-64 mr-2"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getFilteredProducts().map(product => (
                <Card key={product.id} className="border p-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-semibold text-lg">{product.name}</div>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(product)}><Edit className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(product)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 mb-1">Code: {product.code}</div>
                  <div className="text-sm text-gray-500 mb-1">UOM: {product.unitOfMeasure}</div>
                  <div className="text-sm text-gray-500 mb-1">Cost: ${product.standardCost}</div>
                  <div className="text-xs text-gray-400">{product.description}</div>
                </Card>
              ))}
            </div>
          </>
        )}
      </CardContent>
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add Product'}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSave();
            }}
            className="space-y-4"
          >
            <div>
              <Label>Name</Label>
              <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
              {formErrors.name && <div className="text-red-500 text-xs mt-1">{formErrors.name}</div>}
            </div>
            <div>
              <Label>Code</Label>
              <Input value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} required />
              {formErrors.code && <div className="text-red-500 text-xs mt-1">{formErrors.code}</div>}
            </div>
            <div>
              <Label>Unit of Measure</Label>
              <Input value={formData.unitOfMeasure} onChange={e => setFormData({ ...formData, unitOfMeasure: e.target.value })} required />
              {formErrors.unitOfMeasure && <div className="text-red-500 text-xs mt-1">{formErrors.unitOfMeasure}</div>}
            </div>
            <LegacyField label="Standard cost (unconfirmed legacy cost, D08 Q3)" replacement="an approved valuation rate in IRR or USD on a production profile"><div>
              <Label>Standard Cost</Label>
              <Input type="number" value={formData.standardCost} onChange={e => setFormData({ ...formData, standardCost: Number(e.target.value) })} required />
              {formErrors.standardCost && <div className="text-red-500 text-xs mt-1">{formErrors.standardCost}</div>}
            </div></LegacyField>
            <div>
              <Label>Description</Label>
              <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={loading}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}{editingProduct ? 'Update' : 'Create'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ProductList; 