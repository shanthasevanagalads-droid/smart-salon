import { NextRequest, NextResponse } from 'next/server';
import { searchCustomers, upsertCustomer } from '@/lib/services/customer-service';
import { CustomerStatus } from '@/types/crm';
import { validateAndFormatSLPhone, validateRequiredString } from '@/lib/security/validation';
import { validateCsrfOrigin } from '@/lib/security/csrf';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const status = (searchParams.get('status') as CustomerStatus) || undefined;
  const limit = parseInt(searchParams.get('limit') || '30', 10);

  try {
    const customers = await searchCustomers(query, status, limit);
    return NextResponse.json({ success: true, count: customers.length, customers });
  } catch (err: unknown) {
    if ((err as any)?.digest?.startsWith('NEXT_')) {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'Error retrieving customers.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const csrf = validateCsrfOrigin(request);
    if (!csrf.isValid) {
      return NextResponse.json({ success: false, error: csrf.error }, { status: 403 });
    }

    const body = await request.json();

    // 1. Validate required fields
    const nameVal = validateRequiredString(body.name, 'Customer Name', 2, 100);
    if (!nameVal.isValid) {
      return NextResponse.json({ success: false, error: nameVal.error }, { status: 400 });
    }

    const phoneVal = validateAndFormatSLPhone(body.phone);
    if (!phoneVal.isValid) {
      return NextResponse.json({ success: false, error: phoneVal.error }, { status: 400 });
    }

    // 2. Upsert customer (One Phone = One Customer deduplication)
    const result = await upsertCustomer({
      name: nameVal.sanitized,
      phone: phoneVal.formatted,
      whatsapp: body.whatsapp,
      preferredBarberId: body.preferredBarberId,
      notes: body.notes,
      address: body.address,
      dateOfBirth: body.dateOfBirth,
      language: body.language,
      status: body.status,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to register customer.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

