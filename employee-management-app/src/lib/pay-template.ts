import "server-only";
import { getBigQueryClient } from "@/lib/bigquery";
import type { PayTemplateNewHire, PayTemplateLeaver, PayTemplateIncrement, PayTemplateConfirmation } from "@/types/payroll";

const projectId = process.env.GCP_PROJECT_ID;
const dataset = process.env.BQ_DATASET;

if (!projectId || !dataset) {
  throw new Error("Missing BigQuery configuration for pay template");
}

const employeesTableRef = `\`${projectId}.${dataset}.${process.env.BQ_TABLE ?? "Employees"}\``;
const salariesTableRef = `\`${projectId}.${dataset}.Salaries\``;
const payTemplateIncrementsTableRef = `\`${projectId}.${dataset}.Pay_Template_Increments\``;
const payTemplateConfirmationsTableRef = `\`${projectId}.${dataset}.Pay_Template_Confirmations\``;

// Lookup Employee ID by name or email
export async function lookupEmployeeId(name: string, email?: string): Promise<string | null> {
  try {
    const bigquery = getBigQueryClient();
    const query = `
      SELECT Employee_ID
      FROM ${employeesTableRef}
      WHERE Full_Name = @name
         OR Official_Email = @email
      LIMIT 1
    `;
    
    const [rows] = await bigquery.query({
      query,
      params: {
        name,
        email: email || "",
      },
    });
    
    if (rows.length > 0) {
      return String((rows[0] as { Employee_ID: string | number }).Employee_ID);
    }
    return null;
  } catch (error) {
    console.error('[PAY_TEMPLATE] Error looking up Employee ID:', error);
    return null;
  }
}

// Lookup Previous Salary from Salaries table or Employees table
export async function lookupPreviousSalary(employeeId: string, currency: string): Promise<number | null> {
  try {
    const bigquery = getBigQueryClient();
    
    // First try: Get latest Gross_Income from Salaries table
    const salariesQuery = `
      SELECT Gross_Income
      FROM ${salariesTableRef}
      WHERE Employee_ID = @employeeId
        AND Currency = @currency
      ORDER BY Payroll_Month DESC
      LIMIT 1
    `;
    
    const [salaryRows] = await bigquery.query({
      query: salariesQuery,
      params: {
        employeeId: Number(employeeId),
        currency,
      },
    });
    
    if (salaryRows.length > 0) {
      const grossIncome = (salaryRows[0] as { Gross_Income: number }).Gross_Income;
      if (grossIncome != null) {
        return Number(grossIncome);
      }
    }
    
    // Second try: Get Gross_Salary from Employees table
    const employeesQuery = `
      SELECT Gross_Salary
      FROM ${employeesTableRef}
      WHERE Employee_ID = @employeeId
    `;
    
    const [employeeRows] = await bigquery.query({
      query: employeesQuery,
      params: {
        employeeId: Number(employeeId),
      },
    });
    
    if (employeeRows.length > 0) {
      const grossSalary = (employeeRows[0] as { Gross_Salary: number }).Gross_Salary;
      if (grossSalary != null) {
        return Number(grossSalary);
      }
    }
    
    return null;
  } catch (error) {
    console.error('[PAY_TEMPLATE] Error looking up Previous Salary:', error);
    return null;
  }
}

// Get latest currency from Salaries table for an employee
export async function getLatestCurrency(employeeId: string): Promise<string | null> {
  try {
    const bigquery = getBigQueryClient();
    const query = `
      SELECT Currency
      FROM ${salariesTableRef}
      WHERE Employee_ID = @employeeId
      ORDER BY Payroll_Month DESC
      LIMIT 1
    `;
    
    const [rows] = await bigquery.query({
      query,
      params: { employeeId: Number(employeeId) },
    });
    
    if (rows.length > 0) {
      return String((rows[0] as { Currency: string }).Currency);
    }
    return null;
  } catch (error) {
    console.error('[PAY_TEMPLATE] Error looking up currency:', error);
    return null;
  }
}

