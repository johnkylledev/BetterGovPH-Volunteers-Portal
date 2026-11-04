import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { ChevronDown, Check, MessageSquare, ArrowRight, ArrowLeft, User, Mail, Lock, Briefcase, ShieldCheck, AlertCircle, Search,  BookOpen, Wrench, GraduationCap, Brain, Code, Palette, Database, Globe, Cpu, Layers, Server, Smartphone, Zap, Link2, Github } from 'lucide-react';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { SkillsPicker } from '../../components/SkillsPicker';
import { EXPERIENCE_LEVELS } from '../../constants/experience';
import { SkillLevel, ExperienceLevel, UserSkill } from '../../types';
import { SPECIALIZATIONS, ROLE_GROUPS, Specialization } from '../../constants/specializations';
import { trackForRole } from '../../constants/tracks';
import { DISCORD_AVAILABLE, COMING_SOON_PILL } from '../../constants/integrations';
import type { LinkKey, ProfileLinks } from '../../constants/socialLinks';
import { LinksFields, LINKS_INTRO, validateLinks } from '../../components/LinksFields';
import { SelectMenu } from '../../components/SelectMenu';
import { ComingSoonConnections } from '../../components/ComingSoonConnections';
import { ConsentFields, requiredConsentMissing } from '../../components/ConsentFields';
import { CONSENT_VERSION, type ConsentPurposeId } from '../../constants/community';
import { takeReturnTo } from '../../utils/returnTo';
import { SKILL_CATEGORIES } from '../../constants/skills';
import { createOrUpdateUserRecord, getUserData, signInWithGoogle, supabase, connectDiscord, getDiscordStatus } from '../../services/supabase';

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


const ROLES = ['Member', 'Fellow', 'Contributor', 'Other'];

type Step = 1 | 2 | 3 | 4;

