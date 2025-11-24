import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'REZON - Katalog Produktów',
  description: 'Personalizowane upominki i akcesoria modowe',
  keywords: 'rezon, upominki, magnesy, breloki, ceramika, personalizacja',
};

export default function PublicRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
