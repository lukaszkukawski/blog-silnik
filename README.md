# blog-silnik

Wspólny silnik statycznych blogów na Astro. Instalują go dwa blogi (bezZwarcia i Następny Token), a każdy ma własną grafikę, logo i stronę główną.

## Co jest silnikiem, a co dodatkiem bloga

**Silnik (to repo)** dostarcza to, co jest wspólne:

- wpisy w MDX z jednym schematem i opcjonalnym filmem (`video`): odtwarzacz YouTube (ładowany dopiero po kliknięciu) i spis rozdziałów z minutami,
- listę wpisów, kategorie, stronę wpisu, 404,
- SEO (tytuł, OG, canonical), `sitemap-index.xml` i `rss.xml`,
- reguły wpisów: daty (strefa Europe/Warsaw), unikalne adresy, obrazy tylko z katalogu wpisu, polskie komunikaty błędów,
- tokeny motywu (`core.css`) i polecenie `blog-silnik verify`.

**Blog (osobne repo)** dostarcza to, co go wyróżnia: kolory i czcionki (tokeny w `theme.css`), logo, stronę główną, treść wpisów oraz **dodatki** (np. animacje, warsztaty, odtwarzacze nagrań terminala). Dodatków nie ma w silniku. Dodatek może dodać tylko trasy i komponenty MDX; schemat wpisu zmienia się wyłącznie przez `extendSchema`.

## Instalacja w blogu

Silnik jest publiczny i instalowany z GitHuba, w wersji z tagu:

```
npm install github:lukaszkukawski/blog-silnik#v0.1.2
```

Zmiana wersji w blogu to osobny commit i uruchomienie `npm run verify`.

## Konfiguracja bloga

Jeden plik `site.config.mjs` używany przez `astro.config.mjs` i `src/content.config.ts`:

```js
export default {
	site: 'https://moj-blog.pl',        // wymagane: bez tego build się przerywa
	name: 'Mój blog',                   // wymagane
	tagline: '… ale po ludzku',
	description: 'Opis do wyszukiwarek i RSS.',
	lang: 'pl',
	postsPath: 'blog',                  // adres wpisów: /blog/<slug>/ (np. blog albo odcinki)
	categories: { 'pierwsza': 'Pierwsza kategoria' }, // jedyne źródło prawdy o kategoriach
	extendSchema: ({ z, image }) => ({ numer: z.number().int().optional() }), // pola bloga
	nav: [{ label: 'Wpisy', href: '/blog/' }],
	slots: { logo: './src/components/Logo.astro', footer: './src/components/Footer.astro', afterPost: './src/components/AfterPost.astro' },
	theme: './src/styles/theme.css',    // wartości tokenów
	addons: [{ id: 'pracownia', routes: [{ pattern: '/pracownia', entrypoint: './src/addons/pracownia.astro' }], components: { Lampka: './src/addons/Lampka.astro' } }],
	listPage: true,                     // lista wpisów pod /<postsPath>/
};
```

`astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import blogSilnik from 'blog-silnik';
import config from './site.config.mjs';

export default defineConfig({
	output: 'static',
	trailingSlash: 'always',   // wymagane: bez tego obrazy nie działają w npm run dev
	build: { format: 'directory' },
	integrations: [blogSilnik(config)],
});
```

`src/content.config.ts`:

```ts
import { definePosts } from 'blog-silnik/content';
import config from '../site.config.mjs';

export const collections = definePosts(config, import.meta.url);
```

Integracja dodaje sama MDX, sitemap, RSS oraz trasy: `/<postsPath>/`, `/<postsPath>/<slug>/`, `/kategorie/<id>/`, `/rss.xml`, `/404`. Strona główna jest zawsze własna: korzystaj z `blog-silnik/layouts/Layout.astro`, `blog-silnik/components/PostList.astro` i `getPublishedPosts()` z `blog-silnik/posts`.

Miejsca (`slots`): `logo` (w nagłówku), `footer` (w stopce) i `afterPost` (pod treścią wpisu, dostaje `post`; np. lista warsztatów powiązanych z wpisem).

## Wpis

`src/content/posts/<slug>/index.mdx` (szkice poza buildem: `drafts/<slug>/index.mdx`):

```yaml
---
title: "Tytuł"
description: "Zajawka"
slug: moj-wpis                  # małe litery, cyfry, myślniki
pubDate: "2026-10-20"           # istniejący dzień w cudzysłowie, nie z przyszłości (Europe/Warsaw)
categories: [pierwsza]
cover: ./okladka.png            # opcjonalnie; wymaga coverAlt
coverAlt: "Opis okładki"
video:                          # opcjonalnie
  youtubeId: abc123XYZ09        # po premierze; bez niego: „Premiera wkrótce”
  duration: "5:12"
  chapters:
    - { at: 0, title: "Wstęp" }       # pierwszy rozdział zawsze at: 0
    - { at: 41, title: "Jak to działa" }
---
```

Reguły: schemat jest ścisły (nieznane pole przerywa build); `chapters[].title` musi być równy nagłówkowi `##` we wpisie; sekcje `##` bez rozdziału są w spisie „tylko we wpisie”; obrazy tylko z katalogu wpisu (`![opis](./obraz.png "Podpis")`), surowe `<img>`, `<video>` itp. są zabronione.

## Motyw

`core.css` używa wyłącznie tokenów: `--ink`, `--bg`, `--accent`, `--line`, `--muted`, `--font-body`, `--font-head`, `--font-mono`, `--wrap`. Blog nadpisuje je w `theme.css`.

## Weryfikacja

- W silniku: `npm run verify` (testy jednostkowe, testy buildu ze złymi wpisami, build przykładowej witryny `tests/fixtures/site/`, kontrola linków).
- W blogu: `npx blog-silnik verify` (build, linki wewnętrzne, sitemap i RSS).

## Prywatność

W tym repo nie ma treści wpisów ani żadnych danych autora. Silnik nie czyta nic spoza repo bloga, w którym jest zainstalowany.

## Licencja

MIT.
