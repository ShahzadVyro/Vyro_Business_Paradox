import { NextResponse } from "next/server";
import { getBigQueryClient } from "@/lib/bigquery";
import { getEnv } from "@/lib/env";
import { formatDateForEOBI, calculateDaysWorked, getMonthBounds } from "@/lib/eobi";
import { recordsToCSV } from "@/lib/csv";
import type { EmployeeRecord } from "@/types/employee";

const BQ_DATASET = getEnv("BQ_DATASET");
const PROJECT_ID = getEnv("GCP_PROJECT_ID");
const EMPLOYEES_TABLE = `\`${PROJECT_ID}.${BQ_DATASET}.${getEnv("BQ_TABLE") ?? "Employees"}\``;

export const dynamic = "force-dynamic";

// PR02A Bulk Upload CSV Headers
const BULK_UPLOAD_HEADERS = [
  "EMP_AREA_CODE",
  "EMP_REG_SERIAL_NO",
  "EMP_SUB_AREA_CODE",
  "EMP_SUB_SERIAL_NO",
  "NAME",
  "EOBI_NO",
  "CNIC",
  "NIC",
  "DOB",
  "DOJ",
  "DOE",
  "NO_OF_DAYS_WORKED",
  "From_Date",
  "To_Date",
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month");

    if (!monthParam) {
      return NextResponse.json(
        { message: "Month parameter is required (format: YYYY-MM)" },
        { status: 400 }
      );
    }

    // Parse month and get bounds
    const { monthStart, monthEnd } = getMonthBounds(monthParam);

    const bigquery = getBigQueryClient();

    // Query ALL employees (active + resigned/terminated)
    // Join with EOBI table to get the latest EOBI number for each employee
    const eobiTable = process.env.BQ_EOBI_TABLE ?? "Employee_EOBI";
    const eobiTableRef = `\`${PROJECT_ID}.${BQ_DATASET}.${eobiTable}\``;
    
    const query = `
      SELECT 
        e.Employee_ID,
        e.Full_Name,
        e.CNIC_ID,
        e.Date_of_Birth,
        e.Joining_Date,
        e.Employment_End_Date,
        e.Employment_Status,
        eobi.EOBI_NO AS EOBI_Number
      FROM ${EMPLOYEES_TABLE} e
      LEFT JOIN (
        SELECT 
          SAFE_CAST(Employee_ID AS INT64) AS Employee_ID,
          EOBI_NO,
          ROW_NUMBER() OVER (PARTITION BY Employee_ID ORDER BY Payroll_Month DESC) AS rn
        FROM ${eobiTableRef}
        WHERE EOBI_NO IS NOT NULL AND TRIM(EOBI_NO) != ''
      ) eobi ON eobi.Employee_ID = e.Employee_ID AND eobi.rn = 1
      WHERE e.Employee_ID IS NOT NULL
      ORDER BY e.Full_Name ASC
    `;

    const [rows] = await bigquery.query({ query });

    if (rows.length === 0) {
      return new NextResponse(
        recordsToCSV([], BULK_UPLOAD_HEADERS),
        {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="eobi-bulk-upload-${monthParam}.csv"`,
          },
        }
      );
    }

    // Map to PR02A format
    const bulkUploadRows = rows
      .map((row: any) => {
        const employee: EmployeeRecord = {
          Employee_ID: typeof row.Employee_ID === "string" ? parseInt(row.Employee_ID, 10) : row.Employee_ID,
          Full_Name: row.Full_Name || "",
          Employment_Status: (row.Employment_Status || "Active") as "Active" | "Resigned/Terminated",
          Employment_End_Date: row.Employment_End_Date || null,
          Joining_Date: row.Joining_Date || null,
          Official_Email: null,
          Personal_Email: null,
          Contact_Number: null,
          Department: null,
          Designation: null,
          Reporting_Manager: null,
          Gross_Salary: null,
          Job_Location: null,
        };

        const eobiNumber = row.EOBI_Number || "";
        const cnic = row.CNIC_ID || "";

        // Skip employees without EOBI number (they should be registered first)
        if (!eobiNumber || eobiNumber.trim() === "") {
          return null;
        }

        // Calculate days worked
        const daysWorked = calculateDaysWorked(employee, monthStart, monthEnd);

        // Determine DOE (Date of Exit) - only for resigned/terminated employees
        const status = employee.Employment_Status?.toUpperCase().trim();
        const isResigned = status === "RESIGNED/TERMINATED" || status === "RESIGNED" || status === "TERMINATED";
        const doe = isResigned && employee.Employment_End_Date
          ? formatDateForEOBI(employee.Employment_End_Date)
          : "";

        return {
          EMP_AREA_CODE: "FAA",
          EMP_REG_SERIAL_NO: "4320",
          EMP_SUB_AREA_CODE: " ", // Single space as required
          EMP_SUB_SERIAL_NO: "0",
          NAME: employee.Full_Name,
          EOBI_NO: eobiNumber,
          CNIC: cnic,
          NIC: "", // Empty if not available
          DOB: formatDateForEOBI(row.Date_of_Birth),
          DOJ: formatDateForEOBI(employee.Joining_Date),
          DOE: doe,
          NO_OF_DAYS_WORKED: daysWorked.toString(),
          From_Date: formatDateForEOBI(monthStart.toISOString().slice(0, 10)),
          To_Date: formatDateForEOBI(monthEnd.toISOString().slice(0, 10)),
        };
      })
      .filter((row: any) => row !== null); // Remove skipped employees

    if (bulkUploadRows.length === 0) {
      return new NextResponse(
        recordsToCSV([], BULK_UPLOAD_HEADERS),
        {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="eobi-bulk-upload-${monthParam}.csv"`,
          },
        }
      );
    }

    const csv = recordsToCSV(bulkUploadRows, BULK_UPLOAD_HEADERS);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="eobi-bulk-upload-${monthParam}.csv"`,
      },
    });
  } catch (error) {
    console.error("[EOBI_BULK_UPLOAD_ERROR]", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to generate bulk upload CSV" },
      { status: 500 }
    );
  }
}
