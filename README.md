# JuniorStart BG

Готов MVP за Cloudflare Pages + Supabase.

Сайтът няма примерни позиции. Публично се показват само реални обяви със `status = approved`.

## Архитектура

```text
GitHub private repository
        ↓
Cloudflare Pages
        ↓
HTML / CSS / JavaScript
        ↓
Supabase
  ├─ PostgreSQL database
  ├─ Row Level Security
  └─ submit_job RPC
```

### Как работят обявите

```text
Фирма попълва формата
        ↓
Supabase записва status = pending
        ↓
Ти проверяваш обявата
        ↓
сменяш status на approved
        ↓
обявата се показва публично
```

Публичният browser client няма право да задава `approved` или `featured`.

---

# 1. Създай Supabase project

Създай нов проект в Supabase.

След това отвори:

```text
SQL Editor
→ New query
```

Копирай целия файл:

```text
supabase/schema.sql
```

и натисни **Run**.

Това създава:

- `jobs` таблицата;
- RLS;
- публична read policy само за `approved` позиции;
- защитен `submit_job()` RPC за формата.

Няма да бъдат добавени demo/example позиции.

---

# 2. Вземи Supabase URL и Publishable key

В Supabase отвори проекта и намери:

- Project URL
- Publishable key

Можеш да ги намериш от `Connect` или `Settings → API Keys`.

Трябват ти:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

## ВАЖНО

В Cloudflare използвай **Publishable key** (или legacy anon key).

Никога не използвай:

```text
service_role
secret key
```

във frontend или GitHub.

---

# 3. Качи проекта в GitHub

Качи в private repository всички файлове от проекта, включително:

```text
index.html
styles.css
app.js
build.js
package.json
.gitignore
.env.example
supabase/schema.sql
README.md
```

Не качвай `.env`.

---

# 4. Свържи private GitHub repository с Cloudflare Pages

В Cloudflare:

```text
Workers & Pages
→ Create
→ Pages
→ Connect to Git
→ GitHub
```

Избери private repository-то.

## Build settings

Използвай:

```text
Framework preset: None
Build command: npm run build
Build output directory: dist
Root directory: /
```

Production branch:

```text
main
```

---

# 5. Добави Environment Variables в Cloudflare

В Pages project:

```text
Settings
→ Environment variables
```

Добави:

```text
SUPABASE_URL
```

стойност:

```text
https://YOUR_PROJECT.supabase.co
```

и:

```text
SUPABASE_PUBLISHABLE_KEY
```

с твоя Supabase Publishable key.

Добави ги поне за **Production**.

Ако искаш preview deployments да работят със Supabase, добави ги и за **Preview**.

После пусни нов deploy.

`build.js` автоматично създава:

```text
dist/config.js
```

при deploy-а.

`config.js` не се държи в GitHub.

---

# 6. Добавяне на първата реална обява

Има два начина.

## От сайта

Натисни:

```text
Добави обява
```

Попълни формата.

Тя ще се появи в Supabase като:

```text
status = pending
featured = false
```

Няма да е видима публично.

## Ръчно от Supabase

Можеш и директно да добавиш ред в:

```text
Table Editor
→ jobs
```

---

# 7. Одобряване на обява

Отвори:

```text
Supabase
→ Table Editor
→ jobs
```

Намери позицията и промени:

```text
status
```

от:

```text
pending
```

на:

```text
approved
```

След refresh на JuniorStart BG тя ще се появи.

Можеш да използваш:

```text
rejected
```

за отказана позиция или:

```text
expired
```

за изтекла.

---

# 8. Featured обяви

Колоната:

```text
featured
```

е създадена още сега.

Публичната форма винаги записва:

```text
featured = false
```

Само ти можеш да я промениш през Supabase Dashboard.

Така по-късно можеш да направиш платени/маркирани позиции.

---

# 9. Saved jobs

Запазените обяви все още използват:

```text
localStorage
```

Това е правилно за MVP, защото не изисква потребителски акаунти.

По-късно, ако добавиш Supabase Auth, може да се направи таблица `saved_jobs` и списъкът да се синхронизира между устройства.

---

# 10. Файлова структура

```text
JuniorStart-BG/
├─ index.html
├─ styles.css
├─ app.js
├─ build.js
├─ package.json
├─ .gitignore
├─ .env.example
├─ README.md
└─ supabase/
   └─ schema.sql
```

Cloudflare генерира `dist/` по време на build:

```text
dist/
├─ index.html
├─ styles.css
├─ app.js
└─ config.js
```

`dist/` е в `.gitignore`.

---

# 11. Локален build

Ако имаш Node.js:

### PowerShell

```powershell
$env:SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
$env:SUPABASE_PUBLISHABLE_KEY="YOUR_KEY"
npm run build
```

След това файловете за deploy са в:

```text
dist/
```

---

# Следващи добри стъпки

След като MVP-то тръгне:

- админ панел за approve/reject;
- Supabase Auth за компании;
- company profiles;
- Cloudflare Turnstile срещу spam submissions;
- поле Remote / Hybrid / On-site;
- заплата;
- автоматично expiration;
- email notifications;
- analytics;
- собствен `juniorstart.bg` домейн.
