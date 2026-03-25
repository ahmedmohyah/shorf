import { useState, useEffect } from 'react';
import { Youtube, Send, CheckCircle2, Loader2, Settings, AlertCircle, Link, Trash2 } from 'lucide-react';

export function YouTubeConnectView() {
  const [error, setError] = useState<string | null>(null);
  const [isYoutubeConnected, setIsYoutubeConnected] = useState(false);
  const [isConfigSet, setIsConfigSet] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [channels, setChannels] = useState<{ id: string; title: string; thumbnail: string }[]>([]);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(false);
  const [isVerifyingToken, setIsVerifyingToken] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/auth/youtube/status');
      const data = await res.json();
      setIsYoutubeConnected(data.connected);
      setIsConfigSet(data.configSet);
      if (data.clientId) setClientId(data.clientId);
      
      if (data.connected) {
        const verifyRes = await fetch('/api/auth/youtube/verify-token');
        const verifyData = await verifyRes.json();
        if (verifyData.valid) {
          setChannels(verifyData.channels || []);
        }
      }
    } catch (e) {
      console.error("Failed to check YouTube status", e);
    }
  };

  useEffect(() => {
    checkStatus();

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'YOUTUBE_AUTH_SUCCESS') {
        setIsYoutubeConnected(true);
        setIsConnecting(false);
        checkStatus();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleSaveConfig = async () => {
    try {
      setIsSavingConfig(true);
      setError(null);
      setConfigSuccess(false);
      
      const res = await fetch('/api/auth/youtube/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clientSecret })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل في حفظ الإعدادات");
      
      setIsConfigSet(true);
      setConfigSuccess(true);
      setClientSecret(""); 
      
      setTimeout(() => {
        setConfigSuccess(false);
      }, 2000);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleDisconnect = async (channelId?: string) => {
    try {
      const res = await fetch('/api/auth/youtube/disconnect', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId })
      });
      if (res.ok) {
        if (channelId) {
          const updatedChannels = channels.filter(c => c.id !== channelId);
          setChannels(updatedChannels);
          if (updatedChannels.length === 0) {
            setIsYoutubeConnected(false);
          }
        } else {
          setIsYoutubeConnected(false);
          setChannels([]);
        }
      }
    } catch (e) {
      console.error("Failed to disconnect", e);
    }
  };

  const handleVerifyToken = async () => {
    try {
      setIsVerifyingToken(true);
      setError(null);
      const res = await fetch('/api/auth/youtube/verify-token');
      const data = await res.json();
      
      if (data.valid) {
        setChannels(data.channels || []);
        setSuccessMessage(`التوكن صالح! تم العثور على ${data.channels?.length || 0} قنوات.`);
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setError(`التوكن غير صالح: ${data.error}`);
        setIsYoutubeConnected(false);
        setChannels([]);
      }
    } catch (err: any) {
      setError("فشل التحقق من التوكن");
    } finally {
      setIsVerifyingToken(false);
    }
  };

  const handleConnectYoutube = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      
      const response = await fetch('/api/auth/youtube/url');
      if (!response.ok) {
        throw new Error('فشل في الحصول على رابط المصادقة. تأكد من إعدادات Google Cloud.');
      }
      const { url } = await response.json();

      const authWindow = window.open(
        url,
        'oauth_popup',
        'width=600,height=700'
      );

      if (!authWindow) {
        throw new Error('تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.');
      }
    } catch (err: any) {
      setError(err.message);
      setIsConnecting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto pb-20" dir="rtl">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <Youtube className="w-6 h-6 text-red-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">ربط قنوات يوتيوب</h2>
          <p className="text-zinc-400">قم بإعداد مفاتيح API وربط قنواتك للبدء في النشر التلقائي</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3 text-red-400 animate-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3 text-emerald-400 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-bold">{successMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* API Configuration */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-5 h-5 text-zinc-400" />
            <h3 className="text-lg font-bold text-white">إعدادات Google Cloud</h3>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-400 flex items-center justify-between">
                <span>Google Client ID</span>
                <Link className="w-4 h-4 text-zinc-600" />
              </label>
              <input 
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all font-mono"
                placeholder="أدخل Client ID..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-400 flex items-center justify-between">
                <span>Google Client Secret</span>
                <Settings className="w-4 h-4 text-zinc-600" />
              </label>
              <input 
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all font-mono"
                placeholder="••••••••••••••••"
              />
            </div>

            <button 
              onClick={handleSaveConfig}
              disabled={isSavingConfig || !clientId || !clientSecret}
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all ${
                configSuccess 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
              }`}
            >
              {isSavingConfig ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              <span>{isSavingConfig ? 'جاري الحفظ...' : configSuccess ? 'تم الحفظ بنجاح' : 'حفظ الإعدادات'}</span>
            </button>
          </div>
        </div>

        {/* Connection Status */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-2">
            <Youtube className="w-5 h-5 text-red-500" />
            <h3 className="text-lg font-bold text-white">حالة الاتصال</h3>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${isYoutubeConnected ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-zinc-700'}`}></div>
                <span className="text-sm font-bold text-zinc-300">{isYoutubeConnected ? 'متصل بيوتيوب' : 'غير متصل'}</span>
              </div>
              {isYoutubeConnected && (
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-md">Active</span>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={handleConnectYoutube}
                disabled={isConnecting || !isConfigSet}
                className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all ${
                  isYoutubeConnected 
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700' 
                    : 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20'
                } disabled:opacity-50`}
              >
                {isConnecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Youtube className="w-5 h-5" />}
                <span>{isYoutubeConnected ? 'ربط قناة إضافية' : 'ربط حساب يوتيوب'}</span>
              </button>

              <button 
                onClick={handleVerifyToken}
                disabled={!isYoutubeConnected || isVerifyingToken}
                className="w-full py-4 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 rounded-xl text-sm font-bold transition-all border border-zinc-800 flex items-center justify-center gap-3"
              >
                {isVerifyingToken ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                <span>مزامنة التوكن والتحقق</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Connected Channels List */}
      {channels.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Youtube className="w-5 h-5 text-red-500" />
              <h3 className="text-lg font-bold text-white">القنوات المرتبطة ({channels.length})</h3>
            </div>
            <button 
              onClick={() => handleDisconnect()}
              className="text-xs font-bold text-red-500 hover:text-red-400 transition-colors"
            >
              فصل جميع القنوات
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {channels.map(channel => (
              <div key={channel.id} className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 flex items-center justify-between group hover:border-zinc-700 transition-all">
                <div className="flex items-center gap-3">
                  <img src={channel.thumbnail} alt="" className="w-10 h-10 rounded-full border border-zinc-800" />
                  <div>
                    <h4 className="text-sm font-bold text-white truncate max-w-[120px]">{channel.title}</h4>
                    <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">متصل</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleDisconnect(channel.id)}
                  className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  title="فصل القناة"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
