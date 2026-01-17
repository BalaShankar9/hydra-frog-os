'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthed } from '@/lib/auth';

interface ProtectedProps {
  children: React.ReactNode;
}

/**
 * Protected route wrapper component
 * Redirects to /login if user is not authenticated
 */
export function Protected({ children }: ProtectedProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check authentication status on mount
    const authenticated = isAuthed();
    
    if (!authenticated) {
      router.replace('/login');
    } else {
      setIsAuthenticated(true);
    }
    
    setIsLoading(false);
  }, [router]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  // Don't render children if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
