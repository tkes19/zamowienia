# 🧠 AI Agent Master Plan: System Zamówień "Rezon" Next-Gen

Ten dokument stanowi **kompleksową instrukcję rozwoju** systemu zamówień. Łączy on strukturę bazy danych Supabase z logiką biznesową poprzedniej wersji aplikacji ("SOURCE 2"), adaptując ją do nowego, lżejszego stacku technologicznego.

---

## 1. Wizja i Cel
Celem jest odtworzenie zaawansowanej funkcjonalności systemu B2B (ERP/CRM) istniejącego wcześniej w Next.js/Prisma, przy użyciu obecnego stacku: **Node.js (Express) + Vanilla JS + Supabase**.

**Kluczowe założenie:** Rezygnacja z ORM (Prisma) na rzecz czystego klienta Supabase (`@supabase/supabase-js`) oraz przeniesienie ciężaru logiki do bazy danych (PostgreSQL).

### Postęp prac – 28.11.2025

1. **Synchronizacja roli użytkownika**
   - Dodano endpoint `POST /api/auth/sync-role`, który odczytuje rolę zalogowanego użytkownika z Supabase i aktualizuje ciasteczka (`auth_id`, `auth_role`).
   - Frontend (`admin/admin.js`) wywołuje synchronizację przed wczytaniem zamówień, dzięki czemu przyciski (usuń/edytuj) renderują się poprawnie tylko dla ADMIN.

2. **Panel Admina – edycja zamówień**
   - W miejsce przekierowania na `/orders/:id/edit` dodano modal edycji zamówienia otwierany z tabeli.
   - Modal umożliwia zmianę statusu, notatek, a także pełną edycję pozycji (`identifier`, `index`, `selectedProjects`, `quantity`, `unitPrice`).
   - Po zmianie ilości i ceny jednostkowej suma pozycji przelicza się natychmiast, a `PATCH /api/orders/:id` wysyła tylko zmodyfikowane rekordy.

3. **Usprawnienia UI i stabilność**
   - Dodano nową ikonografię przycisków (edytuj, drukuj, usuń) w tabeli zamówień.
   - Naprawiono konflikt nazw zmiennej `index` w kodzie frontendu, który blokował ładowanie widoku zamówień.
   - Do dokumentacji dodano debug logi pomagaące w diagnozie braku roli w ciasteczkach.

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

## 4.1. Role Użytkowników i Zakres Uprawnień

Poniższa tabela opisuje, kto co może robić w systemie – szczególnie pod kątem **klientów** i **zamówień**.

| Rola          | Opis / Typ użytkownika                                      | Klienci                                      | Zamówienia                                      | Magazyn / Produkcja                   |
| ------------- | ------------------------------------------------------------ | -------------------------------------------- | ----------------------------------------------- | ------------------------------------- |
| `ADMIN`       | Administrator techniczny / osoba odpowiedzialna za system   | Pełny CRUD na wszystkich klientach           | Pełny dostęp (tworzenie, edycja, zmiana statusu) | Pełny dostęp                          |
| `SALES_REP`   | Handlowiec terenowy                                         | CRUD tylko na **swoich** klientach           | Tworzy/edytuje **swoje** zamówienia              | Podgląd (opcjonalnie)                |
| `SALES_DEPT`  | Dział handlowy / sprzedaż biurowa                           | Widzi wszystkich, może przypisywać klientów  | Może tworzyć/edytować zamówienia dla dowolnego klienta | Podgląd (np. dostępność produktów) |
| `WAREHOUSE`   | Magazyn                                                     | Brak lub tylko podgląd podstawowych danych   | Podgląd zamówień, zmiana statusu „wydano / wysłano” | Pełny dostęp do stanów magazynowych  |
| `PRODUCTION`  | Dział produkcji                                             | Brak / tylko dane do nadruku                 | Podgląd zamówień, zmiana statusu produkcyjnego   | Podgląd stanów, obciążenie linii     |
| `GRAPHICS`    | Grafik / studio DTP                                         | Brak / tylko dane kontaktowe                 | Podgląd zamówień i projektów                     | Brak                                 |
| `MANAGEMENT`  | Właściciel / szefostwo (np. szef, żona, brat szefa)         | **Tylko podgląd** wszystkich klientów        | **Tylko podgląd** wszystkich zamówień i historii | Podgląd raportów i stanów magazynowych |
| `NEW_USER`    | Konto wstępne, przed nadaniem właściwej roli                | Brak                                          | Brak                                             | Brak                                 |

