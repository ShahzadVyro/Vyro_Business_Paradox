# Onboarding Tables Analysis

## Summary

This document explains the difference between `EmployeeIntake_v1` and `Employee_Onboarding_Intake` tables and their usage in the codebase.

---

## Table Comparison

### EmployeeIntake_v1

**Status:** ✅ EXISTS (created automatically by code if missing)

**Environment Variable:** `BQ_INTAKE_TABLE` (default: `"EmployeeIntake_v1"`)

**Used By:** `employee-management-app/src/lib/onboarding.ts`

**Purpose:** Stores onboarding form submissions from new employee intake forms

**Schema:**

```sql
CREATE TABLE EmployeeIntake_v1 (
  Submission_ID STRING NOT NULL,
  Status STRING,                    -- "pending", "approved", etc.
  Payload JSON,                      -- Full form submission data
  Slack_TS STRING,                   -- Slack message timestamp
  Slack_Channel STRING,              -- Slack channel where notification was sent
  Approved_By STRING,                -- User who approved the submission
  Employee_ID STRING,               -- Assigned after approval
  Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  Updated_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
```

**Key Functions:**

- `createOnboardingSubmission()` - Creates new intake submission with Status="pending"
- `getPendingSubmissions()` - Gets all pending submissions
- `approveSubmission()` - Updates status to "approved" and assigns Employee_ID
- `getSubmissionById()` - Retrieves specific submission

**Data Flow:**

1. New employee fills onboarding form
2. Form submission stored in `EmployeeIntake_v1` with Status="pending"
3. Slack notification sent to People team
4. People team reviews and approves
5. Status updated to "approved" and Employee_ID assigned
6. Employee record created in `Employees` table

---

### Employee_Onboarding_Intake

**Status:** ❌ DOES NOT EXIST

**Environment Variable:** `BQ_ONBOARDING_TABLE` (default: `"Employee_Onboarding_Intake"`)

**Used By:** `employee-management-app/src/lib/dashboard.ts` (line 306)

**Purpose:** Dashboard tries to count pending onboarding requests

**Query Attempted:**

```sql
SELECT COUNT(*) as count
FROM Employee_Onboarding_Intake
WHERE Status = 'pending'
```

**Current Behavior:**

- Query fails with "Table not found" error
- Error is caught and handled gracefully
- Returns 0 for pending requests count
- Dashboard still works, but shows 0 pending requests

---

## The Problem

**Mismatch:** Dashboard is trying to query a table that doesn't exist, while the actual onboarding data is stored in `EmployeeIntake_v1`.

**Impact:**

- Dashboard shows 0 pending requests (even if there are pending submissions)
- Error logged in Vercel logs (non-critical, handled gracefully)
- Confusion about which table to use

---

## Solution Options

### Option 1: Update Dashboard to Use Same Table (Recommended)

**Change:** Update `dashboard.ts` to use `BQ_INTAKE_TABLE` instead of `BQ_ONBOARDING_TABLE`

**File:** `employee-management-app/src/lib/dashboard.ts`

**Line 306:** Change from:

```typescript
const onboardingTable =
  process.env.BQ_ONBOARDING_TABLE ?? "Employee_Onboarding_Intake";
```

To:

```typescript
const onboardingTable = process.env.BQ_INTAKE_TABLE ?? "EmployeeIntake_v1";
```

**Benefits:**

- Dashboard shows correct pending requests count
- Single source of truth for onboarding data
- No more "table not found" errors
- Simpler configuration

---

### Option 2: Create Employee_Onboarding_Intake Table

**If you want separate tables for different purposes:**

Create the table with same schema as `EmployeeIntake_v1`:

```sql
CREATE TABLE IF NOT EXISTS `test-imagine-web.Vyro_Business_Paradox.Employee_Onboarding_Intake` (
  Submission_ID STRING NOT NULL,
  Status STRING,
  Payload JSON,
  Slack_TS STRING,
  Slack_Channel STRING,
  Approved_By STRING,
  Employee_ID STRING,
  Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  Updated_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
```

**Then:**

- Keep `BQ_ONBOARDING_TABLE` pointing to `Employee_Onboarding_Intake`
- Keep `BQ_INTAKE_TABLE` pointing to `EmployeeIntake_v1`
- Manually sync data between tables or use them for different purposes

---

### Option 3: Remove Pending Requests Feature

**If you don't need this feature:**

Remove the `fetchPendingRequests` function from `dashboard.ts` and remove it from the summary response.

---

## Recommendation

**Use Option 1** - Update dashboard to use `BQ_INTAKE_TABLE` because:

1. ✅ `EmployeeIntake_v1` already exists and is actively used
2. ✅ Dashboard should show pending requests from the same source
3. ✅ Simpler - one less table to manage
4. ✅ No data duplication
5. ✅ Fixes the error immediately

---

## How to Verify

Run the SQL queries in `database/check_onboarding_tables.sql` to:

1. Check if `EmployeeIntake_v1` exists and has data
2. Check if `Employee_Onboarding_Intake` exists
3. See sample data from `EmployeeIntake_v1`
4. Compare schemas if both exist
5. Count pending requests in `EmployeeIntake_v1`

Or run the Python script:

```bash
python3 scripts/check_onboarding_tables.py
```

---

## Current Code Usage

### onboarding.ts (Uses EmployeeIntake_v1)

- ✅ Creates table automatically if missing
- ✅ Inserts new submissions
- ✅ Queries pending submissions
- ✅ Updates submission status
- ✅ Links to Employee_ID after approval

### dashboard.ts (Tries to use Employee_Onboarding_Intake)

- ❌ Table doesn't exist
- ⚠️ Query fails but handled gracefully
- ⚠️ Returns 0 for pending count
- ✅ Dashboard still works (just shows 0)

---

## Next Steps

1. Run the SQL queries to see actual data in `EmployeeIntake_v1`
2. Decide: Use same table (Option 1) or create separate table (Option 2)
3. Update code accordingly
4. Test dashboard to verify pending requests count works
