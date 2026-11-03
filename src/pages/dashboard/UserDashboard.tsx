import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { AccessCard } from '../../components/AccessCard';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { motion } from 'framer-motion';
import { ShieldAlert, CheckCircle2, Clock, Copy, Code, Check, ExternalLink, Edit3, Trash2, X, Lock, Unlock, CalendarDays, Wrench, FolderGit2, BadgeCheck, Pencil, SlidersHorizontal, Star, Flame, Trophy } from 'lucide-react';
import clsx from 'clsx';
import { StatTile } from '../../components/StatTile';
import { UserChip } from '../../components/UserChip';
import { RefreshButton } from '../../components/RefreshButton';
import { EditProfileSheet } from '../../components/EditProfileSheet';
import { MerchTab } from '../../components/merch/MerchTab';
import { Medal } from '../../components/awards/Medal';
import { AwardCard } from '../../components/awards/AwardCard';
import { evaluateAwards } from '../../components/awards/awards';
import { toast } from 'sonner';
import { SkillIcon } from '../../components/SkillIcon';
import { createVolunteerCall, deleteVolunteerCall, updateVolunteerCall, getMyProjectSubmissions, getVolunteerCalls, submitProjectSubmission, supabase } from '../../services/supabase';
import { ProjectSubmission, VolunteerCall } from '../../types';
import { formatExternalUrl } from '../../utils/skillUtils';

const SkeletonBars = () => (
  <div className="flex flex-col gap-2">
    <div className="bg-slate-100 h-10 w-full rounded-[10px]" />
    <div className="bg-slate-100 h-10 w-full rounded-[10px]" />
    <div className="bg-slate-100 h-10 w-full rounded-[10px]" />
  </div>
);


