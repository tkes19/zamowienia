# Plan dalszego rozwoju aplikacji zamówień

1. [ ] **Dopasować aktualny formularz zamówień do pracy na telefonach (UX dla handlowca)**
   - [ ] Uprościć widoki i przepływ na małym ekranie.
   - [ ] Zadbaj o wygodne korzystanie na telefonie (duże przyciski, czytelne pola, minimalna liczba kroków).

2. [ ] **Zaprojektować i wdrożyć prosty system logowania i ról**
   - [ ] Role: `handlowiec`, `produkcja`, `magazyn` (opcjonalnie `admin`).
   - [ ] Logowanie po stronie backendu (Express) + ochrona wybranych endpointów.

3. [ ] **Dodać bazę danych i API do zapisu zamówień oraz historii**
   - [ ] Wykorzystać Supabase jako bazę (zgodnie z `supabase/schema.sql`).
   - [ ] Tabele: `User`, `Order`, `OrderItem`, `Inventory` (już istnieją w schemacie).
   - [ ] Endpointy API do tworzenia i pobierania zamówień.

4. [ ] **Zbudować widok historii zamówień dla handlowca**
   - [ ] Lista jego zamówień (data, status, kwota, liczba pozycji).
   - [ ] Widok szczegółów konkretnego zamówienia.

5. [ ] **Zbudować panel produkcji**
   - [ ] Widok wszystkich zamówień z filtrowaniem (data, handlowiec, status).
   - [ ] Możliwość zmiany statusu zamówienia (np. „przyjęte”, „w realizacji”, „gotowe”).

6. [ ] **Rozszerzyć model danych o prosty magazyn**
   - [ ] Wykorzystać tabelę `Inventory` w Supabase.
   - [ ] Widok magazynu: podgląd stanów, ręczne korekty, historia ruchów.

7. [ ] **Dostępność produktów w czasie (magazyn + sezony)**
   - [ ] Ustalić docelowe znaczenie pól magazynowych:
     - `stock` – aktualny fizyczny stan magazynowy.
     - `stockReserved` – sztuki zarezerwowane na konkretne zamówienia.
     - `stockOrdered` – sztuki zamówione u dostawcy, których jeszcze nie ma.
     - `stockOptimal` / `reorderPoint` – stany docelowe / progi ostrzegawcze.
   - [ ] Zaplanować procesy biznesowe:
     - Przyjęcie dostawy: zwiększa `stock`, zmniejsza `stockOrdered`.
     - Zamówienie klienta: zwiększa `stockReserved`, przy wysyłce zmniejsza `stock` i `stockReserved`.
   - [ ] Zaplanować, jak handlowiec widzi dostępność w przyszłości:
     - Widok: "dostępne teraz" oraz "dostępne na wybraną datę".
     - Możliwość złożenia zamówienia na przyszły sezon (np. maj 2026), jeśli `stockOrdered` + planowane dostawy pokryją zapotrzebowanie.
   - [ ] Opisać w dokumentacji (AI_DEV_PLAN) logikę sprawdzania, czy na daną datę ilość będzie dostępna (uwzględniając dostawy i inne rezerwacje).
   - [ ] **Dodać logikę magazynu i dostępności w czasie**
     - [ ] Zaplanować, jak handlowiec widzi dostępność w przyszłości:
       - Widok: "dostępne teraz" oraz "dostępne na wybraną datę".
       - Możliwość złożenia zamówienia na przyszły sezon (np. maj 2026), jeśli `stockOrdered` + planowane dostawy pokryją zapotrzebowanie.
     - [ ] Opisać w dokumentacji (AI_DEV_PLAN) logikę sprawdzania, czy na daną datę ilość będzie dostępna (uwzględniając dostawy i inne rezerwacje).

8. [ ] **Dodać PWA**
   - [ ] Manifest, ikony, ustawienia pod „Dodaj do ekranu głównego”.
   - [ ] Podstawowy service worker (cache statycznych plików, ewentualnie prosty offline).

9. [ ] **Wybrać i wdrożyć hosting dla docelowej aplikacji**
   - [ ] Railway / Fly.io / VPS – jedna instancja backendu Node + frontend.
   - [ ] Konfiguracja zmiennych środowiskowych (`PORT`, `SMTP_*`, dane do bazy).

9. [ ] **Zachować pliki z katalogu `SOURCE` jako szablony**
   - [ ] `SOURCE/list_cities.php` i `SOURCE/list_products.php` pozostawić jako przykłady do przyszłych integracji (QNAP / inne katalogi).

---

**Uwaga:** Postęp prac oznaczaj:

- w tym pliku `PLAN_ROZWOJU.md` – z perspektywy biznesowej/produktowej (co już działa dla użytkownika),
- w `AI_DEV_PLAN.md` – z perspektywy technicznej (która Faza i które zadania backend/front zostały zrealizowane).
