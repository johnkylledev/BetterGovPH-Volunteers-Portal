import React from 'react';
import { Link } from 'react-router-dom';
import { LegalPage, LegalSection } from '../../components/site/LegalPage';
import { CONSENT_PURPOSES, CONSENT_VERSION, ROPA_REGISTER } from '../../constants/community';

// Privacy notice under the Data Privacy Act of 2012 (RA 10173) and NPC Circular 2023-04.
const sections: LegalSection[] = [
  {
    n: '1',
    title: 'Who we are',
    body: (
      <p>
        The BetterGovPH Volunteers portal is run by the BetterGovPH community, the personal information controller for the data
        described here. Questions or requests go to our Data Protection Officer through the community Discord or the admins listed there.
      </p>
    ),
  },
  {
    n: '2',
    title: 'What we ask you to agree to',
    body: (
      <ul className="mt-1 space-y-2.5">
        {CONSENT_PURPOSES.map((p) => (
          <li key={p.id}>
            <span className="font-medium text-[var(--fg)]">{p.label}</span> ({p.required ? 'required' : 'optional'}): {p.detail}
          </li>
        ))}
      </ul>
    ),
  },
  {
    n: '3',
    title: 'What we keep, why, and for how long',
    body: (
      <div className="mt-1 space-y-5">
        {ROPA_REGISTER.map((r) => (
          <div key={r.activity}>
            <p className="font-medium text-[var(--fg)]">{r.activity}</p>
            <dl className="mt-1 grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1 text-[15px]">
              <dt className="text-[var(--fg-3)]">Data</dt><dd>{r.data}</dd>
              <dt className="text-[var(--fg-3)]">Why</dt><dd>{r.purpose}</dd>
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
    n: '5',
    title: 'Your rights',
    body: (
      <ul className="mt-1 space-y-2.5">
        <li><span className="font-medium text-[var(--fg)]">Access and portability:</span> download everything we hold about you from Profile → Privacy.</li>
        <li><span className="font-medium text-[var(--fg)]">Correction:</span> edit your profile any time. Names on approved cards are changed by an admin.</li>
        <li><span className="font-medium text-[var(--fg)]">Object or withdraw consent:</span> switch off optional uses, or withdraw consent entirely.</li>
        <li><span className="font-medium text-[var(--fg)]">Erasure:</span> request deletion from Profile → Privacy; admins complete it, usually within 15 days.</li>
        <li><span className="font-medium text-[var(--fg)]">Complaints:</span> you may file a complaint with the National Privacy Commission (privacy.gov.ph).</li>
      </ul>
    ),
  },
  {
    n: '6',
    title: 'How we protect it',
    body: (
      <p>
        Data is stored in Supabase with row-level security; the browser never reads other members’ records directly, and every request
        goes through our API, which checks who is asking. Only admins see emails. If a breach puts your data at risk, we will notify you and
        the National Privacy Commission within 72 hours of finding out.
      </p>
    ),
  },
  {
    n: '7',
    title: 'Services we use',
    body: (
      <p>
        Google (sign-in), Supabase (database and authentication), Vercel (hosting), Discord (optional community verification) and GitHub
        (public repository statistics for submitted projects). We do not sell or share your data with marketers.
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
