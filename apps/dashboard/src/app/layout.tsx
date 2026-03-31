import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/Toast';
import { FlagProvider } from '@/components/FlagProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Hydra Frog OS - Dashboard',
  description: 'Dashboard for Hydra Frog OS platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary>
          <FlagProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </FlagProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
