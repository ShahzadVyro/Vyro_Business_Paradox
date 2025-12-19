"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchPayTemplateClient } from "@/lib/api-client";

export const useNewHires = (month: string) =>
  useQuery({
    queryKey: ["pay-template", "new-hires", month],
    queryFn: () => fetchPayTemplateClient("new-hires", month),
  });

export const useLeavers = (month: string) =>
  useQuery({
    queryKey: ["pay-template", "leavers", month],
    queryFn: () => fetchPayTemplateClient("leavers", month),
  });

export const useIncrements = (month: string) =>
  useQuery({
    queryKey: ["pay-template", "increments", month],
    queryFn: () => fetchPayTemplateClient("increments", month),
  });

export const useConfirmations = (month: string) =>
  useQuery({
    queryKey: ["pay-template", "confirmations", month],
    queryFn: () => fetchPayTemplateClient("confirmations", month),
  });
