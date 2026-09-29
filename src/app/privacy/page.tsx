// Privacy policy — placeholder based on docs/privacy.md (PROJ-1: AC-30). The legal text comes from a
// lawyer or a reputable generator before the first hosted operation (spec → Out of Scope).
import type { Metadata } from 'next'
import { FormNotice } from '@/components/auth/form-notice'
import { SimplePage } from '@/components/simple-page'

export const metadata: Metadata = { title: 'Datenschutz · Petrilog' }

export default function PrivacyPage() {
  return (
    <SimplePage title="Datenschutz" back={{ href: '/', label: 'Zurück' }}>
      <article className="flex flex-col gap-5 [&_h2]:mt-2 [&_h2]:text-[17px] [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
        <FormNotice tone="info">
          Entwurf: Diese Seite ist ein Platzhalter für die lokale Entwicklungsversion. Der endgültige Text der
          Datenschutzerklärung folgt vor dem ersten öffentlichen Betrieb.
        </FormNotice>

        <h2>Verantwortlicher</h2>
        <p>Noch nicht festgelegt.</p>

        <h2>Welche Daten wir speichern</h2>
        <ul>
          <li>Deine E-Mail-Adresse und dein Passwort (nur verschlüsselt als Hash), um dein Konto zu betreiben.</li>
          <li>Zeitpunkte von Registrierung, Bestätigung und letzter Anmeldung.</li>
          <li>
            Zum Schutz vor Passwort-Raten und Mail-Spam: E-Mail- und IP-Adresse fehlgeschlagener Anmeldeversuche und
            angeforderter Mails. Diese Einträge werden nach spätestens 24 Stunden gelöscht.
          </li>
        </ul>

        <h2>Wozu und auf welcher Grundlage</h2>
        <p>
          Dein Konto brauchen wir, damit du dein Fangbuch nutzen kannst (Vertrag, Art. 6 Abs. 1 lit. b DSGVO). Den
          Schutz vor Missbrauch stützen wir auf unser berechtigtes Interesse an sicheren Konten (Art. 6 Abs. 1 lit. f
          DSGVO).
        </p>

        <h2>Wie lange</h2>
        <p>
          Bis du dein Konto löschst. Nicht bestätigte Konten löschen wir nach 7 Tagen, Einträge zum Missbrauchsschutz
          nach 24 Stunden.
        </p>

        <h2>Deine Rechte</h2>
        <ul>
          <li>Auf der Konto-Seite kannst du alle deine Daten als Datei exportieren.</li>
          <li>Auf der Konto-Seite kannst du dein Konto mit allen Daten sofort und endgültig löschen.</li>
          <li>Anfragen beantworten wir innerhalb von 30 Tagen.</li>
        </ul>

        <h2>Cookies</h2>
        <p>Wir setzen nur die für die Anmeldung technisch notwendigen Cookies. Es gibt kein Tracking und keine Analyse.</p>
      </article>
    </SimplePage>
  )
}
