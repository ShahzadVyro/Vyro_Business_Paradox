"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDashboardSummaryClient } from "@/lib/api-client";

export const useDashboardSummary = (month?: string) =>
  useQuery({
    queryKey: ["dashboard-summary", month],
    queryFn: () => fetchDashboardSummaryClient(month),
  });


