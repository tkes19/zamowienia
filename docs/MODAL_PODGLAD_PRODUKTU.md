# Modal podglądu produktu – kompletna dokumentacja

## Spis treści
1. [Cel i kontekst](#cel-i-kontekst)
2. [Architektura rozwiązania](#architektura-rozwiązania)
3. [Zmiany w bazie danych](#zmiany-w-bazie-danych)
4. [Zmiany w backendzie](#zmiany-w-backendzie)
5. [Integracja z galerią (frontend)](#integracja-z-galerią-frontend)
6. [Implementacja we frontendzie – panele](#implementacja-we-frontendzie--panele)
   - [Panel Zamówień](#panel-zamówień)
   - [Panel Grafika](#panel-grafika)
   - [Panel Produkcja](#panel-produkcja)
7. [Funkcje modala – zachowanie](#funkcje-modala--zachowanie)
8. [Macierz dostępu (role → widoki)](#macierz-dostępu-role--widoki)
9. [Lista zmienionych plików](#lista-zmienionych-plików)
10. [Testy i weryfikacja](#testy-i-weryfikacja)
11. [Znane problemy i zastosowane rozwiązania](#znane-problemy-i-zastosowane-rozwiązania)
12. [Możliwe przyszłe rozszerzenia](#możliwe-przyszłe-rozszerzenia)

---

## Cel i kontekst

Celem zmian było wprowadzenie **spójnego, profesjonalnego podglądu obrazka produktu** we wszystkich kluczowych panelach systemu:

- Panel **Zamówień** (handlowcy, sprzedaż, magazyn, admin)
- Panel **Grafika** (graficy, kierownik produkcji)
- Panel **Produkcja** (operatorzy, produkcja)

Wcześniej użytkownicy mieli jedynie:
- Surowe linki do formularzy / plików w galerii
- Brak jednego, wygodnego modala z powiększeniem i pobieraniem

Teraz każdy panel ma **ten sam koncept**:
- Ikona/przycisk **podglądu** przy pozycji zamówienia / zadaniu
- Kliknięcie otwiera **duży modal** z obrazkiem produktu
- Można obrazek **powiększyć**, **pobrać** i **zamknąć** modal

---

## Architektura rozwiązania

Przepływ danych (wysoki poziom):

```text
GALERIA → URL obrazka → KOSZYK → ZAMÓWIENIE → OrderItem.projectviewurl
   ↓                                                   ↓
 FRONTEND (3 panele)  ←———  API z projectviewurl  ←——— BACKEND
```

Warstwy:

1. **Baza danych** – kolumna `projectviewurl` w tabeli `OrderItem`
2. **Backend (server.js)** – wszystkie potrzebne endpointy zwracają `projectviewurl`
3. **Integracja galerii (app.js)** – przy dodawaniu do koszyka zapamiętujemy URL obrazka
4. **Frontend paneli** – każdy panel ma własny modal + przyciski wywołujące `showProductImage()`
5. **CSS/UX** – spójny wygląd, ale dostosowany do możliwości danego widoku (Tailwind vs własne style)

---

## Zmiany w bazie danych

**Plik migracji:** `supabase/migrations/20251206_add_orderitem_project_view_url.sql`

Dodana kolumna:

```sql
ALTER TABLE "OrderItem" 
ADD COLUMN "projectviewurl" text;

COMMENT ON COLUMN "OrderItem"."projectviewurl" 
IS 'Proxied URL to gallery product image for preview purposes';
```

Szczegóły:
- **Nazwa kolumny:** `projectviewurl` (małe litery, zgodnie z konwencją Postgresa)
- **Typ:** `text` (pełne URL-e, w tym zakodowane znaki PL)
- **NULL:** dozwolone (nie każda pozycja musi mieć obrazek)

Skutek:
- Nowe i istniejące zamówienia mogą przechowywać **adres podglądu produktu**.

---

## Zmiany w backendzie

**Plik:** `backend/server.js`

### 1. Tworzenie zamówienia (`POST /api/orders`)

W danych pozycji zamówienia (`OrderItem`) dodano pole:

```javascript
const orderItems = items.map(item => ({
    // ... inne pola
    projectViewUrl: item.projectViewUrl || null,
    // ...
}));
```

W zapisie do bazy wykorzystywana jest już kolumna `projectviewurl`.

### 2. API zamówień (lista / szczegóły)

Endpointy `/api/orders` oraz `/api/orders/:id` zostały rozszerzone tak, aby w sekcji `OrderItem` zwracać pole:

```javascript
OrderItem (
    id,
    projectviewurl,
    productName:projectName,
    quantity,
    productionNotes,
    -- ... inne pola
)
```

### 3. API zadań graficznych (`GET /api/graphics/tasks`)

W selekcie dla `GraphicTask`:

```javascript
OrderItem (
    productName:projectName,
    quantity,
    productionNotes,
    projectviewurl,
    Product (
        name,
        identifier,
        index
    )
)
```

Dzięki temu w panelu grafika można od razu pobrać URL podglądu produktu.

### 4. API produkcji (`GET /api/production/orders` / `.../active`)

Rozszerzono selekt o `sourceOrderItem`:

```javascript
sourceOrderItem:OrderItem(
    id,
    projectviewurl,
    productionNotes,
    selectedProjects,
    projectQuantities,
    source,
    Product(name, identifier)
)
```

Produkcja widzi więc:
- Ilości i projekty
- Uwagi
- **URL obrazka** do podglądu

---

## Integracja z galerią (frontend)

**Plik:** `scripts/app.js`

### 1. Funkcja `buildGalleryUrl()`

Zadanie:
- Odnaleźć aktualnie wybrany produkt w `galleryFilesCache`
- Zbudować pełny URL do pliku na QNAP
- Opakować go w **proxy backendowe**:

```text
http://localhost:3001/api/gallery/image?url=ZAKODOWANY_ORYGINALNY_URL
```

Dzięki temu:
- Nie wystawiamy bezpośrednio adresu QNAP w frontendzie
- Możemy w backendzie dodać cache / zabezpieczenia / nagłówki

### 2. Powiązanie z koszykiem

#### `addToCart()` / `addToCartWithQuantityBreakdown()`

Przed dodaniem pozycji do koszyka wywoływany jest `buildGalleryUrl()`, a wynik zapisujemy w polu:

```javascript
projectViewUrl
```

Przy wysyłce zamówienia do backendu to pole trafia do payloadu i dalej do `OrderItem.projectviewurl`.

---

## Implementacja we frontendzie – panele

### Panel Zamówień

**HTML:** `orders.html`
- Dodany **modal** z klasami Tailwind (ciemne tło, przyciski, nagłówek, kontener na obrazek)

**JS:** `scripts/orders.js`
- Funkcja `showProductImage(url, name, id, location)` – przygotowuje nagłówek i ładuje obrazek
- Obsługa zdarzeń:
  - `load` / `error` na tymczasowym `Image()` (brak duplikacji handlerów)
  - Po `load` ustawiany jest `src` w `productImageContent` + zdjęcie modala
- Dodatkowe funkcje:
  - `toggleImageZoom()` – powiększenie 1.5x, zmiana kursora, zmiana ikony
  - `downloadImage()` – pobranie pliku
  - `closeProductImage()` – zamknięcie modala
- W szczegółach pozycji dodany **ładny przycisk** (gradient, ikona obrazka), który wywołuje `showProductImage()`.

### Panel Grafika

**HTML:** `graphics.html`
- Brak Tailwinda, dlatego modal ma **inline style** (pozycjonowanie, tło, rozmiary)
- Duży kontener (~95% okna, szerokość ~1200px na dużych ekranach)
- Obrazek:
  - `max-width: 100%`
  - `height: auto`
  - `object-fit: contain`
  - Cień, zaokrąglenia

**JS:** `scripts/graphics.js`
- Zmienna `state` do zarządzania zadaniami
- Dodane zmienne:
  - `productImageModal`, `productImageContent`, `productImageTitle`, `productImageDetails`, `productImageZoom`, `productImageDownload`, `productImageClose`
- Funkcja `setupProductImageModal()` wywoływana po `DOMContentLoaded`:
  - Pobiera elementy z DOM
  - Podpina event listenery (zamknięcie, zoom, pobranie, kliknięcie w tło)
- Funkcja `showProductImage()`:
  - Loguje w konsoli otrzymany URL
  - Ustawia tytuł i opis (ID, lokalizacja)
  - Tworzy tymczasowy `Image()`, na którym słucha `load` / `error`
  - Po `load` ustawia `src` na docelowym `img` i `display: flex` na modalu
- Funkcje pomocnicze:
  - `toggleImageZoom()` – powiększenie / pomniejszenie
  - `downloadImage()` – pobranie
  - `closeProductImage()` – `display: none` + czyszczenie `src`
- W panelu szczegółów zadania dodany **przycisk podglądu** (ikona obrazka) gdy istnieje `projectviewurl`.

### Panel Produkcja

**HTML:** `production.html`
- Dodany modal bardzo podobny do tego z `orders.html` (Tailwind)

**JS:** `scripts/production.js`
- Inicjalizacja elementów modala na górze pliku
- `setupProductImageModal()` – podpina eventy (zamknięcie, zoom, pobieranie, kliknięcie w tło)
- `showProductImage()` – analogicznie jak w pozostałych panelach
- W `renderOrderCard(order)`:
  - Przy nazwie produktu wyświetlany jest **mały, ale wyraźny przycisk** z ikoną obrazka (gradient)
  - Po kliknięciu wywołuje `showProductImage(orderItem.projectviewurl, ...)`

---

## Funkcje modala – zachowanie

Wspólne założenia dla wszystkich paneli:

- **Powiększenie (zoom)**
  - Domyślnie skala = 1
  - Po kliknięciu przycisku lupy skala = 1.5
  - Ponowne kliknięcie wraca do 1
  - Zmienia się ikona (plus / minus) i kursor (zoom-in / zoom-out)

- **Pobieranie**
  - Tworzone jest tymczasowe `<a>` z `href = imageUrl`
  - `download="produkt-{timestamp}.jpg"`
  - Po `click()` link jest usuwany z DOM

- **Zamykanie**
  - Przycisk z `X`
  - Kliknięcie w tło (poza kontenerem) zamyka modal
  - Czyszczenie `src`, żeby nie trzymać niepotrzebnie obrazka

- **Obsługa błędów**
  - Jeśli obrazek nie może się załadować, wyświetlany jest komunikat (toast/notification)
  - Błąd logowany jest do konsoli z pełnym URL-em

---

## Macierz dostępu (role → widoki)

| Panel       | Role                                           | Dostęp do podglądu |
|-------------|-----------------------------------------------|---------------------|
| Zamówienia  | SALES_REP, ADMIN, SALES_DEPT, WAREHOUSE, PRODUCTION | Tak, przy pozycji zamówienia |
| Grafika     | GRAPHICS, ADMIN, PRODUCTION_MANAGER          | Tak, w szczegółach zadania |
| Produkcja   | PRODUCTION, ADMIN, OPERATOR                  | Tak, na karcie zlecenia |

W skrócie: **wszyscy, którzy widzą pozycję zamówienia / zadanie / zlecenie, mogą zobaczyć obrazek produktu**, jeśli istnieje `projectviewurl`.

---

## Lista zmienionych plików

### Backend
- `backend/server.js`
  - Rozszerzone selekty w:
    - `/api/orders`
    - `/api/orders/:id`
    - `/api/graphics/tasks`
    - `/api/production/orders`
  - Dodanie `projectViewUrl` przy tworzeniu `OrderItem`

### Baza danych
- `supabase/migrations/20251206_add_orderitem_project_view_url.sql`
  - Nowa kolumna `projectviewurl` w `OrderItem`

### Frontend – HTML
- `orders.html` – modal podglądu produktu
- `graphics.html` – modal podglądu produktu (inline CSS)
- `production.html` – modal podglądu produktu

### Frontend – JavaScript
- `scripts/app.js` – integracja z galerią + przekazywanie URL do zamówień
- `scripts/orders.js` – modal w panelu zamówień
- `scripts/graphics.js` – modal w panelu grafika
- `scripts/production.js` – modal w panelu produkcji

---

## Testy i weryfikacja

### Sprawdzone scenariusze
- Dodanie pozycji z galerii, utworzenie zamówienia, sprawdzenie podglądu w:
  - Panelu Zamówień
  - Panelu Grafika (zadanie wygenerowane automatycznie)
  - Panelu Produkcji (zlecenie produkcyjne)
- Brak obrazka:
  - Brak przycisku podglądu / brak błędów w konsoli
- Błędny URL / brak dostępu:
  - Komunikat o błędzie ładowania obrazka
- Różne role:
  - Użytkownik z rolą **GRAPHICS** widzi podgląd tylko w panelu grafika
  - Użytkownik z rolą **PRODUCTION** widzi podgląd tylko w produkcji
  - **ADMIN** widzi wszędzie

---

## Znane problemy i zastosowane rozwiązania

1. **Podwójne wywołania handlerów `onload` / `onerror`**
   - **Objaw:** w konsoli pojawiało się zarówno "Image loaded successfully", jak i "Failed to load image" dla tego samego URL
   - **Przyczyna:** wielokrotne przypisywanie `onload` / `onerror` do tego samego `<img>`
   - **Rozwiązanie:** użycie tymczasowego `new Image()` + `addEventListener(..., { once: true })`

2. **Elementy modala `null` w `graphics.js`**
   - **Objaw:** modal się nie wyświetlał mimo poprawnych logów
   - **Przyczyna:** pobieranie elementów DOM przed załadowaniem HTML
   - **Rozwiązanie:** 
     - zamiana `const` na `let`
     - inicjalizacja w `setupProductImageModal()` po `DOMContentLoaded`

3. **Brak Tailwinda w `graphics.html`**
   - **Objaw:** klasy `fixed`, `inset-0`, `flex` itp. nie działały
   - **Rozwiązanie:** zamiana na **inline style** (pozycjonowanie, tło, rozmiar)

4. **Modal widoczny, ale obrazek mały**
   - **Objaw:** duży modal, ale obrazek mały na środku
   - **Przyczyna:** zbyt mocne ograniczenie `max-height`
   - **Rozwiązanie:** usunięcie `max-height`, pozostawienie `max-width: 100%; height: auto`

---

## Możliwe przyszłe rozszerzenia

- Rotacja obrazka (np. dla pionowych/poziomych wzorów)
- Sterowanie z klawiatury:
  - `ESC` – zamknij modal
  - `+` / `-` lub `Ctrl + scroll` – zoom
- Wyświetlanie metadanych obrazka (wymiary, rozmiar pliku)
- Preload / cache obrazków po stronie przeglądarki
- Miniatury (thumbnails) w panelu zamówień / grafika
- Narzędzia dla grafików:
  - anotacje na obrazku
  - szybkie przechodzenie między wariantami projektu

---

**Ostatnia aktualizacja:** 8 grudnia 2025  
**Autor:** Cascade (asystent AI)
