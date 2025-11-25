# 🧠 AI Agent Master Plan: System Zamówień "Rezon" Next-Gen

Ten dokument stanowi **kompleksową instrukcję rozwoju** systemu zamówień. Łączy on strukturę bazy danych Supabase z logiką biznesową poprzedniej wersji aplikacji ("SOURCE 2"), adaptując ją do nowego, lżejszego stacku technologicznego.

---

## 1. Wizja i Cel
Celem jest odtworzenie zaawansowanej funkcjonalności systemu B2B (ERP/CRM) istniejącego wcześniej w Next.js/Prisma, przy użyciu obecnego stacku: **Node.js (Express) + Vanilla JS + Supabase**.

**Kluczowe założenie:** Rezygnacja z ORM (Prisma) na rzecz czystego klienta Supabase (`@supabase/supabase-js`) oraz przeniesienie ciężaru logiki do bazy danych (PostgreSQL).

## 2. Stack Technologiczny
*   **Backend:** Node.js, Express.js
*   **Baza Danych:** Supabase (PostgreSQL)
*   **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+ Modules)
*   **Integracje:** QNAP (Galeria zdjęć)

---

## 2.1. Struktura Starej Aplikacji (SOURCE 2)
Stara aplikacja znajdowała się w katalogu:

`SOURCE 2/REZON 2/system-zamowien-pamiatki/app/app`

Najważniejsze podkatalogi i ich znaczenie:

*   **`page.tsx`** – główny dashboard / strona startowa.
*   **`nowe-zamowienie/`** – kreator nowego zamówienia (logika formularza, wybór produktów, klientów itp.).
*   **`koszyk/`** – widok koszyka oraz operacje na pozycjach zamówienia.
*   **`zamowienia/`** – lista istniejących zamówień, widok szczegółów.
*   **`klienci/`** – zarządzanie klientami (CRUD na `Customer`).
*   **`magazyn/`** – widok stanów magazynowych (`Inventory`).
*   **`admin/`, `uzytkownicy/`, `ustawienia/`** – panel administracyjny, konfiguracja systemu, zarządzanie użytkownikami i uprawnieniami.

Dodatkowo w katalogu `SOURCE 2/REZON 2/system-zamowien-pamiatki/app/lib/` znajdują się kluczowe moduły logiki biznesowej:

*   **`types.ts`** – definicje typów domenowych (Product, Order, Statusy, Kategorie, Źródła produktów).
*   **`cart.ts`** – zaawansowana logika koszyka/draftu (łączenie pozycji, liczenie sum, ulubione zamówienia).
*   **`project-utils.ts`, `ocr-utils.ts`, `r2.ts`** – logika pomocnicza.

Każdy przyszły agent, który będzie projektował UI lub przepisywał widoki, powinien:

1.  Najpierw sprawdzić, czy odpowiedni moduł/strona nie istnieje już w `SOURCE 2`.
2.  Użyć istniejącej struktury (nazwy plików, komponentów, przepływ ekranów) jako inspiracji i dokumentacji tego, jak system **kiedyś działał**.

---

## 3. Analiza Bazy Danych i Mapowanie Funkcjonalności
Na podstawie `supabase/schema.sql` oraz kodu `SOURCE 2`:

| Funkcjonalność | Tabela w Supabase | Logika z SOURCE 2 (do zaimplementowania) |
| :--- | :--- | :--- |
| **Katalog Produktów** | `Product` | Wyszukiwanie po `identifier`, `index`, `name`. Kategorie (ENUM). |
| **Magazyn** | `Inventory` | Śledzenie `stock` (stan), `stockReserved` (rezerwacje), `reorderPoint`. |
| **Użytkownicy** | `User`, `Account` | Role: `ADMIN`, `SALES_REP`. Dostęp do folderów (`UserFolderAccess`). |
| **Klienci** | `Customer` | Przypisanie klienta do handlowca (`salesRepId`). Dane do faktury. |
| **Koszyk / Drafty** | `order_drafts`, `order_draft_items` | **Kluczowe:** Autosave koszyka, walidacja typów klienta (`PM`, `KI` itp.). |
| **Zamówienia** | `Order`, `OrderItem` | Historia zamówień, statusy (`PENDING`, `SHIPPED`), numeracja roczna. |
| **Uprawnienia** | `Permission`, `RolePermission` | RBAC - kontrola dostępu do modułów. |

