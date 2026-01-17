'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthed } from '@/lib/auth';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to appropriate page based on auth status
    if (isAuthed()) {
      router.replace('/projects');
    } else {
      router.replace('/login');
    }
  }, [router]);

  // Show loading while redirecting
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-blue-600">
          🐸 HydraFrog
        </h1>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mt-4" />
      </div>
    </main>
  );
}
