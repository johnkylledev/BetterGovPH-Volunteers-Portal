import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { AccessCard } from '../../components/AccessCard';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { motion } from 'framer-motion';
import { ShieldAlert, CheckCircle2, Clock, Copy, Code, Check, ExternalLink, Edit3, Trash2, X, Lock, Unlock, CalendarDays, Wrench, BadgeCheck, Pencil, SlidersHorizontal, Star, Flame, Trophy } from 'lucide-react';
import clsx from 'clsx';
import { StatTile } from '../../components/StatTile';
import { UserChip } from '../../components/UserChip';
import { AppHeader, MEMBER_NAV } from '../../components/AppHeader';
import { SelectMenu } from '../../components/SelectMenu';
import { trackForRole, memberNav, workTypeOptions, workTypeLabel, callFitsMember } from '../../constants/tracks';
import { RolesNeededPicker, parseRoles } from '../../components/RolesNeededPicker';
import { CallMeta, CallMetaFields, CallTypePicker, EMPTY_CALL_EXTRAS, extrasFromCall, type CallExtras } from '../../components/CallFields';
import { RepoChip, RepoPanel } from '../../components/RepoHealth';
import { CallContact, InterestButton, InterestList } from '../../components/CallInterest';
import { GettingStarted } from '../../components/GettingStarted';
import { ResubmitProject } from '../../components/ResubmitProject';
import { STAGES, callTypeOf } from '../../constants/community';
import { RefreshButton } from '../../components/RefreshButton';
import { DISCORD_AVAILABLE, COMING_SOON_PILL } from '../../constants/integrations';
import { MerchTab } from '../../components/merch/MerchTab';
import { Medal } from '../../components/awards/Medal';
import { AwardCard } from '../../components/awards/AwardCard';
import { evaluateAwards } from '../../components/awards/awards';
import { toast } from 'sonner';
import { SkillIcon } from '../../components/SkillIcon';
import { createVolunteerCall, deleteVolunteerCall, updateVolunteerCall, getMyProjectSubmissions, getVolunteerCalls, submitProjectSubmission, supabase, checkRepo, getMyTeams } from '../../services/supabase';
import { MyTeam, ProjectStage, ProjectSubmission, RepoStats, VolunteerCall } from '../../types';
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
  const location = useLocation();
  const [copyStatus, setCopyStatus] = React.useState<'idle' | 'copied' | 'embed-copied'>('idle');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'submit-project' | 'volunteer' | 'merch'>(() => {
    // Profile's nav links here with the section to open.
    const wanted = (location.state as { tab?: string } | null)?.tab ?? new URLSearchParams(location.search).get('tab') ?? undefined;
    return MEMBER_NAV.some((n) => n.id === wanted) ? (wanted as 'dashboard') : 'dashboard';
  });
  // Notification links and other pages can point at a tab while the dashboard is already open.
  useEffect(() => {
    const wanted = (location.state as { tab?: string } | null)?.tab ?? new URLSearchParams(location.search).get('tab') ?? undefined;
    if (wanted && MEMBER_NAV.some((n) => n.id === wanted)) setActiveTab(wanted as 'dashboard');
  }, [location.search, location.state]);
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
    setCallExtras(EMPTY_CALL_EXTRAS);
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
  const [volunteerFilter, setVolunteerFilter] = useState<'all' | 'fits' | 'mine'>('all');
  const [callKind, setCallKind] = useState<'all' | 'people' | 'things' | 'first'>('all');
  const [callExtras, setCallExtras] = useState<CallExtras>(EMPTY_CALL_EXTRAS);
  const [editExtras, setEditExtras] = useState<CallExtras>(EMPTY_CALL_EXTRAS);
  const [projectRepoUrl, setProjectRepoUrl] = useState('');
  const [repoCheck, setRepoCheck] = useState<{ state: 'idle' | 'checking' | 'done'; repo: RepoStats | null; for: string }>({ state: 'idle', repo: null, for: '' });
  const [projectStage, setProjectStage] = useState<ProjectStage | ''>('');
  const [projectOwnerType, setProjectOwnerType] = useState<'member' | 'org'>('member');
  const [projectOwnerName, setProjectOwnerName] = useState('');
  const [myTeams, setMyTeams] = useState<{ teams: MyTeam[]; pendingForMe: number } | null>(null);
  const [openInterests, setOpenInterests] = useState<string | null>(null);
  const [projectChatUrl, setProjectChatUrl] = useState('');

  const openManageModal = (call: VolunteerCall) => {
    setSelectedCallForModal(call);
    setEditTitle(call.title);
    setEditProjectUrl(call.projectUrl);
    setEditDescription(call.description);
    setEditRolesNeeded(call.rolesNeeded || '');
    setEditContact(call.contact || '');
    setEditStatus((call.status as 'open' | 'closed') || 'open');
    setEditExtras(extrasFromCall(call));
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
    const editPeople = editExtras.callType === 'people';
    if (!editTitle.trim() || !editDescription.trim() || (editPeople && !editProjectUrl.trim())) {
      toast.error(editPeople ? 'Title, project link and details are required.' : 'Title and details are required.');
      setModalActionStatus('error');
      return;
    }
    if (editPeople && editExtras.goodFirst && !editContact.trim() && !editExtras.chatUrl.trim()) {
      toast.error('Good first tasks need a contact or a group chat, so a newcomer knows who to ask.');
      setModalActionStatus('error');
      return;
    }
    setModalActionStatus('loading');
    try {
      await updateVolunteerCall(selectedCallForModal.id, {
        title: editTitle.trim(),
        projectUrl: editProjectUrl.trim(),
        description: editDescription.trim(),
        rolesNeeded: editExtras.callType === 'people' ? editRolesNeeded.trim() : '',
        contact: editContact.trim(),
        status: editStatus,
        callType: editExtras.callType,
        location: editExtras.location.trim(),
        neededBy: editExtras.neededBy,
        commitment: editPeople ? editExtras.commitment : '',
        workMode: editPeople ? editExtras.workMode : '',
        goodFirst: editExtras.callType === 'people' && editExtras.goodFirst,
        chatUrl: editExtras.chatUrl.trim(),
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

  // Admins land on /admin, unless they came here for a member tool (posting a call, submitting a project).
  const adminWantsTab = !!((location.state as { tab?: string } | null)?.tab || new URLSearchParams(location.search).get('tab'));
  useEffect(() => {
    if (authInitialized && currentUser?.isAdmin && !isRedirecting && !adminWantsTab) {
      setIsRedirecting(true);
      navigate('/admin', { replace: true });
    }
  }, [currentUser?.isAdmin, navigate, authInitialized, isRedirecting, adminWantsTab]);

  if (!authInitialized || !currentUser || isRedirecting) return <LoadingOverlay />;
  // The member's track tailors the work tab, start card and call matching to their role.
  const track = trackForRole(currentUser.specialization);

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
      getMyTeams().then((r) => setMyTeams({ teams: r.teams, pendingForMe: r.pendingForMe })).catch(() => setMyTeams(null));
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
    const isPeople = callExtras.callType === 'people';
    if (!volunteerTitle.trim() || !volunteerDescription.trim() || (isPeople && !volunteerProjectUrl.trim())) {
      toast.error(isPeople ? 'Title, project link and details are required.' : 'Title and details are required.');
      setVolunteerSubmitStatus('error');
      return;
    }
    if (isPeople && callExtras.goodFirst && !volunteerContact.trim() && !callExtras.chatUrl.trim()) {
      toast.error('Good first tasks need a contact, so a newcomer knows who to ask.');
      setVolunteerSubmitStatus('error');
      return;
    }
    setVolunteerSubmitStatus('loading');
    try {
      const res = await createVolunteerCall({
        title: volunteerTitle.trim(),
        projectUrl: volunteerProjectUrl.trim(),
        description: volunteerDescription.trim(),
        rolesNeeded: isPeople ? volunteerRolesNeeded.trim() || undefined : undefined,
        contact: volunteerContact.trim() || undefined,
        callType: callExtras.callType,
        location: callExtras.location.trim() || undefined,
        neededBy: callExtras.neededBy || undefined,
        commitment: isPeople ? callExtras.commitment || undefined : undefined,
        workMode: isPeople ? callExtras.workMode || undefined : undefined,
        goodFirst: isPeople && callExtras.goodFirst,
        chatUrl: callExtras.chatUrl.trim() || undefined,
      });
      toast.success(res?.message || 'Posted');
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
      if (projectOwnerType === 'org' && !projectOwnerName.trim()) {
        setProjectSubmitStatus('error');
        toast.error('Enter the organisation or agency this is for.');
        return;
      }
      const res = await submitProjectSubmission({
        projectName: projectName.trim(),
        projectUrl: projectUrl.trim(),
        description: projectDescription.trim(),
        projType: (projectProjType || track.defaultType).trim() || undefined,
        repoUrl: projectRepoUrl.trim() || undefined,
        stage: projectStage || undefined,
        ownerType: projectOwnerType,
        ownerName: projectOwnerType === 'org' ? projectOwnerName.trim() : undefined,
        chatUrl: projectChatUrl.trim() || undefined,
      });
      toast.success(res?.message || 'Project submitted');
      setProjectName('');
      setProjectUrl('');
      setProjectDescription('');
      setProjectProjType('');
      setProjectRepoUrl('');
      setRepoCheck({ state: 'idle', repo: null, for: '' });
      setProjectStage('');
      setProjectOwnerType('member');
      setProjectOwnerName('');
      setProjectChatUrl('');
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

  const secondaryRole = currentUser.secondarySpecialization;
  const callFits = (c: VolunteerCall) =>
    (c.callType ?? 'people') === 'people' && (
      callFitsMember(track, currentUser.specialization, c) ||
      (!!secondaryRole && callFitsMember(trackForRole(secondaryRole), secondaryRole, c))
    );
  const fitsCount = volunteerCalls.filter((c) => c.status !== 'closed' && callFits(c)).length;
  const filteredVolunteerCalls = volunteerCalls.filter((c) => {
    if (volunteerFilter === 'mine') {
      return c.userId === currentUser.id || !!currentUser.isAdmin;
    }
    if (volunteerFilter === 'fits') return callFits(c);
    return true;
  }).filter((c) => {
    const kind = c.callType ?? 'people';
    if (callKind === 'people') return kind === 'people';
    if (callKind === 'things') return kind !== 'people';
    if (callKind === 'first') return !!c.goodFirst;
    return true;
  }).sort((a, b) => Number(!!b.goodFirst && b.status !== 'closed') - Number(!!a.goodFirst && a.status !== 'closed'));
  const repoCheckFor = async (raw: string) => {
    const url = raw.trim();
    if (!url) { setRepoCheck({ state: 'idle', repo: null, for: '' }); return; }
    if (url === repoCheck.for) return;
    setRepoCheck({ state: 'checking', repo: null, for: url });
    try {
      setRepoCheck({ state: 'done', repo: await checkRepo(url), for: url });
    } catch {
      setRepoCheck({ state: 'idle', repo: null, for: '' });
    }
  };

  const firstName = (currentUser.fullName || '').trim().split(' ')[0] || 'there';
  const statusMeta = currentUser.status === 'Approved'
    ? { dot: 'bg-emerald-500', word: 'Approved', note: 'Your card is active and publicly verifiable.', icon: BadgeCheck, tone: 'text-emerald-700 bg-emerald-50 shadow-[inset_0_0_0_1px_rgb(16_185_129/0.25)]' }
    : currentUser.status === 'Declined'
      ? { dot: 'bg-red-500', word: 'Declined', note: 'See the note from the admins below.', icon: ShieldAlert, tone: 'text-red-700 bg-red-50 shadow-[inset_0_0_0_1px_rgb(239_68_68/0.25)]' }
      : { dot: 'bg-amber-500', word: 'Under review', note: 'An admin is reviewing your application.', icon: Clock, tone: 'text-amber-800 bg-amber-50 shadow-[inset_0_0_0_1px_rgb(217_119_6/0.25)]' };
  const StatusIcon = statusMeta.icon;
  const featuredSkills = (currentUser.skills || []).filter((s) => s.featured);
  const otherSkills = (currentUser.skills || []).filter((s) => !s.featured);


  const sectionTitle = 'text-[15px] font-semibold tracking-[-0.01em] text-slate-900';
  const fieldLabel = 'text-[12px] text-slate-500';

  return (
    <>
      <div className="site min-h-screen pb-16">
        <AppHeader
          items={memberNav(track)}
          activeId={activeTab}
          onSelect={(id) => setActiveTab(id as typeof activeTab)}
          account={
            <UserChip
              name={currentUser.fullName}
              subtitle={currentUser.role || 'Member'}
              email={currentUser.email}
              memberId={currentUser.memberId}
              verified={currentUser.status === 'Approved' || !!currentUser.isAdmin}
              isAdmin={!!currentUser.isAdmin}
              discordId={currentUser.discordId}
              discordAvatar={currentUser.discordAvatar}
              seed={currentUser.uid || currentUser.id}
              onOpen={() => {
                setActiveTab('dashboard');
                setTimeout(() => document.getElementById('digital-card-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
              }}
              openLabel="View my card"
              onSignOut={handleLogout}
            />
          }
        />

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
                    label={track.statLabel}
                    icon={track.icon}
                    value={submittedCount > 0 ? <>{approvedCount}<span className="text-[15px] font-normal text-slate-400"> / {submittedCount}</span></> : approvedCount}
                    hint={submittedCount > 0 ? 'approved' : 'none yet'}
                  />
                </div>

                {/* Discord is optional at sign-up for now; nudge members to connect it once it's available */}
                {DISCORD_AVAILABLE && !(currentUser.discordConnected || currentUser.discordId) && (
                  <section className="s-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6" aria-labelledby="discord-nudge-title">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#5865F2] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(15_23_42/0.2)]">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 id="discord-nudge-title" className="text-[15px] font-semibold text-slate-900">Connect your Discord</h2>
                      <p className="mt-0.5 text-[13px] leading-snug text-slate-500">
                        Optional for now. Link it when you can so the team can reach you and add you to project channels.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/profile?tab=connections')}
                      className="s-btn h-10 shrink-0 bg-[#5865F2] px-4 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(15_23_42/0.25)] [@media(hover:hover)]:hover:bg-[#4752C4]"
                    >
                      Connect Discord
                    </button>
                  </section>
                )}

                <GettingStarted user={currentUser} calls={volunteerCalls} teams={myTeams?.teams ?? null} />

                {myTeams && (myTeams.teams.length > 0 || myTeams.pendingForMe > 0) && (
                  <section className="s-card p-5 sm:p-6" aria-labelledby="teams-title">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h2 id="teams-title" className={sectionTitle}>Your teams</h2>
                      {myTeams.pendingForMe > 0 && (
                        <p className="text-[13px] font-medium text-amber-800">
                          {myTeams.pendingForMe} {myTeams.pendingForMe === 1 ? 'person wants' : 'people want'} to join
                        </p>
                      )}
                    </div>
                    <ul className="mt-3 divide-y divide-slate-200/80">
                      {myTeams.teams.map((t) => (
                        <li key={t.projectId}>
                          <Link to={`/projects/${encodeURIComponent(t.projectId)}`} className="flex items-center justify-between gap-3 py-3 hover:text-[var(--accent)]">
                            <span className="min-w-0">
                              <span className="block truncate text-[14px] font-medium text-slate-900">{t.projectName}</span>
                              <span className="block text-[12.5px] text-slate-500">
                                {t.role === 'head' ? 'Team head' : t.teamRole || 'Member'}
                                {t.projectStatus !== 'approved' ? ' · project in review' : ''}
                              </span>
                            </span>
                            <span className={clsx(
                              'shrink-0 rounded-full px-2 py-0.5 text-[12px] font-medium',
                              t.status === 'approved' ? 'bg-emerald-50 text-emerald-800' : t.status === 'pending' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'
                            )}>
                              {t.status === 'approved' ? 'On the team' : t.status === 'pending' ? 'Requested' : 'Declined'}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Where to start — shortcuts chosen for the member's role */}
                <section className="s-card p-5 sm:p-6" aria-labelledby="start-title">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h2 id="start-title" className={sectionTitle}>Where to start</h2>
                    <p className="text-[13px] text-slate-500">
                      Picked for <span className="font-medium text-slate-700">{currentUser.specialization || 'you'}</span>
                    </p>
                  </div>
                  <ul className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    {track.starts.map((a) => {
                      const inner = (
                        <>
                          <a.icon size={20} strokeWidth={1.75} className="text-[var(--accent)]" aria-hidden />
                          <span className="mt-3 block text-[14px] font-semibold text-slate-900">{a.title}</span>
                          <span className="mt-0.5 block flex-1 text-[13px] leading-snug text-slate-500">{a.desc}</span>
                          <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--accent)]">
                            {a.label}
                            {a.href?.startsWith('http') ? <ExternalLink size={12} strokeWidth={1.75} /> : <span aria-hidden>→</span>}
                          </span>
                        </>
                      );
                      const cls = 'flex h-full flex-col rounded-[12px] bg-slate-50 p-4 text-left shadow-[inset_0_0_0_1px_rgb(15_23_42/0.06)] transition-[background-color,box-shadow] duration-150 hover:bg-white hover:shadow-[0_0_0_1px_rgb(15_23_42/0.1),0_4px_12px_-4px_rgb(15_23_42/0.12)] focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_rgb(30_58_138/0.3)]';
                      return (
                        <li key={a.title}>
                          {a.tab ? (
                            <button type="button" className={cls + ' w-full'} onClick={() => { setActiveTab(a.tab!); window.scrollTo({ top: 0 }); if (a.tab === 'volunteer' && fitsCount > 0) setVolunteerFilter('fits'); }}>
                              {inner}
                            </button>
                          ) : a.href?.startsWith('http') ? (
                            <a href={a.href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
                          ) : (
                            <a href={a.href} className={cls}>{inner}</a>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>

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
                      { label: 'Active days', short: 'Active', value: activeDays, icon: CalendarDays },
                      { label: 'Current streak', short: 'Streak', value: `${currentStreak}d`, icon: Flame },
                      { label: 'Longest streak', short: 'Best', value: `${longestStreak}d`, icon: Trophy },
                    ].map((st) => (
                      <div key={st.label} className="min-w-0 px-2 text-center sm:px-4">
                        <dt className="flex flex-col items-center justify-center gap-1 text-[12px] leading-tight text-slate-500 sm:flex-row sm:gap-1.5">
                          <st.icon size={13} strokeWidth={1.75} className="shrink-0 text-slate-400" aria-hidden />
                          <span className="sm:hidden">{st.short}</span>
                          <span className="hidden sm:inline">{st.label}</span>
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
                    <button type="button" onClick={() => navigate('/profile')} className="s-btn s-btn-plain h-8 px-3 text-[13px]">
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
                              {currentUser.discordDisplayName || currentUser.discordUsername || (
                                DISCORD_AVAILABLE ? (
                                  <button type="button" onClick={() => navigate('/profile?tab=connections')} className="font-medium text-[var(--accent)] hover:underline">
                                    Connect Discord
                                  </button>
                                ) : (
                                  <span className="text-slate-400">Coming soon</span>
                                )
                              )}
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
                    <button type="button" onClick={() => navigate('/profile?tab=skills')} className="s-btn s-btn-plain h-8 px-3 text-[13px]">
                      <SlidersHorizontal size={14} strokeWidth={1.75} />
                      Customize
                    </button>
                  </div>

                  {totalSkills === 0 ? (
                    <div className="mt-4 rounded-[12px] bg-slate-50 px-4 py-6 text-center">
                      <p className="text-[14px] text-slate-600">No skills listed yet.</p>
                      <button type="button" onClick={() => navigate('/profile?tab=skills')} className="s-btn s-btn-accent mt-3">Add your skills</button>
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
                <h1 className="text-[28px] sm:text-[32px]">{track.tabLabel}</h1>
                <p className="mt-1.5 text-[15px] text-slate-600">{track.intro}</p>
              </div>
              <a href="/projects" target="_blank" rel="noopener noreferrer" className="group inline-flex shrink-0 items-center gap-1 text-[14px] font-medium text-[var(--accent)]">
                See everyone’s work
                <ExternalLink size={13} strokeWidth={1.75} />
              </a>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-10">
              <section className="min-w-0" aria-labelledby="submit-title">
                <div className="s-card p-5 sm:p-6 lg:sticky lg:top-24">
                  <h2 id="submit-title" className="text-[16px] font-semibold">{track.submitTitle}</h2>
                  <form onSubmit={handleProjectSubmit} className="mt-5 space-y-4">
                    <div>
                      <label htmlFor="proj-name" className="mb-1.5 block text-[13px] font-medium text-slate-900">{track.nameLabel}</label>
                      <input
                        id="proj-name"
                        type="text"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        className="s-field"
                        placeholder={track.namePlaceholder}
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
                        placeholder={track.linkPlaceholder}
                        disabled={projectSubmitStatus === 'loading'}
                      />
                      <p className="mt-1.5 text-[12px] text-slate-500">{track.linkHint}</p>
                    </div>
                    <div>
                      <label htmlFor="proj-repo" className="mb-1.5 block text-[13px] font-medium text-slate-900">
                        GitHub repository <span className="font-normal text-slate-400">optional</span>
                      </label>
                      <input
                        id="proj-repo"
                        type="url"
                        inputMode="url"
                        value={projectRepoUrl}
                        onChange={(e) => setProjectRepoUrl(e.target.value)}
                        onBlur={(e) => repoCheckFor(e.target.value)}
                        className="s-field"
                        placeholder="https://github.com/owner/repo"
                        disabled={projectSubmitStatus === 'loading'}
                      />
                      <p className="mt-1.5 text-[12px] text-slate-500">We check it’s public and track its progress on the project page.</p>
                      {repoCheck.state === 'checking' && <p className="mt-2 text-[12.5px] text-slate-500" role="status">Checking the repository…</p>}
                      {repoCheck.state === 'done' && repoCheck.repo && (
                        <div className="mt-3"><RepoPanel repo={repoCheck.repo} compact /></div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
                      <div>
                        <label id="proj-stage-label" htmlFor="proj-stage" className="mb-1.5 block text-[13px] font-medium text-slate-900">Stage</label>
                        <SelectMenu
                          id="proj-stage"
                          labelledBy="proj-stage-label"
                          value={projectStage}
                          disabled={projectSubmitStatus === 'loading'}
                          onChange={(v) => setProjectStage(v as ProjectStage | '')}
                          placeholder="Choose a stage"
                          options={STAGES.map((st) => ({ value: st.id, label: st.label, hint: st.hint }))}
                        />
                      </div>
                      <div>
                        <p id="proj-owner-label" className="mb-1.5 block text-[13px] font-medium text-slate-900">Who owns it?</p>
                        <div role="radiogroup" aria-labelledby="proj-owner-label" className="grid grid-cols-2 gap-1 rounded-[10px] bg-slate-200/60 p-1">
                          {(['member', 'org'] as const).map((o) => (
                            <button key={o} type="button" role="radio" aria-checked={projectOwnerType === o} onClick={() => setProjectOwnerType(o)}
                              className={clsx('min-h-[36px] rounded-[8px] text-[13px]', projectOwnerType === o ? 'bg-white font-medium text-slate-900 shadow-[var(--e1)]' : 'text-slate-500')}>
                              {o === 'member' ? 'Me' : 'An organisation'}
                            </button>
                          ))}
                        </div>
                        {projectOwnerType === 'org' && (
                          <input aria-label="Organisation name" maxLength={120} value={projectOwnerName} onChange={(e) => setProjectOwnerName(e.target.value)} className="s-field mt-2" placeholder="Barangay, agency, school or NGO" />
                        )}
                        <p className="mt-1.5 text-[12px] text-slate-500">You lead the team either way, and can hand it over later.</p>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="proj-chat" className="mb-1.5 block text-[13px] font-medium text-slate-900">
                        Team group chat <span className="font-normal text-slate-400">optional</span>
                      </label>
                      <input id="proj-chat" type="url" inputMode="url" maxLength={300} value={projectChatUrl} onChange={(e) => setProjectChatUrl(e.target.value)}
                        className="s-field" placeholder="Messenger, WhatsApp, Viber, Telegram or Discord invite" disabled={projectSubmitStatus === 'loading'} />
                      <p className="mt-1.5 text-[12px] text-slate-500">Shown to signed-in members on the project page.</p>
                    </div>
                    <div>
                      <label htmlFor="proj-desc" className="mb-1.5 block text-[13px] font-medium text-slate-900">Description</label>
                      <textarea
                        id="proj-desc"
                        value={projectDescription}
                        onChange={(e) => setProjectDescription(e.target.value)}
                        className="s-field h-auto min-h-[120px] resize-y py-2.5"
                        placeholder={track.descPlaceholder}
                        disabled={projectSubmitStatus === 'loading'}
                      />
                    </div>
                    <div>
                      <label id="proj-type-label" htmlFor="proj-type" className="mb-1.5 block text-[13px] font-medium text-slate-900">Type</label>
                      <SelectMenu
                        id="proj-type"
                        labelledBy="proj-type-label"
                        value={projectProjType || track.defaultType}
                        placeholder="Select a type"
                        options={workTypeOptions(track)}
                        onChange={setProjectProjType}
                      />
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
                    <p className="mx-auto mt-1 max-w-xs text-[14px] text-slate-500">What you share shows up here while it’s reviewed.</p>
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
                        {s.adminNote && (
                          <div className={clsx('mt-3 rounded-[10px] px-3.5 py-2.5 text-[13.5px]', s.status === 'rejected' ? 'bg-red-50 text-red-900 shadow-[inset_0_0_0_1px_rgb(254_202_202)]' : 'bg-slate-50 text-slate-800 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.06)]')} role="note">
                            <p className="text-[11.5px] font-medium text-slate-500">Note from the reviewer</p>
                            <p className="mt-0.5 whitespace-pre-wrap break-words">{s.adminNote}</p>
                          </div>
                        )}
                        {s.repo && <RepoChip repo={s.repo} className="mt-3" />}
                        {s.status === 'rejected' && <ResubmitProject submission={s} onDone={() => loadMySubmissions(false)} />}
                        <p className="mt-3 flex flex-wrap items-center gap-x-2 text-[12px] text-slate-500">
                          <Link to={`/projects/${encodeURIComponent(String(s.id))}`} className="font-medium text-[var(--accent)] hover:underline">Project page & team</Link>
                          <span aria-hidden>·</span>
                          {s.projType && <span>{workTypeLabel(s.projType)}</span>}
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
                  <h2 id="post-title" className="text-[16px] font-semibold">Post a call or request</h2>
                  <form onSubmit={handleVolunteerSubmit} className="mt-5 space-y-4">
                    <CallTypePicker idPrefix="vc" value={callExtras.callType} onChange={(t) => setCallExtras({ ...callExtras, callType: t })} disabled={volunteerSubmitStatus === 'loading'} />
                    <div>
                      <label htmlFor="vc-title" className="mb-1.5 block text-[13px] font-medium text-slate-900">Title</label>
                      <input
                        id="vc-title"
                        type="text"
                        value={volunteerTitle}
                        onChange={(e) => setVolunteerTitle(e.target.value)}
                        className="s-field"
                        placeholder={callTypeOf(callExtras.callType).titlePlaceholder}
                        maxLength={160}
                        disabled={volunteerSubmitStatus === 'loading'}
                      />
                    </div>
                    <div>
                      <label htmlFor="vc-url" className="mb-1.5 block text-[13px] font-medium text-slate-900">
                        Project link {callExtras.callType !== 'people' && <span className="font-normal text-slate-400">optional</span>}
                      </label>
                      <input
                        id="vc-url"
                        type="url"
                        inputMode="url"
                        value={volunteerProjectUrl}
                        onChange={(e) => setVolunteerProjectUrl(e.target.value)}
                        className="s-field"
                        placeholder="https://…"
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
                        placeholder={callTypeOf(callExtras.callType).detailsPlaceholder}
                        maxLength={4000}
                        disabled={volunteerSubmitStatus === 'loading'}
                      />
                    </div>
                    <CallMetaFields idPrefix="vc" value={callExtras} onChange={setCallExtras} disabled={volunteerSubmitStatus === 'loading'} />
                    <div className="grid grid-cols-1 gap-4">
                      {callExtras.callType === 'people' && (
                      <div>
                        <label id="vc-roles-label" htmlFor="vc-roles" className="mb-1.5 block text-[13px] font-medium text-slate-900">
                          Roles needed <span className="font-normal text-slate-400">optional</span>
                        </label>
                        <RolesNeededPicker
                          id="vc-roles"
                          labelledBy="vc-roles-label"
                          value={volunteerRolesNeeded}
                          onChange={setVolunteerRolesNeeded}
                          disabled={volunteerSubmitStatus === 'loading'}
                        />
                      </div>
                      )}
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
                          placeholder="Discord handle, or a group chat link"
                          maxLength={200}
                          disabled={volunteerSubmitStatus === 'loading'}
                        />
                      </div>
                    </div>
                    <button type="submit" disabled={volunteerSubmitStatus === 'loading'} className="s-btn s-btn-accent h-11 w-full">
                      {volunteerSubmitStatus === 'loading' ? 'Posting…' : callExtras.callType === 'people' ? 'Post call' : 'Post request'}
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
                    {(['all', 'fits', 'mine'] as const).map((f) => (
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
                        {f === 'all' ? 'All calls' : f === 'fits' ? (
                          <span className="inline-flex items-center gap-1.5">
                            For you
                            {fitsCount > 0 && <span className="num rounded-full bg-[var(--accent)] px-1.5 text-[11px] font-semibold text-white">{fitsCount}</span>}
                          </span>
                        ) : 'My calls'}
                      </button>
                    ))}
                  </div>
                  <RefreshButton onRefresh={() => loadVolunteerCalls(true)} loading={volunteerCallsLoading} />
                </div>
                <div className="-mt-1 mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Show">
                  {([['all', 'Everything'], ['people', 'Volunteers'], ['things', 'Venues & resources'], ['first', 'Good first tasks']] as const).map(([k, label]) => (
                    <button key={k} type="button" aria-pressed={callKind === k} onClick={() => setCallKind(k)}
                      className={clsx('min-h-[32px] rounded-full px-3 text-[12.5px] transition-[background-color,box-shadow,color] duration-150',
                        callKind === k ? 'bg-slate-900 font-medium text-white' : 'bg-white text-slate-600 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.12)] hover:text-slate-900')}>
                      {label}
                    </button>
                  ))}
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
                      {volunteerFilter === 'mine' ? 'You haven’t posted a call yet' : volunteerFilter === 'fits' ? `No calls for ${track.tabLabel.toLowerCase()} yet` : 'No open calls right now'}
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
                              <h3 className="break-words text-[15px] font-semibold">
                                {c.title}
                                {!isClosed && callFits(c) && (
                                  <span className="ml-2 inline-flex translate-y-[-1px] items-center rounded-full bg-[#eef3ff] px-2 py-0.5 align-middle text-[11px] font-medium text-[var(--accent)] shadow-[inset_0_0_0_1px_rgb(30_58_138/0.18)]">
                                    Fits you
                                  </span>
                                )}
                              </h3>
                              {c.postedBy?.fullName && (
                                <p className="mt-0.5 text-[13px] text-slate-500">Posted by {c.postedBy.fullName}</p>
                              )}
                              <CallMeta call={c} />
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

                          {!isOwner && !isClosed && (
                            <div className="mt-4 space-y-3">
                              <InterestButton
                                call={c}
                                signedIn
                                isOwner={false}
                                compact
                                returnPath={`/opportunities?call=${encodeURIComponent(c.id)}`}
                                onChanged={(st) => setVolunteerCalls((list) => list.map((x) => (x.id === c.id ? { ...x, myInterest: st } : x)))}
                              />
                              <CallContact call={c} />
                            </div>
                          )}
                          {isOwner && typeof c.interestCount === 'number' && (
                            <div className="mt-4 rounded-[12px] bg-slate-50 p-3.5 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.05)]">
                              <button
                                type="button"
                                aria-expanded={openInterests === c.id}
                                onClick={() => setOpenInterests(openInterests === c.id ? null : c.id)}
                                className="flex w-full items-center justify-between gap-3 text-left text-[13.5px] font-medium text-slate-900"
                              >
                                <span>
                                  {c.interestCount === 0 ? 'No one has raised a hand yet' : `${c.interestCount} ${c.interestCount === 1 ? 'person is' : 'people are'} interested`}
                                </span>
                                <span className="text-[12.5px] font-normal text-[var(--accent)]">{openInterests === c.id ? 'Hide' : 'See who'}</span>
                              </button>
                              {openInterests === c.id && (
                                <div className="mt-3 border-t border-slate-200/80 pt-3">
                                  <InterestList callId={c.id} />
                                </div>
                              )}
                            </div>
                          )}

                          {(c.rolesNeeded || c.contact || c.createdAt) && (
                            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 border-t border-slate-200/80 pt-3 text-[13px] sm:grid-cols-3">
                              {c.rolesNeeded && (
                                <div className="min-w-0">
                                  <dt className="text-[12px] text-slate-500">Roles</dt>
                                  <dd className="mt-1 flex flex-wrap gap-1">
                                    {parseRoles(c.rolesNeeded).map((r) => {
                                      const mine = !!currentUser.specialization && r.toLowerCase() === currentUser.specialization.toLowerCase();
                                      return (
                                        <span
                                          key={r}
                                          className={clsx(
                                            'rounded-full px-2 py-0.5 text-[12px]',
                                            mine ? 'bg-[#eef3ff] font-medium text-[var(--accent)] shadow-[inset_0_0_0_1px_rgb(30_58_138/0.2)]' : 'bg-slate-100 text-slate-700'
                                          )}
                                        >
                                          {r}
                                        </span>
                                      );
                                    })}
                                  </dd>
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
                <CallTypePicker idPrefix="edit" value={editExtras.callType} onChange={(t) => setEditExtras({ ...editExtras, callType: t })} />
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
                    required={editExtras.callType === 'people'}
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

                <CallMetaFields idPrefix="edit" value={editExtras} onChange={setEditExtras} />

                {editExtras.callType === 'people' && (
                <div>
                  <label id="edit-roles-label" htmlFor="edit-roles" className="block text-[13px] font-medium text-slate-900 mb-1.5">
                    Roles needed
                  </label>
                  <RolesNeededPicker
                    id="edit-roles"
                    labelledBy="edit-roles-label"
                    value={editRolesNeeded}
                    onChange={setEditRolesNeeded}
                  />
                </div>
                )}

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
    </>
  );
}
