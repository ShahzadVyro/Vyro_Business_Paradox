"use client";

import axios from "axios";
import type { EmployeeFilters, EmployeeRecord, EmploymentStatus, EmployeeOffboardingRecord } from "@/types/employee";
import type { EobiFilters, EobiListResponse, SalaryFilters, SalaryListResponse, DashboardSummary } from "@/types/payroll";
import type { OffboardingNotification } from "@/types/dashboard";

const client = axios.create({
  baseURL: "/api",
});

export const fetchEmployeesClient = async (filters: EmployeeFilters) => {
  const { data } = await client.get<EmployeeRecord[]>("/employees", {
    params: filters,
  });
  return data;
};

export const fetchEmployeeClient = async (employeeId: string) => {
  const { data } = await client.get<EmployeeRecord>(`/employees/${employeeId}`);
  return data;
};

export const fetchEmployeeFullClient = async (employeeId: string) => {
  const { data } = await client.get(`/employees/${employeeId}/full`);
  return data;
};

export const updateEmploymentStatusClient = async (
  employeeId: string,
  payload: { Employment_Status: EmploymentStatus; Employment_End_Date?: string | null; Reason?: string },
) => {
  const { data } = await client.patch<EmployeeRecord>(`/employees/${employeeId}/status`, payload);
  return data;
};

export const fetchLatestSalaryClient = async (employeeId: string) => {
  const { data } = await client.get(`/salaries/${employeeId}`);
  return data;
};

export const fetchLatestEOBIClient = async (employeeId: string) => {
  const { data } = await client.get(`/eobi/${employeeId}`);
  return data;
};

export const fetchSalariesClient = async (filters: SalaryFilters) => {
  const { data } = await client.get<SalaryListResponse>("/salaries", { params: filters });
  return data;
};

export const fetchEobiClient = async (filters: EobiFilters) => {
  const { data } = await client.get<EobiListResponse>("/eobi", { params: filters });
  return data;
};

export const fetchDashboardSummaryClient = async (month?: string) => {
  const { data } = await client.get<DashboardSummary>("/dashboard/summary", { params: month ? { month } : undefined });
  return data;
};

export const scheduleOffboardingClient = async (
  employeeId: string,
  payload: { Employment_End_Date: string; Note?: string; Scheduled_By?: string },
) => {
  const { data } = await client.post<EmployeeOffboardingRecord>(`/employees/${employeeId}/offboarding`, payload);
  return data;
};

export const cancelOffboardingClient = async (employeeId: string) => {
  await client.delete(`/employees/${employeeId}/offboarding`);
};

export const fetchOffboardingNotificationsClient = async () => {
  const { data } = await client.get<{ upcoming: OffboardingNotification[]; today: OffboardingNotification[] }>(
    "/offboarding/notifications",
  );
  return data;
};

export const fetchOPDBenefitsClient = async (filters: import("@/types/opd").OPDFilters) => {
  const { data } = await client.get<import("@/types/opd").OPDListResponse>("/opd", { params: filters });
  return data;
};

export const fetchOPDByEmployeeClient = async (employeeId: number) => {
  const { data } = await client.get<{ benefits: import("@/types/opd").OPDBenefitRecord[]; balance: import("@/types/opd").OPDBalance | null }>(`/opd/${employeeId}`);
  return data;
};

export const fetchTaxCalculationsClient = async (filters: import("@/types/tax").TaxFilters) => {
  const { data } = await client.get<import("@/types/tax").TaxListResponse>("/tax", { params: filters });
  return data;
};

export const fetchTaxByEmployeeClient = async (employeeId: number) => {
  const { data } = await client.get<{ tax: import("@/types/tax").TaxCalculationRecord[] }>(`/tax/${employeeId}`);
  return data;
};

