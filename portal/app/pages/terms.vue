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
      <h1>Terms of Service</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">{{ t('legal.lastUpdated') }}: 2026-02-10</p>

      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing or using Cloud Portal ("the Service"), you agree to be bound by these Terms of Service.
        If you do not agree to these terms, you may not use the Service.
      </p>

      <h2>2. Service Description</h2>
      <p>
        Cloud Portal is a multi-tenant SaaS platform for managing cloud infrastructure resources, including
        but not limited to DNS management, virtual machines, and related services. The Service is provided
        by the organization operating this instance ("the Provider").
      </p>

      <h2>3. Accounts and Access</h2>
      <p>
        You are responsible for maintaining the confidentiality of your account credentials and for all
        activities that occur under your account. You must notify the Provider immediately of any unauthorized
        use of your account or any other breach of security.
      </p>
      <p>
        Access to the Service is granted through your organization. Your organization administrator controls
        your access level, permissions, and the resources available to you.
      </p>

      <h2>4. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for any unlawful purpose or in violation of any applicable laws or regulations.</li>
        <li>Attempt to gain unauthorized access to any part of the Service or its related systems.</li>
        <li>Interfere with or disrupt the integrity or performance of the Service.</li>
        <li>Use automated tools to scrape, crawl, or extract data from the Service without authorization.</li>
        <li>Transmit any viruses, malware, or other harmful code through the Service.</li>
      </ul>

      <h2>5. Intellectual Property</h2>
      <p>
        The Service, including its design, features, and content, is the property of the Provider and is
        protected by applicable intellectual property laws. You are granted a limited, non-exclusive,
        non-transferable license to use the Service in accordance with these terms.
      </p>

      <h2>6. Data</h2>
      <p>
        You retain ownership of all data you submit to the Service. The Provider processes your data solely
        to deliver the Service. For details on how your data is handled, please refer to our
        <NuxtLink to="/privacy" class="text-brand hover:underline">Privacy Policy</NuxtLink>.
      </p>

      <h2>7. Service Level Disclaimer</h2>
      <p>
        The Service is provided "as is" and "as available" without warranties of any kind, whether express
        or implied, including but not limited to implied warranties of merchantability, fitness for a
        particular purpose, and non-infringement. The Provider does not warrant that the Service will be
        uninterrupted, error-free, or secure.
      </p>

      <h2>8. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by applicable law, the Provider shall not be liable for any indirect,
        incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether
        incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses
        resulting from your use of the Service.
      </p>

      <h2>9. Termination</h2>
      <p>
        The Provider may suspend or terminate your access to the Service at any time, with or without cause,
        and with or without notice. Upon termination, your right to use the Service will immediately cease.
        Your organization administrator may also revoke your access at any time.
      </p>

      <h2>10. Changes to These Terms</h2>
      <p>
        The Provider reserves the right to modify these terms at any time. Material changes will be
        communicated through the Service or via email. Your continued use of the Service after changes
        are posted constitutes your acceptance of the revised terms.
      </p>

      <h2>11. Governing Law</h2>
      <p>
        These terms are governed by and construed in accordance with the laws of Sweden. Any disputes
        arising from these terms or your use of the Service shall be subject to the exclusive jurisdiction
        of the Swedish courts.
      </p>

      <h2>12. Contact</h2>
      <p>
        If you have questions about these Terms of Service, please contact your organization administrator
        or the Provider through the contact information provided within the Service.
      </p>
    </article>

    <!-- Swedish -->
    <article v-else class="prose prose-slate dark:prose-invert max-w-none">
      <h1>Anv&auml;ndarvillkor</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">{{ t('legal.lastUpdated') }}: 2026-02-10</p>

      <h2>1. Godk&auml;nnande av villkor</h2>
      <p>
        Genom att anv&auml;nda Cloud Portal ("Tj&auml;nsten") godk&auml;nner du dessa anv&auml;ndarvillkor.
        Om du inte godk&auml;nner villkoren f&aring;r du inte anv&auml;nda Tj&auml;nsten.
      </p>

      <h2>2. Tj&auml;nstebeskrivning</h2>
      <p>
        Cloud Portal &auml;r en SaaS-plattform f&ouml;r hantering av molninfrastrukturresurser, inklusive
        men inte begr&auml;nsat till DNS-hantering, virtuella maskiner och relaterade tj&auml;nster.
        Tj&auml;nsten tillhandah&aring;lls av den organisation som driver denna instans ("Leverant&ouml;ren").
      </p>

      <h2>3. Konton och &aring;tkomst</h2>
      <p>
        Du ansvarar f&ouml;r att h&aring;lla dina kontouppgifter konfidentiella och f&ouml;r all aktivitet
        som sker under ditt konto. Du m&aring;ste omedelbart meddela Leverant&ouml;ren om obeh&ouml;rig
        anv&auml;ndning av ditt konto eller andra s&auml;kerhets&ouml;vertr&auml;delser.
      </p>
      <p>
        &Aring;tkomst till Tj&auml;nsten ges via din organisation. Din organisationsadministrat&ouml;r
        styr din &aring;tkomstniv&aring;, beh&ouml;righeter och de resurser som &auml;r tillg&auml;ngliga f&ouml;r dig.
      </p>

      <h2>4. Anv&auml;ndning</h2>
      <p>Du f&ouml;rbinder dig att inte:</p>
      <ul>
        <li>Anv&auml;nda Tj&auml;nsten f&ouml;r olagliga &auml;ndam&aring;l eller i strid med till&auml;mpliga lagar och regler.</li>
        <li>F&ouml;rs&ouml;ka f&aring; obeh&ouml;rig &aring;tkomst till n&aring;gon del av Tj&auml;nsten eller dess relaterade system.</li>
        <li>St&ouml;ra eller f&ouml;rs&auml;mra Tj&auml;nstens integritet eller prestanda.</li>
        <li>Anv&auml;nda automatiserade verktyg f&ouml;r att samla in data fr&aring;n Tj&auml;nsten utan tillst&aring;nd.</li>
        <li>&Ouml;verf&ouml;ra virus, skadlig kod eller annan skadlig programvara via Tj&auml;nsten.</li>
      </ul>

      <h2>5. Immateriella r&auml;ttigheter</h2>
      <p>
        Tj&auml;nsten, inklusive dess design, funktioner och inneh&aring;ll, tillh&ouml;r Leverant&ouml;ren
        och skyddas av till&auml;mplig immaterialr&auml;ttslagstiftning. Du beviljas en begr&auml;nsad,
        icke-exklusiv, icke-&ouml;verl&aring;tbar licens att anv&auml;nda Tj&auml;nsten i enlighet med dessa villkor.
      </p>

      <h2>6. Data</h2>
      <p>
        Du beh&aring;ller &auml;gander&auml;tten till all data du skickar till Tj&auml;nsten. Leverant&ouml;ren
        behandlar dina uppgifter enbart f&ouml;r att leverera Tj&auml;nsten. F&ouml;r information om hur dina
        uppgifter hanteras, se v&aring;r
        <NuxtLink to="/privacy" class="text-brand hover:underline">Integritetspolicy</NuxtLink>.
      </p>

      <h2>7. Serviceniv&aring;</h2>
      <p>
        Tj&auml;nsten tillhandah&aring;lls "i befintligt skick" utan garantier av n&aring;got slag,
        vare sig uttryckliga eller underf&ouml;rst&aring;dda, inklusive men inte begr&auml;nsat till
        garantier om s&auml;ljbarhet, l&auml;mplighet f&ouml;r ett visst &auml;ndam&aring;l och icke-intr&aring;ng.
        Leverant&ouml;ren garanterar inte att Tj&auml;nsten kommer att vara oavbruten, felfri eller s&auml;ker.
      </p>

      <h2>8. Ansvarsbegr&auml;nsning</h2>
      <p>
        I den m&aring;n till&auml;mplig lag medger ska Leverant&ouml;ren inte vara ansvarig f&ouml;r indirekta,
        of&ouml;rutsedda, speciella skador, f&ouml;ljdskador eller straffskadest&aring;nd, eller f&ouml;rlust av
        vinst eller int&auml;kter, oavsett om de uppst&aring;tt direkt eller indirekt, eller f&ouml;rlust av data,
        anv&auml;ndning, goodwill eller andra immateriella f&ouml;rluster som uppst&aring;r genom din anv&auml;ndning
        av Tj&auml;nsten.
      </p>

      <h2>9. Upps&auml;gning</h2>
      <p>
        Leverant&ouml;ren kan n&auml;r som helst avst&auml;nga eller avsluta din &aring;tkomst till Tj&auml;nsten,
        med eller utan orsak och med eller utan f&ouml;rvarning. Vid avslut upph&ouml;r din r&auml;tt att anv&auml;nda
        Tj&auml;nsten omedelbart. Din organisationsadministrat&ouml;r kan ocks&aring; n&auml;r som helst &aring;terkalla
        din &aring;tkomst.
      </p>

      <h2>10. &Auml;ndringar av villkoren</h2>
      <p>
        Leverant&ouml;ren f&ouml;rbeh&aring;ller sig r&auml;tten att &auml;ndra dessa villkor n&auml;r som helst.
        V&auml;sentliga &auml;ndringar meddelas via Tj&auml;nsten eller e-post. Din fortsatta anv&auml;ndning av
        Tj&auml;nsten efter att &auml;ndringar har publicerats utg&ouml;r ditt godk&auml;nnande av de reviderade villkoren.
      </p>

      <h2>11. Till&auml;mplig lag</h2>
      <p>
        Dessa villkor regleras av och tolkas i enlighet med svensk lag. Eventuella tvister som uppst&aring;r
        fr&aring;n dessa villkor eller din anv&auml;ndning av Tj&auml;nsten ska avg&ouml;ras av svensk domstol.
      </p>

      <h2>12. Kontakt</h2>
      <p>
        Om du har fr&aring;gor om dessa anv&auml;ndarvillkor, kontakta din organisationsadministrat&ouml;r
        eller Leverant&ouml;ren via kontaktinformationen som finns i Tj&auml;nsten.
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
