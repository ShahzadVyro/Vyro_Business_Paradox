"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchOPDBenefitsClient, fetchOPDByEmployeeClient } from "@/lib/api-client";
import type { OPDFilters } from "@/types/opd";

export const useOPDBenefits = (filters: OPDFilters) =>
  useQuery({
    queryKey: ["opd-benefits", filters],
    queryFn: () => fetchOPDBenefitsClient(filters),
  });

export const useOPDByEmployee = (employeeId: number) =>
  useQuery({
    queryKey: ["opd-employee", employeeId],
    queryFn: () => fetchOPDByEmployeeClient(employeeId),
    enabled: !!employeeId && !isNaN(employeeId),
  });

