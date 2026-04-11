import { NextResponse } from 'next/server';

// Stub route — settings are now stored client-side in IndexedDB
// Kept for backwards compatibility

export async function GET() {
  return NextResponse.json({ message: 'Settings are now managed client-side via IndexedDB' });
}

export async function PUT() {
  return NextResponse.json({ message: 'Settings are now managed client-side via IndexedDB' });
}