Notatka: rola `MANAGEMENT` jest zaprojektowana jako **read-only** – bez możliwości przypadkowej edycji danych. Właściciel może podejrzeć wszystko, ale nie „psuje” operacyjnych konfiguracji (`ADMIN`).

---

## 4. Roadmapa Rozwoju (Krok po Kroku)

### FAZA 1: Fundament Danych (Backend)
*Cel: Odcięcie zewnętrznego API i pełna kontrola nad danymi.*

1.  **Migracja Endpointu Produktów (`GET /api/v1/products`)** – **STATUS: w dużej mierze UKOŃCZONE**:
    *   ✅ Backend czyta dane z tabel `Product` + `Inventory` w Supabase (bezpośrednio, bez zewnętrznego API).
    *   ✅ Dane są mapowane do struktury zgodnej z obecnym frontendem (`data.products[...]`).
    *   🔄 Zewnętrzne API `https://rezon-api.vercel.app/api/v1/products` jest używane **tylko** w endpointzie admina `POST /api/admin/sync-from-external-api` do okresowej synchronizacji produktów do bazy.
    *   ⏳ Do dopracowania później: pełne wyszukiwanie `ILIKE` po wszystkich wymaganych kolumnach (jeśli frontend tego potrzebuje ponad aktualny zakres).

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
2.  **Wybór Klienta & Przypisanie do Handlowca**:
    *   **Stan obecny:**
        - ✅ Endpoint `GET /api/clients` z filtrowaniem po roli (handlowiec widzi tylko swoich klientów).
        - ✅ Endpoint `GET /api/clients` wzbogacony o `salesRepName` dla `ADMIN` i `SALES_DEPT`.
        - ✅ Panel "Moi klienci" (`/clients`) – pełny CRUD z poziomu handlowca/administracji.
        - ✅ Kolumna "Przypisany do" w tabeli klientów (widoczna dla `ADMIN` i `SALES_DEPT`).
        - ✅ Pole "Przypisz do handlowca" w modalu edycji klienta (dostępne dla `ADMIN` i `SALES_DEPT`).
        - ✅ Dropdown w formularzu zamówień: pasek "Klient zamówienia" z polem "Szukaj" i listą klientów.
        - ✅ Filtrowanie po dowolnym fragmencie tekstu (nazwa, miasto, email, telefon) + auto-wybór przy jednym wyniku.
        - ✅ Wyświetlanie nazwy handlowca w dropdownie klientów formularza zamówień (format: `Klient (handlowiec: Imię Nazwisko)`).
    *   **Logika ról:**
        - `SALES_REP` – widzi tylko swoich klientów, nie może zmieniać przypisania.
        - `SALES_DEPT` – widzi wszystkich klientów, może przypisywać klientów do siebie lub do handlowców, może tworzyć zamówienia dla dowolnego klienta.
        - `ADMIN` – pełny dostęp do wszystkich klientów i przypisań.
    *   **Do zrobienia w tej fazie:**
        - [ ] Podpiąć `currentCustomer.id` do modelu draftu/zamówienia.
        - [ ] Upewnić się, że przy finalizacji koszyka `customerId` jest wymagany i walidowany po stronie backendu.
3.  **Logika "Projektów" (Specyfika Branży)**:
    *   Obsługa pól `selectedProjects` (zakresy np. "1-5, 10") w `order_draft_items`.
    *   Walidacja poprawności zakresów po stronie serwera.

