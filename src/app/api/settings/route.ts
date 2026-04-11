import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Get settings (singleton pattern)
export async function GET() {
  try {
    let settings = await db.appSettings.findFirst();
    if (!settings) {
      settings = await db.appSettings.create({ data: {} });
    }
    return NextResponse.json(settings);
  } catch (error: any) {
    console.error('GET settings error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Update settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    let settings = await db.appSettings.findFirst();
    if (!settings) {
      settings = await db.appSettings.create({ data: body });
    } else {
      settings = await db.appSettings.update({
        where: { id: settings.id },
        data: body,
      });
    }

    return NextResponse.json(settings);
  } catch (error: any) {
    console.error('PUT settings error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
