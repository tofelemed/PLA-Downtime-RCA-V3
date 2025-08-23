// Data Transform Engine - Comprehensive data transformation capabilities
// This can be easily replaced with backend services later

export interface TransformSchema {
  input: Record<string, any>;
  output: Record<string, any>;
  validation?: Record<string, any>;
}

export interface TransformResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    transformTime: number;
    appliedTransforms: string[];
    validationErrors?: string[];
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: Record<string, any>;
}

export interface TransformConfig {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  config: Record<string, any>;
  order: number;
  inputSchema?: TransformSchema;
  outputSchema?: TransformSchema;
  validationRules?: ValidationRule[];
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'type' | 'range' | 'pattern' | 'custom';
  value: any;
  message: string;
  severity: 'error' | 'warning';
}

export abstract class BaseDataTransform {
  protected config: TransformConfig;
  protected schema: TransformSchema;

  constructor(config: TransformConfig) {
    this.config = config;
    this.schema = config.inputSchema || { input: {}, output: {} };
  }

  abstract transform(input: any): Promise<any>;
  
  abstract getSchema(): TransformSchema;
  
  abstract validate(data: any): Promise<ValidationResult>;

  getConfig(): TransformConfig {
    return { ...this.config };
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getOrder(): number {
    return this.config.order;
  }

  protected validateInput(data: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.config.validationRules) {
      return { valid: true, errors, warnings };
    }

    for (const rule of this.config.validationRules) {
      const fieldValue = this.getNestedValue(data, rule.field);
      
      switch (rule.type) {
        case 'required':
          if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
            if (rule.severity === 'error') {
              errors.push(rule.message);
            } else {
              warnings.push(rule.message);
            }
          }
          break;
          
        case 'type':
          if (fieldValue !== undefined && typeof fieldValue !== rule.value) {
            if (rule.severity === 'error') {
              errors.push(rule.message);
            } else {
              warnings.push(rule.message);
            }
          }
          break;
          
        case 'range':
          if (typeof fieldValue === 'number') {
            const [min, max] = rule.value;
            if (fieldValue < min || fieldValue > max) {
              if (rule.severity === 'error') {
                errors.push(rule.message);
              } else {
                warnings.push(rule.message);
              }
            }
          }
          break;
          
        case 'pattern':
          if (typeof fieldValue === 'string' && !new RegExp(rule.value).test(fieldValue)) {
            if (rule.severity === 'error') {
              errors.push(rule.message);
            } else {
              warnings.push(rule.message);
            }
          }
          break;
          
        case 'custom':
          if (typeof rule.value === 'function' && !rule.value(fieldValue, data)) {
            if (rule.severity === 'error') {
              errors.push(rule.message);
            } else {
              warnings.push(rule.message);
            }
          }
          break;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  protected getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
}

// Field Rename Transform
export class FieldRenameTransform extends BaseDataTransform {
  constructor(config: TransformConfig) {
    super(config);
  }

  async transform(input: any): Promise<any> {
    const { fieldMappings } = this.config.config;
    
    if (!fieldMappings || typeof input !== 'object') {
      return input;
    }

    const result = { ...input };
    
    for (const [oldField, newField] of Object.entries(fieldMappings)) {
      if (result[oldField as string] !== undefined) {
        result[newField as string] = result[oldField as string];
        delete result[oldField as string];
      }
    }

    return result;
  }

  getSchema(): TransformSchema {
    return {
      input: { ...this.schema.input },
      output: { ...this.schema.output }
    };
  }

  async validate(data: any): Promise<ValidationResult> {
    return this.validateInput(data);
  }
}

// Field Calculation Transform
export class FieldCalculationTransform extends BaseDataTransform {
  constructor(config: TransformConfig) {
    super(config);
  }

  async transform(input: any): Promise<any> {
    const { calculations } = this.config.config;
    
    if (!calculations || typeof input !== 'object') {
      return input;
    }

    const result = { ...input };
    
    for (const calc of calculations) {
      try {
        const { targetField, expression, sourceFields } = calc;
        const context = this.buildCalculationContext(input, sourceFields);
        result[targetField] = this.evaluateExpression(expression, context);
      } catch (error) {
        console.warn(`Calculation transform failed for ${calc.targetField}:`, error);
      }
    }

    return result;
  }

  private buildCalculationContext(data: any, sourceFields: string[]): Record<string, any> {
    const context: Record<string, any> = {};
    
    for (const field of sourceFields) {
      context[field] = this.getNestedValue(data, field);
    }
    
    // Add common math functions
    context.Math = Math;
    context.Date = Date;
    
    return context;
  }

  private evaluateExpression(expression: string, context: Record<string, any>): any {
    // Create a safe evaluation context
    const contextKeys = Object.keys(context);
    const contextValues = Object.values(context);
    const safeEval = new Function(...contextKeys, `return ${expression}`);
    return safeEval(...contextValues);
  }

  getSchema(): TransformSchema {
    return {
      input: { ...this.schema.input },
      output: { ...this.schema.output }
    };
  }

  async validate(data: any): Promise<ValidationResult> {
    return this.validateInput(data);
  }
}

// Field Format Transform
export class FieldFormatTransform extends BaseDataTransform {
  constructor(config: TransformConfig) {
    super(config);
  }

  async transform(input: any): Promise<any> {
    const { formats } = this.config.config;
    
    if (!formats || typeof input !== 'object') {
      return input;
    }

    const result = { ...input };
    
    for (const format of formats) {
      const { field, type, options } = format;
      const fieldValue = this.getNestedValue(result, field);
      
      if (fieldValue !== undefined) {
        try {
          result[field] = this.applyFormat(fieldValue, type, options);
        } catch (error) {
          console.warn(`Format transform failed for field ${field}:`, error);
        }
      }
    }

    return result;
  }

  private applyFormat(value: any, type: string, options: any): any {
    switch (type) {
      case 'uppercase':
        return String(value).toUpperCase();
        
      case 'lowercase':
        return String(value).toLowerCase();
        
      case 'capitalize':
        return String(value).replace(/\b\w/g, l => l.toUpperCase());
        
      case 'number':
        return Number(value);
        
      case 'integer':
        return Math.floor(Number(value));
        
      case 'date':
        return new Date(value);
        
      case 'date_string':
        const date = new Date(value);
        return date.toISOString();
        
      case 'decimal':
        return Number(value).toFixed(options?.decimals || 2);
        
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: options?.currency || 'USD'
        }).format(Number(value));
        
      case 'percentage':
        return `${(Number(value) * 100).toFixed(options?.decimals || 2)}%`;
        
      case 'boolean':
        if (typeof value === 'string') {
          return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
        }
        return Boolean(value);
        
      case 'json':
        return JSON.stringify(value);
        
      case 'truncate':
        const str = String(value);
        return str.length > options?.maxLength ? str.substring(0, options.maxLength) + '...' : str;
        
      case 'pad':
        const strValue = String(value);
        const targetLength = options?.length || 10;
        const padChar = options?.char || '0';
        return strValue.padStart(targetLength, padChar);
        
      default:
        return value;
    }
  }

