import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/views/DashboardView';
import { ResearchView } from './components/views/ResearchView';
import { ScriptView } from './components/views/ScriptView';
import { StudioView } from './components/views/StudioView';
import { LibraryView } from './components/views/LibraryView';
import { PublishView } from './components/views/PublishView';
import { MusicLibraryView } from './components/views/MusicLibraryView';
import { KeysView } from './components/views/KeysView';
import { CloneLibraryView } from './components/views/CloneLibraryView';
import { YouTubeConnectView } from './components/views/YouTubeConnectView';
import { ScheduleView } from './components/views/ScheduleView';
import { ViewType } from './types';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { LogIn, Loader2 } from 'lucide-react';

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Ensure user profile exists in Firestore
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            role: 'user'
          });
        }
        setUser(user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-20 h-20 bg-violet-500/10 rounded-2xl flex items-center justify-center mx-auto">
            <LogIn className="w-10 h-10 text-violet-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white">مرحباً بك في مصنع الفيديوهات</h1>
            <p className="text-zinc-400">سجل دخولك للوصول إلى أدوات الاستنساخ والتحليل الذكي</p>
          </div>
          <button 
            onClick={handleLogin}
            className="w-full bg-white text-black hover:bg-zinc-200 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02]"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            الدخول بواسطة جوجل
          </button>
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return <DashboardView />;
      case 'research': return <ResearchView />;
      case 'script': return <ScriptView />;
      case 'studio': return <StudioView />;
      case 'library': return <LibraryView />;
      case 'music': return <MusicLibraryView />;
      case 'publish': return <PublishView />;
      case 'keys': return <KeysView />;
      case 'clones': return <CloneLibraryView />;
      case 'youtube-connect': return <YouTubeConnectView />;
      case 'schedule': return <ScheduleView />;
      default: return <DashboardView />;
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-50 font-sans">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <main className="flex-1 p-8 overflow-y-auto h-screen">
        <div className="max-w-6xl mx-auto">
          {renderView()}
        </div>
      </main>
    </div>
  );
}
