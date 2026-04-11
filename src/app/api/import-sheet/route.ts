import { NextResponse } from 'next/server';

// Stub route — local file import is no longer supported with IndexedDB migration
// Use Google Sheets sync or manual data entry instead

export async function POST() {
  return NextResponse.json({
    success: false,
    message: 'Local file import is deprecated. Please use Google Sheets sync or add records manually.',
  });
}
