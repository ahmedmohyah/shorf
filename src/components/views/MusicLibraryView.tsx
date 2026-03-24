import { Play, Square, Download, Music, Search, Filter, Headphones } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export function MusicLibraryView() {
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRefs = useRef<{ [key: number]: HTMLAudioElement | null }>({});

  useEffect(() => {
    Object.keys(audioRefs.current).forEach((key) => {
      const id = parseInt(key);
      const audioEl = audioRefs.current[id];
      
      if (id === playingId) {
        if (audioEl) {
          audioEl.currentTime = 0;
          audioEl.play().catch(e => console.log("Audio play error:", e));
        }
      } else {
        if (audioEl) {
          audioEl.pause();
          audioEl.currentTime = 0;
        }
      }
    });
  }, [playingId]);

  const togglePlay = (id: number) => {
    if (playingId === id) {
      setPlayingId(null);
    } else {
      setPlayingId(id);
    }
  };

  const tracks = [
    {
      id: 1,
      title: 'عزف بيانو هادئ للتأمل',
      category: 'بيانو',
      mood: 'هادئة',
      duration: '03:45',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      color: 'from-blue-500/20 to-cyan-500/20',
      iconColor: 'text-cyan-400'
    },
    {
      id: 2,
      title: 'جيتار حزين وعميق',
      category: 'جيتار',
      mood: 'حزينة',
      duration: '02:30',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      color: 'from-purple-500/20 to-pink-500/20',
      iconColor: 'text-purple-400'
    },
    {
      id: 3,
      title: 'بيانو درامي للقصص',
      category: 'بيانو',
      mood: 'حزينة',
      duration: '04:15',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
      color: 'from-rose-500/20 to-orange-500/20',
      iconColor: 'text-rose-400'
    },
    {
      id: 4,
      title: 'عزف جيتار صوتي نقي',
      category: 'جيتار',
      mood: 'هادئة',
      duration: '03:10',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
      color: 'from-emerald-500/20 to-teal-500/20',
      iconColor: 'text-emerald-400'
    },
    {
      id: 5,
      title: 'موسيقى محيطية غامضة',
      category: 'بيانو',
      mood: 'هادئة',
      duration: '05:20',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
      color: 'from-slate-500/20 to-zinc-500/20',
      iconColor: 'text-slate-400'
    },
    {
      id: 6,
      title: 'لحن جيتار إسباني',
      category: 'جيتار',
      mood: 'هادئة',
      duration: '02:55',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
      color: 'from-amber-500/20 to-yellow-500/20',
      iconColor: 'text-amber-400'
    },
    {
      id: 7,
      title: 'بيانو كلاسيكي حزين',
      category: 'بيانو',
      mood: 'حزينة',
      duration: '04:05',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
      color: 'from-indigo-500/20 to-blue-500/20',
      iconColor: 'text-indigo-400'
    },
    {
      id: 8,
      title: 'جيتار أكوستيك للاسترخاء',
      category: 'جيتار',
      mood: 'هادئة',
      duration: '03:50',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
      color: 'from-lime-500/20 to-green-500/20',
      iconColor: 'text-lime-400'
    },
    {
      id: 9,
      title: 'مقطوعة بيانو للمطر',
      category: 'بيانو',
      mood: 'هادئة',
      duration: '06:15',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
      color: 'from-sky-500/20 to-blue-500/20',
      iconColor: 'text-sky-400'
    },
    {
      id: 10,
      title: 'بيانو الفضاء العميق',
      category: 'بيانو',
      mood: 'هادئة',
      duration: '04:20',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3',
      color: 'from-indigo-900/40 to-purple-900/40',
      iconColor: 'text-indigo-400'
    },
    {
      id: 11,
      title: 'جيتار أعماق المحيط',
      category: 'جيتار',
      mood: 'هادئة',
      duration: '03:40',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3',
      color: 'from-cyan-900/40 to-blue-900/40',
      iconColor: 'text-cyan-400'
    },
    {
      id: 12,
      title: 'بيانو ملحمي للطبيعة',
      category: 'بيانو',
      mood: 'حزينة',
      duration: '05:10',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3',
      color: 'from-emerald-900/40 to-teal-900/40',
      iconColor: 'text-emerald-400'
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10" dir="rtl">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            مكتبة الموسيقى <Headphones className="w-6 h-6 text-violet-400" />
          </h2>
          <p className="text-zinc-400 mt-1">
            استكشف واستمع إلى معزوفات البيانو والجيتار الهادئة والحزينة لإضافتها لفيديوهاتك.
          </p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input 
            type="text" 
            placeholder="ابحث عن مقطع موسيقي..." 
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 pr-10 pl-4 text-white focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-300 px-4 py-2.5 rounded-xl transition-colors">
            <Filter className="w-4 h-4" />
            <span>الكل</span>
          </button>
          <button className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-300 px-4 py-2.5 rounded-xl transition-colors">
            <span>بيانو</span>
          </button>
          <button className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-300 px-4 py-2.5 rounded-xl transition-colors">
            <span>جيتار</span>
          </button>
        </div>
      </div>

      {/* Tracks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tracks.map((track) => {
          const isPlaying = playingId === track.id;

          return (
            <div 
              key={track.id} 
              className={`bg-zinc-900 border ${isPlaying ? 'border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.15)]' : 'border-zinc-800'} rounded-2xl p-4 flex items-center gap-4 transition-all duration-300 hover:border-zinc-700`}
            >
              <audio
                ref={(el) => (audioRefs.current[track.id] = el)}
                src={track.url}
                onEnded={() => setPlayingId(null)}
              />
              
              <button 
                onClick={() => togglePlay(track.id)}
                className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 transition-all ${isPlaying ? 'bg-violet-600 text-white' : `bg-gradient-to-br ${track.color} ${track.iconColor} hover:scale-105`}`}
              >
                {isPlaying ? (
                  <Square className="w-6 h-6 fill-current" />
                ) : (
                  <Play className="w-6 h-6 ml-1 fill-current" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <h3 className="text-white font-bold text-sm truncate">{track.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded-md border border-zinc-800">
                    {track.category}
                  </span>
                  <span className="text-xs text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded-md border border-zinc-800">
                    {track.mood}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className="text-xs text-zinc-500 font-mono">{track.duration}</span>
                <button className="text-zinc-500 hover:text-white transition-colors">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
