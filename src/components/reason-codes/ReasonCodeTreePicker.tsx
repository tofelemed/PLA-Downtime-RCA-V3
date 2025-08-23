import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ReasonCode } from '../../services/MasterDataService';

interface ReasonCodeTreePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reasonCodes: ReasonCode[];
  value: string;
  onSelect: (rc: ReasonCode | null) => void;
}

interface TreeNode extends ReasonCode {
  children?: TreeNode[];
}

const buildTree = (flat: ReasonCode[]): TreeNode[] => {
  const map = new Map<string, TreeNode>();
  flat.forEach(code => map.set(String(code.id), { ...code, children: [] }));
  const roots: TreeNode[] = [];
  map.forEach(node => {
    if (node.parentId && map.has(String(node.parentId))) {
      map.get(String(node.parentId))!.children!.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
};

const ReasonCodeTreePicker: React.FC<ReasonCodeTreePickerProps> = ({ open, onOpenChange, reasonCodes, value, onSelect }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const tree = useMemo(() => buildTree(reasonCodes), [reasonCodes]);

  const handleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const renderTree = (nodes: TreeNode[], level = 0) => (
    <ul className={level === 0 ? 'pl-0' : 'pl-6'}>
      {nodes.map(node => (
        <li key={node.id} className="mb-1">
          <div className="flex items-center gap-2">
            {node.children && node.children.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => handleExpand(node.id)}>
                {expanded.has(node.id) ? '-' : '+'}
              </Button>
            )}
            <span className="font-medium">{node.code}</span>
            <span>{node.name}</span>
            {(!node.children || node.children.length === 0) && (
              <Button
                size="sm"
                variant={value === node.id ? 'default' : 'outline'}
                onClick={() => onSelect(node)}
              >
                {value === node.id ? 'Selected' : 'Select'}
              </Button>
            )}
          </div>
          {node.description && <div className="text-xs text-gray-500 ml-6">{node.description}</div>}
          {node.children && node.children.length > 0 && expanded.has(node.id) && renderTree(node.children, level + 1)}
        </li>
      ))}
    </ul>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Select Reason Code</DialogTitle>
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto">
          {renderTree(tree)}
        </div>
        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={() => onSelect(null)}>Clear</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReasonCodeTreePicker; 