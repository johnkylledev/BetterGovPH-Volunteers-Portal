import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Home, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../../components/Navbar';

const DISCORD_INVITE = "https://discord.com/invite/mHtThpN8bT";

const sections = [
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

const Terms: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-14 sm:pt-32 sm:pb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mb-8 sm:mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-slate-50 border border-slate-200 mb-4 sm:mb-5">
            <FileText size={14} className="text-blue-900" />
            <span className="text-[11px] sm:text-xs font-semibold text-slate-600 uppercase tracking-wider">Terms</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-display font-bold leading-tight tracking-tight mb-3 sm:mb-4">
            Terms of Service
          </h1>
          <p className="text-xs sm:text-base text-slate-600 max-w-2xl leading-relaxed">
            Rules for the BetterGovPH Community Access Card and membership.
          </p>
        </motion.div>

        <div className="space-y-3 sm:space-y-5">
          {sections.map((s, i) => (
            <motion.section
              key={s.n}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06 }}
              className="bg-white rounded-[6px] border border-slate-200 p-4 sm:p-6"
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-8 h-8 rounded-[6px] bg-slate-900 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {s.n}
                </div>
                <div className="min-w-0 flex-grow">
                  <h2 className="text-sm sm:text-lg font-bold text-slate-900 mb-2 sm:mb-2.5 leading-snug">
                    {s.title}
                  </h2>
                  <div className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {s.body}
                  </div>
                </div>
              </div>
            </motion.section>
          ))}

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-slate-50 rounded-[6px] border border-slate-200 p-4 sm:p-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div>
                <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Last updated</p>
                <p className="text-sm font-bold text-slate-800">April 26, 2026</p>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-1">Terms may change as the community evolves.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
                <button
                  onClick={() => navigate('/')}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-[6px] border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 text-xs font-semibold transition-all w-full sm:w-auto"
                >
                  <Home size={14} />
                  Home
                </button>
                <a
                  href={DISCORD_INVITE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-[6px] bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold transition-all w-full sm:w-auto"
                >
                  <MessageSquare size={14} />
                  Join Discord
                </a>
              </div>
            </div>
          </motion.section>
        </div>
      </main>
    </div>
  );
};

export default Terms;
