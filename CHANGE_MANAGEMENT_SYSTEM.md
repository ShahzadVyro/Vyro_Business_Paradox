# Employee Change Management System

**Date:** October 30, 2025  
**Version:** 1.0

---

## 🎯 Overview

This document outlines how to manage employee data changes, including:

- Account/data change requests
- Promotions
- Department/Designation changes
- Employment status changes (Active ↔ Resigned/Terminated)
- Probation management

---

## 📊 Current Workflow (Google Sheets Based)

### New Employee Onboarding

```
1. Employee fills Google Form
   ↓
2. Data stored in "Employee_Information" sheet
   ↓
3. Slack notification sent to #people-team
   "🆕 New joiner: [Name] submitted onboarding form"
   ↓
4. Recruiter/People Team reviews form
   ↓
5. Manual steps:
   - Generate Employee ID (e.g., EMP-0293)
   - Create official email ([firstname.lastname@vyro.ai](mailto:firstname.lastname@vyro.ai))
   - Add employee to "Active" sheet
   - Set probation end date
   ↓
6. Employee onboarding complete
```

### Employee Leaves Company

```
Current Process (Problematic):
1. Delete row from "Active" sheet
2. Copy/paste same row into "ResignedTerminated" sheet
3. Add Employment_End_Date manually

Issues:
- No history preserved
- Easy to make errors
- No audit trail
```

---

## 🚀 Improved System (BigQuery-Based)

### 1. **New Employee Onboarding** (Automated)

#### Step 1: Google Form Submission

```
Employee fills form → Employee_Information sheet → Trigger Apps Script
```

#### Step 2: Apps Script Processing

```javascript
// Google Apps Script (pseudo-code)
function onFormSubmit(e) {
  // 1. Get form data
  const formData = e.namedValues;

  // 2. Generate Employee ID
  const nextEmpId = getNextEmployeeId(); // Query BigQuery for max ID

  // 3. Generate official email
  const officialEmail = generateEmail(formData["Full Name"]);

  // 4. Calculate probation end date (e.g., 3 months from joining)
  const joiningDate = new Date(formData["Joining Date"]);
  const probationEndDate = new Date(joiningDate);
  probationEndDate.setMonth(probationEndDate.getMonth() + 3);

  // 5. Prepare employee record
  const employeeRecord = {
    Employee_ID: nextEmpId,
    Full_Name: formData["Full Name"],
    Personal_Email: formData["Personal Email"],
    Official_Email: officialEmail,
    Employment_Status: "Pending Onboarding", // Not "Active" yet
    Probation_End_Date: probationEndDate,
    Onboarding_Status: "Pending Review",
    Created_At: new Date(),
    Created_By: "Google Form Automation",
    // ... all other fields from form
  };

  // 6. Insert into BigQuery (staging table)
  insertToBigQuery("EmployeeData_Pending", employeeRecord);

  // 7. Send Slack notification
  sendSlackNotification({
    channel: "#people-team",
    message:
      `🆕 New joiner submitted form: ${formData["Full Name"]}\n` +
      `Employee ID: ${nextEmpId}\n` +
      `Official Email: ${officialEmail}\n` +
      `Probation End: ${probationEndDate.toDateString()}\n` +
      `Review: <link_to_review_page>`,
  });
}
```

#### Step 3: People Team Review & Approval

```
People team member reviews in UI:
- Verify all information
- Edit if needed (email, probation date, etc.)
- Click "Approve Onboarding"
  ↓
Employee status: "Pending Onboarding" → "Active"
Onboarding_Status: "Pending Review" → "Approved"
  ↓
Moved from staging to main EmployeeData table
```

---

### 2. **Account/Data Change Requests**

#### Use Case Examples:

- Employee wants to update bank account
- Employee got married → update marital status, spouse info
- Employee moved → update address
- Employee wants to change emergency contact

#### Workflow:

**Option A: Employee Self-Service (Recommended)**

