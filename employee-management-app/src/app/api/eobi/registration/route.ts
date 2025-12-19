import { NextResponse } from "next/server";
import { getBigQueryClient } from "@/lib/bigquery";
import { getEnv } from "@/lib/env";
import { formatDateForEOBI, isNewNICFormat, getRelationshipCode } from "@/lib/eobi";
import { recordsToCSV } from "@/lib/csv";

const BQ_DATASET = getEnv("BQ_DATASET");
const PROJECT_ID = getEnv("GCP_PROJECT_ID");
const EMPLOYEES_TABLE = `\`${PROJECT_ID}.${BQ_DATASET}.${getEnv("BQ_TABLE") ?? "Employees"}\``;

export const dynamic = "force-dynamic";

// PE01 Registration CSV Headers
const REGISTRATION_HEADERS = [
  "NAME",
  "NEW NIC",
  "OLD NIC",
  "F/H NAME",
  "RELATIONSHIP CODE",
  "GENDER",
  "DATE OF BIRTH",
  "DATEOF JOINING EMPLOYER",
  "POSTAL ADDRESS OF EMPLOYEE",
  "CITY",
  "PROVINCE",
  "PHONE",
  "EMAIL",
];

export async function GET() {
  try {
    const bigquery = getBigQueryClient();

    // Query employees without EOBI numbers
    // Join with EOBI table to find employees who don't have EOBI records
    const eobiTable = process.env.BQ_EOBI_TABLE ?? "Employee_EOBI";
    const eobiTableRef = `\`${PROJECT_ID}.${BQ_DATASET}.${eobiTable}\``;
    
    // Query employees without EOBI numbers
    // Check Employee_EOBI table to find employees who don't have ANY EOBI records
    const query = `
      SELECT DISTINCT
        e.*
      FROM ${EMPLOYEES_TABLE} e
      LEFT JOIN (
        SELECT DISTINCT Employee_ID
        FROM ${eobiTableRef}
        WHERE EOBI_NO IS NOT NULL AND TRIM(EOBI_NO) != ''
      ) eobi ON eobi.Employee_ID = e.Employee_ID
      WHERE e.Employee_ID IS NOT NULL
        AND eobi.Employee_ID IS NULL
      ORDER BY e.Joining_Date DESC, e.Full_Name ASC
    `;

    const [rows] = await bigquery.query({ query });

    if (rows.length === 0) {
      return new NextResponse(
        recordsToCSV([], REGISTRATION_HEADERS),
        {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="eobi-registration.csv"',
          },
        }
      );
    }

    // Map to PE01 format
    // Handle different possible field names dynamically
    const registrationRows = rows
      .map((row: any) => {
        // CNIC might be CNIC_ID or National_ID - check all possible variations
        const cnic = row.CNIC_ID || row.National_ID || row["CNIC / ID"] || row.CNIC || "";
        const isNewNIC = isNewNICFormat(cnic);
        
        // Address might be in different fields
        const address = row.Address || row.Temporary_Address || row.Current_Address || row.Permanent_Address || row["Permanent Address"] || "";
        
        // Email might be Official_Email or Personal_Email
        const email = row.Official_Email || row.Personal_Email || row["Email Address"] || "";
        
        // Father's Name might be Father_Name, Father's Name, or other variations
        const fatherName = row.Father_Name || row["Father's Name"] || row.FatherName || row["Fathers Name"] || "";
        
        // Date of Birth - check various field name variations
        const dateOfBirth = row.Date_of_Birth || row.DateOfBirth || row["Date of Birth"] || row.DOB || "";
        
        // Joining Date - check various field name variations
        const joiningDate = row.Joining_Date || row.JoiningDate || row["Date of Joining"] || row["Joining Date"] || "";
        
        // Gender
        const gender = row.Gender || "";
        
        // Contact Number
        const phone = row.Contact_Number || row.ContactNumber || row["Contact Number"] || row.Phone || "";

        // Skip employees missing critical fields
        if (!cnic || !dateOfBirth || !joiningDate) {
          console.warn(`[EOBI_REGISTRATION] Skipping employee ${row.Employee_ID} - missing critical fields:`, {
            cnic: !!cnic,
            dateOfBirth: !!dateOfBirth,
            joiningDate: !!joiningDate,
            availableFields: Object.keys(row).slice(0, 20) // Log first 20 field names for debugging
          });
          return null;
        }

        return {
          NAME: row.Full_Name || row["Full Name"] || "",
          "NEW NIC": isNewNIC ? cnic : "",
          "OLD NIC": !isNewNIC ? cnic : "",
          "F/H NAME": fatherName,
          "RELATIONSHIP CODE": getRelationshipCode({ Father_Name: fatherName } as any),
          GENDER: gender,
          "DATE OF BIRTH": formatDateForEOBI(dateOfBirth),
          "DATEOF JOINING EMPLOYER": formatDateForEOBI(joiningDate),
          "POSTAL ADDRESS OF EMPLOYEE": address,
          CITY: "Islamabad",
          PROVINCE: "Islamabad",
          PHONE: phone,
          EMAIL: email,
        };
      })
      .filter((row: any) => row !== null); // Remove skipped employees

    if (registrationRows.length === 0) {
      return new NextResponse(
        recordsToCSV([], REGISTRATION_HEADERS),
        {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="eobi-registration.csv"',
          },
        }
      );
    }

    const csv = recordsToCSV(registrationRows, REGISTRATION_HEADERS);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="eobi-registration.csv"',
      },
    });
  } catch (error) {
    console.error("[EOBI_REGISTRATION_ERROR]", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to generate registration CSV" },
      { status: 500 }
    );
  }
}
