import { NextResponse } from "next/server";
import { getBigQueryClient } from "@/lib/bigquery";
import {
  calculateRevisedWithOPD,
  calculateProratedPay,
  calculateGrossIncome,
  calculateWorkedDays,
  getTotalDaysInMonth,
  getMonthAbbreviation,
} from "@/lib/payroll-calculations";

export const dynamic = "force-dynamic";

const projectId = process.env.GCP_PROJECT_ID;
const dataset = process.env.BQ_DATASET;
const employeesTable = process.env.BQ_TABLE ?? "Employees";
const salaryTable = process.env.BQ_SALARY_TABLE ?? "Employee_Salaries";
const payTemplateNewHiresTable = `\`${projectId}.${dataset}.Pay_Template_New_Hires\``;
const payTemplateIncrementsTable = `\`${projectId}.${dataset}.Pay_Template_Increments\``;
const employeesTableRef = `\`${projectId}.${dataset}.${employeesTable}\``;
const salariesTableRef = `\`${projectId}.${dataset}.${salaryTable}\``;

interface CreateSalarySheetRequest {
  month: string; // YYYY-MM format
  currency: "USD" | "PKR";
  employeeId?: number; // Optional: create for single employee only
}

export async function POST(request: Request) {
  try {
    const body: CreateSalarySheetRequest = await request.json();
    const { month, currency, employeeId } = body;

    if (!month || !currency) {
      return NextResponse.json(
        { error: "Month and currency are required" },
        { status: 400 }
      );
    }

    const bigquery = getBigQueryClient();
    const payrollMonth = new Date(`${month}-01`);
    const year = payrollMonth.getFullYear();
    const monthNum = payrollMonth.getMonth();
    const totalDaysInMonth = getTotalDaysInMonth(payrollMonth);
    const monthAbbrev = getMonthAbbreviation(payrollMonth);

    // Calculate previous month for last month's salary
    const prevMonth = new Date(year, monthNum - 1, 1);
    const prevMonthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;

    // Fetch eligible employees
    // 1. Active employees
    // 2. Resigned/Terminated employees where Employment_End_Date is in selected month or next month
    // 3. New hires from Pay_Template_New_Hires for that month

    // Build employee filter condition
    const employeeFilter = employeeId 
      ? `AND e.Employee_ID = @employeeId`
      : ``;

    const eligibleEmployeesQuery = `
      SELECT DISTINCT
        e.Employee_ID,
        e.Full_Name,
        e.Designation,
        e.Department,
        e.Official_Email,
        e.Personal_Email,
        e.Joining_Date,
        e.Employment_End_Date,
        e.Employment_Status,
        e.Probation_End_Date,
        COALESCE(e.Basic_Salary, 0) + COALESCE(e.Medical_Allowance, 0) as Regular_Pay_From_Employee,
        e.Basic_Salary,
        e.Medical_Allowance,
        e.Bank_Name,
        e.Account_Number_IBAN
      FROM ${employeesTableRef} e
      WHERE (
        -- Active employees
        (e.Employment_Status = 'Active' AND e.Joining_Date <= LAST_DAY(CAST(@payrollMonth AS DATE)))
        OR
        -- Resigned/Terminated in this month or next month
        (
          e.Employment_Status IN ('Resigned', 'Terminated')
          AND e.Employment_End_Date >= DATE_TRUNC(CAST(@payrollMonth AS DATE), MONTH)
          AND e.Employment_End_Date <= DATE_ADD(DATE_TRUNC(CAST(@payrollMonth AS DATE), MONTH), INTERVAL 2 MONTH)
        )
      )
      ${employeeFilter}
      AND NOT EXISTS (
        SELECT 1 FROM ${salariesTableRef} s
        WHERE s.Employee_ID = e.Employee_ID
          AND s.Payroll_Month = CAST(@payrollMonth AS DATE)
          AND s.Currency = @currency
      )
    `;

    const queryParams: Record<string, unknown> = {
      payrollMonth: `${month}-01`,
      currency,
    };
    
    if (employeeId) {
      queryParams.employeeId = employeeId;
    }

    const [employeeRows] = await bigquery.query({
      query: eligibleEmployeesQuery,
      params: queryParams,
    });

    // Fetch new hires for this month (only if not single employee mode)
    const newHireFilter = employeeId 
      ? `AND n.Employee_ID = @employeeId`
      : ``;

    const newHiresQuery = `
      SELECT DISTINCT
        n.Employee_ID,
        n.Employee_Name as Full_Name,
        n.Designation,
        n.Official_Email,
        n.Date_of_Joining as Joining_Date,
        n.Salary as Regular_Pay_From_NewHire,
        n.Currency
      FROM ${payTemplateNewHiresTable} n
      WHERE n.Month = @month
        AND n.Currency = @currency
        AND n.Employee_ID IS NOT NULL
        ${newHireFilter}
        AND NOT EXISTS (
          SELECT 1 FROM ${salariesTableRef} s
          WHERE s.Employee_ID = n.Employee_ID
            AND s.Payroll_Month = CAST(@payrollMonth AS DATE)
            AND s.Currency = @currency
        )
    `;

    const newHireParams: Record<string, unknown> = {
      month,
      currency,
      payrollMonth: `${month}-01`,
    };
    
    if (employeeId) {
      newHireParams.employeeId = employeeId;
    }

    const [newHireRows] = await bigquery.query({
      query: newHiresQuery,
      params: newHireParams,
    });

    // Get max Salary_ID
    const maxIdQuery = `SELECT COALESCE(MAX(Salary_ID), 0) as max_id FROM ${salariesTableRef}`;
    const [maxIdRows] = await bigquery.query({ query: maxIdQuery });
    const maxSalaryId = (maxIdRows[0] as { max_id: number })?.max_id ?? 0;

    // Combine employees and new hires
    const allEmployees = [
      ...employeeRows.map((row: any) => ({
        ...row,
        source: "employees",
      })),
      ...newHireRows.map((row: any) => ({
        ...row,
        source: "new_hires",
      })),
    ];

    // Fetch increments for this month
    const incrementsQuery = `
      SELECT
        Employee_ID,
        Updated_Salary as Increment_Amount,
        Effective_Date as Increment_Date,
        Currency
      FROM ${payTemplateIncrementsTable}
      WHERE Month = @month
        AND Currency = @currency
    `;

    const [incrementRows] = await bigquery.query({
      query: incrementsQuery,
      params: { month, currency },
    });

    const incrementsMap = new Map(
      incrementRows.map((row: any) => [
        row.Employee_ID,
        {
          amount: row.Increment_Amount,
          date: row.Increment_Date,
        },
      ])
    );

    // Fetch last month's salary for each employee
    const employeeIds = allEmployees.map((e: any) => e.Employee_ID);
    let lastMonthSalariesMap = new Map<number, number>();

    if (employeeIds.length > 0) {
      const lastMonthQuery = `
        SELECT
          Employee_ID,
          Gross_Income
        FROM ${salariesTableRef}
        WHERE Employee_ID IN UNNEST(@employeeIds)
          AND Currency = @currency
          AND FORMAT_DATE('%Y-%m', Payroll_Month) = @prevMonth
        ORDER BY Payroll_Month DESC
      `;

      const [lastMonthRows] = await bigquery.query({
        query: lastMonthQuery,
        params: {
          employeeIds,
          currency,
          prevMonth: prevMonthStr,
        },
      });

      lastMonthSalariesMap = new Map(
        lastMonthRows.map((row: any) => [row.Employee_ID, row.Gross_Income])
      );
    }

    // Create salary records
    const salaryRecords: any[] = [];
    let salaryIdCounter = maxSalaryId + 1;

    for (const emp of allEmployees) {
      const employeeId = emp.Employee_ID;
      const joiningDate = emp.Joining_Date
        ? new Date(emp.Joining_Date).toISOString().split("T")[0]
        : null;
      const leavingDate = emp.Employment_End_Date
        ? new Date(emp.Employment_End_Date).toISOString().split("T")[0]
        : null;

      // Calculate worked days
      const workedDays = calculateWorkedDays(
        joiningDate,
        leavingDate,
        payrollMonth
      );

      // Get regular pay (from employee or new hire)
      const regularPay =
        emp.Regular_Pay_From_NewHire ??
        emp.Regular_Pay_From_Employee ??
        null;

      if (!regularPay) {
        console.warn(
          `Skipping employee ${employeeId}: No regular pay found`
        );
        continue;
      }

      // Check if in probation
      const probationEndDate = emp.Probation_End_Date
        ? new Date(emp.Probation_End_Date)
        : null;
      const isInProbation =
        probationEndDate && probationEndDate > payrollMonth;

      // Calculate Revised with OPD (USD only)
      const revisedWithOPD = calculateRevisedWithOPD(
        regularPay,
        currency,
        isInProbation ?? false
      );

      // Calculate Prorated Pay
      const proratedPay = calculateProratedPay(
        revisedWithOPD,
        totalDaysInMonth,
        workedDays
      );

      // Get increment data
      const increment = incrementsMap.get(employeeId);
      const incrementAmount = increment?.amount ?? null;
      const incrementDate = increment?.date ?? null;

      // Get last month's salary
      const lastMonthSalary = lastMonthSalariesMap.get(employeeId) ?? null;

      // Get payable from last month (default to null)
      const payableFromLastMonth = null;

      // Calculate Gross Income (will be updated when bonuses/overtime/etc are added)
      const grossIncome = calculateGrossIncome(
        proratedPay,
        null, // Performance Bonus
        null, // Paid Overtime
        null, // Reimbursements
        null, // Other
        payableFromLastMonth
      );

      // Generate Month_Key and Key
      const employeeNameLower = (emp.Full_Name || "")
        .toLowerCase()
        .replace(/\s+/g, " ");
      const monthKey = `${monthAbbrev}${employeeId}${employeeNameLower}`;
      const key = `${employeeId}${employeeNameLower}`;

      const record = {
        Salary_ID: salaryIdCounter++,
        Employee_ID: employeeId,
        Payroll_Month: `${month}-01`,
        Currency: currency,
        Month_Key: monthKey,
        Key: key,
        Status: emp.Employment_Status === "Active" ? "1" : "",
        Email: emp.Official_Email || emp.Personal_Email || null,
        Date_of_Joining: joiningDate,
        Date_of_Leaving: leavingDate,
        Worked_Days: workedDays,
        Last_Month_Salary: lastMonthSalary,
        New_Addition_Increment_Decrement: incrementAmount,
        Date_of_Increment_Decrement: incrementDate,
        Payable_from_Last_Month: payableFromLastMonth,
        Regular_Pay: regularPay,
        Revised_with_OPD: revisedWithOPD,
        Prorated_Pay: proratedPay,
        Performance_Bonus: null,
        Paid_Overtime: null,
        Reimbursements: null,
        Other: null,
        Gross_Income: grossIncome,
        Unpaid_Leaves: null,
        Deductions: null,
        Net_Income: grossIncome, // Will be updated when deductions are added
        Comments: null,
        Internal_Comments: null,
        Designation_At_Payroll: emp.Designation || null,
        Department_At_Payroll: emp.Department || null,
        Bank_Name_At_Payroll: emp.Bank_Name || null,
        Bank_Account_At_Payroll: emp.Account_Number_IBAN || null,
        Month: monthAbbrev,
        Salary_Status: "HOLD", // Default to HOLD
        PaySlip_Status: "Not Sent", // Default
        Created_At: new Date().toISOString(),
      };

      // Add PKR-specific fields if currency is PKR
      if (currency === "PKR") {
        (record as any).Prorated_Base_Pay = null;
        (record as any).Prorated_Medical_Allowance = null;
        (record as any).Prorated_Transport_Allowance = null;
        (record as any).Prorated_Inflation_Allowance = null;
        (record as any).Taxable_Income = null;
        (record as any).Tax_Deduction = null;
        (record as any).EOBI = null;
        (record as any).Loan_Deduction = null;
        (record as any).Recoveries = null;
      }

      salaryRecords.push(record);
    }

    // Insert records into BigQuery
    if (salaryRecords.length === 0) {
      return NextResponse.json({
        message: "No eligible employees found or all already have salary records",
        created: 0,
      });
    }

    // Build insert query
    const insertQuery = `
      INSERT INTO ${salariesTableRef}
      (
        Salary_ID, Employee_ID, Payroll_Month, Currency,
        Month_Key, Key, Status, Email,
        Date_of_Joining, Date_of_Leaving, Worked_Days,
        Last_Month_Salary, New_Addition_Increment_Decrement, Date_of_Increment_Decrement,
        Payable_from_Last_Month, Regular_Pay, Revised_with_OPD, Prorated_Pay,
        Performance_Bonus, Paid_Overtime, Reimbursements, Other,
        Gross_Income, Unpaid_Leaves, Deductions, Net_Income,
        Comments, Internal_Comments,
        Designation_At_Payroll, Department_At_Payroll,
        Bank_Name_At_Payroll, Bank_Account_At_Payroll,
        Month, Salary_Status, PaySlip_Status, Created_At
        ${currency === "PKR" ? `, Prorated_Base_Pay, Prorated_Medical_Allowance, Prorated_Transport_Allowance, Prorated_Inflation_Allowance, Taxable_Income, Tax_Deduction, EOBI, Loan_Deduction, Recoveries` : ""}
      )
      VALUES
      ${salaryRecords
        .map(
          (_, idx) => `(
        @salaryId${idx}, @employeeId${idx}, CAST(@payrollMonth${idx} AS DATE), @currency${idx},
        @monthKey${idx}, @key${idx}, @status${idx}, @email${idx},
        CAST(@dateOfJoining${idx} AS DATE), CAST(@dateOfLeaving${idx} AS DATE), @workedDays${idx},
        @lastMonthSalary${idx}, @incrementAmount${idx}, CAST(@incrementDate${idx} AS DATE),
        @payableFromLast${idx}, @regularPay${idx}, @revisedWithOPD${idx}, @proratedPay${idx},
        @performanceBonus${idx}, @paidOvertime${idx}, @reimbursements${idx}, @other${idx},
        @grossIncome${idx}, @unpaidLeaves${idx}, @deductions${idx}, @netIncome${idx},
        @comments${idx}, @internalComments${idx},
        @designation${idx}, @department${idx},
        @bankName${idx}, @bankAccount${idx},
        @month${idx}, @salaryStatus${idx}, @paySlipStatus${idx}, CURRENT_TIMESTAMP()
        ${currency === "PKR" ? `, @proratedBasePay${idx}, @proratedMedical${idx}, @proratedTransport${idx}, @proratedInflation${idx}, @taxableIncome${idx}, @taxDeduction${idx}, @eobi${idx}, @loanDeduction${idx}, @recoveries${idx}` : ""}
      )`
        )
        .join(", ")}
    `;

    const params: Record<string, any> = {};
    const types: Record<string, string> = {};

    salaryRecords.forEach((record, idx) => {
      params[`salaryId${idx}`] = record.Salary_ID;
      params[`employeeId${idx}`] = record.Employee_ID;
      params[`payrollMonth${idx}`] = record.Payroll_Month;
      params[`currency${idx}`] = record.Currency;
      params[`monthKey${idx}`] = record.Month_Key;
      params[`key${idx}`] = record.Key;
      params[`status${idx}`] = record.Status;
      params[`email${idx}`] = record.Email;
      params[`dateOfJoining${idx}`] = record.Date_of_Joining;
      params[`dateOfLeaving${idx}`] = record.Date_of_Leaving;
      params[`workedDays${idx}`] = record.Worked_Days;
      params[`lastMonthSalary${idx}`] = record.Last_Month_Salary;
      params[`incrementAmount${idx}`] = record.New_Addition_Increment_Decrement;
      params[`incrementDate${idx}`] = record.Date_of_Increment_Decrement;
      params[`payableFromLast${idx}`] = record.Payable_from_Last_Month;
      params[`regularPay${idx}`] = record.Regular_Pay;
      params[`revisedWithOPD${idx}`] = record.Revised_with_OPD;
      params[`proratedPay${idx}`] = record.Prorated_Pay;
      params[`performanceBonus${idx}`] = record.Performance_Bonus;
      params[`paidOvertime${idx}`] = record.Paid_Overtime;
      params[`reimbursements${idx}`] = record.Reimbursements;
      params[`other${idx}`] = record.Other;
      params[`grossIncome${idx}`] = record.Gross_Income;
      params[`unpaidLeaves${idx}`] = record.Unpaid_Leaves;
      params[`deductions${idx}`] = record.Deductions;
      params[`netIncome${idx}`] = record.Net_Income;
      params[`comments${idx}`] = record.Comments;
      params[`internalComments${idx}`] = record.Internal_Comments;
      params[`designation${idx}`] = record.Designation_At_Payroll;
      params[`department${idx}`] = record.Department_At_Payroll;
      params[`bankName${idx}`] = record.Bank_Name_At_Payroll;
      params[`bankAccount${idx}`] = record.Bank_Account_At_Payroll;
      params[`month${idx}`] = record.Month;
      params[`salaryStatus${idx}`] = record.Salary_Status;
      params[`paySlipStatus${idx}`] = record.PaySlip_Status;

      types[`payrollMonth${idx}`] = "DATE";
      if (record.Date_of_Joining) types[`dateOfJoining${idx}`] = "DATE";
      if (record.Date_of_Leaving) types[`dateOfLeaving${idx}`] = "DATE";
      if (record.Date_of_Increment_Decrement)
        types[`incrementDate${idx}`] = "DATE";
      if (record.Email === null) types[`email${idx}`] = "STRING";
      if (record.Comments === null) types[`comments${idx}`] = "STRING";
      if (record.Internal_Comments === null)
        types[`internalComments${idx}`] = "STRING";

      if (currency === "PKR") {
        params[`proratedBasePay${idx}`] = (record as any).Prorated_Base_Pay;
        params[`proratedMedical${idx}`] = (record as any).Prorated_Medical_Allowance;
        params[`proratedTransport${idx}`] = (record as any).Prorated_Transport_Allowance;
        params[`proratedInflation${idx}`] = (record as any).Prorated_Inflation_Allowance;
        params[`taxableIncome${idx}`] = (record as any).Taxable_Income;
        params[`taxDeduction${idx}`] = (record as any).Tax_Deduction;
        params[`eobi${idx}`] = (record as any).EOBI;
        params[`loanDeduction${idx}`] = (record as any).Loan_Deduction;
        params[`recoveries${idx}`] = (record as any).Recoveries;
      }
    });

    await bigquery.query({
      query: insertQuery,
      params,
      ...(Object.keys(types).length > 0 && { types }),
    });

    return NextResponse.json({
      message: `Successfully created ${salaryRecords.length} salary records`,
      created: salaryRecords.length,
      month,
      currency,
    });
  } catch (error) {
    console.error("[SALARY_CREATE_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to create salary sheet", details: String(error) },
      { status: 500 }
    );
  }
}
