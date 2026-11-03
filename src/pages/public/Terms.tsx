import React from 'react';
import { LegalPage, LegalSection } from '../../components/site/LegalPage';

const sections: LegalSection[] = [
  {
    n: "1",
    title: "Acceptance of Terms",
    body: (
      <p>
        By applying for and using the BetterGovPH Community Access Card, you agree to comply with and be bound by these Terms of Service. If you do not agree, you should not apply for the card.
      </p>
    )
  },
  {
    n: "2",
    title: "Community Standards",
    body: (
      <ul className="space-y-2.5 mt-1">
        <li>Behave professionally and respectfully towards all members</li>
        <li>Contribute constructively to community projects</li>
        <li>Follow the BetterGovPH Code of Conduct (on GitHub)</li>
        <li>Never misrepresent yourself as a government employee via the Access Card</li>
      </ul>
    )
  },
  {
    n: "3",
    title: "Use of Access Card",
    body: (
      <p>
        The BetterGovPH Access Card is a digital-only identification for use within our community ecosystem. It grants verified status for events, project contributions, and networking. It is NOT an official government ID.
      </p>
    )
  },
  {
    n: "4",
    title: "Revocation of Status",
    body: (
      <p>
        Administrators reserve the right to revoke any Access Card and community membership if a user violates community standards, provides false information during registration, or engages in harmful behavior.
      </p>
    )
  }
];

const Terms: React.FC = () => (
  <LegalPage
    title="Terms of service"
    lede="The rules for applying for and using a BetterGovPH Community Access Card."
    updated="April 26, 2026"
    sections={sections}
  />
);

export default Terms;