  getSchema(): TransformSchema {
    return {
      input: { ...this.schema.input },
      output: { ...this.schema.output }
    };
  }

  async validate(data: any): Promise<ValidationResult> {
    return this.validateInput(data);
  }
}

// Field Filter Transform
export class FieldFilterTransform extends BaseDataTransform {
  constructor(config: TransformConfig) {
    super(config);
  }

  async transform(input: any): Promise<any> {
    const { filters } = this.config.config;
    
    if (!filters || typeof input !== 'object') {
      return input;
    }

    const result = { ...input };
    
    for (const filter of filters) {
      const { field, condition, operator, value, action } = filter;
      const fieldValue = this.getNestedValue(result, field);
      
      if (this.evaluateCondition(fieldValue, condition, operator, value)) {
        switch (action) {
          case 'remove':
            delete result[field];
            break;
          case 'set_null':
            result[field] = null;
            break;
          case 'set_default':
            result[field] = filter.defaultValue;
            break;
          case 'transform':
            result[field] = filter.transformValue;
            break;
        }
      }
    }

    return result;
  }

  private evaluateCondition(fieldValue: any, condition: string, operator: string, value: any): boolean {
    switch (condition) {
      case 'equals':
        return fieldValue === value;
      case 'not_equals':
        return fieldValue !== value;
      case 'greater_than':
        return fieldValue > value;
      case 'less_than':
        return fieldValue < value;
      case 'greater_equal':
        return fieldValue >= value;
      case 'less_equal':
        return fieldValue <= value;
      case 'contains':
        return String(fieldValue).includes(String(value));
      case 'not_contains':
        return !String(fieldValue).includes(String(value));
      case 'starts_with':
        return String(fieldValue).startsWith(String(value));
      case 'ends_with':
        return String(fieldValue).endsWith(String(value));
      case 'regex':
        return new RegExp(value).test(String(fieldValue));
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);
      case 'not_in':
        return Array.isArray(value) && !value.includes(fieldValue);
      case 'is_null':
        return fieldValue === null || fieldValue === undefined;
      case 'is_not_null':
        return fieldValue !== null && fieldValue !== undefined;
      case 'is_empty':
        return fieldValue === '' || fieldValue === null || fieldValue === undefined;
      case 'is_not_empty':
        return fieldValue !== '' && fieldValue !== null && fieldValue !== undefined;
      default:
        return false;
    }
  }

  getSchema(): TransformSchema {
    return {
      input: { ...this.schema.input },
      output: { ...this.schema.output }
    };
  }

  async validate(data: any): Promise<ValidationResult> {
    return this.validateInput(data);
  }
}

