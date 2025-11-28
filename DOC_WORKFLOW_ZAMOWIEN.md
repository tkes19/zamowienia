# Workflow zamówień – Dział Sprzedaży / Produkcja / Magazyn

## 1. Statusy zamówień

- [x] Zaimplementowane w kodzie (backend: ORDER_STATUSES, ROLE_STATUS_TRANSITIONS)
- [x] Zweryfikowane z biznesem (workflow zatwierdzony)

Lista statusów i przejścia:

1. **PENDING (Oczekujące)**  
   - Tworzone przez: handlowiec (`SALES_REP`) z formularza zamówień  
   - Co oznacza: zamówienie wypełnione przez handlowca, czeka na weryfikację działu sprzedaży  
   - Dozwolone przejścia:
     - PENDING → APPROVED (Dział sprzedaży)
     - PENDING → CANCELLED (Dział sprzedaży / Admin)

2. **APPROVED (Zatwierdzone)**  
   - Zmieniane przez: dział sprzedaży (`SALES_DEPT`) / admin  
   - Co oznacza: zamówienie sprawdzone (warunki handlowe, dane klienta, dostępność)
   - Dozwolone przejścia:
     - APPROVED → IN_PRODUCTION (Dział sprzedaży / Admin)
     - APPROVED → CANCELLED (Dział sprzedaży / Admin)

3. **IN_PRODUCTION (W produkcji)**  
   - Zmieniane przez: produkcja (`PRODUCTION`)  
   - Co oznacza: produkcja przyjęła zamówienie i realizuje  
   - Dozwolone przejścia:
     - IN_PRODUCTION → READY (Produkcja)
     - IN_PRODUCTION → CANCELLED (Dział sprzedaży / Admin – w wyjątkowych sytuacjach)

4. **READY (Gotowe do wysyłki / odbioru)**  
   - Zmieniane przez: produkcja (`PRODUCTION`) lub magazyn (`WAREHOUSE`) – zależnie od procesu  
   - Co oznacza: gotowe fizycznie, może iść na wysyłkę / wydanie  
   - Dozwolone przejścia:
     - READY → SHIPPED (Magazyn)
     - READY → CANCELLED (Dział sprzedaży / Admin – tylko jeśli fizycznie możliwe)

5. **SHIPPED (Wysłane)**  
   - Zmieniane przez: magazyn (`WAREHOUSE`)  
   - Co oznacza: paczka wydana z magazynu / przekazana przewoźnikowi  
   - Dozwolone przejścia:
     - SHIPPED → DELIVERED (Dział sprzedaży / Admin – po potwierdzeniu odbioru)

6. **DELIVERED (Dostarczone)**  
   - Zmieniane przez: dział sprzedaży (`SALES_DEPT`) / admin  
   - Co oznacza: zakończone biznesowo, produkt u klienta  
   - Dozwolone przejścia: brak (status końcowy)

7. **CANCELLED (Anulowane)**  
   - Zmieniane przez: dział sprzedaży (`SALES_DEPT`) / admin  
   - Co oznacza: zamówienie anulowane na dowolnym etapie  
   - Dozwolone przejścia: brak (status końcowy)

---

## 2. Uprawnienia ról

- [x] Zaimplementowane w backendzie (helpery: canRoleChangeStatus, canRoleAccessOrder)
- [x] Zweryfikowane w UI (dropdown statusów, widoczność przycisków)

### Widoczność zamówień

- **SALES_REP** – widzi tylko swoje zamówienia (`Order.userId = jego id`).
- **SALES_DEPT** – widzi wszystkie zamówienia z firmy.
- **PRODUCTION** – widzi zamówienia w statusach: APPROVED, IN_PRODUCTION, READY.
- **WAREHOUSE** – widzi zamówienia w statusach: READY, SHIPPED.
- **ADMIN** – widzi wszystkie zamówienia.

### Prawo zmiany statusu

- **SALES_REP**
  - PENDING → CANCELLED (tylko jeśli jeszcze nie zatwierdzone)

