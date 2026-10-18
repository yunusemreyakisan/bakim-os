import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { IBM_Plex_Sans } from 'next/font/google';
import { AuthProvider } from '@/components/auth-provider';
import { ConnectivityProvider } from '@/components/connectivity-provider';
import { PwaRegister } from '@/components/pwa-register';
import './globals.css';

const sans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'] });

export const metadata: Metadata = {
  title: 'BakımOS',
  description: 'Fabrika bakım operasyonları',
  manifest: '/manifest.json',
  applicationName: 'BakımOS',
  appleWebApp: {
    capable: true,
    title: 'BakımOS',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#142033',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body className={sans.className}>
        <AuthProvider>
          <ConnectivityProvider>
            <PwaRegister />
            {children}
          </ConnectivityProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
