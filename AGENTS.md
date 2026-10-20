# Repository Guidelines

## Zasady krytyczne

- Rozmawiaj z autorem po polsku, prosto, bez żargonu. Autor nie jest programistą.
- W tym repo mieszka tylko silnik. Nie dodawaj treści wpisów, zdjęć, kluczy ani niczego z projektów kanału.
- Nie dodawaj kolorów na sztywno do komponentów i stylów silnika: tylko tokeny CSS (`--ink`, `--bg`, `--accent`, `--line`, `--muted`, `--font-body`, `--font-mono`, `--wrap`).
- Silnik nie zawiera dodatków konkretnego bloga (animacje, warsztaty, odtwarzacze nagrań). Te należą do blogu.
- Nigdy nie używaj `--no-verify` ani `--amend`.

## Układ

- `src/integration.mjs`: integracja Astro (MDX, sitemap, trasy, moduły wirtualne). `src/config.mjs`: walidacja konfiguracji bloga.
- `src/content.ts`: `definePosts` (kolekcja wpisów). `src/lib/`: reguły wpisów, rozdziały, wtyczki markdown.
- `src/components/`, `src/layouts/`, `src/pages/`, `src/styles/core.css`: wygląd i trasy.
- `tests/`: testy jednostkowe (`*.test.mjs`), testy buildu (`build.integration.mjs`) i przykładowa witryna `tests/fixtures/site/`.
- `scripts/cli.mjs`: `blog-silnik verify` (blog) i `verify-engine` (silnik).

## Wydania

Wersje to tagi `vX.Y.Z`. Blogi przypinają wersję w `package.json`. Przed tagiem uruchom `npm run verify`. Pliki `.ts` w `src/` czyta Vite (nie Node), a pliki ładowane przez `astro.config.mjs` muszą być czystym JavaScriptem (`.mjs`).
