# Repository Guidelines

## Zasady krytyczne

- Rozmawiaj z autorem po polsku, prosto, bez żargonu. Autor nie jest programistą.
- W tym repo mieszka tylko silnik. Nie dodawaj treści wpisów, zdjęć, kluczy ani niczego z projektów kanału.
- Nie dodawaj kolorów na sztywno do komponentów i stylów silnika: tylko tokeny CSS (`--ink`, `--bg`, `--accent`, `--line`, `--muted`, `--font-body`, `--font-mono`, `--wrap`).
- Silnik nie zawiera dodatków konkretnego bloga (animacje, warsztaty, odtwarzacze nagrań). Te należą do blogu.
- Nigdy nie używaj `--no-verify` ani `--amend`.

## Układ

- `src/`: integracja Astro, komponenty, reguły wpisów, style (faza 2).
- `tests/`: testy jednostkowe i przykładowa witryna w `tests/fixtures/` (faza 2).
- `scripts/verify.mjs`: testy, build przykładowej witryny, kontrola treści (faza 2).

## Wydania

Wersje to tagi `vX.Y.Z`. Blogi przypinają wersję w `package.json`. Przed tagiem uruchom `npm run verify`.
