# Formularz zamówień – dokumentacja

Krótka instrukcja uruchamiania i utrzymania aplikacji łączącej formularz zamówień z podglądem galerii.

## 1. Wymagania

- Node.js 16+ (wraz z `npm`).
- Jeśli chcesz pobierać aktualizacje repozytorium – Git (opcjonalnie).

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

## Tak uruchamiałem w domu 

```powershell
cd backend
node server.js

node server.js lub npm run dev
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

## 7. Najczęstsze problemy

| Problem | Rozwiązanie |
| --- | --- |
| **Failed to fetch / CORS** | Upewnij się, że strona jest otwarta z `http://localhost:3001/`, a nie z Live Servera. |
| **Brak wyników** | Sprawdź logi serwera (`npm run dev`) – czy proxy otrzymało dane z `rezon-api`. |
| **SMTP błędy** | Zweryfikuj dane w `.env` oraz dostępność serwera pocztowego. |

## 8. Deploy (skrót)

1. Wybierz hosting Node.js (Railway, Render, Fly.io, VPS itp.).
2. Zdeployuj katalog `backend/` – Express będzie serwować statyczne pliki i API jednocześnie.
3. Ustaw zmienne środowiskowe (`PORT`, `SMTP_*`).
4. Skieruj domenę na ten sam serwer – frontend i backend muszą być pod jednym originem.

To wszystko – dokument ma być możliwie zwięzły. Jeśli potrzeba dodatkowych szczegółów (np. o galerii czy PDF), dopisuj je w dedykowanych sekcjach, ale zawsze z myślą o krótkiej, praktycznej instrukcji.

---

## 9. Git – pierwsza konfiguracja repozytorium (opcjonalnie)

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

## 10. Git – typowy cykl pracy (kopiuj i wklej)

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

w domu
cd "C:\Users\kocie\OneDrive\000 CURSOR\ZAMÓWIENIA"
git status
git add backend/server.js scripts/app.js README.md
git commit -m "fix: proxy obrazków galerii dla HTTPS"
git push









## 11. Git – cofanie zmian, gdy coś się zepsuje

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

## 12. Hosting aplikacji (skrót)

Jeśli potrzebujesz pełnych instrukcji wdrożenia (Railway, Netlify, Fly.io), skorzystaj z pliku `HOSTING_GUIDE.md`. Poniżej szybkie podsumowanie:

- **Railway** – prosty backend Node.js z auto-deployem po `git push`.
- **Netlify** – hosting statycznego frontendu (wymaga backendu pod innym adresem).
- **Fly.io** – frontend i backend w jednym miejscu, brak usypiania w darmowym tierze.

W każdej opcji pamiętaj o ustawieniu zmiennych środowiskowych (`PORT`, `SMTP_*`) i aktualizacji adresu API we frontendzie.
