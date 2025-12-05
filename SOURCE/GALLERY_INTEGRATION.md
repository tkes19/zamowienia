# Galeria produktów – instrukcja integracji

Ta dokumentacja opisuje aktualny zestaw plików tworzących galerię produktów oraz sposób ich użycia w innych projektach frontendowych. Backend (PHP) pozostaje na QNAP-ie, a frontend (`gallery.html`) można osadzić w dowolnej aplikacji statycznej (np. Netlify, inny projekt HTML).

## Struktura plików

| Plik | Rola |
|------|------|
| `gallery.html` | Kompletny frontend: UI, style, logika JS (pobieranie danych, filtrowanie, render siatki). |
| `list_cities.php` | API zwracające listę katalogów/miejscowości jako JSON. |
| `list_products.php` | API zwracające listę produktów i plików (URL-e obrazków) dla wybranej miejscowości. |

> **Uwaga:** przy każdej zmianie w plikach PHP pamiętaj, by skopiować zaktualizowane pliki na QNAP, bo tylko tam są wykonywane.

## Backend (QNAP)

- Lokalizacja katalogów z danymi: `/share/CACHEDEV1_DATA/Web/home/PROJEKTY_MIEJSCOWOŚCI`
- Publiczny URL do API (HTTP z portem 81 lub HTTPS):
  - LAN: `http://192.168.0.30:81/home`
  - Z zewnątrz: `https://rezon.myqnapcloud.com:81/home`
- `list_cities.php` zwraca JSON w formacie:
  ```json
  {
    "count": 353,
    "cities": ["Barczewo", "Bielsko-Biała", ...],
    "source": "/share/CACHEDEV1_DATA/Web/home/PROJEKTY_MIEJSCOWOŚCI"
  }
  ```
- `list_products.php?city=Bielsko-Biała` zwraca m.in.:
  ```json
  {
    "city": "Bielsko-Biała",
    "products": ["magnes_akryl_polska", ...],
    "files": [
      {
        "file": "Bielsko-Biała_magnes_akryl_polska.jpg",
        "product": "magnes_akryl_polska",
        "url": "http://192.168.0.30:81/home/PROJEKTY_MIEJSCOWOŚCI/Bielsko-Biała/Bielsko-Biała_magnes_akryl_polska.jpg"
      }
    ],
    "errors": []
  }
  ```
- Konfiguracja po stronie PHP:
  ```php
  // list_cities.php & list_products.php
  $REMOTE_DIR  = '/share/CACHEDEV1_DATA/Web/home/PROJEKTY_MIEJSCOWOŚCI';
  $PUBLIC_BASE = 'http://192.168.0.30:81/home/PROJEKTY_MIEJSCOWOŚCI';
  ```
- CORS: oba pliki wysyłają `Access-Control-Allow-Origin: *`, więc frontend może działać z dowolnej domeny.

## Frontend (`gallery.html`)

1. **API_BASE**
   ```js
   const DEFAULT_API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
     ? 'http://192.168.0.30:81/home'
     : 'https://rezon.myqnapcloud.com:81/home';
   const API_BASE = window.__GALLERY_API_BASE__ ?? DEFAULT_API_BASE;
   ```
   - Dla innego środowiska można przed głównym skryptem ustawić:
     ```html
     <script>window.__GALLERY_API_BASE__ = 'https://twoja-domena/home';</script>
     ```

2. **UI elementy**
   - `#city` – select miejscowości (automatycznie filtruje katalogi zaczynające się od cyfr, np. `00.`).
   - `#product` – select produktów (wartość = slug, label = wersja z dużych liter i spacjami).
   - `#grid` – siatka `<figure>` z obrazami i podpisami.

3. **Ważne funkcje JS**
   - `loadCities()` – pobiera listę miast, filtruje techniczne katalogi, wypełnia select i wywołuje `loadProducts()` dla pierwszego wyniku.
   - `loadProducts(city)` – pobiera produkty i pliki, zasila select produktów oraz cache (`filesCache`).
   - `renderGrid()` – renderuje HTML, filtrując `filesCache` według wybranego produktu.
   - `formatProductLabel(slug)` – tylko do wyświetlania (`magnes_metal_serce` → `MAGNES METAL SERCE`).
   - Obsługa zoom/pan na obrazach jest wbudowana (`setupPanAndZoom`).

