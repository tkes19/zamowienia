# Hostowanie aplikacji formularza zamówień

Przewodnik jak wystawić aplikację w Internecie w możliwie **tanio / darmo** i bez zbędnych kroków. Każda opcja zakłada, że backend Express (katalog `backend/`) serwuje zarówno API (`/api/v1/products`), jak i statyczne pliki (`index.html`, `assets/`, `scripts/`). Dzięki temu frontend i backend działają pod jednym originem, więc nie ma problemów z CORS.

## 1. Wymagania wspólne

1. Repozytorium zaktualizowane (najlepiej na GitHubie).
2. Plik `.env` z ustawionymi zmiennymi (co najmniej `PORT`, a jeśli wysyłasz PDF e-mailem – `SMTP_*`).
3. W `backend/package.json` znajdują się skrypty:
   ```json
   "start": "node server.js",
   "dev": "nodemon server.js"
   ```
4. Folder `backend/` to jedyny artefakt do wdrożenia – Express wczytuje pliki z katalogu nadrzędnego (`..`).

## 2. Opcje hostingu

### Opcja A – Railway (najwygodniejsze auto-deploye, darmowy tier)

1. [Utwórz konto Railway](https://railway.app/) (można zalogować się przez GitHub).
2. **New Project → Deploy from GitHub repo** i wybierz repozytorium.
3. Konfiguracja projektu:
   - *Root Directory*: `backend`
   - *Install Command*: `npm install`
   - *Build Command*: *(puste)*
   - *Start Command*: `npm start`
4. W zakładce **Variables** ustaw `PORT=3001` (Railway nadpisze na swój, ale warto mieć default) oraz dane SMTP.
5. Po każdym `git push` Railway wykona deploy automatycznie. Publiczny URL znajdziesz w **Deployments**. Aplikacja od razu jest https.
6. Aby podpiąć własną domenę, dodaj ją w ustawieniach projektu i skonfiguruj rekord CNAME wskazujący na Railway.

**Koszt**: darmowy tier (obecnie 500 godzin/miesiąc) wystarcza do testów i demo – przy większym ruchu można przejść na plan hobbystyczny.

### Opcja B – Render (backend jako "Web Service")

1. [Wejdź na Render](https://render.com/) i zaloguj się przez GitHub.
2. **New + → Web Service → Build & deploy from a Git repo**.
3. Ustawienia:
   - Repozytorium: `zamowienia`
   - *Root Dir*: `backend`
   - *Environment*: Node
   - *Build Command*: `npm install`
   - *Start Command*: `npm start`
4. W zakładce **Environment** ustaw zmienne (.env). Render automatycznie nada publiczny adres https.
5. Render usypia darmowe instancje po ~15 minutach bez ruchu (pierwsze wejście po przerwie trwa kilka sekund). Jeśli to przeszkadza, włącz plan płatny.

### Opcja C – Fly.io (ciągle aktywne, elastyczne)

1. Zainstaluj [Fly CLI](https://fly.io/docs/hands-on/install/), zaloguj się: `fly auth login`.
2. W katalogu projektu uruchom:
   ```powershell
   fly launch --now
   ```
   - Nazwa aplikacji: np. `zamowienia-app`
   - Gdy zapyta o bazę danych – wybierz "no".
3. Fly wygeneruje `fly.toml`. Upewnij się, że:
   ```toml
   internal_port = 3001
   [env]
   PORT = "3001"
   ```
4. W pliku `Dockerfile` (Fly stworzy go automatycznie) dopilnuj, aby kopiował cały projekt i uruchamiał `npm install --prefix backend && npm run build` (jeśli potrzebujesz build frontu) oraz `npm start --prefix backend`.
5. Deploy: `fly deploy`. Po chwili aplikacja dostępna jest pod `https://twoja-nazwa.fly.dev`.
6. Darmowy tier obejmuje 256 MB RAM i kilka maszyn współdzielonych – wystarcza do małej aplikacji. Możesz dodać własną domenę i certyfikat w panelu.

### Alternatywa – VPS / tani serwer własny

Jeśli dysponujesz najtańszym VPS (np. 5–10 USD/mc), możesz zainstalować Node.js ręcznie i użyć PM2 lub systemd, by uruchomić `npm start` w katalogu `backend/`. Następnie reverse proxy (Nginx/Caddy) serwuje aplikację pod domeną z certyfikatem Let's Encrypt. To rozwiązanie wymaga trochę administracji, ale daje pełną kontrolę i stabilność (brak usypiania).

## 3. Checklist przed deployem

- [ ] `npm install` i `npm run dev` działają lokalnie.
- [ ] W `backend/.env` są wpisane wszystkie potrzebne dane (przynajmniej `PORT`).
- [ ] `scripts/app.js` ma `const API_BASE = '/api/v1/products';` – dzięki temu frontend zawsze odpyta bieżący origin.
- [ ] `backend/server.js` serwuje statyczne pliki (`express.static(path.join(__dirname, '..'))`).
- [ ] W repo nie ma wrażliwych danych – `.env` jest w `.gitignore`.

## 4. Po deployu

1. Otwórz publiczny URL i wykonaj próbne wyszukiwanie (np. "brelok").
2. Sprawdź konsolę przeglądarki – nie może być błędów CORS.
3. Jeśli używasz SMTP, spróbuj wysłać przykładowe zamówienie (logi backendu powinny pokazać `Wysłano email z zamówieniem`).
4. Ustaw monitoring (Railway/Render mają wbudowane logi, Fly – `fly logs`).

## 5. FAQ

- **Czy mogę hostować frontend osobno (np. Netlify) i backend gdzie indziej?** Można, ale wtedy musisz dodać obsługę CORS i skonfigurować adresy w `app.js`. Najprościej jest serwować wszystko z jednego miejsca.
- **Czy potrzebuję bazy danych?** Nie – aplikacja tylko proxy-uje API produktów i generuje PDF.
- **Jak ograniczyć koszty?** Utrzymuj projekt na darmowym tierze Railway/Render lub Fly. Wyłącz/usuwaj instancje, gdy nie są potrzebne. Możesz także prowadzić backup `.env` lokalnie zamiast płatnych Secrets Managerów.

To wszystko. Wybierz platformę, która najlepiej pasuje do potrzeb (auto-deploy z GitHuba czy większa kontrola), zawsze pamiętając, by frontend i backend działały pod jednym originem.
