import { NextResponse } from 'next/server';
import { updateEmploymentStatus } from '@/lib/employees';
import type { EmploymentStatus } from '@/types/employee';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ employeeId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { employeeId } = await params;
    const payload = await request.json();
    const nextStatus = payload?.Employment_Status as EmploymentStatus;

    if (!nextStatus) {
      return NextResponse.json({ message: 'Employment_Status is required' }, { status: 400 });
    }

    const updated = await updateEmploymentStatus(employeeId, nextStatus, {
      reason: payload?.Reason,
      endDate: payload?.Employment_End_Date,
      updatedBy: 'dashboard@vyro.ai',
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[EMPLOYEE_STATUS_ERROR]', error);
    return NextResponse.json({ message: 'Failed to update status' }, { status: 500 });
  }
}

