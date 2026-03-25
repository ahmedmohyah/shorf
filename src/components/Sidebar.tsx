import React from 'react';
import { 
  LayoutDashboard, 
  Search, 
  FileText, 
  Video, 
  CalendarClock, 
  Settings,
  Sparkles,
  Library,
  Music,
  Key,
  Database,
  LogOut,
  Youtube
} from 'lucide-react';
import { ViewType } from '../types';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

interface SidebarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const handleLogout = () => {
    signOut(auth);
  };
  const navItems: { id: ViewType; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
    { id: 'research', label: 'البحث والسحب', icon: Search },
    { id: 'clones', label: 'مكتبة الاستنساخ', icon: Database },
    { id: 'script', label: 'توليد النصوص', icon: FileText },
    { id: 'studio', label: 'استوديو Veo 3.1', icon: Video },
    { id: 'library', label: 'مكتبة الفيديوهات', icon: Library },
    { id: 'schedule', label: 'النشر والجدولة', icon: CalendarClock },
    { id: 'youtube-connect', label: 'ربط يوتيوب', icon: Youtube },
    { id: 'keys', label: 'مفاتيح API', icon: Key },
  ];

  return (
    <aside className="w-64 bg-zinc-900 border-l border-zinc-800 flex flex-col h-screen sticky top-0" dir="rtl">
      <div className="p-6 flex items-center gap-3 border-b border-zinc-800">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-tight text-white">ShortsAI</h1>
          <p className="text-xs text-zinc-400 font-medium">استوديو الأتمتة</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-violet-500/10 text-violet-400 font-semibold' 
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-violet-400' : 'text-zinc-500'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-zinc-800 space-y-1">
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 transition-all duration-200">
          <Settings className="w-5 h-5 text-zinc-500" />
          <span>الإعدادات</span>
        </button>
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  );
}
