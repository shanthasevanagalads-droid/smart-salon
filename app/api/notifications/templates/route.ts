import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/lib/services/notification-service';

export async function GET(req: NextRequest) {
  const _ = req.nextUrl.searchParams;
  try {
    const templates = await NotificationService.getTemplates();
    return NextResponse.json({ success: true, templates });
  } catch (error: any) {
    if (error?.digest?.startsWith('NEXT_')) {
      throw error;
    }
    console.error('[API/notifications/templates] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch notification templates' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await NotificationService.saveTemplate(body);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 422 });
    }

    return NextResponse.json({ success: true, message: 'Template updated successfully' });
  } catch (error: any) {
    console.error('[API/notifications/templates] Update Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update template' },
      { status: 500 }
    );
  }
}

