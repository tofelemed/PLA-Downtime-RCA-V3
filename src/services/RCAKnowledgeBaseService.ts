// RCA Knowledge Base Service
// Manages historical RCA knowledge and similarity detection

import { masterDataService, RCA, ProductionEvent } from './MasterDataService';
import { knowledgeBaseApi, KnowledgeBaseEntryDto, CreateKnowledgeBasePayload } from './api/knowledgeBaseApi';
import { 
  RCAKnowledgeEntry, 
  RCASimilarityMatch, 
  RCAAnalysisConfig,
  calculateRCASimilarity,
  extractKeywords 
} from '../types/RCAKnowledgeBase';

class RCAKnowledgeBaseService {
  private static instance: RCAKnowledgeBaseService;

  private constructor() {}

  static getInstance(): RCAKnowledgeBaseService {
    if (!RCAKnowledgeBaseService.instance) {
      RCAKnowledgeBaseService.instance = new RCAKnowledgeBaseService();
    }
    return RCAKnowledgeBaseService.instance;
  }

  private ensureArray<T>(value?: T[] | null): T[] {
    return Array.isArray(value) ? value : value ? [...value] : [];
  }

  private mapDtoToEntry(dto: KnowledgeBaseEntryDto): RCAKnowledgeEntry {
    return {
      id: dto.id,
      rcaId: dto.rcaId,
      title: dto.title,
      description: dto.description ?? '',
      eventType: dto.eventType ?? 'Unknown',
      unitId: dto.unitId ?? '',
      unitName: dto.unitName ?? 'Unknown Unit',
      assetId: dto.assetId ?? undefined,
      assetName: dto.assetName ?? undefined,
      equipmentCategory: dto.equipmentCategory ?? '',
      problemStatement: dto.problemStatement ?? dto.description ?? '',
      symptoms: this.ensureArray(dto.symptoms),
      impactCodes: this.ensureArray(dto.impactCodes),
      oeeCodes: this.ensureArray(dto.oeeCodes),
      rootCause: dto.rootCause ?? '',
      rootCauseCategory: dto.rootCauseCategory ?? 'Other',
      contributingFactors: this.ensureArray(dto.contributingFactors),
      recommendations: this.ensureArray(dto.recommendations).map((rec) => ({
        id: rec.id,
        description: rec.description,
        effectiveness: (rec.effectiveness as any) ?? 'Unknown',
        implementationCost: rec.implementationCost,
        implementationTime: rec.implementationTime,
      })),
      recurrenceCount: dto.recurrenceCount ?? 0,
      effectiveness: dto.effectiveness ?? 0,
      costSaved: dto.costSaved ?? undefined,
      downtimeReduced: dto.downtimeReduced ?? undefined,
      keywords: this.ensureArray(dto.keywords),
      tags: this.ensureArray(dto.tags),
      relatedRcas: this.ensureArray(dto.relatedRcas),
      tenantId: dto.tenantId ?? '',
      organizationId: dto.organizationId ?? undefined,
      createdAt: dto.createdAt ?? new Date().toISOString(),
      updatedAt: dto.updatedAt ?? new Date().toISOString(),
      closedDate: dto.closedDate ?? undefined,
      timesReferenced: dto.timesReferenced ?? 0,
      helpfulVotes: dto.helpfulVotes ?? 0,
    };
  }

  private buildCreatePayload(entry: RCAKnowledgeEntry): CreateKnowledgeBasePayload {
    return {
      tenantId: entry.tenantId,
      organizationId: entry.organizationId,
      rcaId: entry.rcaId,
      title: entry.title,
      description: entry.description,
      problemStatement: entry.problemStatement,
      eventType: entry.eventType,
      unitId: entry.unitId || undefined,
      unitName: entry.unitName,
      assetId: entry.assetId,
      assetName: entry.assetName,
      equipmentCategory: entry.equipmentCategory,
      symptoms: entry.symptoms,
      impactCodes: entry.impactCodes,
      oeeCodes: entry.oeeCodes,
      rootCause: entry.rootCause,
      rootCauseCategory: entry.rootCauseCategory,
      contributingFactors: entry.contributingFactors,
      recommendations: entry.recommendations,
      recurrenceCount: entry.recurrenceCount,
      effectiveness: entry.effectiveness,
      costSaved: entry.costSaved,
      downtimeReduced: entry.downtimeReduced,
      keywords: entry.keywords,
      tags: entry.tags,
      content: entry.description,
      relatedRcas: entry.relatedRcas ?? [],
      author: undefined,
      isPublished: false,
      timesReferenced: entry.timesReferenced,
      helpfulVotes: entry.helpfulVotes,
      closedDate: entry.closedDate,
    };
  }

