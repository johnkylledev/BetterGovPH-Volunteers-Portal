import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Calendar, ChevronDown, Check, MessageSquare, Home, ArrowRight, ArrowLeft, User, Mail, Lock, Briefcase, Users, ShieldCheck, Loader2, AlertCircle, CheckCircle2, Clock, Search, Plus, X, BookOpen, Wrench, GraduationCap, Brain, Code, Palette, Database, Globe, Cpu, Layers, Server, Smartphone, Zap, Target, BadgeCheck } from 'lucide-react';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { SkillLevel, ExperienceLevel, UserSkill } from '../../types';
import { skillToSlug } from '../../utils/skillUtils';
import { SPECIALIZATIONS, Specialization } from '../../constants/specializations';
import { SKILL_CATEGORIES, SkillCategory } from '../../constants/skills';
import { createOrUpdateUserRecord, getUserData, signInWithGoogle, supabase } from '../../services/supabase';

const LEVEL_CONFIG: Record<SkillLevel, { label: string; icon: any; desc: string }> = {
  'Learner': {
    label: 'Learner',
    icon: BookOpen,
    desc: 'Basic understanding'
  },
  'Practitioner': {
    label: 'Practitioner',
    icon: Wrench,
    desc: 'Hands-on experience'
  },
  'Expert': {
    label: 'Expert',
    icon: GraduationCap,
    desc: 'Can mentor others'
  }
};

const SKILL_LEVELS: SkillLevel[] = ['Learner', 'Practitioner', 'Expert'];
const EXPERIENCE_LEVELS: ExperienceLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'Professional'];

const ROLES = ['Member', 'Fellow', 'Contributor', 'Other'];

type Step = 1 | 2 | 3;

