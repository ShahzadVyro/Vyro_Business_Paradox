# Employee & Salary System Overview

## Current System Architecture

### 📊 **Core Structure: Star Schema (Dimensional Model)**

```
                    ┌─────────────────┐
                    │   Employees     │
                    │  (Dimension)    │
                    │   499 records   │
                    └────────┬────────┘
                             │
                ┌────────────┼────────────┐
                │            │            │
        ┌───────▼──────┐ ┌──▼──────┐ ┌──▼──────────────┐
        │ Employee_    │ │Employee_│ │Employee_Tax_     │
        │ Salaries     │ │OPD_     │ │Calculations      │
        │ (Fact)       │ │Benefits │ │(Fact)            │
        │ 1,673 records│ │(Fact)   │ │636 records       │
        │              │ │1,019    │ │                  │
        └──────────────┘ │records  │ └──────────────────┘
                         └─────────┘
```

---

## 📋 **1. Employees Table (Master Dimension)**

**Purpose**: Single source of truth for all employee master data

**Current Data**:
- **Total Employees**: 499
  - Active: 158
  - Resigned/Terminated: 341

**Key Fields**:
- **Identity**: Employee_ID (INT64), Full_Name, CNIC_ID, Personal_Email, Official_Email
- **Employment**: Designation, Department, Reporting_Manager, Job_Type, Joining_Date, Employment_Status
- **Personal**: Date_of_Birth, Gender, Marital_Status, Contact_Number, Addresses
- **Banking**: Bank_Name, Bank_Account_Number_IBAN, Bank_Account_Title, Swift_Code_BIC
- **Lifecycle**: Lifecycle_Status, Employment_End_Date, Re_Joined
- **System**: Created_At, Updated_At, Key (composite key)

**Data Sources**:
- Form submissions (onboarding form)
- Manual entry by People team
- External systems (Slack, Google Admin - to be integrated)

---

## 💰 **2. Employee_Salaries Table (Fact Table)**

**Purpose**: Monthly salary transactions - normalized fact table

**Current Data**:
- **Total Records**: 1,673 salary records
- **Unique Employees**: 252 employees with salary data
- **Date Range**: January 2025 to November 2025
- **Currencies**: USD (554 records) + PKR (1,119 records)

**Key Fields**:
- **Employee Link**: Employee_ID (FK to Employees)
- **Time**: Payroll_Month (DATE), Currency (USD/PKR)
- **Salary Components**:
  - Regular_Pay, Prorated_Pay
  - Performance_Bonus, Paid_Overtime
  - Reimbursements, Other
  - PKR-specific: Prorated_Base_Pay, Medical/Transport/Inflation Allowances
- **Income**: Taxable_Income, Gross_Income, Net_Income
- **Deductions**: Tax_Deduction, EOBI, Loan_Deduction, Recoveries, Deductions
- **Employee State at Payroll** (NEW):
  - Designation_At_Payroll
  - Department_At_Payroll
  - Bank_Account_At_Payroll
  - Bank_Name_At_Payroll
  - Salary_Effective_Date

**Data Source**: Migrated from `Salaries Combined-USD.csv` and `Salaries Combined-PKR.csv`

---

## 🏥 **3. Employee_OPD_Benefits Table (Fact Table)**

**Purpose**: Track OPD (Out Patient Department) benefits for PKR salaried employees

**Current Data**:
- **Total Records**: 1,019 OPD records
- **Unique Employees**: 163 employees with OPD benefits
- **Date Range**: January 2025 to December 2025
- **Benefit**: 6000 PKR per month (accumulates if not claimed)

**Key Fields**:
- **Employee Link**: Employee_ID (FK to Employees)
- **Time**: Benefit_Month (DATE)
- **Benefits**: Contribution_Amount, Claimed_Amount, Balance (running balance)
- **Eligibility**: Currency (PKR only), Is_Active

**How It Works**:
- PKR salaried employees get 6000 PKR/month OPD benefit
- If not claimed, balance accumulates (e.g., 3 months = 18K available)
- Can claim accumulated balance anytime

**Data Source**: Migrated from `Salaries - OPD Data.csv` (cleaned header rows)

---

## 💸 **4. Employee_Tax_Calculations Table (Fact Table)**

**Purpose**: Track withholding tax and other tax calculations per payroll month

**Current Data**:
- **Total Records**: 636 tax records
- **Unique Employees**: 152 employees with tax data
- **Date Range**: June 2025 to May 2026

**Key Fields**:
- **Employee Link**: Employee_ID (FK to Employees)
- **Time**: Payroll_Month (DATE)
- **Tax Info**: Taxable_Income, Tax_Amount, Tax_Rate (calculated), Tax_Type, Tax_Bracket

**Data Source**: Migrated from `Salaries - Tax 25-26.csv`

---

## 📈 **5. Employee_Salary_History Table (Fact Table)**

**Purpose**: Track salary, designation, and department changes over time

**Current Data**: Ready for data (0 records currently)

**Key Fields**:
- **Employee Link**: Employee_ID (FK to Employees)
- **Change Info**: Effective_Date, Change_Type (Increment/Promotion/Designation_Change/Department_Change)
- **Before/After**: Previous_Salary, New_Salary, Previous_Designation, New_Designation, Previous_Department, New_Department
- **Audit**: Reason, Approved_By, Created_At, Created_By

