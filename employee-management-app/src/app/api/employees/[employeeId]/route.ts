import { NextResponse } from 'next/server';
import { fetchEmployeeById } from '@/lib/employees';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ employeeId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { employeeId } = await params;
    const employee = await fetchEmployeeById(employeeId);

    if (!employee) {
      return NextResponse.json({ message: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json(employee);
  } catch (error) {
    console.error('[EMPLOYEE_DETAIL_ERROR]', error);
    return NextResponse.json({ message: 'Failed to fetch employee' }, { status: 500 });
  }
}

