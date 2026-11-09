import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/lib/services/notification-service';

export async function GET(req: NextRequest) {
  const _ = req.nextUrl.searchParams;
  try {
    const settings = await NotificationService.getSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    if (error?.digest?.startsWith('NEXT_')) {
      throw error;
    }
    console.error('[API/notifications/settings] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch notification settings' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await NotificationService.saveSettings(body);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 422 });
    }

    return NextResponse.json({ success: true, message: 'Settings saved successfully' });
  } catch (error: any) {
    console.error('[API/notifications/settings] Update Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update settings' },
      { status: 500 }
    );
  }
}

