import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronLeft, Shield } from 'lucide-react';

const Privacy: React.FC = () => {
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
              <Shield size={24} />
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-bold">Privacy Policy</h1>
          </div>

          <div className="prose prose-slate max-w-none space-y-8">
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-4">1. Information We Collect</h2>
              <p className="text-slate-600 leading-relaxed">
                When you apply for a BetterGovPH Developer Community Access Card, we collect personal information you provide, including your full name, email address, GitHub username, and professional background. We also verify your membership in our Discord community.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-4">2. How We Use Your Data</h2>
              <p className="text-slate-600 leading-relaxed">
                Your data is used exclusively for:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2 mt-4">
                <li>Verifying your identity within the BetterGovPH community.</li>
                <li>Generating and maintaining your digital access card.</li>
                <li>Communicating updates regarding community projects and events.</li>
                <li>Administering community recognition and contributor badges.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-4">3. Data Security</h2>
              <p className="text-slate-600 leading-relaxed">
                We implement industry-standard security measures, including Supabase's built-in encryption and authentication protocols, to protect your personal data from unauthorized access or disclosure.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-4">4. Third-Party Services</h2>
              <p className="text-slate-600 leading-relaxed">
                We use Discord for community verification and Supabase for data storage. These services have their own privacy policies which we encourage you to review. We do not sell or share your personal data with third-party marketers.
              </p>
            </section>

            <section className="pt-8 border-t border-slate-100">
              <p className="text-sm text-slate-400">
                Last updated: April 26, 2026. For privacy-related inquiries, please reach out to us on our official Discord server.
              </p>
            </section>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Privacy;