// Data Aggregation Transform
export class DataAggregationTransform extends BaseDataTransform {
  private aggregationBuffer: Map<string, any[]> = new Map();
  private lastFlush: number = Date.now();

  constructor(config: TransformConfig) {
    super(config);
    this.startFlushTimer();
  }

  async transform(input: any): Promise<any> {
    const { aggregations, groupBy, flushInterval } = this.config.config;
    
    if (!aggregations || typeof input !== 'object') {
      return input;
    }

    // Add to buffer
    const groupKey = this.getGroupKey(input, groupBy);
    if (!this.aggregationBuffer.has(groupKey)) {
      this.aggregationBuffer.set(groupKey, []);
    }
    
    this.aggregationBuffer.get(groupKey)!.push(input);

    // Check if we should flush
    const now = Date.now();
    if (now - this.lastFlush >= (flushInterval || 60000)) { // Default 1 minute
      return this.flushAggregations();
    }

    // Return the input unchanged for now
    return input;
  }

  private getGroupKey(data: any, groupBy: string[]): string {
    if (!groupBy || groupBy.length === 0) {
      return 'default';
    }

    return groupBy
      .map(field => this.getNestedValue(data, field))
      .filter(value => value !== undefined)
      .join('|');
  }

  private flushAggregations(): any {
    const results: any[] = [];

    for (const [groupKey, records] of this.aggregationBuffer.entries()) {
      if (records.length === 0) continue;

      const aggregated = this.aggregateRecords(records);
      results.push(aggregated);
    }

    // Clear buffer
    this.aggregationBuffer.clear();
    this.lastFlush = Date.now();

    return results;
  }

  private aggregateRecords(records: any[]): any {
    const { aggregations, groupBy } = this.config.config;
    const result: any = {};

    // Add group fields
    if (groupBy) {
      for (const field of groupBy) {
        result[field] = this.getNestedValue(records[0], field);
      }
    }

    // Add aggregation fields
    for (const agg of aggregations) {
      const { targetField, sourceField, operation, options } = agg;
      const values = records
        .map(record => this.getNestedValue(record, sourceField))
        .filter(value => value !== undefined && value !== null);

      if (values.length > 0) {
        result[targetField] = this.calculateAggregation(values, operation, options);
      }
    }

    // Add metadata
    result._aggregation = {
      recordCount: records.length,
      timestamp: new Date(),
      groupKey: this.getGroupKey(records[0], groupBy || [])
    };

    return result;
  }

  private calculateAggregation(values: any[], operation: string, options: any): any {
    switch (operation) {
      case 'sum':
        return values.reduce((sum, val) => sum + Number(val), 0);
        
      case 'average':
        return values.reduce((sum, val) => sum + Number(val), 0) / values.length;
        
      case 'count':
        return values.length;
        
      case 'min':
        return Math.min(...values.map(v => Number(v)));
        
      case 'max':
        return Math.max(...values.map(v => Number(v)));
        
      case 'median':
        const sorted = values.map(v => Number(v)).sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
        
      case 'mode':
        const frequency: Record<number, number> = {};
        values.forEach(val => {
          const num = Number(val);
          frequency[num] = (frequency[num] || 0) + 1;
        });
        return Object.entries(frequency).reduce((a, b) => frequency[a[0]] > frequency[b[0]] ? a : b)[0];
        
      case 'variance':
        const avg = values.reduce((sum, val) => sum + Number(val), 0) / values.length;
        return values.reduce((sum, val) => sum + Math.pow(Number(val) - avg, 2), 0) / values.length;
        
      case 'std_dev':
        const variance = this.calculateAggregation(values, 'variance', {});
        return Math.sqrt(variance);
        
      case 'first':
        return values[0];
        
      case 'last':
        return values[values.length - 1];
        
      case 'concatenate':
        return values.join(options?.separator || ', ');
        
      default:
        return values[0];
    }
  }

  private startFlushTimer(): void {
    const { flushInterval } = this.config.config;
    if (flushInterval) {
      setInterval(() => {
        this.flushAggregations();
      }, flushInterval);
    }
  }

  getSchema(): TransformSchema {
    return {
      input: { ...this.schema.input },
      output: { ...this.schema.output }
    };
  }

