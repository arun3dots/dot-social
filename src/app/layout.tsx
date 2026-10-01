import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '@/components/providers/AuthProvider';

export const metadata: Metadata = {
  title: 'Social Engine // Autonomous Multi-Platform Dispatcher',
  description: 'AI-driven social media calendar, human-in-the-loop approval, and multi-platform publishing engine for Instagram, LinkedIn, and X.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
