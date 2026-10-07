import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataBinding } from '../entities/data-binding.entity';
import { DataTransformation } from '../entities/data-transformation.entity';
import { CreateDataBindingDto, UpdateDataBindingDto, ActivateDataBindingDto, DeactivateDataBindingDto } from '../dto/data-binding.dto';

@Injectable()
export class DataBindingService {
  constructor(
    @InjectRepository(DataBinding)
    private dataBindingRepository: Repository<DataBinding>,
    @InjectRepository(DataTransformation)
    private dataTransformationRepository: Repository<DataTransformation>,
  ) {}

  async create(createDto: CreateDataBindingDto): Promise<DataBinding> {
    const binding = new DataBinding();
    binding.name = createDto.name;
    binding.description = createDto.description || null;
    binding.sourceOPCUAConnectionId = createDto.sourceOPCUAConnectionId || null;
    binding.sourceModbusConnectionId = createDto.sourceModbusConnectionId || null;
    binding.sourceEtherNetIPConnectionId = createDto.sourceEtherNetIPConnectionId || null;
    binding.sourceMQTTConnectionId = createDto.sourceMQTTConnectionId || null;
    binding.sourceSystemIntegrationId = createDto.sourceSystemIntegrationId || null;
    binding.targetOPCUAConnectionId = createDto.targetOPCUAConnectionId || null;
    binding.targetModbusConnectionId = createDto.targetModbusConnectionId || null;
    binding.targetEtherNetIPConnectionId = createDto.targetEtherNetIPConnectionId || null;
    binding.targetMQTTConnectionId = createDto.targetMQTTConnectionId || null;
    binding.targetSystemIntegrationId = createDto.targetSystemIntegrationId || null;
    binding.sourcePath = createDto.sourcePath || null;
    binding.targetPath = createDto.targetPath || null;
    binding.transformationRules = createDto.transformationRules;
    binding.pollingIntervalMs = createDto.pollingIntervalMs || 1000;
    binding.enabled = createDto.enabled !== undefined ? createDto.enabled : true;
    binding.active = createDto.active !== undefined ? createDto.active : false;
    binding.triggerMode = createDto.triggerMode || 'manual';
    binding.schedule = createDto.schedule;
    binding.filters = createDto.filters;
    binding.tenantId = createDto.tenantId;

    // Validate that at least one source and one target are specified
    const sourceCount = [
      createDto.sourceOPCUAConnectionId,
      createDto.sourceModbusConnectionId,
      createDto.sourceEtherNetIPConnectionId,
      createDto.sourceMQTTConnectionId,
      createDto.sourceSystemIntegrationId,
    ].filter(Boolean).length;

    const targetCount = [
      createDto.targetOPCUAConnectionId,
      createDto.targetModbusConnectionId,
      createDto.targetEtherNetIPConnectionId,
      createDto.targetMQTTConnectionId,
      createDto.targetSystemIntegrationId,
    ].filter(Boolean).length;

    if (sourceCount === 0) {
      throw new BadRequestException('At least one source connection must be specified');
    }

    if (targetCount === 0) {
      throw new BadRequestException('At least one target connection must be specified');
    }

    if (sourceCount > 1) {
      throw new BadRequestException('Only one source connection can be specified');
    }

    if (targetCount > 1) {
      throw new BadRequestException('Only one target connection can be specified');
    }

    return await this.dataBindingRepository.save(binding);
  }

