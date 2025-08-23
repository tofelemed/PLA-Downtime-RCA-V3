# Custom Attributes System

This document describes the custom attributes system implemented in the Pro-Act application, which allows users to define and manage custom fields for each level of the plant hierarchy.

## Overview

The custom attributes system provides a flexible way to extend the standard entity fields (Organization, Tenant, Unit, Asset) with user-defined attributes. This system is designed to be easily migratable from IndexedDB to a backend database later.

## Architecture

### Database Schema

The system uses two main tables:

1. **customAttributeDefinitions** - Stores attribute definitions
2. **customAttributeValues** - Stores actual values for entities

### Key Components

- **CustomAttributeService** - Core service for managing attributes
- **AttributeManagementPanel** - Admin interface for managing definitions
- **CustomAttributeForm** - Dynamic form for editing attribute values
- **CustomAttributeDisplay** - Read-only display component

## Features

### Attribute Types

- **String** - Text input with optional length validation
- **Number** - Numeric input with optional min/max validation
- **Boolean** - Yes/No toggle
- **Date** - Date picker
- **Select** - Dropdown with predefined options

### Validation Rules

- Required/optional fields
- Minimum/maximum length (for strings)
- Minimum/maximum values (for numbers)
- Regular expression patterns
- Custom validation functions

### Scoping

- **Global** - Available to all entities
- **Organization-specific** - Available only within an organization
- **Tenant-specific** - Available only within a tenant

## Usage

### 1. Managing Attribute Definitions

Navigate to **Admin Panel > Custom Attributes** to:

- Create new attribute definitions
- Edit existing definitions
- Delete attributes (with confirmation)
- Configure validation rules
- Set default values
- Manage select options

### 2. Creating Attributes

1. Select the entity type (Organization, Tenant, Unit, or Asset)
2. Click "Add Attribute"
3. Fill in the form:
   - **Name**: Internal identifier (e.g., `location_code`)
   - **Display Name**: User-friendly name (e.g., "Location Code")
   - **Data Type**: Choose from available types
   - **Required**: Mark as required if needed
   - **Validation Rules**: Set constraints
   - **Default Value**: Optional default value
   - **Order**: Display order in forms

### 3. Using Attributes in Forms

Custom attributes automatically appear in entity creation/editing forms:

- **Admin Panel** - Organization creation
- **Master Data** - All entity types
- **Plant Hierarchy** - Visual display

### 4. Displaying Attributes

Attributes are displayed in:

- **Hierarchy View** - Collapsible sections for each entity
- **Entity Cards** - Compact display with badges
- **Forms** - Editable fields with validation

## Implementation Details

### Data Storage

```typescript
// Attribute Definition
interface CustomAttributeDefinition {
  id: string;
  entityType: 'Organization' | 'Tenant' | 'Unit' | 'Asset';
  name: string;
  displayName: string;
  dataType: 'string' | 'number' | 'boolean' | 'date' | 'select';
  isRequired: boolean;
  defaultValue?: string;
  validationRules?: ValidationRules;
  selectOptions?: string[];
  orderIndex: number;
  isActive: boolean;
  tenantId?: string;
  organizationId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Attribute Value
interface CustomAttributeValue {
  id: string;
  entityId: string;
  entityType: 'Organization' | 'Tenant' | 'Unit' | 'Asset';
  attributeDefinitionId: string;
  value?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Service Methods

```typescript
// Get definitions for an entity type
getAttributeDefinitions(entityType, tenantId?, organizationId?)

// Create new definition
createAttributeDefinition(data, createdBy)

// Update existing definition
updateAttributeDefinition(id, data)

// Delete definition (and all values)
deleteAttributeDefinition(id)

// Get values for an entity
getAttributeValues(entityId, entityType)

// Set single value
setAttributeValue(entityId, entityType, attributeId, value)

// Set multiple values
bulkSetAttributeValues(entityId, entityType, values)
```

### Component Integration

```tsx
// In entity forms
<CustomAttributeForm
  entityId={entity.id}
  entityType="Organization"
  organizationId={session?.organization?.id}
  onValuesChange={setCustomAttributeValues}
  showValidationErrors={true}
