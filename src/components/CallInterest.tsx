import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Check, Hand, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { CallInterest, VolunteerCall } from '../types';
import { expressInterest, getCallInterests, markInterest, withdrawInterest } from '../services/supabase';
import { setReturnTo } from '../utils/returnTo';
import { Avatar } from './Avatar';
import { formatExternalUrl } from '../utils/skillUtils';

const chatLabel = (url: string) => {
  const h = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  if (/whatsapp|wa\.me/.test(h)) return 'WhatsApp group';
  if (/m\.me|messenger|facebook/.test(h)) return 'Messenger group';
  if (/viber|vb\.me/.test(h)) return 'Viber group';
  if (/t\.me|telegram/.test(h)) return 'Telegram group';
  if (/discord/.test(h)) return 'Discord';
  if (/slack/.test(h)) return 'Slack';
  return 'Group chat';
};

/** How to reach the poster: their contact note and/or group chat. Members only. */
export const CallContact: React.FC<{ call: VolunteerCall; className?: string }> = ({ call, className }) => {
  if (!call.contact && !call.chatUrl) return null;
  return (
    <div className={clsx('flex flex-wrap items-center gap-2', className)}>
      {call.chatUrl && (
        <a href={call.chatUrl} target="_blank" rel="noreferrer" className="s-btn s-btn-plain h-9 px-3 text-[13px]">
          <MessageCircle size={14} strokeWidth={1.75} />
          Join the {chatLabel(call.chatUrl)}
        </a>
      )}
      {call.contact && <span className="break-all text-[13px] text-slate-700">Contact: {call.contact}</span>}
    </div>
  );
};

interface InterestButtonProps {
  call: VolunteerCall;
  signedIn: boolean;
  isOwner: boolean;
  /** Where to come back to after signing in. */
  returnPath: string;
  onChanged?: (status: VolunteerCall['myInterest']) => void;
  compact?: boolean;
}

/** "I'm interested": sends visitors to sign in and back, and lets members raise or lower a hand. */
export const InterestButton: React.FC<InterestButtonProps> = ({ call, signedIn, isOwner, returnPath, onChanged, compact }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const status = call.myInterest && call.myInterest !== 'withdrawn' ? call.myInterest : null;

  if (call.status === 'closed' || isOwner) return null;

  if (!signedIn) {
    return (
      <button
        type="button"
        onClick={() => { setReturnTo(returnPath); navigate('/login'); }}
        className={clsx('s-btn s-btn-accent', compact ? 'h-9 px-3.5 text-[13px]' : 'h-10')}
      >
        <Hand size={15} strokeWidth={1.75} />
        I’m interested
      </button>
    );
  }

  if (status) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[13px] font-medium text-emerald-800 shadow-[inset_0_0_0_1px_rgb(16_185_129/0.25)]">
          <Check size={14} strokeWidth={2.25} />
          {status === 'contacted' ? 'They’ve been in touch' : 'You’re interested'}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try { await withdrawInterest(call.id); onChanged?.('withdrawn'); toast.success('Taken back'); }
            catch (err) { toast.error(err instanceof Error ? err.message : 'Couldn’t update'); }
            finally { setBusy(false); }
          }}
          className="text-[13px] text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
        >
          Withdraw
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={clsx('s-btn s-btn-accent', compact ? 'h-9 px-3.5 text-[13px]' : 'h-10')}>
        <Hand size={15} strokeWidth={1.75} />
        I’m interested
      </button>
    );
  }

  return (
    <form
      className="w-full space-y-3 rounded-[12px] bg-slate-50 p-3.5 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.06)]"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await expressInterest(call.id, { message: message.trim() || undefined, contact: contact.trim() || undefined });
          toast.success('Sent. The poster can see you raised your hand.');
          setOpen(false);
          onChanged?.('new');
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Couldn’t send';
          toast.error(msg);
          if (/finish your profile/i.test(msg)) { setReturnTo(returnPath); navigate('/register'); }
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <label htmlFor={`int-contact-${call.id}`} className="mb-1 block text-[12.5px] font-medium text-slate-800">
          How can they reach you? <span className="font-normal text-slate-400">optional</span>
        </label>
        <input id={`int-contact-${call.id}`} maxLength={200} value={contact} onChange={(e) => setContact(e.target.value)} className="s-field h-10 text-[14px]" placeholder="Messenger link, Discord handle, Viber…" />
        <p className="mt-1 text-[11.5px] text-slate-500">Only the person who posted sees this.</p>
      </div>
      <div>
        <label htmlFor={`int-msg-${call.id}`} className="mb-1 block text-[12.5px] font-medium text-slate-800">
          A line about you <span className="font-normal text-slate-400">optional</span>
        </label>
        <textarea id={`int-msg-${call.id}`} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} className="s-field h-auto min-h-[70px] resize-y py-2 text-[14px]" placeholder="What you can help with and when you’re free." />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="s-btn s-btn-accent h-9 flex-1 text-[13px]">{busy ? 'Sending…' : 'Send'}</button>
        <button type="button" onClick={() => setOpen(false)} className="s-btn s-btn-plain h-9 text-[13px]">Cancel</button>
      </div>
    </form>
  );
};