**Use Case**: When employee gets increment, promotion, or changes department, create a record here

---

## 🔗 **6. Employee_Field_Updates Table (Audit Table)**

**Purpose**: Track all field changes for audit and compliance

**Key Fields**:
- **Employee Link**: Employee_ID (FK to Employees)
- **Change Info**: Field_Name, Old_Value, New_Value, Updated_Date, Updated_By, Reason

**Use Case**: When bank account changes, designation changes, etc., log it here

---

## 📊 **Views Created**

### 1. **Employee_Current_State_View**
Shows current employee state including:
- Latest designation, department, salary
- Current bank details
- Latest bank account change date
- Salary currency

### 2. **OPD_Balance_View**
Shows OPD benefits summary:
- Total contributions vs total claimed
- Available balance for claiming
- Eligibility status
- Claim history

### 3. **Comprehensive_Salary_View**
Complete salary information joining:
- Employee_Salaries
- Employee state at payroll
- OPD benefits (for PKR employees)
- Tax calculations
- Salary history

---

## 🔧 **Functions Created**

### **Calculate_OPD_Balance(employee_id, as_of_date)**
Calculates running OPD balance for an employee up to a specific date
- Formula: SUM(Contributions) - SUM(Claims)
- Only for PKR salaried employees

---

## 🔄 **How Changes Propagate**

### **When Employee Bank Account Changes**:
1. Update `Employees` table (Bank_Account_Number_IBAN, Bank_Name)
2. Log change in `Employee_Field_Updates` table
3. Future salary records will use new bank account via `Bank_Account_At_Payroll` field

### **When Employee Gets Increment/Promotion**:
1. Update `Employees` table (Designation, Department, Salary)
2. Create record in `Employee_Salary_History` table
3. Future salary records will reflect new salary via `Salary_Effective_Date` field

### **When Employee Changes Department**:
1. Update `Employees` table (Department)
2. Create record in `Employee_Salary_History` table
3. Future salary records will show new department via `Department_At_Payroll` field

---

## 📈 **Data Relationships**

```
Employees (1) ──→ (Many) Employee_Salaries
Employees (1) ──→ (Many) Employee_OPD_Benefits
Employees (1) ──→ (Many) Employee_Tax_Calculations
Employees (1) ──→ (Many) Employee_Salary_History
Employees (1) ──→ (Many) Employee_Field_Updates
```

**All fact tables reference Employees via Employee_ID (INT64)**

---

## ✅ **What's Working**

1. ✅ **Single Source of Truth**: Employees table consolidates all employee data
2. ✅ **Normalized Salary Data**: Salaries separated from employee master data
3. ✅ **OPD Benefits Tracking**: Monthly contributions and claims tracked
4. ✅ **Tax Calculations**: Withholding tax tracked per month
5. ✅ **Historical Tracking**: Tables ready for tracking changes
6. ✅ **Data Validation**: All Employee_IDs validated against Employees table
7. ✅ **Views for Reporting**: Easy-to-query views for dashboards

---

## 🚀 **Next Steps**

1. **Backfill Salary History**: Extract salary changes from existing data
2. **Integrate External Systems**: 
   - Slack sync for Slack_ID
   - Google Admin sync for Group_Name, Group_Email
3. **Automate Updates**: Create procedures/triggers for automatic change tracking
4. **Dashboard Queries**: Use views for reporting and dashboards

---

## 📝 **Example Query: Get Complete Employee Salary Info**

```sql
SELECT 
    e.Full_Name,
    e.Designation,
    e.Department,
    s.Payroll_Month,
    s.Currency,
    s.Gross_Income,
    s.Net_Income,
    t.Tax_Amount,
    opd.Contribution_Amount AS OPD_Contribution,
    opd.Claimed_Amount AS OPD_Claimed,
    `test-imagine-web.Vyro_Business_Paradox.Calculate_OPD_Balance`(e.Employee_ID, s.Payroll_Month) AS OPD_Balance
FROM 
    `test-imagine-web.Vyro_Business_Paradox.Employees` e
LEFT JOIN 
    `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries` s 
    ON e.Employee_ID = s.Employee_ID
LEFT JOIN 
    `test-imagine-web.Vyro_Business_Paradox.Employee_Tax_Calculations` t
    ON e.Employee_ID = t.Employee_ID 
    AND s.Payroll_Month = t.Payroll_Month
LEFT JOIN 
    `test-imagine-web.Vyro_Business_Paradox.Employee_OPD_Benefits` opd
    ON e.Employee_ID = opd.Employee_ID 
    AND s.Payroll_Month = opd.Benefit_Month
    AND s.Currency = 'PKR'
WHERE 
    e.Employee_ID = 5259
ORDER BY 
    s.Payroll_Month DESC;
```

---

## 📊 **Summary Statistics**

| Component | Records | Employees | Date Range |
|-----------|---------|-----------|------------|
| **Employees** | 499 | 499 | N/A |
| **Salaries** | 1,673 | 252 | Jan 2025 - Nov 2025 |
| **OPD Benefits** | 1,019 | 163 | Jan 2025 - Dec 2025 |
| **Tax Calculations** | 636 | 152 | Jun 2025 - May 2026 |
| **Salary History** | 0 | 0 | Ready for data |

---

**Last Updated**: January 2025
**Status**: ✅ Production Ready


