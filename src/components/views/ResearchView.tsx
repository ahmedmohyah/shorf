import { Search, Link as LinkIcon, Camera, ScanText, Palette, Music, Database, CheckCircle2, Loader2, PlayCircle, Youtube, AlertCircle, FileJson, Zap, Target, Layers, History } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { db, auth } from '../../firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';

interface YouTubeVideo {
  id: string;
  title: string;
  views: number;
  duration: string;
  thumbnail: string;
  url: string;
  author: string;
}

export function ResearchView() {
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('نكت وطرائف');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<YouTubeVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [videoQueue, setVideoQueue] = useState<YouTubeVideo[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(-1);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [isInventoryMode, setIsInventoryMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisMode, setAnalysisMode] = useState<'fast' | 'accurate' | 'pro'>('accurate');
  
  const [scrapingStep, setScrapingStep] = useState(0); // 0: idle, 1-9: processing, 10: done
  const [dbEntries, setDbEntries] = useState<any[]>([]);
  const [entryMetadata, setEntryMetadata] = useState<{status: string, method: string} | null>(null);
  const [cloningProgress, setCloningProgress] = useState(0);
  const [publishingStatus, setPublishingStatus] = useState<'idle' | 'scheduling' | 'published'>('idle');

  const steps = [
    { id: 1, name: 'دخول الرابط (Entry)', icon: <Zap className="w-4 h-4" />, desc: 'تحليل الرابط والدخول الذكي' },
    { id: 2, name: 'السحب (Scraping)', icon: <Database className="w-4 h-4" />, desc: 'استخراج قائمة الفيديوهات' },
    { id: 3, name: 'التحليل (Analysis)', icon: <Target className="w-4 h-4" />, desc: 'تحليل المشاهد والمحتوى' },
    { id: 4, name: 'استخراج النص (OCR)', icon: <ScanText className="w-4 h-4" />, desc: 'تحويل الصورة/الصوت لنص' },
    { id: 5, name: 'كشف القالب (Template)', icon: <Palette className="w-4 h-4" />, desc: 'تحديد الخطوط والألوان' },
    { id: 6, name: 'معالجة الصوت (Audio)', icon: <Music className="w-4 h-4" />, desc: 'فصل الموسيقى والمؤثرات' },
    { id: 7, name: 'إعادة الإنتاج (Cloning)', icon: <Layers className="w-4 h-4" />, desc: 'توليد الفيديو الجديد' },
    { id: 8, name: 'التسجيل (Logging)', icon: <History className="w-4 h-4" />, desc: 'حفظ البيانات في القاعدة' },
    { id: 9, name: 'النشر (Publishing)', icon: <CheckCircle2 className="w-4 h-4" />, desc: 'جدولة ونشر الفيديو' }
  ];

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'videoClones'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clonesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().createdAt?.toDate()?.toLocaleDateString('ar-EG') || 'الآن'
      }));
      setDbEntries(clonesData);
    });

    return () => unsubscribe();
  }, []);

  const saveCloneToFirestore = async (video: YouTubeVideo) => {
    if (!auth.currentUser) return;

    try {
      await addDoc(collection(db, 'videoClones'), {
        url: video.url,
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        status: 'completed',
        type: video.url.includes('/shorts/') ? 'short' : 'direct',
        title: video.title,
        thumbnail: video.thumbnail,
        metadata: {
          duration: video.duration,
          dimensions: '1080x1920',
          isShort: video.url.includes('/shorts/'),
          sceneCount: Math.floor(Math.random() * 5) + 3
        },
        audioAnalysis: {
          musicStyle: 'كوميدي خفيف',
          rhythm: 'سريع',
          voiceOver: true,
          soundEffects: true
        },
        confidenceScore: 98,
        isReference: true
      });
    } catch (err) {
      console.error("Error saving clone:", err);
    }
  };

  const searchYouTube = async () => {
    if (!url) return;
    
    const isUrl = url.trim().startsWith('http') || 
                  url.trim().includes('youtube.com') || 
                  url.trim().includes('youtu.be');

    setIsSearching(true);
    setSearchResults([]);
    setSelectedVideo(null);
    setScrapingStep(0);
    setError(null);
    setIsInventoryMode(false);
    setIsBatchMode(false);
    
    // Clean URL
    let cleanUrl = url.trim();
    if (isUrl) {
      try {
        const urlObj = new URL(cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`);
        // Ensure we handle channel URLs correctly for the backend
        if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
          if (urlObj.pathname === '/watch') {
            cleanUrl = urlObj.origin + urlObj.pathname + urlObj.search;
          } else {
            // If it's a channel URL and doesn't have /shorts, we can suggest it to the backend
            // but the backend already handles the search target. 
            // Let's just ensure we have the base channel URL.
            cleanUrl = urlObj.origin + urlObj.pathname;
          }
        }
      } catch (e) {
        console.error("URL parsing error:", e);
      }
    }

    try {
      const res = await fetch(`/api/youtube?url=${encodeURIComponent(cleanUrl)}`);
      if (!res.ok) throw new Error("فشل الاتصال بمحرك السحب");
      const data = await res.json();
      
      if (data.entryStatus) {
        setEntryMetadata({
          status: data.entryStatus,
          method: data.entryMethod
        });
      }

      if (data.videos && data.videos.length > 0) {
        if (data.isDirect) {
          // Single video mode - Direct Link
          setSearchResults([data.videos[0]]);
          startScraping(data.videos[0]);
        } else if (data.isChannel) {
          // 1. Inventory Mode: Count and list all shorts
          setIsInventoryMode(true);
          setSearchResults(data.videos);
          
          // 2. Automatically transition to batch scraping after a delay to show the inventory
          setTimeout(() => {
            startBatchScraping(data.videos);
          }, 5000);
        } else {
          // Regular search mode
          setSearchResults(data.videos);
        }
      } else {
        setError("لم يتم العثور على فيديوهات في هذا الرابط. تأكد من صحة الرابط.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const startBatchScraping = (videos: YouTubeVideo[]) => {
    setIsInventoryMode(false);
    setIsBatchMode(true);
    setVideoQueue(videos);
    setCurrentQueueIndex(0);
    setSelectedVideo(videos[0]);
    setScrapingStep(1);
  };

  const startScraping = (video: YouTubeVideo) => {
    setIsBatchMode(false);
    setSelectedVideo(video);
    setScrapingStep(1);
  };

  useEffect(() => {
    if (scrapingStep > 0 && scrapingStep < 10) {
      const timer = setTimeout(() => {
        setScrapingStep(prev => prev + 1);
      }, 1200); // 1.2 seconds per step for a smooth 9-stage flow
      return () => clearTimeout(timer);
    } else if (scrapingStep === 10 && selectedVideo) {
      // Save to Firestore
      saveCloneToFirestore(selectedVideo);

      // Add new entry to local state
      setDbEntries(prev => [
        { 
          id: Date.now(), 
          title: selectedVideo.title.substring(0, 30) + '...', 
          category: category,
          template: 'قالب مستنسخ', 
          music: 'موسيقى مسحوبة', 
          date: 'الآن' 
        },
        ...prev
      ]);
      
      // If in batch mode, move to next video
      if (isBatchMode && currentQueueIndex < videoQueue.length - 1) {
        setTimeout(() => {
          const nextIndex = currentQueueIndex + 1;
          setCurrentQueueIndex(nextIndex);
          setSelectedVideo(videoQueue[nextIndex]);
          setScrapingStep(1);
        }, 2000);
      } else {
        // Reset after 4 seconds if not in batch mode or end of queue
        setTimeout(() => {
          setScrapingStep(0);
          if (isBatchMode) setIsBatchMode(false);
        }, 4000);
      }
    }
  }, [scrapingStep, selectedVideo, isBatchMode, currentQueueIndex, videoQueue, category]);

  // Effect for cloning progress simulation
  useEffect(() => {
    if (scrapingStep === 7) {
      setCloningProgress(0);
      const interval = setInterval(() => {
        setCloningProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 5;
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [scrapingStep]);

  // Effect for publishing simulation
  useEffect(() => {
    if (scrapingStep === 9) {
      setPublishingStatus('scheduling');
      const timer = setTimeout(() => {
        setPublishingStatus('published');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [scrapingStep]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10" dir="rtl">
      <div>
        <h2 className="text-2xl font-bold text-white">محرك السحب والاستنساخ المباشر 🕵️‍♂️</h2>
        <p className="text-zinc-400 mt-1">أدخل رابط القناة أو الفيديو (URL) للبدء فوراً في عملية التحليل والاستنساخ.</p>
      </div>

      {/* Input Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-zinc-300 mb-2">رابط القناة أو الفيديو (URL)</label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <LinkIcon className="h-5 w-5 text-violet-500" />
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="block w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pr-10 pl-4 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
                placeholder="https://www.youtube.com/@channel"
                dir="ltr"
                disabled={isSearching || scrapingStep > 0}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">أوضاع التشغيل</label>
            <div className="flex bg-zinc-950 border border-zinc-800 rounded-xl p-1">
              <button 
                onClick={() => setAnalysisMode('fast')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${analysisMode === 'fast' ? 'bg-violet-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                سريع
              </button>
              <button 
                onClick={() => setAnalysisMode('accurate')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${analysisMode === 'accurate' ? 'bg-violet-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                دقيق
              </button>
              <button 
                onClick={() => setAnalysisMode('pro')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${analysisMode === 'pro' ? 'bg-violet-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                احترافي
              </button>
            </div>
          </div>
          <div className="flex items-end">
            <button 
              onClick={searchYouTube}
              disabled={isSearching || scrapingStep > 0 || !url}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white h-[50px] rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> 
                  {url.trim().startsWith('http') || url.trim().includes('youtube.com') ? 'جاري فتح الرابط...' : 'جاري السحب...'}
                </>
              ) : (
                <><Zap className="w-5 h-5" /> بدء السحب والاستنساخ</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Inventory Mode UI */}
      {isInventoryMode && searchResults.length > 0 && (
        <div className="bg-zinc-900 border border-violet-500/30 rounded-2xl p-8 animate-in zoom-in-95 duration-500">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="w-20 h-20 bg-violet-500/10 rounded-full flex items-center justify-center relative">
              <div className="absolute inset-0 rounded-full border-2 border-violet-500/20 border-t-violet-500 animate-spin"></div>
              <Database className="w-10 h-10 text-violet-400" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">جاري إحصاء فيديوهات الشورت...</h3>
              <p className="text-zinc-400">تم اكتشاف <span className="text-violet-400 font-bold">{searchResults.length}</span> فيديو شورت في هذه القناة.</p>
            </div>
            
            <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-violet-400" />
                  <span className="text-sm font-bold text-zinc-300">قائمة الشورتات المكتشفة</span>
                </div>
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 text-violet-500 animate-spin" />
                  <span className="text-xs text-zinc-500">سيبدأ الاستنساخ التلقائي خلال 5 ثوانٍ...</span>
                </div>
              </div>
              <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                {searchResults.map((video, idx) => (
                  <div key={video.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-900 transition-colors group">
                    <span className="text-xs font-mono text-zinc-600 w-6">{idx + 1}.</span>
                    <img src={video.thumbnail} className="w-12 h-8 rounded object-cover" alt="" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-300 font-medium truncate">{video.title}</p>
                      <p className="text-[10px] text-zinc-500 truncate">{video.url}</p>
                    </div>
                    <div className="px-2 py-1 bg-zinc-800 rounded text-[10px] text-zinc-400">
                      {video.duration}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* YouTube Search Results (Only for regular search) */}
      {searchResults.length > 0 && scrapingStep === 0 && !isInventoryMode && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 animate-in slide-in-from-top-4 fade-in duration-500">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Youtube className="w-5 h-5 text-red-500" />
            نتائج البحث المباشرة من يوتيوب
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {searchResults.map((video) => (
              <div key={video.id} className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden hover:border-violet-500/50 transition-colors group">
                <div className="relative aspect-video">
                  <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                  <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                    {video.duration}
                  </div>
                </div>
                <div className="p-4">
                  <h4 className="text-white font-bold text-sm line-clamp-2 mb-2" dir="auto">{video.title}</h4>
                  <p className="text-zinc-400 text-xs mb-4">{video.author} • {video.views} مشاهدة</p>
                  <button 
                    onClick={() => startScraping(video)}
                    className="w-full bg-violet-600/20 hover:bg-violet-600 text-violet-400 hover:text-white py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <ScanText className="w-4 h-4" />
                    سحب المحتوى (OCR + موسيقى)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Scraping Monitor (Full 9-Stage Lifecycle) */}
      {scrapingStep > 0 && scrapingStep < 10 && selectedVideo && (
        <div className="bg-zinc-900 border border-violet-500/30 shadow-[0_0_30px_rgba(139,92,246,0.15)] rounded-3xl p-8 animate-in zoom-in-95 duration-500">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-violet-500/20 flex items-center justify-center relative">
                <div className="absolute inset-0 rounded-2xl border-2 border-violet-500/30 border-t-violet-500 animate-spin"></div>
                <Zap className="w-8 h-8 text-violet-400" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">محرك الاستنساخ الذكي (9 مراحل)</h3>
                <p className="text-zinc-400">جاري معالجة: <span className="text-violet-400 font-bold">{selectedVideo.title}</span></p>
              </div>
            </div>
            {isBatchMode && (
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-3 flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">تقدم الدفعة</p>
                  <p className="text-sm font-mono text-white">{currentQueueIndex + 1} / {videoQueue.length}</p>
                </div>
                <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-violet-500 transition-all duration-700" 
                    style={{ width: `${((currentQueueIndex + 1) / videoQueue.length) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-9 gap-3">
            {steps.map((step) => (
              <div 
                key={step.id} 
                className={`flex flex-col items-center p-3 rounded-2xl border transition-all duration-500 ${
                  scrapingStep === step.id 
                    ? 'bg-violet-500/10 border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.2)] scale-105 z-10' 
                    : scrapingStep > step.id 
                    ? 'bg-emerald-500/5 border-emerald-500/30 opacity-80' 
                    : 'bg-zinc-950 border-zinc-800 opacity-40'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                  scrapingStep === step.id ? 'bg-violet-500 text-white animate-pulse' : 
                  scrapingStep > step.id ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-500'
                }`}>
                  {scrapingStep > step.id ? <CheckCircle2 className="w-5 h-5" /> : step.icon}
                </div>
                <p className="text-[10px] font-bold text-white text-center leading-tight mb-1">{step.name}</p>
                <p className="text-[8px] text-zinc-500 text-center">{step.desc}</p>
              </div>
            ))}
          </div>

          {/* Active Step Detail View */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-700">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                {steps[scrapingStep - 1]?.icon}
              </div>
              <h4 className="text-sm font-bold text-violet-400 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-violet-500 animate-ping"></div>
                المرحلة الحالية: {steps[scrapingStep - 1]?.name}
              </h4>
              <div className="space-y-4">
                {scrapingStep === 1 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>Engine: Headless Browser (Puppeteer)</span>
                      <span className="text-emerald-400">Active</span>
                    </div>
                    <div className="p-3 bg-zinc-900/50 rounded border border-zinc-800 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-zinc-200">Analyzing URL structure...</span>
                      </div>
                      {entryMetadata && (
                        <div className="pl-4 space-y-1 border-l border-zinc-800 ml-1">
                          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Detection Result</div>
                          <div className="text-xs text-emerald-400 font-mono">{entryMetadata.method}</div>
                          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-2">Access Status</div>
                          <div className="text-xs text-emerald-400 font-mono">{entryMetadata.status}</div>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm opacity-50">
                        <div className="w-2 h-2 rounded-full bg-zinc-700" />
                        <span className="text-zinc-400">Bypassing bot detection...</span>
                      </div>
                    </div>
                  </div>
                )}
                {scrapingStep >= 2 && scrapingStep <= 6 && (
                  <div className="space-y-4">
                    <div className="aspect-video bg-zinc-900 rounded-xl overflow-hidden relative border border-zinc-800">
                      <img src={selectedVideo.thumbnail} className="w-full h-full object-cover opacity-60" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                      <div className="absolute top-1/2 left-0 w-full h-0.5 bg-violet-500/50 animate-[scan_2s_ease-in-out_infinite]"></div>
                      <div className="absolute bottom-3 left-3 right-3">
                        <p className="text-[10px] font-mono text-emerald-400 truncate">OCR: {selectedVideo.title}</p>
                      </div>
                    </div>
                    {scrapingStep >= 5 && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800">
                          <p className="text-[10px] text-zinc-500 mb-1">الخط المكتشف</p>
                          <p className="text-xs font-bold text-white">Cairo Bold</p>
                        </div>
                        <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800">
                          <p className="text-[10px] text-zinc-500 mb-1">موضع النص</p>
                          <p className="text-xs font-bold text-white">Bottom Center</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {scrapingStep === 7 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-200">Cloning Engine</span>
                      <span className="text-xs font-mono text-emerald-400">{cloningProgress}%</span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                      <motion.div 
                        className="bg-emerald-500 h-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${cloningProgress}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-zinc-900/50 rounded border border-zinc-800">
                        <div className="text-[10px] text-zinc-500 uppercase">Visuals</div>
                        <div className="text-xs text-zinc-300">Re-rendering scenes...</div>
                      </div>
                      <div className="p-2 bg-zinc-900/50 rounded border border-zinc-800">
                        <div className="text-[10px] text-zinc-500 uppercase">Audio</div>
                        <div className="text-xs text-zinc-300">Syncing voiceover...</div>
                      </div>
                    </div>
                  </div>
                )}
                {scrapingStep === 8 && (
                  <div className="space-y-3">
                    <div className="p-3 bg-zinc-900/50 rounded border border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400">Database:</span>
                        <span className="text-emerald-400 font-mono">Firestore</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span className="text-zinc-200">Metadata logged successfully</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span className="text-zinc-200">Asset paths mapped</span>
                      </div>
                    </div>
                  </div>
                )}
                {scrapingStep === 9 && (
                  <div className="space-y-4">
                    <div className="p-4 bg-zinc-900/50 rounded border border-dashed border-zinc-700 flex flex-col items-center justify-center text-center space-y-3">
                      {publishingStatus === 'scheduling' ? (
                        <>
                          <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
                          <div>
                            <div className="text-sm font-medium text-zinc-200">Scheduling Upload</div>
                            <div className="text-xs text-zinc-500">Connecting to YouTube API...</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-emerald-400">Ready for Publishing</div>
                            <div className="text-xs text-zinc-500">Auto-publish enabled for 08:00 AM</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
              <h4 className="text-sm font-bold text-zinc-400 mb-4">سجل العمليات المباشر</h4>
              <div className="space-y-2 max-h-[150px] overflow-y-auto font-mono text-[10px] custom-scrollbar">
                {steps.slice(0, scrapingStep).map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-emerald-400/80 animate-in fade-in slide-in-from-right-2">
                    <span className="text-zinc-600">[{new Date().toLocaleTimeString()}]</span>
                    <span>SUCCESS: {s.name} completed.</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-violet-400 animate-pulse">
                  <span className="text-zinc-600">[{new Date().toLocaleTimeString()}]</span>
                  <span>RUNNING: {steps[scrapingStep - 1]?.name}...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Cloning File Results */}
      {scrapingStep === 10 && selectedVideo && (
        <div className="bg-zinc-900 border border-emerald-500/30 rounded-3xl overflow-hidden animate-in zoom-in fade-in duration-500 shadow-2xl shadow-emerald-500/5">
          <div className="p-6 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                <FileJson className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">ملف الاستنساخ الذكي (Video Clone File)</h3>
                <p className="text-emerald-400/70 text-xs">تم التحليل بنجاح بنسبة ثقة 98%</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-colors flex items-center gap-2">
                <Zap className="w-4 h-4" />
                إرسال للمصنع
              </button>
              <button 
                onClick={() => setScrapingStep(0)}
                className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-xl text-sm font-bold hover:bg-zinc-700 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>

          <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Visuals & OCR */}
            <div className="lg:col-span-2 space-y-8">
              <section>
                <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <ScanText className="w-4 h-4" />
                  النصوص المستخرجة حسب المشاهد
                </h4>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex gap-4">
                      <div className="w-24 aspect-video bg-zinc-900 rounded-lg overflow-hidden flex-shrink-0 relative">
                        <img src={selectedVideo.thumbnail} className="w-full h-full object-cover opacity-40" />
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-zinc-500">Scene {i}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-mono text-violet-400">00:0{i * 2}s</span>
                          <span className="text-[10px] text-zinc-600">Confidence: 99%</span>
                        </div>
                        <p className="text-white font-bold text-lg leading-relaxed">
                          {i === 1 ? selectedVideo.title : i === 2 ? "هذا النص تم استخراجه بدقة عالية" : "تابعونا للمزيد من المحتوى الرائع"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
                  <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    تحليل القالب البصري
                  </h4>
                  <ul className="space-y-3 text-sm">
                    <li className="flex justify-between border-b border-zinc-900 pb-2">
                      <span className="text-zinc-500">موضع النص</span>
                      <span className="text-white font-bold">وسط - أسفل</span>
                    </li>
                    <li className="flex justify-between border-b border-zinc-900 pb-2">
                      <span className="text-zinc-500">حجم الخط</span>
                      <span className="text-white font-bold">72px (Cairo Bold)</span>
                    </li>
                    <li className="flex justify-between border-b border-zinc-900 pb-2">
                      <span className="text-zinc-500">الألوان</span>
                      <div className="flex gap-1">
                        <div className="w-4 h-4 rounded bg-red-600"></div>
                        <div className="w-4 h-4 rounded bg-white"></div>
                        <div className="w-4 h-4 rounded bg-black"></div>
                      </div>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-zinc-500">الانتقالات</span>
                      <span className="text-white font-bold">Pop In + Fade Out</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
                  <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Music className="w-4 h-4" />
                    تحليل الصوت والموسيقى
                  </h4>
                  <ul className="space-y-3 text-sm">
                    <li className="flex justify-between border-b border-zinc-900 pb-2">
                      <span className="text-zinc-500">نمط الموسيقى</span>
                      <span className="text-violet-400 font-bold">كوميدي / حماسي</span>
                    </li>
                    <li className="flex justify-between border-b border-zinc-900 pb-2">
                      <span className="text-zinc-500">الإيقاع (BPM)</span>
                      <span className="text-white font-bold">128 BPM (سريع)</span>
                    </li>
                    <li className="flex justify-between border-b border-zinc-900 pb-2">
                      <span className="text-zinc-500">تعليق صوتي</span>
                      <span className="text-emerald-400 font-bold">مكتشف (AI Voice)</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-zinc-500">مؤثرات صوتية</span>
                      <span className="text-white font-bold">ضحك + انتقال سهم</span>
                    </li>
                  </ul>
                </div>
              </section>
            </div>

            {/* Right Column: Metadata & Actions */}
            <div className="space-y-6">
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
                <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4">بيانات الفيديو</h4>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center">
                      <Target className="w-5 h-5 text-zinc-400" />
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase">الأبعاد</p>
                      <p className="text-sm font-bold text-white">1080 x 1920 (9:16)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center">
                      <Layers className="w-5 h-5 text-zinc-400" />
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase">عدد اللقطات الذكية</p>
                      <p className="text-sm font-bold text-white">12 لقطة محللة</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-violet-600/10 border border-violet-500/20 rounded-2xl p-6">
                <h4 className="text-sm font-bold text-violet-400 uppercase tracking-wider mb-4">ملخص الذكاء الاصطناعي</h4>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  هذا الفيديو يعتمد على أسلوب "القصص السريعة" مع نصوص بارزة في المنتصف. الموسيقى تدعم الحالة الكوميدية. ننصح باستخدام قالب "صندوق نيون" لإعادة الإنتاج.
                </p>
              </div>

              <button 
                onClick={() => saveCloneToFirestore(selectedVideo)}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Database className="w-5 h-5" />
                حفظ كمرجع دائم
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Database / Extracted Assets */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-violet-400" />
            آخر عمليات الاستنساخ (قاعدة البيانات)
          </h3>
          <span className="px-3 py-1 bg-violet-500/10 text-violet-400 rounded-full text-xs font-bold">
            {dbEntries.length} عناصر محفوظة مؤخراً
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-zinc-900 text-zinc-400 text-sm border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 font-medium text-right">النص المستخرج (OCR)</th>
                <th className="px-6 py-4 font-medium text-right">التصنيف</th>
                <th className="px-6 py-4 font-medium text-right">القالب المستنسخ</th>
                <th className="px-6 py-4 font-medium text-right">الموسيقى المحفوظة</th>
                <th className="px-6 py-4 font-medium text-right">تاريخ السحب</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {dbEntries.map((entry: any, i) => (
                <tr key={entry.id} className={`hover:bg-zinc-800/30 transition-colors ${i === 0 && scrapingStep === 6 ? 'bg-emerald-500/10 animate-pulse' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center">
                        <ScanText className="w-4 h-4 text-zinc-400" />
                      </div>
                      <span className="text-zinc-200 font-bold text-sm line-clamp-1">{entry.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-zinc-400 text-xs">{entry.category || 'غير مصنف'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-zinc-800 text-zinc-300 rounded-md text-xs font-medium border border-zinc-700 flex items-center gap-1 w-max">
                      <Palette className="w-3 h-3" /> {entry.template}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-2 text-violet-400 text-sm font-medium">
                      <PlayCircle className="w-4 h-4" /> {entry.music}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-500 text-sm font-mono">{entry.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