/** For the poster: who raised a hand, with a way to mark them as contacted. */
export const InterestList: React.FC<{ callId: string; onCount?: (n: number) => void }> = ({ callId, onCount }) => {
  const [items, setItems] = useState<CallInterest[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    getCallInterests(callId)
      .then((r) => { if (alive) { setItems(r.interests); onCount?.(r.interests.length); } })
      .catch((err) => { if (alive) setError(err instanceof Error ? err.message : 'Couldn’t load'); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId]);

  if (error) return <p className="text-[13px] text-red-700">{error}</p>;
  if (!items) return <p className="text-[13px] text-slate-500" role="status">Loading…</p>;
  if (!items.length) return <p className="text-[13px] text-slate-500">No one yet. Share the call in your group chats.</p>;

  return (
    <ul className="divide-y divide-slate-200/80">
      {items.map((i) => (
        <li key={i.id} className="flex flex-wrap items-start gap-3 py-3 first:pt-0 last:pb-0">
          <Avatar name={i.person.name} seed={i.person.memberId || i.id} photos={[i.person.avatarUrl]} size={34} />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-slate-900">
              {i.person.name}
              {!i.person.approved && <span className="ml-1.5 text-[11.5px] font-normal text-slate-500">not yet verified</span>}
            </p>
            <p className="text-[12.5px] text-slate-500">
              {[i.person.role, i.person.secondaryRole, i.person.discordUsername && `@${i.person.discordUsername}`].filter(Boolean).join(' · ')}
            </p>
            {i.contact && <p className="mt-1 break-all text-[13px] text-slate-800">Reach them: {/^https?:\/\//.test(i.contact) ? <a className="s-link" href={formatExternalUrl(i.contact)} target="_blank" rel="noreferrer">{i.contact}</a> : i.contact}</p>}
            {i.message && <p className="mt-1 whitespace-pre-wrap break-words text-[13px] text-slate-700">“{i.message}”</p>}
            {i.person.skills.length > 0 && (
              <p className="mt-1.5 flex flex-wrap gap-1">{i.person.skills.map((s) => <span key={s} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11.5px] text-slate-700">{s}</span>)}</p>
            )}
          </div>
          <button
            type="button"
            onClick={async () => {
              const next = i.status === 'contacted' ? 'new' : 'contacted';
              try {
                await markInterest(i.id, next);
                setItems((list) => list?.map((x) => (x.id === i.id ? { ...x, status: next } : x)) ?? null);
              } catch (err) { toast.error(err instanceof Error ? err.message : 'Couldn’t update'); }
            }}
            className={clsx('s-btn h-8 px-2.5 text-[12px]', i.status === 'contacted' ? 'bg-emerald-50 text-emerald-800' : 's-btn-plain')}
          >
            {i.status === 'contacted' ? <><Check size={13} strokeWidth={2.25} /> Contacted</> : 'Mark contacted'}
          </button>
        </li>
      ))}
    </ul>
  );
};
