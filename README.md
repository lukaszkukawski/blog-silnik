# blog-silnik

Wspólny silnik statycznych blogów na Astro. Instalują go dwa blogi (bezZwarcia i Następny Token), a każdy ma własną grafikę, logo i stronę główną.

> Stan: szkielet (faza 1). Kod silnika powstaje w fazie 2 zmiany `wspolny-silnik-blogow`.

## Co jest silnikiem, a co dodatkiem bloga

**Silnik (to repo)** dostarcza to, co jest wspólne:

- wpisy w MDX z jednym schematem i opcjonalnym filmem (`video`: odtwarzacz YouTube i spis rozdziałów),
- listę wpisów, kategorie, stronę wpisu, 404,
- SEO (tytuł, OG, canonical), `sitemap-index.xml` i `rss.xml`,
- reguły wpisów (daty, unikalne adresy, obrazy tylko z katalogu wpisu),
- tokeny motywu i skrypt `verify`.

**Blog (osobne repo)** dostarcza to, co go wyróżnia: kolory i czcionki (tokeny), logo, stronę główną, treść wpisów oraz **dodatki** (np. animacje, warsztaty, odtwarzacze nagrań terminala). Dodatków nie ma w silniku.

## Instalacja w blogu

Silnik jest publiczny i instalowany z GitHuba, w wersji z tagu:

```
npm install github:lukaszkukawski/blog-silnik#v0.1.0
```

Zmiana wersji w blogu to osobny commit i uruchomienie `npm run verify`.

## Prywatność

W tym repo nie ma treści wpisów ani żadnych danych autora. Silnik nie czyta nic spoza repo bloga, w którym jest zainstalowany.

## Licencja

MIT.
