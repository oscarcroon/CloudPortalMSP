# E-postinställningar och arv

Detta dokument beskriver hur kedjan för e-postproviders fungerar och vilka nya fält som kan konfigureras per nivå.

## Arvskedja

Ordningen är alltid **Global → Distributör → Leverantör → Organisation**. I admin- och inställningsvyerna visas nu ett kort med den faktiska kedjan:

- Varje nivå visar om den har en aktiv konfiguration (avsändare, typ av provider, test-status).
- Den nivå som faktiskt används markeras som **Aktiv**. Om en organisation har en egen provider är det den som används, annars faller kedjan tillbaka mot leverantör, distributör och till sist global.

## Nya fält för ämnesprefix och supportkontakt

På samtliga nivåer kan du nu ange:

- **Ämnesprefix** – läggs automatiskt före ämnesraden för alla utskick som använder den nivån. Exempel: `[Portal] Inbjudan`.
- **Supportkontakt** – visas längst ner i mejlet (HTML + text-version). Bra för att tydligt peka på var mottagare hittar hjälp.

Fälten lagras per nivå och följer samma arv som provider-konfigurationen.

## Organisationsspecifik disclaimer

Organisationer kan lägga till en egen disclaimer som alltid placeras längst ner i utskicken, även om själva mejlen skickas via en ärvd provider. Funktionen:

- Stöder Markdown (fet/kursiv, listor, länkar, radbrytningar).
- Renderas och saneras automatiskt så att endast säkra taggar används.
- Syns i både HTML- och textversionen av mejlet.

Disclaimern konfigureras i `Inställningar → E-post` (för org-administratörer) eller via adminpanelen under respektive organisation. Override av själva providern är inte ett krav – disclaimern fungerar även när organisationen ärver leverantörens utskick.

