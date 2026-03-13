import { useState } from 'react';
import { X } from 'lucide-react';

interface CreateAgentModalProps {
  onClose: () => void;
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  fetchAgents: () => void;
}

const API_BASE = '';

export function CreateAgentModal({ onClose, triggerToast, fetchAgents }: CreateAgentModalProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    personality: '',
    provider: 'openrouter',
    profilePic: '',
  });
  const [telegramData, setTelegramData] = useState({
    botToken: '',
    allowedUserId: '',
  });
  const [verifyCode, setVerifyCode] = useState('');
  const [sending, setSending] = useState(false);

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSendCode = async () => {
    if (!telegramData.botToken || !telegramData.allowedUserId) {
      triggerToast('Please fill bot token and user ID', 'error');
      return;
    }
    setSending(true);
    try {
      await fetch(`${API_BASE}/api/telegram/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: telegramData.botToken,
          userId: telegramData.allowedUserId,
        }),
      });
      triggerToast('Verification code sent!');
      setStep(3);
    } catch (err) {
      triggerToast('Failed to send code', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (!verifyCode) {
      triggerToast('Please enter the code', 'error');
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/telegram/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: telegramData.botToken,
          code: verifyCode,
          userId: telegramData.allowedUserId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await handleCreate();
      } else {
        triggerToast(data.error || 'Invalid code', 'error');
      }
    } catch (err) {
      triggerToast('Verification failed', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleCreate = async () => {
    try {
      await fetch(`${API_BASE}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          role: formData.role,
          personality: formData.personality,
          provider: formData.provider,
          profilePic: formData.profilePic,
          telegramToken: telegramData.botToken,
          telegramId: telegramData.allowedUserId,
          status: 'running',
        }),
      });
      triggerToast('Agent deployed successfully!');
      fetchAgents();
      onClose();
    } catch (err) {
      triggerToast('Failed to create agent', 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-in fade-in duration-300">
      <div className="bg-zinc-950 border border-zinc-800 w-full max-w-2xl rounded-[3.5rem] p-12 relative flex flex-col shadow-2xl max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-10 right-10 w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-500 hover:text-white transition-all">
          <X className="w-6 h-6" />
        </button>
        
        <h2 className="text-4xl font-black text-white mb-2 lowercase">new deployment</h2>
        <p className="text-zinc-500 text-sm lowercase mb-10 border-b border-zinc-800 pb-8">stage {step} of 3</p>
        
        <div className="flex-1">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-zinc-400 mb-2 ml-4">Agent Name *</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Ralph" className="w-full bg-black border border-zinc-800 rounded-full px-8 py-4 text-white outline-none focus:border-zinc-500 transition-colors" />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-2 ml-4">Role *</label>
                <input type="text" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} placeholder="e.g. Code Assistant" className="w-full bg-black border border-zinc-800 rounded-full px-8 py-4 text-white outline-none focus:border-zinc-500 transition-colors" />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-2 ml-4">Personality</label>
                <input type="text" value={formData.personality} onChange={e => setFormData({...formData, personality: e.target.value})} placeholder="e.g. Helpful and concise" className="w-full bg-black border border-zinc-800 rounded-full px-8 py-4 text-white outline-none focus:border-zinc-500 transition-colors" />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-2 ml-4">Profile Picture URL</label>
                <input type="text" value={formData.profilePic} onChange={e => setFormData({...formData, profilePic: e.target.value})} placeholder="https://..." className="w-full bg-black border border-zinc-800 rounded-full px-8 py-4 text-white outline-none focus:border-zinc-500 transition-colors" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <label className="block text-sm text-zinc-400 mb-4 ml-4">Select LLM Provider</label>
              {['openrouter', 'openai', 'anthropic', 'gemini'].map(provider => (
                <button 
                  key={provider}
                  onClick={() => setFormData({...formData, provider})}
                  className={`w-full text-left px-8 py-5 rounded-full border transition-all ${formData.provider === provider ? 'bg-white text-black border-white font-bold' : 'bg-black border-zinc-800 text-white hover:border-zinc-600'}`}
                >
                  {provider.charAt(0).toUpperCase() + provider.slice(1)} {provider === 'openrouter' && '(Free Models Only)'}
                </button>
              ))}
              <div className="mt-6 pt-6 border-t border-zinc-800">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2 ml-4">Telegram Bot Token</label>
                    <input type="text" value={telegramData.botToken} onChange={e => setTelegramData({...telegramData, botToken: e.target.value})} placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11" className="w-full bg-black border border-zinc-800 rounded-full px-8 py-4 text-white outline-none focus:border-zinc-500 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2 ml-4">Allowlist User ID</label>
                    <input type="text" value={telegramData.allowedUserId} onChange={e => setTelegramData({...telegramData, allowedUserId: e.target.value})} placeholder="Your Telegram User ID" className="w-full bg-black border border-zinc-800 rounded-full px-8 py-4 text-white outline-none focus:border-zinc-500 transition-colors" />
                  </div>
                  <p className="text-xs text-zinc-500 ml-4">A 6-digit code will be sent to verify the bot.</p>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 text-center flex flex-col items-center">
              <p className="text-zinc-400 mb-4">Enter the 6-digit code sent to your Telegram.</p>
              <input type="text" value={verifyCode} onChange={e => setVerifyCode(e.target.value)} placeholder="000000" className="w-48 bg-black border border-zinc-800 rounded-2xl px-6 py-4 text-white text-center text-2xl tracking-[0.5em] outline-none focus:border-zinc-500 transition-colors font-mono" maxLength={6} />
              <button className="text-sm text-zinc-500 hover:text-white underline mt-4" onClick={handleSendCode}>Resend Code</button>
              <div className="mt-8 p-4 bg-zinc-900 rounded-xl text-xs text-zinc-400 text-left w-full">
                <strong>Webhook URL:</strong> Will be configured automatically via tunnel/domain
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-10 mt-auto">
          {step > 1 ? (
            <button onClick={handleBack} className="text-zinc-500 hover:text-white px-6 py-4 font-bold">back</button>
          ) : <div></div>}
          
          {step < 3 ? (
            <button onClick={handleNext} className="bg-white text-black px-10 py-4 rounded-full font-bold hover:bg-zinc-200 transition-colors">next stage</button>
          ) : (
            <button onClick={handleVerify} disabled={sending} className="bg-emerald-500 text-black px-10 py-4 rounded-full font-bold hover:bg-emerald-400 transition-colors disabled:opacity-50">
              {sending ? 'Verifying...' : 'verify & deploy'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
