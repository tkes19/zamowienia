# System zamówień "Rezon"

Aplikacja B2B do obsługi sprzedaży pamiątek i gadżetów.

## Dokumentacja

| Plik | Opis |
|------|------|
| `docs/SPEC.md` | Specyfikacja techniczna |
| `docs/USER_MANUAL.md` | Podręcznik użytkownika |
| `docs/roadmap.md` | Plan rozwoju |
| `docs/SPEC_FOLDER_ACCESS.md` | Moduł folderów KI |

---

### Moduł mapowania produktów (galeria)

- **Opis techniczny** – sekcje `5.5` i `6.6` w `docs/SPEC.md`.
- **Instrukcja dla admina** – sekcja `8.4. Mapowanie produktów (galeria)` w `docs/USER_MANUAL.md`.

### 📊 Moduł Zarządzania Produkcją (Nowość!)

System został rozszerzony o kompleksowy moduł zarządzania produkcją, który zapewnia:

### ✨ Kluczowe funkcje:
- **Dashboard szefa** - widok ryzyk, KPI i akcji do podjęcia w czasie rzeczywistym
- **Monitorowanie maszyn** - śledzenie stanów (ok/ostrzeżenie/awaria/konserwacja) z historią zmian
- **Zarządzanie materiałami** - stany magazynowe z automatycznym wykrywaniem braków i alertami
- **Przenoszenie operatorów** - inteligentne sugestie transferu na podstawie umiejętności i zatorów
- **Analiza zatorów** - identyfikacja wąskich gardeł i rekomendacje optymalizacji

### 🔗 Nowe endpointy API:
```
/api/production/machines/status          - stany maszyn
/api/production/machines/:id/status       - aktualizacja statusu
/api/production/materials/stock          - stany magazynowe
/api/production/materials/shortages      - braki materiałowe
/api/production/operators/skills         - umiejętności operatorów
/api/production/operators/assignments    - przypisania operatorów
/api/production/operators/transfer       - przenoszenie operatorów
/api/production/operators/suggestions    - sugestie transferu
/api/production/dashboard/executive      - dashboard szefa
/api/production/risks                    - szczegóły ryzyk
/api/production/bottlenecks              - analiza zatorów
```

### 📡 Zdarzenia SSE (real-time):
- `machine_status_changed` - zmiana statusu maszyny
- `material_shortage` - wykrycie braku materiału
- `operator_transferred` - przeniesienie operatora
- `risk_level_changed` - zmiana poziomu ryzyka zamówienia

### 🗄️ Nowe tabele bazy danych:
- `MachineStatus` - historia stanów maszyn
- `OperatorSkill` - umiejętności operatorów
- `OperatorAssignment` - przypisania operatorów
- `MaterialStock` - stany magazynowe materiałów
- `ProductMaterial` - powiązania produktów z materiałami
- `MaterialStockLog` - historia zmian stanów

### 🧪 Testy:
Kompletny zestaw testów jednostkowych w `backend/tests/production.test.js` pokrywający:
- Walidację umiejętności przy transferach
- Wykrywanie braków materiałowych
- Obsługę awarii maszyn
- Kalkulację ryzyk na dashboardzie
- Identyfikację zatorów produkcyjnych

### 📋 Role i uprawnienia:
- **ADMIN** - pełny dostęp
- **PRODUCTION_MANAGER** - zarządzanie operatorami, przegląd ryzyk
- **OPERATOR** - zgłaszanie statusów maszyn
- **WAREHOUSE** - zarządzanie stanami magazynowymi

- **Model danych i API** – `docs/SPEC_PRODUCTION_PANEL.md` (rozdziały 2–3).
- **Stan wdrożenia – opis szczegółowy** – podrozdział `2.3.1 Stan wdrożenia (2025-12-06)` w `docs/SPEC_PRODUCTION_PANEL.md`.

