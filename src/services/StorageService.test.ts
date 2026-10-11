import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HistorianHistoryDB } from './StorageService';

interface FakeOpenRequest {
  onerror: (() => void) | null;
  onsuccess: (() => void) | null;
  onupgradeneeded: (() => void) | null;
}

// Like a real IDBOpenDBRequest, the failure is reported asynchronously, after init() attaches its handlers
function failingOpenRequest(): FakeOpenRequest {
  const request: FakeOpenRequest = { onerror: null, onsuccess: null, onupgradeneeded: null };
  queueMicrotask(() => request.onerror?.());
  return request;
}

const mockIndexedDB = {
  open: vi.fn(failingOpenRequest),
};

Object.defineProperty(window, 'indexedDB', {
  value: mockIndexedDB,
  writable: true,
});

describe('HistorianHistoryDB', () => {
  let db: HistorianHistoryDB;
  const testTenantId = 'test-tenant-123';

  beforeEach(() => {
    db = new HistorianHistoryDB();
    vi.clearAllMocks();
  });

  describe('Fallback Storage', () => {
    it('should use fallback storage when IndexedDB is not available', async () => {
      await db.init();
      expect(db.getStorageType()).toBe('fallback');
    });

    it('should save and load history using fallback storage', async () => {
      await db.init();
      
      const testHistory = [
        {
          id: '1',
          timestamp: '2024-01-01T00:00:00Z',
          attributes: [],
          queryParams: {},
          resultCount: 10,
          tenantId: testTenantId,
        },
      ];

      await db.saveQueryHistory(testTenantId, testHistory);
      const loadedHistory = await db.loadQueryHistory(testTenantId);
      
      expect(loadedHistory).toHaveLength(1);
      expect(loadedHistory[0].id).toBe('1');
    });

    it('should add new entries to fallback storage', async () => {
      await db.init();
      
      const entry = {
        id: 'new-entry',
        timestamp: '2024-01-01T00:00:00Z',
        attributes: [],
        queryParams: {},
        resultCount: 5,
      };

      await db.addQueryHistoryEntry(testTenantId, entry);
      const history = await db.loadQueryHistory(testTenantId);
      
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('new-entry');
      expect(history[0].tenantId).toBe(testTenantId);
    });

    it('should clear history from fallback storage', async () => {
      await db.init();
      
      const testHistory = [
        {
          id: '1',
          timestamp: '2024-01-01T00:00:00Z',
          attributes: [],
          queryParams: {},
          resultCount: 10,
          tenantId: testTenantId,
        },
      ];

      await db.saveQueryHistory(testTenantId, testHistory);
      await db.clearQueryHistory(testTenantId);
      
      const history = await db.loadQueryHistory(testTenantId);
      expect(history).toHaveLength(0);
    });

    it('should remove specific entries from fallback storage', async () => {
      await db.init();
      
      const testHistory = [
        {
          id: '1',
          timestamp: '2024-01-01T00:00:00Z',
          attributes: [],
          queryParams: {},
          resultCount: 10,
          tenantId: testTenantId,
        },
        {
          id: '2',
          timestamp: '2024-01-01T00:00:00Z',
          attributes: [],
          queryParams: {},
          resultCount: 5,
          tenantId: testTenantId,
        },
      ];

      await db.saveQueryHistory(testTenantId, testHistory);
      await db.removeQueryHistoryEntry('1');
      
      const history = await db.loadQueryHistory(testTenantId);
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('2');
    });

    it('should limit history to 20 entries in fallback storage', async () => {
      await db.init();

      // The cap is applied when entries are added; saveQueryHistory stores the given list as-is
      for (let i = 0; i < 25; i++) {
        await db.addQueryHistoryEntry(testTenantId, {
          id: i.toString(),
          timestamp: new Date(Date.UTC(2024, 0, 1, 0, i)).toISOString(),
          attributes: [],
          queryParams: {},
          resultCount: 10,
        });
      }
      const history = await db.loadQueryHistory(testTenantId);

      expect(history).toHaveLength(20);
      expect(history[0].id).toBe('24');
      expect(history[19].id).toBe('5');
    });

    it('should export history data correctly', async () => {
      await db.init();
      
      const testHistory = [
        {
          id: '1',
          timestamp: '2024-01-01T00:00:00Z',
          attributes: [{ Name: 'Temperature' }],
          queryParams: { mode: 'interpolated' },
          resultCount: 10,
          tenantId: testTenantId,
        },
      ];

      await db.saveQueryHistory(testTenantId, testHistory);
      const exportedData = await db.exportQueryHistory(testTenantId);
      
      expect(exportedData).toHaveLength(1);
      expect(exportedData[0]).toHaveProperty('timestamp');
      expect(exportedData[0]).toHaveProperty('attributes');
      expect(exportedData[0]).toHaveProperty('mode');
      expect(exportedData[0]).toHaveProperty('resultCount');
    });

    it('should import history data correctly', async () => {
      await db.init();
      
      const importedData = [
        {
          timestamp: '2024-01-01T00:00:00Z',
          attributes: [{ Name: 'Temperature' }],
          queryParams: { mode: 'interpolated' },
          resultCount: 10,
        },
      ];

      await db.importQueryHistory(testTenantId, importedData);
      const history = await db.loadQueryHistory(testTenantId);
      
      expect(history).toHaveLength(1);
      expect(history[0].tenantId).toBe(testTenantId);
      expect(history[0].attributes).toEqual([{ Name: 'Temperature' }]);
    });
  });

  describe('Storage Type Detection', () => {
    it('should correctly identify fallback storage type', async () => {
      await db.init();
      expect(db.getStorageType()).toBe('fallback');
    });

    it('should indicate IndexedDB is not available in fallback mode', async () => {
      await db.init();
      expect(db.isIndexedDBAvailable()).toBe(false);
    });
  });
});