  private buildUpdatePayload(updates: Partial<RCAKnowledgeEntry>): Partial<CreateKnowledgeBasePayload> {
    const payload: Partial<CreateKnowledgeBasePayload> = {};

    const assign = <K extends keyof Partial<RCAKnowledgeEntry>, V extends keyof CreateKnowledgeBasePayload>(
      sourceKey: K,
      targetKey: V,
    ) => {
      const value = updates[sourceKey];
      if (value !== undefined) {
        (payload as any)[targetKey] = value;
      }
    };

    assign('tenantId', 'tenantId');
    assign('organizationId', 'organizationId');
    assign('title', 'title');
    assign('description', 'description');
    assign('problemStatement', 'problemStatement');
    assign('eventType', 'eventType');
    assign('unitId', 'unitId');
    assign('unitName', 'unitName');
    assign('assetId', 'assetId');
    assign('assetName', 'assetName');
    assign('equipmentCategory', 'equipmentCategory');
    assign('symptoms', 'symptoms');
    assign('impactCodes', 'impactCodes');
    assign('oeeCodes', 'oeeCodes');
    assign('rootCause', 'rootCause');
    assign('rootCauseCategory', 'rootCauseCategory');
    assign('contributingFactors', 'contributingFactors');
    assign('recommendations', 'recommendations');
    assign('recurrenceCount', 'recurrenceCount');
    assign('effectiveness', 'effectiveness');
    assign('costSaved', 'costSaved');
    assign('downtimeReduced', 'downtimeReduced');
    assign('keywords', 'keywords');
    assign('tags', 'tags');
    assign('relatedRcas', 'relatedRcas');
    assign('isPublished', 'isPublished');
    assign('timesReferenced', 'timesReferenced');
    assign('helpfulVotes', 'helpfulVotes');
    assign('closedDate', 'closedDate');

    if (updates.content !== undefined) {
      payload.content = updates.content;
    }

    return payload;
  }

  private async fetchEntries(filters?: {
    tenantId?: string;
    organizationId?: string;
    category?: string;
  }): Promise<RCAKnowledgeEntry[]> {
    const response = await knowledgeBaseApi.getEntries(filters);
    return response.map((dto) => this.mapDtoToEntry(dto));
  }

  private async fetchEntryById(id: string): Promise<RCAKnowledgeEntry | null> {
    const dto = await knowledgeBaseApi.getEntry(id);
    return this.mapDtoToEntry(dto);
  }

