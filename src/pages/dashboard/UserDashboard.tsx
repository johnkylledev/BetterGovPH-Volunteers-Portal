import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { AccessCard } from '../../components/AccessCard';
import { motion } from 'framer-motion';
import { ShieldAlert, CheckCircle2, Clock, LogOut, Download, Copy, Code, Check, CreditCard } from 'lucide-react';
import html2canvas from 'html2canvas';
import clsx from 'clsx';

export default function UserDashboard() {
  const { currentUser, logout, authInitialized } = useStore();
  const navigate = useNavigate();
  const [downloadLoading, setDownloadLoading] = React.useState(false);
  const [copyStatus, setCopyStatus] = React.useState<'idle' | 'copied' | 'embed-copied'>('idle');

  useEffect(() => {
    if (authInitialized && !currentUser) {
      navigate('/');
    } else if (authInitialized && currentUser?.isAdmin) {
      navigate('/admin');
    }
  }, [currentUser, navigate, authInitialized]);

  if (!authInitialized || !currentUser) return null;

  const handleLogout = () => {
    logout();
    navigate('/');
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
    const url = `${window.location.origin}/verify/${currentUser.memberId || currentUser.id}?embed=true`;
    const embedCode = `<iframe src="${url}" width="380" height="600" frameborder="0"></iframe>`;
    navigator.clipboard.writeText(embedCode);
    setCopyStatus('embed-copied');
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-12 sm:pb-0">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 sm:h-20">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <img src="/logo.svg" alt="BetterGovPH Logo" className="w-7 h-7 sm:w-8 sm:h-8 object-contain brightness-0" />
              <span className="text-lg sm:text-xl font-display font-bold text-slate-900 truncate">BetterGovPH</span>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              {currentUser.status === 'Approved' && (
                <button
                  onClick={() => {
                    const el = document.getElementById('digital-card-section');
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
                >
                  <CreditCard className="w-4 h-4" />
                  <span className="hidden sm:inline">My Card</span>
                  <span className="sm:hidden">Card</span>
                </button>
              )}
              <div className="h-6 w-[1px] bg-slate-200" />
              <div className="flex flex-col items-end">
                <span className="text-xs sm:text-sm font-bold text-slate-900 leading-none truncate max-w-[100px] sm:max-w-none">
                  {currentUser.fullName.split(' ')[0]}
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{currentUser.role}</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">

          {/* Left Column: Status and Info */}
          <div className="lg:col-span-7 space-y-6 order-2 lg:order-1">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white sm:rounded-xl p-6 sm:p-8 shadow-sm border-y sm:border border-slate-100"
            >
              <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-4 sm:mb-6">Application Status</h2>
              <div className={clsx(
                "flex items-start sm:items-center space-x-4 p-4 rounded-lg sm:rounded-xl border",
                currentUser.status === 'Approved' ? 'bg-green-50 border-green-100' :
                  currentUser.status === 'Declined' ? 'bg-red-50 border-red-100' :
                    'bg-yellow-50 border-yellow-100'
              )}>
                <div className="mt-0.5 sm:mt-0">{getStatusIcon()}</div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{currentUser.status}</p>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    {currentUser.status === 'Approved' ? 'Your application has been approved. Your ID is ready.' :
                      currentUser.status === 'Declined' ? 'Your application was declined by the administrator.' :
                        'Your application is currently under review by our team.'}
                  </p>
                </div>
              </div>

              {currentUser.adminNotes && (
                <div className="mt-4 p-4 bg-slate-50 rounded-lg sm:rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Admin Notes</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{currentUser.adminNotes}</p>
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white sm:rounded-xl p-6 sm:p-8 shadow-sm border-y sm:border border-slate-100"
            >
              <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-4 sm:mb-6">Profile Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 sm:gap-x-8">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</p>
                  <p className="text-sm font-medium text-slate-900 truncate">{currentUser.fullName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email</p>
                  <p className="text-sm font-medium text-slate-900 truncate">{currentUser.email}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Discord</p>
                  <p className="text-sm font-medium text-slate-900 truncate">{currentUser.discordUsername}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Specialization</p>
                  <p className="text-sm font-medium text-slate-900">{currentUser.specialization}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Role</p>
                  <p className="text-sm font-medium text-slate-900">{currentUser.role}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Member Since</p>
                  <p className="text-sm font-medium text-slate-900">{currentUser.yearJoined || '-'}</p>
                </div>
                {currentUser.memberId && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Member ID</p>
                    <p className="text-sm font-mono font-bold text-blue-600">{currentUser.memberId}</p>
                  </div>
                )}
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
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Digital Access Card</h2>
                {currentUser.status === 'Approved' && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-[10px] sm:text-xs font-bold rounded-full uppercase tracking-wide">
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
                    <div className="bg-white/90 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-xl border border-slate-200 text-center">
                      <p className="text-sm font-bold text-slate-800">Card Unavailable</p>
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
                      className="flex items-center justify-center gap-2 w-full py-4 bg-blue-900 text-white rounded-xl font-bold text-sm hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/20 active:scale-[0.98]"
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
                      className="flex items-center justify-center gap-2 w-full py-4 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm active:scale-[0.98]"
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
    </div>

  );
}
