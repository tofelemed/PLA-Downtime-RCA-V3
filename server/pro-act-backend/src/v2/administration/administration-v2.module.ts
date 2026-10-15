import { Module, Type } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSettingsModule } from '../../app-settings/app-settings.module';
import { AuditLog } from '../../audit-log/audit-log.entity';
import { RoleDelegation } from '../../auth/delegations/role-delegation.entity';
import { UserScope } from '../../auth/scopes/user-scope.entity';
import { Site } from '../../calendar/entities/site.entity';
import { CustomAttributeDefinition } from '../../custom-attribute-definition/custom-attribute-definition.entity';
import { CustomAttributeValue } from '../../custom-attribute-value/custom-attribute-value.entity';
import { Organization } from '../../organization/organization.entity';
import { OrganizationModule } from '../../organization/organization.module';
import { Task } from '../../task/task.entity';
import { Tenant } from '../../tenant/tenant.entity';
import { TenantModule } from '../../tenant/tenant.module';
import { Unit } from '../../unit/unit.entity';
import { Asset } from '../../asset/asset.entity';
import { User } from '../../users/user.entity';
import { UsersModule } from '../../users/users.module';
import { AuditLogsV2Controller } from './audit-logs/audit-logs-v2.controller';
import { AuditLogsV2Service } from './audit-logs/audit-logs-v2.service';
import { BrandingV2Controller } from './branding/branding-v2.controller';
import { BrandingV2Service } from './branding/branding-v2.service';
import { PlaceNamesService } from './common/place-names.service';
import { CustomAttributesV2Controller } from './custom-attributes/custom-attributes-v2.controller';
import { CustomAttributeValuesV2Controller } from './custom-attributes/custom-attribute-values-v2.controller';
import { CustomAttributeValuesV2Service } from './custom-attributes/custom-attribute-values-v2.service';
import { CustomAttributesV2Service } from './custom-attributes/custom-attributes-v2.service';
import { HierarchyV2Service } from './hierarchy/hierarchy-v2.service';
import { OrganizationsV2Controller } from './hierarchy/organizations-v2.controller';
import { PlantsV2Controller } from './hierarchy/plants-v2.controller';
import { TasksV2CommandsService } from './tasks/tasks-v2-commands.service';
import { TasksV2Controller } from './tasks/tasks-v2.controller';
import { TasksV2Service } from './tasks/tasks-v2.service';
import { RoleDelegationsV2Controller } from './role-delegations/role-delegations-v2.controller';
import { RoleDelegationsV2Service } from './role-delegations/role-delegations-v2.service';
import { UserScopesV2Controller } from './user-scopes/user-scopes-v2.controller';
import { UserScopesV2Service } from './user-scopes/user-scopes-v2.service';
import { PlantUserDirectory } from './users/plant-user-directory';
import { UserDirectoryService } from './users/user-directory.service';
import { UsersV2CommandsService } from './users/users-v2-commands.service';
import { UsersV2Controller } from './users/users-v2.controller';
import { UsersV2Service } from './users/users-v2.service';

/** Services the administration controllers inject (stubbed by the OpenAPI snapshot test). */
export const ADMINISTRATION_V2_PROVIDERS = [
  PlaceNamesService,
  PlantUserDirectory,
  UserDirectoryService,
  UsersV2Service,
  UsersV2CommandsService,
  UserScopesV2Service,
  RoleDelegationsV2Service,
  TasksV2Service,
  TasksV2CommandsService,
  AuditLogsV2Service,
  CustomAttributesV2Service,
  CustomAttributeValuesV2Service,
  HierarchyV2Service,
  BrandingV2Service,
];

/**
 * Controllers of the administration API (users, scope grants, tasks, audit trail, custom attributes,
 * organizations and plants, branding). Declared by `V2Module` itself, because the
 * v2 OpenAPI document scans only V2Module's own controllers; their services come from this module.
 */
export const ADMINISTRATION_V2_CONTROLLERS: Type<unknown>[] = [
  UsersV2Controller,
  UserScopesV2Controller,
  RoleDelegationsV2Controller,
  TasksV2Controller,
  AuditLogsV2Controller,
  CustomAttributesV2Controller,
  CustomAttributeValuesV2Controller,
  OrganizationsV2Controller,
  PlantsV2Controller,
  BrandingV2Controller,
];

/** Services of the administration API (owner requirement "v2 only" for the administration screens). */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserScope,
      RoleDelegation,
      Unit,
      Asset,
      Site,
      Tenant,
      Organization,
      Task,
      AuditLog,
      CustomAttributeDefinition,
      CustomAttributeValue,
    ]),
    UsersModule,
    OrganizationModule,
    TenantModule,
    AppSettingsModule,
  ],
  providers: ADMINISTRATION_V2_PROVIDERS,
  exports: ADMINISTRATION_V2_PROVIDERS,
})
export class AdministrationV2Module {}