// Fetch New Hires for a given month - now queries Employees table directly
export async function fetchNewHires(month: string): Promise<PayTemplateNewHire[]> {
  try {
    const bigquery = getBigQueryClient();
    
    const query = `
      SELECT 
        e.Employee_ID,
        e.Full_Name as Employee_Name,
        e.Designation,
        e.Official_Email,
        e.Joining_Date as Date_of_Joining,
        COALESCE(s.Gross_Income, 0) as Salary,
        e.Employment_Location,
        e.Bank_Name,
        e.Bank_Account_Title,
        e.Account_Number_IBAN as Bank_Account_Number_IBAN,
        e.Swift_Code_BIC,
        e.Created_At,
        e.Updated_At
      FROM ${employeesTableRef} e
      LEFT JOIN (
        SELECT 
          Employee_ID,
          Gross_Income,
          ROW_NUMBER() OVER (PARTITION BY Employee_ID ORDER BY Payroll_Month DESC) as rn
        FROM ${salariesTableRef}
      ) s ON SAFE_CAST(e.Employee_ID AS INT64) = SAFE_CAST(s.Employee_ID AS INT64) AND s.rn = 1
      WHERE FORMAT_DATE('%Y-%m', e.Joining_Date) = @month
        AND e.Employment_Status = 'Active'
      ORDER BY e.Joining_Date ASC
    `;
    
    const [rows] = await bigquery.query({
      query,
      params: { month },
    });
    
    return (rows as any[]).map((row) => {
      // Try to get currency from latest salary, default to PKR
      const currency = 'PKR'; // Default, can be enhanced later if needed
      
      return {
        Type: 'New Hire',
        Month: month,
        Employee_ID: row.Employee_ID ? String(row.Employee_ID) : null,
        Employee_Name: String(row.Employee_Name ?? ''),
        Designation: row.Designation ? String(row.Designation) : null,
        Official_Email: row.Official_Email ? String(row.Official_Email) : null,
        Date_of_Joining: row.Date_of_Joining ? String(row.Date_of_Joining).split('T')[0] : '',
        Currency: currency,
        Salary: Number(row.Salary ?? 0),
        Employment_Location: row.Employment_Location ? String(row.Employment_Location) : null,
        Bank_Name: row.Bank_Name ? String(row.Bank_Name) : null,
        Bank_Account_Title: row.Bank_Account_Title ? String(row.Bank_Account_Title) : null,
        Bank_Account_Number_IBAN: row.Bank_Account_Number_IBAN ? String(row.Bank_Account_Number_IBAN) : null,
        Swift_Code_BIC: row.Swift_Code_BIC ? String(row.Swift_Code_BIC) : null,
        Comments_by_Aun: null,
        Created_At: row.Created_At ? String(row.Created_At) : null,
        Updated_At: row.Updated_At ? String(row.Updated_At) : null,
      };
    });
  } catch (error) {
    console.error('[PAY_TEMPLATE] Error fetching new hires:', error);
    throw error;
  }
}

// Fetch Leavers for a given month - now queries Employees table directly
export async function fetchLeavers(month: string): Promise<PayTemplateLeaver[]> {
  try {
    const bigquery = getBigQueryClient();
    
    const query = `
      SELECT 
        Employee_ID,
        Full_Name as Employee_Name,
        Employment_End_Date,
        Created_At,
        Updated_At
      FROM ${employeesTableRef}
      WHERE FORMAT_DATE('%Y-%m', Employment_End_Date) = @month
        AND Employment_Status = 'Resigned/Terminated'
      ORDER BY Employment_End_Date ASC
    `;
    
    const [rows] = await bigquery.query({
      query,
      params: { month },
    });
    
    return (rows as any[]).map((row) => ({
      Type: 'Leaver',
      Month: month,
      Employee_ID: row.Employee_ID ? String(row.Employee_ID) : null,
      Employee_Name: String(row.Employee_Name ?? ''),
      Employment_End_Date: row.Employment_End_Date ? String(row.Employment_End_Date).split('T')[0] : '',
      Payroll_Type: 'PKR', // Default, can be enhanced later if needed
      Comments: null,
      Devices_Returned: null,
      Comments_by_Aun: null,
      Created_At: row.Created_At ? String(row.Created_At) : null,
      Updated_At: row.Updated_At ? String(row.Updated_At) : null,
    }));
  } catch (error) {
    console.error('[PAY_TEMPLATE] Error fetching leavers:', error);
    throw error;
  }
}

