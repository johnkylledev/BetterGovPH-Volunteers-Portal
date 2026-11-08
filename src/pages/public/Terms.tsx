import React from 'react';
import { Link } from 'react-router-dom';
import { LegalPage, LegalSection } from '../../components/site/LegalPage';
import { DISCORD_INVITE, GITHUB_ORG, MAIN_WEBSITE } from '../../components/site/links';

const Strong: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="font-medium text-[var(--fg)]">{children}</span>
);

/*
 * These terms exist mainly to stop one misreading: that BetterGovPH Volunteers is part of the
 * government, or that being a member confers any standing with it. Section 1 says what we are,
 * section 2 says what membership is not, and section 3 says the same about the Volunteer Card —
 * the three things most likely to be taken the wrong way, said first and in plain words.
 */
const sections: LegalSection[] = [
  {
    n: '1',
    title: 'What BetterGovPH Volunteers is',
    body: (
      <div className="space-y-3">
        <p>
          BetterGovPH is an <Strong>independent, volunteer-run civic technology community</Strong>. We build open-source
          tools that make public information easier to find and read.
        </p>
        <p>
          We are <Strong>not a government agency, office, or contractor</Strong>, and we are not endorsed by, affiliated
          with, or speaking for any government body. Nothing on this site is an official government service, record, or
          announcement, and no part of it should be relied on as one. Where we publish public data, it is a copy or a
          link — the issuing agency remains the source of truth.
        </p>
        <p>
          This portal is where volunteers apply, find work to do, and keep track of what the community has shipped. Using
          it means you accept these terms. If you don’t, please don’t use it.
        </p>
      </div>
    ),
  },
  {
    n: '2',
    title: 'What membership is, and what it is not',
    body: (
      <div className="space-y-3">
        <p>
          Membership means the community has verified who you are and welcomed you in. That is all it means.
        </p>
        <ul className="mt-1 space-y-2.5">
          <li>
            It is <Strong>not employment</Strong>. Volunteers are not employees, agents, contractors or officials of
            BetterGovPH or of any government body, and there is no wage, benefit or engagement of any kind.
          </li>
          <li>
            It gives you <Strong>no authority</Strong> — none over any public office, no standing in any government
            process, and no power to bind BetterGovPH to anything or to act on its behalf.
          </li>
          <li>
            It is <Strong>not an accreditation, licence or clearance</Strong>, and it is not a reference we have checked
            beyond confirming your identity and the details you gave us.
          </li>
        </ul>
      </div>
    ),
  },
  {
    n: '3',
    title: 'The Volunteer Card',
    body: (
      <div className="space-y-3">
        <p>
          The Volunteer Card is a community recognition, shown inside this portal.{' '}
          <Strong>It is not a government ID and not identification of any kind.</Strong> It does not prove authority,
          grant access to anything, and may never be presented to a public office, an officer, or a member of the public
          as though it did.
        </p>
        <p>
          Using it — or the BetterGovPH name, logo or your membership — to suggest you are a government employee, that
          you are acting for a public office, or that BetterGovPH endorses something, is a serious breach of these terms
          and ends your membership.
        </p>
        <p>
          The card is currently <Strong>switched off</Strong> while we take more care over it. Nothing is issued or
          displayed in the meantime, and your membership is unaffected.
        </p>
      </div>
    ),
  },
  {
    n: '4',
    title: 'Speaking as yourself, not for us',
    body: (
      <p>
        Members speak for themselves. Only people the community has asked to do so speak for BetterGovPH — in statements
        to the press, in dealings with public offices, or anywhere the community’s position is being given. Don’t use the
        BetterGovPH name or marks in a way that implies you are one of them, and don’t present your own work, opinions or
        projects as the community’s.
      </p>
    ),
  },
  {
    n: '5',
    title: 'How to behave here',
    body: (
      <div className="space-y-3">
        <p>
          The <Link to="/code-of-conduct" className="s-link">Code of Conduct</Link> applies everywhere the community
          meets, this portal included. In short: be straight with people, keep disagreements about the work, and don’t
          harass anyone.
        </p>
        <ul className="mt-1 space-y-2.5">
          <li>Give accurate details when you apply, and keep them current.</li>
          <li>Hold one membership, in your own name.</li>
          <li>Post only work you have the right to post, and credit the people who helped.</li>
          <li>Leave other people’s data alone — don’t scrape the directory, and don’t use what you find here to contact people for anything they didn’t ask for.</li>
          <li>Don’t try to get at parts of the portal that aren’t yours, or disrupt it for others.</li>
        </ul>
      </div>
    ),
  },
  {
    n: '6',
    title: 'What you contribute',
    body: (
      <div className="space-y-3">
        <p>
          Code and content you contribute to a BetterGovPH project stay yours, and you licence them to the community
          under that project’s open-source licence — the licence in the repository governs, not this page. Our{' '}
          <a href={GITHUB_ORG} target="_blank" rel="noopener noreferrer" className="s-link">repositories are public</a>,
          and so is this portal’s source.
        </p>
        <p>
          Submitting a project here asks us to list it. We may edit the listing for clarity, decline it, or take it down,
          and a listing is not an endorsement or a check of what the project does.
        </p>
      </div>
    ),
  },
  {
    n: '7',
    title: 'Directories and links to other sites',
    body: (
      <p>
        The volunteer directory, the project list and the LGU portal directory point to work run by other people. Those
        sites are theirs: we don’t operate them, vet them, or stand behind what they publish, and an entry here is not an
        endorsement. Several of those directories are community-maintained, so entries can be out of date or wrong — tell
        us and we’ll fix ours.
      </p>
    ),
  },
  {
    n: '8',
    title: 'Your data',
    body: (
      <p>
        What we collect, why, and the rights you have over it are set out in the{' '}
        <Link to="/privacy" className="s-link">Privacy Notice</Link>, written under the Data Privacy Act of 2012 (RA
        10173). You choose what appears publicly, and you can ask for a copy of your data or for your account to be
        erased at any time.
      </p>
    ),
  },
  {
    n: '9',
    title: 'Ending a membership',
    body: (
      <div className="space-y-3">
        <p>
          You can leave whenever you like — ask the admins, or erase your account from your dashboard.
        </p>
        <p>
          We may suspend or remove a membership for a breach of these terms or the Code of Conduct, for details given
          falsely, or for conduct that puts other members or the community at risk. Where it is fair to do so we will say
          why and give you a chance to respond; misrepresenting yourself as government, or using the community’s name to
          mislead, we act on at once.
        </p>
      </div>
    ),
  },
  {
    n: '10',
    title: 'No warranty, and the limit of our responsibility',
    body: (
      <div className="space-y-3">
        <p>
          This portal and everything on it are provided as they are, by volunteers, with no guarantee that information is
          complete, current or accurate, or that the site will be available. Don’t rely on anything here for a legal,
          financial or official purpose — go to the issuing agency.
        </p>
        <p>
          To the extent the law allows, BetterGovPH, its volunteers and its admins are not liable for loss arising from
          your use of the portal or of anything you find through it. Nothing here limits a liability that cannot be
          limited under Philippine law.
        </p>
      </div>
    ),
  },
  {
    n: '11',
    title: 'Changes, and the law that applies',
    body: (
      <div className="space-y-3">
        <p>
          We update these terms as the community changes. The date at the top is when they last changed, and we will say
          so in the community when a change is significant. Carrying on as a member after that means you accept the new
          version.
        </p>
        <p>
          These terms are governed by the laws of the Republic of the Philippines, and disputes belong to the courts of
          the Philippines.
        </p>
      </div>
    ),
  },
  {
    n: '12',
    title: 'Reaching us',
    body: (
      <p>
        Ask the admins on the{' '}
        <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="s-link">community Discord</a>. For
        anything about BetterGovPH itself, see{' '}
        <a href={MAIN_WEBSITE} target="_blank" rel="noopener noreferrer" className="s-link">bettergov.ph</a>. If you see
        someone using a BetterGovPH membership or card to pass themselves off as government, please tell us — that is
        exactly what we want to hear about.
      </p>
    ),
  },
];

const Terms: React.FC = () => (
  <LegalPage
    title="Terms of service"
    lede="BetterGovPH Volunteers is an independent, volunteer-run community — not a government agency. These are the rules for taking part, and the things membership deliberately does not mean."
    updated="November 8, 2026"
    sections={sections}
  />
);

export default Terms;