/>

// In display views
<CustomAttributeDisplay
  entityId={entity.id}
  entityType="Organization"
  organizationId={entity.organizationId}
  showHeader={true}
  maxDisplay={3}
  collapsible={true}
/>
```

## Migration to Backend

The system is designed for easy migration to a backend database:

### 1. Database Tables

```sql
-- Custom Attribute Definitions
CREATE TABLE custom_attribute_definitions (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    entityType NVARCHAR(50) NOT NULL,
    name NVARCHAR(255) NOT NULL,
    displayName NVARCHAR(255) NOT NULL,
    dataType NVARCHAR(50) NOT NULL,
    isRequired BIT NOT NULL DEFAULT 0,
    defaultValue NVARCHAR(MAX) NULL,
    validationRules NVARCHAR(MAX) NULL,
    selectOptions NVARCHAR(MAX) NULL,
    orderIndex INT NOT NULL DEFAULT 0,
    isActive BIT NOT NULL DEFAULT 1,
    tenantId UNIQUEIDENTIFIER NULL,
    organizationId UNIQUEIDENTIFIER NULL,
    createdBy NVARCHAR(255) NOT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- Custom Attribute Values
CREATE TABLE custom_attribute_values (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    entityId UNIQUEIDENTIFIER NOT NULL,
    entityType NVARCHAR(50) NOT NULL,
    attributeDefinitionId UNIQUEIDENTIFIER NOT NULL,
    value NVARCHAR(MAX) NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
```

### 2. API Endpoints

```typescript
// Attribute Definitions
GET    /api/custom-attributes/definitions
POST   /api/custom-attributes/definitions
PUT    /api/custom-attributes/definitions/:id
DELETE /api/custom-attributes/definitions/:id

// Attribute Values
GET    /api/custom-attributes/values/:entityId/:entityType
POST   /api/custom-attributes/values
PUT    /api/custom-attributes/values/:id
DELETE /api/custom-attributes/values/:id
```

### 3. Service Updates

Update the `CustomAttributeService` to use API calls instead of IndexedDB:

```typescript
// Replace storageService calls with API calls
async getAttributeDefinitions(entityType, tenantId, organizationId) {
  const response = await fetch(`/api/custom-attributes/definitions?entityType=${entityType}&tenantId=${tenantId}&organizationId=${organizationId}`);
  return response.json();
}
```

## Best Practices

### 1. Naming Conventions

- Use lowercase with underscores for internal names
- Use descriptive display names
- Keep names consistent across similar attributes

### 2. Validation Rules

- Set appropriate min/max values
- Use regex patterns sparingly
- Provide clear error messages

### 3. Performance

- Limit the number of attributes per entity type
- Use appropriate data types
- Consider indexing for frequently queried attributes

### 4. User Experience

- Group related attributes together
- Use logical ordering
- Provide helpful descriptions
- Set sensible defaults

## Troubleshooting

### Common Issues

1. **Attributes not appearing**: Check if definitions are active and properly scoped
2. **Validation errors**: Verify validation rules and data types
3. **Performance issues**: Limit the number of attributes displayed at once
4. **Migration problems**: Ensure database schema matches TypeScript interfaces

### Debug Information

Enable console logging in the CustomAttributeService to debug issues:

```typescript
console.log('Loading definitions for:', entityType, tenantId, organizationId);
console.log('Found definitions:', definitions);
```

## Future Enhancements

- **Attribute Inheritance** - Child entities inherit parent attributes
- **Attribute Templates** - Predefined sets of attributes
- **Bulk Operations** - Import/export attribute definitions
- **Advanced Validation** - Cross-field validation rules
- **Audit Logging** - Track attribute changes
- **Conditional Attributes** - Show/hide based on other values
- **Attribute Dependencies** - Cascading attribute updates

## Support

For questions or issues with the custom attributes system, refer to:

1. This documentation
2. Component source code
3. Service implementation
4. TypeScript interfaces
5. Console logs and error messages