**Co jest zrobione (backend + baza):**
- migracje Supabase utworzyły główne tabele: `ProductionRoom`, `WorkCenter`, `WorkStation`, `ProductionPath`, `ProductionOrder`, `ProductionOperation`, logi wydruków itp.;
- zmiana statusu zamówienia na `APPROVED` automatycznie tworzy zlecenia produkcyjne (`ProductionWorkOrder`, `ProductionOrder`, `ProductionOperation`) na podstawie zdefiniowanej ścieżki produkcyjnej (`ProductionPath`);
- zmiana statusu zamówienia na `CANCELLED` automatycznie anuluje powiązane zlecenia produkcyjne;
- endpointy do zarządzania strukturą produkcji (sale, centra robocze, stanowiska, ścieżki produkcyjne) są dostępne w `backend/server.js`;
- endpoint `/api/production/orders/active` zwraca aktywne zlecenia produkcyjne zgrupowane w ramach zleceń roboczych (work orders) na potrzeby panelu operatora;
- endpoint `/api/production/work-orders/:id/print` generuje PDF zlecenia produkcyjnego (work order) za pomocą `backend/pdfGenerator.js`;
- frontendowy panel produkcji (`production.html` + `scripts/production.js`) istnieje: pokazuje listę zleceń, filtry, widoki kompaktowe/szczegółowe, podgląd produktów (modal ze zdjęciem z galerii).

**Zaimplementowane (MVP panel operatora) – 2025-12-09:**
- ✅ backendowe endpointy akcji operatora: `/api/production/operations/:id/{start|pause|complete|cancel|problem}`;
- ✅ każda akcja operatora logowana do tabeli `ProductionLog` (czas, użytkownik, poprzedni/nowy status);
- ✅ trwałe śledzenie czasu operacji po stronie serwera (pola `starttime`, `endtime`, `actualtime` w minutach);
- ✅ automatyczne przejścia statusów `ProductionWorkOrder` na podstawie statusów operacji (`updateWorkOrderStatusFromOperations`);
- ✅ endpoint statystyk operatora `/api/production/operator/stats` z filtrowaniem po pokoju produkcyjnym;
- ✅ uprawnienia dla ról `PRODUCTION`, `OPERATOR`, `PRODUCTION_MANAGER`, `ADMIN`;
- ✅ testy jednostkowe logiki statusów (`backend/production.test.js`).

**Zaimplementowane (Dashboard KPI) – 2025-12-10:**
- ✅ endpoint dashboardu KPI: `/api/production/kpi/overview` (agregacje: operacje, ilości, braki, problemy);
- ✅ statystyki per pokój produkcyjny (`byRoom`) i top 5 produktów (`topProducts`);
- ✅ filtrowanie po zakresie dat (`dateFrom`, `dateTo`) i pokoju (`roomId`);
- ✅ dashboard KPI w UI (`production.html`) – kafle, tabele pokojów i produktów;
- ✅ testy jednostkowe modułu KPI (`backend/kpi.test.js`).

**Zaimplementowane (Słownik typów gniazd) – 2025-12-11:**
- ✅ tabela `WorkCenterType` jako słownik typów gniazd produkcyjnych (laser_co2, uv_print, cnc, assembly...);
- ✅ API CRUD: `GET/POST/PATCH /api/production/work-center-types`;
- ✅ formularz gniazda w panelu admina ładuje typy dynamicznie z API;
- ✅ widok "Typy gniazd" w panelu admina (tabela + modal dodawania/edycji);
- ✅ testy jednostkowe walidacji i kontroli dostępu (`backend/work-center-type.test.js`).

**Zaimplementowane (druk zleceń produkcyjnych – ZP) – 2025-12-11:**
- ✅ endpoint `/api/production/work-orders/:id/print` generuje pojedynczy PDF karty zlecenia produkcyjnego (ZP) dla danego pokoju;
- ✅ nowy endpoint `/api/orders/:id/production-work-orders/print` generuje **jeden, wielostronicowy PDF** ze wszystkimi ZP powiązanymi z zamówieniem (jedna strona = jedno ZP);
- ✅ przycisk **„Zlecenia produkcyjne (PDF)”** w szczegółach zamówienia korzysta z nowego endpointu i otwiera jeden plik zamiast wielu wyskakujących okienek (brak problemu z blokadą popupów);
- ✅ na każdej stronie PDF drukowane są: uwagi do pozycji zamówienia (w tabeli pozycji) oraz wspólna uwaga do całego zamówienia (sekcja „Uwagi do zlecenia”).

