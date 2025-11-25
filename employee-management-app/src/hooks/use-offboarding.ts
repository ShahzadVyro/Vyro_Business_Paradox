"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelOffboardingClient,
  fetchOffboardingNotificationsClient,
  scheduleOffboardingClient,
} from "@/lib/api-client";

export const useOffboardingNotifications = () =>
  useQuery({
    queryKey: ["offboarding-notifications"],
    queryFn: fetchOffboardingNotificationsClient,
  });

export const useScheduleOffboarding = (employeeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { Employment_End_Date: string; Note?: string; Scheduled_By?: string }) =>
      scheduleOffboardingClient(employeeId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["offboarding-notifications"] });
    },
  });
};

export const useCancelOffboarding = (employeeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cancelOffboardingClient(employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["offboarding-notifications"] });
    },
  });
};


