import { NextResponse } from "next/server";
import { getBigQueryClient } from "@/lib/bigquery";
import { ensureOffboardingTableExists } from "@/lib/offboarding";

const dataset = process.env.BQ_DATASET;
const table = process.env.BQ_TABLE;
const offboardingTable = process.env.BQ_OFFBOARDING_TABLE ?? "EmployeeOffboarding_v1";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!dataset || !table) {
    return NextResponse.json({ message: "Missing BigQuery configuration" }, { status: 500 });
  }
  try {
    await ensureOffboardingTableExists();
    const client = getBigQueryClient();
    const tableRef = `\`${process.env.GCP_PROJECT_ID}.${dataset}.${table}\``;
    const offRef = `\`${process.env.GCP_PROJECT_ID}.${dataset}.${offboardingTable}\``;
    const query = `
      WITH scheduled AS (
        SELECT
          base.Employee_ID,
          base.Full_Name,
          base.Department,
          base.Designation,
          off.Employment_End_Date,
          off.Employment_End_Date_ISO,
          off.Offboarding_Status,
          off.Note
        FROM ${tableRef} base
        JOIN ${offRef} off ON base.Employee_ID = off.Employee_ID
        WHERE off.Offboarding_Status = 'scheduled'
      ),
      derived AS (
        SELECT
          Employee_ID,
          Full_Name,
          Department,
          Designation,
          Employment_End_Date,
          Employment_End_Date_ISO,
          'scheduled_from_directory' AS Offboarding_Status,
          CAST(NULL AS STRING) AS Note
        FROM ${tableRef}
        WHERE Employment_End_Date_ISO IS NOT NULL
          AND SAFE.PARSE_DATE('%Y-%m-%d', Employment_End_Date_ISO) >= CURRENT_DATE()
      )
      SELECT * FROM scheduled
      UNION ALL
      SELECT * FROM derived
      WHERE Employee_ID NOT IN (SELECT Employee_ID FROM scheduled)
    `;
    const [rows] = await client.query({ query });
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = [];
    const todayList = [];
    for (const row of rows) {
      if (row.Employment_End_Date_ISO === today) {
        todayList.push(row);
      } else {
        upcoming.push(row);
      }
    }
    return NextResponse.json({ upcoming, today: todayList });
  } catch (error) {
    console.error("[OFFBOARDING_NOTIFICATIONS_ERROR]", error);
    return NextResponse.json({ message: "Failed to load notifications" }, { status: 500 });
  }
}


