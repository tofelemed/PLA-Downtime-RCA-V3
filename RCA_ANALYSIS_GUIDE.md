# RCA (Root Cause Analysis) Analysis Guide – Pro-Act Application

## Introduction
Root Cause Analysis (RCA) is a structured process to identify the underlying causes of production events or losses. In Pro-Act, RCA helps teams investigate, document, and resolve issues to prevent recurrence. This guide explains, step-by-step, how to perform RCA in the application, what each field means, and provides a full example with sample data.

---

## RCA Workflow Overview

1. **Trigger an RCA**: Usually starts from a production event (e.g., equipment failure, quality issue).
2. **Create a New RCA**: Fill in the RCA form, linking it to the relevant event.
3. **Build the Logic Tree**: Use the tree to ask "why" and "how" questions, drilling down to root causes.
4. **Collect Evidence**: Attach supporting documents, photos, or notes to logic tree nodes.
5. **Add Recommendations**: Suggest actions to prevent recurrence.
6. **Assign Team & Track Progress**: Define team members, set priorities, and monitor status.
7. **Close the RCA**: Once all actions are complete and verified.

---

## RCA Fields Explained

Below are the fields you will encounter when performing RCA in Pro-Act. Only fields present in your application are included.

### RCA Form Fields
| Field Name         | Description                                                                 | Example/Sample Data                | Dependency/Notes                |
|--------------------|-----------------------------------------------------------------------------|------------------------------------|---------------------------------|
| **eventId**        | The event this RCA is investigating.                                        | `evt_12345`                        | Must select an existing event   |
| **title**          | Short, descriptive title for the RCA.                                       | "Pump B-001 Failure Investigation"| User input                      |
| **description**    | Detailed description of the problem.                                        | "Pump B-001 stopped during shift" | User input                      |
| **priority**       | How critical the issue is. Options: Low, Medium, High, Critical             | `High`                             | User selection                  |
| **targetCloseDate**| When the RCA should be completed.                                           | `2024-07-31`                       | User input                      |
| **templateId**     | (Optional) Use a predefined RCA template for logic tree structure.          | `tmpl_001`                         | Select from available templates |

### Logic Tree Node Fields
| Field Name   | Description                                  | Example/Sample Data         |
|--------------|----------------------------------------------|-----------------------------|
| **id**       | Unique node identifier (auto-generated)      | `node_abc123`               |
| **name**     | The question or statement (e.g., "Why?")   | "Why did the pump fail?"   |
| **code**     | Node code (optional, for reference)         | "F01"                      |
| **category** | Node category (e.g., Root, Why, Cause)      | "Root"                     |
| **description** | The answer or explanation                | "Seal leak due to wear"    |
| **note**     | Additional notes (optional)                  | "Seal overdue for change"  |
| **finding**  | Is this a key finding? (true/false)          | `true`                      |
| **children** | Sub-nodes (for further questions/causes)     | [ ... ]                     |

### Evidence Fields
| Field Name     | Description                                 | Example/Sample Data         |
|----------------|---------------------------------------------|-----------------------------|
| **title**      | Short title for the evidence                | "Photo of failed seal"     |
| **description**| Details about the evidence                  | "Shows visible wear"       |
| **type**       | Type: Photo, Document, Time Series, Note, Video | `Photo`                 |
| **category**   | Evidence category (optional)                | "Maintenance"              |
| **location**   | Where evidence was collected (optional)      | "Pump Room 2"              |
| **timestamp**  | When evidence was collected                  | `2024-07-15T10:30`          |
| **relatedAssetId** | Equipment related to evidence           | `asset_001`                 |
| **severity**   | Severity: Low, Medium, High, Critical       | `High`                      |
| **tags**       | Searchable tags (comma-separated)           | "seal, failure, pump"      |
| **verified**   | Has the evidence been verified? (true/false)| `true`                      |
| **fiveP**      | 5P category: Parts, Paper, People, Place, Process | `Parts`                |
| **task**       | Related task (optional)                     | "Replace seal"             |
| **dueDate**    | Task due date (optional)                    | `2024-07-20`                |
| **status**     | Status: pending, completed                  | `pending`                   |
| **attachments**| Files attached (photos, docs, etc.)         | [file1.jpg, file2.pdf]      |

### Recommendation Fields
| Field Name     | Description                                 | Example/Sample Data         |
|----------------|---------------------------------------------|-----------------------------|
| **title**      | Short title for the recommendation          | "Replace all pump seals"   |
| **description**| Details about the recommendation            | "Schedule preventive maintenance for all pumps" |
| **priority**   | Priority: Low, Medium, High                 | `High`                      |
| **assigneeId** | User assigned to the recommendation         | `user_002`                  |
| **dueDate**    | When the action should be completed         | `2024-08-01`                |
| **estimatedCost** | Estimated cost (optional)                | `500`                       |
| **status**     | Status: Open, In Progress, Completed, Cancelled | `Open`                  |

### Team Fields
| Field Name     | Description                                 | Example/Sample Data         |
|----------------|---------------------------------------------|-----------------------------|
| **teamLeadId** | User leading the RCA                        | `user_001`                  |
| **teamMemberIds** | Other team members                       | [`user_002`, `user_003`]    |
| **teamCharter**| Team's objective/mission (optional)         | "Reduce pump failures by 50%" |

