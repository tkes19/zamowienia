# Plan dalszego rozwoju aplikacji zamówień

1. [x] **Dopasować aktualny formularz zamówień do pracy na telefonach (UX dla handlowca)**
   - [x] Uprościć widoki i przepływ na małym ekranie.
   - [x] Zadbaj o wygodne korzystanie na telefonie (duże przyciski, czytelne pola, minimalna liczba kroków).
   - [x] Uporządkować logikę galerii produktów (tryby PM/KI, pamiętanie produktu, poprawne wyświetlanie grafik) w aktualnym formularzu.
   - [x] Responsywny design: breakpointy CSS dla tablet (720px) i telefon (<720px).
   - [x] Double-tap zoom na obrazku galerii (desktop: double-click, mobile: double-tap).
   - [x] Touch-friendly: min-height 44–48px dla przycisków i pól, font-size 16px na mobile.
   - [x] Panel "Moi klienci" z CRUD: lista, wyszukiwanie, dodawanie, edycja, usuwanie klientów.
   - [x] Wybór klienta w formularzu zamówień: pole "Szukaj" + lista klientów z filtrowaniem po dowolnym fragmencie tekstu.
   - [x] Auto-wybór klienta, gdy po filtrowaniu pozostaje dokładnie jeden wynik.
   - [x] **Nowe:** Widoczność przypisania klienta do handlowca (kolumna w tabeli klientów dla ADMIN/SALES_DEPT).
   - [x] **Nowe:** Możliwość przypisania klienta do handlowca (dla ADMIN/SALES_DEPT w panelu klientów).
   - [x] **Nowe:** Wyświetlanie nazwy handlowca w dropdownie klientów formularza zamówień.

2. [x] **Zaprojektować i wdrożyć prosty system logowania i ról**
   - [x] Role: `handlowiec` (`SALES_REP`), `Dział Sprzedaży` (`SALES_DEPT`), `admin` (`ADMIN`), `magazyn`, `produkcja`.
   - [x] Logowanie po stronie backendu (Express) + ochrona wybranych endpointów (cookies `auth_id`, `auth_role`).

3. [x] **Dodać bazę danych i API do zapisu zamówień oraz historii**
   - [x] Wykorzystać Supabase jako bazę (zgodnie z `supabase/schema.sql`).
   - [x] Tabele: `User`, `Order`, `OrderItem` (magazyn `Inventory` będzie rozwijany później).
   - [x] Endpointy API do tworzenia i pobierania zamówień: `POST /api/orders`, `GET /api/orders/my`, `GET /api/orders/:id`.

4. [x] **Zbudować widok historii zamówień dla handlowca**
   - [x] Lista jego zamówień w formularzu (`index.html`) – numer, klient, data, status, suma.
   - [x] Widok szczegółów konkretnego zamówienia (pozycje, projekty, ilości, miejscowość).

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

8. [ ] **KI – kontrola dostępu do folderów / projektów**
   - [ ] Panel admina „Przydziały folderów” oparty o `UserFolderAccess` (lista handlowców, akcje dodaj/wyłącz/edytuj).
   - [ ] Endpoint `GET /api/user-folder-access` + zabezpieczenie `/api/gallery/*` filtrem folderów.
   - [ ] Front KI pobiera tylko przydzielone foldery (handlowiec) lub wszystkie (SALES_DEPT/ADMIN).
   - [ ] Obsługa klientów zewnętrznych: konto `CLIENT`/`NEW_USER`, przypisany folder, opcjonalny link/token gościnny.

9. [ ] **Dodać PWA**
   - [ ] Manifest, ikony, ustawienia pod „Dodaj do ekranu głównego”.
   - [ ] Podstawowy service worker (cache statycznych plików, ewentualnie prosty offline).

10. [ ] **Wybrać i wdrożyć hosting dla docelowej aplikacji**
   - [ ] Railway / Fly.io / VPS – jedna instancja backendu Node + frontend.
   - [ ] Konfiguracja zmiennych środowiskowych (`PORT`, `SMTP_*`, dane do bazy).

11. [ ] **Zachować pliki z katalogu `SOURCE` jako szablony**
   - [ ] `SOURCE/list_cities.php` i `SOURCE/list_products.php` pozostawić jako przykłady do przyszłych integracji (QNAP / inne katalogi).

---

**Uwaga:** Postęp prac oznaczaj:

- w tym pliku `PLAN_ROZWOJU.md` – z perspektywy biznesowej/produktowej (co już działa dla użytkownika),
- w `AI_DEV_PLAN.md` – z perspektywy technicznej (która Faza i które zadania backend/front zostały zrealizowane).

**Notatka dot. trybów formularza:**

- Obecnie zaimplementowane tryby to:
  - "Projekty miejscowości" (PM),
  - "Klienci indywidualni" (KI).
- W przyszłości planowane są dodatkowe tryby:
  - "Projekty imienne" (PI),
  - "Projekty hasła" (Ph).
- Dla nowych trybów należy zachować taką samą, pełną separację logiki galerii jak dla PM/KI (osobne listy produktów, cache plików i stan wyboru).
