import React from 'react';
import { Link } from 'react-router-dom';
import { LegalPage, LegalSection } from '../../components/site/LegalPage';
import { CONSENT_PURPOSES, CONSENT_VERSION, DPO_CONTACT, PROCESSORS, ROPA_REGISTER } from '../../constants/community';

const Strong: React.FC<{ children: React.ReactNode }> = ({ children }) => <span className="font-medium text-[var(--fg)]">{children}</span>;

const dpoSet = !!(DPO_CONTACT.name || DPO_CONTACT.email);

// Privacy notice under the Data Privacy Act of 2012 (RA 10173), its IRR, and NPC Circulars 16-01, 16-03 and 2023-04.
const sections: LegalSection[] = [
  {
    n: '1',
    title: 'Who is responsible for your data',
    body: (
      <div className="space-y-3">
        <p>
          <Strong>Personal information controller (PIC):</Strong> the BetterGovPH community. We decide why and how volunteer data is
          used, and we are accountable for it under the Data Privacy Act.
        </p>
        <p>
          <Strong>Personal information processors (PIPs):</Strong> the services listed in section 8. They handle data only on our
          instructions, under their data processing terms, and may not use it for their own purposes.
        </p>
        <p>
          <Strong>Data Protection Officer:</Strong>{' '}
          {dpoSet ? (
            <>
              {DPO_CONTACT.name}
              {DPO_CONTACT.name && DPO_CONTACT.email ? ', ' : ''}
              {DPO_CONTACT.email && <a href={`mailto:${DPO_CONTACT.email}`} className="s-link">{DPO_CONTACT.email}</a>}.
            </>
          ) : (
            <>reach the DPO through the admins on the BetterGovPH community Discord.</>
          )}{' '}
          The DPO answers privacy questions, requests and complaints, and is our contact with the National Privacy Commission.
          {DPO_CONTACT.npcRegistration && <> NPC registration: {DPO_CONTACT.npcRegistration}.</>}
        </p>
      </div>
    ),
  },
  {
    n: '2',
    title: 'What we ask you to agree to',
    body: (
      <ul className="mt-1 space-y-2.5">
        {CONSENT_PURPOSES.map((p) => (
          <li key={p.id}>
            <Strong>{p.label}</Strong> ({p.required ? 'required' : 'optional'}): {p.detail}
          </li>
        ))}
      </ul>
    ),
  },
  {
    n: '3',
    title: 'What we keep, why, on what basis, and for how long',
    body: (
      <div className="mt-1 space-y-5">
        {ROPA_REGISTER.map((r) => (
          <div key={r.activity}>
            <p className="font-medium text-[var(--fg)]">{r.activity}</p>
            <dl className="mt-1 grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1 text-[15px]">
              <dt className="text-[var(--fg-3)]">Data</dt><dd>{r.data}</dd>
              <dt className="text-[var(--fg-3)]">Why</dt><dd>{r.purpose}</dd>
              <dt className="text-[var(--fg-3)]">Legal basis</dt><dd>{r.basis}</dd>
              <dt className="text-[var(--fg-3)]">Who sees it</dt><dd>{r.recipients}</dd>
              <dt className="text-[var(--fg-3)]">Kept</dt><dd>{r.retention}</dd>
            </dl>
          </div>
        ))}
      </div>
    ),
  },
  {
    n: '4',
    title: 'Sensitive personal information',
    body: (
      <p>
        We don’t ask for sensitive personal information as defined in Section 3(l) of the Act: no race or ethnic origin, marital status,
        age or birthday, health, religious or political affiliation, government-issued numbers or licences. Please keep it out of
        free-text fields such as call descriptions and join messages. If we ever need any, we will ask for separate, specific consent first.
      </p>
    ),
  },
  {
    n: '5',
    title: 'What the public sees',
    body: (
      <p>
        Public pages (the Volunteers directory, Volunteer Card verification and project team pages) show a shortened name such as
        “Juan D****”, your roles, top skills and member ID. They never show your email, links or Discord username. You can hide yourself
        from the directory or choose to show your full name in <Link to="/profile?tab=privacy" className="s-link">Profile → Privacy</Link>.
      </p>
    ),
  },
  {
    n: '6',
    title: 'Your rights',
    body: (
      <ul className="mt-1 space-y-2.5">
        <li><Strong>To be informed:</Strong> this notice, shown before you agree to anything.</li>
        <li><Strong>Access and data portability:</Strong> download everything we hold about you as one JSON file from <Link to="/profile?tab=privacy" className="s-link">Profile → Privacy</Link>.</li>
        <li><Strong>Correction:</Strong> edit your profile any time. Names on approved cards are changed by an admin on request.</li>
        <li><Strong>Object or withdraw consent:</Strong> switch off optional uses, or withdraw consent entirely, in Profile → Privacy.</li>
        <li><Strong>Erasure or blocking:</Strong> request deletion in Profile → Privacy. You’re hidden from public pages at once, and admins erase your data, usually within 15 days.</li>
        <li><Strong>Damages and complaints:</Strong> contact the DPO first if you can. You may also complain to the National Privacy Commission at privacy.gov.ph.</li>
        <li><Strong>Heirs:</Strong> a member’s lawful heirs and assigns may exercise these rights on the member’s behalf (Section 17).</li>
      </ul>
    ),
  },
  {
    n: '7',
    title: 'How we protect it',
    body: (
      <div className="space-y-3">
        <p>
          <Strong>Organizational:</Strong> only admins see emails and contact details, every admin action is written to an audit log,
          admin rights are re-checked on every request, and volunteers agree to a code of conduct.
        </p>
        <p>
          <Strong>Physical:</Strong> we run no servers of our own. Data lives in Supabase and Vercel data centres, which control physical
          access and are independently audited (SOC 2 Type II).
        </p>
        <p>
          <Strong>Technical:</Strong> encryption in transit (HTTPS) and at rest; row-level security on every table, so the browser
          can’t read the database directly and every request goes through our API, which checks who is asking; rate limits and request
          checks against abuse; and sign-in through Google or GitHub, so we store no passwords.
        </p>
      </div>
    ),
  },
  {
    n: '8',
    title: 'Services that process data for us, and where',
    body: (
      <div className="space-y-3">
        <ul className="space-y-2.5">
          {PROCESSORS.map((p) => (
            <li key={p.name}>
              <Strong>{p.name}</Strong>: {p.role}. {p.data}. Location: {p.location}.
            </li>
          ))}
        </ul>
        <p>
          <Strong>Transfers outside the Philippines.</Strong> Because these services run abroad, your data is stored in Japan and passes
          through the United States. We stay accountable for it wherever it goes (Section 21). Each provider is bound by data processing
          terms covering confidentiality, security, sub-processors and deletion, giving protection comparable to the Act. We don’t sell
          your data or share it with marketers.
        </p>
      </div>
    ),
  },
  {
    n: '9',
    title: 'If something goes wrong',
    body: (
      <p>
        If a personal data breach is likely to put you at real risk, we notify the National Privacy Commission and the affected members
        within 72 hours of finding out (NPC Circular 16-03). The notice says what happened, what data was involved, what we are doing
        about it, and what you can do to protect yourself. We record every incident, including ones that don’t need a notice.
      </p>
    ),
  },
];

const Privacy: React.FC = () => (
  <LegalPage
    title="Privacy notice"
    lede={`How the BetterGovPH Volunteers portal collects, uses and protects your information under the Data Privacy Act of 2012. Notice version ${CONSENT_VERSION}.`}
    updated="November 5, 2026"
    sections={sections}
  />
);

export default Privacy;