function LegacyRegister() {
    const [currentStep, setCurrentStep] = useState<Step>(1);
    const [formData, setFormData] = useState({
        fullName: '',
        displayName: '',
        discordUsername: '',
        yearJoined: new Date().getFullYear(),
        skills: [] as UserSkill[],
        experienceLevel: 'Beginner' as ExperienceLevel,
        role: 'Member',
        customRole: '',
        specialization: '',
        secondarySpecialization: '',
        links: {} as ProfileLinks,
        consent: [] as ConsentPurposeId[],
    });
    const [consentError, setConsentError] = useState('');
    const [cocAgreed, setCocAgreed] = useState(false);
    const [cocError, setCocError] = useState('');
    const [linkErrors, setLinkErrors] = useState<Partial<Record<LinkKey, string>>>({});
    const [completing, setCompleting] = useState(false);

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [shouldShake, setShouldShake] = useState(false);
    const [discordConnecting, setDiscordConnecting] = useState(false);
    const [discordConnected, setDiscordConnected] = useState(false);
    const [discordUsername, setDiscordUsername] = useState('');
    const [userEmail, setUserEmail] = useState<string>('');
    const [checkingProfile, setCheckingProfile] = useState(false);
    const setCurrentUser = useStore((state) => state.setCurrentUser);
    const currentUser = useStore((state) => state.currentUser);
    const authInitialized = useStore((state) => state.authInitialized);
    const sessionUserId = useStore((state) => state.sessionUserId);

    const hasSession = !!sessionUserId;

    const navigate = useNavigate();
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const DRAFT_KEY = 'bgph-register-draft';

    const loadDraft = (): { step?: Step; data?: any } | null => {
        try {
            const raw = sessionStorage.getItem(DRAFT_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            const step: unknown = parsed?.step;
            const data: unknown = parsed?.data;
            const validStep = step === 1 || step === 2 || step === 3 || step === 4 ? (step as Step) : undefined;
            return { step: validStep, data: (data && typeof data === 'object') ? data : undefined };
        } catch { return null; }
    };
    const saveDraft = () => {
        try {
            const payload = { step: currentStep, data: formData, updatedAt: Date.now() };
            sessionStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
        } catch { /* quota / private mode; ignore */ }
    };
    const clearDraft = () => { try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* noop */ } };

    useEffect(() => {
        const draft = loadDraft();
        // Step 4 needs the saved profile; the profile check below moves people there when it exists.
        if (draft?.step) {
            setCurrentStep(Math.min(draft.step, 3) as Step);
        }
        if (draft?.data) {
            setFormData(prev => ({
                ...prev,
                fullName: typeof draft.data.fullName === 'string' ? draft.data.fullName : prev.fullName,
                displayName: typeof draft.data.displayName === 'string' ? draft.data.displayName : prev.displayName,
                discordUsername: typeof draft.data.discordUsername === 'string' ? draft.data.discordUsername : prev.discordUsername,
                yearJoined: Number.isFinite(draft.data.yearJoined) ? Number(draft.data.yearJoined) : prev.yearJoined,
                skills: Array.isArray(draft.data.skills) ? draft.data.skills : prev.skills,
                experienceLevel: typeof draft.data.experienceLevel === 'string' ? draft.data.experienceLevel : prev.experienceLevel,
                role: typeof draft.data.role === 'string' ? draft.data.role : prev.role,
                customRole: typeof draft.data.customRole === 'string' ? draft.data.customRole : prev.customRole,
                specialization: typeof draft.data.specialization === 'string' ? draft.data.specialization : prev.specialization,
                links: draft.data.links && typeof draft.data.links === 'object' ? draft.data.links : prev.links,
                secondarySpecialization: typeof draft.data.secondarySpecialization === 'string' ? draft.data.secondarySpecialization : prev.secondarySpecialization,
            }));
        }
    }, []);

    useEffect(() => { saveDraft(); }, [currentStep, formData]);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [currentStep]);

    useEffect(() => {
        setError('');
    }, [currentStep]);

    useEffect(() => {
        if (hasSession) {
            if (currentUser && currentUser.fullName && currentUser.specialization && currentUser.yearJoined && currentUser.consentAt) {
                if (currentUser.isAdmin) {
                    navigate('/admin', { replace: true });
                } else {
                    navigate(takeReturnTo() || '/dashboard', { replace: true });
                }
                return;
            }

            setCheckingProfile(true);
            (async () => {
                const { data } = await supabase.auth.getSession();
                setUserEmail(data.session?.user?.email || '');

                const profile = await getUserData(sessionUserId);
                if (profile) {
                    setCurrentUser(profile);
                    setFormData(prev => ({
                        ...prev,
                        fullName: profile.fullName || prev.fullName,
                        displayName: profile.displayName || prev.displayName,
                        specialization: profile.specialization || prev.specialization,
                        role: profile.role || prev.role,
                        yearJoined: profile.yearJoined || prev.yearJoined,
                        skills: profile.skills || prev.skills,
                        experienceLevel: profile.experienceLevel || prev.experienceLevel,
                        customRole: profile.role && !ROLES.includes(profile.role) ? profile.role : prev.customRole,
                        links: profile.links && Object.keys(profile.links).length ? { ...profile.links } : prev.links,
                        secondarySpecialization: profile.secondarySpecialization || prev.secondarySpecialization,
                    }));
                    const hasBasics = profile.fullName && profile.specialization && profile.yearJoined;
                    const isComplete = hasBasics && profile.consentAt;
                    // Saved through step 3 but never gave consent: continue at the last step.
                    if (hasBasics && !isComplete && !profile.isAdmin) setCurrentStep(4);
                    if (isComplete || profile.isAdmin) {
                        if (profile.isAdmin) {
                            navigate('/admin', { replace: true });
                        } else {
                            navigate(takeReturnTo() || '/dashboard', { replace: true });
                        }
                    }
                }
                setCheckingProfile(false);
            })();
        }
    }, [hasSession]);

    useEffect(() => {
        if (currentStep !== 4) return;
        let cancelled = false;
        (async () => {
            try {
                const storedErr = (() => {
                    try { return sessionStorage.getItem('discord_connect_error'); } catch { return null; }
                })();
                if (storedErr) {
                    try { sessionStorage.removeItem('discord_connect_error'); } catch { /* noop */ }
                    if (!cancelled) {
                        setError(storedErr);
                        setShouldShake(true);
                        setTimeout(() => setShouldShake(false), 500);
                    }
                }
                const status = await getDiscordStatus();
                if (!cancelled && status?.connected) {
                    setDiscordConnected(true);
                    if (status.discord_username) setDiscordUsername(status.discord_username);
                }
            } catch {
                // not connected
            }
        })();
        return () => { cancelled = true; };
    }, [currentStep]);

    const handleConnectDiscord = async () => {
        setDiscordConnecting(true);
        setError('');
        try {
            try { sessionStorage.removeItem('discord_connect_error'); } catch { /* noop */ }
            localStorage.setItem('onboarding_connections', '1');
            // Registration always returns to /register; drop any address left by an abandoned profile reconnect.
            try { sessionStorage.removeItem('discord_return_to'); } catch { /* noop */ }
            const { url } = await connectDiscord();
            const target = url;
            window.requestAnimationFrame(() => {
                window.setTimeout(() => { window.location.href = target; }, 50);
            });
        } catch (err: any) {
            setDiscordConnecting(false);
            setError(err.message || 'Failed to start Discord connection. Please try again.');
        }
    };

    const handleComplete = async () => {
        // Data Privacy Act consent is required to submit; optional channels are validated but never required.
        if (requiredConsentMissing(formData.consent)) {
            setConsentError('Tick the two required items to submit your application.');
            setShouldShake(true);
            setTimeout(() => setShouldShake(false), 500);
            document.getElementById('reg-consent-membership')?.focus();
            return;
        }
        if (!cocAgreed) {
            setCocError('Please agree to the code of conduct to submit.');
            setShouldShake(true);
            setTimeout(() => setShouldShake(false), 500);
            document.getElementById('reg-coc')?.focus();
            return;
        }
        const { clean, errors } = validateLinks(formData.links);
        setLinkErrors(errors);
        if (Object.keys(errors).length > 0) {
            setError('Fix the highlighted link, or clear it to skip.');
            setShouldShake(true);
            setTimeout(() => setShouldShake(false), 500);
            return;
        }
        setCompleting(true);
        try {
            const saved = await createOrUpdateUserRecord({
                ...(Object.keys(clean).length > 0 ? { links: clean } : {}),
                consent: { version: CONSENT_VERSION, purposes: formData.consent },
                acceptCoc: true,
            });
            if (saved) setCurrentUser(saved as any);
        } catch (err: any) {
            setCompleting(false);
            setError(err?.message || 'Could not save your choices. Try again.');
            return;
        }
        setCompleting(false);
        clearDraft();
        navigate(takeReturnTo() || '/dashboard');
    };

    if (!authInitialized || checkingProfile) return <LoadingOverlay />;

    if (!hasSession) {
        return (
            <div className="site flex min-h-screen flex-col">
                <header className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
                    <Link to="/" className="group inline-flex items-center gap-1.5 text-[14px] text-[var(--fg-3)] hover:text-[var(--fg)]">
                        <ArrowLeft size={16} strokeWidth={1.75} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
                        Home
                    </Link>
                    <Link to="/login" className="text-[14px] text-[var(--fg-3)] hover:text-[var(--fg)]">
                        Have an account? <span className="font-medium text-[var(--fg)]">Sign in</span>
                    </Link>
                </header>

                <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-16 px-4 sm:px-6 py-12 lg:grid-cols-[1fr_380px]">
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                        className="order-2 hidden lg:order-1 lg:block"
                    >
                        <h2 className="mt-3 text-[36px]">
                            Hindi tayo tumitingin.
                            <span className="block text-[var(--fg-3)]">Tayo ang gumagawa.</span>
                        </h2>
                        <p className="mt-4 max-w-md text-[16px] leading-relaxed text-[var(--fg-2)]">
                            Four short steps, about five minutes. Once approved you get a verified Volunteer Card and access to the project channels.
                        </p>
                        <ol className="mt-8 max-w-md border-t border-[var(--line)]">
                            {[
                                ['Account', 'Sign in with Google and confirm your name.'],
                                ['Profile', 'Your main role and experience level.'],
                                ['Skills', 'What you can help with, and how well.'],
                                ['Finish', 'Agree to how we use your information, and add your links.'],
                            ].map(([t, d], i) => (
                                <li key={t} className="flex gap-4 border-b border-[var(--line)] py-3.5">
                                    <span className="num w-4 shrink-0 text-[13px] text-[var(--fg-3)]">{i + 1}</span>
                                    <span className="text-[15px]">
                                        <span className="font-medium">{t}</span>
                                        <span className="text-[var(--fg-3)]"> — {d}</span>
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.05, ease: [0.23, 1, 0.32, 1] }}
                        className="order-1 w-full lg:order-2"
                    >
                        <img
                            src="/logo.svg" onError={(e) => { const t = e.currentTarget; t.onerror = null; t.src = 'https://assets.bettergov.ph/logos/webp/icon-primary.webp'; }}
                            alt="BetterGovPH"
                            className="h-10 w-10 object-contain"
                        />
                        <h1 className="mt-6 text-[28px]">Apply for membership</h1>
                        <p className="mt-2 text-[15px] leading-relaxed text-[var(--fg-2)]">
                            Start with your Google account. You can save and come back — we keep your progress on this device.
                        </p>

                        {error && (
                            <p role="alert" className="mt-6 rounded-[10px] bg-red-50 px-3.5 py-3 text-[14px] text-red-800 shadow-[inset_0_0_0_1px_rgb(254_202_202)]">
                                {error}
                            </p>
                        )}

                        <button
                            id="btn-google-signin"
                            type="button"
                            disabled={loading}
                            onClick={async () => {
                                setError('');
                                setLoading(true);
                                try {
                                    await signInWithGoogle(`${window.location.origin}/register`);
                                } catch (e: any) {
                                    setError(e?.message || 'Google sign-in didn’t go through. Try again.');
                                    setLoading(false);
                                }
                            }}
                            className="s-btn s-btn-accent mt-8 h-11 w-full"
                        >
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white">
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                            </span>
                            {loading ? 'Redirecting to Google…' : 'Continue with Google'}
                        </button>

                        <p className="mt-4 text-[13px] leading-relaxed text-[var(--fg-3)]">
                            By continuing you agree to the <Link to="/terms" className="s-link">Terms</Link> and{' '}
                            <Link to="/privacy" className="s-link">Privacy policy</Link>.
                        </p>
                    </motion.div>
                </main>
            </div>
        );
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const validateStep = async (step: Step) => {
        setError('');
        let invalidFieldId: string | null = null;
        const triggerError = (msg: string, fieldId?: string) => {
            setError(msg);
            setShouldShake(true);
            setTimeout(() => setShouldShake(false), 500);
            if (fieldId) invalidFieldId = fieldId;
            if (invalidFieldId) setTimeout(() => {
                try { (document.getElementById(invalidFieldId!) as HTMLElement | null)?.focus?.(); } catch { /* noop */ }
            }, 60);
            return false;
        };

        if (step === 1) {
            if (!hasSession) return triggerError('Please create an account (or sign in) to continue.', 'btn-google-signin');
            if (!formData.fullName.trim()) return triggerError('Please enter your full name.', 'field-full-name');
        } else if (step === 2) {
            if (!formData.specialization) {
                return triggerError('Please select your specialization.', 'field-specialization');
            }
            if (formData.role === 'Other' && !formData.customRole.trim()) {
                return triggerError('Please specify your custom role.', 'field-custom-role');
            }
        } else if (step === 3) {
            if (formData.skills.length === 0) {
                return triggerError('Please select at least one skill.', 'field-skill-search');
            }

            const spec = SPECIALIZATIONS.find(s => s.label === formData.specialization);
            if (spec) {
                const matchingSkills = formData.skills.filter(s =>
                    spec.requiredSkills.some(rs => rs.toLowerCase() === s.name.toLowerCase())
                );

                if (spec.id === 'fullstack') {
                    const frontendSkills = formData.skills.filter(s =>
                        SPECIALIZATIONS.find(sp => sp.id === 'frontend')?.requiredSkills.some(rs => rs.toLowerCase() === s.name.toLowerCase())
                    );
                    const backendSkills = formData.skills.filter(s =>
                        SPECIALIZATIONS.find(sp => sp.id === 'backend')?.requiredSkills.some(rs => rs.toLowerCase() === s.name.toLowerCase())
                    );

                    if (frontendSkills.length < 2 || backendSkills.length < 2) {
                        return triggerError(`Full Stack Developer requires at least 2 frontend and 2 backend skills to verify your balance.`, 'field-skill-search');
                    }
                } else if (matchingSkills.length < spec.minRequiredCount) {
                    return triggerError(`To verify your role as ${spec.label}, please select at least ${spec.minRequiredCount} relevant skills.`, 'field-skill-search');
                }
            }

            const allLevelsSet = formData.skills.every(s => s.level);
            if (!allLevelsSet) {
                return triggerError('Please set a level for each selected skill.', 'field-skill-search');
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

    const prevStep = () => {
        setError('');
        setCurrentStep((prev) => (prev - 1) as Step);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!(await validateStep(3))) return;

        setError('');

        const primaryRole = formData.specialization;
        // Community roles beyond Member are given by admins; sign-up always starts as Member.
        const rl = 'Member';

        if (!rl) {
            setError('Please provide role details.');
            setShouldShake(true);
            setTimeout(() => setShouldShake(false), 500);
            return;
        }

        if (!sessionUserId) {
            setError('Please create an account (or sign in) to continue.');
            setShouldShake(true);
            setTimeout(() => setShouldShake(false), 500);
            return;
        }

        setCurrentStep(4);

        try {
            const saved = await createOrUpdateUserRecord({
                uid: sessionUserId,
                fullName: formData.fullName.trim(),
                displayName: formData.displayName.trim(),
                specialization: primaryRole,
                secondarySpecialization: formData.secondarySpecialization && formData.secondarySpecialization !== primaryRole ? formData.secondarySpecialization : '',
                role: rl,
                yearJoined: Number(formData.yearJoined),
                skills: formData.skills,
                experienceLevel: formData.experienceLevel,
                authProvider: 'google',
            });
            if (saved) setCurrentUser(saved as any);
        } catch (err: any) {
            setCurrentStep(3);
            setError(err.message || 'Registration failed');
            setShouldShake(true);
            setTimeout(() => setShouldShake(false), 500);
        }
    };

    const steps = [
        { id: 1, name: 'Account', icon: <User size={15} strokeWidth={2} /> },
        { id: 2, name: 'Profile', icon: <Briefcase size={15} strokeWidth={2} /> },
        { id: 3, name: 'Skills', icon: <Wrench size={15} strokeWidth={2} /> },
        { id: 4, name: 'Finish', icon: <Link2 size={15} strokeWidth={2} /> },
    ];


    return (
        <div className="site flex min-h-screen flex-col">
            <header className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
                <Link to="/" className="group inline-flex items-center gap-1.5 text-[14px] text-[var(--fg-3)] hover:text-[var(--fg)]">
                    <ArrowLeft size={16} strokeWidth={1.75} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
                    Home
                </Link>
                <span className="num text-[13px] text-[var(--fg-3)]">Step {currentStep} of 4</span>
            </header>

            <div className="mx-auto w-full max-w-2xl flex-1 px-4 sm:px-6 pt-6 pb-16">
                <div className="mb-8">
                    <h1 className="mt-2 text-[28px] sm:text-[32px]">
                        {['Tell us who you are', 'Your role', 'Your skills', 'Connect your accounts'][currentStep - 1] || 'Membership application'}
                    </h1>
                    <p className="mt-2 text-[15px] text-[var(--fg-2)]">
                        {[
                            'The name here goes on your Volunteer Card.',
                            'This helps us match you with the right projects.',
                            'Pick what you can help with and how comfortable you are.',
                            'Last step: how we use your information, and where people can find your work.',
                        ][currentStep - 1]}
                    </p>
                </div>

                <nav aria-label="Application steps" className="mb-8">
                    <ol className="grid grid-cols-4">
                        {steps.map((step, i) => {
                            const done = currentStep > step.id;
                            const current = currentStep === step.id;
                            const desc = ['Name & year', 'Role & experience', 'What you know', 'Consent & links'][i];
                            return (
                                <li key={step.id} className="relative">
                                    {i > 0 && (
                                        <span
                                            aria-hidden
                                            className="absolute left-[calc(-50%+24px)] right-[calc(50%+24px)] top-[17px] h-[2px] overflow-hidden rounded-full bg-slate-200"
                                        >
                                            <span
                                                className="block h-full origin-left bg-[var(--accent)] transition-transform duration-500 ease-[cubic-bezier(.23,1,.32,1)]"
                                                style={{ transform: `scaleX(${currentStep >= step.id ? 1 : 0})` }}
                                            />
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const target = Number(step.id);
                                            if (!Number.isNaN(target) && target >= 1 && target <= currentStep) {
                                                setCurrentStep(target as Step);
                                            }
                                        }}
                                        aria-current={current ? 'step' : undefined}
                                        aria-label={`Step ${step.id}: ${step.name}${done ? ', done' : current ? ', current' : ''}`}
                                        className="group mx-auto flex w-full flex-col items-center text-center"
                                    >
                                        <span
                                            className={clsx(
                                                'relative z-10 flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold transition-[background-color,box-shadow,color] duration-200',
                                                done && 'bg-[var(--accent)] text-white shadow-[0_1px_2px_rgb(15_23_42/0.2)]',
                                                current && 'bg-white text-[var(--accent)] shadow-[0_0_0_2px_var(--accent),0_0_0_6px_rgb(30_58_138/0.12)]',
                                                !done && !current && 'bg-white text-slate-400 shadow-[inset_0_0_0_1.5px_rgb(203_213_225)] group-hover:text-slate-600'
                                            )}
                                        >
                                            {done ? <Check size={15} strokeWidth={2.5} /> : step.icon}
                                        </span>
                                        <span
                                            className={clsx(
                                                'mt-2.5 text-[13px] leading-tight transition-colors',
                                                current ? 'font-semibold text-slate-900' : done ? 'font-medium text-slate-700' : 'text-slate-400 group-hover:text-slate-600'
                                            )}
                                        >
                                            {step.name}
                                        </span>
                                        <span className="mt-0.5 hidden text-[12px] leading-tight text-slate-400 sm:block">{desc}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                </nav>

                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{
                        opacity: 1,
                        y: 0,
                        x: shouldShake ? [0, -6, 6, -4, 4, 0] : 0
                    }}
                    transition={{
                        duration: 0.4,
                        ease: [0.23, 1, 0.32, 1],
                        x: { duration: 0.4, ease: [0.23, 1, 0.32, 1] }
                    }}
                >
                    <div className="s-card relative w-full p-5 sm:p-7">
                        <AnimatePresence mode="wait">
                            {error && (
                                <motion.div
                                    id="register-form-error"
                                    role="alert"
                                    aria-live="assertive"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="mb-6 flex w-full items-start gap-2.5 rounded-[10px] bg-red-50 px-3.5 py-3 text-[14px] text-red-800 shadow-[inset_0_0_0_1px_rgb(254_202_202)]"
                                >
                                    <AlertCircle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                                    <span>{error}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6 w-full">
                            <AnimatePresence mode="wait">
                                {currentStep === 1 && (
                                    <motion.div
                                        key="step1"
                                        initial={{ opacity: 0, x: 12 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -12 }}
                                        transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                                        className="space-y-6"
                                    >
                                        <div className="flex items-center gap-3 rounded-[12px] bg-slate-50 px-4 py-3 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.06)]">
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[14px] font-semibold text-[var(--accent)] shadow-[var(--e1)]">
                                                {(formData.fullName.trim()[0] || userEmail?.[0] || '?').toUpperCase()}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-[12px] text-slate-500">Signed in with Google</p>
                                                <p className="truncate text-[14px] font-medium text-slate-900">{userEmail || 'Loading…'}</p>
                                            </div>
                                        </div>

                                        <div>
                                            <label htmlFor="field-full-name" className="mb-1.5 block text-[14px] font-medium text-slate-900">Full name</label>
                                            <input
                                                id="field-full-name"
                                                name="fullName"
                                                type="text"
                                                autoComplete="name"
                                                value={formData.fullName}
                                                onChange={handleChange}
                                                aria-invalid={!!(error && !formData.fullName.trim())}
                                                aria-describedby={error ? 'register-form-error' : 'hint-full-name'}
                                                className="s-field h-11 text-[15px]"
                                                placeholder="Juan Dela Cruz"
                                            />
                                            <p id="hint-full-name" className="mt-1.5 text-[12px] text-slate-500">This is printed on your Volunteer Card exactly as typed. It stays private unless you choose otherwise.</p>
                                        </div>

                                        <div>
                                            <label htmlFor="field-display-name" className="mb-1.5 block text-[14px] font-medium text-slate-900">
                                                Display name <span className="text-[13px] font-normal text-slate-400">optional</span>
                                            </label>
                                            <input
                                                id="field-display-name"
                                                type="text"
                                                autoComplete="nickname"
                                                maxLength={60}
                                                value={formData.displayName}
                                                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                                aria-describedby="hint-display-name"
                                                className="s-field h-11 text-[15px]"
                                                placeholder="A username or pseudonym, e.g. juandc"
                                            />
                                            <p id="hint-display-name" className="mt-1.5 text-[12px] text-slate-500">What others see on public pages and in teams. Leave it blank to show a shortened real name (“Juan D****”).</p>
                                        </div>

                                        <div>
                                            <label id="label-year" htmlFor="field-year" className="mb-1.5 block text-[14px] font-medium text-slate-900">Member since</label>
                                            <SelectMenu
                                                id="field-year"
                                                labelledBy="label-year"
                                                value={String(formData.yearJoined)}
                                                onChange={(v) => setFormData({ ...formData, yearJoined: Number(v) })}
                                                options={Array.from({ length: new Date().getFullYear() - 2024 }, (_, i) => new Date().getFullYear() - i).map((year) => ({ value: String(year), label: String(year) }))}
                                            />
                                            <p className="mt-1.5 text-[12px] text-slate-500">The year you first joined the community.</p>
                                        </div>
                                    </motion.div>
                                )}

                                {currentStep === 2 && (
                                    <motion.div
                                        key="step2"
                                        initial={{ opacity: 0, x: 12 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -12 }}
                                        transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                                        className="space-y-9"
                                    >
                                        <fieldset>
                                            <legend id="label-specialization" className="text-[15px] font-semibold text-slate-900">
                                                Primary role
                                            </legend>
                                            <p className="mt-1 text-[13px] text-slate-500">Everyone is welcome — tech or not. Pick the closest match and you’ll back it up with skills next.</p>
                                            <div
                                                id="field-specialization"
                                                role="radiogroup"
                                                aria-labelledby="label-specialization"
                                                aria-invalid={!!(error && !formData.specialization)}
                                                aria-describedby={error ? 'register-form-error' : undefined}
                                                tabIndex={-1}
                                                className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2"
                                            >
                                                {ROLE_GROUPS.flatMap((group) => [
                                                    <p key={`group-${group.id}`} className="col-span-full mt-2 flex items-center gap-3 text-[12px] font-medium text-slate-500 first:mt-0">
                                                        {group.label}
                                                        <span aria-hidden className="h-px flex-1 bg-slate-200" />
                                                    </p>,
                                                    ...SPECIALIZATIONS.filter((spec) => (spec.group ?? 'tech') === group.id).map((spec) => {
                                                    const Icon = spec.icon;
                                                    const isSelected = formData.specialization === spec.label;
                                                    return (
                                                        <button
                                                            key={spec.id}
                                                            type="button"
                                                            role="radio"
                                                            aria-checked={isSelected}
                                                            onClick={() => setFormData({ ...formData, specialization: spec.label, secondarySpecialization: formData.secondarySpecialization === spec.label ? '' : formData.secondarySpecialization })}
                                                            className={clsx(
                                                                'group relative flex min-h-[64px] items-start gap-3 rounded-[12px] p-3.5 text-left transition-[box-shadow,background-color,transform] duration-150 active:scale-[0.99]',
                                                                isSelected
                                                                    ? 'bg-[#f4f7ff] shadow-[0_0_0_2px_var(--accent),0_6px_16px_-8px_rgb(30_58_138/0.35)]'
                                                                    : 'bg-white shadow-[0_0_0_1px_rgb(15_23_42/0.12),0_1px_2px_rgb(15_23_42/0.04)] [@media(hover:hover)]:hover:shadow-[0_0_0_1px_rgb(15_23_42/0.2),0_4px_12px_-4px_rgb(15_23_42/0.12)]'
                                                            )}
                                                        >
                                                            <Icon
                                                                size={20}
                                                                strokeWidth={1.75}
                                                                className={clsx('mt-0.5 shrink-0 transition-colors', isSelected ? 'text-[var(--accent)]' : 'text-slate-400 group-hover:text-slate-600')}
                                                                aria-hidden
                                                            />
                                                            <span className="min-w-0 flex-1">
                                                                <span className="block text-[15px] font-semibold leading-snug text-slate-900">{spec.label}</span>
                                                                <span className="mt-1 block text-[13px] leading-snug text-slate-500">
                                                                    {spec.suggestedSkills.slice(0, 3).join(' · ')}
                                                                </span>
                                                            </span>
                                                            <span
                                                                aria-hidden
                                                                className={clsx(
                                                                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-[background-color,box-shadow] duration-150',
                                                                    isSelected ? 'bg-[var(--accent)] text-white' : 'shadow-[inset_0_0_0_1.5px_rgb(148_163_184)]'
                                                                )}
                                                            >
                                                                {isSelected && <Check size={12} strokeWidth={2.5} />}
                                                            </span>
                                                        </button>
                                                    );
                                                    }),
                                                ])}
                                            </div>
                                        </fieldset>

                                        <div>
                                            <label id="label-secondary" htmlFor="field-secondary" className="text-[15px] font-semibold text-slate-900">
                                                Secondary role <span className="text-[13px] font-normal text-slate-400">optional</span>
                                            </label>
                                            <p className="mb-3 mt-1 text-[13px] text-slate-500">Do something else too? A developer who makes videos, a lawyer who teaches. It matches you to more calls.</p>
                                            <SelectMenu
                                                id="field-secondary"
                                                labelledBy="label-secondary"
                                                value={formData.secondarySpecialization}
                                                placeholder="None"
                                                options={[
                                                    { value: '', label: 'None' },
                                                    ...SPECIALIZATIONS.filter((sp) => sp.label !== formData.specialization).map((sp) => ({
                                                        value: sp.label, label: sp.label, icon: sp.icon,
                                                        hint: sp.suggestedSkills.slice(0, 3).join(' · '),
                                                        group: ROLE_GROUPS.find((g) => g.id === (sp.group ?? 'tech'))?.label,
                                                    })),
                                                ]}
                                                onChange={(v) => setFormData({ ...formData, secondarySpecialization: v })}
                                            />
                                        </div>

                                        <div className="rounded-[12px] bg-slate-50 px-4 py-3 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.05)]">
                                            <p className="text-[14px] font-medium text-slate-900">Everyone starts as a Member</p>
                                            <p className="mt-0.5 text-[13px] text-slate-500">Fellow, Contributor and other community roles are given by the admins as you take part.</p>
                                        </div>

                                        <fieldset>
                                            <legend className="text-[15px] font-semibold text-slate-900">Experience</legend>
                                            <p className="mt-1 text-[13px] text-slate-500">Hands-on years in your field.</p>
                                            <div role="radiogroup" className="mt-4 grid grid-cols-2 gap-1 rounded-[12px] bg-slate-100 p-1 sm:grid-cols-4">
                                                {EXPERIENCE_LEVELS.map((level, li) => {
                                                    const isSelected = formData.experienceLevel === level;
                                                    const years = ['Under 1 year', '1–3 years', '3–6 years', '6+ years'][li] || '';
                                                    return (
                                                        <button
                                                            key={level}
                                                            type="button"
                                                            role="radio"
                                                            aria-checked={isSelected}
                                                            onClick={() => setFormData({ ...formData, experienceLevel: level })}
                                                            className={clsx(
                                                                'flex min-h-[52px] flex-col items-center justify-center rounded-[9px] px-2 py-2 transition-[background-color,box-shadow,color] duration-150',
                                                                isSelected ? 'bg-white shadow-[var(--e1)]' : '[@media(hover:hover)]:hover:bg-white/60'
                                                            )}
                                                        >
                                                            <span className={clsx('text-[13px] font-semibold', isSelected ? 'text-[var(--accent)]' : 'text-slate-700')}>{level}</span>
                                                            <span className="num mt-0.5 text-[12px] text-slate-500">{years}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </fieldset>
                                    </motion.div>
                                )}

                                {currentStep === 3 && (
                                    <motion.div
                                        key="step3"
                                        initial={{ opacity: 0, x: 12 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -12 }}
                                        transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                                        className="space-y-9"
                                    >
                                        <SkillsPicker
                                            skills={formData.skills}
                                            onChange={(skills) => setFormData({ ...formData, skills })}
                                            specialization={formData.specialization}
                                            onSpecializationChange={(specialization) => setFormData({ ...formData, specialization })}
                                            invalid={!!(error && (formData.skills.length === 0 || !formData.skills.every((s) => s.level)))}
                                            describedBy={error ? 'register-form-error' : undefined}
                                        />
                                    </motion.div>
                                )}

                                {currentStep === 4 && (
                                    <motion.div
                                        key="step4"
                                        initial={{ opacity: 0, x: 12 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -12 }}
                                        transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                                        className="space-y-3"
                                    >
                                        {/* Data Privacy Act consent — required to submit */}
                                        <div className="rounded-[14px] bg-white p-4 shadow-[0_0_0_1px_rgb(15_23_42/0.12),0_2px_6px_-2px_rgb(15_23_42/0.08)] sm:p-5">
                                            <p className="text-[15px] font-semibold text-slate-900">How we use your information</p>
                                            <p className="mb-4 mt-0.5 text-[13px] leading-snug text-slate-500">
                                                Under the Data Privacy Act we only use your details for what you agree to here.
                                            </p>
                                            <ConsentFields
                                                idPrefix="reg-consent"
                                                value={formData.consent}
                                                onChange={(consent) => { setFormData({ ...formData, consent }); setConsentError(''); }}
                                                error={consentError}
                                            />
                                            <label htmlFor="reg-coc" className="mt-3 flex cursor-pointer items-start gap-3 rounded-[12px] bg-white p-3 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.1)] hover:bg-slate-50">
                                                <input
                                                    id="reg-coc"
                                                    type="checkbox"
                                                    checked={cocAgreed}
                                                    onChange={(e) => { setCocAgreed(e.target.checked); setCocError(''); }}
                                                    aria-describedby={cocError ? 'reg-coc-error' : undefined}
                                                    className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--accent)]"
                                                />
                                                <span className="text-[14px] text-slate-900">
                                                    I agree to the <a href="/code-of-conduct" target="_blank" rel="noreferrer" className="s-link">code of conduct</a>
                                                    <span className="ml-2 rounded-full bg-slate-900/5 px-1.5 py-px text-[10.5px] font-medium text-slate-600">Required</span>
                                                    <span className="mt-0.5 block text-[12.5px] text-slate-500">Respect everyone, work in the open, no harassment or sharing others’ personal information.</span>
                                                </span>
                                            </label>
                                            {cocError && <p id="reg-coc-error" role="alert" className="mt-2 text-[12.5px] text-red-700">{cocError}</p>}
                                        </div>

                                        {/* Channels & links — optional, platforms picked for the chosen role */}
                                        {(() => {
                                            const trackId = trackForRole(formData.specialization).id;
                                            return (
                                                <div className="rounded-[14px] bg-white p-4 shadow-[0_0_0_1px_rgb(15_23_42/0.12),0_2px_6px_-2px_rgb(15_23_42/0.08)] sm:p-5">
                                                    <p className="flex flex-wrap items-center gap-x-2 text-[15px] font-semibold text-slate-900">
                                                        Your channels & links
                                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">Optional</span>
                                                    </p>
                                                    <p className="mb-4 mt-0.5 text-[13px] leading-snug text-slate-500">{LINKS_INTRO[trackId]}</p>
                                                    <LinksFields
                                                        idPrefix="reg-link"
                                                        trackId={trackId}
                                                        links={formData.links}
                                                        onChange={(links) => setFormData({ ...formData, links })}
                                                        errors={linkErrors}
                                                        onClearError={(k) => setLinkErrors((prev) => ({ ...prev, [k]: undefined }))}
                                                        expanded={Object.keys(linkErrors).length > 0}
                                                    />
                                                </div>
                                            );
                                        })()}

                                        {/* Discord — shown once linking is available, or if already connected */}
                                        {(DISCORD_AVAILABLE || discordConnected) && (
                                        <div
                                            className={clsx(
                                                'rounded-[14px] p-4 transition-[box-shadow,background-color] duration-200 sm:p-5',
                                                discordConnected
                                                    ? 'bg-[#f3fbf7] shadow-[0_0_0_1.5px_rgb(16_185_129/0.45)]'
                                                    : 'bg-white shadow-[0_0_0_1px_rgb(15_23_42/0.12),0_2px_6px_-2px_rgb(15_23_42/0.08)]'
                                            )}
                                        >
                                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                                <div className="flex min-w-0 flex-1 items-center gap-3.5">
                                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#5865F2] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(15_23_42/0.2)]">
                                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                                                        </svg>
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="flex flex-wrap items-center gap-x-2 text-[15px] font-semibold text-slate-900">
                                                            Discord
                                                            {!discordConnected && (
                                                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">Optional</span>
                                                            )}
                                                        </p>
                                                        <p className="mt-0.5 text-[13px] leading-snug text-slate-500">
                                                            {discordConnected ? (
                                                                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                                                                    <Check size={14} strokeWidth={2.5} />
                                                                    {discordUsername ? `Connected as @${discordUsername}` : 'Connected'}
                                                                </span>
                                                            ) : (
                                                                DISCORD_AVAILABLE
                                                                    ? 'You can skip this and connect later from your Profile. We only read your username.'
                                                                    : 'Linking is coming soon. Submit now — you can connect it later from your Profile.'
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                                {!discordConnected && !DISCORD_AVAILABLE && (
                                                    <span className={COMING_SOON_PILL}>Coming soon</span>
                                                )}
                                                {!discordConnected && DISCORD_AVAILABLE && (
                                                    <button
                                                        type="button"
                                                        onClick={handleConnectDiscord}
                                                        disabled={discordConnecting}
                                                        className="s-btn h-10 shrink-0 bg-[#5865F2] px-4 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(15_23_42/0.25)] [@media(hover:hover)]:hover:bg-[#4752C4]"
                                                    >
                                                        {discordConnecting ? <>Connecting…</> : 'Connect Discord'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        )}

                                        <ComingSoonConnections showDiscord={!DISCORD_AVAILABLE && !discordConnected} />
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {!(currentStep === 1 && !hasSession) && (
                                <div className="flex w-full flex-col-reverse gap-2.5 pt-2 sm:flex-row sm:items-center sm:justify-between">
                                    {currentStep > 1 ? (
                                        <button type="button" onClick={prevStep} className="s-btn text-[var(--fg-2)] hover:text-[var(--fg)] sm:-ml-3">
                                            <ArrowLeft size={16} strokeWidth={1.75} />
                                            Back
                                        </button>
                                    ) : <span />}

                                    {currentStep < 3 ? (
                                        <button key="continue-step" type="button" onClick={nextStep} className="s-btn s-btn-accent min-w-[140px]">
                                            Continue
                                            <ArrowRight size={16} strokeWidth={1.75} />
                                        </button>
                                    ) : currentStep === 3 ? (
                                        <button key="submit-step" type="submit" disabled={loading} className="s-btn s-btn-accent min-w-[140px]">
                                            {loading ? <>Saving…</> : <>Continue<ArrowRight size={16} strokeWidth={1.75} /></>}
                                        </button>
                                    ) : (
                                        <div className="flex flex-col items-stretch gap-2 sm:items-end">
                                            <button
                                                key="complete-step"
                                                type="button"
                                                onClick={handleComplete}
                                                disabled={completing}
                                                className="s-btn s-btn-accent min-w-[180px]"
                                            >
                                                {completing ? 'Saving…' : 'Submit application'}
                                            </button>
                                            {!discordConnected && (
                                                <p className="text-[12px] text-[var(--fg-3)]">{DISCORD_AVAILABLE ? 'You can connect Discord later from Profile.' : 'You can change all of this later in Profile.'}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </form>
                    </div>
                </motion.div>

                <p className="mt-6 text-center text-[14px] text-[var(--fg-3)]">
                    Already a member? <Link to="/login" className="s-link">Sign in</Link>
                </p>
            </div>
            <AnimatePresence>
                {showSuccessModal && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] bg-slate-900/40"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="reg-success-title"
                        >
                            <div className="w-full max-w-sm rounded-[22px] bg-white p-7 shadow-[0_2px_4px_rgb(15_23_42/0.04),0_24px_60px_-12px_rgb(15_23_42/0.3),0_0_0_1px_rgb(15_23_42/0.06)]">
                                <p className="inline-flex items-center gap-2 text-[13px] font-medium text-slate-600">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                                    Pending review
                                </p>
                                <h2 id="reg-success-title" className="mt-3 text-[22px]">Application sent</h2>
                                <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
                                    Thanks for applying. An admin will review it, and your Volunteer Card goes live once it’s approved.
                                </p>
                                <button
                                    onClick={() => { clearDraft(); navigate(takeReturnTo() || '/dashboard'); }}
                                    className="s-btn s-btn-accent mt-7 w-full"
                                >
                                    Go to your dashboard
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

export default LegacyRegister;