function LegacyRegister() {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [formData, setFormData] = useState({
    fullName: '',
    discordUsername: '',
    yearJoined: new Date().getFullYear(),
    skills: [] as UserSkill[],
    experienceLevel: 'Beginner' as ExperienceLevel,
    role: 'Member',
    customRole: '',
    specialization: '',
  });
  const [skillSearch, setSkillSearch] = useState('');
  const [otherSkill, setOtherSkill] = useState('');
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [isYearOpen, setIsYearOpen] = useState(false);
  const [activeSkillCategory, setActiveSkillCategory] = useState<SkillCategory>(Object.keys(SKILL_CATEGORIES)[0] as SkillCategory);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shouldShake, setShouldShake] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [checkingProfile, setCheckingProfile] = useState(false);
  const setCurrentUser = useStore((state) => state.setCurrentUser);
  const currentUser = useStore((state) => state.currentUser);
  const authInitialized = useStore((state) => state.authInitialized);
  const sessionUserId = useStore((state) => state.sessionUserId);

  const dragContainerRef = React.useRef<HTMLDivElement>(null);
  const dragContentRef = React.useRef<HTMLDivElement>(null);
  const [dragConstraints, setDragConstraints] = useState({ left: 0, right: 0 });

  useEffect(() => {
    const calculateConstraints = () => {
      if (dragContainerRef.current && dragContentRef.current) {
        const containerWidth = dragContainerRef.current.offsetWidth;
        const contentWidth = dragContentRef.current.scrollWidth;
        const scrollableWidth = contentWidth - containerWidth;
        setDragConstraints({
          left: scrollableWidth > 0 ? -scrollableWidth - 40 : 0,
          right: 0
        });
      }
    };

    calculateConstraints();
    // Add a small delay for content rendering
    const timer = setTimeout(calculateConstraints, 100);

    window.addEventListener('resize', calculateConstraints);
    return () => {
      window.removeEventListener('resize', calculateConstraints);
      clearTimeout(timer);
    };
  }, [activeSkillCategory]);
  const navigate = useNavigate();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [roleScores, setRoleScores] = useState<Record<string, number>>({});
  const [betterRoleSuggestion, setBetterRoleSuggestion] = useState<string | null>(null);

  useEffect(() => {
    if (formData.skills.length === 0) {
      setRoleScores({});
      setBetterRoleSuggestion(null);
      return;
    }

    const scores: Record<string, number> = {};
    SPECIALIZATIONS.forEach(spec => {
      const matchingSkills = formData.skills.filter(s =>
        spec.requiredSkills.some(rs => rs.toLowerCase() === s.name.toLowerCase())
      );
      const score = Math.min(100, Math.round((matchingSkills.length / spec.minRequiredCount) * 100));
      scores[spec.label] = score;
    });

    setRoleScores(scores);

    const currentRoleScore = scores[formData.specialization] || 0;
    const bestRole = Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b);

    if (bestRole[0] !== formData.specialization && bestRole[1] > currentRoleScore + 20) {
      setBetterRoleSuggestion(bestRole[0]);
    } else {
      setBetterRoleSuggestion(null);
    }
  }, [formData.skills, formData.specialization]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  useEffect(() => {
    if (sessionUserId) {
      setCheckingProfile(true);
      (async () => {
        const { data } = await supabase.auth.getSession();
        setUserEmail(data.session?.user?.email || '');
        
        const profile = await getUserData(sessionUserId);
        if (profile) {
          setCurrentUser(profile);
          const isComplete = profile.fullName && profile.discordUsername && profile.specialization && profile.yearJoined;
          if (isComplete) {
            if (profile.isAdmin) {
              navigate('/admin', { replace: true });
            } else {
              navigate('/dashboard', { replace: true });
            }
          }
        }
        setCheckingProfile(false);
      })();
    }
  }, [sessionUserId]);

  if (!authInitialized || checkingProfile) return <LoadingOverlay />;

  if (!sessionUserId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-blue-900/20 relative">
        <Link
          to="/"
          className="absolute top-6 left-6 flex items-center gap-2 text-slate-500 hover:text-blue-900 transition-colors text-sm font-semibold group"
        >
          <Home className="w-4 h-4" />
          <span>Home</span>
        </Link>

        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center mb-8"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center mb-6 bg-white rounded-2xl shadow-lg shadow-blue-900/10 p-3">
              <img src="/logo.svg" alt="BetterGovPH Logo" className="w-full h-full object-contain" />
            </div>
            <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-display leading-tight flex flex-col gap-1">
              <span>BetterGovPH</span>
              <span className="text-blue-900">Dev Community</span>
            </h2>
            <p className="mt-3 text-center text-sm text-slate-500 max-w-sm">
              Join the community building better government services
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl shadow-xl shadow-slate-900/5 border border-slate-100 p-8"
          >
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-900 mb-2">Create Account</h3>
                <p className="text-xs text-slate-500">Sign in with your Google account to get started</p>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100 flex items-start gap-3"
                >
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </motion.div>
              )}

              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setError('');
                  setLoading(true);
                  try {
                    await signInWithGoogle(`${window.location.origin}/register`);
                  } catch (e: any) {
                    setError(e?.message || 'Failed to continue with Google');
                    setLoading(false);
                  }
                }}
                className="w-full group relative flex items-center justify-center gap-3 rounded-xl bg-white border-2 border-slate-200 px-6 py-4 text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    <span className="text-slate-600">Redirecting...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-4 bg-white text-slate-400 font-medium uppercase tracking-wider">Secure Sign In</span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <ShieldCheck size={16} />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-900 mb-1">Protected by Google</p>
                    <p className="text-xs text-slate-500 leading-relaxed">Your data is encrypted and secure. We never store your password.</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <p className="mt-6 text-center text-xs text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-blue-900 hover:text-blue-700 transition-colors">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validateStep = async (step: Step) => {
    setError('');
    const triggerError = (msg: string) => {
      setError(msg);
      setShouldShake(true);
      setTimeout(() => setShouldShake(false), 500);
      return false;
    };

    if (step === 1) {
      if (!sessionUserId) return triggerError('Please create an account (or sign in) to continue.');
      if (!formData.fullName.trim()) return triggerError('Please enter your full name.');
      if (!formData.discordUsername.trim()) return triggerError('Please enter your Discord username.');
    } else if (step === 2) {
      if (!formData.specialization) {
        return triggerError('Please select your specialization.');
      }
      if (formData.role === 'Other' && !formData.customRole.trim()) {
        return triggerError('Please specify your custom role.');
      }
    } else if (step === 3) {
      if (formData.skills.length === 0) {
        return triggerError('Please select at least one skill.');
      }

      const spec = SPECIALIZATIONS.find(s => s.label === formData.specialization);
      if (spec) {
        const matchingSkills = formData.skills.filter(s =>
          spec.requiredSkills.some(rs => rs.toLowerCase() === s.name.toLowerCase())
        );

        if (spec.id === 'fullstack') {
          // Special rule for fullstack: 2 frontend + 2 backend
          const frontendSkills = formData.skills.filter(s =>
            SPECIALIZATIONS.find(sp => sp.id === 'frontend')?.requiredSkills.some(rs => rs.toLowerCase() === s.name.toLowerCase())
          );
          const backendSkills = formData.skills.filter(s =>
            SPECIALIZATIONS.find(sp => sp.id === 'backend')?.requiredSkills.some(rs => rs.toLowerCase() === s.name.toLowerCase())
          );

          if (frontendSkills.length < 2 || backendSkills.length < 2) {
            return triggerError(`Full Stack Developer requires at least 2 frontend and 2 backend skills to verify your balance.`);
          }
        } else if (matchingSkills.length < spec.minRequiredCount) {
          return triggerError(`To verify your role as ${spec.label}, please select at least ${spec.minRequiredCount} relevant skills.`);
        }
      }

      const allLevelsSet = formData.skills.every(s => s.level);
      if (!allLevelsSet) {
        return triggerError('Please set a level for each selected skill.');
      }
    }
    return true;
  };

  const nextStep = async () => {
    if (await validateStep(currentStep)) {
      setCurrentStep((prev) => (prev + 1) as Step);
    }
  };

  const getSkillFallbackIcon = (skillName: string) => {
    const lowerSkill = skillName.toLowerCase();

    // Specific concept mappings
    if (lowerSkill.includes('prototyp')) return <Layers size={20} />;
    if (lowerSkill.includes('research')) return <Search size={20} />;
    if (lowerSkill.includes('visual') || lowerSkill.includes('design')) return <Palette size={20} />;
    if (lowerSkill.includes('system')) return <Cpu size={20} />;
    if (lowerSkill.includes('agile') || lowerSkill.includes('scrum')) return <Zap size={20} />;
    if (lowerSkill.includes('doc') || lowerSkill.includes('write')) return <BookOpen size={20} />;
    if (lowerSkill.includes('api') || lowerSkill.includes('backend')) return <Server size={20} />;
    if (lowerSkill.includes('frontend') || lowerSkill.includes('ui')) return <Globe size={20} />;
    if (lowerSkill.includes('mobile') || lowerSkill.includes('app')) return <Smartphone size={20} />;
    if (lowerSkill.includes('data') || lowerSkill.includes('ai')) return <Brain size={20} />;

    for (const [category, skills] of Object.entries(SKILL_CATEGORIES)) {
      if (skills.includes(skillName)) {
        if (category === 'Software Engineering') return <Code size={20} />;
        if (category === 'Design & Creative') return <Palette size={20} />;
        if (category === 'Data & AI') return <Brain size={20} />;
        if (category === 'DevOps & Infrastructure') return <Cpu size={20} />;
        if (category === 'Cybersecurity') return <ShieldCheck size={20} />;
      }
    }
    return <Briefcase size={20} />;
  };

  const renderSkillItem = (skill: string) => {
    const selectedSkill = formData.skills.find(s => s.name === skill);
    const isSelected = !!selectedSkill;

    return (
      <motion.div
        layout
        key={skill}
        className={clsx(
          "group relative flex flex-col p-2 sm:p-2.5 rounded-lg border-2 transition-all duration-300",
          isSelected
            ? "bg-white border-blue-900 shadow-sm"
            : "bg-white border-slate-100 hover:border-blue-200 hover:bg-slate-50/50"
        )}
      >
        <div className="flex items-center gap-2.5 sm:gap-3 w-full">
          <div className={clsx(
            "w-9 h-9 sm:w-10 rounded-md flex items-center justify-center transition-all duration-300 shrink-0 border border-slate-100",
            isSelected
              ? "bg-blue-900 text-white"
              : "bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-900"
          )}>
            <div className="relative w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center">
              <img
                key={`img-${skill}`}
                src={`https://cdn.simpleicons.org/${skillToSlug(skill)}`}
                className={clsx(
                  "w-full h-full object-contain transition-opacity duration-300",
                  isSelected ? "brightness-0 invert" : "opacity-80 group-hover:opacity-100"
                )}
                alt=""
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  const fallback = (e.target as HTMLImageElement).nextElementSibling;
                  if (fallback) (fallback as HTMLElement).style.display = 'flex';
                }}
              />
              <div style={{ display: 'none' }} className="absolute inset-0 items-center justify-center fallback-icon">
                {getSkillFallbackIcon(skill)}
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <span className="text-xs sm:text-sm font-bold text-slate-900 block leading-tight tracking-tight break-words">
              {skill}
            </span>
            {isSelected && (
              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-blue-600 mt-0.5 block">
                {selectedSkill.level}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (isSelected) {
                setFormData({
                  ...formData,
                  skills: formData.skills.filter(s => s.name !== skill)
                });
              } else {
                setFormData({
                  ...formData,
                  skills: [...formData.skills, { name: skill, level: 'Learner' }]
                });
              }
            }}
            className={clsx(
              "w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-md flex items-center justify-center transition-all duration-300 shadow-sm shrink-0",
              isSelected
                ? "bg-blue-900 text-white hover:bg-blue-800"
                : "bg-white border border-slate-100 text-slate-300 hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50/50"
            )}
          >
            {isSelected ? <Check className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={4} /> : <Plus className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={3} />}
          </button>
        </div>

        {isSelected && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
            className="overflow-hidden w-full"
          >
            <div className="grid grid-cols-3 p-1 bg-slate-50 rounded-lg border border-slate-100">
              {SKILL_LEVELS.map((level) => {
                const isActive = selectedSkill?.level === level;

                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => {
                      const newSkills = [...formData.skills];
                      const index = newSkills.findIndex(s => s.name === skill);
                      if (index !== -1) {
                        newSkills[index] = { ...newSkills[index], level };
                        setFormData({ ...formData, skills: newSkills });
                      }
                    }}
                    className={clsx(
                      "relative flex items-center justify-center rounded-md text-[8px] sm:text-[10px] md:text-xs font-black uppercase tracking-tight sm:tracking-normal md:tracking-wider transition-all duration-300 py-2 sm:py-2.5 px-0.5 overflow-hidden",
                      isActive
                        ? "text-white"
                        : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId={`activeLevel-${skill}`}
                        className="absolute inset-0 bg-blue-900 rounded-md"
                        initial={false}
                        transition={{ type: "spring", bounce: 0.1, duration: 0.5 }}
                      />
                    )}
                    <span className="relative z-10 whitespace-nowrap">{level}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </motion.div>
    );
  };

  const prevStep = () => {
    setCurrentStep((prev) => (prev - 1) as Step);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(await validateStep(3))) return;

    setError('');
    setLoading(true);

    const primaryRole = formData.specialization;
    const rl = formData.role === 'Other' ? formData.customRole : formData.role;

    if (!rl) {
      setError('Please provide role details.');
      setLoading(false);
      return;
    }

    try {
      if (!sessionUserId) {
        setError('Please create an account (or sign in) to continue.');
        return;
      }

      const saved = await createOrUpdateUserRecord({
        uid: sessionUserId,
        fullName: formData.fullName.trim(),
        specialization: primaryRole,
        role: rl,
        discordUsername: formData.discordUsername.trim(),
        yearJoined: Number(formData.yearJoined),
        skills: formData.skills,
        experienceLevel: formData.experienceLevel,
        authProvider: 'google',
      });
      if (saved) setCurrentUser(saved as any);
      setShowSuccessModal(true);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const categoryLabels: Record<string, string> = {
    'Software Engineering': 'Engineering',
    'Design & Creative': 'Design',
    'Data & AI': 'Data & AI',
    'DevOps & Infrastructure': 'DevOps',
    'Cybersecurity': 'Security',
    'Professional & Others': 'Professional',
  };

  const steps = [
    { id: 1, name: 'Account', icon: <User size={18} /> },
    { id: 2, name: 'Profile', icon: <Users size={18} /> },
    { id: 3, name: 'Skills', icon: <Briefcase size={18} /> },
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
          <h2 className="mt-2 text-center text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-display leading-tight sm:leading-normal flex flex-col">
            <span>BetterGovPH</span>
            <span className="text-blue-900/80">Dev Community</span>
          </h2>
          <p className="mt-2 text-center text-sm sm:text-base text-slate-500">
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
              animate={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }} />

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
                    "absolute -bottom-7 text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-colors duration-300",
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
          animate={{
            opacity: 1,
            y: 0,
            x: shouldShake ? [0, -10, 10, -10, 10, 0] : 0
          }}
          transition={{
            delay: 0.1,
            x: { duration: 0.5, ease: "easeInOut" }
          }}
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
                    <div className="space-y-4">
                      <div className="space-y-5">
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Account</p>
                              <p className="mt-2 text-sm font-bold text-slate-900 truncate">{userEmail || 'Loading...'}</p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-base font-bold text-slate-800 mb-4 tracking-tight">Full Name</label>
                          <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-900 transition-colors">
                              <User size={18} />
                            </div>
                            <input
                              name="fullName"
                              type="text"
                              value={formData.fullName}
                              onChange={handleChange}
                              className="block w-full appearance-none rounded-lg border border-slate-200 px-4 py-4 pl-11 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 text-base transition-all"
                              placeholder="Juan Dela Cruz"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-base font-bold text-slate-800 mb-4 tracking-tight">Discord Username</label>
                          <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-900 transition-colors">
                              <MessageSquare size={18} />
                            </div>
                            <input
                              name="discordUsername"
                              type="text"
                              value={formData.discordUsername}
                              onChange={handleChange}
                              className="block w-full appearance-none rounded-lg border border-slate-200 px-4 py-4 pl-11 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 text-base transition-all"
                              placeholder="juan_dev#1234"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-base font-bold text-slate-800 mb-4 tracking-tight">Member Since</label>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setIsYearOpen(!isYearOpen)}
                              className={clsx(
                                "relative w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-500/10",
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
                                      className="absolute left-0 right-0 mt-2 z-20 bg-white border border-slate-100 rounded-lg shadow-xl shadow-blue-900/10 overflow-hidden max-h-[200px] overflow-y-auto no-scrollbar"
                                    >
                                      <div className="p-2 grid grid-cols-1 gap-1">
                                        {Array.from({ length: new Date().getFullYear() - 2024 }, (_, i) => new Date().getFullYear() - i).map((year) => (
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
                        </div>
                      </div>
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
                    className="space-y-6"
                  >
                    <div className="space-y-6">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <label className="block text-base font-bold text-slate-800 tracking-tight">Primary Role (Required)</label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {SPECIALIZATIONS.map((spec) => {
                            const Icon = spec.icon;
                            const isSelected = formData.specialization === spec.label;

                            return (
                              <button
                                key={spec.id}
                                type="button"
                                onClick={() => setFormData({ ...formData, specialization: spec.label })}
                                className={clsx(
                                  "group relative flex flex-col items-center gap-2.5 p-3 rounded-lg border-2 transition-all duration-300",
                                  isSelected
                                    ? "bg-blue-900 border-blue-900 text-white shadow-md z-10"
                                    : "bg-white border-slate-100 text-slate-500 hover:border-blue-200 hover:bg-slate-50"
                                )}
                              >
                                <div className={clsx(
                                  "w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300",
                                  isSelected
                                    ? "bg-white/10"
                                    : "bg-slate-50 text-blue-900 group-hover:scale-105"
                                )}>
                                  <Icon size={20} />
                                </div>
                                <span className={clsx(
                                  "text-xs font-black uppercase tracking-[0.2em] text-center px-1",
                                  isSelected ? "text-white" : "text-slate-700"
                                )}>
                                  {spec.label}
                                </span>
                                {isSelected && (
                                  <motion.div
                                    layoutId="spec-check"
                                    className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-white text-blue-900 rounded-full flex items-center justify-center shadow-lg ring-4 ring-blue-900"
                                  >
                                    <Check size={14} strokeWidth={4} />
                                  </motion.div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="block text-base font-bold text-slate-800 mb-4 tracking-tight">Community Role</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {ROLES.map((role) => {
                            const isSelected = formData.role === role;
                            return (
                              <button
                                key={role}
                                type="button"
                                onClick={() => setFormData({ ...formData, role: role })}
                                className={clsx(
                                  "py-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-300 border-2",
                                  isSelected
                                    ? "bg-blue-900 border-blue-900 text-white shadow-lg shadow-blue-900/10"
                                    : "bg-white border-slate-100 text-slate-500 hover:border-blue-200 hover:text-slate-700"
                                )}
                              >
                                {role}
                              </button>
                            );
                          })}
                        </div>

                        <AnimatePresence>
                          {formData.role === 'Other' && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-3"
                            >
                              <input
                                type="text"
                                placeholder="Specify your role..."
                                value={formData.customRole}
                                onChange={(e) => setFormData({ ...formData, customRole: e.target.value })}
                                className="w-full px-4 py-3 rounded-lg border-2 border-blue-100 bg-blue-50/30 text-base font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div>
                        <label className="block text-base font-bold text-slate-800 mb-4 tracking-tight">Professional Level</label>
                        <div className="bg-slate-100 p-1.5 rounded-lg grid grid-cols-2 sm:grid-cols-4 gap-1.5 border border-slate-200/50">
                          {EXPERIENCE_LEVELS.map((level) => {
                            const isSelected = formData.experienceLevel === level;
                            return (
                              <button
                                key={level}
                                type="button"
                                onClick={() => setFormData({ ...formData, experienceLevel: level })}
                                className={clsx(
                                  "py-2.5 rounded-md text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all duration-300 px-1",
                                  isSelected
                                    ? "bg-white text-blue-900 shadow-sm border border-slate-200/50"
                                    : "text-slate-500 hover:text-slate-800 hover:bg-white/30"
                                )}
                              >
                                {level}
                              </button>
                            );
                          })}
                        </div>
                      </div>
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
                    className="space-y-6"
                  >
                    {/* Role Compatibility Score & Suggestions */}
                    {formData.specialization && Object.keys(roleScores).length > 0 && (
                      <div className="space-y-4">
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Role Compatibility Score</span>
                            <span className={clsx(
                              "text-sm font-black",
                              (roleScores[formData.specialization] || 0) >= 70 ? "text-green-600" :
                                (roleScores[formData.specialization] || 0) >= 40 ? "text-blue-600" : "text-amber-600"
                            )}>
                              {roleScores[formData.specialization] || 0}% Match
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${roleScores[formData.specialization] || 0}%` }}
                              className={clsx(
                                "h-full transition-all duration-500",
                                (roleScores[formData.specialization] || 0) >= 70 ? "bg-green-500" :
                                  (roleScores[formData.specialization] || 0) >= 40 ? "bg-blue-600" : "bg-amber-500"
                              )}
                            />
                          </div>
                        </div>

                        <AnimatePresence>
                          {betterRoleSuggestion && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-4"
                            >
                              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                                <BadgeCheck size={24} />
                              </div>
                              <div className="flex-1 text-left">
                                <p className="text-xs font-bold text-amber-900 mb-1">Suggest Better Role</p>
                                <p className="text-[11px] text-amber-700 leading-relaxed mb-4">
                                  We noticed your skills align more with <span className="font-black text-amber-900">{betterRoleSuggestion}</span>.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setFormData({ ...formData, specialization: betterRoleSuggestion })}
                                  className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-900 bg-amber-200/50 hover:bg-amber-200 px-4 py-2 rounded-xl transition-colors"
                                >
                                  Switch to {betterRoleSuggestion}
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Recommended Skills Section */}
                    {formData.specialization && (
                      <div className="bg-slate-50/50 rounded-xl p-4 sm:p-5 border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
                            <Target size={20} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-900">Recommended for You</p>
                            <p className="text-[11px] text-blue-400 font-bold mt-0.5 leading-tight">Verified skills for {formData.specialization}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          {SPECIALIZATIONS.find(s => s.label === formData.specialization)?.suggestedSkills.map(skill => (
                            renderSkillItem(skill)
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-6">
                      <div className="flex items-center justify-between">
                        <label className="block text-base font-bold text-slate-800 tracking-tight">Explore More Skills</label>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Optional</span>
                      </div>
                      <div className="flex flex-col gap-4">
                        <div className="relative group">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 transition-colors group-focus-within:text-blue-500" />
                          <input
                            type="text"
                            placeholder="Search skills..."
                            value={skillSearch}
                            onChange={(e) => setSkillSearch(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-slate-100 text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all bg-white" />
                        </div>

                        <div
                          ref={dragContainerRef}
                          className="overflow-hidden bg-slate-100/50 p-1 rounded-xl border border-slate-200/50 cursor-grab active:cursor-grabbing relative"
                        >
                          <motion.div
                            ref={dragContentRef}
                            drag="x"
                            dragConstraints={dragConstraints}
                            dragElastic={0.1}
                            className="flex gap-1"
                          >
                            {Object.keys(SKILL_CATEGORIES).map((category) => {
                              const isActive = activeSkillCategory === category;
                              return (
                                <button
                                  key={category}
                                  type="button"
                                  onClick={() => setActiveSkillCategory(category as SkillCategory)}
                                  className={clsx(
                                    "relative px-4 py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] whitespace-nowrap transition-colors duration-300 flex-shrink-0 z-10",
                                    isActive ? "text-blue-900" : "text-slate-500 hover:text-slate-800"
                                  )}
                                >
                                  {isActive && (
                                    <motion.div
                                      layoutId="activeCategory"
                                      className="absolute inset-0 bg-white rounded-lg shadow-sm border border-slate-200/50 -z-10"
                                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                  )}
                                  {categoryLabels[category] || category}
                                </button>
                              );
                            })}
                          </motion.div>
                        </div>
                      </div>

                      <div className="min-h-[400px]">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={activeSkillCategory + skillSearch}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                            className="grid grid-cols-1 gap-3.5"
                          >
                            {SKILL_CATEGORIES[activeSkillCategory as keyof typeof SKILL_CATEGORIES]
                              .filter(skill => skill.toLowerCase().includes(skillSearch.toLowerCase()))
                              .map((skill) => renderSkillItem(skill))}
                          </motion.div>
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* "Other" Skill Option */}
                    <div className="pt-6 border-t border-slate-100">
                      {!showOtherInput ? (
                        <button
                          type="button"
                          onClick={() => setShowOtherInput(true)}
                          className="flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-slate-100 text-slate-400 text-xs font-black uppercase tracking-[0.2em] hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50/30 transition-all w-full group"
                        >
                          <Plus size={14} strokeWidth={3} className="group-hover:scale-110 transition-transform" />
                          <span>Add custom skill</span>
                        </button>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex gap-2 p-1 bg-blue-50/50 rounded-xl border-2 border-blue-100"
                        >
                          <input
                            type="text"
                            placeholder="Type skill name..."
                            autoFocus
                            value={otherSkill}
                            onChange={(e) => setOtherSkill(e.target.value)}
                            className="flex-1 px-4 py-2 bg-white rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all placeholder:text-slate-300"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (otherSkill.trim()) {
                                  if (!formData.skills.some(s => s.name.toLowerCase() === otherSkill.trim().toLowerCase())) {
                                    setFormData({
                                      ...formData,
                                      skills: [...formData.skills, { name: otherSkill.trim(), level: 'Learner' }]
                                    });
                                    setOtherSkill('');
                                    setShowOtherInput(false);
                                  }
                                }
                              }
                              if (e.key === 'Escape') setShowOtherInput(false);
                            }}
                          />
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (otherSkill.trim()) {
                                  if (!formData.skills.some(s => s.name.toLowerCase() === otherSkill.trim().toLowerCase())) {
                                    setFormData({
                                      ...formData,
                                      skills: [...formData.skills, { name: otherSkill.trim(), level: 'Learner' }]
                                    });
                                    setOtherSkill('');
                                    setShowOtherInput(false);
                                  }
                                }
                              }}
                              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              <Check size={18} strokeWidth={3} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowOtherInput(false)}
                              className="p-2.5 bg-white text-slate-500 border border-slate-200 rounded-lg hover:text-red-600 hover:border-red-100 hover:bg-red-50 transition-all"
                            >
                              <X size={18} strokeWidth={3} />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    <div className="pt-6 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Selected Stack</p>
                          <span className="px-1.5 py-0.5 bg-blue-900 text-white text-[9px] font-black rounded-full">
                            {formData.skills.length}
                          </span>
                        </div>
                        {formData.skills.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, skills: [] })}
                            className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500 hover:text-red-600 transition-colors"
                          >
                            Clear All
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {formData.skills.length === 0 ? (
                          <div className="w-full py-4 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1.5 opacity-60">
                            <Code size={16} className="text-slate-400" />
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">No skills selected</p>
                          </div>
                        ) : (
                          <AnimatePresence mode="popLayout">
                            {formData.skills.map((skill) => (
                              <motion.div
                                key={skill.name}
                                layout
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="flex items-center gap-2 pl-3 pr-1.5 py-2 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-blue-300 transition-all group"
                              >
                                <div className="w-5 h-5 flex items-center justify-center shrink-0 relative">
                                  <img
                                    src={`https://cdn.simpleicons.org/${skillToSlug(skill.name)}`}
                                    className="w-full h-full object-contain"
                                    alt=""
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                      const fallback = (e.target as HTMLImageElement).nextElementSibling;
                                      if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                    }}
                                  />
                                  <div style={{ display: 'none' }} className="absolute inset-0 items-center justify-center">
                                    {getSkillFallbackIcon(skill.name)}
                                  </div>
                                </div>
                                <span className="text-xs font-bold text-slate-700">{skill.name}</span>
                                <div className={clsx(
                                  "px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider",
                                  skill.level === 'Expert' ? "bg-blue-900 text-white" :
                                    skill.level === 'Practitioner' ? "bg-blue-100 text-blue-900" :
                                      "bg-slate-100 text-slate-600"
                                )}>
                                  {skill.level}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormData({
                                      ...formData,
                                      skills: formData.skills.filter(s => s.name !== skill.name)
                                    });
                                  }}
                                  className="ml-0.5 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                >
                                  <X size={12} strokeWidth={3} />
                                </button>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!(currentStep === 1 && !sessionUserId) && (
                <div className="pt-8 flex gap-3">
                  {currentStep > 1 && (
                    <button
                      type="button"
                      onClick={prevStep}
                      className="flex-1 flex justify-center items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-4 text-xs font-black uppercase tracking-[0.2em] text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-all duration-300"
                    >
                      <ArrowLeft size={16} strokeWidth={3} />
                      <span>Back</span>
                    </button>
                  )}

                  {currentStep < 3 ? (
                    <button
                      type="button"
                      onClick={nextStep}
                      className="flex-[2] relative flex justify-center items-center gap-2 rounded-lg bg-blue-900 px-4 py-4 text-xs font-black uppercase tracking-[0.2em] text-white shadow-md hover:bg-blue-800 transition-all duration-300 active:scale-[0.98]"
                    >
                      Continue
                      <ArrowRight size={16} strokeWidth={3} className="ml-1" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-[2] relative flex justify-center items-center gap-2 rounded-lg bg-blue-900 px-4 py-4 text-xs font-black uppercase tracking-[0.2em] text-white shadow-md hover:bg-blue-800 transition-all duration-300 active:scale-[0.98] disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <span>Complete Application</span>
                          <Check size={16} strokeWidth={3} />
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                <p className="text-sm text-slate-600">
                  Already registered?{' '}
                  <Link to="/login" className="font-semibold text-blue-900 hover:text-blue-700 transition-colors inline-flex items-center gap-1 group">
                    Log in here
                    <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
      <AnimatePresence>
        {showSuccessModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 z-[101] flex items-center justify-center p-4"
            >
              <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-blue-900" />

                <div className="mb-6 inline-flex items-center justify-center w-20 h-20 bg-blue-50 text-blue-600 rounded-full">
                  <CheckCircle2 size={40} className="animate-bounce" />
                </div>

                <h2 className="text-2xl font-bold text-slate-900 mb-2">Application Submitted</h2>
                <p className="text-slate-500 mb-8 leading-relaxed">
                  Your profile is pending review.
                </p>

                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Status</p>
                    <div className="flex items-center gap-2 text-blue-900 font-bold">
                      <Clock size={16} />
                      <span>Pending Review</span>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate('/dashboard')}
                    className="w-full py-4 bg-blue-900 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-900/20 hover:bg-blue-800 transition-all active:scale-[0.98]"
                  >
                    Go to Portal
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default LegacyRegister;