  async validate(data: any): Promise<ValidationResult> {
    return this.validateInput(data);
  }
}

// Data Enrichment Transform
export class DataEnrichmentTransform extends BaseDataTransform {
  private enrichmentCache: Map<string, any> = new Map();
  private cacheExpiry: Map<string, number> = new Map();

  constructor(config: TransformConfig) {
    super(config);
  }

  async transform(input: any): Promise<any> {
    const { enrichments, cacheTimeout } = this.config.config;
    
    if (!enrichments || typeof input !== 'object') {
      return input;
    }

    const result = { ...input };
    
    for (const enrichment of enrichments) {
      const { targetField, sourceField, enrichmentType, config: enrichmentConfig } = enrichment;
      
      try {
        const enrichedValue = await this.getEnrichedValue(
          input, 
          sourceField, 
          enrichmentType, 
          enrichmentConfig
        );
        
        if (enrichedValue !== undefined) {
          result[targetField] = enrichedValue;
        }
      } catch (error) {
        console.warn(`Enrichment transform failed for ${targetField}:`, error);
      }
    }

    return result;
  }

  private async getEnrichedValue(
    data: any, 
    sourceField: string, 
    enrichmentType: string, 
    config: any
  ): Promise<any> {
    const sourceValue = this.getNestedValue(data, sourceField);
    const cacheKey = `${enrichmentType}_${sourceValue}`;
    
    // Check cache first
    if (this.enrichmentCache.has(cacheKey)) {
      const expiry = this.cacheExpiry.get(cacheKey) || 0;
      if (Date.now() < expiry) {
        return this.enrichmentCache.get(cacheKey);
      } else {
        this.enrichmentCache.delete(cacheKey);
        this.cacheExpiry.delete(cacheKey);
      }
    }

    // Get enriched value
    let enrichedValue: any;
    
    switch (enrichmentType) {
      case 'lookup':
        enrichedValue = await this.performLookup(sourceValue, config);
        break;
        
      case 'api_call':
        enrichedValue = await this.performApiCall(sourceValue, config);
        break;
        
      case 'calculation':
        enrichedValue = this.performCalculation(sourceValue, config);
        break;
        
      case 'formatting':
        enrichedValue = this.performFormatting(sourceValue, config);
        break;
        
      case 'validation':
        enrichedValue = this.performValidation(sourceValue, config);
        break;
        
      default:
        enrichedValue = sourceValue;
    }

    // Cache the result
    if (enrichedValue !== undefined) {
      this.enrichmentCache.set(cacheKey, enrichedValue);
      this.cacheExpiry.set(cacheKey, Date.now() + (config.cacheTimeout || 300000)); // Default 5 minutes
    }

    return enrichedValue;
  }

  private async performLookup(sourceValue: any, config: any): Promise<any> {
    // Implement lookup logic (database, file, etc.)
    return sourceValue;
  }

  private async performApiCall(sourceValue: any, config: any): Promise<any> {
    // Implement API call logic
    return sourceValue;
  }

  private performCalculation(sourceValue: any, config: any): any {
    // Implement calculation logic
    return sourceValue;
  }

  private performFormatting(sourceValue: any, config: any): any {
    // Implement formatting logic
    return sourceValue;
  }

  private performValidation(sourceValue: any, config: any): any {
    // Implement validation logic
    return sourceValue;
  }

  getSchema(): TransformSchema {
    return {
      input: { ...this.schema.input },
      output: { ...this.schema.output }
    };
  }

  async validate(data: any): Promise<ValidationResult> {
    return this.validateInput(data);
  }
}

// Transform Factory
export class TransformFactory {
  private static transforms = new Map<string, typeof BaseDataTransform>();

  static registerTransform(type: string, transformClass: typeof BaseDataTransform): void {
    this.transforms.set(type, transformClass);
  }

  static createTransform(config: TransformConfig): BaseDataTransform {
    const TransformClass = this.transforms.get(config.type);
    
    if (!TransformClass) {
      throw new Error(`Unknown transform type: ${config.type}`);
    }

    return new (TransformClass as new (config: TransformConfig) => BaseDataTransform)(config);
  }

  static getAvailableTransforms(): string[] {
    return Array.from(this.transforms.keys());
  }
}

// Register built-in transforms
TransformFactory.registerTransform('field_rename', FieldRenameTransform);
TransformFactory.registerTransform('field_calculation', FieldCalculationTransform);
TransformFactory.registerTransform('field_format', FieldFormatTransform);
TransformFactory.registerTransform('field_filter', FieldFilterTransform);
TransformFactory.registerTransform('data_aggregation', DataAggregationTransform);
TransformFactory.registerTransform('data_enrichment', DataEnrichmentTransform);

