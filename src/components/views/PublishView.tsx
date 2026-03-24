import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Youtube, Send, CheckCircle2, Wand2, Loader2, Play, Settings, AlertCircle, Link, Brain, Shuffle, Laugh, BookOpen, ChevronRight, Plus, Trash2, Ghost, Zap, CalendarDays, CalendarRange, MonitorPlay } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
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

export function PublishView() {
  const [niche, setNiche] = useState("حقائق نفسية مذهلة");
  const [categories, setCategories] = useState({
    psychological: 2,
    diverse: 2,
    comedy: 2,
    storytelling: 2,
    mystery: 1,
    motivation: 1
  });
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily');
  const [isAutomating, setIsAutomating] = useState(false);
  const [automationStatus, setAutomationStatus] = useState("");
  const [batchProgress, setBatchProgress] = useState({ completed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [isYoutubeConnected, setIsYoutubeConnected] = useState(false);
  const [isConfigSet, setIsConfigSet] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [channels, setChannels] = useState<{ id: string; title: string; thumbnail: string }[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [videosPerDay, setVideosPerDay] = useState<number>(10);
  const [intervalHours, setIntervalHours] = useState<number>(1);
  const [showConfig, setShowConfig] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(false);
  const [isVerifyingToken, setIsVerifyingToken] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [expandedChannels, setExpandedChannels] = useState<Record<string, boolean>>({});
  const [queue, setQueue] = useState<ScheduledVideo[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    // Check initial status
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
            if (verifyData.channels && verifyData.channels.length > 0) {
              setSelectedChannelId(verifyData.channels[0].id);
            }
          }
        }
      } catch (e) {
        console.error("Failed to check YouTube status", e);
      }
    };
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
        
        // Sort by rawTimestamp
        fetchedQueue.sort((a, b) => (a.rawTimestamp || 0) - (b.rawTimestamp || 0));
        
        setQueue(fetchedQueue);
        
        // Auto-resume pending or generating videos
        const pendingVideos = fetchedQueue.filter(v => v.status === 'pending' || v.status === 'generating');
        if (pendingVideos.length > 0 && !isAutomating) {
          setIsAutomating(true);
          setAutomationStatus("جاري استئناف العمليات المعلقة...");
          
          // Process sequentially
          const resumeProcessing = async () => {
            let completedCount = 0;
            for (const video of pendingVideos) {
              await handleScheduleVideo(video, video.batchId);
              completedCount++;
              setBatchProgress({ completed: completedCount, total: pendingVideos.length });
            }
            setIsAutomating(false);
            setAutomationStatus("");
          };
          
          resumeProcessing();
        }
        
      } catch (err) {
        console.error("Error fetching queue:", err);
      }
    };

    fetchQueue();
  }, [auth.currentUser]);

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
      setClientSecret(""); // Clear secret from state for security
      
      // Hide config panel after success delay
      setTimeout(() => {
        setShowConfig(false);
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
            setSelectedChannelId('');
          } else if (selectedChannelId === channelId) {
            setSelectedChannelId(updatedChannels[0]?.id || '');
          }
        } else {
          setIsYoutubeConnected(false);
          setChannels([]);
          setSelectedChannelId('');
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
      
      // Fetch the OAuth URL from our backend
      const response = await fetch('/api/auth/youtube/url');
      if (!response.ok) {
        throw new Error('فشل في الحصول على رابط المصادقة. تأكد من إعدادات Google Cloud.');
      }
      const { url } = await response.json();

      // Open the OAuth provider's URL directly in popup
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

  const handleStartAutomation = async () => {
    const totalVideosPerDay = (Object.values(categories) as number[]).reduce((a, b) => a + b, 0);
    if (totalVideosPerDay !== videosPerDay) {
      setError(`يجب أن يكون إجمالي عدد الفيديوهات الموزعة على التصنيفات ${videosPerDay} بالضبط للبدء.`);
      return;
    }

    if (!isYoutubeConnected || !selectedChannelId) {
      setError("يرجى ربط حساب يوتيوب واختيار القناة أولاً قبل بدء الأتمتة.");
      return;
    }

    try {
      setError(null);
      setIsAutomating(true);
      
      // @ts-ignore
      if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
      }

      // @ts-ignore
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("لم يتم العثور على مفتاح API.");

      const ai = new GoogleGenAI({ apiKey });

      const totalDays = frequency === 'weekly' ? 7 : 1;
      let allGeneratedItems: any[] = [];

      for (let day = 0; day < totalDays; day++) {
        setAutomationStatus(`جاري كتابة نصوص اليوم ${day + 1} من ${totalDays} باستخدام Gemini...`);
        
        const prompt = `أنت خبير في إنشاء محتوى يوتيوب شورتس (YouTube Shorts) سريع الانتشار ومصمم لجذب انتباه المشاهدين بقوة.
المطلوب: توليد ${videosPerDay} أفكار لفيديوهات قصيرة جذابة جداً وموزعة على التصنيفات التالية بالضبط:
- ${categories.psychological} فيديوهات نفسية (Psychological)
- ${categories.diverse} فيديوهات متنوعة (Diverse)
- ${categories.comedy} فيديوهات كوميدية (Comedy)
- ${categories.storytelling} فيديوهات قصصية (Storytelling)
- ${categories.mystery} فيديوهات غموض (Mystery)
- ${categories.motivation} فيديوهات تحفيزية (Motivation)

الموضوع العام: "${niche}".
كل فيديو يجب أن يحتوي على:
1. عنوان جذاب جداً يثير الفضول (title).
2. نص مؤثر يظهر على الشاشة (overlayText) يجب أن يكون من 6 إلى 10 أسطر (طول مناسب للقراءة).
3. وصف باللغة الإنجليزية لمشهد طبيعي ليتم توليده عبر نموذج الذكاء الاصطناعي (veoPrompt).
   **هام جداً بخصوص الصوت والمشهد:** المشهد يجب أن يكون طبيعياً، ويجب أن ينص الوصف الإنجليزي صراحة على استخدام أصوات الطبيعة (Nature sounds, ambient sounds like wind, water, birds) ويمنع منعاً باتاً وجود أي موسيقى (NO MUSIC, strictly nature sounds only).
4. التصنيف (category) باللغة العربية.
5. القالب (template): اختر واحداً من القوالب الاحترافية التالية بخطوط كبيرة وواضحة: "modern" (عصري)، "cinematic" (سينمائي)، أو "bold" (عريض).

قم بإرجاع النتيجة بصيغة JSON Array فقط، بدون أي نص إضافي، بهذا الشكل:
[
  {
    "title": "عنوان الفيديو",
    "overlayText": "السطر الأول\\nالسطر الثاني\\nالسطر الثالث\\nالسطر الرابع\\nالسطر الخامس\\nالسطر السادس",
    "veoPrompt": "Cinematic nature scene... Sound: Nature ambient sounds, wind, birds. NO MUSIC.",
    "category": "نفسية",
    "template": "modern"
  }
]`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          }
        });

        const text = response.text || "[]";
        const generatedItems = JSON.parse(text);
        
        // Add day index to items for scheduling
        const itemsWithDay = generatedItems.map((item: any) => ({ ...item, dayOffset: day }));
        allGeneratedItems = [...allGeneratedItems, ...itemsWithDay];
      }

      setAutomationStatus("جاري حفظ الدفعة في قاعدة البيانات...");
      
      const userId = auth.currentUser?.uid || 'anonymous';
      const selectedChannel = channels.find(c => c.id === selectedChannelId);
      
      // Save batch to Firebase
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

      setAutomationStatus("جاري جدولة الفيديوهات وتجهيز الإخراج النهائي...");

      // Create scheduled items
      const newQueue: ScheduledVideo[] = allGeneratedItems.map((item: any, index: number) => {
        const date = new Date();
        
        // videosPerDay per day. 
        // item.dayOffset is the day (0 to 6).
        // We schedule them at different hours on that day, e.g., starting from 10:00 AM, every intervalHours.
        const videosOnThisDay = index % videosPerDay;
        
        date.setDate(date.getDate() + item.dayOffset + 1); // Start tomorrow
        
        const scheduleDate = new Date(date);
        scheduleDate.setHours(10 + (videosOnThisDay * intervalHours), 0, 0, 0); // 10:00, 10+interval, ...

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
      setAutomationStatus("");
      setIsAutomating(false);
      setBatchProgress({ completed: 0, total: newQueue.length });

      // Automatically start scheduling each video sequentially
      let completedCount = 0;
      for (const video of newQueue) {
        await handleScheduleVideo(video, batchRef.id);
        completedCount++;
        setBatchProgress({ completed: completedCount, total: newQueue.length });
        
        // Update batch progress in Firebase
        await updateDoc(doc(db, 'automationBatches', batchRef.id), {
          completedVideos: completedCount,
          status: completedCount === newQueue.length ? 'completed' : 'running'
        });
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "حدث خطأ أثناء الأتمتة");
      setIsAutomating(false);
    }
  };

  const handleScheduleVideo = async (video: ScheduledVideo, batchId?: string) => {
    if (video.status === 'scheduled' || video.status === 'published') return;
    
    try {
      setQueue(prev => prev.map(v => v.id === video.id ? { ...v, status: 'generating', progress: 10, progressDetail: 'جاري تهيئة الذكاء الاصطناعي...' } : v));
      
      const userId = auth.currentUser?.uid || 'anonymous';
      
      let videoRefId = video.firebaseId;

      if (!videoRefId) {
        // Save initial state to Firebase
        const videoRef = await addDoc(collection(db, 'scheduledVideos'), {
          title: video.title,
          overlayText: video.overlayText,
          veoPrompt: video.veoPrompt,
          category: video.category,
          template: video.template,
          status: 'generating',
          progress: 10,
          progressDetail: 'جاري تهيئة الذكاء الاصطناعي...',
          scheduledDate: video.scheduledDate,
          scheduledTime: video.scheduledTime,
          rawTimestamp: video.rawTimestamp,
          thumbnail: video.thumbnail,
          batchId: batchId || null,
          channelId: video.channelId || null,
          channelName: video.channelName || null,
          userId,
          createdAt: new Date().toISOString()
        });
        videoRefId = videoRef.id;
        // Update local state with firebaseId
        setQueue(prev => prev.map(v => v.id === video.id ? { ...v, firebaseId: videoRefId } : v));
      } else {
        await updateDoc(doc(db, 'scheduledVideos', videoRefId), {
          status: 'generating',
          progress: 10,
          progressDetail: 'جاري تهيئة الذكاء الاصطناعي...'
        });
      }

      // @ts-ignore
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("لم يتم العثور على مفتاح API.");

      const ai = new GoogleGenAI({ apiKey });
      
      setQueue(prev => prev.map(v => v.id === video.id ? { ...v, progress: 30, progressDetail: 'جاري توليد الفيديو (Veo 3.1)...' } : v));
      await updateDoc(doc(db, 'scheduledVideos', videoRefId), { progress: 30, progressDetail: 'جاري توليد الفيديو (Veo 3.1)...' });

      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: video.veoPrompt,
        config: {
          numberOfVideos: 1,
          resolution: '1080p',
          aspectRatio: '9:16'
        }
      });

      // Simulate progress while generating
      let simulatedProgress = 30;
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        simulatedProgress = Math.min(simulatedProgress + 5, 75);
        setQueue(prev => prev.map(v => v.id === video.id ? { ...v, progress: simulatedProgress } : v));
        operation = await ai.operations.getVideosOperation({operation: operation});
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      
      if (!downloadLink) {
        throw new Error("فشل في الحصول على رابط الفيديو المولد");
      }

      setQueue(prev => prev.map(v => v.id === video.id ? { ...v, status: 'scheduled', progress: 80, progressDetail: 'جاري الرفع والجدولة على يوتيوب...' } : v));
      await updateDoc(doc(db, 'scheduledVideos', videoRefId), { status: 'scheduled', videoUrl: downloadLink, progress: 80, progressDetail: 'جاري الرفع والجدولة على يوتيوب...' });

      // Call backend to schedule on YouTube
      const res = await fetch('/api/youtube/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: downloadLink,
          title: video.title,
          description: video.overlayText,
          scheduledTime: video.rawTimestamp,
          channelId: video.channelId
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "فشل في الجدولة على يوتيوب");
      }

      const responseData = await res.json();
      const youtubeUrl = responseData.youtubeUrl || null;

      setQueue(prev => prev.map(v => v.id === video.id ? { ...v, status: 'scheduled', progress: 100, progressDetail: 'تمت الجدولة بنجاح', youtubeUrl } : v));
      await updateDoc(doc(db, 'scheduledVideos', videoRefId), { status: 'scheduled', progress: 100, progressDetail: 'تمت الجدولة بنجاح', youtubeUrl });
      setBatchProgress(prev => ({ ...prev, completed: prev.completed + 1 }));

    } catch (err: any) {
      console.error(`Failed to schedule video ${video.id}:`, err);
      setQueue(prev => prev.map(v => v.id === video.id ? { ...v, status: 'error', progress: 0, progressDetail: err.message || 'حدث خطأ' } : v));
      
      // Try to update error status in Firebase if we have the ID
      const firebaseId = queue.find(v => v.id === video.id)?.firebaseId || video.firebaseId;
      if (firebaseId) {
        try {
          await updateDoc(doc(db, 'scheduledVideos', firebaseId), { status: 'error', progress: 0, progressDetail: err.message || 'حدث خطأ' });
        } catch (e) {
          console.error("Failed to update error status in Firebase", e);
        }
      }
    }
  };

  const handleDeleteFromQueue = async (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
    // Also delete from Firebase if it has a firebaseId
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
    setExpandedChannels(prev => ({
      ...prev,
      [channelId]: !prev[channelId]
    }));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto pb-20" dir="rtl">
      {/* Batch Scheduling & Categorization Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center">
              <Wand2 className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">مصنع المحتوى والجدولة</h3>
              <p className="text-sm text-zinc-500">توليد فيديوهات بأصوات طبيعية بدون موسيقى</p>
            </div>
          </div>
          
          {/* Channel & Frequency Settings */}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 flex items-center justify-between">
            <span className="text-sm font-bold text-zinc-300">عدد الفيديوهات في اليوم</span>
            <input 
              type="number" 
              min="1" 
              max="50" 
              value={videosPerDay}
              onChange={(e) => setVideosPerDay(parseInt(e.target.value) || 1)}
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

        <div className="flex items-center justify-between bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
          <span className="text-sm font-bold text-zinc-300">توزيع التصنيفات ({videosPerDay} فيديوهات)</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">الإجمالي:</span>
            <span className={`text-sm font-bold ${(Object.values(categories) as number[]).reduce((a, b) => a + b, 0) === videosPerDay ? 'text-emerald-400' : 'text-red-400'}`}>
              {(Object.values(categories) as number[]).reduce((a, b) => a + b, 0)} / {videosPerDay}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-800 space-y-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Brain className="w-8 h-8 text-violet-500" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-violet-400" />
                <span className="text-xs font-bold text-zinc-300">نفسية</span>
              </div>
              <span className="text-xs font-mono text-violet-400">{categories.psychological}</span>
            </div>
            <input 
              type="range" min="0" max={videosPerDay} 
              value={categories.psychological}
              onChange={(e) => setCategories({...categories, psychological: parseInt(e.target.value)})}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
            />
          </div>

          <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-800 space-y-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Shuffle className="w-8 h-8 text-blue-500" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shuffle className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-zinc-300">متنوعة</span>
              </div>
              <span className="text-xs font-mono text-blue-400">{categories.diverse}</span>
            </div>
            <input 
              type="range" min="0" max={videosPerDay} 
              value={categories.diverse}
              onChange={(e) => setCategories({...categories, diverse: parseInt(e.target.value)})}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-800 space-y-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Laugh className="w-8 h-8 text-emerald-500" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Laugh className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-zinc-300">كوميدية</span>
              </div>
              <span className="text-xs font-mono text-emerald-400">{categories.comedy}</span>
            </div>
            <input 
              type="range" min="0" max={videosPerDay} 
              value={categories.comedy}
              onChange={(e) => setCategories({...categories, comedy: parseInt(e.target.value)})}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-800 space-y-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <BookOpen className="w-8 h-8 text-amber-500" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-zinc-300">قصصية</span>
              </div>
              <span className="text-xs font-mono text-amber-400">{categories.storytelling}</span>
            </div>
            <input 
              type="range" min="0" max={videosPerDay} 
              value={categories.storytelling}
              onChange={(e) => setCategories({...categories, storytelling: parseInt(e.target.value)})}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-800 space-y-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Ghost className="w-8 h-8 text-indigo-500" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ghost className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-zinc-300">غموض ورعب</span>
              </div>
              <span className="text-xs font-mono text-indigo-400">{categories.mystery}</span>
            </div>
            <input 
              type="range" min="0" max={videosPerDay} 
              value={categories.mystery}
              onChange={(e) => setCategories({...categories, mystery: parseInt(e.target.value)})}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-800 space-y-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Zap className="w-8 h-8 text-orange-500" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-bold text-zinc-300">تحفيز وتطوير</span>
              </div>
              <span className="text-xs font-mono text-orange-400">{categories.motivation}</span>
            </div>
            <input 
              type="range" min="0" max={videosPerDay} 
              value={categories.motivation}
              onChange={(e) => setCategories({...categories, motivation: parseInt(e.target.value)})}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">موضوع المحتوى العام</label>
              <input 
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-violet-500/50 transition-all"
                placeholder="مثال: حقائق غريبة، تطوير الذات، قصص رعب..."
              />
            </div>
            <button 
              onClick={handleStartAutomation}
              disabled={isAutomating || !isYoutubeConnected}
              className="mt-6 px-8 py-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-3 transition-all shadow-lg shadow-violet-900/20"
            >
              {isAutomating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
              توليد وجدولة الفيديوهات
            </button>
          </div>
          {automationStatus && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 text-violet-400 text-sm animate-pulse bg-violet-500/5 p-3 rounded-xl border border-violet-500/20">
                <Loader2 className="w-4 h-4 animate-spin" />
                {automationStatus}
              </div>
              
              {batchProgress.total > 0 && (
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-zinc-400">
                    <span>تقدم الإنشاء والجدولة</span>
                    <span className="text-violet-400">{batchProgress.completed} / {batchProgress.total} فيديوهات</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-violet-500 transition-all duration-500 ease-out"
                      style={{ width: `${(batchProgress.completed / batchProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-500 text-center">
                    يرجى عدم إغلاق هذه الصفحة حتى تكتمل العملية
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Channel Operations Table */}
      {queue.length > 0 && (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <MonitorPlay className="w-5 h-5 text-violet-400" />
              عمليات القنوات
            </h3>
            <div className="flex gap-3">
              <button 
                onClick={() => queue.filter(v => v.status === 'pending').forEach(v => handleScheduleVideo(v))}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white rounded-lg transition-all border border-zinc-700"
              >
                إعادة جدولة الكل
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
                {/* Channel Row (Accordion Header) */}
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
                  
                  <div className="flex items-center gap-6 w-1/3">
                    <div className="flex-1">
                      <div className="flex justify-between text-[10px] mb-1.5">
                        <span className="text-zinc-500 font-bold uppercase tracking-wider">التقدم الإجمالي للقناة</span>
                        <span className="text-violet-400 font-bold font-mono">{channelProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                        <div 
                          className="h-full bg-gradient-to-l from-violet-500 to-fuchsia-500 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(139,92,246,0.3)]"
                          style={{ width: `${channelProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Videos Table (Accordion Content) */}
                {expandedChannels[channelId] !== false && (
                  <div className="border-t border-zinc-800 bg-zinc-950/30">
                    <div className="grid grid-cols-12 gap-4 p-4 border-b border-zinc-800/50 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      <div className="col-span-4 pl-4">الفيديو</div>
                      <div className="col-span-2">التصنيف والقالب</div>
                      <div className="col-span-2">موعد النشر</div>
                      <div className="col-span-3">حالة العملية</div>
                      <div className="col-span-1 text-left">إجراء</div>
                    </div>
                    
                    <div className="divide-y divide-zinc-800/30">
                      {channelVideos.map((video: any) => {
                        const progress = video.progress || (video.status === 'published' || video.status === 'scheduled' ? 100 : 0);
                        return (
                          <div key={video.id} className="grid grid-cols-12 gap-4 p-5 items-center hover:bg-zinc-900/40 transition-colors group">
                            {/* Video Info */}
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
                                <h4 className="text-sm text-white font-bold truncate mb-1" title={video.title}>{video.title}</h4>
                                <p className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed" title={video.overlayText}>{video.overlayText}</p>
                              </div>
                            </div>

                            {/* Category & Template */}
                            <div className="col-span-2 flex flex-col gap-2 justify-center">
                              <span className={`w-fit px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 border ${
                                video.category === 'نفسية' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' :
                                video.category === 'متنوعة' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                video.category === 'كوميدية' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                video.category === 'قصصية' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                video.category === 'غموض' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                                video.category === 'تحفيز' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                'bg-zinc-800 text-zinc-400 border-zinc-700'
                              }`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${
                                  video.category === 'نفسية' ? 'bg-violet-400' :
                                  video.category === 'متنوعة' ? 'bg-blue-400' :
                                  video.category === 'كوميدية' ? 'bg-emerald-400' :
                                  video.category === 'قصصية' ? 'bg-amber-400' :
                                  video.category === 'غموض' ? 'bg-indigo-400' :
                                  video.category === 'تحفيز' ? 'bg-orange-400' :
                                  'bg-zinc-500'
                                }`} />
                                {video.category}
                              </span>
                              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-medium">
                                <Settings className="w-3 h-3" />
                                <span className="uppercase tracking-widest opacity-80">{video.template}</span>
                              </div>
                            </div>

                            {/* Schedule Time */}
                            <div className="col-span-2 flex flex-col gap-2 justify-center text-[10px] text-zinc-400">
                              <div className="flex items-center gap-2 bg-zinc-900/50 w-fit px-2 py-1 rounded-md border border-zinc-800/50">
                                <CalendarIcon className="w-3 h-3 text-zinc-500" />
                                {video.scheduledDate}
                              </div>
                              <div className="flex items-center gap-2 bg-zinc-900/50 w-fit px-2 py-1 rounded-md border border-zinc-800/50">
                                <Clock className="w-3 h-3 text-zinc-500" />
                                {video.scheduledTime}
                              </div>
                            </div>

                            {/* Progress */}
                            <div className="col-span-3 flex flex-col justify-center gap-2">
                              <div className="flex items-center justify-between text-[10px]">
                                <div className={`font-bold flex items-center gap-1.5 ${
                                  video.status === 'scheduled' ? 'text-emerald-400' :
                                  video.status === 'published' ? 'text-blue-400' :
                                  video.status === 'generating' ? 'text-violet-400' :
                                  video.status === 'error' ? 'text-red-400' :
                                  'text-zinc-500'
                                }`}>
                                  {video.status === 'generating' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 
                                   video.status === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> :
                                   video.status === 'pending' ? <Clock className="w-3.5 h-3.5" /> :
                                   <CheckCircle2 className="w-3.5 h-3.5" />}
                                  {video.status === 'scheduled' ? 'مجدول' : 
                                   video.status === 'published' ? 'تم النشر' :
                                   video.status === 'generating' ? 'جاري العمل...' : 
                                   video.status === 'error' ? 'خطأ' :
                                   'في الانتظار'}
                                </div>
                                <span className="text-zinc-400 font-mono font-bold">{progress}%</span>
                              </div>
                              <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden relative border border-zinc-800">
                                <div 
                                  className={`absolute top-0 right-0 h-full transition-all duration-700 ease-out ${
                                    video.status === 'error' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]' :
                                    video.status === 'scheduled' || video.status === 'published' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' :
                                    'bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.3)]'
                                  }`}
                                  style={{ width: `${progress}%` }}
                                />
                                {video.status === 'generating' && (
                                  <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%,transparent_100%)] bg-[length:30px_30px] animate-[shimmer_1.5s_linear_infinite]" />
                                )}
                              </div>
                              <p className="text-[9px] text-zinc-500 line-clamp-1 italic opacity-80" title={video.progressDetail || ''}>
                                {video.progressDetail || (video.status === 'pending' ? 'في انتظار البدء' : '')}
                              </p>
                            </div>

                            {/* Actions */}
                            <div className="col-span-1 flex items-center justify-end gap-1.5">
                              {video.youtubeUrl && (
                                <a 
                                  href={video.youtubeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20"
                                  title="عرض على يوتيوب"
                                >
                                  <Youtube className="w-4 h-4" />
                                </a>
                              )}
                              <button 
                                onClick={() => handleDeleteFromQueue(video.id)}
                                className="p-2.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20"
                                title="حذف"
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
      )}

      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
            <Settings className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">OAuth 2.0 Configuration</h2>
            <p className="text-xs text-zinc-500">إعدادات الاتصال بـ Google Cloud Console</p>
          </div>
        </div>
      </div>

      {/* Instructions Card */}
      <div className="bg-[#0a192f] border border-blue-500/20 rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4">
          <AlertCircle className="w-6 h-6 text-blue-500/40" />
        </div>
        <h3 className="text-blue-400 font-bold mb-6 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          خطوات الإعداد في Google Cloud Console:
        </h3>
        <ol className="space-y-3 text-sm text-zinc-300 list-decimal list-inside pr-4">
          <li>افتح <a href="https://console.cloud.google.com" target="_blank" className="text-blue-400 hover:underline">Google Cloud Console</a></li>
          <li>أنشئ مشروعاً جديداً أو اختر مشروعاً موجوداً</li>
          <li>فعّل <span className="bg-zinc-800 px-2 py-0.5 rounded text-zinc-100 font-mono text-xs">YouTube Data API v3</span></li>
          <li>انتقل إلى Credentials → Create OAuth 2.0 Client ID</li>
          <li>اختر نوع التطبيق: <span className="font-bold text-white">Web Application</span></li>
          <li>أضف Redirect URI: <span className="bg-zinc-800 px-2 py-0.5 rounded text-emerald-400 font-mono text-xs break-all">{window.location.origin}/api/auth/youtube/callback</span></li>
          <li>انسخ Client Secret و Client ID وضعهما أدناه</li>
        </ol>
      </div>

      {/* Config Form */}
      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-8">
          <div className="space-y-3">
            <label className="text-sm font-bold text-zinc-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-red-500 font-bold">*</span> Google Client ID
              </div>
              <Link className="w-4 h-4 text-zinc-500" />
            </label>
            <input 
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full bg-[#050a14] border border-zinc-800 rounded-xl p-5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all font-mono text-center"
              placeholder="أدخل Client ID هنا..."
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-bold text-zinc-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-red-500 font-bold">*</span> Google Client Secret
              </div>
              <Settings className="w-4 h-4 text-zinc-500" />
            </label>
            <input 
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              className="w-full bg-[#050a14] border border-zinc-800 rounded-xl p-5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all font-mono text-center"
              placeholder="••••••••••••••••••••••••••••••"
            />
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="text-[10px] text-zinc-600 uppercase tracking-widest">Video Factory</div>
          <h3 className="text-xl font-bold text-white">ربط يوتيوب</h3>
          <div className="w-full h-px bg-zinc-800"></div>
          
          <button 
            onClick={handleSaveConfig}
            disabled={isSavingConfig || !clientId || !clientSecret}
            className={`w-full py-5 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl ${
              configSuccess 
                ? 'bg-emerald-600 text-white shadow-emerald-900/20' 
                : 'bg-[#1a1f2e] hover:bg-[#252b3d] text-zinc-300 border border-zinc-700/50'
            }`}
          >
            {isSavingConfig ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
            <span>{isSavingConfig ? 'جاري الحفظ والتحقق...' : configSuccess ? 'تم حفظ الإعدادات بنجاح' : 'حفظ الإعدادات'}</span>
          </button>
        </div>
      </div>

      {/* Token Status Section */}
      <div className="bg-[#050a14]/50 border border-zinc-800/50 rounded-3xl p-10 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-white">حالة التوكن (Auto-Publish)</h3>
            <p className="text-xs text-zinc-500 mt-2">يتم حفظ التوكن تلقائياً بعد الربط. يمكنك مزامنته يدوياً هنا إذا لزم الأمر.</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <div className={`px-4 py-2 rounded-lg text-[11px] font-bold flex items-center gap-2 border ${isYoutubeConnected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-zinc-800/50 text-zinc-500 border-zinc-700/50'}`}>
              {isYoutubeConnected && <CheckCircle2 className="w-3.5 h-3.5" />}
              حالة التوكن على السيرفر: {isYoutubeConnected ? 'محفوظ' : 'غير متوفر'}
              {isYoutubeConnected && <CheckCircle2 className="w-3.5 h-3.5" />}
            </div>
            <div className={`px-4 py-2 rounded-lg text-[11px] font-bold flex items-center gap-2 border ${isYoutubeConnected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-zinc-800/50 text-zinc-500 border-zinc-700/50'}`}>
              {isYoutubeConnected && <CheckCircle2 className="w-3.5 h-3.5" />}
              Refresh Token: {isYoutubeConnected ? 'موجود' : 'غير متوفر'}
              {isYoutubeConnected && <CheckCircle2 className="w-3.5 h-3.5" />}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {channels.length > 0 && (
            <div className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center gap-2">
              <Youtube className="w-4 h-4" />
              قنوات السيرفر: {channels.length}
            </div>
          )}
          <button 
            onClick={handleVerifyToken}
            disabled={!isYoutubeConnected || isVerifyingToken}
            className="px-6 py-2.5 bg-[#1a1f2e] hover:bg-[#252b3d] text-zinc-300 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 border border-zinc-700/30"
          >
            مزامنة التوكن الآن
          </button>
        </div>

        {channels.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {channels.map(channel => (
              <div key={channel.id} className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <img src={channel.thumbnail} alt="" className="w-10 h-10 rounded-full border border-zinc-800" />
                  <div>
                    <h4 className="text-sm font-bold text-white truncate max-w-[120px]">{channel.title}</h4>
                    <p className="text-[10px] text-zinc-500">متصل</p>
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
        )}

        <div className="flex justify-end">
          <button 
            onClick={() => handleDisconnect()}
            className="px-8 py-3 bg-red-900/20 hover:bg-red-900/30 text-red-500 rounded-xl text-xs font-bold transition-all border border-red-500/20"
          >
            فصل جميع القنوات
          </button>
        </div>
        
        {!isYoutubeConnected && (
          <p className="text-[10px] text-zinc-600 text-center">لم يتم العثور على توكن محلي من جلسة الربط السابقة.</p>
        )}
      </div>

      {/* Start Linking Section */}
      <div className="bg-[#050a14]/30 border border-zinc-800/50 rounded-3xl p-10 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
            <Youtube className="w-8 h-8 text-red-500" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white flex items-center gap-3">
              ربط قناة يوتيوب جديدة
              <Send className="w-6 h-6 text-red-500 rotate-12" />
            </h3>
            <p className="text-zinc-400 mt-2">سيتم توجيهك إلى Google لاختيار الحساب ومنح الصلاحيات المطلوبة</p>
          </div>
        </div>
        
        <div className="flex flex-col gap-4 w-full md:w-auto">
          <button 
            onClick={handleConnectYoutube}
            disabled={isConnecting || !isConfigSet}
            className="px-12 py-5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-2xl font-bold flex items-center justify-center gap-4 transition-all shadow-2xl shadow-red-900/40 text-lg"
          >
            {isConnecting ? <Loader2 className="w-7 h-7 animate-spin" /> : <Youtube className="w-7 h-7 fill-white" />}
            <span>بدء الربط الآن</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-8 py-5 rounded-3xl flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-500">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-8 py-5 rounded-3xl flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-500">
          <CheckCircle2 className="w-6 h-6 shrink-0" />
          <p className="text-sm font-medium">{successMessage}</p>
        </div>
      )}
    </div>
  );
}
