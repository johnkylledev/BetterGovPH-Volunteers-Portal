import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronDown, Check, MessageSquare } from 'lucide-react';
import clsx from 'clsx';

const SPECIALIZATIONS = ['Developer', 'Designer', 'Researcher', 'Contributor', 'Volunteer', 'Other'];
const ROLES = ['Member', 'Fellow', 'Contributor', 'Other'];

export default function Register() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    discordUsername: '',
    specialization: 'Developer',
    customSpecialization: '',
    role: 'Member',
    customRole: '',
    yearJoined: new Date().getFullYear(),
  });
  const [isYearOpen, setIsYearOpen] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const register = useStore((state) => state.register);
  const currentUser = useStore((state) => state.currentUser);
  const navigate = useNavigate();
  const { authInitialized } = useStore();

  useEffect(() => {
    if (authInitialized && currentUser && currentUser.discordUsername && currentUser.specialization) {
      if (currentUser.isAdmin) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    }
  }, [currentUser, authInitialized, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const spec = formData.specialization === 'Other' ? formData.customSpecialization : formData.specialization;
    const rl = formData.role === 'Other' ? formData.customRole : formData.role;

    if (!spec || !rl) {
      setError('Please provide specialization and role details.');
      setLoading(false);
      return;
    }

    // Password validation
    const pass = formData.password;
    const hasLower = /[a-z]/.test(pass);
    const hasUpper = /[A-Z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pass);

    if (pass.length < 8) {
      setError('Password must be at least 8 characters long.');
      setLoading(false);
      return;
    }
    if (!hasLower || !hasUpper || !hasNumber || !hasSpecial) {
      setError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.');
      setLoading(false);
      return;
    }

    try {
      const res = await register({
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        discordUsername: formData.discordUsername,
        specialization: spec,
        role: rl,
        yearJoined: Number(formData.yearJoined),
        authProvider: 'traditional',
      });

      if (res.success) {
        navigate('/dashboard');
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-6 sm:py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-blue-900/20">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sm:mx-auto sm:w-full sm:max-w-xl flex flex-col items-center"
      >
        <div className="w-12 h-12 flex items-center justify-center mb-4">
          <img src="/logo.svg" alt="BetterGovPH Logo" className="w-full h-full object-contain" />
        </div>
        <h2 className="mt-2 text-center text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-display">
          Apply for Access
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          Join BetterGovPH community portal
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl"
      >
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-xl sm:px-10 border sm:border-slate-100">
          <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm shrink-0">
              <MessageSquare size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-1">Discord Community Required</p>
              <p className="text-xs text-blue-700 leading-relaxed">
                You must be part of the Discord community to get approved.
                <a href="https://discord.com/invite/mHtThpN8bT" target="_blank" rel="noopener noreferrer" className="ml-1 font-bold underline hover:text-blue-800 transition-colors">
                  Join here: https://discord.com/invite/mHtThpN8bT
                </a>
              </p>
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium border border-red-100">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
                <input
                  name="fullName"
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={handleChange}
                  className="block w-full appearance-none rounded-lg border border-slate-200 px-4 py-3 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 sm:text-sm transition-all"
                  placeholder="Juan Dela Cruz"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
                <input
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="block w-full appearance-none rounded-lg border border-slate-200 px-4 py-3 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 sm:text-sm transition-all"
                  placeholder="juan@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
                <input
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full appearance-none rounded-lg border border-slate-200 px-4 py-3 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 sm:text-sm transition-all"
                  placeholder="••••••••"
                />
                <p className="mt-1.5 text-[10px] text-slate-400 leading-relaxed">
                  Min. 8 chars with uppercase, lowercase, number, and special character.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Discord Username</label>
                <input
                  name="discordUsername"
                  type="text"
                  required
                  value={formData.discordUsername}
                  onChange={handleChange}
                  className="block w-full appearance-none rounded-lg border border-slate-200 px-4 py-3 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 sm:text-sm transition-all"
                  placeholder="juan_dev#1234"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Specialization</label>
                <select
                  name="specialization"
                  value={formData.specialization}
                  onChange={handleChange}
                  className="block w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 text-base sm:text-sm transition-all bg-white"
                >
                  {SPECIALIZATIONS.map((spec) => (
                    <option key={spec} value={spec}>{spec}</option>
                  ))}
                </select>
                {formData.specialization === 'Other' && (
                  <input
                    name="customSpecialization"
                    type="text"
                    required
                    value={formData.customSpecialization}
                    onChange={handleChange}
                    className="mt-3 block w-full appearance-none rounded-lg border border-slate-200 px-4 py-3 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 text-base sm:text-sm transition-all"
                    placeholder="Specify specialization..."
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Role Request</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="block w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 text-base sm:text-sm transition-all bg-white"
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
                {formData.role === 'Other' && (
                  <input
                    name="customRole"
                    type="text"
                    required
                    value={formData.customRole}
                    onChange={handleChange}
                    className="mt-3 block w-full appearance-none rounded-lg border border-slate-200 px-4 py-3 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 text-base sm:text-sm transition-all"
                    placeholder="Specify role..."
                  />
                )}
              </div>
            </div>

            <div className="space-y-2 relative">
              <label className="block text-sm font-semibold text-slate-700 ml-1">Member Since</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsYearOpen(!isYearOpen)}
                  className={clsx(
                    "relative w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-500/10",
                    isYearOpen ? "border-blue-500 ring-4 ring-blue-500/10 bg-white" : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-semibold text-slate-900">{formData.yearJoined}</span>
                  </div>
                  <ChevronDown className={clsx("w-4 h-4 text-slate-400 transition-transform duration-200", isYearOpen && "rotate-180")} />
                </button>

                <AnimatePresence>
                  {isYearOpen && (
                    <>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsYearOpen(false)}
                        className="fixed inset-0 z-10"
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute left-0 right-0 mt-2 z-20 bg-white border border-slate-100 rounded-xl shadow-xl shadow-blue-900/10 overflow-hidden max-h-[240px] overflow-y-auto no-scrollbar"
                      >
                        <div className="p-2 grid grid-cols-1 gap-1">
                          {Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                            <button
                              key={year}
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, yearJoined: year });
                                setIsYearOpen(false);
                              }}
                              className={clsx(
                                "flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-semibold transition-colors",
                                formData.yearJoined === year
                                  ? "bg-blue-50 text-blue-900"
                                  : "text-slate-600 hover:bg-slate-50"
                              )}
                            >
                              <span>{year}</span>
                              {formData.yearJoined === year && <Check className="w-4 h-4 text-blue-600" />}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
              <p className="ml-1 text-[10px] text-slate-400 leading-relaxed">
                Choose the year you officially became a part of the community.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-lg bg-blue-900 px-4 py-3.5 text-sm font-semibold text-white shadow-md hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-900/20 transition-all disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              Already registered?{' '}
              <Link to="/login" className="font-semibold text-blue-900 hover:text-blue-700">
                Log in here
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
