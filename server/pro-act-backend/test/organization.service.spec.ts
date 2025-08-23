import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrganizationService } from '../src/organization/organization.service';
import { Organization } from '../src/organization/organization.entity';
import { Repository } from 'typeorm';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let repo: Repository<Organization>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        {
          provide: getRepositoryToken(Organization),
          useClass: Repository,
        },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
    repo = module.get<Repository<Organization>>(getRepositoryToken(Organization));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create an organization', async () => {
    const org = { id: '1', code: 'ORG1', name: 'Test Org' } as Organization;
    jest.spyOn(repo, 'create').mockReturnValue(org);
    jest.spyOn(repo, 'save').mockResolvedValue(org);
    const result = await service.create({ code: 'ORG1', name: 'Test Org' });
    expect(result).toEqual(org);
  });

  it('should update an organization', async () => {
    const org = { id: '1', code: 'ORG1', name: 'Test Org' } as Organization;
    jest.spyOn(repo, 'update').mockResolvedValue(undefined as any);
    jest.spyOn(service, 'findOne').mockResolvedValue(org);
    const result = await service.update('1', { name: 'Updated Org' });
    expect(result).toEqual(org);
  });

  it('should remove an organization', async () => {
    jest.spyOn(repo, 'delete').mockResolvedValue(undefined as any);
    jest.spyOn(service, 'findOne').mockResolvedValue({ id: '1' } as Organization);
    await expect(service.remove('1')).resolves.toBeUndefined();
  });
}); 