import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { AccessCard } from '../../components/AccessCard';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { motion } from 'framer-motion';
import { ShieldAlert, CheckCircle2, Clock, LogOut, Download, Copy, Code, Check, Info, Zap, User, Mail, Calendar, Award, MapPin, ExternalLink, Share2, Sparkles } from 'lucide-react';
import html2canvas from 'html2canvas';
import clsx from 'clsx';
import { skillToSlug } from '../../utils/skillUtils';
import { createVolunteerCall, getMyProjectSubmissions, getVolunteerCalls, submitProjectSubmission, supabase } from '../../services/supabase';
import { ProjectSubmission, VolunteerCall } from '../../types';

export default function UserDashboard() {
  const { currentUser, authInitialized } = useStore();
  const logout = useStore((s) => s.logout);
  const navigate = useNavigate();
  const [downloadLoading, setDownloadLoading] = React.useState(false);
  const [copyStatus, setCopyStatus] = React.useState<'idle' | 'copied' | 'embed-copied'>('idle');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'submit-project' | 'volunteer'>('dashboard');
  const [projectName, setProjectName] = useState('');
  const [projectUrl, setProjectUrl] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectProjType, setProjectProjType] = useState('');
  const [projectSubmitStatus, setProjectSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [projectSubmitMessage, setProjectSubmitMessage] = useState<string>('');
  const [mySubmissions, setMySubmissions] = useState<ProjectSubmission[]>([]);
  const [mySubmissionsLoading, setMySubmissionsLoading] = useState(false);
  const [mySubmissionsError, setMySubmissionsError] = useState<string>('');
  const [volunteerTitle, setVolunteerTitle] = useState('');
  const [volunteerProjectUrl, setVolunteerProjectUrl] = useState('');
  const [volunteerDescription, setVolunteerDescription] = useState('');
  const [volunteerRolesNeeded, setVolunteerRolesNeeded] = useState('');
  const [volunteerContact, setVolunteerContact] = useState('');
  const [volunteerSubmitStatus, setVolunteerSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [volunteerSubmitMessage, setVolunteerSubmitMessage] = useState('');
  const [volunteerCalls, setVolunteerCalls] = useState<VolunteerCall[]>([]);
  const [volunteerCallsLoading, setVolunteerCallsLoading] = useState(false);
  const [volunteerCallsError, setVolunteerCallsError] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (authInitialized && currentUser?.isAdmin && !isRedirecting) {
      setIsRedirecting(true);
      navigate('/admin', { replace: true });
    }
  }, [currentUser?.isAdmin, navigate, authInitialized, isRedirecting]);

  if (!authInitialized || !currentUser || isRedirecting) return <LoadingOverlay />;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const getStatusIcon = () => {
    switch (currentUser.status) {
      case 'Approved': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'Declined': return <ShieldAlert className="w-5 h-5 text-red-500" />;
      default: return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/verify/${currentUser.memberId || currentUser.id}`;
    navigator.clipboard.writeText(url);
    setCopyStatus('copied');
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

  const handleCopyEmbed = () => {
    const url = `${window.location.origin}/verify/${currentUser.memberId || currentUser.id}`;
    const embedCode = `<iframe src="${url}?embed=true" width="320" height="480" frameborder="0"></iframe>`;
    navigator.clipboard.writeText(embedCode);
    setCopyStatus('embed-copied');
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

  const loadMySubmissions = async () => {
    setMySubmissionsLoading(true);
    setMySubmissionsError('');
    try {
      const { submissions } = await getMyProjectSubmissions(0, 50);
      setMySubmissions(submissions);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : typeof err?.message === 'string' ? err.message : 'Failed to load submissions';
      setMySubmissionsError(message);
    } finally {
      setMySubmissionsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'submit-project') return;
    loadMySubmissions();
  }, [activeTab]);

  const loadVolunteerCalls = async () => {
    setVolunteerCallsLoading(true);
    setVolunteerCallsError('');
    try {
      const { calls } = await getVolunteerCalls();
      setVolunteerCalls(calls);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : typeof err?.message === 'string' ? err.message : 'Failed to load volunteer calls';
      setVolunteerCallsError(message);
    } finally {
      setVolunteerCallsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'volunteer') return;
    loadVolunteerCalls();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'submit-project') {
      loadMySubmissions();
      const interval = setInterval(loadMySubmissions, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'volunteer') {
      loadVolunteerCalls();
      const interval = setInterval(loadVolunteerCalls, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!currentUser) return;

    const projectsChannel = supabase
      .channel('user-projects-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_submissions',
          filter: `user_id=eq.${currentUser.id}`,
        },
        () => {
          loadMySubmissions();
        }
      )
      .subscribe();

    const volunteerChannel = supabase
      .channel('user-volunteer-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'volunteer_calls',
        },
        () => {
          console.log('Real-time: Volunteer calls changed');
          loadVolunteerCalls();
        }
      )
      .subscribe();

    return () => {
      projectsChannel.unsubscribe();
      volunteerChannel.unsubscribe();
    };
  }, [currentUser]);

  const handleVolunteerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!volunteerTitle.trim() || !volunteerProjectUrl.trim() || !volunteerDescription.trim()) {
      setVolunteerSubmitStatus('error');
      setVolunteerSubmitMessage('Title, Project URL, and Description are required.');
      return;
    }
    setVolunteerSubmitStatus('loading');
    setVolunteerSubmitMessage('');
    try {
      const res = await createVolunteerCall({
        title: volunteerTitle.trim(),
        projectUrl: volunteerProjectUrl.trim(),
        description: volunteerDescription.trim(),
        rolesNeeded: volunteerRolesNeeded.trim() || undefined,
        contact: volunteerContact.trim() || undefined,
      });
      setVolunteerSubmitStatus('success');
      setVolunteerSubmitMessage(res?.message || 'Posted successfully!');
      setVolunteerTitle('');
      setVolunteerProjectUrl('');
      setVolunteerDescription('');
      setVolunteerRolesNeeded('');
      setVolunteerContact('');
      if (activeTab === 'volunteer') {
        loadVolunteerCalls();
      }
    } catch (err: any) {
      const message = err instanceof Error ? err.message : typeof err?.message === 'string' ? err.message : 'Failed to post';
      setVolunteerSubmitStatus('error');
      setVolunteerSubmitMessage(message);
    }
  };

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !projectUrl.trim() || !projectDescription.trim()) {
      setProjectSubmitStatus('error');
      setProjectSubmitMessage('Project Name, Project URL, and Description are required.');
      return;
    }
    setProjectSubmitStatus('loading');
    setProjectSubmitMessage('');
    try {
      const res = await submitProjectSubmission({
        projectName: projectName.trim(),
        projectUrl: projectUrl.trim(),
        description: projectDescription.trim(),
        projType: projectProjType.trim() || undefined,
      });
      setProjectSubmitStatus('success');
      setProjectSubmitMessage(res?.message || 'Submitted successfully!');
      setProjectName('');
      setProjectUrl('');
      setProjectDescription('');
      setProjectProjType('');
      if (activeTab === 'submit-project') {
        loadMySubmissions();
      }
    } catch (err: any) {
      const message = err instanceof Error ? err.message : typeof err?.message === 'string' ? err.message : 'Submission failed';
      setProjectSubmitStatus('error');
      setProjectSubmitMessage(message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 pb-12 sm:pb-0">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 sm:h-20">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <img src="/logo.svg" alt="BetterGovPH Logo" className="w-7 h-7 sm:w-8 sm:h-8 object-contain brightness-0" />
              <span className="text-lg sm:text-xl font-display font-bold text-slate-900 truncate">BetterGovPH Community</span>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="h-6 w-[1px] bg-slate-200" />
              <div className="flex flex-col items-end">
                <span className="text-xs sm:text-sm font-semibold text-slate-900 leading-none truncate max-w-[100px] sm:max-w-none">
                  {currentUser.fullName.split(' ')[0]}
                </span>
                <span className="text-[9px] sm:text-[10px] font-medium text-slate-400 uppercase tracking-wider mt-1">{currentUser.role}</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-[64px] sm:top-[80px] z-40 overflow-x-auto no-scrollbar">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-w-max sm:min-w-0">
          <div className="flex space-x-4 sm:space-x-8">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={clsx(
                "py-4 text-sm font-bold border-b-2 transition-all px-1",
                activeTab === 'dashboard'
                  ? "border-blue-900 text-blue-900"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              )}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('submit-project')}
              className={clsx(
                "py-4 text-sm font-bold border-b-2 transition-all px-1",
                activeTab === 'submit-project'
                  ? "border-blue-900 text-blue-900"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              )}
            >
              Submit Project
            </button>
            <button
              onClick={() => setActiveTab('volunteer')}
              className={clsx(
                "py-4 text-sm font-bold border-b-2 transition-all px-1",
                activeTab === 'volunteer'
                  ? "border-blue-900 text-blue-900"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              )}
            >
              Volunteers
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'dashboard' ? (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">

          {/* Left Column: Status and Info */}
          <div className="lg:col-span-7 space-y-6 order-2 lg:order-1">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white sm:rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100/80"
            >
              <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-4 sm:mb-6">Application Status</h2>
              <div className={clsx(
                "flex items-start sm:items-center space-x-4 p-5 rounded-xl border",
                currentUser.status === 'Approved' ? 'bg-emerald-50/50 border-emerald-200/60' :
                  currentUser.status === 'Declined' ? 'bg-red-50/50 border-red-200/60' :
                    'bg-amber-50/50 border-amber-200/60'
              )}>
                <div className="mt-0.5 sm:mt-0">{getStatusIcon()}</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{currentUser.status}</p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {currentUser.status === 'Approved' ? 'Your application has been approved. Your ID is ready.' :
                      currentUser.status === 'Declined' ? 'Your application was declined by the administrator.' :
                        'Your application is currently under review by our team.'}
                  </p>
                </div>
              </div>

              {currentUser.adminNotes && (
                <div className="mt-5 p-5 bg-slate-50/80 rounded-xl border border-slate-100/80">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Admin Notes</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{currentUser.adminNotes}</p>
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white sm:rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100/80"
            >
              <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-4 sm:mb-6">Profile Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 sm:gap-x-8">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Full Name</p>
                  <p className="text-sm font-medium text-slate-900 truncate">{currentUser.fullName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Email</p>
                  <p className="text-sm font-medium text-slate-900 break-all">{currentUser.email}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Discord</p>
                  <p className="text-sm font-medium text-slate-900 truncate">{currentUser.discordUsername}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Primary Role</p>
                  <p className="text-sm font-medium text-slate-900">{currentUser.specialization}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Community Role</p>
                  <p className="text-sm font-medium text-slate-900">{currentUser.role}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Member Since</p>
                  <p className="text-sm font-medium text-slate-900">{currentUser.yearJoined || '-'}</p>
                </div>
                {currentUser.memberId && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Member ID</p>
                    <p className="text-sm font-mono font-semibold text-blue-600">{currentUser.memberId}</p>
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white sm:rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100/80"
            >
              <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-6">Skills & Expertise</h2>

              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-4">Core Skills</p>
                  <div className="flex flex-wrap gap-3">
                    {currentUser.skills && currentUser.skills.length > 0 ? (
                      currentUser.skills.map((skill, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 pl-3 pr-4 py-3 bg-white border border-slate-100/80 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 group"
                        >
                          <div className="w-11 h-11 rounded-lg bg-slate-50/80 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-50/80 transition-colors border border-slate-100/60">
                            <img
                              src={`https://cdn.simpleicons.org/${skillToSlug(skill.name)}`}
                              className="w-5 h-5 object-contain opacity-80 group-hover:opacity-100 transition-opacity"
                              alt=""
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                const fallback = (e.target as HTMLImageElement).nextElementSibling;
                                if (fallback) (fallback as HTMLElement).style.display = 'block';
                              }}
                            />
                            <Code size={16} style={{ display: 'none' }} className="text-slate-400" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-800 leading-tight">{skill.name}</span>
                            <div className="flex items-center gap-1.5 mt-1">
                              {skill.level === 'Expert' ? <Zap size={8} className="text-blue-600 fill-blue-600" /> :
                               skill.level === 'Practitioner' ? <CheckCircle2 size={8} className="text-blue-500" /> :
                               <Clock size={8} className="text-slate-400" />}
                              <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">
                                {skill.level === 'Expert' ? 'Expert' :
                                 skill.level === 'Practitioner' ? 'Practitioner' : 'Learner'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500 italic">No skills listed</p>
                    )}
                  </div>
                </div>

                <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Experience Level</p>
                    <p className="text-sm font-semibold text-slate-900">{currentUser.experienceLevel || '-'}</p>
                  </div>
              </div>
            </motion.div>

          </div>

          {/* Right Column: Digital ID */}
          <div id="digital-card-section" className="lg:col-span-5 order-1 lg:order-2">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:sticky lg:top-24 flex flex-col items-center"
            >
              <div className="w-full flex justify-between items-center mb-6 px-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900">Digital Access Card</h2>
                  <div className="group relative">
                  </div>
                </div>
                {currentUser.status === 'Approved' && (
                  <span className="px-3 py-1.5 bg-emerald-100/80 text-emerald-800 text-[10px] sm:text-xs font-semibold rounded-lg uppercase tracking-wide">
                    Ready to use
                  </span>
                )}
              </div>

              <div className={clsx(
                "relative group transition-all duration-500 max-w-full flex justify-center",
                currentUser.status !== 'Approved' && "opacity-50 grayscale pointer-events-none blur-[2px]"
              )}>
                <AccessCard user={currentUser} />

                {currentUser.status !== 'Approved' && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
                    <div className="bg-white/95 backdrop-blur-sm px-8 py-5 rounded-2xl shadow-xl border border-slate-200/80 text-center">
                      <p className="text-sm font-semibold text-slate-800">Card Unavailable</p>
                      <p className="text-xs text-slate-500 mt-1">Pending Approval</p>
                    </div>
                  </div>
                )}
              </div>

              {currentUser.status === 'Approved' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="w-full mt-6 sm:mt-8 px-2 sm:px-0"
                >
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handleCopyLink}
                      className="flex items-center justify-center gap-2 w-full py-4 bg-slate-900 text-white rounded-xl font-semibold text-sm hover:bg-slate-800 transition-all duration-200 shadow-lg active:scale-[0.98]"
                    >
                      {copyStatus === 'copied' ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Link Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy Public Link</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleCopyEmbed}
                      className="flex items-center justify-center gap-2 w-full py-4 bg-white border border-slate-200/80 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-all duration-200 shadow-sm active:scale-[0.98]"
                    >
                      {copyStatus === 'embed-copied' ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Code Copied</span>
                        </>
                      ) : (
                        <>
                          <Code className="w-4 h-4" />
                          <span>Copy Embed Code</span>
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </div>

          </div>
        </main>
      ) : activeTab === 'submit-project' ? (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="bg-white sm:rounded-2xl shadow-sm border border-slate-100/80 overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-slate-100">
              <h2 className="text-base sm:text-lg font-semibold text-slate-900">Submit a New Project</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Submit your project for admin review. Approved projects will appear in the main projects list.
              </p>
            </div>

            <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <form onSubmit={handleProjectSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Project Name
                    </label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                      placeholder="e.g., BetterGovPH Tracker"
                      disabled={projectSubmitStatus === 'loading'}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Project URL (GitHub / Demo / Docs)
                    </label>
                    <input
                      type="text"
                      value={projectUrl}
                      onChange={(e) => setProjectUrl(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                      placeholder="https://github.com/..."
                      disabled={projectSubmitStatus === 'loading'}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Description
                    </label>
                    <textarea
                      value={projectDescription}
                      onChange={(e) => setProjectDescription(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all min-h-[140px] resize-none"
                      placeholder="What is this project about?"
                      disabled={projectSubmitStatus === 'loading'}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Project Type
                    </label>
                    <select
                      value={projectProjType}
                      onChange={(e) => setProjectProjType(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                      disabled={projectSubmitStatus === 'loading'}
                    >
                      <option value="">Select type</option>
                      <option value="web">Web</option>
                      <option value="api">API</option>
                      <option value="mobile">Mobile</option>
                      <option value="data">Data</option>
                      <option value="policy">Policy</option>
                      <option value="blockchain">Blockchain</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {projectSubmitMessage && (
                    <div
                      className={clsx(
                        'px-4 py-3 rounded-xl text-sm border',
                        projectSubmitStatus === 'success'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-red-50 border-red-200 text-red-900'
                      )}
                    >
                      {projectSubmitMessage}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={projectSubmitStatus === 'loading'}
                    className={clsx(
                      'w-full py-4 rounded-xl font-semibold text-sm transition-all duration-200 shadow-sm active:scale-[0.98]',
                      projectSubmitStatus === 'loading'
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        : 'bg-blue-900 text-white hover:bg-blue-800'
                    )}
                  >
                    {projectSubmitStatus === 'loading' ? 'Submitting...' : 'Submit'}
                  </button>
                </form>
              </div>

              <div className="bg-slate-50 border border-slate-200/70 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 bg-white border-b border-slate-200/70 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-900">My Submitted Projects</p>
                    <p className="text-xs text-slate-500 mt-1">Loaded only when this tab is open.</p>
                  </div>
                  <button
                    onClick={loadMySubmissions}
                    disabled={mySubmissionsLoading}
                    className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  >
                    Refresh
                  </button>
                </div>

                <div className="p-5 h-[60vh] lg:h-[70vh] overflow-y-auto overscroll-contain">
                  {mySubmissionsLoading ? (
                    <div className="text-sm text-slate-600">Loading...</div>
                  ) : mySubmissionsError ? (
                    <div className="text-sm text-red-700">{mySubmissionsError}</div>
                  ) : mySubmissions.length === 0 ? (
                    <div className="text-sm text-slate-600">No submissions yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {mySubmissions.map((s) => (
                        <div key={s.id} className="bg-white border border-slate-200/70 rounded-xl p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">{s.projectName}</p>
                              <a
                                href={s.projectUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-blue-700 hover:underline break-all"
                              >
                                {s.projectUrl}
                              </a>
                            </div>
                            <span
                              className={clsx(
                                'px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border',
                                s.status === 'approved'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : s.status === 'rejected'
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                              )}
                            >
                              {s.status}
                            </span>
                          </div>

                          <p className="mt-3 text-xs text-slate-600 whitespace-pre-wrap break-words">{s.description}</p>

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                            <span className="font-semibold uppercase tracking-wider">
                              {s.createdAt ? new Date(s.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : ''}
                            </span>
                            {s.projType && (
                              <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 font-semibold">
                                {s.projType}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      ) : (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="bg-white sm:rounded-2xl shadow-sm border border-slate-100/80 overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-slate-100">
              <h2 className="text-base sm:text-lg font-semibold text-slate-900">Volunteer Hub</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Post a volunteer call for your project and browse open volunteer opportunities.
              </p>
            </div>

            <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <form onSubmit={handleVolunteerSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Project / Role Title
                    </label>
                    <input
                      type="text"
                      value={volunteerTitle}
                      onChange={(e) => setVolunteerTitle(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                      placeholder="e.g., Need Frontend Dev for Civic App"
                      disabled={volunteerSubmitStatus === 'loading'}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Project URL
                    </label>
                    <input
                      type="text"
                      value={volunteerProjectUrl}
                      onChange={(e) => setVolunteerProjectUrl(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                      placeholder="https://github.com/..."
                      disabled={volunteerSubmitStatus === 'loading'}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Details
                    </label>
                    <textarea
                      value={volunteerDescription}
                      onChange={(e) => setVolunteerDescription(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all min-h-[140px] resize-none"
                      placeholder="What help do you need? Scope, timeline, requirements..."
                      disabled={volunteerSubmitStatus === 'loading'}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      (Optional) Roles Needed
                    </label>
                    <input
                      type="text"
                      value={volunteerRolesNeeded}
                      onChange={(e) => setVolunteerRolesNeeded(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                      placeholder="Frontend, Backend, UI/UX..."
                      disabled={volunteerSubmitStatus === 'loading'}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      (Optional) Contact
                    </label>
                    <input
                      type="text"
                      value={volunteerContact}
                      onChange={(e) => setVolunteerContact(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                      placeholder="Discord / Email / Link"
                      disabled={volunteerSubmitStatus === 'loading'}
                    />
                  </div>

                  {volunteerSubmitMessage && (
                    <div
                      className={clsx(
                        'px-4 py-3 rounded-xl text-sm border',
                        volunteerSubmitStatus === 'success'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-red-50 border-red-200 text-red-900'
                      )}
                    >
                      {volunteerSubmitMessage}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={volunteerSubmitStatus === 'loading'}
                    className={clsx(
                      'w-full py-4 rounded-xl font-semibold text-sm transition-all duration-200 shadow-sm active:scale-[0.98]',
                      volunteerSubmitStatus === 'loading'
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        : 'bg-blue-900 text-white hover:bg-blue-800'
                    )}
                  >
                    {volunteerSubmitStatus === 'loading' ? 'Posting...' : 'Post Volunteer Call'}
                  </button>
                </form>
              </div>

              <div className="bg-slate-50 border border-slate-200/70 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 bg-white border-b border-slate-200/70 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Open Volunteer Calls</p>
                    <p className="text-xs text-slate-500 mt-1">Loaded only when this tab is open.</p>
                  </div>
                  <button
                    onClick={loadVolunteerCalls}
                    disabled={volunteerCallsLoading}
                    className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  >
                    Refresh
                  </button>
                </div>

                <div className="p-5 h-[60vh] lg:h-[70vh] overflow-y-auto overscroll-contain">
                  {volunteerCallsLoading ? (
                    <div className="text-sm text-slate-600">Loading...</div>
                  ) : volunteerCallsError ? (
                    <div className="text-sm text-red-700">{volunteerCallsError}</div>
                  ) : volunteerCalls.length === 0 ? (
                    <div className="text-sm text-slate-600">No open volunteer calls yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {volunteerCalls.map((c) => (
                        <div key={c.id} className="bg-white border border-slate-200/70 rounded-xl p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900">{c.title}</p>
                              <a
                                href={c.projectUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-blue-700 hover:underline break-all"
                              >
                                {c.projectUrl}
                              </a>
                              {c.postedBy?.fullName && (
                                <p className="mt-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                                  Posted by {c.postedBy.fullName}
                                </p>
                              )}
                            </div>
                            <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border bg-emerald-50 text-emerald-700 border-emerald-200">
                              open
                            </span>
                          </div>

                          <p className="mt-3 text-xs text-slate-600 whitespace-pre-wrap break-words">{c.description}</p>

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                            <span className="font-semibold uppercase tracking-wider">
                              {c.createdAt ? new Date(c.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : ''}
                            </span>
                            {c.rolesNeeded && (
                              <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 font-semibold">
                                {c.rolesNeeded}
                              </span>
                            )}
                            {c.contact && (
                              <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 font-semibold">
                                {c.contact}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      )}
    </div>

  );
}
