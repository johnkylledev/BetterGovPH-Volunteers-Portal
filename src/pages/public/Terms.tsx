import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronLeft, FileText } from 'lucide-react';

const Terms: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-blue-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link to="/" className="flex items-center gap-2 group">
              <ChevronLeft size={20} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
              <img src="/logo.svg" alt="BetterGovPH Logo" className="h-8 w-auto" />
              <span className="font-display font-bold text-xl tracking-tight text-blue-900">BetterGovPH</span>
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-slate-100"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
              <FileText size={24} />
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-bold">Terms of Service</h1>
          </div>

          <div className="prose prose-slate max-w-none space-y-8">
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-4">1. Acceptance of Terms</h2>
              <p className="text-slate-600 leading-relaxed">
                By applying for and using the BetterGovPH Developer Community Access Card, you agree to comply with and be bound by these Terms of Service. If you do not agree to these terms, you should not apply for the card.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-4">2. Community Standards</h2>
              <p className="text-slate-600 leading-relaxed">
                BetterGovPH is a collaborative, public-interest community. Cardholders are expected to:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2 mt-4">
                <li>Behave professionally and respectfully towards all members.</li>
                <li>Contribute constructively to community projects.</li>
                <li>Adhere to the official BetterGovPH Code of Conduct (available on GitHub).</li>
                <li>Not use the Access Card to misrepresent themselves as government employees.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-4">3. Use of Digital Access Card</h2>
              <p className="text-slate-600 leading-relaxed">
                The BetterGovPH Access Card is a digital-only identification for use within our community ecosystem. It provides verified status for community events, project contributions, and networking. It is NOT an official government ID.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-4">4. Revocation of Status</h2>
              <p className="text-slate-600 leading-relaxed">
                BetterGovPH administrators reserve the right to revoke any Access Card and community membership if a user violates community standards, provides false information during registration, or engages in harmful behavior.
              </p>
            </section>

            <section className="pt-8 border-t border-slate-100">
              <p className="text-sm text-slate-400">
                Last updated: April 26, 2026. Terms are subject to change to reflect the evolution of our community.
              </p>
            </section>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Terms;
