import { NextResponse } from "next/server";
import { getBigQueryClient } from "@/lib/bigquery";
import { getEnv } from "@/lib/env";

const BQ_DATASET = getEnv("BQ_DATASET");
const PROJECT_ID = getEnv("GCP_PROJECT_ID");
const FIELD_UPDATES_TABLE = `\`${PROJECT_ID}.${BQ_DATASET}.Employee_Field_Updates\``;

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ employeeId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { employeeId } = await params;
    const employeeIdNum = parseInt(employeeId, 10);
    
    if (isNaN(employeeIdNum)) {
      return NextResponse.json({ message: "Invalid Employee_ID" }, { status: 400 });
    }

    const bigquery = getBigQueryClient();

    const query = `
      SELECT
        Field_Name,
        Old_Value,
        New_Value,
        Updated_Date,
        Updated_By,
        Reason
      FROM ${FIELD_UPDATES_TABLE}
      WHERE Employee_ID = @employeeId
      ORDER BY Updated_Date DESC
      LIMIT 100
    `;

    const [rows] = await bigquery.query({
      query,
      params: { employeeId: employeeIdNum },
    });

    // Normalize the data
    const history = (rows as any[]).map((row) => ({
      Field_Name: row.Field_Name ?? '',
      Old_Value: row.Old_Value ?? null,
      New_Value: row.New_Value ?? null,
      Updated_Date: row.Updated_Date ? String(row.Updated_Date).split('T')[0] : null,
      Updated_By: row.Updated_By ?? null,
      Reason: row.Reason ?? null,
    }));

    return NextResponse.json({ history });
  } catch (error) {
    console.error("[CHANGE_HISTORY_ERROR]", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to fetch change history" },
      { status: 500 }
    );
  }
}
