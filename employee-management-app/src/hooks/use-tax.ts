"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchTaxCalculationsClient, fetchTaxByEmployeeClient } from "@/lib/api-client";
import type { TaxFilters } from "@/types/tax";

export const useTaxCalculations = (filters: TaxFilters) =>
  useQuery({
    queryKey: ["tax-calculations", filters],
    queryFn: () => fetchTaxCalculationsClient(filters),
  });

export const useTaxByEmployee = (employeeId: number) =>
  useQuery({
    queryKey: ["tax-employee", employeeId],
    queryFn: () => fetchTaxByEmployeeClient(employeeId),
    enabled: !!employeeId && !isNaN(employeeId),
  });

