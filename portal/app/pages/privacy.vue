<template>
  <div>
    <NuxtLink
      to="/login"
      class="mb-6 inline-flex items-center gap-1 text-sm text-slate-500 underline-offset-4 transition hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-white"
    >
      &larr; {{ t('legal.backToLogin') }}
    </NuxtLink>

    <!-- English -->
    <article v-if="locale === 'en'" class="prose prose-slate dark:prose-invert max-w-none">
      <h1>Privacy Policy</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">{{ t('legal.lastUpdated') }}: 2026-02-10</p>

      <h2>1. Introduction</h2>
      <p>
        This Privacy Policy describes how your personal data is collected, used, and shared when you use
        Cloud Portal ("the Service"). We are committed to protecting your privacy and processing your
        data in accordance with the General Data Protection Regulation (GDPR) and other applicable
        data protection laws.
      </p>

      <h2>2. Data Controller</h2>
      <p>
        The data controller for the processing of your personal data is the organization operating this
        instance of Cloud Portal ("the Provider"). For contact details, please refer to the information
        provided within the Service or contact your organization administrator.
      </p>

      <h2>3. Data We Collect</h2>
      <p>We collect and process the following categories of personal data:</p>
      <ul>
        <li><strong>Account information:</strong> Name, email address, and organizational role.</li>
        <li><strong>Authentication data:</strong> Hashed passwords, MFA enrollment status, and SSO identifiers.</li>
        <li><strong>Usage data:</strong> Login timestamps, IP addresses, and actions performed within the Service.</li>
        <li><strong>Technical data:</strong> Browser type, device information, and session identifiers.</li>
      </ul>

      <h2>4. How We Use Your Data</h2>
      <p>Your personal data is processed for the following purposes:</p>
      <ul>
        <li>Providing and maintaining the Service, including user authentication and access control.</li>
        <li>Managing your organizational membership and permissions.</li>
        <li>Ensuring the security of the Service through audit logging and monitoring.</li>
        <li>Communicating with you about the Service, including security notifications.</li>
        <li>Complying with legal obligations.</li>
      </ul>

      <h2>5. Legal Basis for Processing (Art. 6 GDPR)</h2>
      <p>We process your personal data on the following legal bases:</p>
      <ul>
        <li><strong>Contract performance (Art. 6(1)(b)):</strong> Processing necessary to provide the Service you have access to through your organization.</li>
        <li><strong>Legitimate interests (Art. 6(1)(f)):</strong> Security monitoring, audit logging, and service improvement.</li>
        <li><strong>Legal obligation (Art. 6(1)(c)):</strong> Where we are required by law to retain or process certain data.</li>
        <li><strong>Consent (Art. 6(1)(a)):</strong> Where applicable, for optional features that require your explicit consent.</li>
      </ul>

      <h2>6. Third Parties</h2>
      <p>
        We may share your data with the following categories of third parties, solely to the extent
        necessary to provide the Service:
      </p>
      <ul>
        <li><strong>Infrastructure providers:</strong> Cloud hosting and DNS providers used to deliver the Service.</li>
        <li><strong>Identity providers:</strong> SSO/SAML providers configured by your organization for authentication.</li>
      </ul>
      <p>
        We do not sell your personal data. We do not share your data with third parties for advertising
        or marketing purposes.
      </p>

      <h2>7. Data Retention</h2>
      <p>
        Your personal data is retained for as long as your account is active and for a reasonable period
        thereafter to comply with legal obligations, resolve disputes, and enforce agreements. Audit logs
        are retained according to the Provider's data retention policy. When your account is deleted,
        your personal data will be removed or anonymized within a reasonable timeframe.
      </p>

      <h2>8. Your Rights</h2>
      <p>Under the GDPR, you have the following rights regarding your personal data:</p>
      <ul>
        <li><strong>Right of access (Art. 15):</strong> You have the right to request a copy of the personal data we hold about you.</li>
        <li><strong>Right to rectification (Art. 16):</strong> You have the right to request correction of inaccurate personal data.</li>
        <li><strong>Right to erasure (Art. 17):</strong> You have the right to request deletion of your personal data, subject to legal retention requirements.</li>
        <li><strong>Right to data portability (Art. 20):</strong> You have the right to receive your personal data in a structured, commonly used, machine-readable format.</li>
        <li><strong>Right to restrict processing (Art. 18):</strong> You have the right to request restriction of processing in certain circumstances.</li>
        <li><strong>Right to object (Art. 21):</strong> You have the right to object to processing based on legitimate interests.</li>
      </ul>
      <p>
        To exercise any of these rights, contact your organization administrator or the Provider.
        You also have the right to lodge a complaint with a supervisory authority, such as the
        Swedish Authority for Privacy Protection (IMY).
      </p>

      <h2>9. Cookies and Local Storage</h2>
      <p>The Service uses the following cookies, all of which are strictly necessary for operation:</p>
      <ul>
        <li><strong>Session cookie (JWT):</strong> An HTTP-only, secure cookie containing your authentication token. This cookie is essential for keeping you logged in and is not accessible to JavaScript.</li>
        <li><strong>CSRF cookie:</strong> A cookie used to protect against cross-site request forgery attacks. It is set on login and validated on state-changing requests.</li>
        <li><strong>Color mode preference:</strong> A cookie storing your light/dark theme preference for a consistent visual experience.</li>
      </ul>
      <p>
        The Service does not use any third-party tracking cookies, analytics cookies, or advertising cookies.
        No data is shared with third-party advertising or analytics platforms through cookies.
      </p>

      <h2>10. Security</h2>
      <p>
        We implement appropriate technical and organizational measures to protect your personal data,
        including encryption of data in transit (TLS), secure password hashing, multi-factor authentication
        support, role-based access control, and regular security reviews.
      </p>

      <h2>11. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material changes will be communicated through
        the Service or via email. Your continued use of the Service after changes are posted constitutes
        your acceptance of the revised policy.
      </p>

      <h2>12. Contact</h2>
      <p>
        If you have questions about this Privacy Policy or wish to exercise your data protection rights,
        please contact your organization administrator or the Provider through the contact information
        provided within the Service.
      </p>
    </article>

    <!-- Swedish -->
    <article v-else class="prose prose-slate dark:prose-invert max-w-none">
      <h1>Integritetspolicy</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">{{ t('legal.lastUpdated') }}: 2026-02-10</p>

      <h2>1. Introduktion</h2>
      <p>
        Denna integritetspolicy beskriver hur dina personuppgifter samlas in, anv&auml;nds och delas
        n&auml;r du anv&auml;nder Cloud Portal ("Tj&auml;nsten"). Vi &auml;r engagerade i att skydda din
        integritet och behandla dina uppgifter i enlighet med dataskyddsf&ouml;rordningen (GDPR) och
        andra till&auml;mpliga dataskyddslagar.
      </p>

      <h2>2. Personuppgiftsansvarig</h2>
      <p>
        Personuppgiftsansvarig f&ouml;r behandlingen av dina personuppgifter &auml;r den organisation
        som driver denna instans av Cloud Portal ("Leverant&ouml;ren"). F&ouml;r kontaktuppgifter,
        se informationen i Tj&auml;nsten eller kontakta din organisationsadministrat&ouml;r.
      </p>

      <h2>3. Uppgifter vi samlar in</h2>
      <p>Vi samlar in och behandlar f&ouml;ljande kategorier av personuppgifter:</p>
      <ul>
        <li><strong>Kontoinformation:</strong> Namn, e-postadress och organisationsroll.</li>
        <li><strong>Autentiseringsdata:</strong> Hashade l&ouml;senord, MFA-status och SSO-identifierare.</li>
        <li><strong>Anv&auml;ndningsdata:</strong> Inloggningstider, IP-adresser och &aring;tg&auml;rder utf&ouml;rda i Tj&auml;nsten.</li>
        <li><strong>Teknisk data:</strong> Webbl&auml;sartyp, enhetsinformation och sessionsidentifierare.</li>
      </ul>

      <h2>4. Hur vi anv&auml;nder dina uppgifter</h2>
      <p>Dina personuppgifter behandlas f&ouml;r f&ouml;ljande &auml;ndam&aring;l:</p>
      <ul>
        <li>Tillhandah&aring;lla och underh&aring;lla Tj&auml;nsten, inklusive autentisering och &aring;tkomstkontroll.</li>
        <li>Hantera ditt organisationsmedlemskap och beh&ouml;righeter.</li>
        <li>S&auml;kerst&auml;lla Tj&auml;nstens s&auml;kerhet genom revisionsloggning och &ouml;vervakning.</li>
        <li>Kommunicera med dig om Tj&auml;nsten, inklusive s&auml;kerhetsmeddelanden.</li>
        <li>Uppfylla lagliga skyldigheter.</li>
      </ul>

      <h2>5. R&auml;ttslig grund f&ouml;r behandling (Art. 6 GDPR)</h2>
      <p>Vi behandlar dina personuppgifter p&aring; f&ouml;ljande r&auml;ttsliga grunder:</p>
      <ul>
        <li><strong>Fullg&ouml;rande av avtal (Art. 6(1)(b)):</strong> Behandling som &auml;r n&ouml;dv&auml;ndig f&ouml;r att tillhandah&aring;lla Tj&auml;nsten som du har tillg&aring;ng till via din organisation.</li>
        <li><strong>Ber&auml;ttigat intresse (Art. 6(1)(f)):</strong> S&auml;kerhets&ouml;vervakning, revisionsloggning och f&ouml;rb&auml;ttring av Tj&auml;nsten.</li>
        <li><strong>R&auml;ttslig f&ouml;rpliktelse (Art. 6(1)(c)):</strong> D&auml;r vi enligt lag &auml;r skyldiga att bevara eller behandla vissa uppgifter.</li>
        <li><strong>Samtycke (Art. 6(1)(a)):</strong> D&auml;r det &auml;r till&auml;mpligt, f&ouml;r valfria funktioner som kr&auml;ver ditt uttryckliga samtycke.</li>
      </ul>

      <h2>6. Tredje parter</h2>
      <p>
        Vi kan dela dina uppgifter med f&ouml;ljande kategorier av tredje parter, enbart i den
        utstr&auml;ckning som &auml;r n&ouml;dv&auml;ndig f&ouml;r att tillhandah&aring;lla Tj&auml;nsten:
      </p>
      <ul>
        <li><strong>Infrastrukturleverant&ouml;rer:</strong> Molnhosting- och DNS-leverant&ouml;rer som anv&auml;nds f&ouml;r att leverera Tj&auml;nsten.</li>
        <li><strong>Identitetsleverant&ouml;rer:</strong> SSO/SAML-leverant&ouml;rer som konfigurerats av din organisation f&ouml;r autentisering.</li>
      </ul>
      <p>
        Vi s&auml;ljer inte dina personuppgifter. Vi delar inte dina uppgifter med tredje parter
        f&ouml;r reklam- eller marknadsf&ouml;rings&auml;ndam&aring;l.
      </p>

      <h2>7. Lagring av uppgifter</h2>
      <p>
        Dina personuppgifter lagras s&aring; l&auml;nge ditt konto &auml;r aktivt och under en rimlig
        period d&auml;refter f&ouml;r att uppfylla lagliga skyldigheter, l&ouml;sa tvister och genomdriva
        avtal. Revisionsloggar lagras enligt Leverant&ouml;rens policy f&ouml;r datalagring. N&auml;r ditt
        konto raderas kommer dina personuppgifter att tas bort eller anonymiseras inom en rimlig tidsram.
      </p>

      <h2>8. Dina r&auml;ttigheter</h2>
      <p>Enligt GDPR har du f&ouml;ljande r&auml;ttigheter avseende dina personuppgifter:</p>
      <ul>
        <li><strong>R&auml;tt till tillg&aring;ng (Art. 15):</strong> Du har r&auml;tt att beg&auml;ra en kopia av de personuppgifter vi har om dig.</li>
        <li><strong>R&auml;tt till r&auml;ttelse (Art. 16):</strong> Du har r&auml;tt att beg&auml;ra r&auml;ttelse av felaktiga personuppgifter.</li>
        <li><strong>R&auml;tt till radering (Art. 17):</strong> Du har r&auml;tt att beg&auml;ra radering av dina personuppgifter, med f&ouml;rbeh&aring;ll f&ouml;r lagliga lagringskrav.</li>
        <li><strong>R&auml;tt till dataportabilitet (Art. 20):</strong> Du har r&auml;tt att f&aring; dina personuppgifter i ett strukturerat, allm&auml;nt anv&auml;nt, maskinl&auml;sbart format.</li>
        <li><strong>R&auml;tt till begr&auml;nsning (Art. 18):</strong> Du har r&auml;tt att beg&auml;ra begr&auml;nsning av behandlingen under vissa omst&auml;ndigheter.</li>
        <li><strong>R&auml;tt att g&ouml;ra inv&auml;ndningar (Art. 21):</strong> Du har r&auml;tt att inv&auml;nda mot behandling som grundas p&aring; ber&auml;ttigat intresse.</li>
      </ul>
      <p>
        F&ouml;r att ut&ouml;va n&aring;gon av dessa r&auml;ttigheter, kontakta din organisationsadministrat&ouml;r
        eller Leverant&ouml;ren. Du har ocks&aring; r&auml;tt att l&auml;mna in ett klagom&aring;l till en
        tillsynsmyndighet, s&aring;som Integritetsskyddsmyndigheten (IMY).
      </p>

      <h2>9. Cookies och lokal lagring</h2>
      <p>Tj&auml;nsten anv&auml;nder f&ouml;ljande cookies, vilka alla &auml;r strikt n&ouml;dv&auml;ndiga f&ouml;r drift:</p>
      <ul>
        <li><strong>Sessionscookie (JWT):</strong> En HTTP-only, s&auml;ker cookie som inneh&aring;ller din autentiseringstoken. Denna cookie &auml;r n&ouml;dv&auml;ndig f&ouml;r att h&aring;lla dig inloggad och &auml;r inte tillg&auml;nglig f&ouml;r JavaScript.</li>
        <li><strong>CSRF-cookie:</strong> En cookie som skyddar mot cross-site request forgery-attacker. Den s&auml;tts vid inloggning och valideras vid tillst&aring;nds&auml;ndrande f&ouml;rfr&aring;gningar.</li>
        <li><strong>F&auml;rgtema:</strong> En cookie som lagrar din preferens f&ouml;r ljust/m&ouml;rkt tema f&ouml;r en konsekvent visuell upplevelse.</li>
      </ul>
      <p>
        Tj&auml;nsten anv&auml;nder inga tredjepartscookies f&ouml;r sp&aring;rning, analys eller reklam.
        Ingen data delas med tredjepartsplattformar f&ouml;r reklam eller analys via cookies.
      </p>

      <h2>10. S&auml;kerhet</h2>
      <p>
        Vi vidtar l&auml;mpliga tekniska och organisatoriska &aring;tg&auml;rder f&ouml;r att skydda
        dina personuppgifter, inklusive kryptering av data under &ouml;verf&ouml;ring (TLS), s&auml;ker
        l&ouml;senordshashning, st&ouml;d f&ouml;r multifaktorautentisering, rollbaserad &aring;tkomstkontroll
        och regelbundna s&auml;kerhetsgranskningar.
      </p>

      <h2>11. &Auml;ndringar av denna policy</h2>
      <p>
        Vi kan uppdatera denna integritetspolicy fr&aring;n tid till annan. V&auml;sentliga &auml;ndringar
        meddelas via Tj&auml;nsten eller e-post. Din fortsatta anv&auml;ndning av Tj&auml;nsten efter att
        &auml;ndringar har publicerats utg&ouml;r ditt godk&auml;nnande av den reviderade policyn.
      </p>

      <h2>12. Kontakt</h2>
      <p>
        Om du har fr&aring;gor om denna integritetspolicy eller vill ut&ouml;va dina dataskyddsr&auml;ttigheter,
        kontakta din organisationsadministrat&ouml;r eller Leverant&ouml;ren via kontaktinformationen som
        finns i Tj&auml;nsten.
      </p>
    </article>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'legal',
  public: true
})

const { t, locale } = useI18n()
</script>