```
1. Employee fills "Change Request Form" (Google Form or React UI)
   Fields:
   - Employee ID
   - What needs to change
   - Old value
   - New value
   - Reason for change
   - Supporting documents (if any)

2. Request stored in "Change_Requests" table in BigQuery
   {
     Request_ID: "CR-001",
     Employee_ID: "EMP-0123",
     Field_To_Change: "Bank_Account_Number",
     Current_Value: "PK12XXXX...",
     Requested_Value: "PK34XXXX...",
     Reason: "Changed bank",
     Status: "Pending Approval",
     Requested_By: "employee.name@vyro.ai",
     Requested_At: "2025-10-30 10:00:00",
     Supporting_Docs: ["url_to_new_bank_statement"]
   }

3. Slack notification to People Team
   "📝 Change request from Ali Khan (EMP-0123)
    Field: Bank Account Number
    Review: <link>"

4. People Team reviews and approves/rejects

5. If approved:
   - Update EmployeeData table
   - Add entry to Change_Details JSON field:
     {
       "timestamp": "2025-10-30 14:30:00",
       "changed_by": "hr@vyro.ai",
       "field": "Bank_Account_Number",
       "old_value": "PK12XXXX...",
       "new_value": "PK34XXXX...",
       "reason": "Changed bank",
       "request_id": "CR-001"
     }
   - Update Change_Requests status: "Approved"
   - Send confirmation to employee
```

**Option B: People Team Initiated**

```
People team member updates directly in UI:
1. Search for employee
2. Click "Edit"
3. Make changes
4. Add reason for change
5. Save
   ↓
Change automatically logged in Change_Details JSON field
```

---

### 3. **Promotions & Department/Designation Changes**

#### Promotion Workflow:

```
1. Manager nominates employee for promotion
   OR
   People Team initiates promotion

2. Fill "Promotion Form":
   - Employee ID
   - Current Designation
   - New Designation
   - Current Department (if changing)
   - New Department (if changing)
   - Current Salary (if changing)
   - New Salary (if changing)
   - Effective Date
   - Reason/Justification

3. Approval workflow:
   Reporting Manager → Department Head → People Team → Final Approval

4. Once approved, update employee record:

   UPDATE EmployeeData SET
     Designation = 'New Designation',
     Department = 'New Department' (if changed),
     Basic_Salary = new_salary (if changed),

     -- Log in designation change history (JSON)
     Designation_Change_History = JSON_APPEND(
       Designation_Change_History,
       {
         "effective_date": "2025-11-01",
         "from_designation": "Software Engineer",
         "to_designation": "Senior Software Engineer",
         "from_department": "Backend",
         "to_department": "Backend",
         "reason": "Annual performance review - exceeded expectations",
         "approved_by": "cto@vyro.ai",
         "approved_at": "2025-10-30"
       }
     ),

     -- Also log in general change details
     Change_Details = JSON_APPEND(
       Change_Details,
       {
         "type": "PROMOTION",
         "effective_date": "2025-11-01",
         "changes": {...}
       }
     ),

     Updated_At = CURRENT_TIMESTAMP(),
     Updated_By = 'hr@vyro.ai'
   WHERE Employee_ID = 'EMP-0123';

5. Send notifications:
   - Slack announcement: "🎉 Congratulations to [Name] on promotion!"
   - Email to employee with promotion letter
   - Update salary in payroll system
```

#### Department Change (Transfer):

```
Same as promotion workflow, but:
- No designation change
- Focus on department change
- Log in Department_Change_History JSON field

Example entry:
{
  "effective_date": "2025-11-15",
  "from_department": "Marketing",
  "to_department": "Product",
  "from_manager": "marketing.manager@vyro.ai",
  "to_manager": "product.manager@vyro.ai",
  "reason": "Internal transfer - employee request",
  "approved_by": "coo@vyro.ai"
}
```

---

### 4. **Employment Status Changes**

#### Making Employee Resigned/Terminated:

```
1. People Team initiates "Exit Process"
   - Employee ID
   - Exit Type: Resignation / Termination
   - Last Working Day (Employment_End_Date)
   - Reason (optional, for Termination)
   - Exit Interview Notes

2. Update employee record:

   UPDATE EmployeeData SET
     Employment_Status = 'Resigned', -- or 'Terminated'
     Employment_End_Date = '2025-11-15',

     Change_Details = JSON_APPEND(
       Change_Details,
       {
         "type": "EXIT",
         "exit_type": "Resignation",
         "last_working_day": "2025-11-15",
         "reason": "Personal reasons",
         "processed_by": "hr@vyro.ai",
         "processed_at": "2025-10-30"
       }
     ),

     Updated_At = CURRENT_TIMESTAMP(),
     Updated_By = 'hr@vyro.ai'
   WHERE Employee_ID = 'EMP-0123';

3. DO NOT DELETE THE ROW!
   - Keep all history
   - Employee appears in "Former_Employees" view
   - Can still run reports on their tenure

4. Automated tasks triggered:
   - Disable official email (after last working day)
   - Remove from Slack (or deactivate)
   - Remove from access systems
   - Generate exit documents
```

