import React, { useState, useEffect } from 'react';
import { AuditTrailEntry } from '../services/MasterDataService';
import { useAuth } from '../contexts/AuthContext';
import { 
  Clock, 
  User, 
  FileText, 
  Edit, 
  Trash2, 
  Plus, 
  Eye, 
  History,
  Calendar,
  Filter,
  Search,
  ArrowUpDown,
  Info,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

interface AuditTrailViewerProps {
  auditTrail: AuditTrailEntry[];
  entityType: string;
  entityName: string;
  onClose: () => void;
  isOpen: boolean;
}

export const AuditTrailViewer: React.FC<AuditTrailViewerProps> = ({
  auditTrail,
  entityType,
  entityName,
  onClose,
  isOpen
}) => {
  const { session } = useAuth();
  const [filteredTrail, setFilteredTrail] = useState<AuditTrailEntry[]>(auditTrail);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedEntry, setSelectedEntry] = useState<AuditTrailEntry | null>(null);

  // Filter and sort audit trail
  useEffect(() => {
    let filtered = [...auditTrail];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(entry => 
        entry.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.changes.some(change => 
          change.field.toLowerCase().includes(searchTerm.toLowerCase()) ||
          String(change.oldValue).toLowerCase().includes(searchTerm.toLowerCase()) ||
          String(change.newValue).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(entry => {
        const hasFieldChanges = entry.changes.some(change => change.field === filterType);
        return hasFieldChanges;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    setFilteredTrail(filtered);
  }, [auditTrail, searchTerm, filterType, sortOrder]);

  // Get unique field types for filtering
  const getFieldTypes = () => {
    const fields = new Set<string>();
    auditTrail.forEach(entry => {
      entry.changes.forEach(change => {
        fields.add(change.field);
      });
    });
    return Array.from(fields).sort();
  };

  // Get change type icon and color
  const getChangeTypeInfo = (change: any) => {
    const oldValue = String(change.oldValue || '');
    const newValue = String(change.newValue || '');
    
    if (oldValue === '' && newValue !== '') {
      return { icon: Plus, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Added' };
    } else if (oldValue !== '' && newValue === '') {
      return { icon: Trash2, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Removed' };
    } else {
      return { icon: Edit, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Modified' };
    }
  };

  // Format value for display
  const formatValue = (value: any) => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  // Get change summary
  const getChangeSummary = (entry: AuditTrailEntry) => {
    const changes = entry.changes;
    if (changes.length === 0) return 'No changes recorded';
    
    const fieldNames = changes.map(c => c.field).join(', ');
    if (changes.length === 1) {
      return `Modified ${fieldNames}`;
    } else {
      return `Modified ${changes.length} fields: ${fieldNames}`;
    }
  };

  const fieldTypes = getFieldTypes();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <History className="w-5 h-5 text-blue-600" />
            <span>Audit Trail</span>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              {entityType}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Complete audit history for: <strong>{entityName}</strong>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="timeline" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="timeline" className="flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>Timeline</span>
            </TabsTrigger>
            <TabsTrigger value="changes" className="flex items-center space-x-2">
              <Edit className="w-4 h-4" />
              <span>Changes</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center space-x-2">
              <Info className="w-4 h-4" />
              <span>Analytics</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="space-y-6">
            {/* Filters */}
            <Card className="bg-gradient-to-r from-gray-50 to-blue-50 border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-gray-900">Filters & Search</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="search">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="search"
                        placeholder="Search changes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="filterType">Field Type</Label>
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger>
                        <SelectValue placeholder="All fields" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Fields</SelectItem>
                        {fieldTypes.map(field => (
                          <SelectItem key={field} value={field}>{field}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sortOrder">Sort Order</Label>
                    <Select value={sortOrder} onValueChange={(value: 'asc' | 'desc') => setSortOrder(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="desc">Newest First</SelectItem>
                        <SelectItem value="asc">Oldest First</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Results</Label>
                    <div className="text-sm text-gray-600">
                      {filteredTrail.length} of {auditTrail.length} entries
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <div className="space-y-4">
              {filteredTrail.length > 0 ? (
                filteredTrail.map((entry, index) => (
                  <Card key={index} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                            <User className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="font-semibold text-gray-900">{entry.userName}</span>
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                {getChangeSummary(entry)}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <div className="flex items-center space-x-1">
                                <Calendar className="w-3 h-3" />
                                <span>{new Date(entry.timestamp).toLocaleString()}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedEntry(entry)}
                          className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="border border-gray-200">
                  <CardContent className="p-8 text-center">
                    <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">No Audit Entries Found</h4>
                    <p className="text-gray-600">
                      {searchTerm || filterType !== 'all' 
                        ? 'No entries match your current filters. Try adjusting your search criteria.'
                        : 'No audit trail entries have been recorded for this item yet.'
                      }
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="changes" className="space-y-6">
            {/* Changes Summary */}
            <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-green-900">Changes Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-white rounded border border-green-200">
                    <div className="text-2xl font-bold text-green-600">{auditTrail.length}</div>
                    <div className="text-sm text-green-700">Total Changes</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded border border-blue-200">
                    <div className="text-2xl font-bold text-blue-600">
                      {new Set(auditTrail.map(e => e.userName)).size}
                    </div>
                    <div className="text-sm text-blue-700">Unique Users</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded border border-purple-200">
                    <div className="text-2xl font-bold text-purple-600">
                      {new Set(auditTrail.flatMap(e => e.changes.map(c => c.field))).size}
                    </div>
                    <div className="text-sm text-purple-700">Fields Modified</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Detailed Changes */}
            <div className="space-y-4">
              {auditTrail.map((entry, entryIndex) => (
                <Card key={entryIndex} className="border border-gray-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-gray-600" />
                        <span className="font-semibold">{entry.userName}</span>
                        <Badge variant="outline" className="text-xs">
                          {new Date(entry.timestamp).toLocaleDateString()}
                        </Badge>
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {entry.changes.map((change, changeIndex) => {
                        const changeInfo = getChangeTypeInfo(change);
                        return (
                          <div key={changeIndex} className="flex items-start space-x-3 p-3 bg-gray-50 rounded">
                            <div className={`w-6 h-6 rounded-full ${changeInfo.bgColor} flex items-center justify-center`}>
                              <changeInfo.icon className={`w-3 h-3 ${changeInfo.color}`} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="font-medium text-gray-900">{change.field}</span>
                                <Badge variant="outline" className={`text-xs ${changeInfo.bgColor} ${changeInfo.color} border-current`}>
                                  {changeInfo.label}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500">From:</span>
                                  <div className="font-mono text-xs bg-red-50 p-1 rounded mt-1">
                                    {formatValue(change.oldValue)}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-gray-500">To:</span>
                                  <div className="font-mono text-xs bg-green-50 p-1 rounded mt-1">
                                    {formatValue(change.newValue)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {/* Analytics Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Most Active Users */}
              <Card className="border border-gray-200">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <User className="w-4 h-4" />
                    <span>Most Active Users</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(() => {
                      const userCounts = auditTrail.reduce((acc, entry) => {
                        acc[entry.userName] = (acc[entry.userName] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>);
                      
                      return Object.entries(userCounts)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 5)
                        .map(([user, count]) => (
                          <div key={user} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span className="font-medium">{user}</span>
                            <Badge variant="secondary">{count} changes</Badge>
                          </div>
                        ));
                    })()}
                  </div>
                </CardContent>
              </Card>

              {/* Most Modified Fields */}
              <Card className="border border-gray-200">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Edit className="w-4 h-4" />
                    <span>Most Modified Fields</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(() => {
                      const fieldCounts = auditTrail.reduce((acc, entry) => {
                        entry.changes.forEach(change => {
                          acc[change.field] = (acc[change.field] || 0) + 1;
                        });
                        return acc;
                      }, {} as Record<string, number>);
                      
                      return Object.entries(fieldCounts)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 5)
                        .map(([field, count]) => (
                          <div key={field} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span className="font-medium">{field}</span>
                            <Badge variant="secondary">{count} times</Badge>
                          </div>
                        ));
                    })()}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Timeline Chart */}
            <Card className="border border-gray-200">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="w-4 h-4" />
                  <span>Activity Timeline</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(() => {
                    const dailyCounts = auditTrail.reduce((acc, entry) => {
                      const date = new Date(entry.timestamp).toLocaleDateString();
                      acc[date] = (acc[date] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>);
                    
                    return Object.entries(dailyCounts)
                      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
                      .map(([date, count]) => (
                        <div key={date} className="flex items-center space-x-4">
                          <div className="w-24 text-sm text-gray-600">{date}</div>
                          <div className="flex-1">
                            <div className="bg-blue-100 rounded-full h-2">
                              <div 
                                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${Math.min((count / Math.max(...Object.values(dailyCounts))) * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                          <div className="w-12 text-right text-sm text-gray-600">{count}</div>
                        </div>
                      ));
                  })()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Change Details Modal */}
        <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Eye className="w-4 h-4" />
                <span>Change Details</span>
              </DialogTitle>
              <DialogDescription>
                Detailed view of changes made by {selectedEntry?.userName}
              </DialogDescription>
            </DialogHeader>
            {selectedEntry && (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded">
                  <div className="flex items-center space-x-2 mb-2">
                    <User className="w-4 h-4 text-gray-600" />
                    <span className="font-semibold">{selectedEntry.userName}</span>
                    <Badge variant="outline">
                      {new Date(selectedEntry.timestamp).toLocaleString()}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{getChangeSummary(selectedEntry)}</p>
                </div>
                
                <div className="space-y-3">
                  {selectedEntry.changes.map((change, index) => {
                    const changeInfo = getChangeTypeInfo(change);
                    return (
                      <Card key={index} className="border border-gray-200">
                        <CardHeader className="pb-2">
                          <div className="flex items-center space-x-2">
                            <changeInfo.icon className={`w-4 h-4 ${changeInfo.color}`} />
                            <span className="font-semibold">{change.field}</span>
                            <Badge variant="outline" className={`${changeInfo.bgColor} ${changeInfo.color} border-current`}>
                              {changeInfo.label}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm text-gray-500">Previous Value</Label>
                              <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-sm font-mono">
                                {formatValue(change.oldValue)}
                              </div>
                            </div>
                            <div>
                              <Label className="text-sm text-gray-500">New Value</Label>
                              <div className="mt-1 p-2 bg-green-50 border border-green-200 rounded text-sm font-mono">
                                {formatValue(change.newValue)}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 