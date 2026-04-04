import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Video, Loader2, Search, Filter, RefreshCw, Bookmark, BookmarkCheck, CheckCircle2 } from 'lucide-react';
import { db, auth } from '../../firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';

interface HistoryItem {
  id: number;
  uuid: string;
  model_name: string;
  input_text: string;
  generate_result: string;
  type: string;
  status: number;
  status_desc: string;
  created_at: string;
  inference_type: string;
  name: string;
  thumbnail_url: string;
  last_frame_url?: string;
}

export function BackgroundsView() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [savedUuids, setSavedUuids] = useState<Set<string>>(new Set());
  const [savingUuid, setSavingUuid] = useState<string | null>(null);

  const fetchSavedBackgrounds = async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(collection(db, 'backgrounds'), where('userId', '==', auth.currentUser.uid));
      const querySnapshot = await getDocs(q);
      const uuids = new Set<string>();
      querySnapshot.forEach((doc) => {
        uuids.add(doc.data().uuid);
      });
      setSavedUuids(uuids);
    } catch (err) {
      console.error('Error fetching saved backgrounds:', err);
    }
  };

  const fetchHistory = async (pageNum = 1) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/geminigen/history?filter_by=all&items_per_page=20&page=${pageNum}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setHistory(pageNum === 1 ? data.result : [...history, ...data.result]);
        setTotalPages(Math.ceil(data.total / 20));
        setPage(pageNum);
      } else {
        throw new Error('Failed to fetch history');
      }
    } catch (err) {
      console.error('Error fetching backgrounds:', err);
      setError('حدث خطأ أثناء جلب الخلفيات. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(1);
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchSavedBackgrounds();
      } else {
        setSavedUuids(new Set());
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSaveToLibrary = async (item: HistoryItem) => {
    if (!auth.currentUser) {
      alert('يرجى تسجيل الدخول أولاً');
      return;
    }
    if (savedUuids.has(item.uuid)) return;

    setSavingUuid(item.uuid);
    try {
      // Construct video URL if it's a video and generate_result is null
      let videoUrl = item.generate_result;
      if (!videoUrl && item.last_frame_url && (item.type.includes('video') || item.inference_type.includes('video'))) {
        videoUrl = item.last_frame_url;
      }

      await addDoc(collection(db, 'backgrounds'), {
        uuid: item.uuid,
        url: videoUrl || item.thumbnail_url,
        thumbnail: item.thumbnail_url || item.last_frame_url,
        prompt: item.input_text || 'بدون وصف',
        userId: auth.currentUser.uid,
        createdAt: new Date().toISOString(),
        serverCreatedAt: serverTimestamp()
      });

      setSavedUuids(prev => new Set(prev).add(item.uuid));
    } catch (err) {
      console.error('Error saving background:', err);
      alert('حدث خطأ أثناء حفظ الخلفية');
    } finally {
      setSavingUuid(null);
    }
  };

  const filteredHistory = history.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'image') return item.type.includes('image') || item.inference_type.includes('image');
    if (filter === 'video') return item.type.includes('video') || item.inference_type.includes('video');
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/20 rounded-xl">
            <ImageIcon className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">مكتبة الخلفيات</h2>
            <p className="text-zinc-400">استدعاء الخلفيات من Geminigen History وحفظها في مكتبتك الخاصة</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              الكل
            </button>
            <button
              onClick={() => setFilter('image')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${filter === 'image' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              <ImageIcon className="w-4 h-4" />
              صور
            </button>
            <button
              onClick={() => setFilter('video')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${filter === 'video' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              <Video className="w-4 h-4" />
              فيديو
            </button>
          </div>
          
          <button 
            onClick={() => fetchHistory(1)}
            className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="تحديث"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-center">
          {error}
        </div>
      )}

      {loading && history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <p className="text-zinc-400">جاري جلب الخلفيات...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredHistory.map((item) => {
              const videoUrl = item.generate_result || item.last_frame_url || '';
              const isVideo = (item.type.includes('video') || item.inference_type.includes('video')) && 
                              !videoUrl.toLowerCase().endsWith('.jpg') && 
                              !videoUrl.toLowerCase().endsWith('.png') && 
                              !videoUrl.toLowerCase().endsWith('.jpeg');
              
              return (
                <div key={item.uuid} className="group relative aspect-[9/16] bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 hover:border-blue-500/50 transition-colors">
                  {isVideo ? (
                    <video 
                      src={videoUrl} 
                      poster={item.thumbnail_url}
                      className="w-full h-full object-cover"
                      muted 
                      loop 
                      onMouseEnter={(e) => e.currentTarget.play()}
                      onMouseLeave={(e) => {
                        e.currentTarget.pause();
                        e.currentTarget.currentTime = 0;
                      }}
                    />
                  ) : (
                    <img 
                      src={item.thumbnail_url || item.generate_result} 
                      alt={item.input_text}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  )}
                  
                  <div className="absolute inset-x-0 top-0 p-3 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <button
                      onClick={() => handleSaveToLibrary(item)}
                      disabled={savedUuids.has(item.uuid) || savingUuid === item.uuid}
                      className={`p-2 rounded-lg backdrop-blur-md transition-all ${
                        savedUuids.has(item.uuid) 
                          ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
                          : 'bg-black/40 text-white border border-white/20 hover:bg-blue-600 hover:border-blue-500'
                      }`}
                      title={savedUuids.has(item.uuid) ? 'محفوظ في المكتبة' : 'حفظ في المكتبة'}
                    >
                      {savingUuid === item.uuid ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : savedUuids.has(item.uuid) ? (
                        <BookmarkCheck className="w-4 h-4" />
                      ) : (
                        <Bookmark className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                    <p className="text-white text-xs line-clamp-3 mb-2" dir="auto">{item.input_text}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400 bg-zinc-800/80 px-2 py-1 rounded-md">
                        {item.model_name}
                      </span>
                      {isVideo ? (
                        <Video className="w-4 h-4 text-blue-400" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-purple-400" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {page < totalPages && (
            <div className="flex justify-center mt-8">
              <button
                onClick={() => fetchHistory(page + 1)}
                disabled={loading}
                className="px-6 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                تحميل المزيد
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