4.  **Szablony zamówień (rozszerzenie Draftów)**:
    *   **Cel:** przyspieszenie pracy handlowców dzięki zapisywaniu gotowych koszyków jako wzorców.
    *   **Model danych:**
        - Nowe tabele `order_templates` i `order_template_items` (strukturą zbliżone do `order_drafts`),
        - Pola kluczowe: `name`, `description`, `visibility` (`PRIVATE` / `TEAM`), `tags[]`, `lastUsedAt`, `usageCount`.
        - Powiązanie z użytkownikiem (`ownerId`) + opcjonalnie `sharedWithRole`/`departmentId` dla szablonów zespołowych.
    *   **API (REST):**
        1. `GET /api/order-templates` – lista szablonów widocznych dla użytkownika (własne + udostępnione),
        2. `POST /api/order-templates` – zapis bieżącego koszyka jako szablonu (payload jak draft + metadane),
        3. `PATCH /api/order-templates/:id` – zmiana nazwy/opisu/tags/visibility,
        4. `POST /api/order-templates/:id/duplicate` – tworzy nowy szablon na bazie istniejącego,
        5. `POST /api/order-templates/:id/use` – wczytuje szablon do koszyka (tworzy nowy draft i zwraca payload dla frontu),
        6. `DELETE /api/order-templates/:id` – usuwa szablon (tylko właściciel lub admin).
    *   **UX (formularz zamówień):**
        - Pasek nad koszykiem z przyciskiem „Zapisz jako szablon” (nazwa + checkbox „Udostępnij zespołowi”),
        - Modal/lista szablonów z filtrowaniem po tagach/nazwie + sortowanie (ostatnio użyte, ulubione),
        - Ładowanie szablonu tworzy zwykły draft, który użytkownik może dowolnie edytować przed wysyłką,
        - Możliwość oznaczenia szablonu jako „Ulubiony” i przypięcia go na górze listy.
    *   **Funkcje inspirowane CRM/ERP:**
        - **Tagi/kategorie** – szybkie filtrowanie scenariuszy („Sezon letni”, „Placówki oświatowe”),
        - **Widoczność prywatna/wspólna** – handlowiec decyduje czy szablon jest tylko dla niego czy dla całego działu,
        - **Duplikacja i wersjonowanie** – łatwe tworzenie wariantów + log zmian (`updatedBy`, `updatedAt`),
        - **Ulubione/przypięte** – lokalne preferencje użytkownika (np. tabela `order_template_favorites`),
        - **Statystyki użycia** – automatyczna aktualizacja `usageCount`, `lastUsedAt` podczas `POST /use`,
        - **Komentarze/notatki** – sekcja instrukcji dla zespołu (np. „Używać tylko dla klientów A/B”).
    *   **Migracja:** dodać skrypt SQL tworzący nowe tabele + widoki pomocnicze (np. `vw_user_templates`), przygotować seedy dla przykładowych szablonów.

#### 3.4. Struktura SQL modułu szablonów

```sql
CREATE TABLE public.order_templates (
    id               text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    owner_id         text NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    name             varchar(255) NOT NULL,
    description      text NULL,
    visibility       varchar(20) NOT NULL DEFAULT 'PRIVATE',  -- PRIVATE | TEAM
    shared_with_role varchar(50) NULL,
    department_id    text NULL REFERENCES "Department"(id) ON DELETE SET NULL,
    tags             text[] NULL,
    usage_count      integer NOT NULL DEFAULT 0,
    last_used_at     timestamptz NULL,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT order_templates_visibility_check CHECK (visibility IN ('PRIVATE','TEAM'))
);

CREATE TABLE public.order_template_items (
    id                 text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    template_id        text NOT NULL REFERENCES order_templates(id) ON DELETE CASCADE,
    product_id         text NOT NULL REFERENCES "Product"(id),
    quantity           numeric(10,2) NOT NULL CHECK (quantity > 0),
    unit_price         numeric(10,2) NOT NULL CHECK (unit_price >= 0),
    selected_projects  text NULL,
    project_quantities jsonb NULL,
    total_quantity     numeric(10,2) NOT NULL DEFAULT 0 CHECK (total_quantity >= 0),
    source             varchar(50) NOT NULL DEFAULT 'MIEJSCOWOSCI',
    location_name      varchar(255) NULL,
    project_name       varchar(255) NULL,
    customization      text NULL,
    production_notes   text NULL,
    sort_order         integer NOT NULL DEFAULT 0,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.order_template_favorites (
    template_id text NOT NULL REFERENCES order_templates(id) ON DELETE CASCADE,
    user_id     text NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (template_id, user_id)
);
```

> Indeksy: `order_templates(owner_id)`, `order_templates(visibility)`, GIN na `tags`,
> oraz `order_template_items(template_id, product_id)`.

> Triggery: `update_order_templates_updated_at`, `update_order_template_items_updated_at`
> wykorzystują istniejącą funkcję `update_updated_at_column()`.

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
*Cel: Widok operacyjny + raporty dla szefostwa (`MANAGEMENT`).*

1.  **Widok "Moje Zamówienia"** (dla handlowca):
    *   Tabela z historią zamówień, statusami i podglądem PDF.
2.  **Zarządzanie Klientami**:
    *   Formularz dodawania/edycji klienta (`Customer`).