#### Re-joining Employee:

```
If employee comes back:

1. Check if Employee_ID exists with Employment_Status = 'Resigned'

2. Update:
   UPDATE EmployeeData SET
     Employment_Status = 'Active',
     Employment_End_Date = NULL,
     Rejoined = TRUE,
     Joining_Date = '2025-12-01', -- New joining date

     Change_Details = JSON_APPEND(
       Change_Details,
       {
         "type": "REJOINED",
         "rejoin_date": "2025-12-01",
         "previous_exit_date": "2025-11-15",
         "processed_by": "hr@vyro.ai"
       }
     )
   WHERE Employee_ID = 'EMP-0123';

3. Re-create official email
4. Re-add to Slack
5. Onboard again
```

---

### 5. **Probation Management**

#### Setting Probation End Date:

**Option 1: Automatic (Recommended)**

```
When employee is added:
- Probation_Period_Months = 3 (or 6, as per policy)
- Probation_Start_Date = Joining_Date
- Probation_End_Date = Joining_Date + Probation_Period_Months
```

**Option 2: Manual by People Team**

```
People Team can override:
1. Go to employee record
2. Click "Set Probation End Date"
3. Enter date
4. Reason for override (if different from default)
5. Save
```

#### Probation Review:

```
Automated reminder 2 weeks before probation ends:
- Slack notification to Reporting Manager
- Email to People Team
- "Probation ending for [Name] on [Date] - Schedule review"

After review:
1. Manager fills probation review form
2. Outcome: Confirmed / Extended / Terminated

3. If Confirmed:
   UPDATE EmployeeData SET
     Onboarding_Status = 'Probation Confirmed',
     Change_Details = JSON_APPEND(...probation confirmation details...)

4. If Extended:
   UPDATE EmployeeData SET
     Probation_End_Date = new_date,
     Change_Details = JSON_APPEND(...extension details with reason...)

5. If Not Confirmed (Termination):
   Follow termination workflow
```

---

## 📋 BigQuery Schema Additions for Change Management

### Main Table Updates:

```sql
-- Already in proposed schema:
Department_Change_History JSON  -- Array of department changes
Designation_Change_History JSON  -- Array of promotions/designation changes
Change_Details JSON              -- All changes audit trail

-- Example structure:
Change_Details: [
  {
    "timestamp": "2025-10-30 10:00:00",
    "type": "FIELD_UPDATE",
    "field": "Bank_Account_Number",
    "old_value": "...",
    "new_value": "...",
    "changed_by": "hr@vyro.ai",
    "reason": "Employee request",
    "request_id": "CR-001"
  },
  {
    "timestamp": "2025-11-01 09:00:00",
    "type": "PROMOTION",
    "from_designation": "Software Engineer",
    "to_designation": "Senior Software Engineer",
    "effective_date": "2025-11-01",
    "approved_by": "cto@vyro.ai",
    "salary_change": {
      "from": 100000,
      "to": 130000
    }
  },
  {
    "timestamp": "2025-11-15 16:00:00",
    "type": "EXIT",
    "exit_type": "Resignation",
    "last_working_day": "2025-11-15",
    "processed_by": "hr@vyro.ai"
  }
]
```

### New Supporting Tables:

```sql
-- 1. Change Requests Table
CREATE TABLE EmployeeData_Change_Requests (
  Request_ID STRING NOT NULL,
  Employee_ID STRING NOT NULL,
  Request_Type STRING, -- 'FIELD_UPDATE', 'PROMOTION', 'TRANSFER', 'EXIT'
  Field_To_Change STRING,
  Current_Value STRING,
  Requested_Value STRING,
  Reason STRING,
  Supporting_Documents JSON,
  Status STRING, -- 'Pending', 'Approved', 'Rejected'
  Requested_By STRING,
  Requested_At TIMESTAMP,
  Reviewed_By STRING,
  Reviewed_At TIMESTAMP,
  Review_Comments STRING
);

-- 2. Pending Employees (Onboarding)
CREATE TABLE EmployeeData_Pending (
  -- Same structure as EmployeeData
  -- Used for new joiners pending approval
);

-- 3. Promotion Requests
CREATE TABLE Promotion_Requests (
  Request_ID STRING NOT NULL,
  Employee_ID STRING NOT NULL,
  Current_Designation STRING,
  Proposed_Designation STRING,
  Current_Department STRING,
  Proposed_Department STRING,
  Current_Salary FLOAT64,
  Proposed_Salary FLOAT64,
  Effective_Date DATE,
  Justification STRING,
  Status STRING,
  Requested_By STRING,
  Requested_At TIMESTAMP,
  Approval_Chain JSON, -- Array of approvals
  Final_Approved_By STRING,
  Final_Approved_At TIMESTAMP
);
```

