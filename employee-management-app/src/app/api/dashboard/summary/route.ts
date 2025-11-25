import { NextResponse } from "next/server";
import { getDashboardSummary } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") ?? undefined;
    const summary = await getDashboardSummary(month);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[DASHBOARD_SUMMARY_ERROR]", error);
    return NextResponse.json({ message: "Failed to load dashboard summary" }, { status: 500 });
  }
}