---

## 4. Roadmapa Rozwoju (Krok po Kroku)

### FAZA 1: Fundament Danych (Backend)
*Cel: Odcięcie zewnętrznego API i pełna kontrola nad danymi.*

1.  **[PILNE] Migracja Endpointu Produktów (`GET /api/v1/products`)**:
    *   Backend musi czytać z tabeli `Product` i dołączać `Inventory`.
    *   Implementacja wyszukiwania `ILIKE` po wielu kolumnach.
    *   Mapowanie danych: Backend musi zwracać strukturę zgodną z obecnym frontendem (np. mapować `index` -> `pc_id`), aby nie psuć UI.

### FAZA 2: Tożsamość i Kontekst (Auth)
*Cel: System musi wiedzieć, kto pracuje.*

1.  **Logowanie**:
    *   Wdrożenie endpointu `/api/auth/login` (weryfikacja hasła z `User` lub Supabase Auth).
    *   Frontend: Prosty formularz logowania, zapis JWT/Sesji.
2.  **Kontekst Handlowca**:
    *   Pobieranie danych zalogowanego usera: rola, przypisane foldery (`UserFolderAccess`).
    *   Middleware `authMiddleware` w Expressie chroniący API.

### FAZA 3: Zaawansowany Koszyk (Drafty & Klienci)
*Cel: Odtworzenie logiki z `lib/cart.ts` w oparciu o bazę.*

1.  **Mechanizm Draftów (Wersje Robocze)**:
    *   Zamiast trzymać koszyk tylko w `localStorage`, frontend wysyła go do `POST /api/drafts`.
    *   Backend zapisuje do `order_drafts` (tylko jeden aktywny draft na usera).
    *   **Korzyść:** Handlowiec nie traci koszyka po zmianie urządzenia.
2.  **Wybór Klienta**:
    *   Endpoint `GET /api/my-customers` (klienci danego handlowca).
    *   Frontend: Dropdown w koszyku "Wybierz klienta".
3.  **Logika "Projektów" (Specyfika Branży)**:
    *   Obsługa pól `selectedProjects` (zakresy np. "1-5, 10") w `order_draft_items`.
    *   Walidacja poprawności zakresów po stronie serwera.

### FAZA 4: Finalizacja Zamówienia i Magazyn
*Cel: Przekształcenie koszyka w wiążące zamówienie + spójna logika magazynu w czasie.*

1.  **Konwersja Draft -> Order**:
    *   Endpoint `POST /api/orders/finalize`.
    *   Trigger lub funkcja SQL przenosi dane z `order_drafts` do `Order`/`OrderItem`.
    *   Generowanie numeru zamówienia (format: `YYYY/NR/USER`).
2.  **Aktualizacja Magazynu (stany dla małej firmy)**:
    *   `stock` – fizyczny stan w magazynie.
    *   `stockReserved` – sztuki zarezerwowane na zamówienia klientów.
    *   `stockOrdered` – sztuki zamówione u dostawców, jeszcze niedostarczone.
    *   `stockOptimal` / `reorderPoint` – poziomy docelowe / progi zamawiania.
    *   Docelowa logika (do wdrożenia w kolejnych krokach):
        - Finalizacja zamówienia klienta: zwiększenie `stockReserved`.
        - Wydanie towaru (wysyłka): zmniejszenie `stock` i `stockReserved`.
        - Zamówienie do dostawcy: zwiększenie `stockOrdered`.
        - Przyjęcie dostawy: zwiększenie `stock`, zmniejszenie `stockOrdered`.

#### 4.1. Dostępność produktu w czasie (dla handlowca)

Cel: umożliwić handlowcowi składanie zamówień **z przyszłą datą realizacji**, biorąc pod uwagę planowane dostawy.

