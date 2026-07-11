import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Satisfy } from 'next/font/google';
import { Dancing_Script } from 'next/font/google';
import { Manrope } from 'next/font/google';
import { Hanken_Grotesk } from 'next/font/google';
import './globals.css';
import ClientLayout from './ClientLayout';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const dancingScript = Dancing_Script({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dancingscript',
});

const satisfy = Satisfy({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-satisfy',
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
});

const hankenGrotesk = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-hanken',
});

export const metadata: Metadata = {
  title: 'Outfitr',
  description:
    'Smart wardrobe app — manage clothing, plan outfits, and take sustainable action.',
  icons: [
    { rel: 'icon', url: '/logo.png', sizes: '512x512' },
    { rel: 'apple-touch-icon', url: '/logo.png', sizes: '512x512' },
    { rel: 'icon', url: '/logo.png', sizes: '192x192', type: 'image/png' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${dancingScript.variable} ${satisfy.variable} ${manrope.variable} ${hankenGrotesk.variable} antialiased`}
      >
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
