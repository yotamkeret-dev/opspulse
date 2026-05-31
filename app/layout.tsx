import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'OpsPulse',
  description: 'Visibility into Operations Impact'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
