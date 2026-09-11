import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Home, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../../components/Navbar';

const DISCORD_INVITE = "https://discord.com/invite/mHtThpN8bT";

const sections = [
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

const Privacy: React.FC = () => {
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
            <Shield size={14} className="text-blue-900" />
            <span className="text-[11px] sm:text-xs font-semibold text-slate-600 uppercase tracking-wider">Privacy</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-display font-bold leading-tight tracking-tight mb-3 sm:mb-4">
            Privacy Policy
          </h1>
          <p className="text-xs sm:text-base text-slate-600 max-w-2xl leading-relaxed">
            How we handle your information in the BetterGovPH Community Access Card portal.
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
                  <Users size={14} />
                  Contact on Discord
                </a>
              </div>
            </div>
          </motion.section>
        </div>
      </main>
    </div>
  );
};

export default Privacy;