export default function UserDashboard() {
  const { currentUser, authInitialized } = useStore();
  const logout = useStore((s) => s.logout);
  const navigate = useNavigate();
  const [copyStatus, setCopyStatus] = React.useState<'idle' | 'copied' | 'embed-copied'>('idle');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'submit-project' | 'volunteer' | 'merch'>('dashboard');
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
  const [editOpen, setEditOpen] = useState(false);

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

  const toYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const displayName = (
    currentUser.discordUsername
      ? `@${currentUser.discordUsername}`
      : (currentUser.fullName || 'Volunteer').split(' ').join('_')
  );

  const joinDate = (() => {
    if (currentUser.createdAt) {
      const t = new Date(currentUser.createdAt).getTime();
      if (!Number.isNaN(t)) return new Date(t);
    }
    if (currentUser.yearJoined) {
      return new Date(currentUser.yearJoined, 0, 1);
    }
    return new Date();
  })();
  const today = new Date();
  const MS_PER_DAY = 86_400_000;
  const daysSinceJoin = Math.max(1, Math.floor((today.getTime() - new Date(joinDate.getFullYear(), joinDate.getMonth(), joinDate.getDate()).getTime()) / MS_PER_DAY) + 1);

  const totalSkills = Array.isArray(currentUser.skills) ? currentUser.skills.length : 0;
  const approvedCount = mySubmissions.filter(s => s.status === 'approved').length;
  const submittedCount = mySubmissions.length;
  const myCalls = volunteerCalls.filter(c => c.userId === currentUser.id || c.userId === currentUser.uid);
  const awards = evaluateAwards({
    verified: currentUser.status === 'Approved' || !!currentUser.isAdmin,
    discordLinked: !!(currentUser.discordConnected || currentUser.discordId),
    recognized: currentUser.role === 'Fellow' || currentUser.role === 'Contributor',
    projectsShipped: approvedCount,
    callsPosted: myCalls.length,
    callsFilled: myCalls.filter(c => c.status === 'closed').length,
    skills: totalSkills,
    days: daysSinceJoin,
  });
  const earnedAwards = awards.filter(a => a.earned);
  const awardById = (id: string) => awards.find(a => a.def.id === id)!;

  const activityDayKeys = new Set<string>();
  const activityCountPerDay = new Map<string, number>();
  const addDay = (iso?: string, weight = 1) => {
    if (!iso) return;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return;
    const d = new Date(t);
    const key = toYmd(d);
    activityDayKeys.add(key);
    activityCountPerDay.set(key, (activityCountPerDay.get(key) || 0) + weight);
  };
  mySubmissions.forEach(s => addDay(s.createdAt, s.status === 'approved' ? 3 : 1));
  addDay(currentUser.createdAt, 2);
  addDay(currentUser.updatedAt, 1);
  volunteerCalls.forEach(v => addDay(v.createdAt, v.userId === currentUser.id || v.userId === currentUser.uid ? 2 : 0));


  const WEEKS = 53;
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const sundayOfThisWeek = new Date(todayMid);
  const dow = (sundayOfThisWeek.getDay() + 7) % 7;
  sundayOfThisWeek.setDate(sundayOfThisWeek.getDate() - dow);
  const firstSunday = new Date(sundayOfThisWeek);
  firstSunday.setDate(firstSunday.getDate() - ((WEEKS - 1) * 7));
  const grid: Array<{ date: Date; count: number }[]> = [];
  for (let w = 0; w < WEEKS; w++) {
    const col: Array<{ date: Date; count: number }> = [];
    for (let dow2 = 0; dow2 < 7; dow2++) {
      const d = new Date(firstSunday);
      d.setDate(firstSunday.getDate() + (w * 7) + dow2);
      const k = toYmd(d);
      col.push({ date: d, count: activityCountPerDay.get(k) || 0 });
    }
    grid.push(col);
  }

  const levelForCount = (c: number) => {
    if (c <= 0) return 0;
    if (c === 1) return 1;
    if (c <= 2) return 2;
    if (c <= 4) return 3;
    return 4;
  };
  const levelBg = [
    'bg-slate-200/70',
    'bg-blue-200',
    'bg-blue-400',
    'bg-blue-700',
    'bg-blue-900',
  ];

  // Activity summary for the heatmap header.
  const pastCells = grid.flat().filter(c => c.date <= todayMid);
  const activityTotal = pastCells.reduce((n, c) => n + c.count, 0);
  const activeDays = pastCells.filter(c => c.count > 0).length;
  let longestStreak = 0;
  let run = 0;
  pastCells.forEach(c => {
    run = c.count > 0 ? run + 1 : 0;
    longestStreak = Math.max(longestStreak, run);
  });
  let currentStreak = 0;
  for (let i = pastCells.length - 1; i >= 0; i--) {
    if (pastCells[i].count > 0) currentStreak++;
    else if (i === pastCells.length - 1) continue; // today with no activity doesn't break the streak yet
    else break;
  }

  const monthShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const LABEL_INDICES = new Set<number>([0, 9, 18, 26, 35, 44, 52]);
  const monthLabels: Array<{ i: number; label: string }> = [];
  let lastMonthLabeled = -1;
  for (let w = 0; w < WEEKS; w++) {
    if (!LABEL_INDICES.has(w)) continue;
    const d = grid[w][0].date;
    const m = d.getMonth();
    const forceLatest = w === WEEKS - 1;
    if (forceLatest || m !== lastMonthLabeled) {
      lastMonthLabeled = m;
      monthLabels.push({ i: w, label: monthShort[m] });
    }
  }
  const heatmapScrollerRef = useRef<HTMLDivElement | null>(null);
  const heatmapDragState = useRef<{
    down: boolean; moved: boolean; startX: number; startY: number; scrollStart: number;
  }>({ down: false, moved: false, startX: 0, startY: 0, scrollStart: 0 });
  const [heatmapScrollEdge, setHeatmapScrollEdge] = useState<{ l: boolean; r: boolean }>({ l: false, r: false });
  useEffect(() => {
    const el = heatmapScrollerRef.current;
    if (!el) return;

    const edge = () => {
      const maxLeft = el.scrollWidth - el.clientWidth;
      setHeatmapScrollEdge({ l: el.scrollLeft > 4, r: el.scrollLeft < maxLeft - 4 });
    };

    let settledAt = 0;
    let rafA = 0;
    let rafB = 0;
    const toEnd = () => {
      cancelAnimationFrame(rafA);
      cancelAnimationFrame(rafB);
      rafA = requestAnimationFrame(() => {
        rafB = requestAnimationFrame(() => {
          try {
            const maxLeft = el.scrollWidth - el.clientWidth;
            if (maxLeft <= 0) {
              settledAt++;
              if (settledAt < 8) setTimeout(toEnd, 40);
              else edge();
              return;
            }
            el.scrollTo({ left: maxLeft, behavior: 'auto' });
            edge();
          } catch {}
        });
      });
    };

    toEnd();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        settledAt = 0;
        toEnd();
      });
      ro.observe(el);
      const inner = el.firstElementChild as Element | null;
      if (inner) ro.observe(inner);
    }

    el.addEventListener('scroll', edge, { passive: true });

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const st = heatmapDragState.current;
      st.down = true;
      st.moved = false;
      st.startX = e.clientX;
      st.startY = e.clientY;
      st.scrollStart = el.scrollLeft;
      try { el.setPointerCapture(e.pointerId); } catch {}
    };
    const onMove = (e: PointerEvent) => {
      const st = heatmapDragState.current;
      if (!st.down) return;
      const dx = e.clientX - st.startX;
      const dy = e.clientY - st.startY;
      if (st.moved || Math.abs(dx) > 4 || (Math.abs(dx) > Math.abs(dy))) {
        if (!st.moved) st.moved = true;
        e.preventDefault();
        el.scrollLeft = st.scrollStart - dx;
      }
    };
    const onUp = (e: PointerEvent) => {
      const st = heatmapDragState.current;
      st.down = false;
      try { el.releasePointerCapture(e.pointerId); } catch {}
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);

    return () => {
      cancelAnimationFrame(rafA);
      cancelAnimationFrame(rafB);
      if (ro) ro.disconnect();
      el.removeEventListener('scroll', edge);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, []);

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
    } else if (activeTab === 'dashboard') {
      loadMySubmissions(false);
      loadVolunteerCalls(false);
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

  const firstName = (currentUser.fullName || '').trim().split(' ')[0] || 'there';
  const statusMeta = currentUser.status === 'Approved'
    ? { dot: 'bg-emerald-500', word: 'Approved', note: 'Your card is active and publicly verifiable.', icon: BadgeCheck, tone: 'text-emerald-700 bg-emerald-50 shadow-[inset_0_0_0_1px_rgb(16_185_129/0.25)]' }
    : currentUser.status === 'Declined'
      ? { dot: 'bg-red-500', word: 'Declined', note: 'See the note from the admins below.', icon: ShieldAlert, tone: 'text-red-700 bg-red-50 shadow-[inset_0_0_0_1px_rgb(239_68_68/0.25)]' }
      : { dot: 'bg-amber-500', word: 'Under review', note: 'An admin is reviewing your application.', icon: Clock, tone: 'text-amber-800 bg-amber-50 shadow-[inset_0_0_0_1px_rgb(217_119_6/0.25)]' };
  const StatusIcon = statusMeta.icon;
  const featuredSkills = (currentUser.skills || []).filter((s) => s.featured);
  const otherSkills = (currentUser.skills || []).filter((s) => !s.featured);

  const tabs: { id: typeof activeTab; label: string; soon?: boolean }[] = [
    { id: 'dashboard', label: 'Overview' },
    { id: 'submit-project', label: 'Projects' },
    { id: 'volunteer', label: 'Volunteer calls' },
    { id: 'merch', label: 'Merch', soon: true },
  ];

  const sectionTitle = 'text-[15px] font-semibold tracking-[-0.01em] text-slate-900';
  const fieldLabel = 'text-[12px] text-slate-500';

  return (
    <>
      <div className="site min-h-screen pb-16">
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl backdrop-saturate-150 shadow-[0_1px_0_rgb(15_23_42/0.08)]">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
            <a href="/" className="flex min-w-0 items-center gap-2.5">
              <img src="/logo.svg" onError={(e) => { const t = e.currentTarget; t.onerror = null; t.src = 'https://assets.bettergov.ph/logos/webp/icon-primary.webp'; }} alt="" className="h-6 w-6 shrink-0 object-contain" />
              <span className="truncate text-[15px] font-semibold tracking-[-0.015em] text-slate-900">
                BetterGovPH <span className="hidden font-normal text-slate-500 sm:inline">Volunteers</span>
              </span>
            </a>

            <nav aria-label="Dashboard sections" className="hidden items-center gap-1 md:flex">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  aria-current={activeTab === t.id ? 'page' : undefined}
                  className={clsx(
                    'rounded-lg px-3 py-1.5 text-[14px] transition-colors duration-150',
                    activeTab === t.id ? 'bg-slate-900/[0.05] font-medium text-slate-900' : 'text-slate-500 hover:text-slate-900'
                  )}
                >
                  {t.label}
                {t.soon && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-px text-[10.5px] font-medium text-amber-800">Soon</span>}
                </button>
              ))}
            </nav>

            <UserChip
              name={currentUser.fullName}
              subtitle={currentUser.role || 'Member'}
              discordId={currentUser.discordId}
              discordAvatar={currentUser.discordAvatar}
              onOpen={() => {
                setActiveTab('dashboard');
                setTimeout(() => document.getElementById('digital-card-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
              }}
              openLabel="View my card"
              onSignOut={handleLogout}
            />
          </div>

          <nav aria-label="Dashboard sections" className="no-scrollbar flex gap-1 overflow-x-auto border-t border-slate-200/70 px-3 py-1.5 md:hidden">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                aria-current={activeTab === t.id ? 'page' : undefined}
                className={clsx(
                  'shrink-0 rounded-lg px-3 py-1.5 text-[14px] transition-colors duration-150',
                  activeTab === t.id ? 'bg-slate-900/[0.06] font-medium text-slate-900' : 'text-slate-500'
                )}
              >
                {t.label}
                {t.soon && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-px text-[10.5px] font-medium text-amber-800">Soon</span>}
              </button>
            ))}
          </nav>
        </header>

        {activeTab === 'dashboard' ? (
          <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 sm:pt-14">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="mb-10"
            >
              <p className="flex flex-wrap items-center gap-2 text-[13px] text-slate-500">
                {currentUser.status !== 'Approved' && (
                  <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium', statusMeta.tone)}>
                    <StatusIcon size={14} strokeWidth={2} aria-hidden />
                    {statusMeta.word}
                  </span>
                )}
                <span className="num">Day {daysSinceJoin.toLocaleString()} as a member</span>
              </p>
              <h1 className="mt-3 text-[32px] sm:text-[40px]">Welcome back, {firstName}.</h1>
              <p className="mt-2 text-[16px] text-slate-600">
                {statusMeta.note}
                {displayName.startsWith('@') && <span className="text-slate-400"> Signed in as {displayName}.</span>}
              </p>
              {earnedAwards.length > 0 && (
                <a href="#awards" className="group mt-5 inline-flex items-center gap-3" aria-label={`${earnedAwards.length} awards earned — see all`}>
                  <span className="flex -space-x-2">
                    {earnedAwards.slice(0, 6).map((a) => (
                      <Medal key={a.def.id} icon={a.def.icon} tier={a.tier} pips={a.def.kind === 'tiered'} size={36} title={a.def.name} />
                    ))}
                  </span>
                  <span className="num text-[13px] text-slate-500 group-hover:text-slate-900">
                    {earnedAwards.length} of {awards.length} awards
                  </span>
                </a>
              )}
            </motion.div>

            {currentUser.adminNotes && (
              <div className="mb-8 rounded-[14px] bg-white px-5 py-4 shadow-[var(--e1)]" role="note">
                <p className="text-[12px] font-medium text-slate-500">Note from the admins</p>
                <p className="mt-1 text-[15px] leading-relaxed text-slate-800">{currentUser.adminNotes}</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
              <div className="order-2 min-w-0 space-y-6 lg:order-1">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
                  <StatTile
                    label="Days in"
                    icon={CalendarDays}
                    value={daysSinceJoin.toLocaleString()}
                    hint={`since ${joinDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`}
                  />
                  <StatTile
                    label="Skills"
                    icon={Wrench}
                    value={totalSkills}
                    hint={currentUser.experienceLevel ? currentUser.experienceLevel : 'listed'}
                  />
                  <StatTile
                    label="Projects"
                    icon={FolderGit2}
                    value={submittedCount > 0 ? <>{approvedCount}<span className="text-[15px] font-normal text-slate-400"> / {submittedCount}</span></> : approvedCount}
                    hint={submittedCount > 0 ? 'approved' : 'none yet'}
                  />
                </div>

                {/* Activity */}
                <section className="s-card p-5 sm:p-6" aria-labelledby="activity-title">
                  <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1">
                    <div>
                      <h2 id="activity-title" className={sectionTitle}>Contribution activity</h2>
                      <p className="mt-0.5 text-[13px] text-slate-500">
                        <span className="num font-medium text-slate-900">{activityTotal}</span> contributions in the last year
                      </p>
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-3 divide-x divide-slate-200/80 rounded-[12px] bg-slate-50 py-3 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.05)]">
                    {[
                      { label: 'Active days', value: activeDays, icon: CalendarDays },
                      { label: 'Current streak', value: `${currentStreak}d`, icon: Flame },
                      { label: 'Longest streak', value: `${longestStreak}d`, icon: Trophy },
                    ].map((st) => (
                      <div key={st.label} className="min-w-0 px-3 text-center sm:px-4">
                        <dt className="flex items-center justify-center gap-1.5 truncate text-[12px] text-slate-500">
                          <st.icon size={13} strokeWidth={1.75} className="shrink-0 text-slate-400" aria-hidden />
                          {st.label}
                        </dt>
                        <dd className="num mt-0.5 text-[18px] font-semibold text-slate-900">{st.value}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="relative mt-5">
                    <div
                      className={clsx('pointer-events-none absolute inset-y-0 left-0 z-10 w-8 transition-opacity duration-200', heatmapScrollEdge.l ? 'opacity-100' : 'opacity-0')}
                      style={{ background: 'linear-gradient(to right, #ffffff 0%, rgba(255,255,255,0))' }}
                    />
                    <div
                      className={clsx('pointer-events-none absolute inset-y-0 right-0 z-10 w-8 transition-opacity duration-200', heatmapScrollEdge.r ? 'opacity-100' : 'opacity-0')}
                      style={{ background: 'linear-gradient(to left, #ffffff 0%, rgba(255,255,255,0))' }}
                    />
                    <div
                      ref={heatmapScrollerRef}
                      className="no-scrollbar w-full min-w-0 cursor-[grab] select-none overflow-x-auto pb-1 active:cursor-[grabbing] lg:cursor-default"
                      dir="ltr"
                      style={{ touchAction: 'pan-y pinch-zoom' }}
                    >
                      <div className="inline-flex flex-col gap-1.5" style={{ width: `calc(22px + ${WEEKS} * (11px + 2px))` }}>
                        <div className="flex gap-[2px] pl-[22px]">
                          {Array.from({ length: WEEKS }, (_, w) => {
                            const ml = monthLabels.find(m => m.i === w);
                            return (
                              <div key={`m-${w}`} className="flex-shrink-0" style={{ width: '11px' }}>
                                {ml ? (
                                  <span className="block h-[12px] whitespace-nowrap text-[11px] leading-none text-slate-400">{ml.label}</span>
                                ) : (
                                  <span className="block h-[12px]" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex items-start">
                          <div className="flex w-[22px] shrink-0 flex-col gap-[2px]">
                            {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((d, i) => (
                              <span key={i} className="flex h-[11px] items-center text-[9.5px] leading-none text-slate-400">{d}</span>
                            ))}
                          </div>
                          <div className="flex gap-[2px]">
                            {grid.map((weekCol, wi) => (
                              <div key={wi} className="flex flex-col gap-[2px]" style={{ width: '11px' }}>
                                {weekCol.map((cell, di) => {
                                  const future = cell.date > todayMid;
                                  const isToday = cell.date.getTime() === todayMid.getTime();
                                  return (
                                    <div
                                      key={di}
                                      title={future ? undefined : cell.count > 0
                                        ? `${cell.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} — ${cell.count} contribution${cell.count === 1 ? '' : 's'}`
                                        : `${cell.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} — no activity`}
                                      className={clsx(
                                        'h-[11px] w-[11px] flex-shrink-0 rounded-[3px]',
                                        future ? 'bg-transparent' : levelBg[levelForCount(cell.count)],
                                        isToday && 'ring-1 ring-slate-900/40 ring-offset-1 ring-offset-white'
                                      )}
                                    />
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[12px] text-slate-500">
                    <p>Counts approved projects, volunteer calls and profile updates.</p>
                    <div className="flex items-center gap-1.5">
                      <span>Less</span>
                      {levelBg.map((cls, i) => (
                        <div key={i} className={clsx(cls, 'h-[11px] w-[11px] flex-shrink-0 rounded-[3px]')} />
                      ))}
                      <span>More</span>
                    </div>
                  </div>
                </section>

                {/* Awards */}
                <section id="awards" className="scroll-mt-24" aria-labelledby="awards-title">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h2 id="awards-title" className={sectionTitle}>Awards</h2>
                    <span className="num text-[12px] text-slate-500">{earnedAwards.length} of {awards.length} earned</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[...awards].sort((x, y) => Number(y.earned) - Number(x.earned)).map((a) => (
                      <AwardCard key={a.def.id} award={a} />
                    ))}
                  </div>
                </section>

                {/* Profile */}
                <section className="s-card p-5 sm:p-6" aria-labelledby="profile-title">
                  <div className="flex items-center justify-between gap-3">
                    <h2 id="profile-title" className={sectionTitle}>Profile</h2>
                    <button type="button" onClick={() => setEditOpen(true)} className="s-btn s-btn-plain h-8 px-3 text-[13px]">
                      <Pencil size={14} strokeWidth={1.75} />
                      Edit
                    </button>
                  </div>
                  <dl className="mt-4 grid border-t border-slate-200/80 sm:grid-cols-2 sm:gap-x-8">
                    {[
                      { label: 'Full name', value: currentUser.fullName },
                      { label: 'Email', value: <span className="break-all">{currentUser.email}</span> },
                      {
                        label: 'Discord',
                        value: (
                          <span className="flex items-center gap-2">
                            {currentUser.discordAvatar && currentUser.discordId && (
                              <img src={`https://cdn.discordapp.com/avatars/${currentUser.discordId}/${currentUser.discordAvatar}.png?size=32`} alt="" className="h-5 w-5 shrink-0 rounded-full" />
                            )}
                            <span className="truncate">
                              {currentUser.discordDisplayName || currentUser.discordUsername || '—'}
                              {currentUser.discordDisplayName && currentUser.discordUsername && (
                                <span className="text-slate-400"> @{currentUser.discordUsername}</span>
                              )}
                            </span>
                          </span>
                        ),
                      },
                      { label: 'Primary role', value: currentUser.specialization || '—' },
                      { label: 'Community role', value: currentUser.role || '—' },
                      { label: 'Experience', value: currentUser.experienceLevel || '—' },
                      { label: 'Member since', value: <span className="num">{currentUser.yearJoined || '—'}</span> },
                      ...(currentUser.memberId ? [{ label: 'Member ID', value: <span className="font-mono text-[13px]">{currentUser.memberId}</span> }] : []),
                    ].map((f) => (
                      <div key={f.label} className="flex items-baseline justify-between gap-4 border-b border-slate-200/80 py-3">
                        <dt className={fieldLabel}>{f.label}</dt>
                        <dd className="min-w-0 text-right text-[14px] text-slate-900">{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>

                {/* Skills */}
                <section className="s-card p-5 sm:p-6" aria-labelledby="skills-title">
                  <div className="flex items-center justify-between gap-3">
                    <h2 id="skills-title" className={sectionTitle}>
                      Skills <span className="num font-normal text-slate-400">{totalSkills}</span>
                    </h2>
                    <button type="button" onClick={() => setEditOpen(true)} className="s-btn s-btn-plain h-8 px-3 text-[13px]">
                      <SlidersHorizontal size={14} strokeWidth={1.75} />
                      Customize
                    </button>
                  </div>

                  {totalSkills === 0 ? (
                    <div className="mt-4 rounded-[12px] bg-slate-50 px-4 py-6 text-center">
                      <p className="text-[14px] text-slate-600">No skills listed yet.</p>
                      <button type="button" onClick={() => setEditOpen(true)} className="s-btn s-btn-accent mt-3">Add your skills</button>
                    </div>
                  ) : (
                    <>
                      {featuredSkills.length > 0 && (
                        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Featured skills">
                          {featuredSkills.map((skill) => (
                            <li key={skill.name} className="flex items-center gap-2.5 rounded-[12px] bg-[#fffbeb] px-3 py-2.5 shadow-[inset_0_0_0_1px_rgb(217_119_6/0.25)]">
                              <SkillIcon skillName={skill.name} size={18} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[14px] font-semibold text-slate-900">{skill.name}</span>
                                <span className="block text-[12px] text-slate-500">{skill.level}</span>
                              </span>
                              <Star size={14} strokeWidth={1.75} className="shrink-0 fill-amber-400 text-amber-500" aria-label="Featured" />
                            </li>
                          ))}
                        </ul>
                      )}
                      {otherSkills.length > 0 && (
                        <ul className="mt-3 flex flex-wrap gap-2">
                          {otherSkills.map((skill) => (
                            <li
                              key={skill.name}
                              className="inline-flex items-center gap-2 rounded-lg bg-white py-1.5 pl-2 pr-2.5 text-[13px] shadow-[inset_0_0_0_1px_rgb(15_23_42/0.1)]"
                            >
                              <SkillIcon skillName={skill.name} size={13} />
                              <span className="font-medium text-slate-800">{skill.name}</span>
                              <span className={clsx('text-[12px]', skill.level === 'Expert' ? 'text-[var(--accent)]' : 'text-slate-400')}>
                                {skill.level}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {featuredSkills.length === 0 && (
                        <p className="mt-3 text-[12px] text-slate-400">Tip: star up to 3 skills in Customize to feature them here.</p>
                      )}
                    </>
                  )}
                </section>
              </div>

              {/* Volunteer Card */}
              <aside id="digital-card-section" className="order-1 min-w-0 lg:order-2">
                <div className="lg:sticky lg:top-24">
                  <div className="mb-4 flex items-baseline justify-between gap-3">
                    <h2 className={sectionTitle}>Your Volunteer Card</h2>
                    {currentUser.status !== 'Approved' && (
                      <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium', statusMeta.tone)}>
                        <StatusIcon size={13} strokeWidth={2} aria-hidden />
                        {statusMeta.word}
                      </span>
                    )}
                  </div>

                  <div className="relative flex justify-center overflow-hidden rounded-[22px] bg-[#eef1f5] px-2 py-6 sm:px-4 sm:py-8 shadow-[inset_0_1px_2px_rgb(15_23_42/0.06),inset_0_0_0_1px_rgb(15_23_42/0.04)]">
                    <div className={clsx(currentUser.status !== 'Approved' && 'pointer-events-none opacity-40 grayscale')}>
                      <AccessCard user={currentUser} />
                    </div>
                    {currentUser.status !== 'Approved' && (
                      <div className="absolute inset-0 flex items-center justify-center p-6">
                        <div className="rounded-[14px] bg-white px-5 py-4 text-center shadow-[var(--e2)]">
                          <p className="text-[14px] font-semibold text-slate-900">
                            {currentUser.status === 'Declined' ? 'Card not issued' : 'Not active yet'}
                          </p>
                          <p className="mt-0.5 text-[13px] text-slate-500">
                            {currentUser.status === 'Declined' ? 'See the admin note.' : 'It activates once you’re approved.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {currentUser.status === 'Approved' && (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button onClick={handleCopyLink} className="s-btn s-btn-plain">
                        {copyStatus === 'copied' ? <Check size={15} strokeWidth={1.75} /> : <Copy size={15} strokeWidth={1.75} />}
                        {copyStatus === 'copied' ? 'Copied' : 'Copy link'}
                      </button>
                      <button onClick={handleCopyEmbed} className="s-btn s-btn-plain">
                        {copyStatus === 'embed-copied' ? <Check size={15} strokeWidth={1.75} /> : <Code size={15} strokeWidth={1.75} />}
                        {copyStatus === 'embed-copied' ? 'Copied' : 'Embed code'}
                      </button>
                      {currentUser.memberId && (
                        <a
                          href={`/verify/${currentUser.memberId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group col-span-2 mt-1 inline-flex items-center justify-center gap-1 text-[13px] text-slate-500 hover:text-slate-900"
                        >
                          View public verification page
                          <ExternalLink size={12} strokeWidth={1.75} />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </main>
        ) : activeTab === 'merch' ? (
          <MerchTab />
        ) : activeTab === 'submit-project' ? (
          <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 sm:pt-14">
            <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-xl">
                <h1 className="text-[28px] sm:text-[32px]">Projects</h1>
                <p className="mt-1.5 text-[15px] text-slate-600">
                  Share something you built for the community. An admin reviews it before it appears on the public projects page.
                </p>
              </div>
              <a href="/projects" target="_blank" rel="noopener noreferrer" className="group inline-flex shrink-0 items-center gap-1 text-[14px] font-medium text-[var(--accent)]">
                View public projects
                <ExternalLink size={13} strokeWidth={1.75} />
              </a>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-10">
              <section className="min-w-0" aria-labelledby="submit-title">
                <div className="s-card p-5 sm:p-6 lg:sticky lg:top-24">
                  <h2 id="submit-title" className="text-[16px] font-semibold">Submit a project</h2>
                  <form onSubmit={handleProjectSubmit} className="mt-5 space-y-4">
                    <div>
                      <label htmlFor="proj-name" className="mb-1.5 block text-[13px] font-medium text-slate-900">Project name</label>
                      <input
                        id="proj-name"
                        type="text"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        className="s-field"
                        placeholder="BetterGovPH Tracker"
                        disabled={projectSubmitStatus === 'loading'}
                      />
                    </div>
                    <div>
                      <label htmlFor="proj-url" className="mb-1.5 block text-[13px] font-medium text-slate-900">Link</label>
                      <input
                        id="proj-url"
                        type="url"
                        inputMode="url"
                        value={projectUrl}
                        onChange={(e) => setProjectUrl(e.target.value)}
                        className="s-field"
                        placeholder="https://github.com/…"
                        disabled={projectSubmitStatus === 'loading'}
                      />
                      <p className="mt-1.5 text-[12px] text-slate-500">GitHub repo, live demo, or docs.</p>
                    </div>
                    <div>
                      <label htmlFor="proj-desc" className="mb-1.5 block text-[13px] font-medium text-slate-900">Description</label>
                      <textarea
                        id="proj-desc"
                        value={projectDescription}
                        onChange={(e) => setProjectDescription(e.target.value)}
                        className="s-field h-auto min-h-[120px] resize-y py-2.5"
                        placeholder="What does it do, and who is it for?"
                        disabled={projectSubmitStatus === 'loading'}
                      />
                    </div>
                    <div>
                      <label htmlFor="proj-type" className="mb-1.5 block text-[13px] font-medium text-slate-900">Type</label>
                      <select
                        id="proj-type"
                        value={projectProjType}
                        onChange={(e) => setProjectProjType(e.target.value)}
                        className="s-field cursor-pointer"
                        disabled={projectSubmitStatus === 'loading'}
                      >
                        <option value="">Select a type</option>
                        <option value="web">Web</option>
                        <option value="api">API</option>
                        <option value="mobile">Mobile</option>
                        <option value="data">Data</option>
                        <option value="policy">Policy</option>
                        <option value="blockchain">Blockchain</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <button type="submit" disabled={projectSubmitStatus === 'loading'} className="s-btn s-btn-accent h-11 w-full">
                      {projectSubmitStatus === 'loading' ? 'Submitting…' : 'Submit for review'}
                    </button>
                  </form>
                </div>
              </section>

              <section className="min-w-0" aria-labelledby="mine-title">
                <div className="mb-6">
                  <AwardCard award={awardById('builder')} />
                </div>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 id="mine-title" className="text-[16px] font-semibold">
                    Your submissions <span className="num font-normal text-slate-400">{mySubmissions.length}</span>
                  </h2>
                  <RefreshButton onRefresh={() => loadMySubmissions(true)} loading={mySubmissionsLoading} />
                </div>

                {mySubmissionsLoading ? (
                  <SkeletonBars />
                ) : mySubmissionsError ? (
                  <div className="s-card px-5 py-8 text-center">
                    <p className="text-[15px] font-semibold">Couldn’t load your submissions</p>
                    <p className="mt-1 text-[14px] text-slate-500">{mySubmissionsError}</p>
                    <button onClick={() => loadMySubmissions(true)} className="s-btn s-btn-plain mt-4">Try again</button>
                  </div>
                ) : mySubmissions.length === 0 ? (
                  <div className="s-card px-5 py-10 text-center">
                    <p className="text-[15px] font-semibold">Nothing submitted yet</p>
                    <p className="mx-auto mt-1 max-w-xs text-[14px] text-slate-500">Projects you submit show up here while they’re reviewed.</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {mySubmissions.map((s) => (
                      <li key={s.id} className="s-card p-4 sm:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                          <h3 className="min-w-0 break-words text-[15px] font-semibold">{s.projectName}</h3>
                          <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] capitalize text-slate-600">
                            <span
                              className={clsx(
                                'h-1.5 w-1.5 rounded-full',
                                s.status === 'approved' ? 'bg-emerald-500' : s.status === 'rejected' ? 'bg-red-500' : 'bg-amber-500'
                              )}
                              aria-hidden
                            />
                            {s.status === 'pending' ? 'In review' : s.status}
                          </span>
                        </div>
                        <a
                          href={formatExternalUrl(s.projectUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-0.5 block break-all text-[13px] text-[var(--accent)] hover:underline"
                        >
                          {s.projectUrl}
                        </a>
                        {s.description && (
                          <p className="mt-3 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-slate-600">{s.description}</p>
                        )}
                        <p className="mt-3 flex flex-wrap items-center gap-x-2 text-[12px] text-slate-500">
                          {s.projType && <span className="capitalize">{s.projType}</span>}
                          {s.projType && s.createdAt && <span aria-hidden>·</span>}
                          {s.createdAt && (
                            <time className="num" dateTime={s.createdAt}>
                              {new Date(s.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                            </time>
                          )}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </main>
        ) : (
          <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 sm:pt-14">
            <div className="mb-8 max-w-xl">
              <h1 className="text-[28px] sm:text-[32px]">Volunteer calls</h1>
              <p className="mt-1.5 text-[15px] text-slate-600">
                Find a project that needs your skills, or post a call for help on your own.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-10">
              <section className="order-2 min-w-0 lg:order-1" aria-labelledby="post-title">
                <div className="s-card p-5 sm:p-6 lg:sticky lg:top-24">
                  <h2 id="post-title" className="text-[16px] font-semibold">Post a call</h2>
                  <form onSubmit={handleVolunteerSubmit} className="mt-5 space-y-4">
                    <div>
                      <label htmlFor="vc-title" className="mb-1.5 block text-[13px] font-medium text-slate-900">Title</label>
                      <input
                        id="vc-title"
                        type="text"
                        value={volunteerTitle}
                        onChange={(e) => setVolunteerTitle(e.target.value)}
                        className="s-field"
                        placeholder="Frontend developer for a budget tracker"
                        disabled={volunteerSubmitStatus === 'loading'}
                      />
                    </div>
                    <div>
                      <label htmlFor="vc-url" className="mb-1.5 block text-[13px] font-medium text-slate-900">Project link</label>
                      <input
                        id="vc-url"
                        type="url"
                        inputMode="url"
                        value={volunteerProjectUrl}
                        onChange={(e) => setVolunteerProjectUrl(e.target.value)}
                        className="s-field"
                        placeholder="https://github.com/…"
                        disabled={volunteerSubmitStatus === 'loading'}
                      />
                    </div>
                    <div>
                      <label htmlFor="vc-desc" className="mb-1.5 block text-[13px] font-medium text-slate-900">Details</label>
                      <textarea
                        id="vc-desc"
                        value={volunteerDescription}
                        onChange={(e) => setVolunteerDescription(e.target.value)}
                        className="s-field h-auto min-h-[120px] resize-y py-2.5"
                        placeholder="What needs doing, how long it takes, what someone should know."
                        disabled={volunteerSubmitStatus === 'loading'}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
                      <div>
                        <label htmlFor="vc-roles" className="mb-1.5 block text-[13px] font-medium text-slate-900">
                          Roles needed <span className="font-normal text-slate-400">optional</span>
                        </label>
                        <input
                          id="vc-roles"
                          type="text"
                          value={volunteerRolesNeeded}
                          onChange={(e) => setVolunteerRolesNeeded(e.target.value)}
                          className="s-field"
                          placeholder="Frontend, UI/UX"
                          disabled={volunteerSubmitStatus === 'loading'}
                        />
                      </div>
                      <div>
                        <label htmlFor="vc-contact" className="mb-1.5 block text-[13px] font-medium text-slate-900">
                          Contact <span className="font-normal text-slate-400">optional</span>
                        </label>
                        <input
                          id="vc-contact"
                          type="text"
                          value={volunteerContact}
                          onChange={(e) => setVolunteerContact(e.target.value)}
                          className="s-field"
                          placeholder="Discord handle or email"
                          disabled={volunteerSubmitStatus === 'loading'}
                        />
                      </div>
                    </div>
                    <button type="submit" disabled={volunteerSubmitStatus === 'loading'} className="s-btn s-btn-accent h-11 w-full">
                      {volunteerSubmitStatus === 'loading' ? 'Posting…' : 'Post call'}
                    </button>
                  </form>
                </div>
              </section>

              <section className="order-1 min-w-0 lg:order-2" aria-labelledby="calls-title">
                <div className="s-card mb-6 grid grid-cols-1 gap-5 p-4 sm:grid-cols-2 sm:p-5">
                  <AwardCard award={awardById('bayanihan')} compact />
                  <AwardCard award={awardById('team-assembled')} compact />
                </div>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 id="calls-title" className="sr-only">Calls</h2>
                  <div className="inline-flex rounded-[10px] bg-slate-200/60 p-1" role="tablist" aria-label="Filter calls">
                    {(['all', 'mine'] as const).map((f) => (
                      <button
                        key={f}
                        role="tab"
                        aria-selected={volunteerFilter === f}
                        onClick={() => setVolunteerFilter(f)}
                        className={clsx(
                          'min-h-[36px] rounded-[8px] px-3.5 text-[13px] transition-[background-color,color,box-shadow] duration-150',
                          volunteerFilter === f ? 'bg-white font-medium text-slate-900 shadow-[var(--e1)]' : 'text-slate-500 hover:text-slate-900'
                        )}
                      >
                        {f === 'all' ? 'All calls' : 'My calls'}
                      </button>
                    ))}
                  </div>
                  <RefreshButton onRefresh={() => loadVolunteerCalls(true)} loading={volunteerCallsLoading} />
                </div>

                {volunteerCallsLoading ? (
                  <SkeletonBars />
                ) : volunteerCallsError ? (
                  <div className="s-card px-5 py-8 text-center">
                    <p className="text-[15px] font-semibold">Couldn’t load volunteer calls</p>
                    <p className="mt-1 text-[14px] text-slate-500">{volunteerCallsError}</p>
                    <button onClick={() => loadVolunteerCalls(true)} className="s-btn s-btn-plain mt-4">Try again</button>
                  </div>
                ) : filteredVolunteerCalls.length === 0 ? (
                  <div className="s-card px-5 py-10 text-center">
                    <p className="text-[15px] font-semibold">
                      {volunteerFilter === 'mine' ? 'You haven’t posted a call yet' : 'No open calls right now'}
                    </p>
                    <p className="mx-auto mt-1 max-w-xs text-[14px] text-slate-500">
                      {volunteerFilter === 'mine' ? 'Use the form to ask the community for help.' : 'Check back soon, or post the first one.'}
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {filteredVolunteerCalls.map((c) => {
                      const isOwner = c.userId === currentUser.id || c.userId === currentUser.uid || !!currentUser.isAdmin;
                      const isClosed = c.status === 'closed';
                      return (
                        <li key={c.id} className={clsx('s-card p-4 sm:p-5', isClosed && 'opacity-75')}>
                          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                            <div className="min-w-0 flex-1 basis-56">
                              <h3 className="break-words text-[15px] font-semibold">{c.title}</h3>
                              {c.postedBy?.fullName && (
                                <p className="mt-0.5 text-[13px] text-slate-500">Posted by {c.postedBy.fullName}</p>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {isOwner ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleCallStatus(c)}
                                  className="s-btn s-btn-plain h-8 px-2.5 text-[12px]"
                                  title={isClosed ? 'Reopen this call' : 'Close this call'}
                                >
                                  <span className={clsx('h-1.5 w-1.5 rounded-full', isClosed ? 'bg-slate-400' : 'bg-emerald-500')} aria-hidden />
                                  {isClosed ? 'Closed' : 'Open'}
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-600">
                                  <span className={clsx('h-1.5 w-1.5 rounded-full', isClosed ? 'bg-slate-400' : 'bg-emerald-500')} aria-hidden />
                                  {isClosed ? 'Closed' : 'Open'}
                                </span>
                              )}
                              {isOwner && (
                                <button
                                  onClick={() => openManageModal(c)}
                                  className="s-btn s-btn-plain h-8 px-2.5 text-[12px]"
                                  aria-label={`Edit ${c.title}`}
                                >
                                  <Edit3 size={13} strokeWidth={1.75} />
                                  Edit
                                </button>
                              )}
                            </div>
                          </div>

                          {c.projectUrl && (
                            <a
                              href={formatExternalUrl(c.projectUrl)}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 block break-all text-[13px] text-[var(--accent)] hover:underline"
                            >
                              {c.projectUrl}
                            </a>
                          )}

                          {c.description && (
                            <p className="mt-3 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-slate-600">{c.description}</p>
                          )}

                          {(c.rolesNeeded || c.contact || c.createdAt) && (
                            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 border-t border-slate-200/80 pt-3 text-[13px] sm:grid-cols-3">
                              {c.rolesNeeded && (
                                <div className="min-w-0">
                                  <dt className="text-[12px] text-slate-500">Roles</dt>
                                  <dd className="break-words text-slate-800">{c.rolesNeeded}</dd>
                                </div>
                              )}
                              {c.contact && (
                                <div className="min-w-0">
                                  <dt className="text-[12px] text-slate-500">Contact</dt>
                                  <dd className="break-all text-slate-800">{c.contact}</dd>
                                </div>
                              )}
                              {c.createdAt && (
                                <div className="min-w-0">
                                  <dt className="text-[12px] text-slate-500">Posted</dt>
                                  <dd className="num text-slate-800">
                                    {new Date(c.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                                  </dd>
                                </div>
                              )}
                            </dl>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          </main>
        )}

        {/* Volunteer Call Manage Modal */}
        {selectedCallForModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[10px] shadow-[var(--e2)] border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="font-semibold text-slate-900 text-base">Manage Volunteer Call</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Edit post details, change status to closed/open, or delete.</p>
                </div>
                <button
                  onClick={closeManageModal}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-[10px] transition-[color,transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateCall} className="p-6 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-[13px] font-medium text-slate-900 mb-1.5">
                    Project / Role Title
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="s-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-slate-900 mb-1.5">
                    Project URL
                  </label>
                  <input
                    type="text"
                    value={editProjectUrl}
                    onChange={(e) => setEditProjectUrl(e.target.value)}
                    className="s-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-slate-900 mb-1.5">
                    Details
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="s-field h-auto py-2.5 min-h-[100px] resize-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-slate-900 mb-1.5">
                    Roles Needed
                  </label>
                  <input
                    type="text"
                    value={editRolesNeeded}
                    onChange={(e) => setEditRolesNeeded(e.target.value)}
                    className="s-field"
                    placeholder="Frontend, Backend, UI/UX..."
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-slate-900 mb-1.5">
                    Contact Info
                  </label>
                  <input
                    type="text"
                    value={editContact}
                    onChange={(e) => setEditContact(e.target.value)}
                    className="s-field"
                    placeholder="Discord / Email / Link"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-slate-900 mb-1.5">
                    Status
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setEditStatus('open')}
                      className={clsx(
                        'py-2.5 px-4 rounded-[10px] text-xs font-semibold border transition-[color,transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out flex items-center justify-center gap-2',
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
                        'py-2.5 px-4 rounded-[10px] text-xs font-semibold border transition-[color,transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out flex items-center justify-center gap-2',
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

                <div className="pt-4 border-t border-slate-100 flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteCallId(selectedCallForModal.id)}
                    className="s-btn h-9 px-3 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Call
                  </button>

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={closeManageModal}
                      className="s-btn s-btn-plain"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={modalActionStatus === 'loading'}
                      className="s-btn s-btn-accent"
                    >
                      {modalActionStatus === 'loading' ? 'Saving...' : 'Save Changes'}
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
              className="bg-white rounded-[10px] shadow-[var(--e2)] border border-slate-200 w-full max-w-xs overflow-hidden"
            >
              <div className="p-5">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-[10px] bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                    <Trash2 className="w-4 h-4 text-red-600" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                      Delete this call?
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      This cannot be undone.
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteCallId(null)}
                    disabled={modalActionStatus === 'loading'}
                    className="s-btn s-btn-plain"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCall(confirmDeleteCallId)}
                    disabled={modalActionStatus === 'loading'}
                    className="s-btn bg-red-600 text-white [@media(hover:hover)]:hover:bg-red-700"
                  >
                    {modalActionStatus === 'loading' ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
      <EditProfileSheet open={editOpen} user={currentUser} onClose={() => setEditOpen(false)} />
    </>
  );
}