3.  **Panel MANAGEMENT – Raporty i Podsumowania** (rola `MANAGEMENT`):
    *   **Podsumowania sprzedaży:**
        - widok sprzedaży dziennej/tygodniowej/miesięcznej,
        - sprzedaż wg handlowca (obrót, liczba zamówień, średnia wartość),
        - TOP klienci i produkty.
    *   **Planowanie zakupów towaru:**
        - lista produktów z ryzykiem braku (na podstawie `stock`, `stockReserved`, `stockOrdered`, `reorderPoint`),
        - proste wyliczenie sugerowanej ilości do domówienia (do poziomu `stockOptimal`).
    *   **Kontrola zespołu handlowego:**
        - liczba zamówień i nowych klientów na handlowca w wybranym okresie,
        - wykrywanie długo wiszących draftów zamówień (potencjalnie utracone szanse).
    *   **Widok read-only:**
        - rola `MANAGEMENT` ma tylko podgląd – bez możliwości edycji danych (bezpieczne dla szefostwa).

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

## 5.1. Mapowanie pól Zamówienia – Stary System vs Nowy Formularz

Ta sekcja służy jako "słownik" między starym API (Next.js/Prisma) a nowym arkuszem zamówień.

### 5.1.1. Poziom `Order`

| Stary system (Order)          | Opis                                           | Status w nowym formularzu |
| ----------------------------- | ---------------------------------------------- | -------------------------- |
| `id`                          | ID zamówienia w bazie                         | 🔜 powstanie po `INSERT`   |
| `orderNumber`                 | Numer zamówienia (`YYYY/NNN/III`)             | 🔜 do wygenerowania w backendzie przy zapisie |
| `customerId`                  | ID klienta (`Customer.id`)                    | ✅ mamy `currentCustomer.id` w formularzu (pasek „Klient zamówienia”) |
| `userId`                      | ID użytkownika składającego zamówienie        | ✅ mamy z `/api/auth/me` (backend podpinie automatycznie) |
| `status`                      | Status zamówienia (`PENDING`, `SHIPPED` itd.) | 🔜 w MVP: stała wartość startowa, np. `PENDING` |
| `deliveryDate` / `productionDate` | Data realizacji/produkcji                  | 🔜 planowane (sekcja dot. dostępności w czasie) |
| `createdAt`, `updatedAt`      | Daty audytowe                                 | 🔜 generowane po stronie bazy/backendu |
| `notes`                       | Uwagi do całego zamówienia                    | 🔜 opcjonalne pole w formularzu (można dodać później) |

**Wniosek dla MVP:**
- Do `POST /api/orders` z frontu musimy minimum przekazać: `customerId` + listę pozycji (`items[]`).
- `userId`, `orderNumber`, `status`, daty – powstaną po stronie backendu/bazy.

### 5.1.2. Poziom `OrderItem`

| Stary system (OrderItem)      | Opis                                            | Status w nowym formularzu |
| ----------------------------- | ----------------------------------------------- | -------------------------- |
| `productId`                   | ID produktu (`Product.id`)                     | ✅ mamy ID produktu (lista wyników + koszyk) |
| `quantity`                    | Ilość                                           | ✅ ilość wiersza koszyka   |
| `unitPrice` / `price`         | Cena jednostkowa                               | ✅ liczona / przechowywana po stronie frontu (ukrywana/pokazywana) |
| `totalPrice`                  | Cena łączna pozycji                            | ✅ można obliczyć po stronie backendu lub frontu |
| `projects` / `selectedProjects` | Zakres projektów (np. „1–5, 10”)             | ✅ mamy mechanikę wyboru projektów w arkuszu; 🔜 trzeba spiąć z formatem backendu |
| `mode`                        | Typ trybu (PM / KI / inne)                     | ✅ mamy tryby formularza (`projekty-miejscowosci`, `klienci-indywidualni`) – backend może je dostać jako pole pomocnicze |
| `notes`                       | Uwagi do pozycji                               | 🔜 na razie brak osobnego pola (opcjonalnie w przyszłości) |

**Wniosek dla MVP:**
- Każdy element `items[]` wysyłany do `POST /api/orders` powinien zawierać co najmniej:
  - `productId`,
  - `quantity`,
  - ewentualnie `unitPrice` (lub backend sam ją odczyta z tabeli `Product`),
  - `selectedProjects` (jeśli dotyczy danego trybu).

### 5.1.3. Logika Rozpisywania Ilości na Projekty

**Handlowiec ma 3 sposoby wpisania ilości – system automatycznie rozpoznaje i przelicza:**

#### Tryb 1: Łączna ilość (pole A wypełnione, pole B puste)
- Handlowiec: projekty `1,2,3`, łącznie `200`
- System: `200 / 3 = 66 r. 2` → Proj. 1: 67, Proj. 2: 67, Proj. 3: 66

#### Tryb 2: Po X na projekt (pole A puste, pole B = `po 20` lub `20`)
- Handlowiec: projekty `1-5`, ilości `po 30`
- System: `30 × 5 = 150` → każdy projekt dostaje 30

