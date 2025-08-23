import React from 'react';
import { ProductionPlanTemplate, Product } from '../../../services/MasterDataService';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type StepProductsProps = {
  template: Partial<ProductionPlanTemplate>;
  onUpdate: (updates: Partial<ProductionPlanTemplate>) => void;
  products?: Product[];
};

const StepProducts: React.FC<StepProductsProps> = ({ template, onUpdate, products = [] }) => {
  const toggleProduct = (productId: string) => {
    const currentProductIds = template.productIds || [];
    const newProductIds = currentProductIds.includes(productId)
      ? currentProductIds.filter(id => id !== productId)
      : [...currentProductIds, productId];
    
    onUpdate({ productIds: newProductIds });
  };

  return (
    <div className="space-y-3">
      <div className="text-center">
        <h3 className="text-base font-semibold text-gray-900">Product Selection</h3>
        <p className="text-xs text-gray-600 mt-1">
          Choose the products to include in this production plan template
        </p>
      </div>

      <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-pink-50">
        <CardContent className="p-4">
          {products.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center space-x-2 p-2 rounded border border-gray-200 hover:bg-white hover:shadow-sm transition-all cursor-pointer"
                    onClick={() => toggleProduct(product.id)}
                  >
                    <Checkbox
                      id={product.id}
                      checked={template.productIds?.includes(product.id) || false}
                      onCheckedChange={() => toggleProduct(product.id)}
                      className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                    />
                    <div className="flex-1 min-w-0">
                      <Label htmlFor={product.id} className="text-xs font-medium cursor-pointer truncate">
                        {product.name}
                      </Label>
                      <div className="flex items-center space-x-1 mt-0.5">
                        <Badge variant="outline" className="text-xs px-1 py-0">
                          {product.code}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {product.unitOfMeasure}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {template.productIds && template.productIds.length > 0 && (
                <div className="mt-2 p-2 bg-purple-100 rounded border border-purple-200">
                  <p className="text-xs font-medium text-purple-800">
                    ✓ {template.productIds.length} product{template.productIds.length !== 1 ? 's' : ''} selected
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-gray-400 text-sm">📦</span>
              </div>
              <p className="text-xs text-gray-500">
                No products available. Please create products first.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StepProducts; 