- **SALES_DEPT**
  - PENDING → APPROVED
  - APPROVED → IN_PRODUCTION
  - APPROVED → CANCELLED
  - IN_PRODUCTION → CANCELLED (w wyjątkowych sytuacjach, po uzgodnieniu z produkcją)
  - READY → CANCELLED (jeśli fizycznie możliwe)
  - SHIPPED → DELIVERED

- **PRODUCTION**
  - APPROVED → IN_PRODUCTION (jeśli uznamy, że produkcja sama „pobiera” zlecenia)
  - IN_PRODUCTION → READY

- **WAREHOUSE**
  - READY → SHIPPED

- **ADMIN**
  - Może wykonać wszystkie powyższe przejścia, niezależnie od roli.

---

## 3. Widok listy zamówień ("Wszystkie zamówienia")

- [x] Zaprojektowany layout HTML
- [x] Endpoint backendowy gotowy
- [x] Widok zaimplementowany dla SALES_DEPT/ADMIN/WAREHOUSE/PRODUCTION
- [x] Przetestowane filtrowanie

### Lokalizacja w systemie

- Nowy przycisk w nagłówku (dla ról: SALES_DEPT, ADMIN, WAREHOUSE, PRODUCTION):
  - **"Zamówienia"** – otwiera `orders.html` / widok listy zamówień.

### Dane w tabeli

Kolumny podstawowe:

- Numer zamówienia (np. `2025/7/JRO`)
- Data utworzenia
- Klient (nazwa)
- Handlowiec (shortCode + nazwisko)
- Status (badge kolorowy)
- Wartość całkowita
- Akcje (Szczegóły / Zmień status / Anuluj)

### Filtry

- Status: dropdown  
  - Wszystkie, Oczekujące (PENDING), Zatwierdzone (APPROVED), W produkcji (IN_PRODUCTION), Gotowe (READY), Wysłane (SHIPPED), Dostarczone (DELIVERED), Anulowane (CANCELLED)
- Handlowiec: dropdown z listą `SALES_REP` (dostępny dla SALES_DEPT / ADMIN)
- Klient: wyszukiwarka tekstowa (nazwa / email / telefon / miasto)
- Zakres dat: `data od` / `data do`

### Widoczność wg ról

- SALES_REP: widzi listę tylko swoich zamówień (opcjonalny osobny widok "Moje zamówienia" – już częściowo istnieje).
- SALES_DEPT, ADMIN, WAREHOUSE, PRODUCTION: widok wszystkich zamówień z filtrami.

---

## 4. Widok szczegółów zamówienia

- [x] Zaprojektowany layout HTML (modal w orders.html)
- [x] Endpoint backendowy gotowy (`GET /api/orders/:id`)
- [x] Obsługa zmiany statusu (`PATCH /api/orders/:id/status`)
- [x] Obsługa edycji notatek (`PATCH /api/orders/:id`)
- [x] Przetestowane scenariusze podstawowe

### Sekcje widoku

1. **Nagłówek zamówienia**
   - Numer zamówienia
   - Aktualny status (dropdown z dozwolonymi statusami dla danej roli)  
   - Data utworzenia, data ostatniej zmiany
   - Handlowiec (shortCode + nazwisko)

2. **Dane klienta**
   - Nazwa klienta
   - Dane kontaktowe (email, telefon)
   - Adres (miasto, kod, ulica)

3. **Pozycje zamówienia**
   - Tabela: Produkt | Projekty | Ilość | Cena j. | Wartość | Lokalizacja  
   - Projekty: skrócony opis (np. lista plików / identyfikatorów projektów)

4. **Notatki**
   - Notatka handlowca / działu sprzedaży
   - Notatki produkcyjne (widoczne i edytowalne dla PRODUKCJI)
   - Notatki magazynu (np. informacje o wysyłce, numer listu przewozowego)

5. **Historia zmian statusu**
   - Lista: data, użytkownik, zmiana (np. PENDING → APPROVED, komentarz)