#### Tryb 3: Indywidualne (pole A puste, pole B = `20,30,40`)
- Handlowiec: projekty `4,5,6`, ilości `20,30,40`
- System: suma `20+30+40 = 90` → Proj. 4: 20, Proj. 5: 30, Proj. 6: 40

#### UX pól ilości w formularzu (finalne zachowanie)

W tabeli "Wybrane produkty" dla każdej pozycji są **dwa powiązane pola**:

- `Łącznie szt.` (A) – liczba całkowita.
- `Ilości na proj.` (B) – tekst: `po 20` **lub** lista `20,30,40`.

Zasady działania:

1. **Pola działają dwukierunkowo, ale aktywne jest zawsze to, w którym użytkownik ostatnio pisał**:
   - gdy użytkownik zaczyna wpisywać w A → B jest czyszczone;
   - gdy zaczyna pisać w B → A jest czyszczone.

2. **Po zakończeniu edycji (blur / TAB / klik poza pole)** system automatycznie uzupełnia drugie pole:
   - jeśli wypełnione jest A (łączna ilość) i są projekty `1,2,3`:
     - system liczy listę wg algorytmu z Trybu 1 (dzielenie z resztą)
     - np. 15 → `5,5,5`, 16 → `6,5,5`, 200 (4 projekty) → `50,50,50,50`;
     - wpisuje tę listę do B (`Ilości na proj.`) i pokazuje podgląd.
   - jeśli wypełnione jest B:
     - przypadek `po 20` → system liczy `20 × liczba_projektów` i wpisuje wynik do A;
     - przypadek `20,30,40` → system liczy sumę, sprawdza długość listy == liczba projektów, wpisuje sumę do A.

3. **Podgląd rozkładu**:
   - poniżej pól wyświetlany jest kompaktowy, kolorowy podgląd:
     - zielony ✓ przy poprawnych danych (np. `✓ łącznie: 62 | Proj. 1: 22 | Proj. 2: 20 | Proj. 3: 20`),
     - czerwony ❌ przy błędach (np. zła liczba elementów listy).

4. **Enter/TAB**:
   - TAB / kliknięcie poza pole → wywołuje `blur` i przeliczenie drugiego pola + podglądu;
   - Enter **nie ma specjalnej logiki** (został wyłączony, żeby nie powodować side‑effectów typu przebudowa wiersza) – w przyszłości można go dodać ponownie jako osobne, dobrze przetestowane zadanie.

#### Oba pola wypełnione
- System liczy z pola B, sprawdza czy suma = pole A
- Jeśli nie → żółte ostrzeżenie, nie można wysłać

#### Struktura w `OrderItem`
```json
{
  "productId": "...",
  "selectedProjects": "1-5",
  "quantityMode": "perProject",
  "quantityInputTotal": "200",
  "quantityInputPerProject": "",
  "totalQuantity": 200,
  "perProjectQuantities": [
    { "projectNo": 1, "qty": 67 },
    { "projectNo": 2, "qty": 67 },
    { "projectNo": 3, "qty": 67 },
    { "projectNo": 4, "qty": 0 },
    { "projectNo": 5, "qty": -1 }
  ]
}
```

---

### 5.1.4. Scenariusz logowania i widoczności formularza (wariant B + `/login`)

Ta sekcja opisuje, jak działa **logowanie**, co widzi **użytkownik niezalogowany**, a co widzą **różne role** po zalogowaniu.

#### 1. Strona startowa i adresy URL

- Główna strona formularza: `/zamowienia`.
- Osobny adres `/login`:
  - używany jako fallback (link w mailach, stronach pomocy),
  - renderuje ten sam formularz logowania co panel w nagłówku, ale na osobnej stronie.
- Start aplikacji (wewnętrznie i z zewnątrz) powinien kierować na `/zamowienia`.

#### 2. Wariant B – logowanie w pasku (header)

- Na górze każdej strony (`/zamowienia`, `/zamowienia/historia`, `/admin` itd.) jest **wspólny nagłówek** z trzema obszarami:
  - **Lewa strona:** logo + nazwa systemu.
  - **Środek:** zakładki nawigacji (np. „Projekty miejscowości”, „Klienci indywidualni”, „Projekty imienne”, „Hasła”, „Zamówienia”).
  - **Prawa strona:** panel logowania / status użytkownika.
