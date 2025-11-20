# Dokumentacja Aplikacji do Zamówień

## Wymagania wstępne
- Node.js (wersja 16 lub nowsza)
- npm (zazwyczaj dołączony do Node.js)

## Instalacja

1. Sklonuj repozytorium:
   ```bash
   git clone <adres-repozytorium>
   cd ZAMÓWIENIA
   ```

2. Zainstaluj zależności dla serwera:
   ```bash
   cd backend
   npm install
   ```

3. Zainstaluj zależności dla frontendu (jeśli są osobne):
   ```bash
   cd ../frontend  # jeśli istnieje osobny katalog frontend
   npm install
   ```

## Uruchamianie serwera

1. Przejdź do katalogu backend:
   ```bash
   cd backend
   ```

2. Uruchom serwer:
   ```bash
   node server.js
   ```
   Serwer powinien być dostępny pod adresem: `http://localhost:3001`

cd "C:\Users\Tomek\OneDrive\000 CURSOR\ZAMÓWIENIA\backend"
node server.js



## Uruchamianie frontendu

1. Otwórz plik `index.html` w przeglądarce:
   - Przeciągnij plik do okna przeglądarki, lub
   - Uruchom prosty serwer HTTP (np. używając rozszerzenia VS Code "Live Server")

2. (Opcjonalnie) Jeśli frontend ma własny serwer deweloperski:
   ```bash
   cd frontend
   npm run dev
   ```
   Frontend powinien być dostępny pod adresem: `http://localhost:3000`

## Testowanie API

### Przykładowe zapytania do API:

1. Wyszukiwanie produktów:
   ```powershell
   # PowerShell
   Invoke-RestMethod -Uri 'http://localhost:3001/api/v1/products?search=chrom'
   ```
   ```bash
   # Linux/macOS
   curl 'http://localhost:3001/api/v1/products?search=chrom'
   ```

2. Pobieranie wszystkich produktów:
   ```bash
   curl 'http://localhost:3001/api/v1/products'
   ```

## Skrypty npm

W katalogu `backend/package.json` dostępne są następujące skrypty:

- `npm start` - Uruchamia serwer w trybie produkcyjnym
- `npm run dev` - Uruchamia serwer w trybie deweloperskim z automatycznym przeładowaniem
- `npm test` - Uruchamia testy (jeśli zdefiniowane)

## Zmienne środowiskowe

Utwórz plik `.env` w katalogu `backend` z następującymi zmiennymi (jeśli są wymagane):

```
PORT=3001
NODE_ENV=development
# Inne zmienne środowiskowe
```

## Rozwiązywanie problemów

1. **Brak dostępu do API**:
   - Sprawdź, czy serwer jest uruchomiony
   - Sprawdź port w logach serwera
   - Sprawdź CORS w konfiguracji serwera

2. **Brak wyników wyszukiwania**:
   - Sprawdź połączenie z bazą danych
   - Sprawdź logi serwera pod kątem błędów
   - Upewnij się, że zapytanie zawiera poprawny parametr `search`

## Wsparcie
W razie problemów skontaktuj się z administratorem systemu.
