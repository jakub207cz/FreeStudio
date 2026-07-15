# Návod k nasazení rezervační aplikace Free Studio

Tento projekt je navržen tak, aby byl hostován **100% ZDARMA** na platformách **Supabase** a **Vercel**. Následující kroky popisují, jak aplikaci nastavit a spustit.

---

## Krok 1: Nastavení Supabase (Databáze & Autentizace)

1. Jděte na [supabase.com](https://supabase.com) a přihlaste se nebo si vytvořte bezplatný účet.
2. Klikněte na **New Project** a vytvořte nový projekt (např. s názvem `Free Studio`).
3. Zvolte bezpečné heslo pro databázi a region (doporučujeme Frankfurt `eu-central-1` pro rychlou odezvu v ČR).

### Spuštění SQL skriptu
1. V levém menu projektu otevřete **SQL Editor** a klikněte na **New Query**.
2. Vložte následující SQL kód pro vytvoření tabulek a stiskněte **Run**:

```sql
-- 1. Vytvoření tabulky služeb
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    duration_minutes INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Vytvoření tabulky rezervací
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    custom_service_request TEXT,
    client_name VARCHAR(255) NOT NULL,
    client_phone VARCHAR(50) NOT NULL,
    client_notes TEXT,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) DEFAULT 'confirmed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Vytvoření indexu pro rychlé porovnávání časových překryvů
CREATE INDEX idx_bookings_time ON bookings (start_at, end_at);
```

### Vytvoření přihlášení pro Barbaru (Administrátora)
1. V levém menu přejděte do sekce **Authentication** -> **Users**.
2. Klikněte na **Add User** -> **Create User**.
3. Zadejte e-mail (např. `barbora@freestudio.cz`) a silné heslo pro Barbaru a zrušte zaškrtnutí "Auto-confirm user" (případně potvrďte e-mail, pokud je vyžadováno). Tímto vytvoříte administrátorský účet.

---

## Krok 2: Získání API klíčů ze Supabase

V nastavení projektu Supabase (**Project Settings** -> **API**):
1. Zkopírujte hodnotu **Project URL** (bude to `NEXT_PUBLIC_SUPABASE_URL`).
2. Zkopírujte hodnotu **Project API anon key** (bude to `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

---

## Krok 3: Nahrání kódu na GitHub

1. Inicializujte git repozitář ve složce projektu (pokud již není):
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   ```
2. Vytvořte nový repozitář na [GitHubu](https://github.com) (může být soukromý) a propojte ho:
   ```bash
   git remote add origin <ODKAZ_NA_VAS_GITHUB_REPOZITAR>
   git branch -M main
   git push -u origin main
   ```

---

## Krok 4: Nasazení na Vercel (Hosting)

1. Jděte na [vercel.com](https://vercel.com) a přihlaste se pomocí svého GitHub účtu.
2. Klikněte na **Add New...** -> **Project**.
3. Importujte svůj repozitář s projektem Free Studio.
4. Rozbalte sekci **Environment Variables** a přidejte následující 2 proměnné získané v Kroku 2:
   *   Název: `NEXT_PUBLIC_SUPABASE_URL` | Hodnota: *Vložte URL projektu ze Supabase*
   *   Název: `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Hodnota: *Vložte anon klíč ze Supabase*
5. Klikněte na tlačítko **Deploy**.

Vercel během 1-2 minut aplikaci sestaví a vygeneruje veřejnou subdoménu (např. `free-studio.vercel.app`), kterou můžete okamžitě vložit do Instagram bia pro klienty. Administrace bude dostupná na `free-studio.vercel.app/admin`.

---

## Inicializace výchozích služeb v aplikaci

Jakmile aplikaci nasadíte (nebo spustíte lokálně):
1. Přejděte na adresu `/admin` a přihlaste se e-mailem a heslem Barbory (které jste vytvořili v Kroku 1).
2. Aplikace zjistí, že databáze služeb je prázdná, a nabídne vám tlačítko **Nahrát výchozí služby**.
3. Kliknutím na toto tlačítko se automaticky vytvoří základní set služeb pro Barber shop i Tattoo studio. Můžete je pak libovolně upravovat.
