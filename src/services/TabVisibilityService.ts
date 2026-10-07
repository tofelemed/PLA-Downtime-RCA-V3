/**
 * Service for managing tab visibility settings in IndexedDB
 */

const DB_NAME = 'ProActSettings';
const DB_VERSION = 1;
const STORE_NAME = 'tabVisibility';

export interface TabVisibilitySettings {
  userId: string;
  tenantId: string;
  visibleTabs: {
    ProductionLoss: boolean;
    IOW: boolean;
    SOL: boolean;
    APM: boolean;
    FailureWO: boolean;
    ProductionOutput: boolean;
  };
  updatedAt: string;
}

export const defaultTabVisibility = {
  ProductionLoss: true,
  IOW: true,
  SOL: true,
  APM: true,
  FailureWO: true,
  ProductionOutput: true,
};

class TabVisibilityService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('tenantId', 'tenantId', { unique: false });
        }
      };
    });

    return this.dbPromise;
  }

  private getKey(userId: string, tenantId: string): string {
    return `${userId}_${tenantId}`;
  }

  async getVisibilitySettings(userId: string, tenantId: string): Promise<TabVisibilitySettings> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const key = this.getKey(userId, tenantId);

      return new Promise((resolve, reject) => {
        const request = store.get(key);

        request.onsuccess = () => {
          if (request.result) {
            resolve(request.result);
          } else {
            // Return default settings if none exist
            resolve({
              userId,
              tenantId,
              visibleTabs: { ...defaultTabVisibility },
              updatedAt: new Date().toISOString(),
            });
          }
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error getting tab visibility settings:', error);
      // Return defaults on error
      return {
        userId,
        tenantId,
        visibleTabs: { ...defaultTabVisibility },
        updatedAt: new Date().toISOString(),
      };
    }
  }

  async saveVisibilitySettings(settings: TabVisibilitySettings): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const key = this.getKey(settings.userId, settings.tenantId);

      const dataToSave = {
        id: key,
        ...settings,
        updatedAt: new Date().toISOString(),
      };

      return new Promise((resolve, reject) => {
        const request = store.put(dataToSave);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error saving tab visibility settings:', error);
      throw error;
    }
  }

  async toggleTab(
    userId: string,
    tenantId: string,
    tabName: keyof typeof defaultTabVisibility,
    visible: boolean
  ): Promise<void> {
    const settings = await this.getVisibilitySettings(userId, tenantId);
    settings.visibleTabs[tabName] = visible;
    await this.saveVisibilitySettings(settings);
  }

  async resetToDefaults(userId: string, tenantId: string): Promise<void> {
    const settings: TabVisibilitySettings = {
      userId,
      tenantId,
      visibleTabs: { ...defaultTabVisibility },
      updatedAt: new Date().toISOString(),
    };
    await this.saveVisibilitySettings(settings);
  }
}

export const tabVisibilityService = new TabVisibilityService();