- Dwa stany prawego panelu:
  - **Niezalogowany:**
    - przycisk lub link `Zaloguj się`,
    - po kliknięciu rozwija się kompaktowy formularz (login/hasło) albo otwiera modal.
  - **Zalogowany:**
    - chip z informacją: `Imię Nazwisko (Rola)`,
    - opcjonalnie dodatkowa etykieta (np. `Oddział: Południe`),
    - przycisk `Wyloguj`.
- Po wylogowaniu użytkownik zostaje na `/zamowienia`, ale wraca do trybu **tylko podgląd**.

#### 3. Widoczność sekcji – matrix ról

Definicje skrótów typów klientów: `PM`, `KI`, `PI`, `PH`, `OK` – pozostają takie jak w logice projektów.

**Użytkownik niezalogowany (gość):**

- **WIDZI:**
  - górny pasek nawigacji z przyciskiem `Zaloguj się`,
  - pole wyszukiwania + tryb wyszukiwania (np. po nazwie, identyfikatorze, mieście),
  - listę miejscowości / obiektów / folderów **zgodną z regułami dostępu publicznego**,
  - listę produktów i **podgląd graficzny** produktów (galeria),
  - uproszczoną informację o dostępności (pasek stanów magazynowych – opis poniżej).
- **NIE WIDZI:**
  - selektorów `Handlowiec`, `Obiekt`,
  - koszyka i sekcji „Wybrane produkty”,
  - sekcji podsumowania zamówienia, eksportów (XLSX/PDF), historii zamówień,
  - żadnych danych dotyczących konkretnego klienta (`Customer`),
  - cen, rabatów, wartości zamówienia.

**Rola `SALES_REP` (handlowiec) – po zalogowaniu:**

- Widzi wszystko to, co gość **plus**:
  - panel wyboru `Handlowiec` / `Obiekt` (w praktyce prefiltr na „swoje” obiekty),
  - koszyk i tabelę „Wybrane produkty” z pełną logiką ilości/projektów (sekcja 5.1.3),
  - sekcję „Zamówienie” (podsumowanie, eksporty, zapis zamówienia),
  - listę **swoich** zamówień w zakładce „Zamówienia” / „Moje zamówienia”,
  - dokładniejsze dane stanów magazynowych (np. konkretna liczba sztuk lub tooltip z liczbą).

**Rola `ADMIN` / `SALES_DEPT`:**

- To, co `SALES_REP`, plus:
  - dostęp do dodatkowych zakładek (`Panel admina`, „Zarządzanie klientami”, itp.),
  - możliwość przeglądania zamówień wszystkich użytkowników,
  - konfiguracja dostępów do folderów/miejscowości i widoku publicznego (patrz punkt 4).

**Rola `MANAGEMENT` (szefostwo, read-only):**

- Po zalogowaniu widzi pełne dane (klienci, zamówienia, raporty) w trybie **tylko do odczytu**, zgodnie z tabelą ról.
- Na `/zamowienia` może widzieć te same sekcje, co `SALES_DEPT`, ale bez przycisków zapisu/edycji.

#### 4. Dostęp do folderów/miejscowości

- W panelu admina (`/admin`) istnieje konfiguracja:
  - **dla każdego użytkownika (np. `SALES_REP`)**: lista folderów/miejscowości, do których może składać zamówienia,
  - **dla gości (niezalogowanych)**: lista folderów/miejscowości oznaczonych jako **publiczne**.
- Zasady widoczności:
  - **Gość:** widzi tylko foldery/miejscowości oznaczone jako publiczne.
  - **Zalogowany `SALES_REP`:** widzi tylko te foldery, do których ma prawo (plus opcjonalnie publiczne – decyzja konfiguracyjna po stronie admina).
  - **`ADMIN` / `SALES_DEPT` / `MANAGEMENT`:** mogą widzieć pełen katalog, jeśli tak zdecyduje konfiguracja ról.

#### 5. Prezentacja stanów magazynowych – widok publiczny vs zalogowany

- Backend wylicza stan produktu na podstawie pól magazynowych (`stock`, `stockReserved`, `stockOrdered`, itp.).
- Frontend nie musi znać dokładnych wartości w widoku publicznym – dostaje jedynie **poziom dostępności**.

**Dla użytkownika niezalogowanego (gość):**

- Zamiast konkretnej liczby sztuk wyświetlany jest **pasek dostępności** z 3–4 poziomami, np.:
  - `Niski` – mało sztuk,
  - `Średni`,
  - `Wysoki`,
  - opcjonalnie `Brak`.
