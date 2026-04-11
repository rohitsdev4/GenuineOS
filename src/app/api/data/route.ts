import { NextResponse } from 'next/server';

// Stub route — all data operations now happen client-side via IndexedDB
// Kept for backwards compatibility

export async function GET() {
  return NextResponse.json({ message: 'Data operations are now handled client-side via IndexedDB' });
}

export async function POST() {
  return NextResponse.json({ message: 'Data operations are now handled client-side via IndexedDB' });
}

export async function PUT() {
  return NextResponse.json({ message: 'Data operations are now handled client-side via IndexedDB' });
}

export async function DELETE() {
  return NextResponse.json({ message: 'Data operations are now handled client-side via IndexedDB' });
}
