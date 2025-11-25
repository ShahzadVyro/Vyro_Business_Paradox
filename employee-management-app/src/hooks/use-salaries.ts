"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchSalariesClient } from "@/lib/api-client";
import type { SalaryFilters } from "@/types/payroll";

export const useSalaries = (filters: SalaryFilters) =>
  useQuery({
    queryKey: ["salaries", filters],
    queryFn: () => fetchSalariesClient(filters),
    enabled: Boolean(filters),
  });


