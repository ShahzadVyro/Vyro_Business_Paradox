import { NextResponse } from "next/server";
import { getBigQueryClient } from "@/lib/bigquery";
import { getEnv } from "@/lib/env";

const BQ_DATASET = getEnv("BQ_DATASET");
const PROJECT_ID = getEnv("GCP_PROJECT_ID");
const EMPLOYEES_TABLE = `\`${PROJECT_ID}.${BQ_DATASET}.Employees\``;
const FIELD_UPDATES_TABLE = `\`${PROJECT_ID}.${BQ_DATASET}.Employee_Field_Updates\``;

export const dynamic = "force-dynamic";

// Valid field names that can be updated
const VALID_FIELDS = [
  "Official_Email",
  "Personal_Email",
  "Contact_Number",
  "Date_of_Birth",
  "Job_Location",
  "Department",
  "Designation",
  "Reporting_Manager",
  "Employment_End_Date",
  "Gross_Salary",
  "Bank_Name",
  "Bank_Account_Title",
  "Account_Number_IBAN",
  "Swift_Code_BIC",
  "Routing_Number",
  "EOBI_Number",
  "Address",
  "Current_Address",
  "Permanent_Address",
  "Nationality",
  "Marital_Status",
  "Number_of_Children",
  "Spouse_Name",
  "Spouse_DOB",
  "Father_Name",
  "Emergency_Contact_Name",
  "Emergency_Contact_Relationship",
  "Emergency_Contact_Number",
  "EOBI_Number",
  "EMP_AREA_CODE",
  "EMP_REG_SERIAL_NO",
  "EMP_SUB_AREA_CODE",
  "EMP_SUB_SERIAL_NO",
];

interface UpdateRequest {
  field: string;
  value: string | number | boolean | null;
  reason?: string;
}

interface BulkUpdateRequest {
  updates: Array<{ field: string; value: string | number | boolean | null }>;
  reason?: string;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const { employeeId } = await params;
    const body: UpdateRequest | BulkUpdateRequest = await request.json();
    
    // Check if it's a bulk update
    if ("updates" in body && Array.isArray(body.updates)) {
      return handleBulkUpdate(employeeId, body as BulkUpdateRequest);
    }
    
    // Single field update
    const { field, value, reason } = body as UpdateRequest;

    if (!field) {
      return NextResponse.json({ message: "Field name is required" }, { status: 400 });
    }

    // Validate field name
    if (!VALID_FIELDS.includes(field)) {
      return NextResponse.json(
        { message: `Invalid field name. Allowed fields: ${VALID_FIELDS.join(", ")}` },
        { status: 400 }
      );
    }

    const bigquery = getBigQueryClient();
    const employeeIdNum = parseInt(employeeId, 10);
    
    if (isNaN(employeeIdNum)) {
      return NextResponse.json({ message: "Invalid Employee_ID" }, { status: 400 });
    }

    // Get current value
    const getCurrentValueQuery = `
      SELECT ${field} as current_value
      FROM ${EMPLOYEES_TABLE}
      WHERE Employee_ID = @employeeId
    `;
    const [currentRows] = await bigquery.query({
      query: getCurrentValueQuery,
      params: { employeeId: employeeIdNum },
    });

    if (currentRows.length === 0) {
      return NextResponse.json({ message: "Employee not found" }, { status: 404 });
    }

    const oldValue = currentRows[0].current_value;

    // Skip update if value hasn't changed
    if (oldValue === value || (oldValue === null && value === null)) {
      return NextResponse.json({
        success: true,
        message: `Field ${field} unchanged`,
        oldValue,
        newValue: value,
      });
    }

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
        employeeId: employeeIdNum,
        value: value === null ? null : value,
      },
    });

    // Log the change to Employee_Field_Updates table
    try {
      const logUpdateQuery = `
        INSERT INTO ${FIELD_UPDATES_TABLE} 
          (Employee_ID, Field_Name, Old_Value, New_Value, Updated_Date, Updated_By, Reason)
        VALUES 
          (@employeeId, @fieldName, @oldValue, @newValue, CURRENT_TIMESTAMP(), 'API Update', @reason)
      `;
      await bigquery.query({
        query: logUpdateQuery,
        params: {
          employeeId: employeeIdNum,
          fieldName: field,
          oldValue: oldValue !== null ? String(oldValue) : null,
          newValue: value !== null ? String(value) : null,
          reason: reason || null,
        },
      });
    } catch (auditError) {
      console.warn("[AUDIT_LOG_ERROR]", auditError);
      // Don't fail the update if audit logging fails
    }

    return NextResponse.json({
      success: true,
      message: `Field ${field} updated successfully`,
      oldValue,
      newValue: value,
    });
  } catch (error) {
    console.error("[EMPLOYEE_UPDATE_ERROR]", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update employee field" },
      { status: 500 }
    );
  }
}

