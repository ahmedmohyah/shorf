import { Play, Square, Download, Send, MoreVertical, Music, Sparkles, Video, Image as ImageIcon, Heart, Youtube } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { getCurrentApiKey } from '../../lib/ai-client';

export function LibraryView() {
  const [playingId, setPlayingId] = useState<number | string | null>(null);
  const [firebaseVideos, setFirebaseVideos] = useState<any[]>([]);
  const [channels, setChannels] = useState<{ id: string; title: string; thumbnail: string }[]>([]);
  const [isChannelSelectionOpen, setIsChannelSelectionOpen] = useState(false);
  const [videoToPublish, setVideoToPublish] = useState<any | null>(null);
  const [publishingStatus, setPublishingStatus] = useState<'idle' | 'downloading' | 'uploading' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({});

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const res = await fetch('/api/auth/youtube/status');
        const data = await res.json();
        if (data.channels) {
          setChannels(data.channels);
        }
      } catch (error) {
        console.error("Failed to fetch channels:", error);
      }
    };
    fetchChannels();
  }, []);

  useEffect(() => {
    const fetchFirebaseVideos = async () => {
      if (!auth.currentUser) return;
      try {
        const q = query(
          collection(db, 'scheduledVideos'),
          where('userId', '==', auth.currentUser.uid),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const fetched = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            type: 'video',
            category: data.category || 'عام',
            duration: '00:08',
            date: data.scheduledDate,
            music: 'أصوات طبيعية',
            videoUrl: data.videoUrl,
            youtubeUrl: data.youtubeUrl,
            publishStatus: data.publishStatus,
            publishedAt: data.publishedAt,
            channelName: data.channelName,
            title: data.title,
            overlayText: data.overlayText,
            poster: data.thumbnail,
            renderContent: (isPlaying: boolean) => (
              <>
                <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}></div>
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 text-emerald-400 text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 z-20">
                  <Video className="w-3 h-3" /> Veo 3.1
                </div>
                <div className={`absolute inset-x-2 bottom-6 flex flex-col items-center justify-center p-2 z-10 transition-opacity duration-1000 ${isPlaying ? 'opacity-100 animate-in fade-in fill-both' : 'opacity-0'}`}>
                  <h3 className={`text-white font-black text-4xl mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] text-center ${isPlaying ? 'animate-in slide-in-from-top-8 fade-in duration-700 delay-300 fill-both' : ''}`}>
                    {data.title}
                  </h3>
                  <p className={`text-white font-bold text-2xl leading-loose text-center drop-shadow-[0_4px_6px_rgba(0,0,0,1)] ${isPlaying ? 'animate-in slide-in-from-bottom-8 fade-in duration-700 delay-700 fill-both' : ''}`} style={{ fontFamily: "'Cairo', sans-serif", textShadow: '2px 2px 4px #000000' }}>
                    {data.overlayText?.split('\\n').map((line: string, i: number) => (
                      <span key={i}>{line}<br/></span>
                    ))}
                  </p>
                </div>
              </>
            )
          };
        });
        setFirebaseVideos(fetched);
      } catch (err) {
        console.error("Error fetching firebase videos:", err);
      }
    };
    fetchFirebaseVideos();
  }, [auth.currentUser]);

  useEffect(() => {
    // Stop all videos and audios when playingId changes
    Object.keys(videoRefs.current).forEach((key) => {
      const videoEl = videoRefs.current[key];
      const audioEl = audioRefs.current[key];
      
      if (key === String(playingId)) {
        if (videoEl) {
          videoEl.currentTime = 0;
          videoEl.play().catch(e => console.log("Video play error:", e));
        }
        if (audioEl) {
          audioEl.currentTime = 0;
          audioEl.play().catch(e => console.log("Audio play error:", e));
        }
      } else {
        if (videoEl) {
          videoEl.pause();
          videoEl.currentTime = 0;
        }
        if (audioEl) {
          audioEl.pause();
          audioEl.currentTime = 0;
        }
      }
    });

    let timer: NodeJS.Timeout;
    if (playingId !== null) {
      timer = setTimeout(() => {
        setPlayingId(null);
      }, 8000); // 8 seconds duration
    }
    return () => clearTimeout(timer);
  }, [playingId]);

  const togglePlay = (id: number | string) => {
    if (playingId === id) {
      setPlayingId(null);
    } else {
      setPlayingId(id);
    }
  };

  const handleDownload = async (url: string, title: string, overlayText?: string, audioUrl?: string) => {
    try {
      // Use the server-side proxy to download the video and bypass CORS
      let proxyUrl = `/api/proxy-download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(title || 'video')}.mp4&apiKey=${getCurrentApiKey()}`;
      if (overlayText) {
        proxyUrl += `&overlayText=${encodeURIComponent(overlayText)}`;
      }
      if (audioUrl) {
        proxyUrl += `&audioUrl=${encodeURIComponent(audioUrl)}`;
      }
      window.location.href = proxyUrl;
    } catch (error) {
      console.error("Download failed:", error);
      alert("فشل تحميل الفيديو. يرجى المحاولة مرة أخرى.");
    }
  };

  const handlePublish = async (video: any, channel: any) => {
    setPublishingStatus('downloading');
    setProgress(0);
    
    try {
      // 1. Pre-upload verification (Client side)
      if (!video.videoUrl) throw new Error("رابط الفيديو مفقود");
      if (!video.id) throw new Error("معرف الفيديو مفقود");
      if (!channel || !channel.id) throw new Error("القناة المستهدفة مفقودة");
      
      // Update status to pending in Firestore if it's a firebase video
      if (typeof video.id === 'string') {
        const docRef = doc(db, 'scheduledVideos', video.id);
        await updateDoc(docRef, {
          publishStatus: 'pending',
          channelId: channel.id,
          channelName: channel.title,
          updatedAt: new Date().toISOString()
        });
        
        // Update local state
        setFirebaseVideos(prev => prev.map(v => v.id === video.id ? {
          ...v,
          publishStatus: 'pending',
          channelName: channel.title
        } : v));
      }

      // Simulate download progress
      for (let i = 0; i <= 50; i += 10) {
        setProgress(i);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      setPublishingStatus('uploading');
      
      // Simulate upload progress
      for (let i = 50; i <= 90; i += 10) {
        setProgress(i);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      const res = await fetch('/api/youtube/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video.id,
          videoUrl: video.videoUrl,
          title: video.title || video.category,
          description: video.description || video.overlayText,
          overlayText: video.overlayText,
          publishNow: true,
          channelId: channel.id,
          apiKey: getCurrentApiKey()
        }),
      });
      const data = await res.json();
      
      // 3. Post-upload verification
      if (data.success) {
        if (data.videoId !== video.id) {
           throw new Error("فشل التحقق النهائي: الفيديو المرفوع لا يتطابق مع الفيديو المطلوب");
        }
        
        setPublishingStatus('success');
        setProgress(100);
        
        // Update status to published in Firestore
        if (typeof video.id === 'string') {
          const docRef = doc(db, 'scheduledVideos', video.id);
          await updateDoc(docRef, {
            publishStatus: 'published',
            youtubeUrl: data.youtubeUrl,
            publishedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          
          // Update local state
          setFirebaseVideos(prev => prev.map(v => v.id === video.id ? {
            ...v,
            publishStatus: 'published',
            youtubeUrl: data.youtubeUrl,
            publishedAt: new Date().toISOString()
          } : v));
        } else {
           // For hardcoded videos, update local state (if we had a state for them, but we don't, so we just alert)
           // In a real app, hardcoded videos wouldn't be published like this, or they'd be saved to DB first.
        }
        
        alert(data.message);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      setPublishingStatus('error');
      console.error("Publish failed:", error);
      
      // Update status to failed in Firestore
      if (typeof video.id === 'string') {
        const docRef = doc(db, 'scheduledVideos', video.id);
        await updateDoc(docRef, {
          publishStatus: 'failed',
          publishError: error.message,
          updatedAt: new Date().toISOString()
        });
        
        setFirebaseVideos(prev => prev.map(v => v.id === video.id ? {
          ...v,
          publishStatus: 'failed'
        } : v));
      }
      
      alert("فشل نشر الفيديو: " + error.message);
    } finally {
      setTimeout(() => {
        setPublishingStatus('idle');
        setProgress(0);
      }, 3000);
    }
  };

  const videos = [
    {
      id: 26,
      type: 'video',
      category: 'مشاهد حية (Veo 3.1 Native Audio)',
      duration: '00:08',
      date: 'الآن',
      music: 'أصوات الطبيعة (أمواج وطيور)',
      videoUrl: 'https://vjs.zencdn.net/v/oceans.mp4',
      audioUrl: 'https://assets.mixkit.co/active_storage/sfx/299/299-preview.mp3',
      poster: 'https://picsum.photos/seed/oceanwaves/400/800',
      overlayText: 'سحر المحيط 🌊\n\nطيور النورس تحلق بحرية،\nفوق أمواج المحيط الهادرة،\nزرقة المياه تعانق السماء،\nفي مشهد يبعث على السكينة،\nصوت تلاطم الأمواج يعزف لحناً،\nيأخذنا بعيداً عن ضجيج العالم،\nعظمة الخالق تتجلى في خلقه،\nلحظات تأمل تريح النفس والوجدان.',
      renderContent: (isPlaying: boolean) => (
        <>
          <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}></div>
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 text-emerald-400 text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 z-20">
            <Video className="w-3 h-3" /> Veo 3.1 + Audio
          </div>
          <div className={`absolute inset-x-2 bottom-6 flex flex-col items-center justify-center p-2 z-10 transition-opacity duration-1000 ${isPlaying ? 'opacity-100 animate-in fade-in fill-both' : 'opacity-0'}`}>
            <h3 className={`text-white font-black text-3xl mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] text-center ${isPlaying ? 'animate-in slide-in-from-top-8 fade-in duration-700 delay-300 fill-both' : ''}`}>
              سحر المحيط 🌊
            </h3>
            <p className={`text-white font-bold text-lg leading-loose text-center drop-shadow-[0_4px_6px_rgba(0,0,0,1)] ${isPlaying ? 'animate-in slide-in-from-bottom-8 fade-in duration-700 delay-700 fill-both' : ''}`} style={{ fontFamily: "'Cairo', sans-serif", textShadow: '2px 2px 4px #000000' }}>
              طيور النورس تحلق بحرية،<br/>
              فوق أمواج المحيط الهادرة،<br/>
              زرقة المياه تعانق السماء،<br/>
              في مشهد يبعث على السكينة،<br/>
              صوت تلاطم الأمواج يعزف لحناً،<br/>
              يأخذنا بعيداً عن ضجيج العالم،<br/>
              عظمة الخالق تتجلى في خلقه،<br/>
              <span className="text-blue-400">لحظات تأمل تريح النفس والوجدان.</span>
            </p>
          </div>
        </>
      )
    },
    {
      id: 25,
      type: 'video',
      category: 'خلفيات طبيعية (Veo 3.1)',
      duration: '00:08',
      date: 'الآن',
      music: 'موسيقى هادئة مع صوت الشلال',
      videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      poster: 'https://picsum.photos/seed/waterfall/400/800',
      overlayText: 'سحر الشلالات 🌊\n\nشلالات الغابة السحرية تتدفق بقوة،\nمياه نقية تروي عطش الأرض الخصبة،\nصوت خرير الماء يعزف أجمل الألحان،\nفي قلب طبيعة عذراء لم تمسسها يد،\nأشجار خضراء تعانق السماء العالية،\nوطيور تغرد بأصوات تبهج الأرواح،\nهنا تجد الهدوء والسكينة المطلقة،\nبعيداً عن صخب الحياة وضجيج المدن.',
      renderContent: (isPlaying: boolean) => (
        <>
          <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}></div>
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 text-emerald-400 text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 z-20">
            <Video className="w-3 h-3" /> Veo 3.1 Fast
          </div>
          <div className={`absolute inset-x-2 bottom-6 flex flex-col items-center justify-center p-2 z-10 transition-opacity duration-1000 ${isPlaying ? 'opacity-100 animate-in fade-in fill-both' : 'opacity-0'}`}>
            <h3 className={`text-white font-black text-3xl mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] text-center ${isPlaying ? 'animate-in slide-in-from-top-8 fade-in duration-700 delay-300 fill-both' : ''}`}>
              سحر الشلالات 🌊
            </h3>
            <p className={`text-white font-bold text-lg leading-loose text-center drop-shadow-[0_4px_6px_rgba(0,0,0,1)] ${isPlaying ? 'animate-in slide-in-from-bottom-8 fade-in duration-700 delay-700 fill-both' : ''}`} style={{ fontFamily: "'Cairo', sans-serif", textShadow: '2px 2px 4px #000000' }}>
              شلالات الغابة السحرية تتدفق بقوة،<br/>
              مياه نقية تروي عطش الأرض الخصبة،<br/>
              صوت خرير الماء يعزف أجمل الألحان،<br/>
              في قلب طبيعة عذراء لم تمسسها يد،<br/>
              أشجار خضراء تعانق السماء العالية،<br/>
              وطيور تغرد بأصوات تبهج الأرواح،<br/>
              هنا تجد الهدوء والسكينة المطلقة،<br/>
              <span className="text-cyan-300">بعيداً عن صخب الحياة وضجيج المدن.</span>
            </p>
          </div>
        </>
      )
    },
    {
      id: 24,
      type: 'video',
      category: 'خلفيات مدن (Veo 3.1)',
      duration: '00:08',
      date: 'الآن',
      music: 'موسيقى إلكترونية حماسية',
      videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      poster: 'https://picsum.photos/seed/citynight/400/800',
      overlayText: 'أضواء المدينة 🌃\n\nأضواء المدينة الساهرة تنبض بالحياة،\nناطحات سحاب تعانق الغيوم المظلمة،\nشوارع لا تنام تعج بالحركة المستمرة،\nسيارات مسرعة ترسم خطوطاً من النور،\nطاقة حضرية تلهم العقول المبدعة،\nفي عالم حديث مليء بالفرص والتحديات،\nكل زاوية تروي قصة نجاح وطموح،\nسحر الليل يضفي جمالاً لا يقاوم.',
      renderContent: (isPlaying: boolean) => (
        <>
          <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}></div>
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 text-emerald-400 text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 z-20">
            <Video className="w-3 h-3" /> Veo 3.1 Fast
          </div>
          <div className={`absolute inset-x-2 bottom-6 flex flex-col items-center justify-center p-2 z-10 transition-opacity duration-1000 ${isPlaying ? 'opacity-100 animate-in fade-in fill-both' : 'opacity-0'}`}>
            <h3 className={`text-white font-black text-3xl mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] text-center ${isPlaying ? 'animate-in slide-in-from-top-8 fade-in duration-700 delay-300 fill-both' : ''}`}>
              أضواء المدينة 🌃
            </h3>
            <p className={`text-white font-bold text-lg leading-loose text-center drop-shadow-[0_4px_6px_rgba(0,0,0,1)] ${isPlaying ? 'animate-in slide-in-from-bottom-8 fade-in duration-700 delay-700 fill-both' : ''}`} style={{ fontFamily: "'Cairo', sans-serif", textShadow: '2px 2px 4px #000000' }}>
              أضواء المدينة الساهرة تنبض بالحياة،<br/>
              ناطحات سحاب تعانق الغيوم المظلمة،<br/>
              شوارع لا تنام تعج بالحركة المستمرة،<br/>
              سيارات مسرعة ترسم خطوطاً من النور،<br/>
              طاقة حضرية تلهم العقول المبدعة،<br/>
              في عالم حديث مليء بالفرص والتحديات،<br/>
              كل زاوية تروي قصة نجاح وطموح،<br/>
              <span className="text-amber-400">سحر الليل يضفي جمالاً لا يقاوم.</span>
            </p>
          </div>
        </>
      )
    },
    {
      id: 23,
      type: 'video',
      category: 'تأمل طبيعي (Veo 3.1)',
      duration: '00:08',
      date: 'الآن',
      music: 'موسيقى سويسرية هادئة',
      videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
      poster: 'https://picsum.photos/seed/swiss/400/800',
      overlayText: 'سويسرا جنة الأرض 🇨🇭\n\nجبال الألب الشاهقة تعانق السحاب،\nوديان خضراء تسرق الأنفاس بجمالها،\nهنا حيث الطبيعة ترسم أبهى لوحاتها،\nأكواخ خشبية دافئة وسط الثلوج والمروج.\nاستنشق هواء الجبال النقي،\nواشعر بالسلام الذي يغمر المكان.\nكل زاوية هنا تخفي سحراً لا يُنسى،\nرحلة إلى قلب الطبيعة العذراء.',
      renderContent: (isPlaying: boolean) => (
        <>
          <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}></div>
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 text-emerald-400 text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 z-20">
            <Video className="w-3 h-3" /> Veo 3.1 Fast
          </div>
          <div className={`absolute inset-x-2 bottom-4 flex flex-col items-center justify-center p-2 z-10 transition-opacity duration-1000 ${isPlaying ? 'opacity-100 animate-in fade-in fill-both' : 'opacity-0'}`}>
            <h3 className={`text-white font-black text-2xl mb-2 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] text-center ${isPlaying ? 'animate-in slide-in-from-top-8 fade-in duration-700 delay-300 fill-both' : ''}`}>
              سويسرا جنة الأرض 🇨🇭
            </h3>
            <p className={`text-zinc-200 font-bold text-[13px] leading-[1.8] text-center drop-shadow-[0_4px_4px_rgba(0,0,0,1)] ${isPlaying ? 'animate-in slide-in-from-bottom-8 fade-in duration-700 delay-700 fill-both' : ''}`} style={{ fontFamily: "'Cairo', sans-serif" }}>
              جبال الألب الشاهقة تعانق السحاب،<br/>
              وديان خضراء تسرق الأنفاس بجمالها،<br/>
              هنا حيث الطبيعة ترسم أبهى لوحاتها،<br/>
              أكواخ خشبية دافئة وسط الثلوج والمروج.<br/>
              استنشق هواء الجبال النقي،<br/>
              واشعر بالسلام الذي يغمر المكان.<br/>
              كل زاوية هنا تخفي سحراً لا يُنسى،<br/>
              رحلة إلى قلب الطبيعة العذراء.<br/>
              دع عينيك تستريح في هذا الجمال،<br/>
              <span className="text-cyan-300">واكتشف لماذا سويسرا هي جنة الأرض 🌲</span>
            </p>
          </div>
        </>
      )
    },
    {
      id: 22,
      type: 'video',
      category: 'تأمل طبيعي (Veo 3.1)',
      duration: '00:08',
      date: 'الآن',
      music: 'أصوات الطبيعة وموسيقى ملحمية',
      videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      poster: 'https://picsum.photos/seed/mountains/400/800',
      renderContent: (isPlaying: boolean) => (
        <>
          <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}></div>
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 text-emerald-400 text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 z-20">
            <Video className="w-3 h-3" /> Veo 3.1 Fast
          </div>
          <div className={`absolute inset-x-2 bottom-4 flex flex-col items-center justify-center p-2 z-10 transition-opacity duration-1000 ${isPlaying ? 'opacity-100 animate-in fade-in fill-both' : 'opacity-0'}`}>
            <h3 className={`text-white font-black text-2xl mb-2 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] text-center ${isPlaying ? 'animate-in slide-in-from-top-8 fade-in duration-700 delay-300 fill-both' : ''}`}>
              قمم السحاب ☁️
            </h3>
            <p className={`text-zinc-200 font-bold text-[13px] leading-[1.8] text-center drop-shadow-[0_4px_4px_rgba(0,0,0,1)] ${isPlaying ? 'animate-in slide-in-from-bottom-8 fade-in duration-700 delay-700 fill-both' : ''}`} style={{ fontFamily: "'Cairo', sans-serif" }}>
              فوق السحاب، حيث يلامس الجبل السماء،<br/>
              تتلاشى كل الهموم وتصغر كل العقبات،<br/>
              من هنا، يبدو العالم هادئاً ومسالماً،<br/>
              رحلة بصرية تأخذك إلى آفاق جديدة.<br/>
              تأمل في عظمة الخالق في هذا الكون،<br/>
              واستمد قوتك من شموخ الجبال.<br/>
              كل قمة تصل إليها هي بداية لتحدٍ جديد،<br/>
              لا تتوقف عن الصعود نحو أحلامك.<br/>
              دع روحك تحلق عالياً بحرية تامة،<br/>
              <span className="text-cyan-300">واصنع من الغيوم جسراً نحو طموحاتك 🏔️</span>
            </p>
          </div>
        </>
      )
    },
    {
      id: 21,
      type: 'video',
      category: 'تأمل طبيعي (Veo 3.1)',
      duration: '00:08',
      date: 'الآن',
      music: 'صوت الشلال وموسيقى هادئة',
      videoUrl: 'https://assets.codepen.io/3364143/7btrrd.mp4', // Highly reliable video URL
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', // Reliable audio URL
      poster: 'https://picsum.photos/seed/waterfall_new/400/800',
      renderContent: (isPlaying: boolean) => (
        <>
          <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}></div>
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 text-emerald-400 text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 z-20">
            <Video className="w-3 h-3" /> Veo 3.1 Fast
          </div>
          <div className={`absolute inset-x-2 bottom-4 flex flex-col items-center justify-center p-2 z-10 transition-opacity duration-1000 ${isPlaying ? 'opacity-100 animate-in fade-in fill-both' : 'opacity-0'}`}>
            <h3 className={`text-white font-black text-2xl mb-2 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] text-center ${isPlaying ? 'animate-in slide-in-from-top-8 fade-in duration-700 delay-300 fill-both' : ''}`}>
              تدفق الحياة 🌊
            </h3>
            <p className={`text-zinc-200 font-bold text-[13px] leading-[1.8] text-center drop-shadow-[0_4px_4px_rgba(0,0,0,1)] ${isPlaying ? 'animate-in slide-in-from-bottom-8 fade-in duration-700 delay-700 fill-both' : ''}`} style={{ fontFamily: "'Cairo', sans-serif" }}>
              استمع إلى صوت الشلال المتدفق،<br/>
              كيف يشق طريقه عبر الصخور بقوة وثبات،<br/>
              هكذا هي الحياة، مستمرة لا تتوقف،<br/>
              دع همومك تنجرف مع هذا التيار الصافي.<br/>
              في كل قطرة ماء، هناك حياة جديدة،<br/>
              وفي كل لحظة تأمل، هناك سلام داخلي.<br/>
              تنفس بعمق، واملأ رئتيك بالهواء النقي،<br/>
              أنت هنا والآن، في هذه اللحظة المثالية.<br/>
              دع الطبيعة تغسل روحك من التعب،<br/>
              <span className="text-cyan-300">وابدأ من جديد بقلب صافٍ كالمياه 💧</span>
            </p>
          </div>
        </>
      )
    },
    {
      id: 20,
      type: 'video',
      category: 'تأمل كوني (Veo 3.1)',
      duration: '00:08',
      date: 'الآن',
      music: 'أصوات الفضاء وموسيقى هادئة',
      videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      poster: 'https://picsum.photos/seed/space/400/800',
      renderContent: (isPlaying: boolean) => (
        <>
          <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}></div>
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 text-emerald-400 text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 z-20">
            <Video className="w-3 h-3" /> Veo 3.1 Fast
          </div>
          <div className={`absolute inset-x-2 bottom-4 flex flex-col items-center justify-center p-2 z-10 transition-opacity duration-1000 ${isPlaying ? 'opacity-100 animate-in fade-in fill-both' : 'opacity-0'}`}>
            <h3 className={`text-white font-black text-2xl mb-2 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] text-center ${isPlaying ? 'animate-in slide-in-from-top-8 fade-in duration-700 delay-300 fill-both' : ''}`}>
              عظمة الكون 🌌
            </h3>
            <p className={`text-zinc-200 font-bold text-[13px] leading-[1.8] text-center drop-shadow-[0_4px_4px_rgba(0,0,0,1)] ${isPlaying ? 'animate-in slide-in-from-bottom-8 fade-in duration-700 delay-700 fill-both' : ''}`} style={{ fontFamily: "'Cairo', sans-serif" }}>
              تأمل في سماء الليل المرصعة بالنجوم،<br/>
              كل نجمة تروي قصة من ملايين السنين،<br/>
              في هذا الكون الشاسع، ندرك حجمنا الحقيقي،<br/>
              ومع ذلك، نحمل في داخلنا كونا بأكمله.<br/>
              الهدوء الذي يغمر الفضاء الخارجي،<br/>
              يدعونا للبحث عن السلام في أعماقنا.<br/>
              لا تدع صغائر الأمور تعكر صفو حياتك،<br/>
              فأنت جزء من هذا النظام الكوني العظيم.<br/>
              ارفع رأسك دائماً نحو السماء،<br/>
              <span className="text-cyan-300">وتذكر أن بعد كل ظلام، هناك نور يسطع ✨</span>
            </p>
          </div>
        </>
      )
    },
    {
      id: 19,
      type: 'video',
      category: 'تأمل طبيعي (Veo 3.1)',
      duration: '00:08',
      date: 'الآن',
      music: 'صوت الشلال وموسيقى هادئة',
      videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      poster: 'https://picsum.photos/seed/waterfall5/400/800',
      renderContent: (isPlaying: boolean) => (
        <>
          <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}></div>
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 text-emerald-400 text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 z-20">
            <Video className="w-3 h-3" /> Veo 3.1 Fast
          </div>
          <div className={`absolute inset-x-2 bottom-4 flex flex-col items-center justify-center p-2 z-10 transition-opacity duration-1000 ${isPlaying ? 'opacity-100 animate-in fade-in fill-both' : 'opacity-0'}`}>
            <h3 className={`text-white font-black text-2xl mb-2 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] text-center ${isPlaying ? 'animate-in slide-in-from-top-8 fade-in duration-700 delay-300 fill-both' : ''}`}>
              فلسفة الماء 🌊
            </h3>
            <p className={`text-zinc-200 font-bold text-[13px] leading-[1.8] text-center drop-shadow-[0_4px_4px_rgba(0,0,0,1)] ${isPlaying ? 'animate-in slide-in-from-bottom-8 fade-in duration-700 delay-700 fill-both' : ''}`} style={{ fontFamily: "'Cairo', sans-serif" }}>
              هل راقبت يوماً كيف يتدفق الشلال؟<br/>
              إنه لا يتوقف عند الصخور القاسية،<br/>
              بل يلتف حولها أو ينحتها بمرور الزمن.<br/>
              هكذا هي الحياة، مليئة بالعقبات والتحديات،<br/>
              لكن المرونة هي سر الاستمرار والنجاح.<br/>
              الماء يعلمنا أن القوة ليست في القسوة،<br/>
              بل في الاستمرارية والتدفق الدائم.<br/>
              مهما كان السقوط مدوياً من أعلى الجبل،<br/>
              فإنه يصنع في النهاية نهراً هادئاً وجميلاً.<br/>
              <span className="text-cyan-300">كن كالماء، مرناً، قوياً، ولا تتوقف أبداً ✨</span>
            </p>
          </div>
        </>
      )
    },
    {
      id: 18,
      type: 'video',
      category: 'تأمل طبيعي (Veo 3.1)',
      duration: '00:08',
      date: 'الآن',
      music: 'صوت أمواج البحر وموسيقى هادئة',
      videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      poster: 'https://picsum.photos/seed/oceanwaves/400/800',
      renderContent: (isPlaying: boolean) => (
        <>
          <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}></div>
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 text-emerald-400 text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 z-20">
            <Video className="w-3 h-3" /> Veo 3.1 Fast
          </div>
          <div className={`absolute inset-x-2 bottom-4 flex flex-col items-center justify-center p-2 z-10 transition-opacity duration-1000 ${isPlaying ? 'opacity-100 animate-in fade-in fill-both' : 'opacity-0'}`}>
            <h3 className={`text-white font-black text-2xl mb-2 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] text-center ${isPlaying ? 'animate-in slide-in-from-top-8 fade-in duration-700 delay-300 fill-both' : ''}`}>
              أسرار المحيط 🌊
            </h3>
            <p className={`text-zinc-200 font-bold text-[13px] leading-[1.8] text-center drop-shadow-[0_4px_4px_rgba(0,0,0,1)] ${isPlaying ? 'animate-in slide-in-from-bottom-8 fade-in duration-700 delay-700 fill-both' : ''}`} style={{ fontFamily: "'Cairo', sans-serif" }}>
              البحر يعلمنا الكثير عن الحياة وأسرارها.<br/>
              أمواجه المتتالية تشبه أيامنا المتعاقبة،<br/>
              تارة تكون هادئة وتارة أخرى عاصفة ومتمردة.<br/>
              في أعماقه المظلمة تختبئ أثمن اللآلئ،<br/>
              وكذلك نحن، أجمل ما فينا يكمن في أعماقنا.<br/>
              لا تخف من الغوص في بحر أحلامك وطموحاتك،<br/>
              فالسفن آمنة في الميناء، لكنها لم تُصنع لذلك.<br/>
              واجه أمواج التحديات بشجاعة وإيمان راسخ،<br/>
              فبعد كل عاصفة شديدة، يأتي هدوء جميل.<br/>
              <span className="text-cyan-300">تأمل البحر، واستلهم منه القوة والسكينة ✨</span>
            </p>
          </div>
        </>
      )
    },
    {
      id: 17,
      type: 'video',
      category: 'تأمل طبيعي (Veo 3.1)',
      duration: '00:08',
      date: 'الآن',
      music: 'موسيقى محيطية هادئة',
      videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      poster: 'https://picsum.photos/seed/sunsetbeach/400/800',
      renderContent: (isPlaying: boolean) => (
        <>
          <div className={`absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}></div>
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 text-emerald-400 text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 z-20">
            <Video className="w-3 h-3" /> Veo 3.1 Fast
          </div>
          <div className={`absolute inset-x-2 bottom-8 flex flex-col items-center justify-center p-2 z-10 transition-opacity duration-1000 ${isPlaying ? 'opacity-100 animate-in fade-in fill-both' : 'opacity-0'}`}>
            <h3 className={`text-white font-black text-3xl mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] text-center ${isPlaying ? 'animate-in slide-in-from-top-8 fade-in duration-700 delay-300 fill-both' : ''}`}>
              غروب ساحر 🌅
            </h3>
            <p className={`text-zinc-200 font-bold text-[18px] leading-[1.8] text-center drop-shadow-[0_4px_4px_rgba(0,0,0,1)] ${isPlaying ? 'animate-in slide-in-from-bottom-8 fade-in duration-700 delay-700 fill-both' : ''}`} style={{ fontFamily: "'Cairo', sans-serif" }}>
              أمواج هادئة تلامس الشاطئ،<br/>
              مع ألوان الغروب الدافئة.<br/>
              <span className="text-emerald-300">نهاية يوم جميل وبداية للهدوء ✨</span>
            </p>
          </div>
        </>
      )
    },
    {
      id: 16,
      type: 'video',
      category: 'تأمل طبيعي (Veo 3.1)',
      duration: '00:15',
      date: 'الآن',
      music: 'صوت الطبيعة الأصلي (Veo Audio)',
      videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      renderContent: (isPlaying: boolean) => (
        <>
          <div className={`absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}></div>
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 text-emerald-400 text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 z-20">
            <Video className="w-3 h-3" /> Veo 3.1 Fast
          </div>
          <div className={`absolute inset-x-2 bottom-8 flex flex-col items-center justify-center p-2 z-10 transition-opacity duration-1000 ${isPlaying ? 'opacity-100 animate-in fade-in fill-both' : 'opacity-0'}`}>
            <h3 className={`text-white font-black text-3xl mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] text-center ${isPlaying ? 'animate-in slide-in-from-top-8 fade-in duration-700 delay-300 fill-both' : ''}`}>
              عظمة الخالق 🏔️
            </h3>
            <p className={`text-zinc-200 font-bold text-[18px] leading-[1.8] text-center drop-shadow-[0_4px_4px_rgba(0,0,0,1)] ${isPlaying ? 'animate-in slide-in-from-bottom-8 fade-in duration-700 delay-700 fill-both' : ''}`} style={{ fontFamily: "'Cairo', sans-serif" }}>
              مشهد واسع للجبال الشاهقة،<br/>
              مع تقريب بطيء (Zoom in)<br/>
              يبرز تفاصيل الطبيعة الساحرة.<br/>
              <span className="text-emerald-300">تأمل في إبداع الخالق ✨</span>
            </p>
          </div>
        </>
      )
    },
    {
      id: 15,
      type: 'image',
      category: 'اقتباسات عميقة (طبيعة)',
      duration: '00:08',
      date: 'الآن',
      music: 'بيانو درامي للقصص',
      bgImage: 'https://picsum.photos/seed/landscape/400/800',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
      renderContent: (isPlaying: boolean) => (
        <>
          <div className={`absolute inset-0 bg-gradient-to-b from-black/10 via-black/40 to-emerald-950/90 z-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}></div>
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 text-amber-400 text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 z-20">
            <ImageIcon className="w-3 h-3" /> Animated Template
          </div>
          <div className={`absolute inset-x-2 bottom-8 flex flex-col items-center justify-center p-2 z-10 transition-opacity duration-1000 ${isPlaying ? 'opacity-100 animate-in fade-in fill-both' : 'opacity-0'}`}>
            <h3 className={`text-emerald-400 font-black text-3xl mb-4 drop-shadow-[0_0_15px_rgba(16,185,129,0.8)] text-center ${isPlaying ? 'animate-in slide-in-from-top-8 fade-in duration-700 delay-300 fill-both' : ''}`}>
              سلام الروح 🍃
            </h3>
            <p className={`text-white font-bold text-[19px] leading-[1.8] text-center drop-shadow-[0_4px_4px_rgba(0,0,0,1)] ${isPlaying ? 'animate-in slide-in-from-bottom-8 fade-in duration-700 delay-700 fill-both' : ''}`} style={{ fontFamily: "'Cairo', sans-serif" }}>
              كالطبيعة تماماً،<br/>
              أجمل الأشياء تأخذ وقتاً لتنمو.<br/>
              لا تستعجل خطواتك،<br/>
              فكل شجرة عملاقة<br/>
              كانت يوماً ما مجرد بذرة صغيرة.<br/>
              <span className="text-emerald-300">أزهر حيثما زُرعت 🌸</span>
            </p>
          </div>
        </>
      )
    },
    {
      id: 13,
      type: 'image',
      category: 'أسرار المحيطات 🌊',
      duration: '00:08',
      date: 'الآن',
      music: 'جيتار أكوستيك للاسترخاء',
      bgImage: 'https://picsum.photos/seed/underwater/400/800',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
      renderContent: (isPlaying: boolean) => (
        <>
          <div className={`absolute inset-0 bg-gradient-to-t from-cyan-950/90 via-black/40 to-transparent z-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}></div>
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 text-amber-400 text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 z-20">
            <ImageIcon className="w-3 h-3" /> Animated Template
          </div>
          <div className={`absolute inset-x-2 bottom-10 flex flex-col items-center justify-center p-2 z-10 transition-opacity duration-1000 ${isPlaying ? 'opacity-100 animate-in fade-in fill-both' : 'opacity-0'}`}>
            <h3 className={`text-cyan-300 font-black text-3xl mb-4 drop-shadow-[0_0_15px_rgba(6,182,212,0.8)] text-center ${isPlaying ? 'animate-in slide-in-from-top-8 fade-in duration-700 delay-300 fill-both' : ''}`}>
              العالم المجهول 🤿
            </h3>
            <p className={`text-white font-bold text-[18px] leading-[1.7] text-center drop-shadow-[0_4px_4px_rgba(0,0,0,1)] ${isPlaying ? 'animate-in slide-in-from-bottom-8 fade-in duration-700 delay-700 fill-both' : ''}`} style={{ fontFamily: "'Cairo', sans-serif" }}>
              نحن نعرف عن سطح القمر<br/>
              أكثر مما نعرف عن أعماق محيطاتنا!<br/>
              أكثر من 80% من المحيطات<br/>
              لم يتم استكشافها أو رسم خرائط لها.<br/>
              هناك ملايين الكائنات البحرية<br/>
              التي تعيش في ظلام دامس<br/>
              <span className="text-cyan-200">تنتظر من يكتشفها في الأعماق السحيقة 🦑</span>
            </p>
          </div>
        </>
      )
    },
    {
      id: 12,
      type: 'image',
      category: 'عجائب الفضاء 🌌',
      duration: '00:08',
      date: 'الآن',
      music: 'موسيقى محيطية غامضة',
      bgImage: 'https://picsum.photos/seed/milkyway/400/800',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
      renderContent: (isPlaying: boolean) => (
        <>
          <div className={`absolute inset-0 bg-gradient-to-b from-black/10 via-black/50 to-indigo-950/90 z-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}></div>
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 text-amber-400 text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 z-20">
            <ImageIcon className="w-3 h-3" /> Animated Template
          </div>
          <div className={`absolute inset-x-2 bottom-8 flex flex-col items-center justify-center p-2 z-10 transition-opacity duration-1000 ${isPlaying ? 'opacity-100 animate-in fade-in fill-both' : 'opacity-0'}`}>
            <h3 className={`text-indigo-300 font-black text-3xl mb-4 drop-shadow-[0_0_15px_rgba(99,102,241,0.8)] text-center ${isPlaying ? 'animate-in slide-in-from-top-8 fade-in duration-700 delay-300 fill-both' : ''}`}>
              أمطار من الألماس! 💎
            </h3>
            <p className={`text-white font-bold text-[18px] leading-[1.7] text-center drop-shadow-[0_4px_4px_rgba(0,0,0,1)] ${isPlaying ? 'animate-in slide-in-from-bottom-8 fade-in duration-700 delay-700 fill-both' : ''}`} style={{ fontFamily: "'Cairo', sans-serif" }}>
              هل تعلم أن السماء تمطر ألماساً<br/>
              في كوكبي المشتري وزحل؟<br/>
              بسبب العواصف الرعدية العنيفة،<br/>
              يتحول غاز الميثان إلى كربون،<br/>
              ومع الضغط الجوي الهائل يسقط<br/>
              على شكل قطع ألماس صلبة!<br/>
              <span className="text-indigo-300">ثروات لا تقدر بثمن تسبح في الفضاء 🚀</span>
            </p>
          </div>
        </>
      )
    },
    {
      id: 11,
      type: 'video',
      category: 'معلومات غريبة (طبيعة)',
      duration: '00:08',
      date: 'الآن',
      music: 'صوت الشلال الأصلي (Veo Audio)',
      videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      renderContent: (isPlaying: boolean) => (
        <>
          <div className={`absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/90 z-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}></div>
          
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 text-emerald-400 text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 z-20">
            <Video className="w-3 h-3" /> Veo 3.1 Fast
          </div>

          <div className={`absolute inset-x-2 bottom-6 flex flex-col items-center justify-center p-2 z-10 transition-opacity duration-1000 ${isPlaying ? 'opacity-100 animate-in fade-in fill-both' : 'opacity-0'}`}>
            <h3 className={`text-cyan-400 font-black text-2xl mb-3 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)] text-center ${isPlaying ? 'animate-in slide-in-from-top-8 fade-in duration-700 delay-300 fill-both' : ''}`}>
              لغة الأشجار الخفية 🌲
            </h3>
            <p className={`text-white font-bold text-[17px] leading-[1.6] text-center drop-shadow-[0_4px_4px_rgba(0,0,0,1)] ${isPlaying ? 'animate-in slide-in-from-bottom-8 fade-in duration-700 delay-700 fill-both' : ''}`} style={{ fontFamily: "'Cairo', sans-serif" }}>
              هل تعلم أن الأشجار في الغابة تتحدث؟<br/>
              عبر شبكة معقدة من الفطريات تحت الأرض،<br/>
              تتبادل الأشجار الغذاء والمعلومات باستمرار.<br/>
              إذا تعرضت شجرة لهجوم من الحشرات،<br/>
              ترسل إشارات كيميائية سريعة لجيرانها<br/>
              لتبدأ في إفراز مواد دفاعية تحميها!<br/>
              حتى الأشجار الأم تغذي صغارها في الظل.<br/>
              <span className="text-cyan-300">الطبيعة تمتلك إنترنت خاص بها منذ ملايين السنين! 🌍</span>
            </p>
          </div>
        </>
      )
    },
    {
      id: 10,
      type: 'video',
      category: 'معلومات عميقة (جديد)',
      duration: '00:08',
      date: 'الآن',
      music: 'صوت المطر الطبيعي الأصلي (Veo Audio)',
      videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      renderContent: (isPlaying: boolean) => (
        <>
          <div className={`absolute inset-0 bg-gradient-to-b from-black/20 via-black/60 to-black/90 z-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}></div>
          
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 text-emerald-400 text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 z-20">
            <Video className="w-3 h-3" /> Veo 3.1 Fast
          </div>

          <div className={`absolute inset-x-2 bottom-6 flex flex-col items-center justify-center p-2 z-10 transition-opacity duration-1000 ${isPlaying ? 'opacity-100 animate-in fade-in fill-both' : 'opacity-0'}`}>
            <h3 className={`text-emerald-400 font-black text-2xl mb-3 drop-shadow-[0_0_10px_rgba(16,185,129,0.8)] text-center ${isPlaying ? 'animate-in slide-in-from-top-8 fade-in duration-700 delay-300 fill-both' : ''}`}>
              الوحدة الزحامية 🌧️
            </h3>
            <p className={`text-white font-bold text-[17px] leading-[1.6] text-center drop-shadow-[0_4px_4px_rgba(0,0,0,1)] ${isPlaying ? 'animate-in slide-in-from-bottom-8 fade-in duration-700 delay-700 fill-both' : ''}`} style={{ fontFamily: "'Cairo', sans-serif" }}>
              هل تساءلت يوماً لماذا نشعر بالوحدة<br/>
              حتى ونحن محاطون بعشرات الأشخاص؟<br/>
              في علم النفس، يُسمى هذا بـ "الوحدة الزحامية".<br/>
              أدمغتنا مبرمجة للبحث عن تواصل عميق وحقيقي،<br/>
              وليس مجرد تفاعلات سطحية عابرة.<br/>
              عندما نبتسم ونجامل دون أن نشارك مشاعرنا،<br/>
              يرسل العقل إشارة إنذار بأننا في خطر اجتماعي!<br/>
              الحل ليس في زيادة عدد الأصدقاء حولك،<br/>
              <span className="text-emerald-300">بل في إيجاد شخص واحد تفكر معه بصوت عالٍ. 💡</span>
            </p>
          </div>
        </>
      )
    },
    {
      id: 8,
      type: 'video',
      category: 'علم النفس (غموض)',
      duration: '00:08',
      date: 'الآن',
      music: 'صوت أمواج البحر الأصلي (Veo Audio)',
      videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      renderContent: (isPlaying: boolean) => (
        <>
          <div className={`absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/90 z-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}></div>
          
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 text-emerald-400 text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 z-20">
            <Video className="w-3 h-3" /> Veo 3.1 Fast
          </div>

          <div className={`absolute inset-x-2 bottom-12 flex flex-col items-center justify-center p-2 z-10 transition-opacity duration-1000 ${isPlaying ? 'opacity-100 animate-in fade-in fill-both' : 'opacity-0'}`}>
            <h3 className={`text-emerald-400 font-black text-3xl mb-4 drop-shadow-[0_0_10px_rgba(16,185,129,0.8)] text-center ${isPlaying ? 'animate-in slide-in-from-top-8 fade-in duration-700 delay-300 fill-both' : ''}`}>
              سر نفسي غريب! 🧠
            </h3>
            <p className={`text-white font-bold text-2xl leading-[1.8] text-center drop-shadow-[0_4px_4px_rgba(0,0,0,1)] ${isPlaying ? 'animate-in slide-in-from-bottom-8 fade-in duration-700 delay-700 fill-both' : ''}`} style={{ fontFamily: "'Cairo', sans-serif" }}>
              عندما تتحدث مع شخص ويكذب عليك،<br/>
              فإن معدل رمش عينيه يقل بشكل ملحوظ!<br/>
              ولكن بمجرد أن ينتهي من الكذبة...<br/>
              يبدأ بالرمش بسرعة جنونية<br/>
              تصل إلى 8 أضعاف المعدل الطبيعي!<br/>
              <span className="text-emerald-300 text-xl">(راقب عيونهم في المرة القادمة 👀)</span>
            </p>
          </div>
        </>
      )
    },
    {
      id: 9,
      type: 'video',
      category: 'قصص تاريخية (صدفة)',
      duration: '00:08',
      date: 'الآن',
      music: 'صوت الرياح والأجواء الأصلي (Veo Audio)',
      videoUrl: 'https://vjs.zencdn.net/v/oceans.mp4',
      title: 'أغرب صدفة في التاريخ 📜',
      description: 'مؤسس شركة فيراري (إنزو فيراري) توفي في عام 1988... وفي نفس العام بالضبط 1988! وُلد اللاعب (مسعود أوزيل) الذي يعتبر نسخة طبق الأصل منه في الشكل! هل تؤمن بتناسخ الأرواح؟ 🤯 #Shorts #History #Mystery',
      renderContent: (isPlaying: boolean) => (
        <>
          <div className={`absolute inset-0 bg-amber-900/40 mix-blend-multiply z-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}></div>
          <div className={`absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent z-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}></div>

          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 text-emerald-400 text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 z-20">
            <Video className="w-3 h-3" /> Veo 3.1 Fast
          </div>

          <div className={`absolute inset-x-2 bottom-12 z-10 text-center transition-opacity duration-1000 ${isPlaying ? 'opacity-100 animate-in fade-in fill-both' : 'opacity-0'}`}>
            <div className={`inline-block bg-amber-600 text-white font-black text-2xl px-6 py-2 mb-6 shadow-[0_0_15px_rgba(217,119,6,0.5)] ${isPlaying ? 'animate-in slide-in-from-left-8 fade-in duration-700 delay-300 fill-both' : ''}`}>
              أغرب صدفة في التاريخ 📜
            </div>
            <p className={`text-white font-bold text-2xl leading-[1.8] drop-shadow-[0_5px_5px_rgba(0,0,0,1)] ${isPlaying ? 'animate-in slide-in-from-bottom-8 fade-in duration-700 delay-700 fill-both' : ''}`} style={{ fontFamily: "'Cairo', sans-serif" }}>
              مؤسس شركة فيراري (إنزو فيراري)<br/>
              توفي في عام 1988...<br/>
              وفي نفس العام بالضبط 1988!<br/>
              وُلد اللاعب (مسعود أوزيل) الذي<br/>
              يعتبر نسخة طبق الأصل منه في الشكل!<br/>
              <span className="text-amber-300 text-xl">هل تؤمن بتناسخ الأرواح؟ 🤯</span>
            </p>
          </div>
        </>
      )
    },
    {
      id: 6,
      type: 'image',
      category: 'حقائق تاريخية (Vintage)',
      duration: '00:08',
      date: 'اليوم',
      music: 'معزوفة بيانو كلاسيكية هادئة',
      bgImage: 'https://picsum.photos/seed/history/400/800',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      title: 'حقيقة تاريخية 📜',
      description: 'أقصر حرب في التاريخ حدثت بين بريطانيا وزنجبار عام 1896م... وانتهت بعد 38 دقيقة فقط! #Shorts #History #Facts',
      renderContent: (isPlaying: boolean) => (
        <>
          <div className={`absolute inset-0 bg-amber-900/50 mix-blend-multiply z-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}></div>
          <div className={`absolute inset-0 bg-black/40 z-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}></div>
          
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 text-amber-400 text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 z-20">
            <ImageIcon className="w-3 h-3" /> Animated Template
          </div>

          <div className={`absolute inset-x-4 top-[15%] bottom-[15%] border-y-4 border-amber-500/80 flex flex-col items-center justify-center p-2 z-10 transition-opacity duration-1000 ${isPlaying ? 'opacity-100 animate-in fade-in fill-both' : 'opacity-0'}`}>
            <h3 className={`text-amber-400 font-black text-4xl mb-8 drop-shadow-lg text-center ${isPlaying ? 'animate-in slide-in-from-top-8 fade-in duration-700 delay-300 fill-both' : ''}`}>
              حقيقة تاريخية 📜
            </h3>
            <p className={`text-white font-bold text-3xl leading-relaxed text-center drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] ${isPlaying ? 'animate-in slide-in-from-bottom-8 fade-in duration-700 delay-700 fill-both' : ''}`} style={{ fontFamily: "'Cairo', sans-serif" }}>
              أقصر حرب في التاريخ<br/>
              حدثت بين بريطانيا وزنجبار<br/>
              عام 1896م...<br/>
              وانتهت بعد 38 دقيقة فقط!
            </p>
          </div>
        </>
      )
    },
    {
      id: 7,
      type: 'image',
      category: 'تحفيز ونجاح (Sigma)',
      duration: '00:08',
      date: 'أمس',
      music: 'موسيقى محيطية للتأمل (Ambient)',
      bgImage: 'https://picsum.photos/seed/success/400/800',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      title: 'قاعدة النجاح 🚀',
      description: 'الدافع يجعلك تبدأ، لكن الانضباط هو ما يجعلك تستمر حتى تصل للقمة! #Shorts #Success #Motivation',
      renderContent: (isPlaying: boolean) => (
        <>
          <div className={`absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent z-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}></div>
          
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 text-amber-400 text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 z-20">
            <ImageIcon className="w-3 h-3" /> Animated Template
          </div>

          <div className={`absolute bottom-12 left-2 right-2 z-10 text-center transition-opacity duration-1000 ${isPlaying ? 'opacity-100 animate-in fade-in fill-both' : 'opacity-0'}`}>
            <div className={`inline-block bg-red-600 text-white font-black text-4xl px-6 py-2 mb-8 transform -skew-x-12 shadow-[0_0_15px_rgba(220,38,38,0.5)] ${isPlaying ? 'animate-in slide-in-from-left-8 fade-in duration-700 delay-300 fill-both' : ''}`}>
              قاعدة النجاح 🚀
            </div>
            <p className={`text-white font-black text-3xl leading-[1.8] drop-shadow-[0_5px_5px_rgba(0,0,0,1)] ${isPlaying ? 'animate-in slide-in-from-bottom-8 fade-in duration-700 delay-700 fill-both' : ''}`} style={{ fontFamily: "'Cairo', sans-serif" }}>
              الدافع يجعلك تبدأ،<br/>
              لكن الانضباط<br/>
              هو ما يجعلك تستمر<br/>
              حتى تصل للقمة!
            </p>
          </div>
        </>
      )
    },
    {
      id: 1,
      type: 'image',
      category: 'نكت وطرائف',
      duration: '00:08',
      date: 'اليوم، 10:30 ص',
      music: 'عزف جيتار هادئ ومريح',
      bgImage: 'https://picsum.photos/seed/mountains/400/800',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
      renderContent: (isPlaying: boolean) => (
        <>
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 text-amber-400 text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 z-20">
            <ImageIcon className="w-3 h-3" /> Animated Template
          </div>

          <div className={`absolute top-12 w-full px-6 z-10 flex justify-center transition-opacity duration-1000 ${isPlaying ? 'opacity-100 animate-in slide-in-from-top-8 fade-in fill-both' : 'opacity-0'}`}>
            <div className="bg-[#FFD700] text-black font-bold text-2xl px-6 py-2 rounded-sm shadow-lg">
              نكت وطرائف
            </div>
          </div>
          <div className={`absolute top-1/3 w-[90%] bg-black/60 backdrop-blur-md rounded-xl p-6 z-10 text-center border border-white/20 shadow-2xl transition-opacity duration-1000 ${isPlaying ? 'opacity-100 animate-in zoom-in-95 fade-in delay-300 fill-both' : 'opacity-0'}`}>
            <p className="text-white font-bold text-2xl leading-loose" style={{ fontFamily: "'Cairo', sans-serif" }}>
              سألوا بخيل:<br/>
              وش تسوي لو برد الجو؟<br/>
              قال:<br/>
              أدفى على اللمبة! 💡😂
            </p>
          </div>
        </>
      )
    },
    {
      id: 3,
      type: 'image',
      category: 'معلومات غريبة',
      duration: '00:08',
      date: '22 مارس، 02:00 م',
      music: 'موسيقى Lo-Fi هادئة جداً',
      bgImage: 'https://picsum.photos/seed/brain/400/800',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
      renderContent: (isPlaying: boolean) => (
        <>
          <div className={`absolute inset-0 bg-black/60 z-0 backdrop-blur-sm transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}></div>
          
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 text-amber-400 text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 z-20">
            <ImageIcon className="w-3 h-3" /> Animated Template
          </div>

          <div className={`absolute top-[15%] bottom-[20%] left-4 right-4 bg-[#FFEA00] z-10 p-6 text-center shadow-2xl flex flex-col items-center justify-center transition-opacity duration-1000 ${isPlaying ? 'opacity-100 animate-in zoom-in-75 fade-in fill-both' : 'opacity-0'}`}>
            <h3 className={`text-black font-black text-4xl mb-8 border-b-4 border-black/20 pb-4 w-full ${isPlaying ? 'animate-in slide-in-from-top-4 fade-in duration-500 delay-300 fill-both' : ''}`}>
              هل تعلم؟ 🤯
            </h3>
            <p className={`text-black font-black text-3xl leading-loose ${isPlaying ? 'animate-in slide-in-from-bottom-4 fade-in duration-500 delay-700 fill-both' : ''}`} style={{ fontFamily: "'Cairo', sans-serif" }}>
              عين النعامة<br/>
              أكبر من<br/>
              حجم دماغها!<br/>
              👁️ 🧠
            </p>
          </div>
        </>
      )
    }
  ];

  const allVideos = [...firebaseVideos, ...videos];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10" dir="rtl">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            مكتبة الفيديوهات <Sparkles className="w-5 h-5 text-violet-400" />
          </h2>
          <p className="text-zinc-400 mt-1">
            فيديوهات Veo 3.1 تعمل بأصواتها الطبيعية المدمجة، بينما القوالب المصورة مزودة بمكتبة واسعة من المعزوفات الهادئة.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {allVideos.map((video) => {
          const isPlaying = playingId === video.id;

          return (
            <div key={video.id} className={`bg-zinc-900 border ${isPlaying ? 'border-violet-500 shadow-[0_0_20px_rgba(139,92,246,0.2)]' : 'border-zinc-800'} rounded-2xl overflow-hidden flex flex-col transition-all duration-300`}>
              
              {/* Video Player Mockup */}
              <div className="relative w-full aspect-[9/16] bg-zinc-800 group overflow-hidden">
                
                {video.type === 'video' ? (
                  // Actual Video Element (Veo 3.1 Fast) - Native Audio
                  <>
                    <video
                      ref={(el) => (videoRefs.current[video.id] = el)}
                      src={video.videoUrl}
                      poster={(video as any).poster}
                      className="absolute inset-0 w-full h-full object-cover opacity-80"
                      loop
                      playsInline
                      crossOrigin="anonymous"
                      muted={(video as any).audioUrl ? true : false} // Mute video if we have a separate audio track
                    />
                    {(video as any).audioUrl && (
                      <audio
                        ref={(el) => (audioRefs.current[video.id] = el)}
                        src={(video as any).audioUrl}
                      />
                    )}
                  </>
                ) : (
                  // Animated Image Element + Separate Audio
                  <>
                    <img 
                      src={video.bgImage} 
                      alt={video.category} 
                      className={`absolute inset-0 w-full h-full object-cover opacity-80 transition-transform ease-linear ${isPlaying ? 'scale-125 translate-y-4 duration-[8000ms]' : 'scale-100 translate-y-0 duration-0'}`}
                      referrerPolicy="no-referrer"
                    />
                    <audio
                      ref={(el) => (audioRefs.current[video.id] = el)}
                      src={video.audioUrl}
                    />
                  </>
                )}
                
                {/* Template Content (Remounts on play to trigger animations) */}
                <div key={isPlaying ? 'playing' : 'stopped'} className="absolute inset-0 z-10">
                  {video.renderContent(isPlaying)}
                </div>

                {/* Hover / Play Controls */}
                <div className={`absolute inset-0 bg-black/40 z-30 flex items-center justify-center transition-opacity duration-300 ${isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  <button 
                    onClick={() => togglePlay(video.id)}
                    className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 hover:bg-white/30 transition-all transform hover:scale-110 shadow-xl"
                  >
                    {isPlaying ? (
                      <Square className="w-6 h-6 text-white fill-white" />
                    ) : (
                      <Play className="w-8 h-8 text-white ml-1 fill-white" />
                    )}
                  </button>
                </div>

                {/* Progress Bar (Only visible when playing) */}
                <div className="absolute bottom-0 left-0 w-full h-1.5 bg-zinc-800/80 z-40">
                  <div 
                    className="h-full bg-emerald-500 ease-linear"
                    style={{ 
                      width: isPlaying ? '100%' : '0%', 
                      transition: isPlaying ? 'width 8000ms linear' : 'none' 
                    }}
                  ></div>
                </div>

                {/* Duration Badge */}
                {!isPlaying && (
                  <div className="absolute bottom-3 right-3 bg-black/70 text-white text-xs font-mono px-2 py-1 rounded z-20">
                    {video.duration}
                  </div>
                )}
              </div>

              {/* Video Details & Actions */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-white text-lg">{video.category}</h3>
                    <button className="text-zinc-500 hover:text-white">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500 mb-3">{video.date}</p>
                  
                  <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-950 p-2 rounded-lg border border-zinc-800/50">
                    <Music className="w-3.5 h-3.5 text-violet-400" />
                    <span className="truncate">{video.music}</span>
                  </div>

                  {/* Publishing Status */}
                  <div className="mt-4 space-y-2 bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50">
                    <div className="text-sm text-zinc-300">
                      <span className="font-bold text-zinc-500">الوصف:</span> {video.description || video.overlayText || 'بدون وصف'}
                    </div>
                    {video.publishStatus && (
                      <>
                        <div className="text-sm flex items-center gap-2">
                          <span className="font-bold text-zinc-500">حالة الرفع:</span> 
                          <span className={
                            video.publishStatus === 'published' ? 'text-emerald-400' : 
                            video.publishStatus === 'failed' ? 'text-red-400' : 'text-amber-400'
                          }>
                            {video.publishStatus === 'published' ? 'تم الرفع بنجاح' : 
                             video.publishStatus === 'failed' ? 'فشل الرفع' : 'قيد الانتظار...'}
                          </span>
                        </div>
                        {video.channelName && (
                          <div className="text-sm text-zinc-300">
                            <span className="font-bold text-zinc-500">القناة:</span> {video.channelName}
                          </div>
                        )}
                        {video.youtubeUrl && (
                          <div className="text-sm text-zinc-300">
                            <span className="font-bold text-zinc-500">الرابط:</span> 
                            <a href={video.youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline mr-1" onClick={(e) => e.stopPropagation()}>
                              عرض على يوتيوب
                            </a>
                          </div>
                        )}
                        {video.publishedAt && (
                          <div className="text-xs text-zinc-500 mt-1">
                            آخر تحديث: {new Date(video.publishedAt).toLocaleString('ar-SA')}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-5">
                  <button 
                    onClick={() => video.videoUrl && handleDownload(video.videoUrl, video.title, video.overlayText, video.audioUrl)}
                    className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    تحميل
                  </button>
                  {video.youtubeUrl ? (
                    <a href={video.youtubeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 py-2.5 rounded-xl text-sm font-medium transition-colors">
                      <Youtube className="w-4 h-4" />
                      يوتيوب
                    </a>
                  ) : (
                    <button 
                      onClick={() => {
                        setVideoToPublish(video);
                        setIsChannelSelectionOpen(true);
                      }}
                      className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                    >
                      <Send className="w-4 h-4" />
                      نشر
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {publishingStatus !== 'idle' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md space-y-6">
            <h3 className="text-xl font-bold text-white">
              {publishingStatus === 'downloading' ? 'جاري تحميل الفيديو...' : 
               publishingStatus === 'uploading' ? 'جاري الرفع إلى يوتيوب...' :
               publishingStatus === 'success' ? 'تم النشر بنجاح!' :
               'حدث خطأ أثناء النشر'}
            </h3>
            <div className="w-full bg-zinc-800 rounded-full h-4 overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${publishingStatus === 'error' ? 'bg-red-500' : 'bg-violet-600'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-center text-zinc-400">{progress}%</p>
          </div>
        </div>
      )}
      {isChannelSelectionOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md space-y-6">
            <h3 className="text-xl font-bold text-white">اختر القناة للنشر</h3>
            <div className="space-y-2">
              {channels.map(channel => (
                <button
                  key={channel.id}
                  onClick={() => {
                    handlePublish(videoToPublish!, channel);
                    setIsChannelSelectionOpen(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 bg-zinc-950 hover:bg-zinc-800 rounded-xl border border-zinc-800 transition-all"
                >
                  <img src={channel.thumbnail} alt="" className="w-10 h-10 rounded-full" />
                  <span className="text-white font-bold">{channel.title}</span>
                </button>
              ))}
            </div>
            <button 
              onClick={() => setIsChannelSelectionOpen(false)}
              className="w-full py-3 bg-zinc-800 text-white rounded-xl font-bold"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
