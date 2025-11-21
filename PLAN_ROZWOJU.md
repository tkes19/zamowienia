# Plan dalszego rozwoju aplikacji zamówień

1. **Dopasować aktualny formularz zamówień do pracy na telefonach (UX dla handlowca)**
   - Uprościć widoki i przepływ na małym ekranie.
   - Zadbaj o wygodne korzystanie na telefonie (duże przyciski, czytelne pola, minimalna liczba kroków).

2. **Zaprojektować i wdrożyć prosty system logowania i ról**
   - Role: `handlowiec`, `produkcja`, `magazyn` (opcjonalnie `admin`).
   - Logowanie po stronie backendu (Express) + ochrona wybranych endpointów.

3. **Dodać bazę danych i API do zapisu zamówień oraz historii**
   - Wybrać bazę (np. Postgres/Supabase/Railway/VPS).
   - Tabele: `users`, `orders`, `order_items` (w przyszłości `stock`).
   - Endpointy API do tworzenia i pobierania zamówień.

4. **Zbudować widok historii zamówień dla handlowca**
   - Lista jego zamówień (data, status, kwota, liczba pozycji).
   - Widok szczegółów konkretnego zamówienia.

5. **Zbudować panel produkcji**
   - Widok wszystkich zamówień z filtrowaniem (data, handlowiec, status).
   - Możliwość zmiany statusu zamówienia (np. „przyjęte”, „w realizacji”, „gotowe”).

6. **Rozszerzyć model danych o prosty magazyn**
   - Tabela `stock` (produkt, aktualny stan, minimalny/opt. stan).
   - Widok magazynu: podgląd stanów, ręczne korekty, historia ruchów.

7. **Dodać PWA**
   - Manifest, ikony, ustawienia pod „Dodaj do ekranu głównego”.
   - Podstawowy service worker (cache statycznych plików, ewentualnie prosty offline).

8. **Wybrać i wdrożyć hosting dla docelowej aplikacji**
   - Railway / Fly.io / VPS – jedna instancja backendu Node + frontend.
   - Konfiguracja zmiennych środowiskowych (`PORT`, `SMTP_*`, dane do bazy).

9. **Zachować pliki z katalogu `SOURCE` jako szablony**
   - `SOURCE/list_cities.php` i `SOURCE/list_products.php` pozostawić jako przykłady do przyszłych integracji (QNAP / inne katalogi).