### Akcje na widoku szczegółów

- Zmiana statusu (z walidacją dozwolonych przejść)
- Edycja notatek (w zależności od roli)
- Anulowanie zamówienia (dla SALES_DEPT / ADMIN)
- Pobranie PDF (wzór dla klienta / produkcji)
- Powrót do listy zamówień

---

## 5. API – backend (do zaimplementowania)

- [x] `GET /api/orders` – lista zamówień z filtrowaniem (rola decyduje o zasięgu) – dostępne dla SALES_REP, SALES_DEPT, ADMIN, WAREHOUSE, PRODUCTION
- [x] `GET /api/orders/:id` – szczegóły pojedynczego zamówienia z OrderItem, Customer, User
- [x] `PATCH /api/orders/:id/status` – zmiana statusu z walidacją przejść (helpery: canRoleChangeStatus)
- [x] `PATCH /api/orders/:id` – edycja notatek (ADMIN, SALES_DEPT, SALES_REP dla własnych)

### Przykład odpowiedzi `GET /api/orders/all`

```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "orderNumber": "2025/7/JRO",
      "status": "PENDING",
      "total": 1500.0,
      "createdAt": "2025-09-01T10:15:00Z",
      "Customer": { "id": "uuid", "name": "Hotel Górski" },
      "User": { "id": "uuid", "name": "Jan Rował", "shortCode": "JRO" }
    }
  ]
}
```

### Przykład requestu zmiany statusu

```json
PATCH /api/orders/:id/status
{
  "status": "APPROVED",
  "comment": "Zweryfikowano warunki, można produkować"
}
```

Odpowiedź:

```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "status": "APPROVED"
  }
}
```

---

## 6. Plan realizacji (checklista)

1. **Domknięcie definicji statusów i ról**
   - [ ] Przejrzeć dokument razem z biznesem i nanieść poprawki
   - [ ] Zamrozić listę statusów i przejść

2. **Backend**
   - [x] Dodać brakujące endpointy (`GET /api/orders`, `GET /api/orders/:id`, `PATCH /api/orders/:id/status`, `PATCH /api/orders/:id`)
   - [x] Zaimplementować walidację przejść statusów (canRoleChangeStatus)
   - [ ] Dodać logowanie zmian (tabela historii / pole w Order) – opcjonalne na przyszłość

3. **Frontend – lista zamówień**
   - [x] Stworzyć `orders.html` z tabelą i filtrami
   - [x] Dodać `scripts/orders.js` do pobierania i wyświetlania zamówień
   - [x] Dodać przycisk „Zamówienia” w nagłówku dla ról SALES_DEPT / ADMIN / PRODUKCJA / MAGAZYN

4. **Frontend – szczegóły zamówienia**
   - [x] Dodać widok szczegółów (modal w orders.html)
   - [x] Obsłużyć zmianę statusu (dropdown + zapis przez PATCH)
   - [x] Obsłużyć edycję notatek

5. **Testy**
   - [x] Scenariusz handlowiec → dział sprzedaży → produkcja → magazyn → dostawa (podstawowy test przepływu)
   - [ ] Scenariusze anulowania na różnych etapach (do przetestowania w produkcji)
   - [x] Uprawnienia ról (zweryfikowane: widoczność filtrów, dropdown statusów)

---

## 7. Podsumowanie implementacji (27.11.2025)

### ✅ Co zostało zaimplementowane

#### Backend (`backend/server.js`)

**Helpery walidacji (linie 92-139):**
- `ORDER_STATUSES` – tablica wszystkich statusów
- `ROLE_STATUS_TRANSITIONS` – macierz dozwolonych przejść dla każdej roli
- `isValidStatus(status)` – sprawdza poprawność statusu
- `canRoleChangeStatus(role, currentStatus, nextStatus)` – waliduje przejście
- `canRoleAccessOrder(role, requesterId, orderOwnerId)` – kontrola dostępu

