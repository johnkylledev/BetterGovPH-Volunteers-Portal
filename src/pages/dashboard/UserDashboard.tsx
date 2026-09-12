import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { AccessCard } from '../../components/AccessCard';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { motion } from 'framer-motion';
import { ShieldAlert, CheckCircle2, Clock, LogOut, Copy, Code, Check, Info, Zap, User, Mail, Calendar, Award, MapPin, ExternalLink, Share2, Sparkles, Edit3, Trash2, X, Lock, Unlock, FolderPlus, Users, FileText, AlertCircle, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { SkillIcon } from '../../components/SkillIcon';
import { createVolunteerCall, deleteVolunteerCall, updateVolunteerCall, getMyProjectSubmissions, getVolunteerCalls, submitProjectSubmission, supabase } from '../../services/supabase';
import { ProjectSubmission, VolunteerCall } from '../../types';
import { formatExternalUrl } from '../../utils/skillUtils';

const SkeletonBars = () => (
  <div className="flex flex-col gap-2">
    <div className="bg-slate-100 animate-pulse h-10 w-full rounded-[6px]" />
    <div className="bg-slate-100 animate-pulse h-10 w-full rounded-[6px]" />
    <div className="bg-slate-100 animate-pulse h-10 w-full rounded-[6px]" />
  </div>
);

const ButtonProgressBar = () => (
  <div className="absolute bottom-0 left-0 w-full h-[2px] overflow-hidden rounded-b-[6px]">
    <div
      className="h-full bg-blue-500 rounded-b-[6px]"
      style={{
        animation: 'progress 1.5s ease-in-out infinite',
        width: '100%',
        transformOrigin: 'left',
      }}
    />
  </div>
);

export default function UserDashboard() {
  const { currentUser, authInitialized } = useStore();
  const logout = useStore((s) => s.logout);
  const navigate = useNavigate();
  const [copyStatus, setCopyStatus] = React.useState<'idle' | 'copied' | 'embed-copied'>('idle');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'submit-project' | 'volunteer'>('dashboard');
  const [projectName, setProjectName] = useState('');
  const [projectUrl, setProjectUrl] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectProjType, setProjectProjType] = useState('');
  const [projectSubmitStatus, setProjectSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [mySubmissions, setMySubmissions] = useState<ProjectSubmission[]>([]);
  const [mySubmissionsLoading, setMySubmissionsLoading] = useState(false);
  const [mySubmissionsError, setMySubmissionsError] = useState<string>('');
  const [volunteerTitle, setVolunteerTitle] = useState('');
  const [volunteerProjectUrl, setVolunteerProjectUrl] = useState('');
  const [volunteerDescription, setVolunteerDescription] = useState('');
  const [volunteerRolesNeeded, setVolunteerRolesNeeded] = useState('');
  const [volunteerContact, setVolunteerContact] = useState('');
  const [volunteerSubmitStatus, setVolunteerSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [volunteerCalls, setVolunteerCalls] = useState<VolunteerCall[]>([]);
  const [volunteerCallsLoading, setVolunteerCallsLoading] = useState(false);
  const [volunteerCallsError, setVolunteerCallsError] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);

  const resetVolunteerForm = () => {
    setVolunteerTitle('');
    setVolunteerProjectUrl('');
    setVolunteerDescription('');
    setVolunteerRolesNeeded('');
    setVolunteerContact('');
    setVolunteerSubmitStatus('idle');
  };

  const handleToggleCallStatus = async (call: VolunteerCall) => {
    const newStatus = call.status === 'closed' ? 'open' : 'closed';
    try {
      await updateVolunteerCall(call.id, {
        title: call.title,
        projectUrl: call.projectUrl,
        description: call.description,
        rolesNeeded: call.rolesNeeded,
        contact: call.contact,
        status: newStatus,
      });
      loadVolunteerCalls(false);
      toast.success(newStatus === 'open' ? 'Call re-opened' : 'Call closed');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status');
      console.error('Failed to toggle call status:', err);
    }
  };

  // Volunteer Call Manage Modal State
  const [selectedCallForModal, setSelectedCallForModal] = useState<VolunteerCall | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editProjectUrl, setEditProjectUrl] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editRolesNeeded, setEditRolesNeeded] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editStatus, setEditStatus] = useState<'open' | 'closed'>('open');
  const [modalActionStatus, setModalActionStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [confirmDeleteCallId, setConfirmDeleteCallId] = useState<string | null>(null);
  const [volunteerFilter, setVolunteerFilter] = useState<'all' | 'mine'>('all');

  const openManageModal = (call: VolunteerCall) => {
    setSelectedCallForModal(call);
    setEditTitle(call.title);
    setEditProjectUrl(call.projectUrl);
    setEditDescription(call.description);
    setEditRolesNeeded(call.rolesNeeded || '');
    setEditContact(call.contact || '');
    setEditStatus((call.status as 'open' | 'closed') || 'open');
    setModalActionStatus('idle');
    setConfirmDeleteCallId(null);
  };

  const closeManageModal = () => {
    setSelectedCallForModal(null);
    setConfirmDeleteCallId(null);
  };

  const handleUpdateCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCallForModal) return;
    if (!editTitle.trim() || !editProjectUrl.trim() || !editDescription.trim()) {
      toast.error('Title, URL, and Description are required.');
      setModalActionStatus('error');
      return;
    }
    setModalActionStatus('loading');
    try {
      await updateVolunteerCall(selectedCallForModal.id, {
        title: editTitle.trim(),
        projectUrl: editProjectUrl.trim(),
        description: editDescription.trim(),
        rolesNeeded: editRolesNeeded.trim() || undefined,
        contact: editContact.trim() || undefined,
        status: editStatus,
      });
      toast.success('Volunteer call updated');
      closeManageModal();
      loadVolunteerCalls(false);
    } catch (err: any) {
      setModalActionStatus('error');
      toast.error(err?.message || 'Failed to update');
    }
  };

  const handleDeleteCall = async (callId: string) => {
    setModalActionStatus('loading');
    try {
      await deleteVolunteerCall(callId);
      toast.success('Volunteer call deleted');
      closeManageModal();
      loadVolunteerCalls(false);
    } catch (err: any) {
      setModalActionStatus('error');
      toast.error(err?.message || 'Failed to delete');
    }
  };

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

  const loadMySubmissions = async (showLoading = true) => {
    if (showLoading) setMySubmissionsLoading(true);
    setMySubmissionsError('');
    try {
      const { submissions } = await getMyProjectSubmissions(0, 50);
      setMySubmissions(submissions);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : typeof err?.message === 'string' ? err.message : 'Failed to load submissions';
      setMySubmissionsError(message);
    } finally {
      if (showLoading) setMySubmissionsLoading(false);
    }
  };

  const loadVolunteerCalls = async (showLoading = true) => {
    if (showLoading) setVolunteerCallsLoading(true);
    setVolunteerCallsError('');
    try {
      const { calls } = await getVolunteerCalls();
      setVolunteerCalls(calls);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : typeof err?.message === 'string' ? err.message : 'Failed to load volunteer calls';
      setVolunteerCallsError(message);
    } finally {
      if (showLoading) setVolunteerCallsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'submit-project') {
      loadMySubmissions(true);
    } else if (activeTab === 'volunteer') {
      loadVolunteerCalls(true);
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
          loadMySubmissions(false);
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
          loadVolunteerCalls(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(projectsChannel);
      supabase.removeChannel(volunteerChannel);
    };
  }, [currentUser]);

  const handleVolunteerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!volunteerTitle.trim() || !volunteerProjectUrl.trim() || !volunteerDescription.trim()) {
      toast.error('Title, URL, and Description are required.');
      setVolunteerSubmitStatus('error');
      return;
    }
    setVolunteerSubmitStatus('loading');
    try {
      const res = await createVolunteerCall({
        title: volunteerTitle.trim(),
        projectUrl: volunteerProjectUrl.trim(),
        description: volunteerDescription.trim(),
        rolesNeeded: volunteerRolesNeeded.trim() || undefined,
        contact: volunteerContact.trim() || undefined,
      });
      toast.success(res?.message || 'Volunteer call posted');
      resetVolunteerForm();
      if (activeTab === 'volunteer') {
        loadVolunteerCalls(false);
      }
    } catch (err: any) {
      const message = err instanceof Error ? err.message : typeof err?.message === 'string' ? err.message : 'Failed to save';
      setVolunteerSubmitStatus('error');
      toast.error(message);
    }
  };

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !projectUrl.trim() || !projectDescription.trim()) {
      toast.error('Project Name, URL, and Description are required.');
      setProjectSubmitStatus('error');
      return;
    }
    setProjectSubmitStatus('loading');
    try {
      const res = await submitProjectSubmission({
        projectName: projectName.trim(),
        projectUrl: projectUrl.trim(),
        description: projectDescription.trim(),
        projType: projectProjType.trim() || undefined,
      });
      toast.success(res?.message || 'Project submitted');
      setProjectName('');
      setProjectUrl('');
      setProjectDescription('');
      setProjectProjType('');
      setProjectSubmitStatus('idle');
      if (activeTab === 'submit-project') {
        loadMySubmissions();
      }
    } catch (err: any) {
      const message = err instanceof Error ? err.message : typeof err?.message === 'string' ? err.message : 'Submission failed';
      setProjectSubmitStatus('error');
      toast.error(message);
    }
  };

  const filteredVolunteerCalls = volunteerCalls.filter((c) => {
    if (volunteerFilter === 'mine') {
      return c.userId === currentUser.id || !!currentUser.isAdmin;
    }
    return true;
  });

  return (
    <>
      <style>{`
        @keyframes progress {
          0% { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }
      `}</style>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 pb-12 sm:pb-0">
        {/* Navbar */}
        <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 sm:h-20">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <img src="/logo.svg" onError={(e) => { const t = e.currentTarget; t.onerror = null; t.src = 'https://assets.bettergov.ph/logos/webp/icon-primary.webp'; }} alt="BetterGovPH Logo" className="w-7 h-7 sm:w-8 sm:h-8 object-contain brightness-0" />
                <span className="text-lg sm:text-xl font-display font-bold text-slate-900 truncate">BetterGovPH Volunteers</span>
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
                  className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-[6px] transition-[color,transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out"
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
                  "py-4 text-sm font-bold border-b-2 transition-[color,transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out px-1",
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
                  "py-4 text-sm font-bold border-b-2 transition-[color,transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out px-1",
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
                  "py-4 text-sm font-bold border-b-2 transition-[color,transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out px-1",
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
                  className="bg-white rounded-[6px] p-6 sm:p-8 shadow-sm border border-slate-100/80"
                >
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-4 sm:mb-6">Application Status</h2>
                  <div className={clsx(
                    "flex items-start sm:items-center space-x-4 p-5 rounded-[6px] border",
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
                    <div className="mt-5 p-5 bg-slate-50/80 rounded-[6px] border border-slate-100/80">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Admin Notes</p>
                      <p className="text-sm text-slate-700 leading-relaxed">{currentUser.adminNotes}</p>
                    </div>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white rounded-[6px] p-6 sm:p-8 shadow-sm border border-slate-100/80"
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
                      <div className="flex items-center gap-2">
                        {currentUser.discordAvatar && currentUser.discordId ? (
                          <img
                            src={`https://cdn.discordapp.com/avatars/${currentUser.discordId}/${currentUser.discordAvatar}.png?size=32`}
                            alt=""
                            className="w-6 h-6 rounded-full flex-shrink-0"
                          />
                        ) : null}
                        <div>
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {currentUser.discordDisplayName || currentUser.discordUsername || '—'}
                          </p>
                          {currentUser.discordDisplayName && currentUser.discordUsername && (
                            <p className="text-xs text-slate-400">@{currentUser.discordUsername}</p>
                          )}
                        </div>
                      </div>
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
                  className="bg-white rounded-[6px] p-6 sm:p-8 shadow-sm border border-slate-100/80"
                >
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-6">Skills & Expertise</h2>

                  <div className="space-y-6">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-4">Core Skills</p>
                      <div className="flex flex-wrap gap-2">
                        {currentUser.skills && currentUser.skills.length > 0 ? (
                          currentUser.skills.map((skill, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-1.5 pl-1.5 pr-3 py-1 bg-white border border-slate-100/80 rounded-[6px] shadow-sm group"
                            >
                              <div className="w-6 h-6 rounded-[6px] bg-slate-50/80 flex items-center justify-center flex-shrink-0 border border-slate-100/60">
                                <SkillIcon skillName={skill.name} size={12} />
                              </div>
                              <span className="text-xs font-semibold text-slate-800">{skill.name}</span>
                              <span className={clsx(
                                "text-[9px] font-semibold uppercase tracking-widest",
                                skill.level === 'Expert' ? "text-blue-900" :
                                  skill.level === 'Practitioner' ? "text-blue-700" : "text-slate-400"
                              )}>
                                {skill.level}
                              </span>
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
                      <span className="px-3 py-1.5 bg-emerald-100/80 text-emerald-800 text-[10px] sm:text-xs font-semibold rounded-[6px] uppercase tracking-wide">
                        Ready to use
                      </span>
                    )}
                  </div>

                  <div className={clsx(
                    "relative group transition-[color,transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out max-w-full flex justify-center",
                    currentUser.status !== 'Approved' && "opacity-50 grayscale pointer-events-none blur-[2px]"
                  )}>
                    <AccessCard user={currentUser} />

                    {currentUser.status !== 'Approved' && (
                      <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
                        <div className="bg-white/95 backdrop-blur-sm px-8 py-5 rounded-[6px] shadow-xl border border-slate-200/80 text-center">
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                        <button
                          onClick={handleCopyLink}
                          className="flex items-center justify-center gap-2 w-full py-3 sm:py-3.5 bg-blue-900 text-white rounded-[6px] font-bold text-xs sm:text-sm hover:bg-blue-800 transition-[transform,box-shadow,background-color] duration-200 ease-out shadow-[0_10px_24px_-14px_rgba(30,58,138,0.5)] active:scale-[0.98]"
                        >
                          {copyStatus === 'copied' ? (
                            <><Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" /><span>Link Copied</span></>
                          ) : (
                            <><Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" /><span>Copy Public Link</span></>
                          )}
                        </button>
                        <button
                          onClick={handleCopyEmbed}
                          className="flex items-center justify-center gap-2 w-full py-3 sm:py-3.5 bg-white border border-slate-200 text-slate-700 rounded-[6px] font-bold text-xs sm:text-sm [@media(hover:hover){&:hover}]:bg-slate-50 [@media(hover:hover){&:hover}]:border-slate-300 transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out active:scale-[0.98]"
                        >
                          {copyStatus === 'embed-copied' ? (
                            <><Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" /><span>Embed Copied</span></>
                          ) : (
                            <><Code className="w-3.5 h-3.5 sm:w-4 sm:h-4" /><span>Embed Code</span></>
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
            <div className="bg-white rounded-[6px] shadow-sm border border-slate-100/80 overflow-hidden">
              <div className="p-6 sm:p-8 border-b border-slate-100">
                <p className="text-[10px] tracking-[0.2em] text-blue-900 font-semibold uppercase mb-2">Project Submission</p>
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
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-[6px] text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-900/12 focus-visible:border-blue-900/30 transition-[border-color,box-shadow] duration-180 ease-out duration-200 ease-out"
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
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-[6px] text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-900/12 focus-visible:border-blue-900/30 transition-[border-color,box-shadow] duration-180 ease-out duration-200 ease-out"
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
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-[6px] text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-900/12 focus-visible:border-blue-900/30 transition-[border-color,box-shadow] duration-180 ease-out duration-200 ease-out min-h-[140px] resize-none"
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
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-[6px] text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-900/12 focus-visible:border-blue-900/30 transition-[border-color,box-shadow] duration-180 ease-out duration-200 ease-out appearance-none cursor-pointer"
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

                    <button
                      type="submit"
                      disabled={projectSubmitStatus === 'loading'}
                      className={clsx(
                        'relative w-full py-4 rounded-[6px] font-semibold text-sm transition-[color,transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out shadow-sm active:scale-[0.98] overflow-hidden',
                        projectSubmitStatus === 'loading'
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-blue-900 text-white hover:bg-blue-800'
                      )}
                    >
                      {projectSubmitStatus === 'loading' ? 'Submitting...' : 'Submit'}
                      {projectSubmitStatus === 'loading' && <ButtonProgressBar />}
                    </button>
                  </form>
                </div>

                <div className="bg-slate-50 border border-slate-200/70 rounded-[6px] overflow-hidden">
                  <div className="px-5 py-4 bg-white border-b border-slate-200/70 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] tracking-[0.2em] text-blue-900 font-semibold uppercase mb-1">Submissions</p>
                      <p className="text-sm font-bold text-slate-900">My Submitted Projects</p>
                    </div>
                    <button
                      onClick={() => loadMySubmissions(true)}
                      disabled={mySubmissionsLoading}
                      className="px-3 py-2 rounded-[6px] bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition-[color,transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out flex items-center gap-1.5"
                    >
                      <RefreshCw className={clsx('w-3.5 h-3.5', mySubmissionsLoading && 'animate-spin')} />
                      Refresh
                    </button>
                  </div>

                  <div className="p-5 h-[60vh] lg:h-[70vh] overflow-y-auto overscroll-contain">
                    {mySubmissionsLoading ? (
                      <SkeletonBars />
                    ) : mySubmissionsError ? (
                      <div className="flex flex-col items-center justify-center h-full text-center py-12">
                        <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
                        <p className="text-[10px] tracking-[0.2em] text-red-600 font-semibold uppercase mb-1">Error</p>
                        <p className="text-sm text-slate-600">{mySubmissionsError}</p>
                      </div>
                    ) : mySubmissions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center py-12">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                          <FolderPlus className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-[10px] tracking-[0.2em] text-slate-500 font-semibold uppercase mb-2">No Projects Yet</p>
                        <p className="text-sm text-slate-600 max-w-xs">Submit your first project to see it listed here for admin review.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {mySubmissions.map((s) => (
                          <div key={s.id} className="bg-white border border-slate-200/70 rounded-[6px] p-4 hover:shadow-md hover:border-slate-300 transition-[color,transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out">
                            {s.projType && (
                              <div className="mb-2">
                                <span className="inline-block px-2 py-1 rounded-[6px] bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                                  {s.projType}
                                </span>
                              </div>
                            )}
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">{s.projectName}</p>
                                <a
                                  href={formatExternalUrl(s.projectUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-blue-700 hover:underline break-all"
                                >
                                  {s.projectUrl}
                                </a>
                              </div>
                              <span
                                className={clsx(
                                  'px-2 py-1 rounded-[6px] text-[10px] font-black uppercase tracking-widest border flex-shrink-0',
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
            <div className="bg-white rounded-[6px] shadow-sm border border-slate-100/80 overflow-hidden">
              <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] tracking-[0.2em] text-blue-900 font-semibold uppercase mb-2">
                    Volunteer Center
                  </p>
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                    Volunteer Hub
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Post a volunteer call for your project and browse open volunteer opportunities.
                  </p>
                </div>
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
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-[6px] text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-900/12 focus-visible:border-blue-900/30 transition-[border-color,box-shadow] duration-180 ease-out duration-200 ease-out"
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
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-[6px] text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-900/12 focus-visible:border-blue-900/30 transition-[border-color,box-shadow] duration-180 ease-out duration-200 ease-out"
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
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-[6px] text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-900/12 focus-visible:border-blue-900/30 transition-[border-color,box-shadow] duration-180 ease-out duration-200 ease-out min-h-[140px] resize-none"
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
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-[6px] text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-900/12 focus-visible:border-blue-900/30 transition-[border-color,box-shadow] duration-180 ease-out duration-200 ease-out"
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
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-[6px] text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-900/12 focus-visible:border-blue-900/30 transition-[border-color,box-shadow] duration-180 ease-out duration-200 ease-out"
                        placeholder="Discord / Email / Link"
                        disabled={volunteerSubmitStatus === 'loading'}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={volunteerSubmitStatus === 'loading'}
                      className={clsx(
                        'relative w-full py-4 rounded-[6px] font-semibold text-sm transition-[color,transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out shadow-sm active:scale-[0.98] overflow-hidden',
                        volunteerSubmitStatus === 'loading'
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-blue-900 text-white hover:bg-blue-800'
                      )}
                    >
                      {volunteerSubmitStatus === 'loading' ? 'Posting...' : 'Post Volunteer Call'}
                      {volunteerSubmitStatus === 'loading' && <ButtonProgressBar />}
                    </button>
                  </form>
                </div>

                <div className="bg-slate-50 border border-slate-200/70 rounded-[6px] overflow-hidden">
                  <div className="px-5 py-4 bg-white border-b border-slate-200/70">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] tracking-[0.2em] text-blue-900 font-semibold uppercase mb-1">Community Board</p>
                        <p className="text-sm font-bold text-slate-900">Open Volunteer Calls</p>
                      </div>
                      <button
                        onClick={() => loadVolunteerCalls(true)}
                        disabled={volunteerCallsLoading}
                        className="px-3 py-2 rounded-[6px] bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition-[color,transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out flex items-center gap-1.5"
                      >
                        <RefreshCw className={clsx('w-3.5 h-3.5', volunteerCallsLoading && 'animate-spin')} />
                        Refresh
                      </button>
                    </div>

                    <div className="mt-4 flex items-center gap-1">
                      <button
                        onClick={() => setVolunteerFilter('all')}
                        className={clsx(
                          'px-4 py-2 text-xs font-semibold rounded-full transition-[color,transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out',
                          volunteerFilter === 'all'
                            ? 'bg-blue-900 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        )}
                      >
                        All Calls
                      </button>
                      <button
                        onClick={() => setVolunteerFilter('mine')}
                        className={clsx(
                          'px-4 py-2 text-xs font-semibold rounded-full transition-[color,transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out',
                          volunteerFilter === 'mine'
                            ? 'bg-blue-900 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        )}
                      >
                        My Calls
                      </button>
                    </div>
                  </div>

                  <div className="p-5 h-[60vh] lg:h-[70vh] overflow-y-auto overscroll-contain">
                    {volunteerCallsLoading ? (
                      <SkeletonBars />
                    ) : volunteerCallsError ? (
                      <div className="flex flex-col items-center justify-center h-full text-center py-12">
                        <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
                        <p className="text-[10px] tracking-[0.2em] text-red-600 font-semibold uppercase mb-1">Error</p>
                        <p className="text-sm text-slate-600">{volunteerCallsError}</p>
                      </div>
                    ) : filteredVolunteerCalls.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center py-12">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                          <Users className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-[10px] tracking-[0.2em] text-slate-500 font-semibold uppercase mb-2">
                          {volunteerFilter === 'mine' ? 'No Calls Posted' : 'No Volunteer Calls'}
                        </p>
                        <p className="text-sm text-slate-600 max-w-xs">
                          {volunteerFilter === 'mine'
                            ? 'You haven\'t posted any volunteer calls yet. Create your first one using the form.'
                            : 'No volunteer calls available yet. Be the first to post an opportunity!'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredVolunteerCalls.map((c) => {
                          const isOwner = c.userId === currentUser.id || c.userId === currentUser.uid || !!currentUser.isAdmin;
                          const isClosed = c.status === 'closed';
                          return (
                            <div key={c.id} className="bg-white border border-slate-200/70 rounded-[6px] p-4 relative group hover:shadow-md hover:border-slate-300 transition-[color,transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out">
                              {c.postedBy?.fullName && (
                                <div className="mb-2">
                                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[6px] bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                                    <User className="w-3 h-3" />
                                    Posted by {c.postedBy.fullName}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-slate-900">{c.title}</p>
                                  <a
                                    href={formatExternalUrl(c.projectUrl)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-blue-700 hover:underline break-all"
                                  >
                                    {c.projectUrl}
                                  </a>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => isOwner && handleToggleCallStatus(c)}
                                    disabled={!isOwner}
                                    className={clsx(
                                      'px-2.5 py-1 rounded-[6px] text-[10px] font-black uppercase tracking-widest border flex-shrink-0 flex items-center gap-1.5 transition-[color,transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out',
                                      isClosed
                                        ? 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
                                      !isOwner && 'cursor-default'
                                    )}
                                    title={isOwner ? `Click to toggle status (Currently ${c.status || 'open'})` : undefined}
                                  >
                                    {isClosed ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                    {c.status || 'open'}
                                  </button>
                                  {isOwner && (
                                    <button
                                      onClick={() => openManageModal(c)}
                                      className="p-1.5 rounded-[6px] text-slate-500 hover:text-blue-900 hover:bg-slate-100 transition-colors"
                                      title="Edit / Manage Call"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              <p className="mt-3 text-xs text-slate-600 whitespace-pre-wrap break-words">{c.description}</p>

                              <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                                <span className="font-semibold uppercase tracking-wider">
                                  {c.createdAt ? new Date(c.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : ''}
                                </span>
                                {c.rolesNeeded && (
                                  <span className="px-2 py-1 rounded-[6px] bg-slate-100 text-slate-600 font-semibold">
                                    {c.rolesNeeded}
                                  </span>
                                )}
                                {c.contact && (
                                  <span className="px-2 py-1 rounded-[6px] bg-blue-50 text-blue-700 font-semibold">
                                    {c.contact}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* Volunteer Call Manage Modal */}
        {selectedCallForModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[6px] shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <p className="text-[10px] tracking-[0.2em] text-blue-900 font-semibold uppercase mb-1">Call Management</p>
                  <h3 className="font-bold text-slate-900 text-base">Manage Volunteer Call</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Edit post details, change status to closed/open, or delete.</p>
                </div>
                <button
                  onClick={closeManageModal}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-[6px] transition-[color,transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateCall} className="p-6 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Project / Role Title
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-[6px] text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-900/12 focus-visible:border-blue-900/30 transition-[border-color,box-shadow] duration-180 ease-out duration-200 ease-out"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Project URL
                  </label>
                  <input
                    type="text"
                    value={editProjectUrl}
                    onChange={(e) => setEditProjectUrl(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-[6px] text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-900/12 focus-visible:border-blue-900/30 transition-[border-color,box-shadow] duration-180 ease-out duration-200 ease-out"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Details
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-[6px] text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-900/12 focus-visible:border-blue-900/30 transition-[border-color,box-shadow] duration-180 ease-out duration-200 ease-out min-h-[100px] resize-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Roles Needed
                  </label>
                  <input
                    type="text"
                    value={editRolesNeeded}
                    onChange={(e) => setEditRolesNeeded(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-[6px] text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-900/12 focus-visible:border-blue-900/30 transition-[border-color,box-shadow] duration-180 ease-out duration-200 ease-out"
                    placeholder="Frontend, Backend, UI/UX..."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Contact Info
                  </label>
                  <input
                    type="text"
                    value={editContact}
                    onChange={(e) => setEditContact(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-[6px] text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-900/12 focus-visible:border-blue-900/30 transition-[border-color,box-shadow] duration-180 ease-out duration-200 ease-out"
                    placeholder="Discord / Email / Link"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Status
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setEditStatus('open')}
                      className={clsx(
                        'py-2.5 px-4 rounded-[6px] text-xs font-bold border transition-[color,transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out flex items-center justify-center gap-2',
                        editStatus === 'open'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      )}
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      Open (Active)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditStatus('closed')}
                      className={clsx(
                        'py-2.5 px-4 rounded-[6px] text-xs font-bold border transition-[color,transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out flex items-center justify-center gap-2',
                        editStatus === 'closed'
                          ? 'bg-slate-200 border-slate-400 text-slate-900 shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      )}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Closed
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteCallId(selectedCallForModal.id)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-[6px] text-xs font-bold transition-[color,transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Call
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={closeManageModal}
                      className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-[6px] text-xs font-bold hover:bg-slate-50 transition-[color,transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={modalActionStatus === 'loading'}
                      className={clsx(
                        'relative px-5 py-2.5 bg-blue-900 text-white rounded-[6px] text-xs font-bold hover:bg-blue-800 transition-[color,transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out disabled:opacity-50 overflow-hidden'
                      )}
                    >
                      {modalActionStatus === 'loading' ? 'Saving...' : 'Save Changes'}
                      {modalActionStatus === 'loading' && <ButtonProgressBar />}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {confirmDeleteCallId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              className="bg-white rounded-[6px] shadow-2xl border border-slate-200 w-full max-w-xs overflow-hidden"
            >
              <div className="p-5">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-[6px] bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                    <Trash2 className="w-4 h-4 text-red-600" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                      Delete this call?
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      This cannot be undone.
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteCallId(null)}
                    disabled={modalActionStatus === 'loading'}
                    className="px-4 py-2 border border-slate-200 text-slate-700 rounded-[6px] text-xs font-bold hover:bg-slate-50 transition-[color,transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCall(confirmDeleteCallId)}
                    disabled={modalActionStatus === 'loading'}
                    className={clsx(
                      'relative px-4 py-2 rounded-[6px] text-xs font-bold transition-[color,transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out overflow-hidden disabled:opacity-50',
                      modalActionStatus === 'loading'
                        ? 'bg-red-400 text-white cursor-not-allowed'
                        : 'bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] shadow-sm'
                    )}
                  >
                    {modalActionStatus === 'loading' ? 'Deleting...' : 'Delete'}
                    {modalActionStatus === 'loading' && <ButtonProgressBar />}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </>
  );
}
