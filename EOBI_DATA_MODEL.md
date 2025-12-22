# EOBI Data Model Explanation

## Overview

EOBI (Employees' Old-Age Benefits Institution) data is managed using a **two-table approach**:

1. **Employees Table** (Dimension Table) - Stores the employee's EOBI registration number
2. **Employee_EOBI Table** (Fact Table) - Stores monthly EOBI submission records

---

## Data Model

### 1. Employees Table (`Employees`)

**Purpose**: Master employee data table that stores the employee's EOBI registration number.

**Key Field**:

- `EOBI_Number` (STRING) - The employee's EOBI registration number assigned by the EOBI portal
  - Example: `"4700G690432"`
  - **One per employee** - This is set once when the employee is registered
  - Can be NULL if the employee hasn't been registered yet

**When Updated**:

- When a new employee is registered with EOBI portal (after uploading registration CSV)
- When importing monthly EOBI data that includes EOBI numbers

---

### 2. Employee_EOBI Table (`Employee_EOBI`)

**Purpose**: Monthly EOBI submission records - one record per employee per month.

**Key Fields**:

- `Employee_ID` (INT64) - Links to Employees table
- `Payroll_Month` (DATE) - The month this record is for (first day of month, e.g., 2025-11-01)
- `EOBI_NO` (STRING) - EOBI number (same as Employees.EOBI_Number, but stored here for historical tracking)
- `NO_OF_DAYS_WORKED` (NUMERIC) - Number of days worked in that month
- `DOB`, `DOJ`, `DOE` (DATE) - Date of birth, joining, exit
- `From_Date`, `To_Date` (DATE) - Period covered (usually 1st to last day of month)
- `EMP_AREA_CODE`, `EMP_REG_SERIAL_NO`, etc. - EOBI portal required fields

**When Created**:

- After generating monthly upload CSV and submitting to EOBI portal
- Import the submitted CSV back into this table for record-keeping

---

## Workflow

### Step 1: Register New Employees

1. **Download Registration CSV** (`/api/eobi/registration`)

   - Includes employees who don't have an EOBI number yet
   - Format: PE01 (Employee Registration format)
   - Fields: NAME, NEW NIC, OLD NIC, F/H NAME, DATE OF BIRTH, DATEOF JOINING EMPLOYER, etc.

2. **Upload to EOBI Portal**

   - Upload the CSV to register new employees
   - EOBI assigns EOBI numbers to each employee

3. **Update Employees Table**
   - Manually update `Employees.EOBI_Number` for each employee
   - OR import the EOBI response CSV (if available) to update automatically

### Step 2: Monthly Submission

1. **Generate Monthly Upload CSV** (`/api/eobi/bulk-upload?month=YYYY-MM`)

   - Select the **previous month** (e.g., in January 2026, generate November 2025 data)
   - Format: PR02A (Monthly Bulk Upload format)
   - Includes **ALL employees** (active, resigned, terminated)
   - For resigned/terminated employees: `NO_OF_DAYS_WORKED = 0` but they're still included

2. **Upload to EOBI Portal**

   - Submit the CSV for the previous month
   - EOBI processes the monthly contributions

3. **Import Submitted Data Back**
   - After submission, import the CSV back using `scripts/import_eobi_data.py`
   - This creates records in `Employee_EOBI` table
   - Also updates `Employees.EOBI_Number` if missing

---

## Example Data Flow

### New Employee Joins (December 2025)

```
1. Employee joins → Employees table has no EOBI_Number
2. Download registration CSV → Includes this employee
3. Upload to EOBI portal → EOBI assigns "4700J792443"
4. Update Employees.EOBI_Number = "4700J792443"
```

### Monthly Submission (January 2026 for November 2025)

```
1. Generate monthly upload CSV for November 2025
   - Includes all employees (active + resigned/terminated)
   - Uses EOBI_Number from Employees table
   - Calculates NO_OF_DAYS_WORKED based on employment dates

2. Upload CSV to EOBI portal

3. Import CSV back:
   - Creates Employee_EOBI records (Payroll_Month = 2025-11-01)
   - Updates Employees.EOBI_Number if missing
   - Updates Employees.Date_of_Birth, Joining_Date, CNIC_ID if missing
```

---

## Why Two Tables?

1. **Employees Table** (`EOBI_Number`):

   - Stores the **current** EOBI registration number
   - Used for generating monthly upload CSVs
   - Quick lookup: "What's this employee's EOBI number?"

2. **Employee_EOBI Table** (`EOBI_NO` + `Payroll_Month`):
   - Stores **historical** monthly submission data
   - Tracks changes over time (e.g., if EOBI number changes)
   - Used for reporting: "How many days did this employee work in November?"
   - Audit trail: "What was submitted to EOBI for each month?"

---

## Key Points

✅ **EOBI_Number in Employees table**: One per employee, set once when registered

✅ **Employee_EOBI table**: One record per employee per month, stores submission history

✅ **Monthly workflow**: Generate CSV → Upload to portal → Import back to database

✅ **All employees included**: Even resigned/terminated employees are included in monthly submissions (with 0 days worked)

---

## SQL Queries

### Get employees without EOBI numbers (for registration)

```sql
SELECT e.*
FROM `test-imagine-web.Vyro_Business_Paradox.Employees` e
LEFT JOIN (
  SELECT DISTINCT Employee_ID
  FROM `test-imagine-web.Vyro_Business_Paradox.Employee_EOBI`
  WHERE EOBI_NO IS NOT NULL AND TRIM(EOBI_NO) != ''
) eobi ON eobi.Employee_ID = e.Employee_ID
WHERE e.Employee_ID IS NOT NULL
  AND eobi.Employee_ID IS NULL
ORDER BY e.Joining_Date DESC
```

### Get monthly EOBI data for an employee

```sql
SELECT
  e.Full_Name,
  eobi.Payroll_Month,
  eobi.EOBI_NO,
  eobi.NO_OF_DAYS_WORKED,
  eobi.From_Date,
  eobi.To_Date
FROM `test-imagine-web.Vyro_Business_Paradox.Employee_EOBI` eobi
JOIN `test-imagine-web.Vyro_Business_Paradox.Employees` e
  ON eobi.Employee_ID = e.Employee_ID
WHERE eobi.Employee_ID = 5090
ORDER BY eobi.Payroll_Month DESC
```
