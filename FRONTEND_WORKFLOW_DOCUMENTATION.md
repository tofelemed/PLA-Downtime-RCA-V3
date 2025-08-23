# Pro-Act Frontend Application Workflow Documentation

## Table of Contents
1. [Application Overview](#application-overview)
2. [User Authentication & Authorization Flow](#user-authentication--authorization-flow)
3. [Dashboard & Analytics](#dashboard--analytics)
4. [User Management Workflow](#user-management-workflow)
5. [Production Plans Workflow](#production-plans-workflow)
6. [Event Hub Workflow](#event-hub-workflow)
7. [RCA (Root Cause Analysis) Workflow](#rca-root-cause-analysis-workflow)
8. [Master Data Management](#master-data-management)
9. [Admin Panel & System Configuration](#admin-panel--system-configuration)
10. [Data Flow & Relationships](#data-flow--relationships)
11. [Component Architecture](#component-architecture)
12. [State Management](#state-management)

---

## Application Overview

Pro-Act is a comprehensive Production Loss Analysis application designed for manufacturing organizations. The frontend is built with React, TypeScript, and modern UI components, providing a complete workflow from user management to production planning, event monitoring, and root cause analysis.

### Key Features:
- **Multi-tenant Architecture**: Organization → Tenant (Plant) hierarchy
- **Role-based Access Control**: SuperAdmin, OrgAdmin, TenantAdmin, Analyst, Engineer, Operator
- **Production Planning**: Templates, plans, and approval workflows
- **Event Management**: Production losses, IOW, SOL, APM, Failure WO, Production Output
- **RCA Investigations**: Logic trees, evidence collection, recommendations
- **Real-time Analytics**: Dashboard with KPIs and performance metrics
- **Audit Trail**: Complete change tracking and compliance

---

## User Authentication & Authorization Flow

### 1. Application Initialization
```typescript
// App.tsx - Main application structure
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <PlantSelectionProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </PlantSelectionProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);
```

### 2. Authentication Context (AuthContext.tsx)
**Purpose**: Manages user sessions, authentication state, and demo data initialization

**Key Functions**:
- `login(email, password)`: Authenticates user credentials
- `logout()`: Clears session and redirects to login
- `selectTenant(tenantId)`: Switches between plant/tenant contexts
- `isLoading`: Loading state during authentication

**Demo Data Creation**:
- Organizations (e.g., "Acme Manufacturing")
- Tenants/Plants (e.g., "Plant Alpha")
- Users with different roles
- Production units and products
- Production plan templates

### 3. Plant Selection Context (PlantSelectionContext.tsx)
**Purpose**: Manages plant/tenant selection across the application

**Key Features**:
- Plant switching functionality
- Context sharing across components
- Loading states for plant data

### 4. Protected Routes
```typescript
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, isLoading } = useAuth();
  
  if (isLoading) return <LoadingSpinner />;
  if (!session) return <LoginForm />;
  
  return <Layout>{children}</Layout>;
};
```

### 5. Role-based Navigation
**Navigation Items by Role**:
- **SuperAdmin**: All modules + Admin Panel
- **OrgAdmin**: Dashboard, Production Plans, Events, RCA, Master Data, User Management, Permissions
- **TenantAdmin**: Dashboard, Production Plans, Events, RCA, Master Data, User Management, Permissions
- **Analyst**: Dashboard, Production Plans, Events, RCA
- **Engineer**: Dashboard, Production Plans, Events, RCA
- **Operator**: Dashboard, Events

---

## Dashboard & Analytics

### 1. Dashboard Overview (Dashboard.tsx)
**Purpose**: Central hub displaying key performance indicators and quick access to critical information

**Key Components**:
- **Quick Stats Cards**: Active plans, open events, RCA investigations, pending tasks
- **Recent Alerts**: Real-time notifications for equipment issues, maintenance, quality checks
- **Upcoming Tasks**: Task management with priority levels and due dates
- **Performance Metrics**: OEE, availability, performance, quality trends

### 2. Dashboard Analytics (DashboardAnalytics.tsx)
**Features**:
- **OEE Calculations**: Availability × Performance × Quality
- **Loss Analysis**: Production losses vs. planned quantities
- **Cost Tracking**: Financial impact of events and losses
- **Trend Analysis**: Historical performance data visualization

### 3. Key Metrics Displayed:
- **Production Plans**: Active plans count and status
- **Events**: Open events by type (Production Loss, IOW, SOL, APM, Failure WO)
- **RCA Investigations**: Ongoing and completed investigations
- **System Health**: Equipment status and maintenance alerts

---

## User Management Workflow

### 1. User Management Page (UserManagement.tsx)
**Purpose**: Manage users, roles, and access permissions within the organization

### 2. User Creation Process:
```typescript
// User creation form fields
const formData = {
  name: string,
  email: string,
  password: string,
  role: 'SuperAdmin' | 'OrgAdmin' | 'TenantAdmin' | 'Analyst' | 'Engineer' | 'Operator'
};
```

### 3. Role Hierarchy & Permissions:
- **SuperAdmin**: Full system access, can manage all organizations
- **OrgAdmin**: Organization-level access, manages tenants and users
- **TenantAdmin**: Plant-level access, manages plant-specific data
- **Analyst**: Data analysis and reporting capabilities
- **Engineer**: Technical operations and RCA investigations
- **Operator**: Basic event recording and monitoring

### 4. User Management Features:
- **Create/Edit/Delete Users**: Full CRUD operations
- **Role Assignment**: Assign appropriate roles based on responsibilities
- **Active/Inactive Status**: Enable/disable user accounts
- **Audit Logging**: Track all user management activities
- **Filtering**: Filter users by role, organization, or tenant

### 5. Permission Management (PermissionsManagement.tsx)
**Features**:
- **Role-based Permissions**: Define what each role can access
- **Module Access Control**: Control access to specific application modules
- **Data Access Levels**: Organization, tenant, or unit-level data access
- **Permission Inheritance**: Hierarchical permission structure

---

## Production Plans Workflow

### 1. Production Plans Overview (ProductionPlans.tsx)
**Purpose**: Manage production planning, templates, and execution tracking

### 2. Template Management:
**Template Creation Process**:
```typescript
// Production plan template structure
interface ProductionPlanTemplate {
  name: string;
  description?: string;
  unitId: string;
  productIds: string[];
  planBasis: 'Time-based' | 'Quantity-based';
  startDate: string;
  endDate: string;
  recurrence: 'Daily' | 'Weekly' | 'Monthly';
  usefulProductionTime: {
    [day: string]: { start: string; end: string; }
  };
  dataEntryFrequency: 'Hourly' | 'Daily' | 'Weekly';
  tenantId: string;
  orgId: string;
  version: number;
}
```

**Template Wizard Steps**:
1. **Basic Information**: Name, description, unit selection
2. **Product Configuration**: Select products for the plan
3. **Time Configuration**: Define production hours and shifts
4. **Recurrence Settings**: Daily, weekly, or monthly patterns
5. **Data Entry Frequency**: How often data should be recorded
6. **Review & Save**: Final review and template creation

### 3. Plan Creation Process:
**From Template**:
1. Select existing template
2. Configure plan-specific parameters
3. Set planned quantities and tolerance limits
4. Define approval workflow
5. Create and activate plan

**Manual Creation**:
1. Define all parameters manually
2. Set up production schedule
3. Configure monitoring parameters
4. Establish approval process

### 4. Plan Management Features:
- **Plan Status Tracking**: Draft → Pending Review → Pending Approval → Approved → Active → Completed
- **Approval Workflow**: Multi-level approval process
- **Quantity Tracking**: Planned vs. actual production quantities
- **Tolerance Monitoring**: Alert when actual deviates from planned
- **Shift/Crew Management**: Track production by shifts and crews
- **Comments & Notes**: Collaborative planning with notes and comments

### 5. Plan Dashboard (PlanDashboard.tsx)
**Analytics**:
- **Performance Metrics**: Actual vs. planned production
- **OEE Tracking**: Overall Equipment Effectiveness
- **Loss Analysis**: Production losses and their categorization
- **Trend Analysis**: Historical performance trends
- **Alert Management**: Automated alerts for deviations

### 6. Plan Actions (PlanActions.tsx)
**Available Actions**:
- **Edit Plan**: Modify plan parameters
- **Duplicate Plan**: Create new plan from existing
- **Archive Plan**: Move completed plans to archive
- **Export Data**: Export plan data for reporting
- **Generate Reports**: Create performance reports

---

## Event Hub Workflow

### 1. Event Hub Overview (EventHub.tsx)
**Purpose**: Centralized event management for all production-related events

### 2. Event Types:
**Production Loss Events**:
- Equipment failures causing production stoppage
- Quality issues leading to scrap or rework
- Setup and changeover time losses
- Speed losses due to reduced performance

**IOW (Instruments Out of Window)**:
- Parameter deviations from normal operating ranges
- Process variable monitoring and alerting
- Limit breach tracking and duration

**SOL (Safety Operating Limits)**:
- Safety-related operational constraints
- Safety system activations and interventions
- Operational limit violations

**APM (Asset Performance Management)**:
- Predictive maintenance alerts
- Equipment health monitoring
- Performance degradation warnings

**Failure WO (Work Orders)**:
- Maintenance work order tracking
- Failure mode identification
- Repair and restoration activities

**Production Output**:
- Actual production quantities
- Quality metrics and measurements
- Performance data collection

### 3. Event Creation Process:
```typescript
// Event form structure
const eventForm = {
  unitId: string,
  assetId: string,
  impactCodeId: string,
  oeeCodeId: string,
  description: string,
  startTime: string,
  endTime: string,
  quantity: string,
  cost: string,
  eventType: 'ProductionLoss' | 'IOW' | 'SOL' | 'APM' | 'FailureWO' | 'ProductionOutput',
  // Type-specific fields
  parameter?: string,        // IOW
  solType?: 'Safety' | 'Operational', // SOL
  apmType?: 'Health' | 'Prediction' | 'Alert', // APM
  failureMode?: string,      // Failure WO
  recommendedAction?: string, // APM
  defectiveQuantity?: string, // Quality events
  planId?: string,           // Production Loss
  lossCategory?: string,     // Production Loss
  operatorName?: string,     // All events
  shift?: string,            // All events
  crew?: string,             // All events
  reasonCodeId?: string,     // ISA-95 reason codes
  duration?: string,         // Duration for costing
};
```

### 4. Smart Prompts System:
**Operator Prompts**:
- Auto-suggestions based on user role and history
- Common operator names and patterns
- Shift-based operator assignments

**Shift Prompts**:
- Time-based shift suggestions
- Plant-specific shift schedules
- Historical shift patterns

**Crew Prompts**:
- Crew assignments based on unit/asset
- Team composition suggestions
- Work schedule integration

### 5. Status Automation:
**Automated Status Rules**:
```typescript
const statusAutomationRules = [
  {
    id: 'apm-completed',
    eventType: 'APM',
    condition: (event) => !!event.recommendedAction,
    status: 'Completed',
    description: 'If recommended action is set, mark APM event as Completed.'
  },
  {
    id: 'failurewo-completed',
    eventType: 'FailureWO',
    condition: (event) => !!event.failureMode && !!event.endTime,
    status: 'Completed',
    description: 'If failure mode and end time are set, mark Failure WO as Completed.'
  },
  {
    id: 'endtime-coded',
    eventType: '*',
    condition: (event) => !!event.endTime && !["RCA Required", "In Progress", "Completed", "Closed", "Cancelled"].includes(event.status),
    status: 'Coded',
    description: 'If end time is set, mark as Coded (unless already further progressed).'
  },
  {
    id: 'rca-required',
    eventType: '*',
    condition: (event) => !!event.rcaId && !["Completed", "Closed", "Cancelled"].includes(event.status),
    status: 'RCA Required',
    description: 'If RCA is linked, mark as RCA Required.'
  }
];
```

### 6. Event Management Features:
- **Event Filtering**: Filter by type, status, unit, asset, date range
- **Bulk Operations**: Edit multiple events simultaneously
- **Event Linking**: Link related events and RCAs
- **Cost Calculation**: Automatic cost calculation based on impact codes
- **OEE Impact**: Automatic OEE component calculation
- **Audit Trail**: Complete change history for each event

### 7. Event Form Fields (EventFormFields.tsx)
**Dynamic Form Components**:
- **Common Fields**: Unit, asset, description, times, quantities
- **Type-specific Fields**: Dynamic fields based on event type
- **Validation**: Real-time form validation
- **Auto-save**: Automatic saving of form data
- **Attachment Support**: File uploads for evidence

---

## RCA (Root Cause Analysis) Workflow

### 1. RCA Module Overview (RCAModule.tsx)
**Purpose**: Comprehensive root cause analysis with logic trees, evidence collection, and recommendations

### 2. RCA Creation Process:
```typescript
// RCA form structure
const rcaForm = {
  eventId: string,           // Link to production event
  title: string,             // RCA title
  description: string,       // Problem description
  priority: 'Low' | 'Medium' | 'High' | 'Critical',
  targetCloseDate: string,   // Target completion date
  templateId: string,        // RCA template selection
};
```

### 3. RCA Templates:
**Template Selection**:
- Pre-defined RCA templates for common scenarios
- Customizable logic tree structures
- Verification checklists
- Best practice guidelines

**Template Categories**:
- Equipment failures
- Quality issues
- Safety incidents
- Process deviations
- Performance problems

### 4. Logic Tree Builder:
**Tree Structure**:
```typescript
interface LogicTreeNode {
  id: string;
  name: string;              // Question or statement
  code: string;              // Node code
  category: string;          // Node category
  description: string;       // Answer or explanation
  note: string;              // Additional notes
  finding: boolean;          // Is this a finding?
  children: LogicTreeNode[]; // Child nodes
  _parentId: string;         // Parent node reference
}
```

**Tree Building Process**:
1. **Root Cause Definition**: Define the problem statement
2. **Why Analysis**: Ask "why" questions to drill down
3. **How Analysis**: Ask "how" questions to understand processes
4. **Cause Identification**: Identify root causes
5. **Evidence Attachment**: Link evidence to nodes
6. **Verification**: Verify findings with evidence

### 5. Evidence Collection:
**Evidence Types**:
- **Photos**: Visual evidence and documentation
- **Documents**: Reports, procedures, specifications
- **Time Series Data**: Historical data and trends
- **Notes**: Written observations and findings
- **Video**: Video recordings and demonstrations

**Evidence Form**:
```typescript
const evidenceForm = {
  title: string,
  description: string,
  type: 'Photo' | 'Document' | 'Time Series' | 'Note' | 'Video',
  category: string,          // Evidence category
  location: string,          // Collection location
  timestamp: string,         // Collection timestamp
  relatedAssetId: string,    // Related equipment
  severity: 'Low' | 'Medium' | 'High' | 'Critical',
  tags: string[],            // Searchable tags
  verified: boolean,         // Verification status
  fiveP: 'Parts' | 'Paper' | 'People' | 'Place' | 'Process',
  task: string,              // Related task
  dueDate: string,           // Task due date
  status: 'pending' | 'completed',
  attachments: File[],       // File attachments
};
```

### 6. Evidence Management:
**Features**:
- **File Upload**: Support for multiple file types
- **Evidence Categorization**: Organize evidence by categories
- **Location Tracking**: Track where evidence was collected
- **Verification Process**: Verify evidence authenticity
- **5P Analysis**: Parts, Paper, People, Place, Process
- **Task Integration**: Link evidence to action items

### 7. Recommendations:
**Recommendation Structure**:
```typescript
const recommendationForm = {
  title: string,
  description: string,
  priority: 'Low' | 'Medium' | 'High',
  assigneeId: string,        // Assigned user
  dueDate: string,           // Due date
  estimatedCost: string,     // Cost estimate
  status: 'Open' | 'In Progress' | 'Completed' | 'Cancelled',
};
```

**Recommendation Management**:
- **Priority Assignment**: Set recommendation priorities
- **Assignee Tracking**: Track who is responsible
- **Cost Estimation**: Estimate implementation costs
- **Status Tracking**: Monitor implementation progress
- **CMMS Integration**: Push to Computerized Maintenance Management System

### 8. RCA Team Management:
**Team Structure**:
- **Team Lead**: Primary investigator
- **Team Members**: Subject matter experts
- **Stakeholders**: Interested parties
- **External Consultants**: Specialized expertise

**Team Features**:
- **Team Charter**: Define team objectives and scope
- **Role Assignment**: Assign specific roles and responsibilities
- **Communication Tools**: Team collaboration features
- **Progress Tracking**: Monitor team progress

### 9. RCA Status Workflow:
**Status Progression**:
1. **Draft**: Initial RCA creation
2. **In Progress**: Active investigation
3. **Analysis**: Data analysis phase
4. **Published**: Findings published
5. **Closed**: RCA completed

**Status Management**:
- **Status Transitions**: Controlled status changes
- **Approval Requirements**: Status change approvals
- **Notification System**: Status change notifications
- **Audit Trail**: Status change history

### 10. RCA Analytics:
**Performance Metrics**:
- **Time to Resolution**: Days from start to completion
- **Implementation Rate**: Percentage of recommendations implemented
- **Effectiveness Score**: Measured improvement
- **Cost Savings**: Financial impact of RCA
- **Failure Rate Reduction**: Pre/post failure rates

**Tracking Features**:
- **ROI Calculation**: Return on investment analysis
- **Effectiveness Review**: Post-implementation assessment
- **Lessons Learned**: Knowledge capture
- **Best Practices**: Process improvement

---

## Master Data Management

### 1. Master Data Overview (MasterData.tsx)
**Purpose**: Centralized management of all reference data and configuration

### 2. Data Categories:

**Organizational Data**:
- **Organizations**: Company/enterprise level
- **Tenants**: Plants/facilities within organizations
- **Units**: Production units within plants
- **Assets**: Equipment and machinery

**Product Data**:
- **Products**: Manufactured products
- **Impact Codes**: Cost and impact categorization
- **OEE Codes**: Overall Equipment Effectiveness codes
- **Reason Codes**: ISA-95 standard reason codes

**Configuration Data**:
- **Dashboard Configuration**: Analytics and display settings
- **RCA Templates**: Pre-defined RCA structures
- **Verification Status Codes**: Status tracking codes
- **Evidence Categories**: Evidence organization

### 3. Data Management Features:
- **CRUD Operations**: Create, read, update, delete
- **Bulk Operations**: Import/export data
- **Validation**: Data integrity checks
- **Audit Trail**: Change tracking
- **Version Control**: Data versioning

### 4. Data Relationships:
**Hierarchical Structure**:
```
Organization
├── Tenants (Plants)
│   ├── Units (Production Lines)
│   │   ├── Assets (Equipment)
│   │   └── Products
│   ├── Impact Codes
│   ├── OEE Codes
│   └── Reason Codes
└── RCA Templates
```

---

## Admin Panel & System Configuration

### 1. Admin Panel Overview (AdminPanel.tsx)
**Purpose**: System administration and configuration management

### 2. Configuration Management:
**Dashboard Configuration**:
- **OEE Settings**: Component weights and targets
- **Loss Configuration**: Loss thresholds and categories
- **Cost Configuration**: Cost calculation methods
- **Display Settings**: UI preferences and themes

**Status Automation**:
- **Event Status Rules**: Automated status changes
- **RCA Status Rules**: RCA workflow automation
- **Notification Rules**: Alert and notification settings

**System Settings**:
- **Performance Configuration**: System performance settings
- **Security Settings**: Access control and authentication
- **Integration Settings**: External system connections
- **Backup Configuration**: Data backup and recovery

### 3. System Monitoring:
**Health Monitoring**:
- **System Status**: Overall system health
- **Performance Metrics**: Response times and throughput
- **Error Tracking**: System errors and exceptions
- **User Activity**: User session monitoring

**Connectivity Status**:
- **Database Connections**: Database health
- **External Integrations**: API connectivity
- **Network Status**: Network connectivity
- **Service Status**: Microservice health

---

## Data Flow & Relationships

### 1. Data Flow Architecture:
```
User Authentication → Plant Selection → Dashboard
                                    ↓
Production Plans ←→ Events ←→ RCA Investigations
                                    ↓
Master Data ←→ Admin Configuration
```

### 2. Key Data Relationships:

**Production Plans → Events**:
- Plans define production targets
- Events track actual production and losses
- Plan deviations trigger events
- Events can be linked to specific plans

**Events → RCA**:
- Events can trigger RCA investigations
- RCA findings can prevent future events
- Event data provides evidence for RCA
- RCA recommendations address event root causes

**Master Data → All Modules**:
- Impact codes determine event costs
- OEE codes categorize equipment effectiveness
- Reason codes standardize event categorization
- Units and assets provide organizational structure

**Users → All Modules**:
- Role-based access control
- User actions tracked in audit logs
- User assignments for tasks and RCAs
- User-specific dashboards and views

### 3. Data Consistency:
**Cross-module Validation**:
- Event validation against production plans
- RCA validation against event data
- User permission validation
- Data integrity checks

**Referential Integrity**:
- Foreign key relationships
- Cascade updates and deletes
- Orphaned data prevention
- Data cleanup procedures

---

## Component Architecture

### 1. Component Hierarchy:
```
App
├── AuthProvider
├── PlantSelectionProvider
├── Layout
│   ├── Navigation
│   ├── PlantSelector
│   └── Main Content
│       ├── Dashboard
│       ├── ProductionPlans
│       ├── EventHub
│       ├── RCAModule
│       ├── MasterData
│       ├── UserManagement
│       └── AdminPanel
└── Shared Components
    ├── UI Components
    ├── Forms
    ├── Modals
    └── Utilities
```

### 2. Shared Components:
**UI Components**:
- **Cards**: Information display containers
- **Buttons**: Action triggers
- **Forms**: Data input components
- **Modals**: Overlay dialogs
- **Tables**: Data display grids
- **Charts**: Data visualization

**Business Components**:
- **EventFormFields**: Dynamic event form fields
- **LogicTreeBuilder**: RCA logic tree construction
- **EvidenceCollector**: Evidence management
- **PlanDashboard**: Production plan analytics
- **AuditTrailViewer**: Change history display

### 3. Component Communication:
**Props**: Parent to child data flow
**Context**: Global state management
**Events**: Child to parent communication
**Services**: Data access and business logic

---

## State Management

### 1. Context Providers:
**AuthContext**: User authentication and session management
**PlantSelectionContext**: Plant/tenant selection and switching
**ToastContext**: Notification and feedback system

### 2. Local State:
**Component State**: UI-specific state management
**Form State**: Form data and validation
**Modal State**: Dialog and overlay management
**Filter State**: Data filtering and search

### 3. Data Persistence:
**Local Storage**: User preferences and session data
**IndexedDB**: Offline data storage
**API Integration**: Backend data synchronization
**Cache Management**: Data caching and invalidation

### 4. State Synchronization:
**Real-time Updates**: Live data updates
**Optimistic Updates**: Immediate UI updates
**Error Handling**: State rollback on errors
**Loading States**: User feedback during operations

---

## Conclusion

The Pro-Act frontend application provides a comprehensive workflow for production loss analysis, from user management through production planning, event monitoring, and root cause analysis. The modular architecture ensures scalability and maintainability, while the role-based access control provides security and appropriate data access levels.

The application's strength lies in its integrated approach to production management, where all modules work together to provide a complete picture of production performance and enable data-driven decision making for continuous improvement. 