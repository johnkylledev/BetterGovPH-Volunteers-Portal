import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, CheckCircle2, XCircle, LogOut, Filter, Users, Key, CreditCard, Download, Copy, Code, Check, Clock } from 'lucide-react';
import html2canvas from 'html2canvas';
import { AccessCard } from '../../components/AccessCard';
import clsx from 'clsx';
import { User, ApplicationStatus } from '../../types';
import { getAllUsers } from '../../services/supabase';
import * as XLSX from 'xlsx';

export default function AdminDashboard() {
  const { currentUser, users, logout, updateUserStatus, setUsers, authInitialized } = useStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'applications' | 'members'>('applications');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'All'>('All');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [showMyCard, setShowMyCard] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'embed-copied'>('idle');

  useEffect(() => {
    if (authInitialized && (!currentUser || !currentUser.isAdmin)) {
      navigate('/login');
    }
  }, [currentUser, navigate, authInitialized]);

  useEffect(() => {
    if (!currentUser?.isAdmin) return;

    const loadUsers = async () => {
      try {
        const allUsers = await getAllUsers();
        setUsers(allUsers);
      } catch (error) {
        console.error('Error loading admin users:', error);
      }
    };

    loadUsers();
  }, [currentUser, setUsers]);

  if (!authInitialized || !currentUser || !currentUser.isAdmin) return null;

  const handleLogout = () => {
    logout();
    navigate('/');
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
    } else {
      alert(`Failed to update database: ${(res as any)?.message || 'Unknown error'}. Please check if the user exists in Supabase.`);
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
      'Specialization': member.specialization || 'N/A',
      'Role': member.role || 'Member',
      'Discord Username': member.discordUsername || 'N/A',
      'Year Joined': member.yearJoined || 'N/A',
      'Status': member.status,
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
      { wch: 20 }, // Specialization
      { wch: 15 }, // Role
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
    return users
      .filter((u) => !u.isAdmin)
      .filter((user) => {
        const matchesSearch =
          user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (user.discordUsername && user.discordUsername.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesStatus = statusFilter === 'All' || user.status === statusFilter;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [users, searchTerm, statusFilter]);

  const filteredApprovedMembers = useMemo(() => {
    return users
      .filter(u => !u.isAdmin && u.status === 'Approved')
      .filter((user) => {
        const matchesSearch =
          user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (user.discordUsername && user.discordUsername.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (user.memberId && user.memberId.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesSearch;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [users, searchTerm]);

  const pendingCount = users.filter(u => !u.isAdmin && u.status === 'Pending').length;
  const approvedCount = users.filter(u => !u.isAdmin && u.status === 'Approved').length;

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
                  {users.filter(u => !u.isAdmin && u.status === 'Pending').length}
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
                <span>Member Cards</span>
                <span className={clsx(
                  "px-2 py-0.5 text-[10px] rounded-full font-bold",
                  activeTab === 'members' ? "bg-blue-900 text-white" : "bg-slate-100 text-slate-500"
                )}>
                  {approvedCount}
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
              <p className="mt-1 text-sm text-slate-500">{currentUser.email}</p>
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
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Applicants</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{users.filter((u) => !u.isAdmin).length}</p>
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
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold">Total Applicants</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{users.filter((u) => !u.isAdmin).length}</p>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex items-center gap-4">
              <div className="text-yellow-600 flex items-center justify-center">
                <Clock className="w-8 h-8" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold">Pending Review</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{pendingCount}</p>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex items-center gap-4">
              <div className="text-blue-600 flex items-center justify-center">
                <Key className="w-8 h-8" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold">IDs Issued</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{approvedCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            {activeTab === 'applications' ? (
              <>
                <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Application Management</h2>
                    <p className="text-sm text-slate-500 mt-1">Review non-admin signups, update statuses, and generate IDs.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                    <div className="relative flex-1 lg:w-64">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search applicants..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div className="relative w-full sm:w-auto">
                      <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | 'All')}
                        className="w-full sm:w-48 pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                      >
                        <option value="All">All Statuses</option>
                        <option value="Pending">Pending</option>
                        <option value="Approved">Approved</option>
                        <option value="Declined">Declined</option>
                      </select>
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
              </>
            ) : (
              <>
                <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Approved Member Access Cards</h2>
                    <p className="text-sm text-slate-500 mt-1">Active members are listed below, including their generated IDs.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                    <div className="relative flex-1 lg:w-64">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search members..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                      />
                    </div>
                    {users.filter(u => !u.isAdmin && u.status === 'Approved').length > 0 && (
                      <button
                        onClick={exportToExcel}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-md shadow-blue-900/10 active:scale-[0.98]"
                      >
                        <Download className="w-4 h-4" />
                        <span>Export {searchTerm ? 'Filtered' : 'All'} to Excel</span>
                      </button>
                    )}
                  </div>
                </div>
                {filteredApprovedMembers.length === 0 ? (
                  <div className="p-12 text-center text-slate-500">
                    <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>{searchTerm ? 'No members match your search' : 'No approved members yet'}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200 font-bold">
                          <th className="p-4 pl-6 font-semibold">Member Name</th>
                          <th className="p-4 font-semibold">Specialization</th>
                          <th className="p-4 font-semibold">Role</th>
                          <th className="p-4 font-semibold">Member ID</th>
                          <th className="p-4 pr-6 font-semibold text-right">Actions</th>
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

                <div className="p-6 overflow-y-auto flex-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-6 mb-6">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Applicant Name</p>
                      <p className="text-sm font-semibold text-slate-900">{selectedUser.fullName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Email</p>
                      <p className="text-sm font-semibold text-slate-900">{selectedUser.email}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Discord Username</p>
                      <p className="text-sm font-semibold text-slate-900 bg-blue-50 text-blue-700 inline-block px-2 py-0.5 rounded-md">{selectedUser.discordUsername || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Date Applied</p>
                      <p className="text-sm font-semibold text-slate-900">{new Date(selectedUser.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Specialization</p>
                      <p className="text-sm font-semibold text-slate-900">{selectedUser.specialization}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Role Request</p>
                      <p className="text-sm font-semibold text-slate-900">{selectedUser.role}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Member Since</p>
                      <p className="text-sm font-semibold text-slate-900">{selectedUser.yearJoined || 'N/A'}</p>
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
              <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col max-h-[95vh] sm:max-h-[90vh]">
                <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 flex-shrink-0">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900">Member Access Card</h3>
                    <p className="text-xs sm:text-sm text-slate-500">{selectedMember.fullName}'s official card.</p>
                  </div>
                  <button
                    onClick={() => setSelectedMember(null)}
                    className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <XCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>
                <div className="overflow-y-auto flex-1 p-4 sm:p-8 flex flex-col items-center gap-6 no-scrollbar">
                  <div className="scale-[0.85] sm:scale-100 origin-top transition-transform">
                    <AccessCard user={selectedMember} />
                  </div>
                  <div className="w-full flex flex-col gap-3 pb-4">
                    <button
                      onClick={() => handleCopyLink(selectedMember)}
                      className="flex items-center justify-center gap-2 w-full py-4 bg-blue-900 text-white rounded-xl font-bold text-sm hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/20"
                    >
                      {copyStatus === 'copied' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copyStatus === 'copied' ? 'Link Copied' : 'Copy Public Link'}
                    </button>
                    <button
                      onClick={() => handleCopyEmbed(selectedMember)}
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
      </AnimatePresence>
    </div>
  );
}