1.  **Dodatkowe dane magazynowe** (do zaplanowania w schemacie):
    *   Tabela `PurchaseOrder` (robocza nazwa):
        - `id`
        - `productId`
        - `quantity`
        - `expectedAt` (data przewidywanej dostawy)
        - (opcjonalnie: `supplier`, `status`)
    *   Alternatywnie: pole `expectedDeliveryDate` w `Inventory`, ale preferowana jest oddzielna tabela z wieloma dostawami.

2.  **Obliczanie dostępności**:
    *   Dostępne "teraz":
        - `availableNow = stock - stockReserved`.
    *   Dostępne na wybraną datę `D`:
        - `availableAtDate = (stock - stockReserved)
          + suma(quantity z PurchaseOrder, gdzie expectedAt <= D)
          - rezerwacje z innych zamówień o dacie realizacji <= D`.

3.  **Walidacja zamówienia klienta z datą realizacji**:
    *   Zamówienie ma pole `deliveryDate` / `productionDate`.
    *   Przy dodawaniu pozycji:
        - Jeżeli `qty <= availableNow` → pozycja może być realizowana "od ręki".
        - Jeżeli `qty > availableNow`, ale `qty <= availableAtDate` → system dopuszcza pozycję, ale oznacza ją jako "realizacja po dostawie" (data wg `expectedAt`).
        - Jeżeli `qty > availableAtDate` → błąd biznesowy: należy zmniejszyć ilość lub przesunąć datę realizacji.

4.  **UX dla handlowca**:
    *   W karcie produktu informacja typu: "Brak na stanie, spodziewana dostawa: 15.03.2026 (500 szt.)" – na podstawie `PurchaseOrder`.
    *   W formularzu zamówienia: wybór daty realizacji.
    *   Podpowiedzi przy ilości: ile dostępne "teraz" oraz ile "na wybraną datę".

### FAZA 5: Panel Zarządzania (Dashboard)
*Cel: Widok operacyjny.*

1.  **Widok "Moje Zamówienia"**:
    *   Tabela z historią zamówień, statusami i podglądem PDF.
2.  **Zarządzanie Klientami**:
    *   Formularz dodawania/edycji klienta (`Customer`).

---

## 5. Wytyczne Implementacyjne dla Agenta

1.  **SQL First**:
    *   Nie ściągaj całej bazy do Node.js, żeby ją filtrować. Rób to w zapytaniu SQL (`.eq()`, `.ilike()`, `.rpc()`).
    *   Używaj funkcji bazodanowych do logiki transakcyjnej (np. finalizacja zamówienia).

2.  **Bezpieczeństwo**:
    *   Nigdy nie zwracaj `User.password` w API.
    *   Zawsze sprawdzaj, czy `salesRepId` w zamówieniu zgadza się z zalogowanym użytkownikiem (chyba że to ADMIN).
    *   Zawsze używaj `SUPABASE_SERVICE_ROLE_KEY` tylko po stronie backendu. Frontend komunikuje się tylko z Twoim API (Express), nie bezpośrednio z Supabase (chyba że do Auth).

3.  **Frontend UX**:
    *   Zachowaj szybkość obecnego "prostego" interfejsu.
    *   Dodawaj funkcje (logowanie, wybór klienta) jako warstwy, nie psując podstawowego wyszukiwania.

4.  **Migracja z SOURCE 2**:
    *   Patrz do `SOURCE 2/.../lib/types.ts` po definicje statusów i typów.
    *   Patrz do `SOURCE 2/.../lib/cart.ts` po algorytmy grupowania produktów.

---

## 5. Wytyczne dla Przyszłych Agentów AI

1.  **Zawsze zaczynaj od tego pliku (`AI_DEV_PLAN.md`)** – traktuj go jako główne źródło prawdy o tym, co już zostało zaplanowane.
2.  **Przy planowaniu nowych zadań:**
    *   Sprawdź, w której *Fazie* (1–4) mieści się nowa funkcjonalność.
    *   Upewnij się, że wcześniejsze fazy nie pozostają w sprzeczności z nowymi decyzjami.
3.  **Przy implementacji funkcji:**
    *   Zajrzyj do `supabase/schema.sql`, aby zrozumieć istniejące tabele i relacje.

---
**Aktualny Priorytet:** Faza 1 w trakcie przygotowania.
**Aktualny Priorytet:** FAZA 1 (Backend Produktów).