---

## 🎨 Future React/Express Application

### Architecture:

```
Frontend (React)
├── Pages
│   ├── Dashboard (overview, quick stats)
│   ├── Employee List (searchable, filterable)
│   ├── Employee Details (view full profile)
│   ├── Employee Edit (people team only)
│   ├── New Joiner Form (replaces Google Form)
│   ├── Change Request Form (employee self-service)
│   ├── Promotion Workflow
│   ├── Exit Process
│   └── Reports & Analytics
│
├── Components
│   ├── EmployeeCard
│   ├── ChangeHistory Timeline
│   ├── ApprovalWorkflow
│   └── DataQuality Indicators
│
└── Features
    ├── Role-based access control
    ├── Real-time Slack integration
    ├── Document upload (Google Drive)
    └── Audit trail viewer

Backend (Express/Node.js)
├── API Routes
│   ├── /api/employees (CRUD)
│   ├── /api/change-requests
│   ├── /api/promotions
│   ├── /api/onboarding
│   └── /api/reports
│
├── Services
│   ├── BigQueryService (database)
│   ├── SlackService (notifications)
│   ├── GoogleWorkspaceService (email creation)
│   ├── AuthService (authentication)
│   └── AuditService (change logging)
│
└── Middleware
    ├── Authentication
    ├── Authorization (role-based)
    └── Audit logging

Database (BigQuery)
├── EmployeeData (main table)
├── EmployeeData_Pending (onboarding)
├── Change_Requests
├── Promotion_Requests
└── Audit_Log
```

### Key Features:

1. **Dashboard**

   - Total employees (Active/Resigned/Terminated)
   - New joiners this month
   - Pending change requests
   - Probations ending soon
   - Department-wise breakdown

2. **Employee Profile View**

   - All employee information
   - Change history timeline
   - Documents
   - Performance reviews (future)
   - Attendance summary (future)

3. **People Team Features**

   - Quick edit any field
   - Approve change requests
   - Process promotions
   - Manage exits
   - Bulk operations

4. **Employee Self-Service**

   - View own profile
   - Request changes
   - Upload documents
   - View payslips (future)

5. **Reports**
   - Headcount by department
   - Attrition rate
   - Average tenure
   - Promotion history
   - Export to Excel/PDF

---

## 📝 Implementation Phases

### Phase 1: Improve Current System (This Month)

- [x] Consolidate data to single source
- [ ] Add Change_Details JSON to track all changes
- [ ] Stop deleting rows (use Employment_Status instead)
- [ ] Document manual workflows

### Phase 2: Semi-Automation (Next Month)

- [ ] Apps Script for Google Form → BigQuery
- [ ] Automated Employee ID generation
- [ ] Automated Slack notifications
- [ ] Change request Google Form

### Phase 3: React Application (Month 3-4)

- [ ] Build React frontend
- [ ] Build Express backend
- [ ] BigQuery integration
- [ ] Replace Google Forms

### Phase 4: Full Automation (Month 5-6)

- [ ] Approval workflows
- [ ] Google Workspace integration (auto email creation)
- [ ] Slack bot integration
- [ ] Advanced reporting

---

## 🔐 Access Control

### Roles:

1. **People Team Admin**

   - Full access to everything
   - Can edit any field
   - Can approve/reject requests
   - Can see salary info

2. **People Team Member**

   - Can view all employees
   - Can edit most fields (not salary)
   - Can approve basic change requests

3. **Manager**

   - Can view team members
   - Can initiate promotions for team
   - Can view basic info (no salary)

4. **Employee**
   - Can view own profile
   - Can request changes
   - Can upload documents

---

**Questions or need clarification?** This is your roadmap for proper employee data management!