  async findAll(tenantId: string): Promise<DataBinding[]> {
    return await this.dataBindingRepository.find({
      where: { tenantId },
      relations: [
        'sourceOPCUAConnection',
        'sourceModbusConnection',
        'sourceEtherNetIPConnection',
        'sourceMQTTConnection',
        'sourceSystemIntegration',
        'targetOPCUAConnection',
        'targetModbusConnection',
        'targetEtherNetIPConnection',
        'targetMQTTConnection',
        'targetSystemIntegration',
        'transformations',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<DataBinding> {
    const binding = await this.dataBindingRepository.findOne({
      where: { id, tenantId },
      relations: [
        'sourceOPCUAConnection',
        'sourceModbusConnection',
        'sourceEtherNetIPConnection',
        'sourceMQTTConnection',
        'sourceSystemIntegration',
        'targetOPCUAConnection',
        'targetModbusConnection',
        'targetEtherNetIPConnection',
        'targetMQTTConnection',
        'targetSystemIntegration',
        'transformations',
      ],
    });

    if (!binding) {
      throw new NotFoundException(`Data binding with ID ${id} not found`);
    }

    return binding;
  }

  async update(id: string, updateDto: UpdateDataBindingDto, tenantId: string): Promise<DataBinding> {
    const binding = await this.findOne(id, tenantId);

    if (updateDto.name !== undefined) binding.name = updateDto.name;
    if (updateDto.description !== undefined) binding.description = updateDto.description;
    if (updateDto.sourcePath !== undefined) binding.sourcePath = updateDto.sourcePath;
    if (updateDto.targetPath !== undefined) binding.targetPath = updateDto.targetPath;
    if (updateDto.transformationRules !== undefined) binding.transformationRules = updateDto.transformationRules;
    if (updateDto.pollingIntervalMs !== undefined) binding.pollingIntervalMs = updateDto.pollingIntervalMs;
    if (updateDto.enabled !== undefined) binding.enabled = updateDto.enabled;
    if (updateDto.active !== undefined) binding.active = updateDto.active;
    if (updateDto.triggerMode !== undefined) binding.triggerMode = updateDto.triggerMode;
    if (updateDto.schedule !== undefined) binding.schedule = updateDto.schedule;
    if (updateDto.filters !== undefined) binding.filters = updateDto.filters;

    return await this.dataBindingRepository.save(binding);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const binding = await this.findOne(id, tenantId);
    await this.dataBindingRepository.remove(binding);
  }

  async activate(id: string, activateDto: ActivateDataBindingDto, tenantId: string): Promise<any> {
    const binding = await this.findOne(id, tenantId);

    if (!binding.enabled) {
      throw new BadRequestException('Cannot activate a disabled binding');
    }

    binding.active = true;
    await this.dataBindingRepository.save(binding);

    // Simulate activation process
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      success: true,
      message: 'Data binding activated successfully',
      bindingId: id,
      active: true,
      activationTime: new Date().toISOString(),
      options: activateDto.options,
    };
  }

  async deactivate(id: string, deactivateDto: DeactivateDataBindingDto, tenantId: string): Promise<any> {
    const binding = await this.findOne(id, tenantId);

    binding.active = false;
    await this.dataBindingRepository.save(binding);

    // Simulate deactivation process
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      success: true,
      message: 'Data binding deactivated successfully',
      bindingId: id,
      active: false,
      deactivationTime: new Date().toISOString(),
      options: deactivateDto.options,
    };
  }

  async getBindingStatus(id: string, tenantId: string): Promise<any> {
    const binding = await this.findOne(id, tenantId);

    // Simulate binding status check
    await new Promise(resolve => setTimeout(resolve, 200));

    return {
      success: true,
      bindingId: id,
      name: binding.name,
      enabled: binding.enabled,
      active: binding.active,
      triggerMode: binding.triggerMode,
      lastExecution: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      nextExecution: binding.triggerMode === 'scheduled' ? 
        new Date(Date.now() + binding.pollingIntervalMs).toISOString() : null,
      executionCount: Math.floor(Math.random() * 1000) + 100,
      successCount: Math.floor(Math.random() * 950) + 90,
      errorCount: Math.floor(Math.random() * 10),
      successRate: 95 + Math.random() * 5,
      averageExecutionTime: Math.floor(Math.random() * 100) + 50,
      transformations: binding.transformations?.length || 0,
      timestamp: new Date().toISOString(),
    };
  }

  async executeBinding(id: string, tenantId: string): Promise<any> {
    const binding = await this.findOne(id, tenantId);

    if (!binding.enabled) {
      throw new BadRequestException('Cannot execute a disabled binding');
    }

    try {
      // Simulate binding execution
      const executionStartTime = new Date();
      await new Promise(resolve => setTimeout(resolve, 2000));

      const executionEndTime = new Date();
      const executionDuration = executionEndTime.getTime() - executionStartTime.getTime();

      // Simulate execution results
      const recordsProcessed = Math.floor(Math.random() * 100) + 10;
      const recordsTransformed = Math.floor(recordsProcessed * 0.9);
      const errors = Math.floor(Math.random() * 3);

      return {
        success: true,
        message: 'Data binding executed successfully',
        bindingId: id,
        executionStartTime: executionStartTime.toISOString(),
        executionEndTime: executionEndTime.toISOString(),
        executionDuration: executionDuration,
        results: {
          recordsProcessed: recordsProcessed,
          recordsTransformed: recordsTransformed,
          recordsSkipped: recordsProcessed - recordsTransformed,
          errors: errors,
          successRate: ((recordsTransformed - errors) / recordsProcessed * 100).toFixed(2),
        },
        transformations: binding.transformations?.map(t => ({
          id: t.id,
          type: t.transformationType,
          order: t.orderIndex,
          enabled: t.enabled,
        })) || [],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Data binding execution failed',
        error: error.message,
        bindingId: id,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getBindingMetrics(id: string, tenantId: string, timeRange?: string): Promise<any> {
    const binding = await this.findOne(id, tenantId);

    // Simulate metrics calculation
    await new Promise(resolve => setTimeout(resolve, 300));

    const now = new Date();
    const timeRangeMs = timeRange === '24h' ? 24 * 60 * 60 * 1000 : 
                       timeRange === '7d' ? 7 * 24 * 60 * 60 * 1000 : 
                       24 * 60 * 60 * 1000; // Default to 24h

    const startTime = new Date(now.getTime() - timeRangeMs);

    return {
      success: true,
      bindingId: id,
      timeRange: timeRange || '24h',
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
      metrics: {
        totalExecutions: Math.floor(Math.random() * 1000) + 100,
        successfulExecutions: Math.floor(Math.random() * 950) + 90,
        failedExecutions: Math.floor(Math.random() * 50) + 5,
        averageExecutionTime: Math.floor(Math.random() * 100) + 50,
        totalRecordsProcessed: Math.floor(Math.random() * 10000) + 1000,
        totalRecordsTransformed: Math.floor(Math.random() * 9000) + 900,
        averageRecordsPerExecution: Math.floor(Math.random() * 50) + 10,
        successRate: 95 + Math.random() * 5,
        errorRate: Math.random() * 5,
      },
      executionHistory: Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(now.getTime() - (23 - i) * 60 * 60 * 1000).toISOString(),
        executions: Math.floor(Math.random() * 10) + 1,
        successRate: 90 + Math.random() * 10,
        averageExecutionTime: Math.floor(Math.random() * 100) + 50,
        recordsProcessed: Math.floor(Math.random() * 100) + 10,
      })),
      timestamp: new Date().toISOString(),
    };
  }

  async createTransformation(bindingId: string, transformationData: any, tenantId: string): Promise<DataTransformation> {
    const binding = await this.findOne(bindingId, tenantId);

    const transformation = new DataTransformation();
    transformation.bindingId = bindingId;
    transformation.transformationType = transformationData.transformationType;
    transformation.parameters = transformationData.parameters;
    transformation.orderIndex = transformationData.orderIndex || 0;
    transformation.enabled = transformationData.enabled !== undefined ? transformationData.enabled : true;
    transformation.description = transformationData.description;
    transformation.inputMapping = transformationData.inputMapping;
    transformation.outputMapping = transformationData.outputMapping;
    transformation.formula = transformationData.formula;
    transformation.conditions = transformationData.conditions;

    return await this.dataTransformationRepository.save(transformation);
  }

  async updateTransformation(transformationId: string, transformationData: any, tenantId: string): Promise<DataTransformation> {
    const transformation = await this.dataTransformationRepository.findOne({
      where: { id: transformationId },
      relations: ['binding'],
    });

    if (!transformation || transformation.binding.tenantId !== tenantId) {
      throw new NotFoundException(`Data transformation with ID ${transformationId} not found`);
    }

    if (transformationData.transformationType !== undefined) transformation.transformationType = transformationData.transformationType;
    if (transformationData.parameters !== undefined) transformation.parameters = transformationData.parameters;
    if (transformationData.orderIndex !== undefined) transformation.orderIndex = transformationData.orderIndex;
    if (transformationData.enabled !== undefined) transformation.enabled = transformationData.enabled;
    if (transformationData.description !== undefined) transformation.description = transformationData.description;
    if (transformationData.inputMapping !== undefined) transformation.inputMapping = transformationData.inputMapping;
    if (transformationData.outputMapping !== undefined) transformation.outputMapping = transformationData.outputMapping;
    if (transformationData.formula !== undefined) transformation.formula = transformationData.formula;
    if (transformationData.conditions !== undefined) transformation.conditions = transformationData.conditions;

    return await this.dataTransformationRepository.save(transformation);
  }

  async removeTransformation(transformationId: string, tenantId: string): Promise<void> {
    const transformation = await this.dataTransformationRepository.findOne({
      where: { id: transformationId },
      relations: ['binding'],
    });

    if (!transformation || transformation.binding.tenantId !== tenantId) {
      throw new NotFoundException(`Data transformation with ID ${transformationId} not found`);
    }

    await this.dataTransformationRepository.remove(transformation);
  }
}