  // Create knowledge entry from completed RCA
  async createKnowledgeEntry(rca: RCA, event?: ProductionEvent): Promise<RCAKnowledgeEntry> {
    try {
      // Get related data
      const units = rca.unitId ? await masterDataService.getUnits() : [];
      const unit = units.find(u => u.id === rca.unitId) || null;
      const assets = rca.assetId ? await masterDataService.getAssets({}) : [];
      const asset = assets.find(a => a.id === rca.assetId) || null;
      
      // Extract keywords from description and findings
      const findingsText = Array.isArray(rca.findings) 
        ? rca.findings.join(' ') 
        : (typeof rca.findings === 'string' ? rca.findings : '');
      const textToAnalyze = `${rca.title} ${rca.description} ${rca.rootCause || ''} ${findingsText}`;
      const keywords = extractKeywords(textToAnalyze);
      
      // Determine equipment category from asset or event
      let equipmentCategory = '';
      if (asset) {
        // Simple categorization - in production, you'd have this as an asset property
        const assetName = asset.name.toLowerCase();
        if (assetName.includes('pump')) equipmentCategory = 'Pump';
        else if (assetName.includes('compressor')) equipmentCategory = 'Compressor';
        else if (assetName.includes('furnace') || assetName.includes('heater')) equipmentCategory = 'Furnace';
        else if (assetName.includes('turbine')) equipmentCategory = 'Turbine';
        else if (assetName.includes('separator')) equipmentCategory = 'Separator';
        else if (assetName.includes('exchanger')) equipmentCategory = 'Heat Exchanger';
        else if (assetName.includes('reactor')) equipmentCategory = 'Reactor';
        else if (assetName.includes('vessel') || assetName.includes('tank')) equipmentCategory = 'Vessel';
        else equipmentCategory = 'Other';
      }
      
      // Determine root cause category
      const rootCauseCategory = this.categorizeRootCause(rca.rootCause || '');
      
      const entry: RCAKnowledgeEntry = {
        id: `kb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        rcaId: rca.id,
        title: rca.title,
        description: rca.description || '',
        eventType: event?.eventType || 'Unknown',
        unitId: rca.unitId || '',
        unitName: unit?.name || 'Unknown Unit',
        assetId: rca.assetId,
        assetName: asset?.name,
        equipmentCategory,
        problemStatement: rca.description || '',
        symptoms: this.extractSymptoms(rca.description || ''),
        impactCodes: event?.impactCodeId ? [event.impactCodeId] : [],
        oeeCodes: event?.oeeCodeId ? [event.oeeCodeId] : [],
        rootCause: rca.rootCause || '',
        rootCauseCategory,
        contributingFactors: rca.findings || [],
        recommendations: (rca.recommendations || []).map(r => ({
          id: r.id,
          description: r.description,
          effectiveness: 'Unknown' as const,
        })),
        recurrenceCount: 0,
        effectiveness: 100, // Start at 100%, reduce if issues recur
        keywords,
        tags: rca.tags || [],
        relatedRcas: [],
        tenantId: rca.tenantId || '',
        organizationId: rca.organizationId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        closedDate: rca.status === 'Closed' ? new Date().toISOString() : undefined,
        timesReferenced: 0,
        helpfulVotes: 0,
      };

      const created = await knowledgeBaseApi.createEntry(this.buildCreatePayload(entry));
      return this.mapDtoToEntry(created);
    } catch (error) {
      console.error('Failed to create knowledge entry:', error);
      throw error;
    }
  }

  // Find similar past RCAs
  async findSimilarRCAs(
    currentContext: {
      title?: string;
      description?: string;
      unitId?: string;
      assetId?: string;
      eventType?: string;
      impactCodeId?: string;
      oeeCodeId?: string;
    },
    tenantId: string,
    config: RCAAnalysisConfig
  ): Promise<RCASimilarityMatch[]> {
    try {
      if (!config.knowledgeBaseConfig.enableSimilarityDetection) {
        return [];
      }

      // Get all knowledge entries for tenant
      const allEntries = await this.fetchEntries({ tenantId });
      console.log(`📚 Knowledge base query: tenantId=${tenantId}, found ${allEntries.length} entries`);
      
      if (allEntries.length === 0) {
        console.log('No historical RCAs in knowledge base for this tenant');
        return [];
      }

      // Get asset and unit info for context
      const assets = currentContext.assetId ? await masterDataService.getAssets({}) : [];
      const asset = assets.find(a => a.id === currentContext.assetId) || null;
      const units = currentContext.unitId ? await masterDataService.getUnits() : [];
      const unit = units.find(u => u.id === currentContext.unitId) || null;
      
      // Determine equipment category
      let equipmentCategory = '';
      if (asset) {
        const assetName = asset.name.toLowerCase();
        if (assetName.includes('pump')) equipmentCategory = 'Pump';
        else if (assetName.includes('compressor')) equipmentCategory = 'Compressor';
        else if (assetName.includes('furnace')) equipmentCategory = 'Furnace';
        else if (assetName.includes('turbine')) equipmentCategory = 'Turbine';
        else if (assetName.includes('separator')) equipmentCategory = 'Separator';
        else if (assetName.includes('exchanger')) equipmentCategory = 'Heat Exchanger';
        else if (assetName.includes('reactor')) equipmentCategory = 'Reactor';
        else if (assetName.includes('vessel') || assetName.includes('tank')) equipmentCategory = 'Vessel';
      }
      
      // Extract keywords and symptoms from current context
      const textToAnalyze = `${currentContext.title || ''} ${currentContext.description || ''}`;
      const keywords = extractKeywords(textToAnalyze);
      const symptoms = this.extractSymptoms(currentContext.description || '');
      
      // Build search context
      const searchContext: Partial<RCAKnowledgeEntry> = {
        title: currentContext.title || '', // Include title for title similarity matching!
        description: currentContext.description || '',
        unitId: currentContext.unitId,
        assetId: currentContext.assetId,
        eventType: currentContext.eventType,
        equipmentCategory,
        symptoms,
        impactCodes: currentContext.impactCodeId ? [currentContext.impactCodeId] : [],
        oeeCodes: currentContext.oeeCodeId ? [currentContext.oeeCodeId] : [],
        keywords,
      };

      // Calculate similarity for each entry with dynamic threshold
      const matches: RCASimilarityMatch[] = [];
      
      // Use lower threshold if we only have title/description (no event context)
      const hasEventContext = currentContext.unitId || currentContext.assetId || currentContext.eventType;
      const adjustedConfig = { ...config };
      if (!hasEventContext) {
        adjustedConfig.knowledgeBaseConfig = {
          ...config.knowledgeBaseConfig,
          similarityThreshold: Math.min(20, config.knowledgeBaseConfig.similarityThreshold), // Lower to 20 for title-only
        };
        console.log('📝 Using relaxed threshold (20) for title-only search');
      }
      
      for (const entry of allEntries) {
        const match = calculateRCASimilarity(searchContext, entry, adjustedConfig);
        if (match) {
          matches.push(match);
        }
      }

      // Sort by similarity score (highest first)
      matches.sort((a, b) => b.similarityScore - a.similarityScore);

      // Return top N matches
      return matches.slice(0, adjustedConfig.knowledgeBaseConfig.maxSuggestions);
    } catch (error) {
      console.error('Failed to find similar RCAs:', error);
      return [];
    }
  }

  // Get knowledge entry by RCA ID
  async getByRCAId(rcaId: string): Promise<RCAKnowledgeEntry | null> {
    try {
      const entries = await this.fetchEntries();
      return entries.find(e => e.rcaId === rcaId) || null;
    } catch (error) {
      console.error('Failed to get knowledge entry:', error);
      return null;
    }
  }

  // Update knowledge entry (e.g., when RCA is modified)
  async updateKnowledgeEntry(id: string, updates: Partial<RCAKnowledgeEntry>): Promise<RCAKnowledgeEntry> {
    const updated = await knowledgeBaseApi.updateEntry(id, this.buildUpdatePayload(updates));
    return this.mapDtoToEntry(updated);
  }

  // Track when a knowledge entry is referenced
  async incrementReferenceCount(id: string): Promise<void> {
    const entry = await this.fetchEntryById(id);
    if (!entry) return;
    await knowledgeBaseApi.updateEntry(id, {
      timesReferenced: (entry.timesReferenced ?? 0) + 1,
    });
  }

  // Vote helpful/not helpful
  async voteHelpful(id: string, helpful: boolean): Promise<void> {
    const entry = await this.fetchEntryById(id);
    if (!entry) return;
    await knowledgeBaseApi.updateEntry(id, {
      helpfulVotes: (entry.helpfulVotes ?? 0) + (helpful ? 1 : -1),
    });
  }

  // Track recurrence of similar issue
  async trackRecurrence(knowledgeEntryId: string): Promise<void> {
    const entry = await this.fetchEntryById(knowledgeEntryId);
    if (!entry) return;

    const newRecurrenceCount = entry.recurrenceCount + 1;
    const effectivenessReduction = Math.min(20, newRecurrenceCount * 5);
    const newEffectiveness = Math.max(0, entry.effectiveness - effectivenessReduction);

    await knowledgeBaseApi.updateEntry(knowledgeEntryId, {
      recurrenceCount: newRecurrenceCount,
      effectiveness: newEffectiveness,
    });
  }

  // Search knowledge base
  async searchKnowledgeBase(query: string, tenantId: string): Promise<RCAKnowledgeEntry[]> {
    try {
      const allEntries = await this.fetchEntries({ tenantId });
      
      if (!query || query.trim() === '') {
        return allEntries;
      }

      const lowerQuery = query.toLowerCase();
      
      // Search in multiple fields
      return allEntries.filter(entry => 
        entry.title.toLowerCase().includes(lowerQuery) ||
        entry.description.toLowerCase().includes(lowerQuery) ||
        entry.rootCause.toLowerCase().includes(lowerQuery) ||
        entry.keywords.some(k => k.toLowerCase().includes(lowerQuery)) ||
        entry.equipmentCategory?.toLowerCase().includes(lowerQuery) ||
        entry.unitName.toLowerCase().includes(lowerQuery)
      );
    } catch (error) {
      console.error('Failed to search knowledge base:', error);
      return [];
    }
  }

  // Calculate quality score for an RCA (0-100)
  calculateQualityScore(entry: RCAKnowledgeEntry, rca?: any): number {
    let score = 0;
    
    // 1. Effectiveness (40 points max)
    // No recurrence = best
    if (entry.recurrenceCount === 0) {
      score += 40;
    } else if (entry.recurrenceCount === 1) {
      score += 30;
    } else if (entry.recurrenceCount === 2) {
      score += 20;
    } else {
      score += 10;
    }
    
    // 2. Usage/Community Validation (20 points max)
    // Times referenced (max 20 points)
    score += Math.min(20, entry.timesReferenced * 2);
    
    // 3. Community Votes (15 points max)
    score += Math.min(15, entry.helpfulVotes * 3);
    
    // 4. Completeness (15 points max)
    if (entry.rootCause && entry.rootCause.trim().length > 0) score += 5;
    if (entry.recommendations && entry.recommendations.length >= 3) score += 5;
    if (rca?.evidence && rca.evidence.length >= 3) score += 5;
    
    // 5. Methodology (10 points max)
    // These would need to check if 5-Why and Fishbone analyses exist
    // For now, give points if we have detailed data
    if (entry.contributingFactors && entry.contributingFactors.length >= 2) score += 5;
    if (entry.symptoms && entry.symptoms.length >= 2) score += 5;
    
    return Math.min(100, score);
  }

  // Get star rating (1-5) based on quality score
  getStarRating(qualityScore: number): number {
    if (qualityScore >= 90) return 5;
    if (qualityScore >= 75) return 4;
    if (qualityScore >= 60) return 3;
    if (qualityScore >= 40) return 2;
    return 1;
  }

  // Get top performing RCAs (by effectiveness)
  async getTopRCAs(tenantId: string, limit: number = 10): Promise<RCAKnowledgeEntry[]> {
    try {
      const allEntries = await this.fetchEntries({ tenantId });
      return allEntries
        .sort((a, b) => b.effectiveness - a.effectiveness)
        .slice(0, limit);
    } catch (error) {
      console.error('Failed to get top RCAs:', error);
      return [];
    }
  }

  // Get Best of Best RCAs (highest quality scores)
  async getBestOfBest(tenantId: string, limit: number = 5): Promise<Array<RCAKnowledgeEntry & { qualityScore: number }>> {
    try {
      const allEntries = await this.fetchEntries({ tenantId });
      
      // Calculate quality score for each
      const withScores = allEntries.map(entry => ({
        ...entry,
        qualityScore: this.calculateQualityScore(entry)
      }));
      
      // Filter for high-quality RCAs
      const bestRCAs = withScores.filter(entry => {
        return entry.qualityScore >= 50 && // Minimum quality threshold (lowered to 50 for testing)
               entry.effectiveness >= 80;    // Minimum effectiveness
      });
      
      // Sort by quality score
      bestRCAs.sort((a, b) => b.qualityScore - a.qualityScore);
      
      return bestRCAs.slice(0, limit);
    } catch (error) {
      console.error('Failed to get best of best RCAs:', error);
      return [];
    }
  }

  // Get quality-ranked RCAs (all, sorted by quality)
  async getQualityRankedRCAs(tenantId: string): Promise<Array<RCAKnowledgeEntry & { qualityScore: number; rank: number }>> {
    try {
      const allEntries = await this.fetchEntries({ tenantId });
      
      // Calculate quality score for each
      const withScores = allEntries.map(entry => ({
        ...entry,
        qualityScore: this.calculateQualityScore(entry),
        rank: 0
      }));
      
      // Sort by quality score (descending)
      withScores.sort((a, b) => b.qualityScore - a.qualityScore);
      
      // Assign ranks
      withScores.forEach((entry, index) => {
        entry.rank = index + 1;
      });
      
      return withScores;
    } catch (error) {
      console.error('Failed to get quality-ranked RCAs:', error);
      return [];
    }
  }

  // Get most referenced RCAs
  async getMostReferencedRCAs(tenantId: string, limit: number = 10): Promise<RCAKnowledgeEntry[]> {
    try {
      const allEntries = await this.fetchEntries({ tenantId });
      return allEntries
        .sort((a, b) => b.timesReferenced - a.timesReferenced)
        .slice(0, limit);
    } catch (error) {
      console.error('Failed to get most referenced RCAs:', error);
      return [];
    }
  }

  // Get RCAs by equipment category
  async getByEquipmentCategory(category: string, tenantId: string): Promise<RCAKnowledgeEntry[]> {
    try {
      const allEntries = await this.fetchEntries({ tenantId });
      return allEntries.filter(e => e.equipmentCategory === category);
    } catch (error) {
      console.error('Failed to get RCAs by category:', error);
      return [];
    }
  }

  // Helper: Categorize root cause
  private categorizeRootCause(rootCause: string): string {
    const lower = rootCause.toLowerCase();
    
    if (lower.includes('fail') || lower.includes('break') || lower.includes('wear') || lower.includes('corros')) {
      return 'Equipment Failure';
    } else if (lower.includes('procedure') || lower.includes('process') || lower.includes('method')) {
      return 'Process Issue';
    } else if (lower.includes('operator') || lower.includes('human') || lower.includes('training') || lower.includes('error')) {
      return 'Human Error';
    } else if (lower.includes('design') || lower.includes('specification')) {
      return 'Design Issue';
    } else if (lower.includes('maintenance') || lower.includes('repair')) {
      return 'Maintenance Issue';
    } else if (lower.includes('material') || lower.includes('quality') || lower.includes('contamination')) {
      return 'Material/Quality';
    } else if (lower.includes('weather') || lower.includes('temperature') || lower.includes('environment')) {
      return 'Environmental';
    } else if (lower.includes('management') || lower.includes('resource') || lower.includes('planning')) {
      return 'Management/Planning';
    } else {
      return 'Other';
    }
  }

  // Helper: Extract symptoms from description
  private extractSymptoms(description: string): string[] {
    const symptoms: string[] = [];
    const lower = description.toLowerCase();
    
    // Common symptoms in oil & gas
    const symptomKeywords = [
      'vibration', 'leak', 'noise', 'overheat', 'pressure drop', 'pressure spike',
      'temperature high', 'temperature low', 'flow loss', 'shutdown', 'trip',
      'alarm', 'failure', 'crack', 'wear', 'corrosion', 'fouling', 'plugging',
      'cavitation', 'surge', 'instability', 'fluctuation', 'drift'
    ];
    
    for (const keyword of symptomKeywords) {
      if (lower.includes(keyword)) {
        symptoms.push(keyword);
      }
    }
    
    return symptoms;
  }

  // Delete knowledge entry
  async deleteKnowledgeEntry(id: string): Promise<void> {
    await knowledgeBaseApi.deleteEntry(id);
  }

  // Get all knowledge entries for tenant
  async getAllKnowledgeEntries(tenantId: string): Promise<RCAKnowledgeEntry[]> {
    return this.fetchEntries({ tenantId });
  }

  // Refresh knowledge base entry from current RCA data
  async refreshKnowledgeEntry(rcaId: string): Promise<void> {
    try {
      // Get the knowledge entry for this RCA
      const entries = await this.fetchEntries();
      const entry = entries.find(e => e.rcaId === rcaId);
      
      if (!entry) {
        console.warn('No knowledge entry found for RCA:', rcaId);
        return;
      }

      // Get the current RCA data
      const allRCAs = await masterDataService.getRCAs({});
      const rca = allRCAs.find(r => r.id === rcaId);
      
      if (!rca) {
        console.warn('RCA not found:', rcaId);
        return;
      }

      // Extract updated data
      const findingsText = Array.isArray(rca.findings) 
        ? rca.findings.join(' ') 
        : (typeof rca.findings === 'string' ? rca.findings : '');
      const textToAnalyze = `${rca.title} ${rca.description} ${rca.rootCause || ''} ${findingsText}`;
      const keywords = extractKeywords(textToAnalyze);
      
      // Update the knowledge entry with ALL current RCA data
      await this.updateKnowledgeEntry(entry.id, {
        title: rca.title,
        description: rca.description || '',
        rootCause: rca.rootCause || '',
        contributingFactors: rca.findings || entry.contributingFactors || [],
        recommendations: (rca.recommendations || []).map(r => ({
          id: r.id,
          description: r.description || r.title,
          effectiveness: 'Unknown' as const,
        })),
        keywords,
        symptoms: this.extractSymptoms(rca.description || ''),
      });

      console.log(`✅ Knowledge entry refreshed for RCA: ${rca.title} (${rca.recommendations?.length || 0} recs, evidence count tracked in RCA)`);
    } catch (error) {
      console.error('Failed to refresh knowledge entry:', error);
    }
  }

  // Refresh all knowledge entries
  async refreshAllKnowledgeEntries(tenantId: string): Promise<void> {
    try {
      const entries = await this.fetchEntries({ tenantId });
      
      for (const entry of entries) {
        await this.refreshKnowledgeEntry(entry.rcaId);
      }
      
      console.log(`✅ Refreshed ${entries.length} knowledge entries`);
    } catch (error) {
      console.error('Failed to refresh knowledge entries:', error);
    }
  }

  // Get statistics
  async getKnowledgeBaseStats(tenantId: string): Promise<{
    totalEntries: number;
    byEquipmentCategory: { [category: string]: number };
    byRootCauseCategory: { [category: string]: number };
    averageEffectiveness: number;
    totalRecurrences: number;
  }> {
    try {
      const entries = await this.fetchEntries({ tenantId });
      
      const stats = {
        totalEntries: entries.length,
        byEquipmentCategory: {} as { [category: string]: number },
        byRootCauseCategory: {} as { [category: string]: number },
        averageEffectiveness: 0,
        totalRecurrences: 0,
      };

      entries.forEach(entry => {
        // Count by equipment category
        if (entry.equipmentCategory) {
          stats.byEquipmentCategory[entry.equipmentCategory] = 
            (stats.byEquipmentCategory[entry.equipmentCategory] || 0) + 1;
        }
        
        // Count by root cause category
        stats.byRootCauseCategory[entry.rootCauseCategory] = 
          (stats.byRootCauseCategory[entry.rootCauseCategory] || 0) + 1;
        
        // Sum effectiveness
        stats.averageEffectiveness += entry.effectiveness;
        
        // Sum recurrences
        stats.totalRecurrences += entry.recurrenceCount;
      });

      if (entries.length > 0) {
        stats.averageEffectiveness = Math.round(stats.averageEffectiveness / entries.length);
      }

      return stats;
    } catch (error) {
      console.error('Failed to get stats:', error);
      return {
        totalEntries: 0,
        byEquipmentCategory: {},
        byRootCauseCategory: {},
        averageEffectiveness: 0,
        totalRecurrences: 0,
      };
    }
  }
}

export const rcaKnowledgeBaseService = RCAKnowledgeBaseService.getInstance();

