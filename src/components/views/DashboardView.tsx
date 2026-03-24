import { BarChart3, TrendingUp, Video, Youtube, FileText, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../../firebase';

export function DashboardView() {
  const [stats, setStats] = useState({
    totalVideos: 0,
    publishedVideos: 0,
    pendingVideos: 0,
    channelsCount: 0
  });
  const [recentVideos, setRecentVideos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!auth.currentUser) return;
      
      try {
        // Fetch all videos for user
        const videosQuery = query(
          collection(db, 'scheduledVideos'),
          where('userId', '==', auth.currentUser.uid),
          orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(videosQuery);
        let total = 0;
        let published = 0;
        let pending = 0;
        const uniqueChannels = new Set<string>();
        const recent: any[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          total++;
          
          if (data.status === 'published') published++;
          if (data.status === 'pending' || data.status === 'scheduled' || data.status === 'generating') pending++;
          if (data.channelId) uniqueChannels.add(data.channelId);
          
          if (recent.length < 5) {
            recent.push({ id: doc.id, ...data });
          }
        });

        setStats({
          totalVideos: total,
          publishedVideos: published,
          pendingVideos: pending,
          channelsCount: uniqueChannels.size
        });
        setRecentVideos(recent);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [auth.currentUser]);

  const statCards = [
    { label: 'إجمالي الفيديوهات', value: stats.totalVideos.toString(), icon: Video, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'تم النشر', value: stats.publishedVideos.toString(), icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { label: 'قيد الانتظار/العمل', value: stats.pendingVideos.toString(), icon: Clock, color: 'text-violet-400', bg: 'bg-violet-400/10' },
    { label: 'قنوات مرتبطة', value: stats.channelsCount.toString(), icon: Youtube, color: 'text-red-400', bg: 'bg-red-400/10' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir="rtl">
      <div>
        <h2 className="text-2xl font-bold text-white">مرحباً بك في استوديو ShortsAI 👋</h2>
        <p className="text-zinc-400 mt-1">إليك نظرة عامة على أداء مصنع المحتوى الخاص بك اليوم.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${stat.bg}`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-400 font-medium">{stat.label}</p>
                    <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">أحدث الفيديوهات</h3>
              </div>
              <div className="space-y-4">
                {recentVideos.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500">لا توجد فيديوهات حتى الآن</div>
                ) : (
                  recentVideos.map((video) => (
                    <div key={video.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-zinc-800/50 transition-colors cursor-pointer border border-zinc-800/50">
                      <div className="w-16 h-24 bg-zinc-800 rounded-lg flex items-center justify-center relative overflow-hidden flex-shrink-0">
                        {video.thumbnail ? (
                          <img src={video.thumbnail} alt="" className="w-full h-full object-cover opacity-60" />
                        ) : (
                          <Video className="w-6 h-6 text-zinc-600" />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center">
                          {video.status === 'generating' ? <Loader2 className="w-4 h-4 text-violet-400 animate-spin" /> : <Play className="w-4 h-4 text-white/50" />}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-zinc-200 font-medium line-clamp-1" title={video.title}>{video.title}</h4>
                        <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{video.overlayText}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            video.status === 'published' ? 'bg-blue-500/10 text-blue-400' :
                            video.status === 'scheduled' ? 'bg-emerald-500/10 text-emerald-400' :
                            video.status === 'generating' ? 'bg-violet-500/10 text-violet-400' :
                            video.status === 'error' ? 'bg-red-500/10 text-red-400' :
                            'bg-zinc-800 text-zinc-300'
                          }`}>
                            {video.status === 'published' ? 'تم النشر' :
                             video.status === 'scheduled' ? 'مجدول' :
                             video.status === 'generating' ? 'جاري العمل' :
                             video.status === 'error' ? 'خطأ' : 'في الانتظار'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-[10px] font-medium truncate max-w-[100px]" title={video.channelName}>
                            {video.channelName || 'قناة غير معروفة'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-6">المهام القادمة</h3>
              <div className="space-y-4">
                {recentVideos.filter(v => v.status === 'scheduled' || v.status === 'pending').slice(0, 5).map((video, idx) => (
                  <div key={video.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ring-4 ring-zinc-900 ${video.status === 'scheduled' ? 'bg-emerald-500' : 'bg-zinc-500'}`}></div>
                      {idx !== 4 && <div className="w-0.5 h-full bg-zinc-800 my-1"></div>}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium text-white line-clamp-1" title={video.title}>{video.title}</p>
                      <p className="text-xs text-zinc-500 mt-1">{video.scheduledDate} • {video.scheduledTime}</p>
                    </div>
                  </div>
                ))}
                {recentVideos.filter(v => v.status === 'scheduled' || v.status === 'pending').length === 0 && (
                  <div className="text-center py-4 text-zinc-500 text-sm">لا توجد مهام مجدولة</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import { Play } from 'lucide-react';
