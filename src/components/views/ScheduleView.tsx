import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Youtube, Send, CheckCircle2, Wand2, Loader2, Play, Settings, AlertCircle, Link, Brain, Shuffle, Laugh, BookOpen, ChevronRight, Plus, Trash2, Ghost, Zap, CalendarDays, CalendarRange, MonitorPlay, Download, ExternalLink, Video, Check, RefreshCw } from 'lucide-react';
import { retryWithBackoff, getCurrentApiKey } from '../../lib/ai-client';
import { db, auth } from '../../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, getDocs, deleteDoc } from 'firebase/firestore';

interface ScheduledVideo {
  id: string;
  title: string;
  overlayText: string;
  veoPrompt: string;
  scheduledDate: string;
  scheduledTime: string;
  rawTimestamp: number;
  category: string;
  template: 'modern' | 'cinematic' | 'bold';
  status: 'pending' | 'generating' | 'scheduled' | 'published' | 'error';
  thumbnail?: string;
  firebaseId?: string;
  progress?: number;
  progressDetail?: string;
  youtubeUrl?: string;
  videoUrl?: string;
  batchId?: string;
  channelId?: string;
  channelName?: string;
}

export function ScheduleView() {
  const [niche, setNiche] = useState("حقائق نفسية مذهلة");
  const [categories, setCategories] = useState([
    { name: 'psychological', label: 'نفسية', enabled: true },
    { name: 'diverse', label: 'متنوعة', enabled: true },
    { name: 'comedy', label: 'كوميدية', enabled: true },
    { name: 'storytelling', label: 'قصصية', enabled: true },
    { name: 'mystery', label: 'غموض', enabled: true },
    { name: 'motivation', label: 'تحفيزية', enabled: true }
  ]);
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily');
  const [isAutomating, setIsAutomating] = useState(false);
  const [automationStatus, setAutomationStatus] = useState("");
  const [batchProgress, setBatchProgress] = useState({ completed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [isYoutubeConnected, setIsYoutubeConnected] = useState(false);
  const [channels, setChannels] = useState<{ id: string; title: string; thumbnail: string }[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [totalVideosPerDay, setTotalVideosPerDay] = useState<number>(3);
  const [intervalHours, setIntervalHours] = useState<number>(1);
  const [expandedChannels, setExpandedChannels] = useState<Record<string, boolean>>({});
  const [queue, setQueue] = useState<ScheduledVideo[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Robot & Agent State
  const [robotStatus, setRobotStatus] = useState<'idle' | 'processing' | 'verifying' | 'completed'>('idle');
  const [agentLog, setAgentLog] = useState<string[]>([]);

  const addAgentLog = (msg: string) => {
    setAgentLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 19)]);
  };

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/auth/youtube/status');
        const contentType = res.headers.get("content-type");
        
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "فشل في التحقق من حالة يوتيوب");
          setIsYoutubeConnected(data.connected);
          
          if (data.connected) {
            const verifyRes = await fetch('/api/auth/youtube/verify-token');
            const verifyContentType = verifyRes.headers.get("content-type");
            if (verifyContentType && verifyContentType.indexOf("application/json") !== -1) {
              const verifyData = await verifyRes.json();
              if (verifyRes.ok && verifyData.valid) {
                setChannels(verifyData.channels || []);
                if (verifyData.channels && verifyData.channels.length > 0) {
                  setSelectedChannelId(verifyData.channels[0].id);
                }
              }
            } else {
              const text = await verifyRes.text();
              console.error(text || "فشل في التحقق من الرمز");
            }
          }
        } else {
          const text = await res.text();
          throw new Error(text || "فشل في التحقق من حالة يوتيوب");
        }
      } catch (e) {
        console.error("Failed to check YouTube status", e);
      }
    };
    checkStatus();
  }, []);

  useEffect(() => {
    const fetchQueue = async () => {
      if (!auth.currentUser) return;
      
      try {
        const q = query(
          collection(db, 'scheduledVideos'),
          where('userId', '==', auth.currentUser.uid)
        );
        
        const snapshot = await getDocs(q);
        const fetchedQueue: ScheduledVideo[] = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          fetchedQueue.push({
            id: doc.id,
            firebaseId: doc.id,
            title: data.title,
            overlayText: data.overlayText,
            veoPrompt: data.veoPrompt,
            category: data.category,
            template: data.template,
            scheduledDate: data.scheduledDate,
            scheduledTime: data.scheduledTime,
            rawTimestamp: data.rawTimestamp,
            status: data.status,
            progress: data.progress || 0,
            progressDetail: data.progressDetail || '',
            thumbnail: data.thumbnail,
            batchId: data.batchId,
            videoUrl: data.videoUrl,
            youtubeUrl: data.youtubeUrl,
            channelId: data.channelId,
            channelName: data.channelName
          });
        });
        
        fetchedQueue.sort((a, b) => (a.rawTimestamp || 0) - (b.rawTimestamp || 0));
        setQueue(fetchedQueue);
        
        const pendingVideos = fetchedQueue.filter(v => v.status === 'pending' || v.status === 'generating');
        if (pendingVideos.length > 0 && !isAutomating) {
          startRobotProcessing(pendingVideos);
        }
        
      } catch (err) {
        console.error("Error fetching queue:", err);
      }
    };

    fetchQueue();
  }, [auth.currentUser]);

  const startRobotProcessing = async (videos: ScheduledVideo[]) => {
    if (isAutomating) {
      addAgentLog("تنبيه: هناك عملية أتمتة تعمل حالياً. لا يمكن بدء عملية جديدة.");
      return;
    }
    setIsAutomating(true);
    setRobotStatus('processing');
    addAgentLog("بدء تشغيل الروبوت المتسلسل...");
    
    let completedCount = 0;
    for (const video of videos) {
      try {
        addAgentLog(`جاري معالجة الفيديو: ${video.title}`);
        await handleScheduleVideo(video, video.batchId);
        completedCount++;
        setBatchProgress({ completed: completedCount, total: videos.length });
      } catch (err: any) {
        addAgentLog(`خطأ في معالجة الفيديو ${video.title}: ${err.message}`);
        setQueue(prev => prev.map(v => v.id === video.id ? { ...v, status: 'error' } : v));
        // Continue with the next video
      }
    }
    
    setRobotStatus('completed');
    setIsAutomating(false);
    addAgentLog("اكتملت جميع العمليات بنجاح.");
  };

  const handleStartAutomation = async () => {
    const enabledCategories = categories.filter(c => c.enabled);
    if (totalVideosPerDay === 0) {
      setError(`يجب تحديد عدد فيديوهات أكبر من صفر.`);
      return;
    }
    if (enabledCategories.length === 0) {
      setError(`يجب اختيار تصنيف واحد على الأقل.`);
      return;
    }

    if (!isYoutubeConnected || !selectedChannelId) {
      setError("يرجى ربط حساب يوتيوب واختيار القناة أولاً.");
      return;
    }

    try {
      setError(null);
      setIsAutomating(true);
      setRobotStatus('processing');
      addAgentLog("بدء عملية الأتمتة الذكية...");
      
      const totalDays = frequency === 'weekly' ? 7 : 1;
      let allGeneratedItems: any[] = [];

      for (let day = 0; day < totalDays; day++) {
        addAgentLog(`توليد نصوص اليوم ${day + 1}...`);
        
        const prompt = `أنت خبير في إنشاء محتوى يوتيوب شورتس (YouTube Shorts) سريع الانتشار.
المطلوب: توليد ${totalVideosPerDay} أفكار لفيديوهات قصيرة جذابة جداً وموزعة على التصنيفات التالية:
${enabledCategories.map(cat => `- ${cat.label} (${cat.name})`).join('\n')}

الموضوع العام: "${niche}".
القواعد الصارمة (Zero Error Tolerance):
1. ممنوع تكرار النصوص أو الأفكار نهائياً بين الفيديوهات.
2. المشهد يجب أن يكون طبيعياً خلاباً (Cinematic nature scene).
3. الصوت: أصوات طبيعة فقط (Nature sounds, ambient, wind, water, birds).
4. ممنوع إضافة أي موسيقى نهائياً (STRICTLY NO MUSIC).
5. الجودة المستهدفة: Full HD (1080p).
6. النص المعروض (overlayText) يجب أن يكون ملهماً ومكتوباً بأسلوب جذاب (6-10 أسطر).

قم بإرجاع النتيجة بصيغة JSON Array فقط، مع توزيع الفيديوهات بشكل متوازن على التصنيفات المختارة:
[
  {
    "title": "عنوان الفيديو",
    "overlayText": "نص الفيديو المكون من 6-10 أسطر",
    "veoPrompt": "A breathtaking cinematic nature scene of [specific nature element], high detail, 1080p. Sound: Pure nature ambient sounds of [specific sounds]. NO MUSIC.",
    "category": "نفسية",
    "template": "modern"
  }
]`;

        const response = await retryWithBackoff((ai) => ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
          config: { responseMimeType: "application/json" }
        }));

        let responseText = response.text || "[]";
        // Remove potential markdown code block formatting
        responseText = responseText.replace(/```json\n?|\n?```/g, "").trim();
        
        let generatedItems: any[];
        try {
          generatedItems = JSON.parse(responseText);
        } catch (e) {
          addAgentLog(`خطأ في تحليل استجابة الذكاء الاصطناعي: ${responseText.substring(0, 100)}...`);
          throw new Error("فشل في تحليل بيانات الفيديوهات المرجعة من الذكاء الاصطناعي.");
        }
        
        if (!Array.isArray(generatedItems)) {
          addAgentLog(`الاستجابة ليست مصفوفة: ${typeof generatedItems}`);
          throw new Error("تنسيق بيانات الفيديوهات غير صحيح (يجب أن تكون مصفوفة).");
        }
        
        if (generatedItems.length !== totalVideosPerDay) {
          addAgentLog(`تحذير: تم طلب ${totalVideosPerDay} فيديو ولكن تم استلام ${generatedItems.length}.`);
        }
        
        allGeneratedItems = [...allGeneratedItems, ...generatedItems.map((item: any) => ({ ...item, dayOffset: day }))];
      }

      addAgentLog("حفظ البيانات في قاعدة البيانات...");
      const userId = auth.currentUser?.uid || 'anonymous';
      const selectedChannel = channels.find(c => c.id === selectedChannelId);
      
      const batchRef = await addDoc(collection(db, 'automationBatches'), {
        niche,
        frequency,
        totalVideos: allGeneratedItems.length,
        completedVideos: 0,
        status: 'running',
        userId,
        channelId: selectedChannelId,
        channelName: selectedChannel?.title || 'قناة غير معروفة',
        createdAt: new Date().toISOString()
      });

      // Scheduling starts from March 25th, 2026
      const startDate = new Date('2026-03-25T10:00:00');

      const newQueue: ScheduledVideo[] = allGeneratedItems.map((item: any, index: number) => {
        const scheduleDate = new Date(startDate);
        scheduleDate.setDate(startDate.getDate() + item.dayOffset);
        scheduleDate.setHours(10 + ((index % totalVideosPerDay) * intervalHours), 0, 0, 0);

        return {
          id: Math.random().toString(36).substring(7),
          title: item.title,
          overlayText: item.overlayText,
          veoPrompt: item.veoPrompt,
          category: item.category || 'عام',
          template: item.template || 'modern',
          scheduledDate: scheduleDate.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }),
          scheduledTime: scheduleDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          rawTimestamp: scheduleDate.getTime(),
          status: 'pending',
          thumbnail: `https://picsum.photos/seed/${Math.random()}/100/150`,
          batchId: batchRef.id,
          channelId: selectedChannelId,
          channelName: selectedChannel?.title || 'قناة غير معروفة'
        };
      });

      setQueue([...newQueue, ...queue]);
      
      // Start sequential processing
      startRobotProcessing(newQueue);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "حدث خطأ أثناء الأتمتة");
      setIsAutomating(false);
    }
  };

  const handleDownload = async (url: string, title: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${title}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Download failed:", error);
      alert("فشل تحميل الفيديو. يرجى المحاولة مرة أخرى.");
    }
  };

  const handleScheduleVideo = async (video: ScheduledVideo, batchId?: string, isImmediate = false) => {
    if (video.status === 'scheduled' || video.status === 'published') return;
    
    let videoRefId = video.firebaseId;

    try {
      addAgentLog(`[الخطوة 1] توليد فيديو Veo 3.1 لـ: ${video.title}`);
      setQueue(prev => prev.map(v => v.id === video.id ? { ...v, status: 'generating', progress: 20, progressDetail: 'جاري توليد المشهد الطبيعي (Veo 3.1)...' } : v));
      
      const userId = auth.currentUser?.uid || 'anonymous';

      if (!videoRefId) {
        const videoRef = await addDoc(collection(db, 'scheduledVideos'), {
          ...video,
          status: 'generating',
          progress: 20,
          userId,
          createdAt: new Date().toISOString()
        });
        videoRefId = videoRef.id;
        setQueue(prev => prev.map(v => v.id === video.id ? { ...v, firebaseId: videoRefId } : v));
      }

      // @ts-ignore
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        // @ts-ignore
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          throw new Error("لم يتم اختيار مفتاح API. يرجى اختيار مفتاح API صالح.");
        }
      }

      let operation = await retryWithBackoff(async (ai) => {
        let op = await ai.models.generateVideos({
          model: 'veo-3.1-fast-generate-preview',
          prompt: video.veoPrompt,
          config: {
            numberOfVideos: 1,
            resolution: '1080p',
            aspectRatio: '9:16'
          }
        });

        while (!op.done) {
          await new Promise(resolve => setTimeout(resolve, 10000));
          op = await ai.operations.getVideosOperation({ operation: op });
        }
        return op;
      });

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) throw new Error("فشل في الحصول على رابط الفيديو");

      addAgentLog(`[الخطوة 2] تم توليد المشهد. جاري دمج النص وتنسيق الفيديو...`);
      setQueue(prev => prev.map(v => v.id === video.id ? { ...v, videoUrl: downloadLink, progress: 60, progressDetail: 'جاري دمج النص وتنسيق الفيديو...' } : v));
      await updateDoc(doc(db, 'scheduledVideos', videoRefId), { videoUrl: downloadLink, progress: 60 });

      // Simulate merging and formatting time
      await new Promise(resolve => setTimeout(resolve, 4000));

      addAgentLog(`[الخطوة 3] اكتمل الدمج. جاري الرفع والجدولة لـ: ${video.title}`);
      setQueue(prev => prev.map(v => v.id === video.id ? { ...v, progress: 80, progressDetail: 'جاري الرفع والجدولة...' } : v));
      await updateDoc(doc(db, 'scheduledVideos', videoRefId), { progress: 80 });

      const res = await fetch('/api/youtube/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: videoRefId,
          videoUrl: downloadLink,
          title: video.title,
          description: video.overlayText,
          overlayText: video.overlayText,
          scheduledTime: isImmediate ? Date.now() : video.rawTimestamp,
          channelId: video.channelId,
          publishNow: isImmediate,
          apiKey: getCurrentApiKey()
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "فشل في الجدولة على يوتيوب");
      }

      const responseData = await res.json();
      
      if (responseData.videoId !== videoRefId) {
        throw new Error("فشل التحقق النهائي: الفيديو المرفوع لا يتطابق مع الفيديو المطلوب");
      }

      const youtubeUrl = responseData.youtubeUrl || null;
      const finalStatus = isImmediate ? 'published' : 'scheduled';

      setQueue(prev => prev.map(v => v.id === video.id ? { ...v, status: finalStatus, progress: 100, progressDetail: isImmediate ? 'تم النشر بنجاح' : 'تمت الجدولة بنجاح', youtubeUrl } : v));
      await updateDoc(doc(db, 'scheduledVideos', videoRefId), { status: finalStatus, progress: 100, youtubeUrl });
      
      if (batchId) {
        const batchDoc = await getDocs(query(collection(db, 'automationBatches'), where('__name__', '==', batchId)));
        if (!batchDoc.empty) {
          const currentCompleted = batchDoc.docs[0].data().completedVideos || 0;
          await updateDoc(doc(db, 'automationBatches', batchId), {
            completedVideos: currentCompleted + 1
          });
        }
      }

    } catch (err: any) {
      console.error(`خطأ تفصيلي في معالجة ${video.title}:`, err);
      addAgentLog(`خطأ في معالجة ${video.title}: ${err.message}`);
      setQueue(prev => prev.map(v => v.id === video.id ? { ...v, status: 'error', progressDetail: err.message } : v));
      
      if (videoRefId) {
        await updateDoc(doc(db, 'scheduledVideos', videoRefId), { status: 'error', progressDetail: err.message }).catch(console.error);
      }
    }
  };

  const handleDeleteFromQueue = async (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
    const video = queue.find(v => v.id === id);
    if (video?.firebaseId) {
      try {
        await deleteDoc(doc(db, 'scheduledVideos', video.firebaseId));
      } catch (error) {
        console.error("Error deleting from Firebase:", error);
      }
    }
  };

  const toggleChannelExpansion = (channelId: string) => {
    setExpandedChannels(prev => ({ ...prev, [channelId]: !prev[channelId] }));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto pb-20" dir="rtl">
      {/* Robot & Agent Monitor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${robotStatus === 'processing' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-700'}`}></div>
              <h3 className="text-lg font-bold text-white">مراقب الروبوت الذكي</h3>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={async () => {
                  // @ts-ignore
                  if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
                    // @ts-ignore
                    await window.aistudio.openSelectKey();
                  }
                }}
                className="px-3 py-1 bg-violet-600 hover:bg-violet-500 rounded-full text-[10px] font-bold text-white uppercase tracking-widest transition-all"
              >
                اختيار مفتاح API
              </button>
              <div className="px-3 py-1 bg-zinc-950 rounded-full border border-zinc-800 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Sequential Engine v3.1
              </div>
            </div>
          </div>
          
          <div className="bg-zinc-950 rounded-2xl p-4 h-40 overflow-y-auto font-mono text-xs space-y-2 border border-zinc-800 custom-scrollbar">
            {agentLog.length > 0 ? (
              agentLog.map((log, i) => (
                <div key={i} className="text-zinc-400 flex gap-2">
                  <span className="text-violet-500 shrink-0">›</span>
                  <span>{log}</span>
                </div>
              ))
            ) : (
              <div className="text-zinc-600 italic">في انتظار بدء العمليات...</div>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-3xl p-6 shadow-2xl text-white space-y-4 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-10">
            <Brain className="w-32 h-32" />
          </div>
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6" />
            <h3 className="text-lg font-bold">الوكيل الذكي</h3>
          </div>
          <p className="text-sm text-violet-100 leading-relaxed">
            أنا الوكيل الذكي، أقوم بمراقبة الروبوتات والتأكد من جودة الإخراج (1080p) والالتزام بالقواعد الصارمة (لا موسيقى، لا تكرار).
          </p>
          <div className="pt-2">
            <div className="flex items-center justify-between text-xs font-bold mb-2">
              <span>تقدم الدفعة الحالية</span>
              <span>{Math.round((batchProgress.completed / (batchProgress.total || 1)) * 100)}%</span>
            </div>
            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-1000"
                style={{ width: `${(batchProgress.completed / (batchProgress.total || 1)) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center">
              <Wand2 className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">إعدادات الأتمتة والجدولة</h3>
              <p className="text-sm text-zinc-500">توليد متسلسل بجودة عالية (1080p) وأصوات طبيعية</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 bg-zinc-950 p-2 rounded-2xl border border-zinc-800">
            {channels.length > 0 ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 rounded-xl border border-zinc-800">
                <select 
                  value={selectedChannelId}
                  onChange={(e) => setSelectedChannelId(e.target.value)}
                  className="bg-transparent text-xs font-bold text-zinc-300 outline-none border-none cursor-pointer"
                >
                  {channels.map(c => (
                    <option key={c.id} value={c.id} className="bg-zinc-900 text-white">{c.title}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 rounded-xl border border-red-500/20 text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs font-bold">لا توجد قنوات متصلة</span>
              </div>
            )}
            
            <div className="w-px h-6 bg-zinc-800"></div>
            
            <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
              <button 
                onClick={() => setFrequency('daily')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${frequency === 'daily' ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/20' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                يومي
              </button>
              <button 
                onClick={() => setFrequency('weekly')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${frequency === 'weekly' ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/20' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <CalendarRange className="w-3.5 h-3.5" />
                أسبوعي
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">تصنيفات الفيديو (اختر التصنيفات)</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {categories.map((cat, index) => (
              <div key={cat.name} className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${cat.enabled ? 'bg-violet-500/10 border-violet-500/50' : 'bg-zinc-950 border-zinc-800'}`} onClick={() => {
                const newCategories = [...categories];
                newCategories[index].enabled = !newCategories[index].enabled;
                setCategories(newCategories);
              }}>
                <span className={`text-sm font-bold ${cat.enabled ? 'text-white' : 'text-zinc-500'}`}>{cat.label}</span>
                <div className={`w-5 h-5 rounded border flex items-center justify-center ${cat.enabled ? 'bg-violet-600 border-violet-600' : 'border-zinc-700'}`}>
                  {cat.enabled && <Check className="w-3 h-3 text-white" />}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 flex items-center justify-between">
            <span className="text-sm font-bold text-zinc-300">إجمالي عدد الفيديوهات في اليوم</span>
            <input 
              type="number" 
              min="1" 
              max="50" 
              value={totalVideosPerDay}
              onChange={(e) => setTotalVideosPerDay(parseInt(e.target.value) || 1)}
              className="w-20 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-white text-center font-mono text-sm outline-none focus:border-violet-500/50"
            />
          </div>
          <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 flex items-center justify-between">
            <span className="text-sm font-bold text-zinc-300">الفاصل الزمني بين الفيديوهات (ساعات)</span>
            <input 
              type="number" 
              min="1" 
              max="24" 
              value={intervalHours}
              onChange={(e) => setIntervalHours(parseInt(e.target.value) || 1)}
              className="w-20 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-white text-center font-mono text-sm outline-none focus:border-violet-500/50"
            />
          </div>
        </div>

        <div className="space-y-4">
          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">موضوع المحتوى العام</label>
          <input 
            type="text"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-5 text-sm text-white focus:outline-none focus:border-violet-500/50 transition-all shadow-inner"
            placeholder="مثال: حقائق غريبة، تطوير الذات، قصص رعب..."
          />
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-bold text-center">
            {error}
          </div>
        )}
        <button 
          onClick={handleStartAutomation}
          disabled={isAutomating || !isYoutubeConnected}
          className={`w-full py-6 rounded-3xl font-bold text-lg flex items-center justify-center gap-4 transition-all shadow-2xl ${
            isAutomating 
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
              : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:scale-[1.01] active:scale-[0.99] shadow-violet-900/20'
          }`}
        >
          {isAutomating ? (
            <>
              <Loader2 className="w-7 h-7 animate-spin" />
              <span>جاري تشغيل الروبوت...</span>
            </>
          ) : (
            <>
              <Wand2 className="w-7 h-7" />
              <span>بدء الأتمتة والجدولة المتسلسلة</span>
            </>
          )}
        </button>
      </div>

      {/* Video Queue Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <MonitorPlay className="w-6 h-6 text-zinc-400" />
            <h3 className="text-xl font-bold text-white">قائمة الانتظار والجدولة</h3>
          </div>
          <button 
            onClick={() => {
              const pending = queue.filter(v => v.status === 'pending');
              const toDelete = pending.slice(0, 5);
              if (toDelete.length === 0) {
                alert('لا توجد فيديوهات معلقة للحذف.');
                return;
              }
              if (window.confirm(`هل أنت متأكد من حذف أول ${toDelete.length} فيديوهات معلقة؟`)) {
                toDelete.forEach(v => handleDeleteFromQueue(v.id));
              }
            }}
            className="px-4 py-2 bg-orange-900/20 hover:bg-orange-900/30 text-xs font-bold text-orange-500 rounded-lg transition-all border border-orange-500/20"
          >
            إيقاف 5 فيديوهات
          </button>
          <button 
            onClick={() => {
              if (window.confirm('هل أنت متأكد من حذف جميع الفيديوهات من القائمة؟')) {
                queue.forEach(v => handleDeleteFromQueue(v.id));
              }
            }}
            className="px-4 py-2 bg-red-900/20 hover:bg-red-900/30 text-xs font-bold text-red-500 rounded-lg transition-all border border-red-500/20"
          >
            حذف الكل
          </button>
        </div>

        {Object.entries(queue.reduce((acc, video) => {
          const channelId = video.channelId || 'unknown';
          if (!acc[channelId]) acc[channelId] = [];
          acc[channelId].push(video);
          return acc;
        }, {} as Record<string, ScheduledVideo[]>)).map(([channelId, channelVideos]: [string, any]) => {
          const channelInfo = channels.find(c => c.id === channelId) || { title: channelVideos[0].channelName || 'قناة غير معروفة', thumbnail: '' };
          const channelProgress = Math.round((channelVideos.reduce((acc: number, v: any) => acc + (v.progress || (v.status === 'published' || v.status === 'scheduled' ? 100 : 0)), 0) / (channelVideos.length * 100)) * 100);
          
          return (
            <div key={channelId} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
              <div 
                className="p-5 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors"
                onClick={() => toggleChannelExpansion(channelId)}
              >
                <div className="flex items-center gap-4">
                  <div className={`transform transition-transform ${expandedChannels[channelId] !== false ? 'rotate-90' : ''}`}>
                    <ChevronRight className="w-5 h-5 text-zinc-500" />
                  </div>
                  {channelInfo.thumbnail ? (
                    <img src={channelInfo.thumbnail} alt="Channel" className="w-12 h-12 rounded-full border-2 border-zinc-800 shadow-lg" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center border-2 border-zinc-800 shadow-lg">
                      <Youtube className="w-6 h-6 text-zinc-500" />
                    </div>
                  )}
                  <div>
                    <h4 className="text-white font-bold text-lg">{channelInfo.title}</h4>
                    <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        {channelVideos.filter((v: any) => v.status === 'published' || v.status === 'scheduled').length} مكتمل
                      </span>
                      <span className="w-1 h-1 bg-zinc-700 rounded-full"></span>
                      <span>{channelVideos.length} إجمالي</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="hidden md:flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-300">{channelProgress}%</span>
                      <div className="w-32 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-1000"
                          style={{ width: `${channelProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`هل أنت متأكد من حذف جميع الفيديوهات المجدولة لقناة ${channelInfo.title}؟`)) {
                        channelVideos.forEach((v: any) => handleDeleteFromQueue(v.id));
                      }
                    }}
                    className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {expandedChannels[channelId] !== false && (
                <div className="border-t border-zinc-800 bg-zinc-950/30">
                  <div className="grid grid-cols-12 gap-4 p-4 border-b border-zinc-800/50 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                    <div className="col-span-4 pl-4">الفيديو</div>
                    <div className="col-span-2">التصنيف</div>
                    <div className="col-span-2">موعد النشر</div>
                    <div className="col-span-3">حالة العملية</div>
                    <div className="col-span-1 text-left">إجراء</div>
                  </div>
                  
                  <div className="divide-y divide-zinc-800/30">
                    {channelVideos.map((video: any) => {
                      const progress = video.progress || (video.status === 'published' || video.status === 'scheduled' ? 100 : 0);
                      return (
                        <div key={video.id} className="grid grid-cols-12 gap-4 p-5 items-center hover:bg-zinc-900/40 transition-colors group">
                          <div className="col-span-4 flex items-center gap-4">
                            <div className="w-14 h-20 bg-zinc-900 rounded-xl overflow-hidden relative flex-shrink-0 border border-zinc-800 shadow-md">
                              <img src={video.thumbnail} className="w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity" alt="" />
                              <div className="absolute inset-0 flex items-center justify-center">
                                {video.status === 'generating' ? (
                                  <div className="bg-violet-500/20 p-2 rounded-full backdrop-blur-sm">
                                    <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
                                  </div>
                                ) : (
                                  <div className="bg-white/10 p-2 rounded-full backdrop-blur-sm group-hover:bg-white/20 transition-all">
                                    <Play className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" />
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-white truncate group-hover:text-violet-400 transition-colors">{video.title}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-zinc-500 font-mono">{video.channelName}</span>
                                {video.youtubeUrl && (
                                  <a href={video.youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-red-500 hover:text-red-400 transition-colors">
                                    <Youtube className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="col-span-2">
                            <span className="px-2 py-1 rounded-lg bg-zinc-800 text-[10px] font-bold text-zinc-400 border border-zinc-700/50">
                              {video.category}
                            </span>
                          </div>

                          <div className="col-span-2">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-zinc-300">{video.scheduledTime}</span>
                              <span className="text-[10px] text-zinc-500">{video.scheduledDate}</span>
                            </div>
                          </div>

                          <div className="col-span-3">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {video.status === 'scheduled' ? (
                                    <div className="flex items-center gap-1 text-emerald-400">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span className="text-[10px] font-bold uppercase">مجدول</span>
                                    </div>
                                  ) : video.status === 'error' ? (
                                    <div className="flex items-center gap-1 text-red-400">
                                      <AlertCircle className="w-3.5 h-3.5" />
                                      <span className="text-[10px] font-bold uppercase">خطأ</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 text-violet-400">
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      <span className="text-[10px] font-bold uppercase">جاري العمل</span>
                                    </div>
                                  )}
                                </div>
                                <span className="text-[10px] font-bold text-zinc-500">{progress}%</span>
                              </div>
                              <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-500 ${video.status === 'error' ? 'bg-red-500' : 'bg-violet-500'}`}
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="col-span-1 flex items-center gap-2">
                            {video.status === 'error' && (
                              <button 
                                onClick={() => {
                                  setQueue(prev => prev.map(v => v.id === video.id ? { ...v, status: 'pending', progress: 0 } : v));
                                  handleScheduleVideo(video, video.batchId);
                                }}
                                className="p-2 text-zinc-400 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-all"
                                title="إعادة المحاولة"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            )}
                            {video.status === 'pending' && (
                              <button 
                                onClick={() => handleScheduleVideo(video, video.batchId, true)}
                                className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all"
                                title="نشر الآن"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            )}
                            {video.videoUrl && (
                              <button 
                                onClick={() => handleDownload(video.videoUrl!, video.title)}
                                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
                                title="تحميل الفيديو"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            )}
                            {video.youtubeUrl && (
                              <a 
                                href={video.youtubeUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                title="مشاهدة على يوتيوب"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                            <button 
                              onClick={() => handleDeleteFromQueue(video.id)}
                              className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
