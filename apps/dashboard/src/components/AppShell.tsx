'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { clearToken } from '@/lib/auth';
import { authApi } from '@/lib/api';

interface AppShellProps {
  children: React.ReactNode;
}

interface User {
  id: string;
  email: string;
}

/**
 * Main application layout shell with sidebar and topbar
 */
export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Fetch current user info
    const fetchUser = async () => {
      try {
        const userData = await authApi.me();
        setUser(userData);
      } catch (error) {
        console.error('Failed to fetch user:', error);
        // If we can't fetch user, they might be logged out
        handleLogout();
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, []);

  const handleLogout = () => {
    clearToken();
    router.push('/login');
  };

  const navigation = [
    { name: 'Projects', href: '/projects', icon: FolderIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:hidden
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <span className="text-xl font-bold text-blue-600">🐸 HydraFrog</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 text-gray-500 hover:text-gray-700"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        <nav className="mt-4 px-2">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${pathname === item.href 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-gray-700 hover:bg-gray-100'
                }
              `}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          ))}
        </nav>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-1 bg-white border-r border-gray-200">
          {/* Logo */}
          <div className="flex items-center h-16 px-4 border-b border-gray-200">
            <span className="text-xl font-bold text-blue-600">🐸 HydraFrog</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 mt-4 px-2 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${pathname === item.href 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-gray-700 hover:bg-gray-100'
                  }
                `}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Main content area */}
      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-gray-500 hover:text-gray-700 lg:hidden"
            >
              <MenuIcon className="w-6 h-6" />
            </button>

            {/* Spacer for desktop */}
            <div className="hidden lg:block" />

            {/* User menu */}
            <div className="flex items-center gap-4">
              {isLoading ? (
                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
              ) : user ? (
                <span className="text-sm text-gray-600">{user.email}</span>
              ) : null}
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

// ============================================
// Icon Components
// ============================================

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