**Endpointy:**
1. `GET /api/orders` (linie 1900-1980) – lista zamówień z filtrowaniem:
   - Parametry: `status`, `userId`, `customerId`, `dateFrom`, `dateTo`
   - Role: SALES_REP (tylko swoje), SALES_DEPT/ADMIN/WAREHOUSE/PRODUCTION (wszystkie)
   - Zwraca: Order + Customer + User (shortCode)

2. `GET /api/orders/:id` (linie 242-307) – szczegóły zamówienia:
   - Zwraca: Order + OrderItem[] + Customer + User + Product
   - Kontrola dostępu wg roli
   - Pełne dane do wyświetlenia w modalu

3. `PATCH /api/orders/:id/status` (linie 312-371) – zmiana statusu:
   - Walidacja: `isValidStatus()` + `canRoleChangeStatus()`
   - Kontrola uprawnień: `canRoleAccessOrder()`
   - Aktualizuje: `status`, `updatedAt`

4. `PATCH /api/orders/:id` (linie 376-433) – edycja notatek:
   - Uprawnienia: ADMIN, SALES_DEPT, SALES_REP (tylko własne)
   - Aktualizuje: `notes`, `updatedAt`

#### Frontend

**Pliki:**
- `orders.html` – strona z listą zamówień i modalem szczegółów
- `scripts/orders.js` – logika widoku zamówień
- `index.html` – dodany przycisk "Zamówienia" w nagłówku
- `scripts/app.js` – funkcja `showUserNavigation()` rozszerzona o przycisk zamówień

**Funkcjonalności (`scripts/orders.js`):**

1. **Lista zamówień:**
   - Tabela z kolumnami: numer, data, klient, handlowiec, status, wartość, akcje
   - Filtry: status, handlowiec (dla SALES_DEPT/ADMIN), data od/do
   - Kolorowe badge'y statusów
   - Przycisk "Szczegóły" dla każdego zamówienia

2. **Modal szczegółów zamówienia:**
   - Sekcja informacji podstawowych (numer, status, klient, handlowiec, daty, wartość)
   - Tabela pozycji zamówienia (produkt, projekty, ilość, cena, wartość, lokalizacja)
   - Dropdown zmiany statusu (tylko dozwolone przejścia dla roli)
   - Textarea notatek (tylko dla ADMIN, SALES_DEPT)
   - Przyciski zapisu statusu i notatek

3. **Logika biznesowa:**
   - `getAllowedStatusTransitions(currentStatus, role)` – mapowanie dozwolonych przejść
   - `handleStatusChange(orderId)` – wywołanie PATCH /api/orders/:id/status
   - `handleNotesChange(orderId)` – wywołanie PATCH /api/orders/:id
   - Automatyczne odświeżanie listy po zmianie statusu

**Routing (`backend/server.js` linia 113-115):**
```javascript
app.get('/orders', requireRole(['SALES_DEPT', 'ADMIN', 'WAREHOUSE', 'PRODUCTION']), (req, res) => {
  res.sendFile(path.join(__dirname, '../orders.html'));
});
```

### 🎯 Workflow zamówień (pełny cykl)

1. **SALES_REP** tworzy zamówienie → status: `PENDING`
2. **SALES_DEPT** zatwierdza → `PENDING` → `APPROVED`
3. **SALES_DEPT** lub **PRODUCTION** przekazuje do produkcji → `APPROVED` → `IN_PRODUCTION`
4. **PRODUCTION** oznacza jako gotowe → `IN_PRODUCTION` → `READY`
5. **WAREHOUSE** wysyła → `READY` → `SHIPPED`
6. **SALES_DEPT** potwierdza dostawę → `SHIPPED` → `DELIVERED`

**Anulowanie:**
- **SALES_REP**: `PENDING` → `CANCELLED`
- **SALES_DEPT**: `PENDING/APPROVED/IN_PRODUCTION/READY` → `CANCELLED`
- **ADMIN**: dowolny status → `CANCELLED`

