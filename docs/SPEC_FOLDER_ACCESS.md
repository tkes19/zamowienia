# Specyfikacja: Moduł przypisywania folderów KI

## 1. Cel modułu

Umożliwienie administratorom i działowi sprzedaży przypisywania folderów klientów indywidualnych (KI) do handlowców oraz klientów zewnętrznych. Handlowiec po zalogowaniu widzi tylko przypisane mu foldery w trybie KI.

---

## 2. Decyzje architektoniczne

### 2.1 Model danych
Wykorzystujemy istniejącą tabelę `UserFolderAccess` w Supabase:

```sql
CREATE TABLE public."UserFolderAccess" (
  id serial PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "folderName" varchar(255) NOT NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "assignedBy" text REFERENCES "User"(id) ON DELETE SET NULL,
  notes text,
  "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("userId", "folderName")
);
```

### 2.2 Uprawnienia

| Rola | Odczyt przypisań | Tworzenie/Edycja | Usuwanie | Podgląd wszystkich |
|------|------------------|------------------|----------|-------------------|
| ADMIN | ✅ | ✅ | ✅ | ✅ |
| SALES_DEPT | ✅ | ✅ | ✅ | ✅ |
| SALES_REP | ✅ (tylko swoje) | ❌ | ❌ | ❌ |
| CLIENT | ✅ (tylko swoje) | ❌ | ❌ | ❌ |

> **Uwaga:** Rola `CLIENT` to nowa rola dla klientów zewnętrznych logujących się do systemu.
> Nie mylić z tabelą `Customer` (klienci biznesowi w zamówieniach, nie logują się).

### 2.3 Źródło listy folderów
- Foldery pobierane dynamicznie z PHP/QNAP przez `/api/gallery/salespeople`
- W panelu admina: autouzupełnianie z listy + możliwość ręcznego wpisu (dla folderów planowanych)
- Walidacja: ostrzeżenie jeśli folder nie istnieje, ale zapis dozwolony

---

## 3. API Backend (Express)

### 3.1 Endpointy

#### `GET /api/admin/user-folder-access`
- **Role:** ADMIN, SALES_DEPT
- **Query params:** `userId` (opcjonalny filtr)
- **Response:** Lista wszystkich przypisań z danymi użytkownika

#### `GET /api/user-folder-access`
- **Role:** wszystkie zalogowane
- **Response:** Lista aktywnych folderów bieżącego użytkownika
- **Dla ADMIN/SALES_DEPT:** opcjonalny param `userId` do podglądu cudzych

#### `POST /api/admin/user-folder-access`
- **Role:** ADMIN, SALES_DEPT
- **Body:** `{ userId, folderName, notes? }`
- **Walidacja:** sprawdzenie duplikatu, istnienia użytkownika

#### `PATCH /api/admin/user-folder-access/:id`
- **Role:** ADMIN, SALES_DEPT
- **Body:** `{ folderName?, isActive?, notes? }`
- **Ograniczenie:** SALES_DEPT może tylko zmieniać `isActive` i `notes`

#### `DELETE /api/admin/user-folder-access/:id`
- **Role:** ADMIN, SALES_DEPT
- **Uwaga:** Operacja nieodwracalna, zapisywana w audycie

---

## 4. Audyt zmian (UserFolderAccessLog)

Każda operacja na przypisaniach jest logowana w tabeli `UserFolderAccessLog`:

```sql
CREATE TABLE public."UserFolderAccessLog" (
  id serial PRIMARY KEY,
  "userFolderAccessId" integer NULL,
  "targetUserId" text NOT NULL,      -- użytkownik, którego dotyczy zmiana
  "actorId" text NOT NULL,           -- kto wykonał akcję (ADMIN/SALES_DEPT)
  action text NOT NULL,              -- 'CREATE' | 'UPDATE' | 'DELETE' | 'DEACTIVATE' | 'REACTIVATE'
  "folderName" text NULL,
  "oldValue" jsonb NULL,             -- stan przed zmianą
  "newValue" jsonb NULL,             -- stan po zmianie
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Przykładowe wpisy audytu:

| Akcja | Opis | oldValue | newValue |
|-------|------|----------|----------|
| CREATE | Nowe przypisanie | `null` | `{isActive: true, folderName: "KI_SKLEP", notes: "..."}` |
| DEACTIVATE | Dezaktywacja | `{isActive: true, ...}` | `{isActive: false, ...}` |
| REACTIVATE | Reaktywacja | `{isActive: false, ...}` | `{isActive: true, ...}` |
| UPDATE | Zmiana notatki | `{notes: "stara"}` | `{notes: "nowa"}` |
| DELETE | Usunięcie | `{folderName: "KI_X", ...}` | `null` |

---

## 5. UI Panel Admina

### 4.1 Lokalizacja
Nowy widok w `admin/index.html`: **„Foldery KI"** (data-view="folder-access")

### 4.2 Elementy interfejsu

#### Nagłówek
- Tytuł: „Przypisania folderów KI"
- Przyciski: „Dodaj przypisanie", „Odśwież"

#### Filtry
- Wyszukiwarka (po nazwie użytkownika/folderu)
- Select: filtr po użytkowniku
- Select: filtr statusu (Aktywne / Nieaktywne / Wszystkie)

#### Tabela przypisań
| Kolumna | Opis |
|---------|------|
| Użytkownik | Imię + email, badge z rolą |
| Folder | Nazwa folderu KI |
| Status | Badge: Aktywny (zielony) / Nieaktywny (szary) |
| Przypisał | Kto utworzył przypisanie |
| Data | Data utworzenia |
| Notatki | Skrócony tekst z tooltip |
| Akcje | Aktywuj/Dezaktywuj, Edytuj, Usuń (tylko ADMIN) |

#### Modal dodawania/edycji
- Select użytkownika (z listy handlowców + klientów)
- Input folderu z autouzupełnianiem (dane z `/api/gallery/salespeople`)
- Textarea notatek
- Checkbox „Aktywny" (tylko przy edycji)

### 4.3 Statystyki (karty nad tabelą)
- Aktywne przypisania
- Użytkowników z dostępem
- Unikalnych folderów

---

## 5. Integracja z trybem KI

### 5.1 Filtrowanie folderów
Endpoint `/api/gallery/salespeople` zostanie zmodyfikowany:
- Dla ADMIN/SALES_DEPT: zwraca wszystkie foldery z QNAP
- Dla SALES_REP/CLIENT: zwraca tylko foldery z `UserFolderAccess` gdzie `isActive=true`

### 5.2 Autoryzacja dostępu do obiektów
Endpoint `/api/gallery/objects/:salesperson` sprawdza:
- Czy użytkownik ma przypisanie do tego folderu, LUB
- Czy użytkownik ma rolę ADMIN/SALES_DEPT

---

## 6. Obsługa klientów zewnętrznych

### 6.1 Scenariusz
1. Admin tworzy konto użytkownika z rolą `NEW_USER` lub `CLIENT` (do ustalenia)
2. Admin przypisuje folder(y) KI do tego konta
3. Klient loguje się i widzi tylko swoje foldery
4. Klient składa zamówienia jak handlowiec (jest „swoim własnym handlowcem")

### 6.2 Przyszłe rozszerzenia
- Link gościnny z tokenem (bez pełnego logowania)
- Automatyczne tworzenie konta przy pierwszym wejściu z linku

---

## 7. Plan implementacji

### Faza 1: Backend API
1. [ ] Endpoint `GET /api/admin/user-folder-access`
2. [ ] Endpoint `GET /api/user-folder-access`
3. [ ] Endpoint `POST /api/admin/user-folder-access`
4. [ ] Endpoint `PATCH /api/admin/user-folder-access/:id`
5. [ ] Endpoint `DELETE /api/admin/user-folder-access/:id`

### Faza 2: Panel Admina UI
6. [ ] Dodanie pozycji menu „Foldery KI" w sidebar
7. [ ] Widok listy przypisań z tabelą
8. [ ] Modal dodawania/edycji przypisania
9. [ ] Autouzupełnianie folderów z QNAP
10. [ ] Statystyki i filtry

### Faza 3: Integracja KI
11. [x] Modyfikacja `/api/gallery/salespeople` – filtrowanie po przypisaniach
12. [x] Modyfikacja `/api/gallery/objects/:salesperson` – autoryzacja
13. [x] Aktualizacja frontendu KI (`scripts/app.js`)

---

## 8. Decyzje podjęte

| Pytanie | Decyzja |
|---------|---------|
| Rola klienta zewnętrznego | ✅ Nowa rola `CLIENT` (dodana do enum `UserRole`) |
| Usuwanie przez SALES_DEPT | ✅ Może trwale usuwać (z audytem) |
| Historia zmian | ✅ Tabela `UserFolderAccessLog` z pełnym audytem |

### Różnica: `CLIENT` (User) vs `Customer`

| Aspekt | `User` z rolą `CLIENT` | `Customer` |
|--------|------------------------|------------|
| Loguje się? | ✅ Tak | ❌ Nie |
| Tabela | `User` | `Customer` |
| Cel | Klient zewnętrzny z dostępem do KI | Klient biznesowy w zamówieniach |
| Foldery KI | Ma przypisania w `UserFolderAccess` | Nie dotyczy |
| Zamówienia | Może składać własne (przyszłość) | Jest wybierany przez handlowca |

---

*Dokument utworzony: 2025-11-28*
*Ostatnia aktualizacja: 2025-11-28*
*Autor: Cascade (architekt)*