**Zaimplementowane (Real-time SSE) – 2025-12-24:**
- ✅ moduł emisji zdarzeń produkcyjnych (`backend/modules/sse/productionEvents.js`) z typami zdarzeń dla operacji, work orders i KPI;
- ✅ emisja zdarzeń SSE w endpointach akcji operatora (`/api/production/operations/:id/{start|pause|complete}`);
- ✅ automatyczna aktualizacja statusu work order po zakończeniu operacji z emisją zdarzenia SSE;
- ✅ emisja zdarzeń KPI po obliczeniu statystyk (`/api/production/kpi/overview`);
- ✅ subskrypcja SSE w panelu operatora (`scripts/production.js`) z obsługą zdarzeń produkcyjnych;
- ✅ inteligentna aktualizacja UI bez pełnego fetchu – optymistyczne update'y lokalnego stanu;
- ✅ automatyczny fallback do pollingu przy rozłączeniu SSE (reconnect po 3s);
- ✅ testy jednostkowe modułu emisji zdarzeń (`backend/modules/sse/productionEvents.test.js`).

**Co jest jeszcze do zrobienia (po MVP):**
- dodać przyciski ponownego druku dla operatora (print work order z poziomu panelu);
- rozważyć migrację z SSE na pełny WebSocket jeśli zajdzie potrzeba interakcji dwukierunkowej.

---

## 1. Wymagania

- Node.js 16+ (wraz z `npm`).
- Jeśli chcesz pobierać aktualizacje repozytorium – Git (opcjonalnie).
- Do kompilacji styli Tailwind wymagane jest jednorazowe `npm install` w katalogu głównym (instaluje tylko dev-dependency `tailwindcss`).

## 2. Struktura projektu

```
ZAMÓWIENIA/
├─ index.html, assets/, scripts/    → frontend (statyczne pliki)
└─ backend/                         → Express + proxy do API produktów i galerii
```

Frontend zawsze rozmawia z backendem poprzez backend Node:

- `/api/v1/products` – proxy do bazy produktów (Rezon API),
- `/api/gallery/*` – proxy do galerii na QNAP (miejscowości, handlowcy, obiekty, produkty i obrazki).

> **Uwaga:** folder `SOURCE 2/` w katalogu projektu służy tylko jako **źródło referencyjne** (pliki do podglądu). Nie jest częścią aplikacji i jest ignorowany przez Git (`.gitignore`).

## 3. Szybki start (lokalnie)

```powershell
cd "C:\Users\Tomek\OneDrive\000 CURSOR\ZAMÓWIENIA\backend"
npm install            # tylko pierwszy raz
npm run dev            # tryb deweloperski z nodemonem
# lub: npm start       # zwykłe uruchomienie
```

### 3.1. Kompilacja Tailwind CSS

Frontend korzysta z lokalnie generowanego pliku `assets/tailwind.generated.css`.

```powershell
cd "C:\Users\Tomek\OneDrive\000 CURSOR\ZAMÓWIENIA"
npm install               # tylko pierwszy raz (instaluje Tailwind CLI)
npm run tailwind:build    # jednorazowa kompilacja (minifikacja)
# lub: npm run tailwind:watch  # tryb nasłuchiwania podczas pracy nad UI
```

Źródło styli: `assets/tailwind.css` (używa dyrektyw `@tailwind`).  
Kompilacja generuje `assets/tailwind.generated.css`, na który wskazują wszystkie pliki `.html`.

## Tak uruchamiałem w domu 

```powershell
cd backend
node server.js

node server.js lub npm run dev
```

### Gdy port 3001 jest zajęty (reset serwera)

Jeśli przy `node server.js` pojawia się błąd `EADDRINUSE: address already in use :::3001`, zatrzymaj wiszący proces Node w PowerShellu:

```powershell
Get-Process node                  # sprawdź, czy działa node
Get-Process node | Stop-Process -Force   # zabij wszystkie procesy node
```

Potem ponownie uruchom backend:

```powershell
cd backend
node server.js   # lub: npm run dev
```