// Fetch Increments for a given month
export async function fetchIncrements(month: string): Promise<PayTemplateIncrement[]> {
  try {
    const bigquery = getBigQueryClient();
    const tableRef = `\`${projectId}.${dataset}.Pay_Template_Increments\``;
    
    const query = `
      SELECT *
      FROM ${tableRef}
      WHERE Month = @month
      ORDER BY Effective_Date ASC
    `;
    
    const [rows] = await bigquery.query({
      query,
      params: { month },
    });
    
    return (rows as any[]).map((row) => ({
      Type: String(row.Type ?? 'Increment'),
      Month: String(row.Month ?? month),
      Employee_ID: row.Employee_ID ? String(row.Employee_ID) : null,
      Employee_Name: String(row.Employee_Name ?? ''),
      Currency: String(row.Currency ?? 'PKR'),
      Previous_Salary: row.Previous_Salary != null ? Number(row.Previous_Salary) : null,
      Updated_Salary: Number(row.Updated_Salary ?? 0),
      Effective_Date: row.Effective_Date ? String(row.Effective_Date).split('T')[0] : '',
      Comments: row.Comments ? String(row.Comments) : null,
      Remarks: row.Remarks ? String(row.Remarks) : null,
      Created_At: row.Created_At ? String(row.Created_At) : null,
      Updated_At: row.Updated_At ? String(row.Updated_At) : null,
    }));
  } catch (error) {
    console.error('[PAY_TEMPLATE] Error fetching increments:', error);
    // If table doesn't exist, return empty array
    if ((error as any)?.code === 404) {
      return [];
    }
    throw error;
  }
}

// Fetch Confirmations for a given month - now queries Employees table with approval join
export async function fetchConfirmations(month: string): Promise<PayTemplateConfirmation[]> {
  try {
    const bigquery = getBigQueryClient();
    
    const query = `
      SELECT 
        e.Employee_ID,
        e.Full_Name as Employee_Name,
        e.Probation_End_Date,
        COALESCE(s.Gross_Income, 0) as Updated_Salary,
        COALESCE(c.Approved, FALSE) as Approved,
        c.Approved_At,
        c.Approved_By,
        c.Confirmation_Date,
        c.Currency,
        c.Created_At,
        c.Updated_At
      FROM ${employeesTableRef} e
      LEFT JOIN (
        SELECT 
          Employee_ID,
          Gross_Income,
          ROW_NUMBER() OVER (PARTITION BY Employee_ID ORDER BY Payroll_Month DESC) as rn
        FROM ${salariesTableRef}
      ) s ON SAFE_CAST(e.Employee_ID AS INT64) = SAFE_CAST(s.Employee_ID AS INT64) AND s.rn = 1
      LEFT JOIN ${payTemplateConfirmationsTableRef} c
        ON SAFE_CAST(e.Employee_ID AS STRING) = SAFE_CAST(c.Employee_ID AS STRING) AND c.Month = @month
      WHERE FORMAT_DATE('%Y-%m', e.Probation_End_Date) = @month
        AND e.Employment_Status = 'Active'
      ORDER BY e.Probation_End_Date ASC
    `;
    
    const [rows] = await bigquery.query({
      query,
      params: { month },
    });
    
    return (rows as any[]).map((row) => ({
      Employee_ID: row.Employee_ID ? String(row.Employee_ID) : null,
      Employee_Name: String(row.Employee_Name ?? ''),
      Probation_End_Date: row.Probation_End_Date ? String(row.Probation_End_Date).split('T')[0] : '',
      Confirmation_Date: row.Confirmation_Date ? String(row.Confirmation_Date).split('T')[0] : new Date().toISOString().split('T')[0],
      Currency: row.Currency ? String(row.Currency) : null,
      Updated_Salary: row.Updated_Salary != null ? Number(row.Updated_Salary) : null,
      Month: month,
      Approved: row.Approved === true || row.Approved === 1,
      Approved_At: row.Approved_At ? String(row.Approved_At) : null,
      Approved_By: row.Approved_By ? String(row.Approved_By) : null,
      Created_At: row.Created_At ? String(row.Created_At) : null,
      Updated_At: row.Updated_At ? String(row.Updated_At) : null,
    }));
  } catch (error) {
    console.error('[PAY_TEMPLATE] Error fetching confirmations:', error);
    throw error;
  }
}