### RCA Status
- **Draft**: RCA is being prepared
- **In Progress**: Investigation ongoing
- **Analysis**: Data and evidence being analyzed
- **Published**: Findings and recommendations published
- **Closed**: All actions completed and verified

---

## Step-by-Step RCA Example (With Sample Data)

### Scenario
A production event is recorded: "Pump B-001 stopped during night shift, causing a 2-hour production loss."

### Step 1: Event Creation (Dependency)
- **Module**: Event Hub
- **Fields**: unitId, assetId, description, startTime, endTime, eventType, status
- **Sample Data**:
  - unitId: `unit_01` ("Line A")
  - assetId: `asset_001` ("Pump B-001")
  - description: "Pump B-001 stopped during night shift."
  - startTime: `2024-07-15T22:00`
  - endTime: `2024-07-15T24:00`
  - eventType: `ProductionLoss`
  - status: `Open`

### Step 2: Trigger RCA from Event
- In the Event Hub, select the event and choose "Initiate RCA".

### Step 3: Fill RCA Form
| Field            | Example Value                        |
|------------------|--------------------------------------|
| eventId          | `evt_12345` (the event above)        |
| title            | "Pump B-001 Failure Investigation"   |
| description      | "Pump B-001 stopped during night shift, causing 2-hour loss."
| priority         | `High`                               |
| targetCloseDate  | `2024-07-31`                         |
| templateId       | (optional, e.g., `tmpl_001`)         |

### Step 4: Build Logic Tree
- **Root Node**: "Why did Pump B-001 stop?"
  - **Child Node**: "Seal leak due to wear"
    - **Child Node**: "Seal replacement overdue"
      - **Child Node**: "Maintenance schedule not followed"

#### Example Logic Tree (as entered in the UI):
| Node Name                        | Category | Description                  | Finding |
|----------------------------------|----------|------------------------------|---------|
| Why did Pump B-001 stop?         | Root     | Pump stopped unexpectedly    |         |
| └─ Seal leak due to wear         | Why      | Seal was visibly worn        | true    |
|    └─ Seal replacement overdue   | Cause    | Last replaced 18 months ago  | true    |
|       └─ Maintenance schedule... | Cause    | Missed last scheduled PM     | true    |

### Step 5: Attach Evidence
- **Evidence 1**:
  - title: "Photo of failed seal"
  - description: "Shows visible wear on seal"
  - type: `Photo`
  - category: "Maintenance"
  - location: "Pump Room 2"
  - timestamp: `2024-07-15T23:00`
  - relatedAssetId: `asset_001`
  - severity: `High`
  - tags: "seal, failure, pump"
  - verified: `true`
  - fiveP: `Parts`
  - status: `pending`
  - attachments: [photo.jpg]

- **Evidence 2**:
  - title: "Maintenance log excerpt"
  - description: "Shows missed PM in June"
  - type: `Document`
  - category: "Maintenance"
  - location: "Maintenance Office"
  - timestamp: `2024-07-16T09:00`
  - relatedAssetId: `asset_001`
  - severity: `Medium`
  - tags: "maintenance, schedule"
  - verified: `true`
  - fiveP: `Paper`
  - status: `pending`
  - attachments: [log.pdf]

### Step 6: Add Recommendations
- **Recommendation 1**:
  - title: "Replace all pump seals"
  - description: "Schedule preventive maintenance for all pumps every 12 months."
  - priority: `High`
  - assigneeId: `user_002` (Maintenance Lead)
  - dueDate: `2024-08-01`
  - estimatedCost: `500`
  - status: `Open`

- **Recommendation 2**:
  - title: "Review maintenance schedule compliance"
  - description: "Audit maintenance records for all critical assets."
  - priority: `Medium`
  - assigneeId: `user_003` (QA Manager)
  - dueDate: `2024-08-10`
  - estimatedCost: `0`
  - status: `Open`

### Step 7: Assign Team & Track Progress
- **Team Lead**: `user_001` (Reliability Engineer)
- **Team Members**: [`user_002` (Maintenance Lead), `user_003` (QA Manager)]
- **Team Charter**: "Reduce pump failures by 50% in 6 months."
- **Status**: Move RCA from Draft → In Progress → Analysis → Published → Closed as actions are completed.

### Step 8: Close the RCA
- Once all recommendations are implemented and verified, set status to **Closed**.
- The RCA, evidence, and recommendations remain available for future reference and audits.

---

## Module Dependencies & Data Flow

- **Event Hub**: RCA must be linked to an existing event.
- **User Management**: Team members and assignees are selected from users.
- **Master Data**: Assets, units, and templates are pulled from master data.
- **RCA Module**: All RCA logic, evidence, and recommendations are managed here.

---

## Summary
- Always start RCA from a real event.
- Fill each field as described above, using only the options and data available in the app.
- Use evidence and recommendations to support your findings.
- Assign a team and track progress through status changes.
- Close the RCA when all actions are complete.

This guide ensures anyone, regardless of technical background, can perform a complete RCA in Pro-Act using only the fields and flows present in your application. 