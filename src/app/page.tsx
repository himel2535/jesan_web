import { checkBackendHealth } from '@/core/api/health';

// Check the backend on every request, not once at build time.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const isUp = await checkBackendHealth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Jesan Enterprise</h1>
      <p
        role="status"
        className={`rounded-full px-4 py-2 text-lg font-medium text-white ${isUp ? 'bg-ok' : 'bg-down'}`}
      >
        Backend: {isUp ? 'চলছে' : 'বন্ধ'}
      </p>
    </main>
  );
}
