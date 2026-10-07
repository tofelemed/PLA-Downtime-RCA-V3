import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryHistory } from './historian-history.entity';
import { CreateQueryHistoryDto } from './dto/create-query-history.dto';

@Injectable()
export class HistorianHistoryService {
  constructor(
    @InjectRepository(QueryHistory)
    private queryHistoryRepository: Repository<QueryHistory>,
  ) {}

  // 1. Save query history (replaces all for tenant)
  async saveQueryHistory(tenantId: string, history: CreateQueryHistoryDto[]): Promise<void> {
    // Clear existing history for this tenant
    await this.queryHistoryRepository.delete({ tenantId });
    
    // Add new history entries
    const entities = history.map(entry => 
      this.queryHistoryRepository.create({ ...entry, tenantId })
    );
    
    if (entities.length > 0) {
      await this.queryHistoryRepository.save(entities);
    }
  }

  // 2. Load query history for tenant (sorted desc by timestamp)
  async loadQueryHistory(tenantId: string): Promise<QueryHistory[]> {
    return await this.queryHistoryRepository.find({
      where: { tenantId },
      order: { timestamp: 'DESC' }
    });
  }

  // 3. Add single query history entry (auto-limit to 20)
  async addQueryHistoryEntry(tenantId: string, entry: CreateQueryHistoryDto): Promise<QueryHistory> {
    const newEntry = this.queryHistoryRepository.create({ ...entry, tenantId });
    await this.queryHistoryRepository.save(newEntry);

    // Keep only last 20 entries
    const allEntries = await this.queryHistoryRepository.find({
      where: { tenantId },
      order: { timestamp: 'DESC' }
    });

    if (allEntries.length > 20) {
      const entriesToDelete = allEntries.slice(20);
      await this.queryHistoryRepository.remove(entriesToDelete);
    }

    return newEntry;
  }

  // 4. Remove query history entry by ID
  async removeQueryHistoryEntry(id: string): Promise<void> {
    const result = await this.queryHistoryRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Query History with ID ${id} not found`);
    }
  }

  // 5. Clear all query history for tenant
  async clearQueryHistory(tenantId: string): Promise<void> {
    await this.queryHistoryRepository.delete({ tenantId });
  }

  // 6. Export query history (formatted)
  async exportQueryHistory(tenantId: string): Promise<any[]> {
    const history = await this.loadQueryHistory(tenantId);
    return history.map(entry => {
      const attrs = JSON.parse(entry.attributes || '[]');
      const params = JSON.parse(entry.queryParams || '{}');
      return {
        timestamp: entry.timestamp,
        attributes: attrs.length,
        mode: params.mode || 'unknown',
        startTime: params.start || '',
        endTime: params.end || '',
        resultCount: entry.resultCount,
        attributeNames: attrs.map((attr: any) => attr.Name || attr.name).join(', ')
      };
    });
  }

  // 7. Import query history
  async importQueryHistory(tenantId: string, importedData: any[]): Promise<void> {
    const transformedHistory = importedData
      .filter(entry => entry.timestamp && entry.attributes && entry.queryParams)
      .map(entry => ({
        id: entry.id || undefined,
        timestamp: entry.timestamp,
        attributes: typeof entry.attributes === 'string' ? entry.attributes : JSON.stringify(entry.attributes),
        queryParams: typeof entry.queryParams === 'string' ? entry.queryParams : JSON.stringify(entry.queryParams),
        resultCount: entry.resultCount || 0,
        tenantId
      }));

    if (transformedHistory.length > 0) {
      const existingHistory = await this.loadQueryHistory(tenantId);
      const entities = transformedHistory.map(entry => this.queryHistoryRepository.create(entry));
      await this.queryHistoryRepository.save(entities);

      // Keep only last 20 entries
      const allEntries = await this.loadQueryHistory(tenantId);
      if (allEntries.length > 20) {
        const entriesToDelete = allEntries.slice(20);
        await this.queryHistoryRepository.remove(entriesToDelete);
      }
    }
  }

  // 8. Force database recreation (development only)
  async forceDatabaseRecreation(): Promise<void> {
    // Clear all history
    await this.queryHistoryRepository.clear();
  }
}

