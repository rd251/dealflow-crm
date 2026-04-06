

## Plan: Legg til kilde-dropdown på salgsmuligheter-siden

### Hva skal gjøres
Legge til en kilde-velger i opprettelsesdialogen for salgsmuligheter, slik at bruker kan velge kilde i stedet for at den hardkodes til "Direkte salg". Kildelisten skal matche de nye kildene som allerede er lagt til i leads.

### Endringer i `src/pages/Salgsmuligheter.tsx`

1. **Utvid `form` state** med `kilde`-felt (default: `"Nettside"`)
2. **Legg til kilde-dropdown** i opprettelsesdialogen (mellom rolle/telefon-felter og ansvarlig-dropdown) med alle kilder:
   - Nettside, LinkedIn, Partner, Referanse, Kald outbound, E-post, Telefon, Annet, Organisk, Facebook ads, Instantly kald e-post, Google ads
3. **Bruk `form.kilde`** i `addSm()` i stedet for hardkodet `"Direkte salg"`
4. **Reset `kilde`** i form-reset etter opprettelse

