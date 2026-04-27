import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronDown, Check, MessageSquare, Home, ArrowRight, ArrowLeft, User, Mail, Lock, Briefcase, Users, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

const SPECIALIZATIONS = ['Developer', 'Designer', 'Researcher', 'Contributor', 'Volunteer', 'Other'];
const ROLES = ['Member', 'Fellow', 'Contributor', 'Other'];

type Step = 1 | 2 | 3;

export default function Register() {
  const [currentStep, setCurrentStep] = useState<Step>(1);
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
    if (authInitialized && currentUser) {
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

  const validateStep = (step: Step) => {
    setError('');
    if (step === 1) {
      if (!formData.fullName || !formData.email || !formData.password) {
        setError('Please fill in all required fields.');
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        setError('Please enter a valid email address.');
        return false;
      }
      
      const pass = formData.password;
      const hasLower = /[a-z]/.test(pass);
      const hasUpper = /[A-Z]/.test(pass);
      const hasNumber = /[0-9]/.test(pass);
      const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pass);

      if (pass.length < 8) {
        setError('Password must be at least 8 characters long.');
        return false;
      }
      if (!hasLower || !hasUpper || !hasNumber || !hasSpecial) {
        setError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.');
        return false;
      }
    } else if (step === 2) {
      if (!formData.discordUsername) {
        setError('Discord username is required.');
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => (prev + 1) as Step);
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => (prev - 1) as Step);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(3)) return;
    
    setError('');
    setLoading(true);

    const spec = formData.specialization === 'Other' ? formData.customSpecialization : formData.specialization;
    const rl = formData.role === 'Other' ? formData.customRole : formData.role;

    if (!spec || !rl) {
      setError('Please provide specialization and role details.');
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

  const steps = [
    { id: 1, name: 'Account', icon: <User size={18} /> },
    { id: 2, name: 'Community', icon: <Users size={18} /> },
    { id: 3, name: 'Role', icon: <Briefcase size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-blue-900/20 relative">
      <Link
        to="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-slate-500 hover:text-blue-900 transition-colors text-sm font-semibold group"
      >
        <Home className="w-4 h-4" />
        <span>Home</span>
      </Link>

      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center mb-8"
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center mb-4 sm:mb-6">
            <img src="/logo.svg" alt="BetterGovPH Logo" className="w-full h-full object-contain" />
          </div>
          <h2 className="mt-2 text-center text-xl sm:text-3xl font-bold tracking-tight text-slate-900 font-display leading-tight sm:leading-normal">
            BetterGovPH Dev Community
          </h2>
          <p className="mt-2 text-center text-sm text-slate-500">
            Apply for access to the portal
          </p>
        </motion.div>

        {/* Stepper */}
        <div className="mb-8 px-4 max-w-md mx-auto">
          <div className="flex items-center justify-between relative">
            {/* Background Line */}
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -translate-y-1/2 -z-10" />
            {/* Progress Line */}
            <motion.div 
              className="absolute top-1/2 left-0 h-0.5 bg-blue-900 -translate-y-1/2 -z-10 transition-all duration-500"
              initial={{ width: '0%' }}
              animate={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
            />
            
            {steps.map((step) => (
              <div key={step.id} className="flex flex-col items-center">
                <motion.div
                  initial={false}
                  animate={{
                    backgroundColor: currentStep >= step.id ? '#1e3a8a' : 'rgb(255, 255, 255)',
                    borderColor: currentStep >= step.id ? '#1e3a8a' : 'rgb(226, 232, 240)',
                    color: currentStep >= step.id ? 'rgb(255, 255, 255)' : 'rgb(100, 116, 139)',
                  }}
                  className={clsx(
                    "w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold transition-colors duration-300 relative",
                    currentStep === step.id && "ring-4 ring-blue-900/10 shadow-lg"
                  )}
                >
                  {currentStep > step.id ? <Check size={18} /> : step.icon}
                  
                  {/* Step Label */}
                  <span className={clsx(
                    "absolute -bottom-7 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors duration-300",
                    currentStep >= step.id ? "text-blue-900" : "text-slate-400"
                  )}>
                    {step.name}
                  </span>
                </motion.div>
              </div>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-12"
        >
          <div className="bg-white py-8 px-4 shadow-sm sm:rounded-lg sm:px-10 border sm:border-slate-100 relative">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-100 flex items-start gap-3 mb-6"
                >
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
              <AnimatePresence mode="wait">
                {currentStep === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-5 sm:space-y-6"
                  >
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-900 transition-colors">
                          <User size={18} />
                        </div>
                        <input
                          name="fullName"
                          type="text"
                          required
                          value={formData.fullName}
                          onChange={handleChange}
                          className="block w-full appearance-none rounded-lg border border-slate-200 px-4 py-3 pl-11 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 text-base sm:text-sm transition-all"
                          placeholder="Juan Dela Cruz"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-900 transition-colors">
                          <Mail size={18} />
                        </div>
                        <input
                          name="email"
                          type="email"
                          required
                          value={formData.email}
                          onChange={handleChange}
                          className="block w-full appearance-none rounded-lg border border-slate-200 px-4 py-3 pl-11 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 text-base sm:text-sm transition-all"
                          placeholder="juan@example.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-900 transition-colors">
                          <Lock size={18} />
                        </div>
                        <input
                          name="password"
                          type="password"
                          required
                          value={formData.password}
                          onChange={handleChange}
                          className="block w-full appearance-none rounded-lg border border-slate-200 px-4 py-3 pl-11 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 text-base sm:text-sm transition-all"
                          placeholder="••••••••"
                        />
                      </div>
                      <p className="mt-2 text-[10px] text-slate-400 leading-relaxed font-medium">
                        Min. 8 chars with uppercase, lowercase, number, and special character.
                      </p>
                    </div>
                  </motion.div>
                )}

                {currentStep === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-5 sm:space-y-6"
                  >
                    <div className="p-4 rounded-lg bg-blue-50 border border-blue-100 flex items-start gap-3">
                      <div className="shrink-0 pt-0.5">
                        <MessageSquare size={18} className="text-blue-900" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-blue-900 mb-1">Discord Required</p>
                        <p className="text-xs text-blue-700 leading-relaxed">
                          You must be in our Discord server for approval.
                          <a href="https://discord.com/invite/mHtThpN8bT" target="_blank" rel="noopener noreferrer" className="ml-1 font-bold underline hover:text-blue-900 transition-colors">
                            Join here
                          </a>
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Discord Username</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-900 transition-colors">
                          <MessageSquare size={18} />
                        </div>
                        <input
                          name="discordUsername"
                          type="text"
                          required
                          value={formData.discordUsername}
                          onChange={handleChange}
                          className="block w-full appearance-none rounded-lg border border-slate-200 px-4 py-3 pl-11 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 text-base sm:text-sm transition-all"
                          placeholder="juan_dev#1234"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 relative">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Member Since</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsYearOpen(!isYearOpen)}
                          className={clsx(
                            "relative w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-500/10",
                            isYearOpen ? "border-blue-500 ring-4 ring-blue-500/10 bg-white shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-blue-900">
                              <Calendar className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-bold text-slate-900">{formData.yearJoined}</span>
                          </div>
                          <ChevronDown className={clsx("w-4 h-4 text-slate-400 transition-transform duration-300", isYearOpen && "rotate-180")} />
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
                                className="absolute left-0 right-0 mt-2 z-20 bg-white border border-slate-100 rounded-lg shadow-xl shadow-blue-900/10 overflow-hidden max-h-[240px] overflow-y-auto no-scrollbar"
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
                                        "flex items-center justify-between w-full px-4 py-3 rounded-lg text-sm font-bold transition-colors",
                                        formData.yearJoined === year
                                          ? "bg-blue-50 text-blue-900"
                                          : "text-slate-600 hover:bg-slate-50"
                                      )}
                                    >
                                      <span>{year}</span>
                                      {formData.yearJoined === year && <Check className="w-4 h-4 text-blue-900" />}
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                        The year you joined the BetterGovPH community.
                      </p>
                    </div>
                  </motion.div>
                )}

                {currentStep === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-5 sm:space-y-6"
                  >
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Specialization</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-900 transition-colors">
                          <Briefcase size={18} />
                        </div>
                        <select
                          name="specialization"
                          value={formData.specialization}
                          onChange={handleChange}
                          className="block w-full appearance-none rounded-lg border border-slate-200 px-4 py-3 pl-11 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 text-base sm:text-sm transition-all bg-white"
                        >
                          {SPECIALIZATIONS.map((spec) => (
                            <option key={spec} value={spec}>{spec}</option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                          <ChevronDown size={18} />
                        </div>
                      </div>
                      {formData.specialization === 'Other' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-3"
                        >
                          <input
                            name="customSpecialization"
                            type="text"
                            required
                            value={formData.customSpecialization}
                            onChange={handleChange}
                            className="block w-full appearance-none rounded-lg border border-slate-200 px-4 py-3 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 text-base sm:text-sm transition-all"
                            placeholder="Specify specialization..."
                          />
                        </motion.div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Role Request</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-900 transition-colors">
                          <ShieldCheck size={18} />
                        </div>
                        <select
                          name="role"
                          value={formData.role}
                          onChange={handleChange}
                          className="block w-full appearance-none rounded-lg border border-slate-200 px-4 py-3 pl-11 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 text-base sm:text-sm transition-all bg-white"
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                          <ChevronDown size={18} />
                        </div>
                      </div>
                      {formData.role === 'Other' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-3"
                        >
                          <input
                            name="customRole"
                            type="text"
                            required
                            value={formData.customRole}
                            onChange={handleChange}
                            className="block w-full appearance-none rounded-lg border border-slate-200 px-4 py-3 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 text-base sm:text-sm transition-all"
                            placeholder="Specify role..."
                          />
                        </motion.div>
                      )}
                    </div>

                    <div className="p-4 rounded-lg bg-amber-50 border border-amber-100 flex items-start gap-3">
                      <div className="shrink-0 pt-0.5">
                        <ShieldCheck size={18} className="text-amber-600" />
                      </div>
                      <p className="text-xs text-amber-800 leading-relaxed font-medium">
                        By submitting, you agree that your application is subject to manual verification by the community administrators.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="pt-6 flex gap-4">
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={prevStep}
                    className="flex-1 flex justify-center items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all active:scale-[0.98]"
                  >
                    <ArrowLeft size={18} />
                    <span>Back</span>
                  </button>
                )}
                
                {currentStep < 3 ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="flex-1 flex justify-center items-center gap-2 rounded-lg bg-blue-900 px-4 py-3.5 text-sm font-semibold text-white shadow-md hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-900/20 transition-all active:scale-[0.98]"
                  >
                    <span>Continue</span>
                    <ArrowRight size={18} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-[2] flex justify-center items-center gap-2 rounded-lg bg-blue-900 px-4 py-3.5 text-sm font-semibold text-white shadow-md hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-900/20 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Application</span>
                        <Check size={18} />
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-600">
                Already registered?{' '}
                <Link to="/login" className="font-semibold text-blue-900 hover:text-blue-700 transition-colors inline-flex items-center gap-1 group">
                  Log in here
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
