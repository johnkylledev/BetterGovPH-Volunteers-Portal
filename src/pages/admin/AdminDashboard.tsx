import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Avatar } from '../../components/Avatar';
import { ReportsQueue } from '../../components/ReportsQueue';
import { AdminOverview } from '../../components/admin/AdminOverview';
import { AdminCalls } from '../../components/admin/AdminCalls';
import { NotificationBell } from '../../components/NotificationBell';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, CheckCircle2, XCircle, CreditCard, Copy, Code, Check, Briefcase, ChevronLeft, ChevronRight, Trash2, Inbox, FolderKanban, Clock, BadgeCheck } from 'lucide-react';
import { AccessCard } from '../../components/AccessCard';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import clsx from 'clsx';
import { StatTile } from '../../components/StatTile';
import { UserChip } from '../../components/UserChip';
import { User, ApplicationStatus, ProjectSubmission } from '../../types';
import { deleteProjectSubmission, editProjectSubmission, getAllUsers, getAdminStats, getProjectSubmissions, updateProjectSubmission, supabase, getConsentRecords, importProjects } from '../../services/supabase';
import type { ImportProjectRow } from '../../types';
import { ROPA_REGISTER, CONSENT_PURPOSES } from '../../constants/community';
import { SkillIcon } from '../../components/SkillIcon';
import { SPECIALIZATIONS, ROLE_GROUPS } from '../../constants/specializations';
import { SelectMenu, type SelectOption } from '../../components/SelectMenu';

// Role filter for the admin tables: every role, grouped like the sign-up picker.
const ROLE_FILTER_OPTIONS: SelectOption[] = [
  { value: 'All', label: 'All roles' },
  ...SPECIALIZATIONS.map((sp) => ({ value: sp.label, label: sp.label, icon: sp.icon, group: ROLE_GROUPS.find((g) => g.id === (sp.group ?? 'tech'))?.label })),
];


/**
 * Paste rows from a spreadsheet (tab-separated) or CSV: name, link, description, type, repo, chat, owner.
 * A header row is detected and skipped. Quoted CSV fields may contain commas.
 */
const parseImportRows = (text: string): ImportProjectRow[] => {
  const splitCsv = (line: string) => {
    const out: string[] = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out;
  };
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    .map((l) => (l.includes('\t') ? l.split('\t') : splitCsv(l)).map((c) => c.trim()))
    .filter((cols, i) => !(i === 0 && /^name$/i.test(cols[0] || '')))
    .map(([name = '', url = '', description = '', type = '', repoUrl = '', chatUrl = '', ownerName = '']) => ({
      name, url, description: description || undefined, type: type || undefined,
      repoUrl: repoUrl || undefined, chatUrl: chatUrl || undefined, ownerName: ownerName || undefined,
    }))
    .filter((r) => r.name || r.url);
};