Następnie otwórz w przeglądarce `http://localhost:3001/`. Ten adres serwuje `index.html` i obsługuje wszystkie zapytania produktu (`/api/v1/products`) oraz galerii (`/api/gallery/...`). Nie korzystaj z Live Servera – uruchomienie strony spod innego originu skończy się błędem CORS.

## 4. Konfiguracja backendu

Plik `backend/server.js`:
- serwuje statyczne pliki z katalogu głównego,
- wystawia `/api/v1/products` jako proxy do `https://rezon-api.vercel.app/api/v1/products`,
- wystawia `/api/gallery/*` jako proxy do serwera QNAP według adresu `GALLERY_BASE`,
- dodaje nagłówki CORS (`Access-Control-Allow-Origin: *`).

### Zmienne środowiskowe

Minimalny plik `backend/.env` (bez maila):

```env
PORT=3001
NODE_ENV=development
GALLERY_BASE=http://rezon.myqnapcloud.com:81/home
```

Jeśli wysyłasz PDF e‑mailem, dodaj też:

```env
SMTP_HOST=...
SMTP_PORT=...
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
EMAIL_FROM=...
EMAIL_TO=...
```

Jeżeli e-mail nie jest potrzebny, wystarczą `PORT`, `NODE_ENV` i `GALLERY_BASE`.

## 5. Skrypty npm (backend)

| Komenda        | Działanie                                   |
| -------------- | ------------------------------------------- |
| `npm run dev`  | `nodemon server.js` – auto-restart po zmianach |
| `npm start`    | `node server.js` – zwykłe uruchomienie       |

## 6. Testowanie API

Przykład zapytania do produktów w PowerShellu:

```powershell
Invoke-RestMethod -Uri 'http://localhost:3001/api/v1/products?search=chrom'
```

Przykład w curl:

```bash
curl "http://localhost:3001/api/v1/products?search=chrom"
```

Przykładowe zapytania do galerii:

```bash
curl "http://localhost:3001/api/gallery/cities"              # lista miejscowości
curl "http://localhost:3001/api/gallery/salespeople"         # lista handlowców
curl "http://localhost:3001/api/gallery/products/Babimost"   # produkty dla miasta
```

## 7. Frontend – responsywny design i mobile UX

Od wersji 2.1 formularz jest w pełni responsywny na urządzeniach mobilnych:

### Breakpointy CSS
- **Desktop** (1024px+): pełny layout z multi-kolumnowymi formularzami
- **Tablet** (720px–1023px): jednokolumnowy layout, powiększone przyciski (48px)
- **Telefon** (< 720px): zoptymalizowany dla palca, scroll poziomy dla paska trybów

### Cechy mobile-friendly
- **Przyciski i pola**: min-height 44–48px dla łatwości kliknięcia
- **Font-size**: 16px na mobile (unika auto-zoomu na iOS)
- **Galeria**: responsywne obrazki z max-height 50vh (tablet) / 45vh (telefon)
- **Tabele**: zmniejszony padding, czcionka 0.9rem na małych ekranach
- **Pasek trybów**: scroll poziomy (`overflow-x: auto`) na mobile

### Double-tap zoom na obrazku galerii
- **Desktop**: double-click na obrazku otwiera modal z powiększeniem
- **Mobile**: double-tap (dwa szybkie kliknięcia) na obrazku
- **Zamknięcie**: kliknij przycisk X, tło modala, lub naciśnij ESC
- **Scrollowanie**: `touch-action: auto` umożliwia normalne scrollowanie strony nawet z obrazkiem

## 8. Najczęstsze problemy

| Problem | Rozwiązanie |
| --- | --- |
| **Failed to fetch / CORS** | Upewnij się, że strona jest otwarta z `http://localhost:3001/`, a nie z Live Servera. |
| **Brak wyników** | Sprawdź logi serwera (`npm run dev`) – czy proxy otrzymało dane z `rezon-api`. |
| **SMTP błędy** | Zweryfikuj dane w `.env` oraz dostępność serwera pocztowego. |
| **Na mobile nie mogę scrollować strony** | Upewnij się, że `touch-action: auto` jest ustawiony w `.gallery-preview__frame`. |
| **Double-tap zoom nie działa** | Sprawdź, czy `initGalleryZoom()` jest wywoływana w `initialize()` w `scripts/app.js`. |

