import React from 'react';
import { LegalPage, LegalSection } from '../../components/site/LegalPage';

const sections: LegalSection[] = [
  {
    n: "1",
    title: "Information We Collect",
    body: (
      <p>
        When you apply for a BetterGovPH Community Access Card, we collect information you provide: full name, email address, Discord username, and professional background. We also verify your membership in our Discord community.
      </p>
    )
  },
  {
    n: "2",
    title: "How We Use Your Data",
    body: (
      <ul className="space-y-2.5 mt-1">
        <li>Verifying your identity within the BetterGovPH community</li>
        <li>Generating and maintaining your digital access card</li>
        <li>Communicating project and event updates</li>
        <li>Administering recognition and contributor badges</li>
      </ul>
    )
  },
  {
    n: "3",
    title: "Data Security",
    body: (
      <p>
        We use industry-standard security measures — including Supabase's built-in encryption and authentication — to protect your personal data from unauthorized access or disclosure.
      </p>
    )
  },
  {
    n: "4",
    title: "Third-Party Services",
    body: (
      <p>
        We use Discord for community verification and Supabase for data storage. These services have their own privacy policies. We do not sell or share your personal data with third-party marketers.
      </p>
    )
  }
];

const Privacy: React.FC = () => (
  <LegalPage
    title="Privacy policy"
    lede="How we collect, use, and protect your information in the BetterGovPH Community Access Card portal."
    updated="April 26, 2026"
    sections={sections}
  />
);

export default Privacy;
