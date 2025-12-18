import { NextResponse } from "next/server";
import { getBigQueryClient } from "@/lib/bigquery";
import { getEnv } from "@/lib/env";

const BQ_DATASET = getEnv("BQ_DATASET");
const PROJECT_ID = getEnv("GCP_PROJECT_ID");
const EMPLOYEES_TABLE = `\`${PROJECT_ID}.${BQ_DATASET}.Employees\``;
const FIELD_UPDATES_TABLE = `\`${PROJECT_ID}.${BQ_DATASET}.Employee_Field_Updates\``;

export const dynamic = "force-dynamic";

interface UpdateRequest {
  field: string;
  value: string | number | boolean | null;
  reason?: string;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const { employeeId } = await params;
    const body: UpdateRequest = await request.json();
    const { field, value, reason } = body;

    if (!field) {
      return NextResponse.json({ message: "Field name is required" }, { status: 400 });
    }

    const bigquery = getBigQueryClient();

    // Get current value
    const getCurrentValueQuery = `
      SELECT ${field} as current_value
      FROM ${EMPLOYEES_TABLE}
      WHERE Employee_ID = @employeeId
    `;
    const [currentRows] = await bigquery.query({
      query: getCurrentValueQuery,
      params: { employeeId: parseInt(employeeId) },
    });

    if (currentRows.length === 0) {
      return NextResponse.json({ message: "Employee not found" }, { status: 404 });
    }

    const oldValue = currentRows[0].current_value;

    // Update the field
    const updateQuery = `
      UPDATE ${EMPLOYEES_TABLE}
      SET ${field} = @value,
          Updated_At = CURRENT_TIMESTAMP(),
          Updated_By = 'API Update'
      WHERE Employee_ID = @employeeId
    `;
    await bigquery.query({
      query: updateQuery,
      params: {
        employeeId: parseInt(employeeId),
        value: value === null ? null : value,
      },
    });

    // Log the change to Employee_Field_Updates table
    const logUpdateQuery = `
      INSERT INTO ${FIELD_UPDATES_TABLE} 
        (Employee_ID, Field_Name, Old_Value, New_Value, Updated_Date, Updated_By, Reason)
      VALUES 
        (@employeeId, @fieldName, @oldValue, @newValue, CURRENT_TIMESTAMP(), 'API Update', @reason)
    `;
    await bigquery.query({
      query: logUpdateQuery,
      params: {
        employeeId: parseInt(employeeId),
        fieldName: field,
        oldValue: oldValue !== null ? String(oldValue) : null,
        newValue: value !== null ? String(value) : null,
        reason: reason || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Field ${field} updated successfully`,
      oldValue,
      newValue: value,
    });
  } catch (error) {
    console.error("[EMPLOYEE_UPDATE_ERROR]", error);
    return NextResponse.json(
      { message: "Failed to update employee field" },
      { status: 500 }
    );
  }
}