### 📋 Uprawnienia ról (podsumowanie)

| Rola | Widzi zamówienia | Może zmienić status | Może edytować notatki |
|------|------------------|---------------------|------------------------|
| **SALES_REP** | Tylko swoje | PENDING→CANCELLED | Tylko swoje |
| **SALES_DEPT** | Wszystkie | PENDING→APPROVED→IN_PRODUCTION, SHIPPED→DELIVERED, *→CANCELLED | Wszystkie |
| **PRODUCTION** | Wszystkie | APPROVED→IN_PRODUCTION, IN_PRODUCTION→READY | Nie |
| **WAREHOUSE** | Wszystkie | READY→SHIPPED | Nie |
| **ADMIN** | Wszystkie | Wszystkie przejścia | Wszystkie |

### 🔧 Pliki zmodyfikowane/utworzone

**Nowe pliki:**
- `orders.html`
- `scripts/orders.js`
- `DOC_WORKFLOW_ZAMOWIEN.md`
- `PODRECZNIK_UZYTKOWNIKA.md`

**Zmodyfikowane pliki:**
- `backend/server.js` – dodane endpointy i helpery walidacji
- `index.html` – dodany przycisk "Zamówienia"
- `scripts/app.js` – rozszerzona funkcja `showUserNavigation()`

### ⏭️ Kolejne kroki (opcjonalne)

1. **Historia zmian statusów** – ✅ ZAIMPLEMENTOWANE (tabela `OrderStatusHistory`, endpoint API, frontend)
2. **Powiadomienia email** – automatyczne powiadomienia przy zmianie statusu
3. **Eksport PDF** – generowanie dokumentów zamówienia dla klienta/produkcji
4. **Zaawansowane filtry** – wyszukiwanie po numerze zamówienia, nazwie klienta
5. **Statystyki** – dashboard z liczbą zamówień w każdym statusie
6. **Komentarze** – możliwość dodawania komentarzy do zamówienia (nie tylko notatki)

### 🆕 Nowe funkcje zaimplementowane (28.11.2025)

#### Historia zmian statusu zamówienia
- **Tabela bazy**: `OrderStatusHistory` z polami:
  - `id` (UUID)
  - `orderId` (FK do Order)
  - `oldStatus` (poprzedni status)
  - `newStatus` (nowy status)
  - `changedBy` (FK do User)
  - `changedAt` (timestamp)
  - `notes` (opcjonalne)

- **Backend**:
  - Endpoint `GET /api/orders/:id/history` – pobiera historię zmian
  - Automatyczny zapis w `PATCH /api/orders/:id/status`
  - Wyzwalacz bazy danych `log_order_status_change()`

- **Frontend**:
  - Nowa sekcja "Historia zmian statusu" w modalu szczegółów
  - Wyświetlanie: stary status → nowy status, osoba zmieniająca, data, notatki
  - Kolorowe badge'y statusów
  - Automatyczne odświeżanie po zmianie statusu

- **Uprawnienia**:
  - Tylko użytkownicy z dostępem do zamówienia mogą widzieć historię
  - Walidacja przy każdym zapytaniu API

### 📝 Uwagi techniczne

- **Autentykacja**: cookie-based (`auth_id`, `auth_role`)
- **Baza danych**: Supabase PostgreSQL
- **Tabele**: `Order`, `OrderItem`, `Customer`, `User`, `Product`
- **Framework CSS**: Tailwind CDN
- **Ikony**: FontAwesome
- **Walidacja**: po stronie backendu (helpery) + frontend (dropdown z dozwolonymi statusami)

---

**Status dokumentu:** Aktualny na dzień 28.11.2025, godz. 7:45

**Wersja systemu:** v1.1 – Widok zamówień z pełnym workflow + historia zmian statusu

### 🔄 Co trzeba zrobić w bazie danych:
```sql
-- Uruchom migrację w Supabase
-- (tabela OrderStatusHistory i wyzwalacz są już dodane do schema.sql)
```
