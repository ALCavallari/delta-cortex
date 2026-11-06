import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Delta CorteX — Sistema Integrado de Gestão | Delta S Engenharia',
  description:
    'Sistema integrado de engenharia, consultoria ambiental e acompanhamento sistemático da Delta S Engenharia.',
  icons: {
    icon: '/logo-delta-s.png',
    apple: '/logo-delta-s.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#333436',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col font-sans bg-slate-50 text-[#333436] antialiased selection:bg-[#00AFF0] selection:text-white">
        {children}
      </body>
    </html>
  );
}
