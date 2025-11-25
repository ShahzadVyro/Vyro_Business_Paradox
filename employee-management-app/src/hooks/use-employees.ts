"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchEmployeesClient, fetchEmployeeFullClient } from "@/lib/api-client";
import type { EmployeeFilters } from "@/types/employee";

export const useEmployees = (filters: EmployeeFilters) =>
  useQuery({
    queryKey: ["employees", filters],
    queryFn: () => fetchEmployeesClient(filters),
  });

export const useEmployeeDetail = (employeeId?: string | null) =>
  useQuery({
    queryKey: ["employee", employeeId],
    queryFn: () => fetchEmployeeFullClient(employeeId!),
    enabled: Boolean(employeeId),
  });

