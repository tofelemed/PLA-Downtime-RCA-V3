import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { PIConnection } from './pi-connection.entity';
import { CreatePIConnectionDto } from './dto/create-pi-connection.dto';
import { UpdatePIConnectionDto } from './dto/update-pi-connection.dto';
import { CredentialEncryptionService } from '../common/services/credential-encryption.service';

@Injectable()
export class PIConnectionService {
  constructor(
    @InjectRepository(PIConnection)
    private piConnectionRepository: Repository<PIConnection>,
    private readonly credentialEncryption: CredentialEncryptionService,
  ) {}

  private encryptPasswordFields<T extends { passwordEncrypted?: string }>(dto: T): T {
    if (dto.passwordEncrypted && !this.credentialEncryption.isEncrypted(dto.passwordEncrypted)) {
      dto.passwordEncrypted = this.credentialEncryption.encrypt(dto.passwordEncrypted);
    }
    return dto;
  }

  private sanitizeConnectionResponse(connection: PIConnection): PIConnection {
    return {
      ...connection,
      passwordEncrypted: connection.passwordEncrypted ? '********' : undefined,
    };
  }

  async create(createDto: CreatePIConnectionDto): Promise<PIConnection> {
    const id = randomUUID();
    const payload = this.encryptPasswordFields({ ...createDto });
    const connection = this.piConnectionRepository.create({
      id,
      ...payload,
      connectionConfig: createDto.connectionConfig
        ? JSON.stringify(createDto.connectionConfig)
        : createDto.connectionConfig,
    });
    const saved = await this.piConnectionRepository.save(connection);
    return this.sanitizeConnectionResponse(saved);
  }

  async findAll(filters?: { tenantId?: string; organizationId?: string }): Promise<PIConnection[]> {
    const where: any = {};
    if (filters?.tenantId) where.tenantId = filters.tenantId;
    if (filters?.organizationId) where.organizationId = filters.organizationId;
    const connections = await this.piConnectionRepository.find({ where });
    return connections.map((c) => this.sanitizeConnectionResponse(c));
  }

  async findOne(id: string): Promise<PIConnection> {
    const connection = await this.piConnectionRepository.findOne({ where: { id } });
    if (!connection) {
      throw new NotFoundException(`PI Connection with ID ${id} not found`);
    }
    return this.sanitizeConnectionResponse(connection);
  }

  /** Internal use — returns connection with encrypted password for decryption */
  async findOneRaw(id: string): Promise<PIConnection> {
    const connection = await this.piConnectionRepository.findOne({ where: { id } });
    if (!connection) {
      throw new NotFoundException(`PI Connection with ID ${id} not found`);
    }
    return connection;
  }

  async update(id: string, updateDto: UpdatePIConnectionDto): Promise<PIConnection> {
    const connection = await this.findOneRaw(id);
    const payload = this.encryptPasswordFields({ ...updateDto });
    Object.assign(connection, {
      ...payload,
      ...(updateDto.connectionConfig !== undefined
        ? {
            connectionConfig: updateDto.connectionConfig
              ? JSON.stringify(updateDto.connectionConfig)
              : null,
          }
        : {}),
    });
    const saved = await this.piConnectionRepository.save(connection);
    return this.sanitizeConnectionResponse(saved);
  }

  async remove(id: string): Promise<void> {
    const result = await this.piConnectionRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`PI Connection with ID ${id} not found`);
    }
  }
}
