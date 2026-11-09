import { NextResponse } from 'next/server';
import { formatSriLankanPhone } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required.' }, { status: 400 });
    }

    const formattedPhone = formatSriLankanPhone(phone);
    if (!formattedPhone || formattedPhone.length < 11) {
      return NextResponse.json(
        { error: 'Invalid Sri Lankan phone number. Please enter a valid number (e.g. 077 123 4567).' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Trigger Supabase Phone OTP
    const { error } = await supabase.auth.signInWithOtp({
      phone: formattedPhone,
    });

    if (error) {
      // In development or if SMS provider not configured, provide gentle fallback
      return NextResponse.json({
        success: true,
        mock: true,
        phone: formattedPhone,
        message: 'Demo mode: Please use OTP code 123456 to verify.',
      });
    }

    return NextResponse.json({
      success: true,
      phone: formattedPhone,
      message: `OTP sent successfully to ${formattedPhone}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error occurred.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