export default function AdminDashboard() {
  const { currentUser, users, updateUserStatus, setUsers, authInitialized } = useStore();
  const logout = useStore((s) => s.logout);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'applications' | 'members' | 'projects' | 'calls'>(() => {
    const t = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
    return t === 'applications' || t === 'members' || t === 'projects' || t === 'calls' ? t : 'overview';
  });
  const adminLocation = useLocation();
  useEffect(() => {
    const t = new URLSearchParams(adminLocation.search).get('tab');
    if (t === 'applications' || t === 'members' || t === 'projects' || t === 'calls' || t === 'overview') setActiveTab(t);
  }, [adminLocation.search]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'All'>('All');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [showMyCard, setShowMyCard] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'embed-copied'>('idle');
  const [projectSubmissions, setProjectSubmissions] = useState<ProjectSubmission[]>([]);
  const [projectSubmissionsTotal, setProjectSubmissionsTotal] = useState(0);
  const [projectSubmissionsLoading, setProjectSubmissionsLoading] = useState(false);
  const [projectActionLoadingId, setProjectActionLoadingId] = useState<string | null>(null);
  // Review dialog: the note goes back to the submitter (required when rejecting).
  const [review, setReview] = useState<{ id: string; name: string; action: 'approve' | 'reject'; note: string; error: string } | null>(null);
  const [ropaBusy, setRopaBusy] = useState(false);
  const [postingCall, setPostingCall] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: { name: string; reason: string }[] } | null>(null);
  const [projectStats, setProjectStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [projectStatusFilter, setProjectStatusFilter] = useState<'All' | 'pending' | 'approved' | 'rejected'>('All');
  const [projectPage, setProjectPage] = useState(0);
  const [projectPageSize] = useState(5);
  const [projectTotalCount, setProjectTotalCount] = useState(0);
  const [editingSubmission, setEditingSubmission] = useState<ProjectSubmission | null>(null);
  const [editForm, setEditForm] = useState({ projectName: '', projectUrl: '', description: '', projType: '', status: '' });
  const [editSaving, setEditSaving] = useState(false);

  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(5);
  const [totalCount, setTotalCount] = useState(0);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0 });

  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    if (authInitialized && (!currentUser || !currentUser.isAdmin)) {
      navigate('/login');
    }
  }, [currentUser, navigate, authInitialized]);

  const loadStats = async () => {
    if (!currentUser?.isAdmin) return;
    const s = await getAdminStats();
    setStats(s);
  };

  const loadUsers = async (page: number, showLoading = true, search = debouncedSearch) => {
    if (!currentUser?.isAdmin) return;
    if (activeTab !== 'applications' && activeTab !== 'members') return;
    if (showLoading) setIsDataLoading(true);
    try {
      const filters = {
        status: activeTab === 'members' ? 'Approved' : activeTab === 'applications' ? 'Pending' : statusFilter,
        role: roleFilter,
        search: search
      };
      const { users: fetchedUsers, totalCount: fetchedTotal } = await getAllUsers(page, pageSize, filters);
      const validUsers = fetchedUsers.filter(u => u.status === 'Approved' || (typeof u.specialization === 'string' && u.specialization.trim().length > 0));
      setUsers(validUsers);
      setTotalCount(fetchedTotal);
    } catch {
    } finally {
      if (showLoading) setIsDataLoading(false);
    }
  };

  const loadProjectSubmissions = async (showLoading = true) => {
    if (!currentUser?.isAdmin) return;
    if (showLoading) setProjectSubmissionsLoading(true);
    try {
      const [mainRes, totalRes, pendingRes, approvedRes, rejectedRes] = await Promise.all([
        getProjectSubmissions(projectPage, projectPageSize, { status: projectStatusFilter === 'All' ? undefined : projectStatusFilter }),
        getProjectSubmissions(0, 1),
        getProjectSubmissions(0, 1, { status: 'pending' }),
        getProjectSubmissions(0, 1, { status: 'approved' }),
        getProjectSubmissions(0, 1, { status: 'rejected' }),
      ]);
      const { submissions, totalCount: fetchedTotal } = mainRes;
      setProjectSubmissions(submissions);
      setProjectTotalCount(fetchedTotal);
      setProjectSubmissionsTotal(fetchedTotal);
      setProjectStats({
        total: totalRes.totalCount,
        pending: pendingRes.totalCount,
        approved: approvedRes.totalCount,
        rejected: rejectedRes.totalCount,
      });
    } catch (error) {
      console.error('Error loading project submissions:', error);
    } finally {
      if (showLoading) setProjectSubmissionsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [currentUser]);

  useEffect(() => {
    setCurrentPage(0);
    setProjectPage(0);
    setUsers([]);
    setProjectSubmissions([]);
  }, [activeTab, statusFilter, roleFilter, debouncedSearch, projectStatusFilter]);

  useEffect(() => {
    if (!currentUser?.isAdmin) return;
    if (activeTab === 'projects') {
      loadProjectSubmissions(true);
    } else if (activeTab === 'applications' || activeTab === 'members') {
      loadUsers(currentPage, true, debouncedSearch);
    }
  }, [currentUser, currentPage, activeTab, statusFilter, roleFilter, debouncedSearch, projectStatusFilter, projectPage]);

  useEffect(() => {
    if (!currentUser?.isAdmin) return;

    const usersChannel = supabase
      .channel('admin-users-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
        },
        () => {
          if (activeTab === 'applications' || activeTab === 'members') {
            loadUsers(currentPage, false);
          }
          loadStats();
        }
      )
      .subscribe();

    const projectsChannel = supabase
      .channel('admin-projects-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_submissions',
        },
        () => {
          if (activeTab === 'projects') {
            loadProjectSubmissions(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(usersChannel);
      supabase.removeChannel(projectsChannel);
    };
  }, [currentUser?.isAdmin, currentPage, activeTab]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!authInitialized) return <LoadingOverlay />;
  if (!currentUser) {
    navigate('/login');
    return null;
  }
  if (!currentUser.isAdmin) {
    navigate('/dashboard');
    return null;
  }

  const handleLogout = useCallback(async () => {
    try {
      console.log('Logout clicked');
      await logout();
      console.log('Logout successful, navigating to login');
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout failed:', err);
      alert('Logout failed. Please try again.');
    }
  }, [logout, navigate]);

  const handleStatusUpdate = async (userId: string, status: ApplicationStatus) => {
    const user = users.find(u => u.id === userId);
    if (user && user.status === 'Approved' && status !== 'Approved') {
      alert('Cannot change status of an already approved member.');
      return;
    }

    if (user && user.status === 'Declined' && status === 'Approved') {
      const confirmApproval = window.confirm(`Are you sure you want to approve ${user.fullName}? This user was recently declined.`);
      if (!confirmApproval) return;
    }

    try {
      const res = await updateUserStatus(userId, status, adminNote);

      if (res && (res as any).success) {
        setSelectedUser(null);
        setAdminNote('');
        loadUsers(currentPage);
        loadStats();
      } else {
        alert(`Failed to update database: ${(res as any)?.message || 'Unknown error'}. Please check if the user exists in Supabase.`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message || 'Failed to update user status'}`);
    }
  };

  const handleProjectAction = async (submissionId: string, action: 'approve' | 'reject', note?: string) => {
    if (!submissionId) return false;
    setProjectActionLoadingId(submissionId);
    try {
      await updateProjectSubmission(submissionId, action, note);
      await loadProjectSubmissions();
      return true;
    } catch (error) {
      setReview((r) => (r ? { ...r, error: error instanceof Error ? error.message : 'Failed to update project submission.' } : r));
      return false;
    } finally {
      setProjectActionLoadingId(null);
    }
  };

  // Record of Processing Activities (RA 10173): the processing register plus every member's consent, in one workbook.
  const exportRopa = async () => {
    setRopaBusy(true);
    try {
      const [{ members, log, version }, XLSX] = await Promise.all([getConsentRecords(), import('xlsx-js-style')]);
      const purposeLabel = (id: string) => CONSENT_PURPOSES.find((p) => p.id === id)?.label || id;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ROPA_REGISTER.map((r) => ({
        'Processing activity': r.activity, Purpose: r.purpose, 'Data subjects': r.subjects, 'Personal data': r.data,
        'Lawful basis': r.basis, Recipients: r.recipients, Retention: r.retention,
      }))), 'Processing register');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(members.map((m: any) => ({
        'Member ID': m.member_id || '', Name: m.full_name, Email: m.email, Status: m.status,
        'Consent version': m.consent_version || 'none', 'Consented at': m.consent_at ? new Date(m.consent_at).toLocaleString() : 'not yet',
        Purposes: (Array.isArray(m.consent_purposes) ? m.consent_purposes : []).map(purposeLabel).join('; '),
        'In directory': m.show_in_directory === false ? 'No' : 'Yes', 'Full name public': m.show_full_name ? 'Yes' : 'No',
        'Deletion requested': m.deletion_requested_at ? new Date(m.deletion_requested_at).toLocaleDateString() : '',
        'Joined': m.created_at ? new Date(m.created_at).toLocaleDateString() : '',
      }))), 'Consent by member');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(log.map((l: any) => ({
        When: new Date(l.created_at).toLocaleString(), 'User ID': l.user_id, Action: l.action, Version: l.consent_version,
        Purposes: (Array.isArray(l.purposes) ? l.purposes : []).map(purposeLabel).join('; '),
      }))), 'Consent log');
      XLSX.writeFile(wb, `BetterGovPH_ROPA_${version}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not export privacy records.');
    } finally {
      setRopaBusy(false);
    }
  };

  const handleEditClick = (submission: ProjectSubmission) => {
    setEditingSubmission(submission);
    setEditForm({
      projectName: submission.projectName,
      projectUrl: submission.projectUrl,
      description: submission.description,
      projType: submission.projType || '',
      status: submission.status,
    });
  };

  const handleEditSave = async () => {
    if (!editingSubmission) return;
    if (!editForm.projectName.trim() || !editForm.projectUrl.trim() || !editForm.description.trim()) {
      alert('Project name, URL, and description are required.');
      return;
    }
    setEditSaving(true);
    try {
      await editProjectSubmission(editingSubmission.id, {
        project_name: editForm.projectName.trim(),
        project_url: editForm.projectUrl.trim(),
        description: editForm.description.trim(),
        proj_type: editForm.projType.trim() || undefined,
        status: editForm.status || undefined,
      });
      setEditingSubmission(null);
      await loadProjectSubmissions();
    } catch {
      alert('Failed to update project submission.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleProjectDelete = async (submissionId: string, options?: { deleteUser?: boolean }) => {
    if (!submissionId) return;
    const message = options?.deleteUser
      ? 'Delete this project submission AND permanently delete the user and their related records?'
      : 'Delete this project submission?';
    if (!window.confirm(message)) return;
    setProjectActionLoadingId(submissionId);
    try {
      await deleteProjectSubmission(submissionId, { deleteUser: !!options?.deleteUser });
      await loadProjectSubmissions();
      await loadStats();
    } catch {
      alert('Failed to delete project submission.');
    } finally {
      setProjectActionLoadingId(null);
    }
  };

  const handleCopyLink = (user: User) => {
    const url = `${window.location.origin}/verify/${user.memberId || user.id}`;
    navigator.clipboard.writeText(url);
    setCopyStatus('copied');
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

  const handleCopyEmbed = (user: User) => {
    const url = `${window.location.origin}/verify/${user.memberId || user.id}`;
    const embedCode = `<iframe src="${url}?embed=true" width="320" height="480" frameborder="0"></iframe>`;
    navigator.clipboard.writeText(embedCode);
    setCopyStatus('embed-copied');
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

  const exportToExcel = async () => {
    const XLSX = await import('xlsx-js-style');
    const listToExport = filteredApprovedMembers;

    const data = listToExport.map(member => ({
      'Full Name': member.fullName,
      'Email': member.email,
      'Member ID': member.memberId || 'N/A',
      'Primary Role': member.specialization || 'N/A',
      'Community Role': member.role || 'Member',
      'Discord Username': member.discordUsername || 'N/A',
      'Year Joined': member.yearJoined || 'N/A',
      'Experience Level': member.experienceLevel || 'N/A',
      'Skills': Array.isArray(member.skills)
        ? member.skills.map(s => `${s.name} (${s.level})`).join(', ')
        : 'N/A',
      'Status': member.status,
      'Admin Notes': member.adminNotes || 'N/A',
      'Deletion Requested': (member as any).deletionRequestedAt ? new Date((member as any).deletionRequestedAt).toLocaleDateString() : '',
      'Joined Date': new Date(member.createdAt).toLocaleDateString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Approved Members');

    // Fix column widths
    const maxWidths = [
      { wch: 30 }, // Full Name
      { wch: 30 }, // Email
      { wch: 15 }, // Member ID
      { wch: 20 }, // Primary Role
      { wch: 20 }, // Community Role
      { wch: 20 }, // Discord
      { wch: 12 }, // Year Joined
      { wch: 10 }, // Status
      { wch: 15 }, // Joined Date
    ];
    worksheet['!cols'] = maxWidths;

    const fileName = searchTerm
      ? `BetterGovPH_Members_Filtered_${new Date().toISOString().split('T')[0]}.xlsx`
      : `BetterGovPH_Approved_Members_${new Date().toISOString().split('T')[0]}.xlsx`;

    XLSX.writeFile(workbook, fileName);
  };

  const filteredUsers = useMemo(() => {
    return (users || []).filter(u => u && !u.isAdmin);
  }, [users]);

  const filteredApprovedMembers = useMemo(() => {
    return (users || []).filter(u => u && !u.isAdmin && u.status === 'Approved');
  }, [users]);

  const adminTabs = [
    { id: 'overview' as const, label: 'Overview', count: undefined as number | undefined },
    { id: 'applications' as const, label: 'Applications', count: stats.pending },
    { id: 'members' as const, label: 'Members', count: stats.approved },
    { id: 'projects' as const, label: 'Projects', count: projectSubmissionsTotal || undefined },
    { id: 'calls' as const, label: 'Calls', count: undefined as number | undefined },
  ];
  const tileSource = activeTab === 'projects' ? projectStats : stats;
  const isProjects = activeTab === 'projects';
  const pctApproved = tileSource.total > 0 ? Math.round((tileSource.approved / tileSource.total) * 100) : 0;
  const statTiles = [
    { label: 'Total', value: tileSource.total, icon: isProjects ? FolderKanban : Inbox, hint: isProjects ? 'submissions' : 'applications' },
    { label: 'Pending', value: tileSource.pending, icon: Clock, hint: tileSource.pending > 0 ? 'need review' : 'all caught up' },
    { label: 'Approved', value: tileSource.approved, icon: BadgeCheck, hint: `${pctApproved}% of total` },
  ];

  return (
    <div className="site min-h-screen pb-16">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl backdrop-saturate-150 shadow-[0_1px_0_rgb(15_23_42/0.08)]">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              src="/logo.svg" onError={(e)=>{const t=e.currentTarget;t.onerror=null;t.src='https://assets.bettergov.ph/logos/webp/icon-primary.webp';}}
              alt=""
              className="h-6 w-6 shrink-0 object-contain"
            />
            <span className="truncate text-[15px] font-semibold tracking-[-0.015em] text-slate-900">
              BetterGovPH <span className="font-normal text-slate-500">Admin</span>
            </span>
          </div>

          <nav aria-label="Admin sections" className="hidden items-center gap-1 md:flex">
            {adminTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                aria-current={activeTab === t.id ? 'page' : undefined}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[14px] transition-colors duration-150',
                  activeTab === t.id ? 'bg-slate-900/[0.05] font-medium text-slate-900' : 'text-slate-500 hover:text-slate-900'
                )}
              >
                {t.label}
                {typeof t.count === 'number' && <span className="num text-[12px] text-slate-400">{t.count}</span>}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
          <ReportsQueue initiallyOpen={typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('reports')} />
          <NotificationBell />
          <UserChip
            name={currentUser.fullName}
            subtitle="Administrator"
            email={currentUser.email}
            memberId={currentUser.memberId}
            verified={currentUser.status === 'Approved' || !!currentUser.isAdmin}
            isAdmin={!!currentUser.isAdmin}
            discordId={currentUser.discordId}
            discordAvatar={currentUser.discordAvatar}
            onOpen={() => setShowMyCard(true)}
            openLabel="View my card"
            onSignOut={handleLogout}
          />
          </div>
        </div>

        <nav aria-label="Admin sections" className="no-scrollbar flex gap-1 overflow-x-auto border-t border-slate-200/70 px-3 py-1.5 md:hidden">
          {adminTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              aria-current={activeTab === t.id ? 'page' : undefined}
              className={clsx(
                'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[14px]',
                activeTab === t.id ? 'bg-slate-900/[0.06] font-medium text-slate-900' : 'text-slate-500'
              )}
            >
              {t.label}
              {typeof t.count === 'number' && <span className="num text-[12px] text-slate-400">{t.count}</span>}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto flex min-w-0 max-w-7xl flex-col gap-6 px-4 sm:px-6 pt-8 sm:pt-10">
        <div>
          <h1 className="text-[28px] sm:text-[32px]">{adminTabs.find((t) => t.id === activeTab)?.label}</h1>
          <p className="mt-1 text-[15px] text-slate-600">
            {activeTab === 'overview'
              ? 'What needs a decision, and how the community is doing.'
              : activeTab === 'applications'
                ? 'Review new membership applications and issue cards.'
                : activeTab === 'members'
                  ? 'Everyone with an active card.'
                  : activeTab === 'calls'
                    ? 'Every call and request members have posted.'
                    : 'Moderate project submissions before they appear on the public list.'}
          </p>
        </div>

        {activeTab === 'overview' ? (
          <AdminOverview onGo={setActiveTab} onImport={() => { setImportOpen(true); setImportResult(null); }} onExportRopa={exportRopa} ropaBusy={ropaBusy}
            onPostCall={() => { setPostingCall(true); setActiveTab('calls'); }} />
        ) : (
        <>
        {activeTab !== 'calls' && (
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          {statTiles.map((t) => (
            <StatTile key={t.label} label={t.label} value={t.value} hint={t.hint} icon={t.icon} />
          ))}
        </div>
        )}

        <div className="s-card overflow-hidden">
          {activeTab === 'calls' ? (
            <AdminCalls startPosting={postingCall} onPostingChange={setPostingCall} />
          ) : activeTab === 'applications' ? (
            <>
              <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4 sm:gap-6">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900">Applications</h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">Review and approve membership applications.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
                  <div className="relative flex-1 xl:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search applicants..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="s-field pl-10 pr-4"
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:flex sm:items-center gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-auto">
                      <SelectMenu
                        id="role-filter-1"
                        ariaLabel="Filter by role"
                        className="sm:w-56"
                        value={roleFilter}
                        onChange={setRoleFilter}
                        options={ROLE_FILTER_OPTIONS}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-slate-500 text-[12px] border-b border-slate-200">
                      <th className="p-4 pl-6 font-semibold">Applicant</th>
                      <th className="p-4 font-semibold">Discord / Role</th>
                      <th className="p-4 font-semibold">Status</th>
                      <th className="p-4 font-semibold">Member ID</th>
                      <th className="p-4 pr-6 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {isDataLoading ? (
                      Array.from({ length: 5 }).map((_, idx) => (
                        <tr key={`skel-${idx}`}>
                          <td className="p-4 pl-6">
                            <div className="h-4 bg-slate-200 rounded w-32 mb-1.5" />
                            <div className="h-3 bg-slate-100 rounded w-40" />
                          </td>
                          <td className="p-4">
                            <div className="h-4 bg-slate-200 rounded w-28 mb-1.5" />
                            <div className="h-3 bg-slate-100 rounded w-36" />
                          </td>
                          <td className="p-4">
                            <div className="h-5 bg-slate-200 rounded-md w-16" />
                          </td>
                          <td className="p-4">
                            <div className="h-4 bg-slate-100 rounded w-20" />
                          </td>
                          <td className="p-4 pr-6 text-right">
                            <div className="h-8 bg-slate-200 rounded-[10px] w-16 ml-auto" />
                          </td>
                        </tr>
                      ))
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500">
                          No applicants found matching the criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <motion.tr
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          key={user.id}
                          className="hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="p-4 pl-6">
                            <div className="flex items-center gap-3">
                              <Avatar name={user.fullName} seed={user.uid || user.id} discordId={user.discordId} discordAvatar={user.discordAvatar} size={32} />
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-900">{user.fullName}</div>
                                <div className="text-xs text-slate-500">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2 mb-1">
                              <div>
                                <div className="font-semibold text-slate-700">
                                  {user.discordDisplayName || user.discordUsername || 'N/A'}
                                </div>
                                {user.discordDisplayName && user.discordUsername && (
                                  <div className="text-xs text-slate-400">@{user.discordUsername}</div>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-slate-500">{user.specialization} • {user.role}</div>
                          </td>
                          <td className="p-4">
                            <span className={clsx(
                              'inline-flex items-center px-2 py-0.5 text-[12px] font-medium rounded-full border',
                              user.status === 'Approved' ? 'text-emerald-700 border-emerald-200' :
                                user.status === 'Declined' ? 'text-red-700 border-red-200' :
                                  'text-amber-700 border-amber-200'
                            )}>
                              {user.status}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-slate-600">{user.memberId || '-'}</td>
                          <td className="p-4 pr-6 text-right">
                            <button
                              onClick={() => setSelectedUser(user)}
                              className="s-btn s-btn-plain h-8 px-3 text-[13px]"
                            >
                              Review
                            </button>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="px-4 sm:px-6 py-3 border-t border-slate-200/80 flex items-center justify-between gap-3">
                <p className="num text-[13px] text-slate-500">
                  Showing <span className="text-slate-900">{filteredUsers.length}</span> of <span className="text-slate-900">{totalCount}</span> records
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 0 || isDataLoading}
                    className="s-btn s-btn-plain h-9 w-9 px-0"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-[10px]">
                    <span className="text-sm font-semibold text-slate-900">Page {currentPage + 1}</span>
                    <span className="text-slate-400 mx-1">of</span>
                    <span className="text-sm font-semibold text-slate-900">{Math.ceil(totalCount / pageSize)}</span>
                  </div>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={(currentPage + 1) * pageSize >= totalCount || isDataLoading}
                    className="s-btn s-btn-plain h-9 w-9 px-0"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          ) : activeTab === 'projects' ? (
            <>
              <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4 sm:gap-6">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900">Projects</h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">Review and moderate project submissions.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1 bg-slate-100 rounded-[10px] p-1">
                    {(['All', 'pending', 'approved', 'rejected'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setProjectStatusFilter(f)}
                        className={clsx(
                          "px-3 py-1.5 text-xs font-semibold rounded-[10px] transition-[color,transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out capitalize",
                          projectStatusFilter === f
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        {f === 'All' ? 'All' : f}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => { setImportOpen(true); setImportResult(null); }} className="s-btn s-btn-plain h-9 text-[13px]">
                    Import from Discord
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-slate-500 text-[12px] border-b border-slate-200">
                      <th className="p-4 pl-6 font-semibold">Project</th>
                      <th className="p-4 font-semibold">Submitted By</th>
                      <th className="p-4 font-semibold">Status</th>
                      <th className="p-4 font-semibold">Description</th>
                      <th className="p-4 pr-6 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {projectSubmissionsLoading ? (
                      Array.from({ length: 4 }).map((_, idx) => (
                        <tr key={`pskel-${idx}`}>
                          <td className="p-4 pl-6 align-top">
                            <div className="h-4 bg-slate-200 rounded w-36 mb-1.5" />
                            <div className="h-3 bg-slate-100 rounded w-48" />
                          </td>
                          <td className="p-4 align-top">
                            <div className="h-4 bg-slate-200 rounded w-28 mb-1.5" />
                            <div className="h-3 bg-slate-100 rounded w-32" />
                          </td>
                          <td className="p-4 align-top">
                            <div className="h-5 bg-slate-200 rounded-md w-16" />
                          </td>
                          <td className="p-4 align-top">
                            <div className="h-4 bg-slate-100 rounded w-40" />
                          </td>
                          <td className="p-4 pr-6 align-top text-right">
                            <div className="h-8 bg-slate-200 rounded-[10px] w-20 ml-auto" />
                          </td>
                        </tr>
                      ))
                    ) : projectSubmissions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-slate-500">
                          No {projectStatusFilter === 'All' ? '' : projectStatusFilter} submissions found.
                        </td>
                      </tr>
                    ) : (
                      projectSubmissions.map((submission) => (
                        <tr key={submission.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-4 pl-6 align-top">
                            <div className="font-semibold text-slate-900">{submission.projectName}</div>
                            <a
                              href={submission.projectUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-700 hover:underline break-all"
                            >
                              {submission.projectUrl}
                            </a>
                            {submission.projType && (
                              <div className="mt-2 text-xs text-slate-500">{submission.projType}</div>
                            )}
                          </td>
                          <td className="p-4 align-top">
                            <div className="font-semibold text-slate-900">
                              {submission.submittedBy?.fullName || submission.submittedBy?.email || submission.userId}
                            </div>
                            {submission.submittedBy?.email && submission.submittedBy?.fullName && (
                              <div className="text-xs text-slate-500 break-all">{submission.submittedBy.email}</div>
                            )}
                          </td>
                          <td className="p-4 align-top">
                            <span className={clsx(
                              "inline-flex items-center px-2.5 py-1 rounded-[10px] text-[12px] sm:text-[11px] font-semibold border",
                              submission.status === 'approved' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                              submission.status === 'rejected' && "bg-red-50 text-red-700 border-red-200",
                              submission.status === 'pending' && "bg-amber-50 text-amber-700 border-amber-200"
                            )}>
                              {submission.status}
                            </span>
                          </td>
                          <td className="p-4 align-top max-w-[420px]">
                            <div className="text-slate-700 whitespace-pre-wrap break-words">{submission.description}</div>
                          </td>
                          <td className="p-4 pr-6 align-top text-right">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <button
                                onClick={() => handleEditClick(submission)}
                                disabled={projectActionLoadingId === submission.id}
                                className="s-btn s-btn-plain"
                              >
                                Edit
                              </button>
                              {submission.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => setReview({ id: submission.id, name: submission.projectName, action: 'approve', note: '', error: '' })}
                                    disabled={projectActionLoadingId === submission.id}
                                    className="s-btn s-btn-accent"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => setReview({ id: submission.id, name: submission.projectName, action: 'reject', note: '', error: '' })}
                                    disabled={projectActionLoadingId === submission.id}
                                    className="s-btn bg-red-600 text-white [@media(hover:hover)]:hover:bg-red-700"
                                  >
                                    <XCircle className="w-4 h-4" />
                                    Reject
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => handleProjectDelete(submission.id)}
                                disabled={projectActionLoadingId === submission.id}
                                className="s-btn s-btn-plain text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  </table>
                </div>
              {projectTotalCount > projectPageSize && (
                <div className="px-4 sm:px-6 py-3 border-t border-slate-200/80 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-slate-500">
                    Showing <span className="text-slate-900">{projectSubmissions.length}</span> of <span className="text-slate-900">{projectTotalCount}</span> records
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setProjectPage(projectPage - 1)}
                      disabled={projectPage === 0 || projectSubmissionsLoading}
                      className="s-btn s-btn-plain h-9 w-9 px-0"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-[10px]">
                      <span className="text-sm font-semibold text-slate-900">Page {projectPage + 1}</span>
                      <span className="text-slate-400 mx-1">of</span>
                      <span className="text-sm font-semibold text-slate-900">{Math.ceil(projectTotalCount / projectPageSize)}</span>
                    </div>
                    <button
                      onClick={() => setProjectPage(projectPage + 1)}
                      disabled={(projectPage + 1) * projectPageSize >= projectTotalCount || projectSubmissionsLoading}
                      className="s-btn s-btn-plain h-9 w-9 px-0"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4 sm:gap-6">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900">Members</h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">Approved members and their issued IDs.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
                  <div className="relative flex-1 xl:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search members..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="s-field pl-10 pr-4"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-auto">
                      <SelectMenu
                        id="role-filter-2"
                        ariaLabel="Filter by role"
                        className="sm:w-56"
                        value={roleFilter}
                        onChange={setRoleFilter}
                        options={ROLE_FILTER_OPTIONS}
                      />
                    </div>
                    {users.filter(u => u && !u.isAdmin && u.status === 'Approved').length > 0 && (
                      <button
                        onClick={exportToExcel}
                        className="s-btn s-btn-accent justify-center"
                      >
                        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        <span>Export {searchTerm ? 'Filtered' : 'All'} to Excel</span>
                      </button>
                    )}
                    <button onClick={exportRopa} disabled={ropaBusy} className="s-btn s-btn-plain justify-center" title="Processing register and consent records (Data Privacy Act)">
                      {ropaBusy ? 'Preparing…' : 'Privacy records (ROPA)'}
                    </button>
                  </div>
                </div>
              </div>
              {filteredApprovedMembers.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>{searchTerm ? 'No members match your search' : 'No approved members yet'}</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-slate-500 text-[12px] border-b border-slate-200">
                          <th className="p-4 pl-6 font-semibold">Member Name</th>
                          <th className="p-4 font-semibold">Primary Role</th>
                          <th className="p-4 font-semibold">Community Role</th>
                          <th className="p-4 font-semibold">Member ID</th>
                          <th className="p-4 pr-6 font-semibold text-right">Card Preview</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {filteredApprovedMembers.map((member) => (
                          <motion.tr
                            key={member.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="hover:bg-slate-50/50 transition-colors"
                          >
                            <td className="p-4 pl-6">
                              <div className="font-semibold text-slate-900">{member.fullName}</div>
                              <div className="text-xs text-slate-500">{member.email}</div>
                            </td>
                            <td className="p-4 font-semibold text-slate-700">{member.specialization}</td>
                            <td className="p-4 font-semibold text-slate-700">{member.role}</td>
                            <td className="p-4 font-mono font-semibold text-blue-700">{member.memberId}</td>
                            <td className="p-4 pr-6 text-right">
                              <button
                                onClick={() => setSelectedMember(member)}
                                className="s-btn s-btn-plain h-8 px-3 text-[13px]"
                              >
                                View Card
                              </button>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls for Members Tab */}
                  <div className="px-4 sm:px-6 py-3 border-t border-slate-200/80 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-slate-500">
                      Showing <span className="text-slate-900">{filteredApprovedMembers.length}</span> of <span className="text-slate-900">{totalCount}</span> records
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 0 || isDataLoading}
                        className="s-btn s-btn-plain h-9 w-9 px-0"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-[10px]">
                        <span className="text-sm font-semibold text-slate-900">Page {currentPage + 1}</span>
                        <span className="text-slate-400 mx-1">of</span>
                        <span className="text-sm font-semibold text-slate-900">{Math.ceil(totalCount / pageSize)}</span>
                      </div>
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={(currentPage + 1) * pageSize >= totalCount || isDataLoading}
                        className="s-btn s-btn-plain h-9 w-9 px-0"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
        </>
        )}
      </main>

      {/* Review Modal */}
      <AnimatePresence>
        {selectedUser && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedUser(null)}
              className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={() => setSelectedUser(null)}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg bg-white rounded-[10px] shadow-[var(--e2)] border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]"
              >
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Review Application</h3>
                    {selectedUser.status === 'Approved' && selectedUser.memberId && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[12px] font-semibold rounded-[10px]">
                          Official ID: {selectedUser.memberId}
                        </span>
                      </div>
                    )}
                  </div>
                  <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-slate-600">
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-4 sm:p-6 overflow-y-auto flex-1 no-scrollbar">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8 mb-10 px-2">
                    <div>
                      <p className="text-[12px] font-semibold text-slate-400 mb-1">Applicant Name</p>
                      <p className="text-base font-semibold text-slate-900">{selectedUser.fullName}</p>
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-slate-400 mb-1">Email Address</p>
                      <p className="text-sm font-semibold text-slate-600 break-all">{selectedUser.email}</p>
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-slate-400 mb-1">Discord</p>
                      <div className="flex items-center gap-2">
                        <Avatar name={selectedUser.fullName} seed={selectedUser.uid || selectedUser.id} discordId={selectedUser.discordId} discordAvatar={selectedUser.discordAvatar} size={24} />
                        <div>
                          <p className="text-sm font-semibold text-blue-600">
                            {selectedUser.discordDisplayName || selectedUser.discordUsername || 'N/A'}
                          </p>
                          {selectedUser.discordDisplayName && selectedUser.discordUsername && (
                            <p className="text-xs text-slate-400">@{selectedUser.discordUsername}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-slate-400 mb-1">Date Applied</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-slate-400 mb-1">Primary Role</p>
                      <p className="text-sm font-semibold text-slate-900">{selectedUser.specialization || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-slate-400 mb-1">Community Role</p>
                      <span className="inline-flex px-2 py-0.5 rounded-[10px] bg-slate-100 text-[12px] font-semibold text-slate-600">
                        {selectedUser.role}
                      </span>
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-slate-400 mb-1">Member Since</p>
                      <p className="text-sm font-semibold text-slate-900">{selectedUser.yearJoined || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-slate-400 mb-1">Prof. Level</p>
                      <p className="text-sm font-semibold text-slate-900">{selectedUser.experienceLevel || 'Beginner'}</p>
                    </div>
                  </div>

                  <div className="mb-6 space-y-4">
                    <div>
                      <p className="text-[12px] font-semibold text-slate-400 mb-2">Selected Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.isArray(selectedUser.skills) && selectedUser.skills.length > 0 ? (
                          selectedUser.skills.map((skill, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-1.5 pl-1.5 pr-3 py-1 bg-white border border-slate-200 rounded-[10px] shadow-sm group"
                            >
                              <div className="w-5 h-5 rounded-[10px] bg-slate-50 flex items-center justify-center border border-slate-100 shrink-0">
                                <SkillIcon skillName={skill.name} size={12} />
                              </div>
                              <span className="text-xs font-semibold text-slate-800">{skill.name}</span>
                              <span className="text-[11px] font-semibold text-slate-400">
                                {skill.level}
                              </span>
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 italic">None provided</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-slate-400 mb-1">Experience Level</p>
                      <p className="text-sm font-semibold text-slate-900">{selectedUser.experienceLevel || '-'}</p>
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="block text-[12px] font-semibold text-slate-400 mb-2">Admin Notes (Optional)</label>
                    <textarea
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      placeholder="Add notes for the applicant..."
                      className="s-field h-24 resize-none py-2.5"
                    />
                  </div>
                </div>

                <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50 flex flex-col-reverse sm:flex-row justify-end gap-2.5">
                  {selectedUser.status === 'Approved' ? (
                    <div className="flex items-center gap-2 text-sm font-semibold text-blue-600 px-4 py-2.5 bg-blue-50 rounded-[10px] border border-blue-100">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Member Approved</span>
                    </div>
                  ) : (
                    <>
                      {selectedUser.status !== 'Declined' && (
                        <button
                          onClick={() => handleStatusUpdate(selectedUser.id, 'Declined')}
                          className="s-btn s-btn-plain text-red-700"
                        >
                          Decline
                        </button>
                      )}
                      <button
                        onClick={() => handleStatusUpdate(selectedUser.id, 'Approved')}
                        className={clsx(
                          "s-btn s-btn-accent"
                        )}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{selectedUser.status === 'Declined' ? 'Re-approve & Generate ID' : 'Approve & Generate ID'}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
        {showMyCard && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMyCard(false)}
              className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={() => setShowMyCard(false)}
              className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg bg-white rounded-[10px] shadow-[var(--e2)] border border-slate-200 flex flex-col max-h-[95vh] sm:max-h-[90vh]"
              >
                <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 flex-shrink-0">
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-slate-900">My Volunteer Card</h3>
                  </div>
                  <button
                    onClick={() => setShowMyCard(false)}
                    className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-[10px] transition-colors"
                  >
                    <XCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>
                <div className="overflow-y-auto flex-1 p-4 sm:p-8 flex flex-col items-center gap-6 no-scrollbar">
                  <div className="scale-[0.85] sm:scale-100 origin-top transition-transform">
                    <AccessCard user={currentUser} />
                  </div>
                  <div className="w-full pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                      <button
                        onClick={() => handleCopyLink(currentUser)}
                        className="s-btn s-btn-accent justify-center w-full"
                      >
                        {copyStatus === 'copied' ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                        {copyStatus === 'copied' ? 'Link Copied' : 'Copy Public Link'}
                      </button>
                      <button
                        onClick={() => handleCopyEmbed(currentUser)}
                        className="s-btn s-btn-plain justify-center w-full"
                      >
                        {copyStatus === 'embed-copied' ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Code className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                        {copyStatus === 'embed-copied' ? 'Embed Copied' : 'Embed Code'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
        {selectedMember && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMember(null)}
              className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={() => setSelectedMember(null)}
              className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-4xl bg-white rounded-[10px] shadow-[var(--e2)] border border-slate-200 flex flex-col max-h-[95vh] sm:max-h-[90vh] overflow-hidden"
              >
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900 tracking-tight">Member Profile</h3>
                  </div>
                  <button
                    onClick={() => setSelectedMember(null)}
                    className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-[10px] transition-[color,transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out active:scale-95"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>

                <div className="overflow-y-auto flex-1 p-6 sm:p-8 no-scrollbar bg-slate-50/30">
                  <div className="flex flex-col lg:grid lg:grid-cols-2 gap-10">
                    <div className="flex flex-col items-center gap-8">
                      <div className="scale-[0.85] sm:scale-100 origin-top transition-transform drop-shadow-[var(--e2)]">
                        <AccessCard user={selectedMember} />
                      </div>
                      <div className="w-full max-w-[320px] sm:max-w-none">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                          <button
                            onClick={() => handleCopyLink(selectedMember)}
                            className="s-btn s-btn-accent justify-center w-full"
                          >
                            {copyStatus === 'copied' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            {copyStatus === 'copied' ? 'Link Copied' : 'Copy Public Link'}
                          </button>
                          <button
                            onClick={() => handleCopyEmbed(selectedMember)}
                            className="s-btn s-btn-plain justify-center w-full"
                          >
                            {copyStatus === 'embed-copied' ? <Check className="w-4 h-4" /> : <Code className="w-4 h-4" />}
                            {copyStatus === 'embed-copied' ? 'Embed Copied' : 'Embed Code'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-8">
                      <div className="grid grid-cols-2 gap-y-6 gap-x-8 px-2">
                        <div>
                          <p className="text-[12px] font-semibold text-slate-400 mb-1">Full Name</p>
                          <p className="text-sm font-semibold text-slate-900">{selectedMember.fullName}</p>
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold text-slate-400 mb-1">Email Address</p>
                          <p className="text-sm font-semibold text-slate-600 break-all">{selectedMember.email}</p>
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold text-slate-400 mb-1">Discord</p>
                          <div className="flex items-center gap-2">
                            <Avatar name={selectedMember.fullName} seed={selectedMember.uid || selectedMember.id} discordId={selectedMember.discordId} discordAvatar={selectedMember.discordAvatar} size={24} />
                            <div>
                              <p className="text-sm font-semibold text-blue-600">
                                {selectedMember.discordDisplayName || selectedMember.discordUsername || 'N/A'}
                              </p>
                              {selectedMember.discordDisplayName && selectedMember.discordUsername && (
                                <p className="text-xs text-slate-400">@{selectedMember.discordUsername}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold text-slate-400 mb-1">Primary Role</p>
                          <p className="text-sm font-semibold text-slate-900">{selectedMember.specialization || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold text-slate-400 mb-1">Community Role</p>
                          <span className="inline-flex px-2 py-0.5 rounded-[10px] bg-blue-50 text-[12px] font-semibold text-blue-700">
                            {selectedMember.role}
                          </span>
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold text-slate-400 mb-1">Member Since</p>
                          <p className="text-sm font-semibold text-slate-900">{selectedMember.yearJoined || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold text-slate-400 mb-1">Prof. Level</p>
                          <p className="text-sm font-semibold text-slate-900">{selectedMember.experienceLevel || 'Beginner'}</p>
                        </div>
                      </div>

                      <div className="px-2">
                        <p className="text-[12px] font-semibold text-slate-400 mb-4">Skills</p>
                        <div className="flex flex-wrap gap-2">
                          {Array.isArray(selectedMember.skills) && selectedMember.skills.length > 0 ? (
                            selectedMember.skills.map((skill, i) => (
                              <div key={i} className="flex items-center gap-1.5 pl-1.5 pr-3 py-1 bg-white border border-slate-200 rounded-[10px] shadow-sm group">
                                <div className="w-6 h-6 rounded-[10px] bg-slate-50 flex items-center justify-center border border-slate-100">
                                  <SkillIcon skillName={skill.name} size={12} />
                                </div>
                                <span className="text-xs font-semibold text-slate-800">{skill.name}</span>
                                <span className="text-[11px] font-semibold text-slate-400">{skill.level}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-400 italic">No skills listed</p>
                          )}
                        </div>
                      </div>

                      <div className="p-5 bg-white rounded-[10px] border border-slate-100 shadow-sm">
                        <p className="text-[12px] font-semibold text-slate-400 mb-1.5">Experience Level</p>
                        <p className="text-sm font-semibold text-slate-900">{selectedMember.experienceLevel || 'Professional'}</p>
                      </div>

                      {selectedMember.adminNotes && (
                        <div className="p-4 sm:p-5 bg-blue-50/60 rounded-[10px] border border-blue-100">
                          <p className="text-[12px] font-semibold text-blue-900 mb-2">Admin Remarks</p>
                          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                            "{selectedMember.adminNotes}"
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
        {editingSubmission && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingSubmission(null)}
              className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={() => setEditingSubmission(null)}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg bg-white rounded-[10px] shadow-[var(--e2)] border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]"
              >
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="text-lg font-semibold text-slate-900">Edit Project Submission</h3>
                  <button onClick={() => setEditingSubmission(null)} className="text-slate-400 hover:text-slate-600">
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Project Name</label>
                    <input
                      type="text"
                      value={editForm.projectName}
                      onChange={(e) => setEditForm({ ...editForm, projectName: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-[10px] text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Project URL</label>
                    <input
                      type="text"
                      value={editForm.projectUrl}
                      onChange={(e) => setEditForm({ ...editForm, projectUrl: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-[10px] text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-[10px] text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Project Type</label>
                    <input
                      type="text"
                      value={editForm.projType}
                      onChange={(e) => setEditForm({ ...editForm, projType: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-[10px] text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label id="edit-status-label" className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
                    <SelectMenu
                      id="edit-status"
                      labelledBy="edit-status-label"
                      value={editForm.status}
                      onChange={(v) => setEditForm({ ...editForm, status: v })}
                      options={[
                        { value: 'pending', label: 'In review' },
                        { value: 'approved', label: 'Approved', hint: 'Live on the Projects page' },
                        { value: 'rejected', label: 'Sent back', hint: 'The submitter sees your note' },
                      ]}
                    />
                  </div>
                </div>
                <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50 flex flex-col-reverse sm:flex-row justify-end gap-2.5">
                  <button
                    onClick={() => setEditingSubmission(null)}
                    className="s-btn s-btn-plain"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditSave}
                    disabled={editSaving}
                    className="s-btn s-btn-accent"
                  >
                    {editSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {importOpen && (() => {
        const rows = parseImportRows(importText);
        return (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="import-title">
            <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[14px] bg-white shadow-[var(--e2)]">
              <div className="border-b border-slate-100 p-5 sm:p-6">
                <h2 id="import-title" className="text-[17px] font-semibold text-slate-900">Import existing projects</h2>
                <p className="mt-1 text-[13px] text-slate-500">
                  Paste one project per line from a spreadsheet or CSV, in this order: <span className="font-medium text-slate-700">name, link, description, type, GitHub repo, group chat, owner organisation</span>.
                  Only name and link are required. They go live as approved projects, with you as team head. Hand the head role to the real lead once they join.
                </p>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
                <textarea
                  aria-label="Projects to import"
                  value={importText}
                  onChange={(e) => { setImportText(e.target.value); setImportResult(null); }}
                  className="s-field h-auto min-h-[160px] resize-y py-2.5 font-mono text-[12.5px]"
                  placeholder={'name,link,description,type,repo,chat,owner\nBudget Tracker,https://budget.bettergov.ph,"Follow the national budget",dev,https://github.com/bettergovph/budget,https://chat.whatsapp.com/abc,'}
                />
                {rows.length > 0 && !importResult && (
                  <div>
                    <p className="mb-2 text-[13px] font-medium text-slate-700">{rows.length} {rows.length === 1 ? 'project' : 'projects'} ready</p>
                    <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-[10px] shadow-[inset_0_0_0_1px_rgb(15_23_42/0.08)]">
                      {rows.slice(0, 100).map((r, i) => (
                        <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                          <span className="min-w-0 truncate font-medium text-slate-900">{r.name || <span className="text-red-700">missing name</span>}</span>
                          <span className={clsx('min-w-0 truncate', /^https?:\/\//.test(r.url) ? 'text-slate-500' : 'text-red-700')}>{r.url || 'missing link'}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {importResult && (
                  <div role="status" className="rounded-[10px] bg-emerald-50 px-3.5 py-3 text-[13px] text-emerald-900 shadow-[inset_0_0_0_1px_rgb(16_185_129/0.25)]">
                    Imported {importResult.imported}.
                    {importResult.skipped.length > 0 && (
                      <ul className="mt-1.5 list-disc pl-5 text-slate-700">
                        {importResult.skipped.map((sk, i) => <li key={i}>{sk.name}: {sk.reason}</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 p-4 sm:flex-row sm:justify-end sm:p-6">
                <button type="button" onClick={() => setImportOpen(false)} className="s-btn s-btn-plain">{importResult ? 'Done' : 'Cancel'}</button>
                {!importResult && (
                  <button
                    type="button"
                    disabled={importBusy || rows.length === 0 || rows.length > 100}
                    onClick={async () => {
                      setImportBusy(true);
                      try {
                        const r = await importProjects(rows);
                        setImportResult(r);
                        setImportText('');
                        await loadProjectSubmissions();
                      } catch (error) {
                        alert(error instanceof Error ? error.message : 'Import failed.');
                      } finally {
                        setImportBusy(false);
                      }
                    }}
                    className="s-btn s-btn-accent"
                  >
                    {importBusy ? 'Importing…' : rows.length > 100 ? 'Up to 100 at a time' : `Import ${rows.length || ''}`.trim()}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {review && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="review-title">
          <form
            className="w-full max-w-md rounded-[14px] bg-white p-5 shadow-[var(--e2)] sm:p-6"
            onSubmit={async (e) => {
              e.preventDefault();
              if (review.action === 'reject' && !review.note.trim()) { setReview({ ...review, error: 'Say what to change so the submitter can fix it.' }); return; }
              const ok = await handleProjectAction(review.id, review.action, review.note.trim() || undefined);
              if (ok) setReview(null);
            }}
          >
            <h2 id="review-title" className="text-[17px] font-semibold text-slate-900">
              {review.action === 'approve' ? 'Approve' : 'Send back'} “{review.name}”
            </h2>
            <p className="mt-1 text-[13px] text-slate-500">
              {review.action === 'approve' ? 'It goes live on the Projects page and its team opens for sign-ups.' : 'The submitter sees your note on their dashboard.'}
            </p>
            <label htmlFor="review-note" className="mb-1.5 mt-4 block text-[13px] font-medium text-slate-900">
              Note to the submitter {review.action === 'approve' && <span className="font-normal text-slate-400">optional</span>}
            </label>
            <textarea
              id="review-note"
              autoFocus
              maxLength={1000}
              value={review.note}
              onChange={(e) => setReview({ ...review, note: e.target.value, error: '' })}
              className="s-field h-auto min-h-[110px] resize-y py-2.5"
              placeholder={review.action === 'approve' ? 'Nice work — one thing to consider…' : 'What’s missing or needs changing (e.g. add a README, make the repo public).'}
            />
            {review.error && <p role="alert" className="mt-2 text-[13px] text-red-700">{review.error}</p>}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setReview(null)} className="s-btn s-btn-plain">Cancel</button>
              <button type="submit" disabled={projectActionLoadingId === review.id}
                className={review.action === 'approve' ? 's-btn s-btn-accent' : 's-btn bg-red-600 text-white [@media(hover:hover)]:hover:bg-red-700'}>
                {projectActionLoadingId === review.id ? 'Saving…' : review.action === 'approve' ? 'Approve' : 'Send back'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