- Pasek jest kolorowy (np. czerwony / żółty / zielony) i opisany tekstowo, bez pokazywania dokładnych ilości.
- Dokładne progi (`lowThreshold`, `mediumThreshold`, `highThreshold`) trzymane są w konfiguracji backendu lub w bazie (do doprecyzowania w schemacie).

**Dla zalogowanego `SALES_REP` / `SALES_DEPT` / `ADMIN`:**

- Może być pokazywana:
  - konkretna liczba dostępnych sztuk (`availableNow`), lub
  - ten sam pasek, ale z dodatkowymi informacjami w tooltipie (np. „Dostępne teraz: 124 szt.”).
- Decyzja, czy pokazywać liczby, może być konfigurowalna na poziomie roli.

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
---

## 6. Notatki o stanie frontendu – Mobile UX (v2.1)

### Implementacja responsywnego designu i double-tap zoom

**Status:** ✅ Ukończone (Nov 25, 2025)

**Zmiany CSS (`assets/styles.css`):**
- Breakpointy: `@media (max-width: 720px)` dla tablet/telefon, `@media (max-width: 420px)` dla małych ekranów.
- `.mode-nav`: scroll poziomy (`overflow-x: auto`) na mobile.
- Przyciski i pola: `min-height: 44px` (desktop), `min-height: 48px` (mobile).
- Font-size: 16px na mobile (unika auto-zoomu iOS).
- `.gallery-preview__frame`: `touch-action: auto` (umożliwia scrollowanie), `max-height: 50vh` (tablet), `45vh` (telefon).
- Nowy modal `.gallery-zoom-modal` do powiększenia obrazka.

**Zmiany HTML (`index.html`):**
- Dodano modal HTML: `#gallery-zoom-modal` z przyciskiem zamknięcia i obrazkiem.
- Dodano ID `gallery-preview-frame` do kontenera galerii.

**Zmiany JavaScript (`scripts/app.js`):**
- Nowa funkcja `initGalleryZoom()` obsługująca:
  - Double-tap (mobile) / double-click (desktop) na obrazku.
  - Otwieranie modala z powiększonym obrazkiem.
  - Zamknięcie: przycisk X, kliknięcie na tło, klawisz ESC.
  - Touch event listeners z `{ passive: true }` dla naturalnego scrollowania.
- Wywołanie `initGalleryZoom()` w funkcji `initialize()`.

**Rezultat:**
- ✅ Formularz responsywny na wszystkich rozdzielczościach (360px–1920px+).
- ✅ Przyciski i pola touch-friendly (44–48px).
- ✅ Scrollowanie strony nie blokuje się na obrazku.
- ✅ Double-tap zoom na galerii.
- ✅ Brak horizontal scrollingu na mobile.

---

### 6.2. Klienci – panel i wybór w formularzu (v2.2)

**Status:** ✅ Ukończone (frontend + API klientów + logika przypisania)

**Zaimplementowane elementy:**

**Backend (`/api/clients`):**
- Filtrowanie po roli: `SALES_REP` widzi tylko swoich, `SALES_DEPT`/`ADMIN` widzą wszystkich.
- Wzbogacanie odpowiedzi o `salesRepName` (dla `ADMIN` i `SALES_DEPT`).
- Możliwość edycji `salesRepId` dla `ADMIN` i `SALES_DEPT` (via `PATCH /api/clients/:id`).

**Frontend – Panel `/clients`:**
- Kolumna "Przypisany do" wyświetlająca nazwę handlowca (widoczna dla `ADMIN` i `SALES_DEPT`).
- Modal edycji z polem `select` do przypisania klienta do handlowca (tylko dla `ADMIN` i `SALES_DEPT`).
- Załadowanie listy handlowców z `GET /api/admin/users?role=SALES_REP`.

**Frontend – Formularz zamówień (`index.html` + `scripts/app.js`):**
- Pasek "Klient zamówienia" nad koszykiem.
- Pole "Szukaj" + `select` z listą klientów.
- Filtrowanie po dowolnym fragmencie (nazwa, miasto, email, telefon).
- Auto-wybór klienta przy jednym wyniku.
- **Nowe:** Wyświetlanie nazwy handlowca w opcjach dropdownu (format: `Klient (handlowiec: Imię Nazwisko)`).

**Logika ról:**
- `SALES_REP`: widzi tylko swoich klientów, nie może edytować przypisania.
- `SALES_DEPT`: widzi wszystkich klientów, może przypisywać klientów do siebie lub do handlowców.
- `ADMIN`: pełny dostęp do wszystkich operacji na klientach.

**Do spięcia w kolejnych fazach:**
- Powiązać `currentCustomer` z draftem zamówienia i finalnym `Order.customerId`.
- Wymusić obecność klienta przy `POST /api/orders` (walidacja biznesowa).

