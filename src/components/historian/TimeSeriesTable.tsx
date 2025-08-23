import React, { useState, useMemo } from 'react';
import { TimeSeriesResult } from '@/services/historian/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, Filter } from 'lucide-react';

interface TimeSeriesTableProps {
  results: TimeSeriesResult[];
  pageSize?: number;
}

export const TimeSeriesTable: React.FC<TimeSeriesTableProps> = ({ 
  results, 
  pageSize = 50 
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStreams, setSelectedStreams] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'timestamp' | 'stream' | 'value'>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  if (!results || results.length === 0) {
    return <div className="text-sm text-muted-foreground">No data</div>;
  }

  // Get unique stream names
  const streamNames = useMemo(() => {
    const names = new Set<string>();
    results.forEach(r => {
      const name = r.stream?.name || r.stream?.path || r.stream?.id;
      if (name) names.add(name);
    });
    return Array.from(names);
  }, [results]);

  // Initialize selected streams if empty
  React.useEffect(() => {
    if (selectedStreams.length === 0 && streamNames.length > 0) {
      setSelectedStreams(streamNames);
    }
  }, [streamNames, selectedStreams.length]);

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = results.flatMap(r => {
      const streamName = r.stream?.name || r.stream?.path || r.stream?.id;
      if (!selectedStreams.includes(streamName)) return [];
      
      return r.points.map(p => ({
        stream: streamName,
        timestamp: p.timestamp,
        value: p.value,
        units: p.units || r.stream?.units || '',
        quality: p.quality,
        originalStream: r.stream
      }));
    });

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.stream.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(item.value).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort data
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortBy) {
        case 'timestamp':
          aVal = new Date(a.timestamp).getTime();
          bVal = new Date(b.timestamp).getTime();
          break;
        case 'stream':
          aVal = a.stream.toLowerCase();
          bVal = b.stream.toLowerCase();
          break;
        case 'value':
          aVal = typeof a.value === 'number' ? a.value : parseFloat(String(a.value)) || 0;
          bVal = typeof b.value === 'number' ? b.value : parseFloat(String(b.value)) || 0;
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    return filtered;
  }, [results, selectedStreams, searchTerm, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentData = processedData.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handleSort = (field: 'timestamp' | 'stream' | 'value') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  const exportToCSV = () => {
    const headers = ['Stream', 'Timestamp', 'Value', 'Units', 'Good', 'Questionable', 'Substituted'];
    const csvData = [headers.join(',')];
    
    processedData.forEach(item => {
      csvData.push([
        `"${item.stream}"`,
        `"${item.timestamp}"`,
        `"${item.value ?? ''}"`,
        `"${item.units}"`,
        `"${item.quality?.good ?? ''}"`,
        `"${item.quality?.questionable ?? ''}"`,
        `"${item.quality?.substituted ?? ''}"`
      ].join(','));
    });
    
    const blob = new Blob([csvData.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historian_data_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getSortIcon = (field: 'timestamp' | 'stream' | 'value') => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          {/* Search */}
          <div className="relative">
            <Input
              placeholder="Search data..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
          </div>

          {/* Stream Filter */}
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">Streams:</Label>
            <Select 
              value={selectedStreams.length === streamNames.length ? 'all' : 'custom'} 
              onValueChange={(value) => {
                if (value === 'all') {
                  setSelectedStreams(streamNames);
                } else {
                  setSelectedStreams([]);
                }
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ({streamNames.length})</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Export Button */}
        <Button variant="outline" size="sm" onClick={exportToCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Stream Selection (if custom) */}
      {selectedStreams.length !== streamNames.length && (
        <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg">
          <Label className="text-sm font-medium mr-2">Select Streams:</Label>
          {streamNames.map(stream => (
            <label key={stream} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedStreams.includes(stream)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedStreams([...selectedStreams, stream]);
                  } else {
                    setSelectedStreams(selectedStreams.filter(s => s !== stream));
                  }
                  setCurrentPage(1);
                }}
                className="rounded"
              />
              <span className="text-sm">{stream}</span>
            </label>
          ))}
        </div>
      )}

      {/* Data Summary */}
      <div className="text-sm text-muted-foreground">
        Showing {startIndex + 1}-{Math.min(endIndex, processedData.length)} of {processedData.length} data points
        {selectedStreams.length !== streamNames.length && ` (filtered from ${streamNames.length} streams)`}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted border-b">
                <th className="p-3 text-left cursor-pointer hover:bg-muted/80" onClick={() => handleSort('stream')}>
                  <div className="flex items-center gap-2">
                    Stream {getSortIcon('stream')}
                  </div>
                </th>
                <th className="p-3 text-left cursor-pointer hover:bg-muted/80" onClick={() => handleSort('timestamp')}>
                  <div className="flex items-center gap-2">
                    Timestamp {getSortIcon('timestamp')}
                  </div>
                </th>
                <th className="p-3 text-left cursor-pointer hover:bg-muted/80" onClick={() => handleSort('value')}>
                  <div className="flex items-center gap-2">
                    Value {getSortIcon('value')}
                  </div>
                </th>
                <th className="p-3 text-left">Units</th>
                <th className="p-3 text-left">Quality</th>
              </tr>
            </thead>
            <tbody>
              {currentData.map((item, idx) => (
                <tr key={`${item.stream}-${idx}`} className="border-b hover:bg-muted/50">
                  <td className="p-3 font-medium">{item.stream}</td>
                  <td className="p-3 font-mono text-xs">
                    {new Date(item.timestamp).toLocaleString()}
                  </td>
                  <td className="p-3">
                    <span className={typeof item.value === 'number' ? 'font-mono' : ''}>
                      {item.value ?? '—'}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{item.units}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {item.quality?.good !== undefined && (
                        <span className={`px-2 py-1 rounded text-xs ${
                          item.quality.good ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {item.quality.good ? 'Good' : 'Bad'}
                        </span>
                      )}
                      {item.quality?.questionable && (
                        <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
                          Questionable
                        </span>
                      )}
                      {item.quality?.substituted && (
                        <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                          Substituted
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                    className="w-8 h-8 p-0"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Label className="text-sm">Page size:</Label>
            <Select 
              value={pageSize.toString()} 
              onValueChange={(value) => {
                const newPageSize = parseInt(value);
                const newTotalPages = Math.ceil(processedData.length / newPageSize);
                setCurrentPage(Math.min(currentPage, newTotalPages));
              }}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
};

