"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchEobiClient } from "@/lib/api-client";
import type { EobiFilters } from "@/types/payroll";

export const useEobi = (filters: EobiFilters) =>
  useQuery({
    queryKey: ["eobi", filters],
    queryFn: () => fetchEobiClient(filters),
    enabled: Boolean(filters),
  });