---

## 6.3. Panel Admina – Widok Zamówień (v2.3)

**Status:** ✅ Ukończone (Nov 26, 2025)

**Problem:**
- Legacy endpoint `/api/orders` powodował redirect 302 → `/api/orders/my`
- Panel admina nie mógł załadować zamówień z powodu konfliktu z legacy

**Rozwiązanie:**
- Utworzono nowy endpoint `GET /api/admin/orders` (bez konfliktu z legacy)

**Backend (`backend/server.js`):**
- Endpoint: `GET /api/admin/orders`
- Kontrola ról:
  - `SALES_REP` → tylko własne zamówienia (`userId = auth_id`)
  - `ADMIN`, `SALES_DEPT`, `WAREHOUSE` → wszystkie zamówienia
  - inne role → 403 Forbidden
- Filtry query: `status`, `userId`, `customerId`, `dateFrom`, `dateTo`
- Response: `{"status":"success","data":[...]}` z joinami `Customer` i `User`
- Logging: `[GET /api/admin/orders] start` i `returning` dla debugowania

**Frontend (`admin/index.html` + `admin/admin.js`):**
- Zakładka "Zamówienia" w sidebar
- Tabela z kolumnami: numer, data, klient, handlowiec, status, suma, akcje
- Filtry: wyszukiwanie, status dropdown, handlowiec dropdown
- Status badges z kolorami (PENDING=żółty, APPROVED=niebieski, itd.)
- Fetch z `credentials: 'include'` dla cookie-based auth
- Funkcje: `loadOrders()`, `renderOrdersTable()`, `loadOrdersUsers()`

**Rezultat:**
- ✅ Backend endpoint działa (200 OK)
- ✅ Panel admina ładuje zamówienia poprawnie
- ✅ Filtrowanie wg ról zaimplementowane
- ✅ Cookie-based authentication działa
- ⏳ Następny krok: Akcje edycji/anulowania dla zamówień PENDING

---

**Aktualny Priorytet:** FAZA 1 (Backend Produktów) + przygotowanie projektu pod zapis zamówień (FAZA 3/4).

---

## 6.4. Szablony Zamówień (v2.4)

**Status:** ✅ Ukończone (frontend + backend, 28.11.2025)

### Zaimplementowane funkcjonalności
1. **API i model danych**
   - Tabele `order_templates` i `order_template_items` w Supabase.
   - Endpointy: `GET /api/order-templates`, `POST`, `PATCH`, `DELETE`, `POST /:id/duplicate`, `POST /:id/use`.
   - Licznik użyć (`usage_count`, `last_used_at`) aktualizowany w `POST /:id/use`.

2. **Integracja z koszykiem**
   - Zapis bieżącego koszyka jako szablon (nazwa, opis, widoczność, tagi).
   - Wczytywanie szablonu czyści koszyk i wstawia pozycje z poprawnym `identifier` + `index`.
   - Duplikowanie i usuwanie dostępne z listy szablonów.

3. **UX / UI**
   - Kompaktowy layout kart z przyciskami akcji w nagłówku.
   - Wskaźniki widoczności (`PRYWATNY`/`MÓJ`), liczba użyć, tagi.
   - Toasty (`setStatus`) zamiast `alert()`/`confirm()` oraz poprawione komunikaty błędów.

### Backlog modułu szablonów

**Krótkoterminowe**
- [ ] Wyszukiwanie po nazwie/opisie oraz filtrowanie po tagach i widoczności.
- [ ] Sortowanie (ostatnio użyte, alfabetycznie, ulubione na górze).
- [ ] Podgląd zawartości szablonu (tooltip lub mini-lista) przed wczytaniem.

**Średnioterminowe**
- [ ] Udostępnianie szablonów między użytkownikami/działami (widoczność `TEAM`).
- [ ] Eksport/import szablonów i auto-tagowanie na podstawie zawartości.
- [ ] Historia zmian (wersjonowanie metadanych, `updatedBy`).

**Długoterminowe**
- [ ] Szablony grupowe (zestawy kilku szablonów dla sezonów/kampanii).
- [ ] Automatyczne rekomendacje szablonów na podstawie historii klienta.
- [ ] Integracja z draftami zamówień i możliwością schedulowania wysyłki.

**Uwagi techniczne:** wszystkie endpointy korzystają z istniejącego RBAC; przyciski w UI są responsywne, a `setStatus` używa targetu `cart`, aby nie blokować pracy w formularzu.
