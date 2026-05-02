import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, CheckCircle2, XCircle, LogOut, Filter, Users, Key, CreditCard, Download, Copy, Code, Check, Clock, Zap, Briefcase, ChevronLeft, ChevronRight, Trash2, UserX } from 'lucide-react';
import html2canvas from 'html2canvas';
import { AccessCard } from '../../components/AccessCard';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import clsx from 'clsx';
import { User, ApplicationStatus, ProjectSubmission } from '../../types';
import { deleteProjectSubmission, getAllUsers, getAdminStats, getProjectSubmissions, updateProjectSubmission } from '../../services/supabase';
import * as XLSX from 'xlsx';
import { skillToSlug } from '../../utils/skillUtils';
import { SPECIALIZATIONS } from '../../constants/specializations';

export default function AdminDashboard() {
  const { currentUser, users, updateUserStatus, setUsers, authInitialized } = useStore();
  const logout = useStore((s) => s.logout);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'applications' | 'members' | 'projects'>('applications');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'All'>('All');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [showMyCard, setShowMyCard] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'embed-copied'>('idle');
  const [projectSubmissions, setProjectSubmissions] = useState<ProjectSubmission[]>([]);
  const [projectSubmissionsTotal, setProjectSubmissionsTotal] = useState(0);
  const [projectSubmissionsLoading, setProjectSubmissionsLoading] = useState(false);
  const [projectActionLoadingId, setProjectActionLoadingId] = useState<string | null>(null);
  const [projectStats, setProjectStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0 });

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

  const loadUsers = async (page: number) => {
    if (!currentUser?.isAdmin) return;
    if (activeTab === 'projects') return;
    setIsDataLoading(true);
    try {
      const filters = {
        status: activeTab === 'members' ? 'Approved' : statusFilter,
        role: roleFilter,
        search: searchTerm
      };
      const { users: fetchedUsers, totalCount: fetchedTotal } = await getAllUsers(page, pageSize, filters);
      setUsers(fetchedUsers);
      setTotalCount(fetchedTotal);
    } catch (error) {
      console.error('Error loading admin users:', error);
    } finally {
      setIsDataLoading(false);
    }
  };

  const loadProjectSubmissions = async () => {
    if (!currentUser?.isAdmin) return;
    setProjectSubmissionsLoading(true);
    try {
      const [pendingRes, totalRes, approvedRes, rejectedRes] = await Promise.all([
        getProjectSubmissions(0, 50, { status: 'pending' }),
        getProjectSubmissions(0, 1),
        getProjectSubmissions(0, 1, { status: 'approved' }),
        getProjectSubmissions(0, 1, { status: 'rejected' }),
      ]);
      const { submissions, totalCount: fetchedTotal } = pendingRes;
      setProjectSubmissions(submissions);
      setProjectSubmissionsTotal(fetchedTotal);
      setProjectStats({
        total: totalRes.totalCount,
        pending: fetchedTotal,
        approved: approvedRes.totalCount,
        rejected: rejectedRes.totalCount,
      });
    } catch (error) {
      console.error('Error loading project submissions:', error);
    } finally {
      setProjectSubmissionsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [currentUser]);

  useEffect(() => {
    setCurrentPage(0);
  }, [activeTab, statusFilter, roleFilter, searchTerm]);

  useEffect(() => {
    if (activeTab === 'projects') return;
    loadUsers(currentPage);
  }, [currentUser, setUsers, currentPage, activeTab, statusFilter, roleFilter, searchTerm]);

  useEffect(() => {
    if (activeTab !== 'projects') return;
    loadProjectSubmissions();
  }, [activeTab]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!authInitialized || !currentUser) return <LoadingOverlay />;
  if (!currentUser.isAdmin) return null;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

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

    const res = await updateUserStatus(userId, status, adminNote);

    if (res && (res as any).success) {
      setSelectedUser(null);
      setAdminNote('');
      // Refresh data and stats after update
      loadUsers(currentPage);
      loadStats();
    } else {
      alert(`Failed to update database: ${(res as any)?.message || 'Unknown error'}. Please check if the user exists in Supabase.`);
    }
  };

  const handleProjectAction = async (submissionId: string, action: 'approve' | 'reject') => {
    if (!submissionId) return;
    setProjectActionLoadingId(submissionId);
    try {
      await updateProjectSubmission(submissionId, action);
      await loadProjectSubmissions();
    } catch (error) {
      console.error('Error updating project submission:', error);
      alert('Failed to update project submission.');
    } finally {
      setProjectActionLoadingId(null);
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
    } catch (error) {
      console.error('Error deleting project submission:', error);
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

  const exportToExcel = () => {
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

  // Remove the old pendingCount/approvedCount definitions since we use stats now
  // and we don't need them in the local scope anymore.

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-3">
              <img src="/logo.svg" alt="BetterGovPH Logo" className="w-8 h-8 object-contain brightness-0" />
              <span className="text-xl font-display font-bold text-slate-900">Admin Portal</span>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <button
                onClick={() => setShowMyCard(true)}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-2xl transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                <span className="hidden sm:inline">My Card</span>
              </button>
              <div className="h-6 w-[1px] bg-slate-200 hidden sm:block" />
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-bold text-slate-900 leading-none">{currentUser.fullName}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Administrator</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="bg-white border-b border-slate-200 sticky top-[64px] z-20 overflow-x-auto no-scrollbar">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-w-max sm:min-w-0">
          <div className="flex space-x-4 sm:space-x-8">
            <button
              onClick={() => setActiveTab('applications')}
              className={clsx(
                "py-4 text-sm font-bold border-b-2 transition-all px-1",
                activeTab === 'applications'
                  ? "border-blue-900 text-blue-900"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              )}
            >
              <div className="flex items-center gap-2">
                <span>Applications</span>
                <span className={clsx(
                  "px-2 py-0.5 text-[10px] rounded-full font-bold",
                  activeTab === 'applications' ? "bg-blue-900 text-white" : "bg-slate-100 text-slate-500"
                )}>
                  {stats.pending}
                </span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={clsx(
                "py-4 text-sm font-bold border-b-2 transition-all px-1",
                activeTab === 'members'
                  ? "border-blue-900 text-blue-900"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              )}
            >
              <div className="flex items-center gap-2">
                <span>Members</span>
                <span className={clsx(
                  "px-2 py-0.5 text-[10px] rounded-full font-bold",
                  activeTab === 'members' ? "bg-blue-900 text-white" : "bg-slate-100 text-slate-500"
                )}>
                  {stats.approved}
                </span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className={clsx(
                "py-4 text-sm font-bold border-b-2 transition-all px-1",
                activeTab === 'projects'
                  ? "border-blue-900 text-blue-900"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              )}
            >
              <div className="flex items-center gap-2">
                <span>Projects</span>
                <span className={clsx(
                  "px-2 py-0.5 text-[10px] rounded-full font-bold",
                  activeTab === 'projects' ? "bg-blue-900 text-white" : "bg-slate-100 text-slate-500"
                )}>
                  {projectSubmissionsTotal}
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col lg:grid lg:grid-cols-[280px_minmax(0,1fr)] gap-8">
        <aside className="space-y-6 hidden lg:block">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold">Administrator</p>
              <h2 className="mt-3 text-xl font-bold text-slate-900">{currentUser.fullName}</h2>
              <p className="mt-1 text-sm text-slate-500 break-all">{currentUser.email}</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Admin ID</p>
                <p className="mt-2 font-mono text-slate-900">{currentUser.memberId || 'No ID assigned'}</p>
              </div>
              <div className="grid gap-3">
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Role</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{currentUser.role}</p>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total Users</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{stats.total}</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <section className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex items-center gap-4">
              <div className="text-blue-600 flex items-center justify-center">
                <Users className="w-8 h-8" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold">
                  {activeTab === 'projects' ? 'Total Submissions' : 'Total Database Records'}
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{activeTab === 'projects' ? projectStats.total : stats.total}</p>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex items-center gap-4">
              <div className="text-yellow-600 flex items-center justify-center">
                <Clock className="w-8 h-8" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold">Pending Review</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{activeTab === 'projects' ? projectStats.pending : stats.pending}</p>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex items-center gap-4">
              <div className="text-blue-600 flex items-center justify-center">
                <Key className="w-8 h-8" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold">
                  {activeTab === 'projects' ? 'Approved' : 'IDs Issued'}
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{activeTab === 'projects' ? projectStats.approved : stats.approved}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            {activeTab === 'applications' ? (
              <>
                <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4 sm:gap-6">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">Application Management</h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">Review non-admin signups, update statuses, and generate IDs.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
                    <div className="relative flex-1 xl:w-64">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search applicants..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-3 w-full sm:w-auto">
                      <div className="relative w-full sm:w-auto">
                        <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | 'All')}
                          className="w-full sm:w-36 pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                        >
                          <option value="All">All Statuses</option>
                          <option value="Pending">Pending</option>
                          <option value="Approved">Approved</option>
                          <option value="Declined">Declined</option>
                        </select>
                      </div>
                      <div className="relative w-full sm:w-auto">
                        <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <select
                          value={roleFilter}
                          onChange={(e) => setRoleFilter(e.target.value)}
                          className="w-full sm:w-44 pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                        >
                          <option value="All">All Roles</option>
                          {SPECIALIZATIONS.map(spec => (
                            <option key={spec.id} value={spec.label}>{spec.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200 font-bold">
                        <th className="p-4 pl-6 font-semibold">Applicant</th>
                        <th className="p-4 font-semibold">Discord / Role</th>
                        <th className="p-4 font-semibold">Status</th>
                        <th className="p-4 font-semibold">Member ID</th>
                        <th className="p-4 pr-6 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredUsers.length === 0 ? (
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
                              <div className="font-bold text-slate-900">{user.fullName}</div>
                              <div className="text-xs text-slate-500">{user.email}</div>
                            </td>
                            <td className="p-4">
                              <div className="font-medium text-slate-700">{user.discordUsername || 'N/A'}</div>
                              <div className="text-xs text-slate-500">{user.specialization} • {user.role}</div>
                            </td>
                            <td className="p-4">
                              <span className={clsx(
                                'px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wide',
                                user.status === 'Approved' ? 'bg-blue-100 text-blue-800' :
                                  user.status === 'Declined' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'
                              )}>
                                {user.status}
                              </span>
                            </td>
                            <td className="p-4 font-mono text-slate-600">{user.memberId || '-'}</td>
                            <td className="p-4 pr-6 text-right">
                              <button
                                onClick={() => setSelectedUser(user)}
                                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-2xl hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm"
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
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Showing <span className="text-slate-900">{filteredUsers.length}</span> of <span className="text-slate-900">{totalCount}</span> records
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 0 || isDataLoading}
                      className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl">
                      <span className="text-sm font-bold text-slate-900">Page {currentPage + 1}</span>
                      <span className="text-slate-400 mx-1">of</span>
                      <span className="text-sm font-bold text-slate-900">{Math.ceil(totalCount / pageSize)}</span>
                    </div>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={(currentPage + 1) * pageSize >= totalCount || isDataLoading}
                      className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">Project Submissions</h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">Review user-submitted projects. Approving marks it as approved and displays it on the public Projects page.</p>
                  </div>
                  <div className="text-xs font-bold text-slate-500">Pending: {projectSubmissionsTotal}</div>
                </div>
                {projectSubmissionsLoading ? (
                  <div className="p-12 text-center text-slate-500">
                    Loading submissions...
                  </div>
                ) : projectSubmissions.length === 0 ? (
                  <div className="p-12 text-center text-slate-500">
                    No pending submissions.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200 font-bold">
                          <th className="p-4 pl-6 font-semibold">Project</th>
                          <th className="p-4 font-semibold">Submitted By</th>
                          <th className="p-4 font-semibold">Description</th>
                          <th className="p-4 pr-6 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {projectSubmissions.map((submission) => (
                          <tr key={submission.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-4 pl-6 align-top">
                              <div className="font-bold text-slate-900">{submission.projectName}</div>
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
                            <td className="p-4 align-top max-w-[520px]">
                              <div className="text-slate-700 whitespace-pre-wrap break-words">{submission.description}</div>
                            </td>
                            <td className="p-4 pr-6 align-top text-right">
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <button
                                  onClick={() => handleProjectAction(submission.id, 'approve')}
                                  disabled={projectActionLoadingId === submission.id}
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleProjectAction(submission.id, 'reject')}
                                  disabled={projectActionLoadingId === submission.id}
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                                >
                                  <XCircle className="w-4 h-4" />
                                  Reject
                                </button>
                                <button
                                  onClick={() => handleProjectDelete(submission.id)}
                                  disabled={projectActionLoadingId === submission.id}
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-red-200 text-red-700 text-xs font-bold hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </button>
                                <button
                                  onClick={() => handleProjectDelete(submission.id, { deleteUser: true })}
                                  disabled={projectActionLoadingId === submission.id}
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-700 text-white text-xs font-bold hover:bg-red-800 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                                >
                                  <UserX className="w-4 h-4" />
                                  Delete User
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4 sm:gap-6">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">Approved Member Access Cards</h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">Active members are listed below, including their generated IDs.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
                    <div className="relative flex-1 xl:w-64">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search members..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                      <div className="relative flex-1 sm:w-auto">
                        <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <select
                          value={roleFilter}
                          onChange={(e) => setRoleFilter(e.target.value)}
                          className="w-full sm:w-44 pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                        >
                          <option value="All">All Roles</option>
                          {SPECIALIZATIONS.map(spec => (
                            <option key={spec.id} value={spec.label}>{spec.label}</option>
                          ))}
                        </select>
                      </div>
                      {users.filter(u => u && !u.isAdmin && u.status === 'Approved').length > 0 && (
                        <button
                          onClick={exportToExcel}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-xs sm:text-sm font-bold rounded-lg hover:bg-blue-700 transition-all shadow-md shadow-blue-900/10 active:scale-[0.98]"
                        >
                          <Download className="w-4 h-4" />
                          <span>Export {searchTerm ? 'Filtered' : 'All'} to Excel</span>
                        </button>
                      )}
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
                          <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200 font-bold">
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
                                <div className="font-bold text-slate-900">{member.fullName}</div>
                                <div className="text-xs text-slate-500">{member.email}</div>
                              </td>
                              <td className="p-4">{member.specialization}</td>
                              <td className="p-4">{member.role}</td>
                              <td className="p-4 font-mono font-bold text-blue-700">{member.memberId}</td>
                              <td className="p-4 pr-6 text-right">
                                <button
                                  onClick={() => setSelectedMember(member)}
                                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-2xl hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm"
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
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Showing <span className="text-slate-900">{filteredApprovedMembers.length}</span> of <span className="text-slate-900">{totalCount}</span> records
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 0 || isDataLoading}
                          className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl">
                          <span className="text-sm font-bold text-slate-900">Page {currentPage + 1}</span>
                          <span className="text-slate-400 mx-1">of</span>
                          <span className="text-sm font-bold text-slate-900">{Math.ceil(totalCount / pageSize)}</span>
                        </div>
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={(currentPage + 1) * pageSize >= totalCount || isDataLoading}
                          className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
        </section>
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
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Review Application</h3>
                    {selectedUser.status === 'Approved' && selectedUser.memberId && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-md uppercase tracking-wider">
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
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Applicant Name</p>
                      <p className="text-base font-bold text-slate-900">{selectedUser.fullName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Email Address</p>
                      <p className="text-sm font-semibold text-slate-600 break-all">{selectedUser.email}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Discord Username</p>
                      <p className="text-sm font-bold text-blue-600">{selectedUser.discordUsername || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Date Applied</p>
                      <p className="text-sm font-bold text-slate-900">
                        {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Primary Role</p>
                      <p className="text-sm font-bold text-slate-900">{selectedUser.specialization || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Community Role</p>
                      <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        {selectedUser.role}
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Member Since</p>
                      <p className="text-sm font-bold text-slate-900">{selectedUser.yearJoined || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Prof. Level</p>
                      <p className="text-sm font-bold text-slate-900">{selectedUser.experienceLevel || 'Beginner'}</p>
                    </div>
                  </div>

                  <div className="mb-6 space-y-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Selected Skills</p>
                      <div className="flex flex-wrap gap-2">
                        {Array.isArray(selectedUser.skills) && selectedUser.skills.length > 0 ? (
                          selectedUser.skills.map((skill, i) => (
                             <div
                               key={i}
                               className="flex items-center gap-3 pl-3 pr-5 py-3 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-blue-200 transition-all group"
                             >
                               <div className="w-10 h-10 rounded-md bg-slate-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-50 transition-colors border border-slate-100">
                                 <img
                                   src={`https://cdn.simpleicons.org/${skillToSlug(skill.name)}`}
                                   className="w-5 h-5 object-contain opacity-70 group-hover:opacity-100 transition-opacity"
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
                                 <span className="text-sm font-bold text-slate-800 leading-tight">{skill.name}</span>
                                 <div className="flex items-center gap-1.5 mt-1">
                                   {skill.level === 'Expert' ? <Zap size={10} className="text-blue-600 fill-blue-600" /> :
                                     skill.level === 'Practitioner' ? <CheckCircle2 size={10} className="text-blue-500" /> :
                                       <Clock size={10} className="text-slate-400" />}
                                   <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                     {skill.level}
                                   </span>
                                 </div>
                               </div>
                             </div>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 italic">None provided</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Experience Level</p>
                      <p className="text-sm font-bold text-slate-900">{selectedUser.experienceLevel || '-'}</p>
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Admin Notes (Optional)</label>
                    <textarea
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      placeholder="Add notes for the applicant..."
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 resize-none h-24 transition-all"
                    />
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-end gap-3">
                  {selectedUser.status === 'Approved' ? (
                    <div className="flex items-center gap-2 text-sm font-bold text-blue-600 px-4 py-2.5 bg-blue-50 rounded-2xl border border-blue-100">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Member Approved</span>
                    </div>
                  ) : (
                    <>
                      {selectedUser.status !== 'Declined' && (
                        <button
                          onClick={() => handleStatusUpdate(selectedUser.id, 'Declined')}
                          className="px-6 py-2.5 bg-white border border-red-200 text-red-600 text-sm font-bold rounded-2xl hover:bg-red-50 hover:border-red-300 transition-colors shadow-sm"
                        >
                          Decline
                        </button>
                      )}
                      <button
                        onClick={() => handleStatusUpdate(selectedUser.id, 'Approved')}
                        className={clsx(
                          "px-6 py-2.5 text-white text-sm font-bold rounded-2xl transition-all shadow-md flex items-center justify-center space-x-2",
                          selectedUser.status === 'Declined'
                            ? "bg-blue-600 hover:bg-blue-700 shadow-blue-900/10"
                            : "bg-blue-900 hover:bg-blue-800 shadow-blue-900/10"
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
              className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
            >
              <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col max-h-[95vh] sm:max-h-[90vh]">
                <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 flex-shrink-0">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900">My Access Card</h3>
                    <p className="text-xs sm:text-sm text-slate-500">Official digital ID details.</p>
                  </div>
                  <button
                    onClick={() => setShowMyCard(false)}
                    className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <XCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>
                <div className="overflow-y-auto flex-1 p-4 sm:p-8 flex flex-col items-center gap-6 no-scrollbar">
                  <div className="scale-[0.85] sm:scale-100 origin-top transition-transform">
                    <AccessCard user={currentUser} />
                  </div>
                  <div className="w-full flex flex-col gap-3 pb-4">
                    <button
                      onClick={() => handleCopyLink(currentUser)}
                      className="flex items-center justify-center gap-2 w-full py-4 bg-blue-900 text-white rounded-xl font-bold text-sm hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/20"
                    >
                      {copyStatus === 'copied' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copyStatus === 'copied' ? 'Link Copied' : 'Copy Public Link'}
                    </button>
                    <button
                      onClick={() => handleCopyEmbed(currentUser)}
                      className="flex items-center justify-center gap-2 w-full py-4 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm"
                    >
                      {copyStatus === 'embed-copied' ? <Check className="w-4 h-4" /> : <Code className="w-4 h-4" />}
                      {copyStatus === 'embed-copied' ? 'Embed Copied' : 'Copy Embed Code'}
                    </button>
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
              className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
            >
              <div className="w-full max-w-4xl bg-white rounded-[2rem] shadow-2xl border border-slate-200 flex flex-col max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">Member Profile</h3>
                    <p className="text-xs font-medium text-slate-500">Viewing official community record for {selectedMember.fullName}</p>
                  </div>
                  <button
                    onClick={() => setSelectedMember(null)}
                    className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all active:scale-95"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>

                <div className="overflow-y-auto flex-1 p-6 sm:p-8 no-scrollbar bg-slate-50/30">
                  <div className="flex flex-col lg:grid lg:grid-cols-2 gap-10">
                    <div className="flex flex-col items-center gap-8">
                      <div className="scale-[0.85] sm:scale-100 origin-top transition-transform drop-shadow-2xl">
                        <AccessCard user={selectedMember} />
                      </div>
                      <div className="w-full flex flex-col gap-3 max-w-[300px]">
                        <button
                          onClick={() => handleCopyLink(selectedMember)}
                          className="flex items-center justify-center gap-2 w-full py-4 bg-blue-900 text-white rounded-2xl font-bold text-sm hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/20 active:scale-[0.98]"
                        >
                          {copyStatus === 'copied' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copyStatus === 'copied' ? 'Link Copied' : 'Copy Public Link'}
                        </button>
                        <button
                          onClick={() => handleCopyEmbed(selectedMember)}
                          className="flex items-center justify-center gap-2 w-full py-4 bg-white border-2 border-slate-100 text-slate-700 rounded-2xl font-bold text-sm hover:border-blue-100 hover:bg-blue-50/30 transition-all active:scale-[0.98]"
                        >
                          {copyStatus === 'embed-copied' ? <Check className="w-4 h-4" /> : <Code className="w-4 h-4" />}
                          {copyStatus === 'embed-copied' ? 'Embed Copied' : 'Copy Embed Code'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-8">
                      <div className="grid grid-cols-2 gap-y-6 gap-x-8 px-2">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Full Name</p>
                          <p className="text-sm font-bold text-slate-900">{selectedMember.fullName}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Email Address</p>
                          <p className="text-sm font-semibold text-slate-600 break-all">{selectedMember.email}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Discord Handle</p>
                          <p className="text-sm font-bold text-blue-600">{selectedMember.discordUsername || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Primary Role</p>
                          <p className="text-sm font-bold text-slate-900">{selectedMember.specialization || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Community Role</p>
                          <span className="inline-flex px-2 py-0.5 rounded-md bg-blue-50 text-[10px] font-black text-blue-700 uppercase tracking-widest">
                            {selectedMember.role}
                          </span>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Member Since</p>
                          <p className="text-sm font-bold text-slate-900">{selectedMember.yearJoined || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Prof. Level</p>
                          <p className="text-sm font-bold text-slate-900">{selectedMember.experienceLevel || 'Beginner'}</p>
                        </div>
                      </div>

                      <div className="px-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Skills & Expertise</p>
                        <div className="flex flex-wrap gap-2.5">
                          {Array.isArray(selectedMember.skills) && selectedMember.skills.length > 0 ? (
                            selectedMember.skills.map((skill, i) => (
                              <div key={i} className="flex items-center gap-3 pl-3 pr-5 py-3 bg-white border border-slate-200 rounded-lg hover:border-blue-100 transition-colors group shadow-sm">
                                <div className="w-10 h-10 rounded-md bg-slate-50 flex items-center justify-center border border-slate-100">
                                  <img
                                    src={`https://cdn.simpleicons.org/${skillToSlug(skill.name)}`}
                                    className="w-5 h-5 object-contain opacity-70 group-hover:opacity-100 transition-opacity"
                                    alt=""
                                    onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                                  />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-slate-800 leading-tight">{skill.name}</span>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    {skill.level === 'Expert' ? <Zap size={10} className="text-blue-600 fill-blue-600" /> :
                                      skill.level === 'Practitioner' ? <CheckCircle2 size={10} className="text-blue-500" /> :
                                        <Clock size={10} className="text-slate-400" />}
                                    <span className="text-[9px] font-black uppercase tracking-widest text-blue-600">
                                      {skill.level}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-400 italic">No skills listed</p>
                          )}
                        </div>
                      </div>

                      <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Experience Level</p>
                        <p className="text-sm font-bold text-slate-900">{selectedMember.experienceLevel || 'Professional'}</p>
                      </div>

                      {selectedMember.adminNotes && (
                        <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100/50 relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-2 opacity-10">
                            <Key size={40} />
                          </div>
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Admin Remarks</p>
                          <p className="text-sm text-slate-700 italic leading-relaxed font-medium">
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
      </AnimatePresence>
    </div>
  );
}
