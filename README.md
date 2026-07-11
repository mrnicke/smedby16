# Smedby 1:6

Statisk webbplats för Samfällighetsföreningen Smedby 1:6. Fas 1 innehåller publika informationssidor, nyheter, trafikregler, dokumentlänkar och statiska kontakt-/medlemssidor.

## Installera

```bash
npm install
```

## Kör lokalt

```bash
npm run dev
```

## Bygg statisk version

```bash
npm run build
```

Färdiga filer hamnar i `dist/`.

## Manuell uppladdning

1. Kör `npm run build`.
2. Ladda upp innehållet i `dist/` till webbhotellets publika katalog.

## Dokument

Stadgarna ska ligga här:

`public/dokument/stadgar-smedby-samfallighet-1-6-rev-2022-04-25.pdf`

Om filen saknas efter installation behöver PDF:en kopieras manuellt till sökvägen ovan.

## Kända begränsningar i fas 1

- Ingen inloggning.
- Inget riktigt kontaktformulär.
- Ingen databas.
- Dokument kan behöva kompletteras manuellt vid behov.

## Förslag för fas 2

- Enkel admin/nyhetshantering.
- Kontaktformulär.
- Medlemssidor.
- Dokumentarkiv.
- Eventuell MySQL-backend.
