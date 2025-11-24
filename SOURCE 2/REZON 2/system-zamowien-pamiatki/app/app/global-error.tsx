'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pl">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted text-center">
        <div className="rounded-lg bg-background p-6 shadow-lg">
          <h2 className="text-2xl font-semibold">Coś poszło nie tak</h2>
          <p className="mt-2 text-muted-foreground">
            Spróbuj ponownie lub skontaktuj się z zespołem REZON, jeśli problem będzie się powtarzał.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Button onClick={() => reset()}>Spróbuj ponownie</Button>
            <Button variant="outline" onClick={() => location.assign('/')}>Wróć do strony głównej</Button>
          </div>
        </div>
      </body>
    </html>
  );
}