4. **Integracja z innym projektem**
   - Skopiuj sekcję `<style>` i `<script>` z `gallery.html` do docelowego pliku (lub rozbij na osobne pliki CSS/JS według potrzeby).
   - Upewnij się, że w docelowym HTML znajdują się elementy z id: `city`, `product`, `grid`, `errors`.
   - Jeśli strona ma własne style resetujące, sprawdź czy nie nadpisują klas `.controls`, `.zoom-frame`, itp.
   - W projektach SPA możesz wrzucić kod JS do modułu i wywołać `loadCities()` po zamontowaniu komponentu.

5. **Lokalne testy**
   - Uruchom Live Server (VS Code) lub `python -m http.server 8000` w folderze z plikiem.
   - Wejdź na `http://localhost:8000/gallery.html` – skrypt sam wybierze API po LAN-ie.

6. **Deployment (np. Netlify)**
   - Wystaw tylko frontend (HTML/CSS/JS).
   - Jeśli Netlify działa po HTTPS, używaj `https://rezon.myqnapcloud.com:81/home` (przeglądarka blokuje mieszany kontent HTTP → HTTPS).
   - Opcjonalnie skonfiguruj własny reverse proxy, jeśli chcesz mieć dedykowany host.

## Najczęstsze problemy i rozwiązania

| Objaw | Przyczyna | Rozwiązanie |
|-------|-----------|-------------|
| `Failed to fetch` przy ładowaniu miast | Zły `API_BASE` (brak portu 81 lub zły host). | Sprawdź `window.__GALLERY_API_BASE__` lub ustaw prawidłowe adresy w `DEFAULT_API_BASE`. |
| Brak obrazków w siatce | `list_products.php` zwraca URL bez `:81` lub złą ścieżkę. | Upewnij się, że wersja z `PUBLIC_BASE = 'http://192.168.0.30:81/home/PROJEKTY_MIEJSCOWOŚCI'` została wgrana na QNAP. |
| Na liście miast widoczne techniczne katalogi `00.` | Brak aktualnej wersji `gallery.html`. | Upewnij się, że korzystasz z wersji z filtrowaniem `visibleCities`. |
| W select „Produkt” wartości mają podkreślenia | Stara wersja frontendu. | Użyj wersji z `formatProductLabel`. |

## Checklist przenosin do innego projektu

1. **Backend**: upewnij się, że `list_cities.php` i `list_products.php` są aktualne na QNAP (port 81, nowe slugowanie).
2. **Frontend**:
   - skopiuj HTML + style + skrypt do nowego projektu;
   - (opcjonalnie) podziel na `gallery.css` i `gallery.js` dla porządku;
   - ustaw `window.__GALLERY_API_BASE__`, jeśli domyślne wykrywanie nie pasuje.
3. **Test**: uruchom stronę lokalnie i zdalnie, sprawdź czy dropdowny oraz obrazy działają.
4. **Dokumentacja**: zaktualizuj README / opis projektu nowego frontendu, wskazując, że backend działa na QNAP-ie.

## Dalszy rozwój

- Dodanie wyszukiwarki produktów po nazwie/slug.
- Paginate/ lazy loading przy dużej liczbie zdjęć.
- Buforowanie wyników API (service worker lub prosty cache w localStorage).
- Własny backend API → reverse proxy, gdy QNAP jest dostępny tylko z sieci lokalnej.

W systemie zamówień **Rezon** galeria jest zintegrowana z formularzem zamówień. Frontend formularza korzysta
z prostego stanu w `localStorage`, aby zapamiętać ostatnio wybrane:

- w trybie PM: miejscowość (`pmCity`) i produkt (`pmProductSlug`),
- w trybie KI: handlowca (`kiSalesperson`), obiekt (`kiObject`) i produkt (`kiProductSlug`).

Szczegóły zachowania (w tym klucze localStorage i zasady odtwarzania stanu) opisuje `docs/SPEC.md`
(`sekcja 6.7. Stan formularza zamówień w localStorage`).

Masz pytania albo potrzebujesz wersji modułowej (np. `gallery.js` + `gallery.css`)? Daj znać – łatwo wygenerujemy gotowe pliki do importu.