// Add increment record and update employee
export async function addIncrement(
  employeeId: string,
  effectiveDate: string,
  updatedSalary: number,
  currency: string,
  previousSalary: number | null,
  designation?: string | null,
  department?: string | null,
  comments?: string | null,
  remarks?: string | null
): Promise<void> {
  try {
    const bigquery = getBigQueryClient();
    const employeeIdNum = Number(employeeId);
    const month = effectiveDate.substring(0, 7); // Extract YYYY-MM from date
    
    // Insert into Pay_Template_Increments
    const insertIncrementQuery = `
      INSERT INTO ${payTemplateIncrementsTableRef} 
        (Type, Month, Employee_ID, Employee_Name, Currency, Previous_Salary, Updated_Salary, 
         Effective_Date, Comments, Remarks, Created_At, Updated_At)
      SELECT 
        'Increment',
        @month,
        @employeeId,
        Full_Name,
        @currency,
        @previousSalary,
        @updatedSalary,
        @effectiveDate,
        @comments,
        @remarks,
        CURRENT_TIMESTAMP(),
        CURRENT_TIMESTAMP()
      FROM ${employeesTableRef}
      WHERE Employee_ID = @employeeId
    `;
    
    await bigquery.query({
      query: insertIncrementQuery,
      params: {
        month,
        employeeId: employeeIdNum,
        currency,
        previousSalary: previousSalary ?? null,
        updatedSalary,
        effectiveDate,
        comments: comments ?? null,
        remarks: remarks ?? null,
      },
    });
    
    // Update Employees table
    const updateFields: string[] = ['Gross_Salary = @updatedSalary'];
    const updateParams: Record<string, unknown> = {
      employeeId: employeeIdNum,
      updatedSalary,
    };
    
    if (designation !== undefined && designation !== null) {
      updateFields.push('Designation = @designation');
      updateParams.designation = designation;
    }
    
    if (department !== undefined && department !== null) {
      updateFields.push('Department = @department');
      updateParams.department = department;
    }
    
    const updateEmployeeQuery = `
      UPDATE ${employeesTableRef}
      SET ${updateFields.join(', ')},
          Updated_At = CURRENT_TIMESTAMP(),
          Updated_By = 'Increment System'
      WHERE Employee_ID = @employeeId
    `;
    
    await bigquery.query({
      query: updateEmployeeQuery,
      params: updateParams,
    });
  } catch (error) {
    console.error('[PAY_TEMPLATE] Error adding increment:', error);
    throw error;
  }
}

// Approve confirmation and update employee probation status
export async function approveConfirmation(
  employeeId: string,
  month: string,
  approvedBy: string
): Promise<void> {
  try {
    const bigquery = getBigQueryClient();
    const employeeIdNum = Number(employeeId);
    
    // Insert or update Pay_Template_Confirmations
    const upsertConfirmationQuery = `
      MERGE ${payTemplateConfirmationsTableRef} c
      USING (
        SELECT 
          @employeeId as Employee_ID,
          Full_Name as Employee_Name,
          Probation_End_Date,
          Gross_Salary as Updated_Salary
        FROM ${employeesTableRef}
        WHERE Employee_ID = @employeeId
      ) e
      ON c.Employee_ID = e.Employee_ID AND c.Month = @month
      WHEN MATCHED THEN
        UPDATE SET
          Approved = TRUE,
          Approved_At = CURRENT_TIMESTAMP(),
          Approved_By = @approvedBy,
          Updated_At = CURRENT_TIMESTAMP()
      WHEN NOT MATCHED THEN
        INSERT (
          Employee_ID, Employee_Name, Probation_End_Date, Confirmation_Date,
          Currency, Updated_Salary, Month, Approved, Approved_At, Approved_By,
          Created_At, Updated_At
        )
        VALUES (
          e.Employee_ID, e.Employee_Name, e.Probation_End_Date, CURRENT_DATE(),
          'PKR', e.Updated_Salary, @month, TRUE, CURRENT_TIMESTAMP(), @approvedBy,
          CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()
        )
    `;
    
    await bigquery.query({
      query: upsertConfirmationQuery,
      params: {
        employeeId: employeeIdNum,
        month,
        approvedBy,
      },
    });
    
    // Update Employees.Probation_Status to 'Permanent'
    const updateEmployeeQuery = `
      UPDATE ${employeesTableRef}
      SET Probation_Status = 'Permanent',
          Updated_At = CURRENT_TIMESTAMP(),
          Updated_By = @approvedBy
      WHERE Employee_ID = @employeeId
    `;
    
    await bigquery.query({
      query: updateEmployeeQuery,
      params: {
        employeeId: employeeIdNum,
        approvedBy,
      },
    });
  } catch (error) {
    console.error('[PAY_TEMPLATE] Error approving confirmation:', error);
    throw error;
  }
}