## 9. Deploy (skrót)

1. Wybierz hosting Node.js (Railway, Render, Fly.io, VPS itp.).
2. Zdeployuj katalog `backend/` – Express będzie serwować statyczne pliki i API jednocześnie.
3. Ustaw zmienne środowiskowe (`PORT`, `SMTP_*`).
4. Skieruj domenę na ten sam serwer – frontend i backend muszą być pod jednym originem.

To wszystko – dokument ma być możliwie zwięzły. Jeśli potrzeba dodatkowych szczegółów (np. o galerii czy PDF), dopisuj je w dedykowanych sekcjach, ale zawsze z myślą o krótkiej, praktycznej instrukcji.

---

## 10. Git – pierwsza konfiguracja repozytorium (opcjonalnie)

1. **Zainstaluj Git** z https://git-scm.com/download/win i w kreatorze pozostaw opcję dodania go do `PATH`.
2. **Skonfiguruj globalną tożsamość (tylko raz):**
   ```powershell
   git config --global user.name "Twoje Imie"
   git config --global user.email "twoj.email@example.com"
   ```
3. **Przejdź do katalogu projektu:**
   ```powershell
   cd "C:\Users\Tomek\OneDrive\000 CURSOR\ZAMÓWIENIA"
   ```
4. **Zainicjuj repozytorium i podłącz GitHub (wykonane, ale w razie ponownej konfiguracji):**
   ```powershell
   git init
   git branch -M main
   git remote add origin https://github.com/tkes19/zamowienia.git
   ```

## 11. Git – typowy cykl pracy (kopiuj i wklej)

1. Sprawdź status plików:
   ```powershell
   git status
   ```
2. Dodaj wszystkie zmiany (albo konkretny plik):
   ```powershell
   git add .
   ```
3. Utwórz commit z opisem:
   ```powershell
   git commit -m "Krótki opis zmian"
   ```
4. Wyślij zmiany na GitHub:
   ```powershell
   git push -u origin main
   ```
   - Przy pierwszym `push` zaloguj się w przeglądarce.
   - Kolejne `push` już bez dodatkowych kroków.
5. Jeśli pracujesz na innym komputerze – pobierz aktualny kod przed zmianami:
   ```powershell
   git pull origin main
   ```

