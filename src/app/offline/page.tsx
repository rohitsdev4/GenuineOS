'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center text-foreground gap-4 p-8">
      <div className="text-6xl">📡</div>
      <h1 className="text-2xl font-bold">No Internet Connection</h1>
      <p className="text-muted-foreground text-center max-w-sm">
        GenuineOS is offline. Your data is safe and will sync automatically when the connection is restored.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-4 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
