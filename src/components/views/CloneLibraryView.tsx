import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { VideoClone } from '../../types';
import { Database, Play, FileJson, Trash2, ExternalLink, Loader2, Search, Filter } from 'lucide-react';

export function CloneLibraryView() {
  const [clones, setClones] = useState<VideoClone[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'videoClones'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clonesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as VideoClone[];
      setClones(clonesData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching clones:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredClones = clones.filter(clone => 
    clone.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    clone.url.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Database className="w-7 h-7 text-violet-500" />
            مكتبة الاستنساخ الذكي
          </h2>
          <p className="text-zinc-400 mt-1">جميع الفيديوهات التي تم تحليلها واستخراج بياناتها</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text"
              placeholder="بحث في المكتبة..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl py-2 pr-10 pl-4 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50 w-64"
            />
          </div>
          <button className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
          <p className="text-zinc-500">جاري تحميل المكتبة...</p>
        </div>
      ) : filteredClones.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 border-dashed rounded-3xl p-20 text-center space-y-4">
          <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto">
            <Database className="w-10 h-10 text-zinc-600" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">المكتبة فارغة</h3>
            <p className="text-zinc-500">ابدأ بتحليل أول فيديو لك من قسم البحث</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClones.map((clone) => (
            <div key={clone.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden group hover:border-violet-500/50 transition-all duration-300 flex flex-col">
              <div className="relative aspect-video">
                <img src={clone.thumbnail} alt={clone.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                    <Play className="w-5 h-5 fill-current" />
                  </button>
                  <button className="w-10 h-10 bg-zinc-900 text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                    <FileJson className="w-5 h-5" />
                  </button>
                </div>
                <div className="absolute top-2 right-2 px-2 py-1 bg-black/80 rounded text-[10px] font-bold text-white uppercase tracking-wider">
                  {clone.type}
                </div>
              </div>
              
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="text-white font-bold line-clamp-2 mb-2" dir="auto">{clone.title}</h4>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span className="truncate max-w-[150px]">{clone.url}</span>
                    <span>•</span>
                    <span>{new Date(clone.createdAt?.toDate()).toLocaleDateString('ar-EG')}</span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-500 uppercase">الثقة</span>
                      <span className="text-xs font-bold text-emerald-400">%{clone.confidenceScore || 95}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-500 uppercase">المشاهد</span>
                      <span className="text-xs font-bold text-white">{clone.metadata?.sceneCount || 0}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-zinc-500 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-zinc-500 hover:text-violet-400 transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