**Przykład pełnej sekwencji (zmiana tylko README):**
```powershell
git status
git add README.md
git commit -m "Uzupełnij instrukcję"
git push
```
Oczekiwane wyjście przy braku zmian:
```
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

> **Wskazówka:** `git status` i `git diff` pokażą, co dokładnie zostało zmodyfikowane przed commitem.


Praktyka codzienna
w pracy 
cd "C:\Users\Tomek\OneDrive\000 CURSOR\ZAMÓWIENIA"
git add .
git commit -m "Opis zmian"
git push
cd backend

w domu
cd "C:\Users\kocie\OneDrive\000 CURSOR\ZAMÓWIENIA"
git status
git add backend/server.js scripts/app.js README.md
git commit -m "fix: proxy obrazków galerii dla HTTPS"
git push
cd backend









## 12. Git – cofanie zmian, gdy coś się zepsuje

1. Zobacz historię commitów:
   ```powershell
   git log --oneline
   ```
   Skopiuj hash commit, do którego chcesz wrócić (np. `a1b2c3d`).
2. Tymczasowy powrót do starej wersji (testy):
   ```powershell
   git checkout <hash>
   ```
   Po testach wróć do bieżącej gałęzi:
   ```powershell
   git checkout main
   ```
3. Przywrócenie konkretnego pliku z poprzedniego commitu:
   ```powershell
   git restore --source <hash> ścieżka/do/pliku
   ```
   Następnie wykonaj `git add`, `git commit`, `git push`.
4. Cofnięcie ostatniego commitu bez kasowania historii:
   ```powershell
   git revert HEAD
   git push origin main
   ```

> **Tip:** Przed eksperymentami warto użyć oddzielnej gałęzi – `git checkout -b nazwa-testowa` – i po weryfikacji scalić ją z `main` (`git merge`).

## 13. Hosting aplikacji (skrót)

Jeśli potrzebujesz pełnych instrukcji wdrożenia (Railway, Netlify, Fly.io), skorzystaj z pliku `HOSTING_GUIDE.md`. Poniżej szybkie podsumowanie:

- **Railway** – prosty backend Node.js z auto-deployem po `git push`.
- **Netlify** – hosting statycznego frontendu (wymaga backendu pod innym adresem).
- **Fly.io** – frontend i backend w jednym miejscu, brak usypiania w darmowym tierze.

W każdej opcji pamiętaj o ustawieniu zmiennych środowiskowych (`PORT`, `SMTP_*`) i aktualizacji adresu API we frontendzie.

---

## 14. Ostatnie zmiany (2025‑12)

- **Źródło prawdy dla ilości (`quantitySource`)**
  - Każda pozycja zamówienia zapisuje, skąd pochodzi ilość:
    - `total` – użytkownik wprowadził **łączną ilość** (pole "Ilość"),
    - `perProject` – użytkownik wprowadził **ilości na projekty** (pole "Ilości na proj.").
  - W koszyku i w widoku zamówień graficznie wyróżniamy pole, które jest źródłem:
    - niebieska ramka + tło dla źródła w koszyku,
    - pogrubienie + podkreślenie kolumny w szczegółach zamówienia i na wydruku.

- **Logika pól "Ilość" vs "Ilości na proj."**
  - System rozpoznaje 3 tryby:
    - tylko suma (`mode = total`) – rozkład wyliczany automatycznie,
    - "po X" (`mode = perProject`) – np. `po 20`,
    - lista (`mode = individual`) – np. `10,20,30`.
  - Dodano wewnętrzne flagi:
    - `qtyInputDirty` – użytkownik faktycznie edytował pole "Ilość",
    - `qtyPerProjectDirty` – użytkownik faktycznie edytował pole "Ilości na proj.".
  - Automatyczne przeliczenia:
    - wejście TAB‑em do pola **bez edycji** nie uruchamia żadnych przeliczeń,
    - jeśli lista ilości została **tylko automatycznie wyliczona z sumy**, źródłem pozostaje suma,
    - dopiero ręczna edycja "Ilości na proj." zmienia źródło na `perProject`.

- **Spójne oznaczenie źródła pochodzenia produktu (PM/KI)**
  - W szczegółach zamówienia i na wydrukach **zawsze** pokazujemy badge:
    - `PM` (miejscowości) – niebieski,
    - `KI` (katalog indywidualny / klienci indywidualni) – zielony,
    - inne typy (imienne / hasła / okolicznościowe) mają własne kolory.
  - Badge pojawia się niezależnie od tego, czy zamówienie ma mieszane źródła, czy nie.
  
- **Mapowanie projektów galerii na produkty**
  - Nowy moduł admina "Mapowanie produktów" oparty o tabele `GalleryProject` i `GalleryProjectProduct`.
  - Endpointy `api/gallery/products/*` wzbogacają odpowiedź o strukturę:
    - `projects[]` (slug, `displayName`, powiązane produkty z bazy: `productId`, `identifier`, `index`).
  - Formularz zamówień:
    - lista produktów z galerii korzysta w pierwszej kolejności z mapowania (identyfikatory produktów + nazwa projektu),
    - wyszukiwarka wyników potrafi dopasować wybrany produkt do konkretnego projektu,
    - filtr "z projektem / bez projektu" uwzględnia zarówno nazwy z galerii, jak i mapowanie w bazie.

- **Widok "Miejscowości PM" w panelu admina**
  - Dodano szybkie filtry i przycisk "Wyczyść filtry" resetujący wyszukiwarkę, sortowanie i checkboxy nad siatką miast.
  - Dostępny jest przycisk "Eksport CSV" z globalną listą przypisań miejscowości do handlowców.
  - Nowy podgląd wydruku przypisań w układzie: Handlowiec → lista przypisanych miejscowości (alfabetycznie).

- **Szczegóły zamówień i role**
  - `ADMIN`, `SALES_DEPT`, `WAREHOUSE`, `PRODUCTION` mogą oglądać szczegóły wszystkich zamówień.
  - `SALES_REP` widzi tylko własne zamówienia (spójnie z listą zamówień).
  - Naprawiono błąd 500 w `/api/orders/:id` (usunięta nieistniejąca kolumna produktu z zapytania SQL).
  
- **Zmiany techniczne**
  - Dodano migrację `supabase/migrations/20251201_add_quantity_source.sql` z kolumną `OrderItem.quantitySource text DEFAULT 'total'`.
  - Backend (`server.js`) zapisuje i odczytuje `projectQuantities` i `quantitySource` oraz zwraca te pola w `/api/orders` i `/api/orders/:id`.
  - Wyciszono większość logów `[DEBUG]` w `scripts/app.js` i `admin/admin.js`.

- **City Access (Miejscowości PM)**
  - Dodano nowy moduł w panelu admina do zarządzania przypisaniem miejscowości do handlowców.
  - Ulepszono wyświetlanie informacji o miejscowościach w szczegółach zamówień.
  - Naprawiono błąd związany z dostępem do szczegółów zamówień dla użytkowników z rolą `SALES_REP`.

---

## Panel Produkcji - Przeprojektowanie (grudzień 2024)

### Nowe funkcje

#### 1. Przełącznik widoku ZP
Operator może przełączać między trzema widokami:
- **Do zrobienia** (`open`) - zlecenia aktywne (planned, approved, in_progress)
- **Wykonane** (`completed`) - zlecenia zakończone dzisiaj
- **Wszystkie** (`all`) - wszystkie zlecenia

#### 2. Kompaktowy kafelek ZP
Przeprojektowany kafelek zlecenia produkcyjnego:
- Zmniejszony rozmiar dla lepszej skanowalności
- Usunięte dublowanie informacji
- Wyświetlanie 1 produktu + "+N więcej" zamiast pełnej listy
- Szczegóły dostępne po kliknięciu "Szczegóły"

#### 3. Śledzenie postępu w ramach ZP
- Ukończone pozycje pozostają widoczne w ZP do momentu zakończenia całego zlecenia
- Wizualne oznaczenie ukończonych pozycji (wyszarzenie + ✓)
- Ukrycie przycisków akcji dla ukończonych pozycji
- Pasek postępu pokazuje % ukończenia

#### 4. Przepływ między pokojami (R1)
- Po zakończeniu operacji w pokoju A, pozycja automatycznie znika z A
- Pozycja pojawia się w kolejnym pokoju B na ścieżce produkcyjnej
- Filtrowanie bierze pod uwagę tylko operacje `pending/active/paused`

#### 5. Numer matrycy
- Nowe pole w modalu zakończenia operacji
- Operator może wpisać numer matrycy przy zakończeniu
- Numer zapisywany w notatkach operacji (format: `MATRYCA: xxx`)
- Wyświetlany w szczegółach pozycji

#### 6. Przycisk "Zakończ ZP"
- Dostępny tylko gdy 100% pozycji jest ukończonych
- Potwierdza zakończenie zlecenia
- Automatycznie przełącza na widok "Wykonane"

### API

#### GET /api/production/orders/active
Nowy parametr: `workOrdersView`
- `open` (domyślny) - otwarte zlecenia + completed pozycje z tych samych ZP
- `completed` - tylko zakończone dzisiaj
- `all` - wszystkie statusy

### Testy
Nowy plik testów: `backend/workorders-view.test.js`
- Testy reguły R1 (filtrowanie po statusie operacji)
- Testy parametru workOrdersView
- Testy dołączania completed do otwartych ZP
- Testy obliczania postępu
- Testy parsowania numeru matrycy

### Pliki zmienione
- `backend/server.js` - logika filtrowania i parametr workOrdersView
- `scripts/production.js` - przeprojektowane renderowanie kafelków
- `production.html` - nowe UI (przełącznik, pole matrycy, style CSS)



Własne teksty
Od razu wszystko przeprojektój bez pół środków. Pamiętaj UX i UI. Zaprojektój plan , wdróż go krok po kroku. Wykonaj testy jednostkowe, uzupełnij dokumentcję. 