async function handleBulkUpdate(employeeId: string, body: BulkUpdateRequest) {
  const bigquery = getBigQueryClient();
  const employeeIdNum = parseInt(employeeId, 10);
  
  if (isNaN(employeeIdNum)) {
    return NextResponse.json({ message: "Invalid Employee_ID" }, { status: 400 });
  }

  // Validate all fields
  for (const update of body.updates) {
    if (!VALID_FIELDS.includes(update.field)) {
      return NextResponse.json(
        { message: `Invalid field name: ${update.field}. Allowed fields: ${VALID_FIELDS.join(", ")}` },
        { status: 400 }
      );
    }
  }

  // Get current values
  const fieldsToUpdate = body.updates.map(u => u.field);
  const getCurrentValuesQuery = `
    SELECT ${fieldsToUpdate.join(", ")}
    FROM ${EMPLOYEES_TABLE}
    WHERE Employee_ID = @employeeId
  `;
  const [currentRows] = await bigquery.query({
    query: getCurrentValuesQuery,
    params: { employeeId: employeeIdNum },
  });

  if (currentRows.length === 0) {
    return NextResponse.json({ message: "Employee not found" }, { status: 404 });
  }

  const currentValues = currentRows[0];
  const updates: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];

  // Build SET clause for UPDATE
  const setClauses = body.updates
    .map((u) => {
      const oldValue = currentValues[u.field];
      if (oldValue !== u.value && !(oldValue === null && u.value === null)) {
        updates.push({ field: u.field, oldValue, newValue: u.value });
        return `${u.field} = @${u.field}`;
      }
      return null;
    })
    .filter(Boolean);

  if (setClauses.length === 0) {
    return NextResponse.json({
      success: true,
      message: "No fields changed",
      updates: [],
    });
  }

  // Update all fields
  const updateQuery = `
    UPDATE ${EMPLOYEES_TABLE}
    SET ${setClauses.join(", ")},
        Updated_At = CURRENT_TIMESTAMP(),
        Updated_By = 'API Update'
    WHERE Employee_ID = @employeeId
  `;

  const params: Record<string, unknown> = { employeeId: employeeIdNum };
  body.updates.forEach((u) => {
    params[u.field] = u.value === null ? null : u.value;
  });

  await bigquery.query({
    query: updateQuery,
    params,
  });

  // Log all changes
  for (const update of updates) {
    try {
      const logUpdateQuery = `
        INSERT INTO ${FIELD_UPDATES_TABLE} 
          (Employee_ID, Field_Name, Old_Value, New_Value, Updated_Date, Updated_By, Reason)
        VALUES 
          (@employeeId, @fieldName, @oldValue, @newValue, CURRENT_TIMESTAMP(), 'API Update', @reason)
      `;
      await bigquery.query({
        query: logUpdateQuery,
        params: {
          employeeId: employeeIdNum,
          fieldName: update.field,
          oldValue: update.oldValue !== null ? String(update.oldValue) : null,
          newValue: update.newValue !== null ? String(update.newValue) : null,
          reason: body.reason || null,
        },
      });
    } catch (auditError) {
      console.warn(`[AUDIT_LOG_ERROR] Field: ${update.field}`, auditError);
    }
  }

  return NextResponse.json({
    success: true,
    message: `${updates.length} field(s) updated successfully`,
    updates: updates.map((u) => ({
      field: u.field,
      oldValue: u.oldValue,
      newValue: u.newValue,
    })),
  });
}

