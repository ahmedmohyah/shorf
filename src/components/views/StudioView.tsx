import { useState, useEffect } from 'react';
import { Video, Wand2, Play, Settings2, Image as ImageIcon, Type, Loader2, AlertCircle, Palette, Download, History, CheckCircle2 } from 'lucide-react';

interface Background {
  id: string;
  url: string;
  thumbnail: string;
  prompt: string;
}

const TEMPLATES = [
  { id: 'sigma', name: 'سيجما (كلاسيكي)' },
  { id: 'modern', name: 'عصري (حديث)' },
  { id: 'neon', name: 'نيون (مضيء)' },
  { id: 'elegant', name: 'أنيق (راقي)' },
  { id: 'bold', name: 'عريض (بارز)' },
  { id: 'minimal', name: 'بسيط (هادئ)' },
  { id: 'cinematic', name: 'سينمائي (درامي)' },
  { id: 'tech', name: 'تقني (رقمي)' },
  { id: 'news', name: 'إخباري (رسمي)' },
  { id: 'story', name: 'قصصي (روائي)' }
];

const COLORS = [
  { id: 'red', name: 'أحمر', hex: '#ef4444' },
  { id: 'blue', name: 'أزرق', hex: '#3b82f6' },
  { id: 'green', name: 'أخضر', hex: '#10b981' },
  { id: 'gold', name: 'ذهبي', hex: '#f59e0b' }
];

export function StudioView() {
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [isLoadingBackgrounds, setIsLoadingBackgrounds] = useState(true);
  const [selectedBackground, setSelectedBackground] = useState<Background | null>(null);
  
  const [selectedTemplate, setSelectedTemplate] = useState('sigma');
  const [selectedColor, setSelectedColor] = useState('red');
  const [overlayText, setOverlayText] = useState("عنوان الفيديو\n\nاكتب هنا النص الذي تريده أن يظهر في الفيديو. يمكنك إضافة عدة أسطر.");
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBackgrounds();
  }, []);

  const fetchBackgrounds = async () => {
    try {
      setIsLoadingBackgrounds(true);
      const response = await fetch('/api/geminigen/history?filter_by=all&items_per_page=20&page=1');
      if (!response.ok) throw new Error('فشل في جلب الخلفيات');
      
      const data = await response.json();
      if (data.result && data.result.length > 0) {
        const formattedBackgrounds = data.result
          .filter((item: any) => item.status === 2 && item.last_frame_url)
          .map((item: any) => ({
            id: item.uuid,
            url: item.last_frame_url.replace('_last_frame.jpg', '.mp4'),
            thumbnail: item.thumbnail_url || item.last_frame_url,
            prompt: item.input_text || 'بدون وصف'
          }));
        setBackgrounds(formattedBackgrounds);
        if (formattedBackgrounds.length > 0) {
          setSelectedBackground(formattedBackgrounds[0]);
        }
      }
    } catch (err: any) {
      console.error("Error fetching backgrounds:", err);
      setError("حدث خطأ أثناء جلب الخلفيات. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsLoadingBackgrounds(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedBackground) {
      setError("يرجى اختيار خلفية أولاً");
      return;
    }

    try {
      setError(null);
      setIsGenerating(true);
      setGeneratedVideoUrl(null);

      const templateId = `${selectedTemplate}-${selectedColor}`;
      const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(selectedBackground.url)}&overlayText=${encodeURIComponent(overlayText)}&templateId=${encodeURIComponent(templateId)}`;

      // Fetch the video through the proxy
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        throw new Error("فشل توليد الفيديو");
      }

      const blob = await response.blob();
      const videoUrl = URL.createObjectURL(blob);
      
      setGeneratedVideoUrl(videoUrl);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "حدث خطأ غير متوقع أثناء توليد الفيديو");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10" dir="rtl">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wand2 className="w-6 h-6 text-violet-500" />
            استوديو الإنتاج السريع
          </h2>
          <p className="text-zinc-400 mt-1">اختر خلفية، حدد القالب، واكتب النص لإنشاء فيديو احترافي فوراً.</p>
        </div>
        <button 
          onClick={handleGenerate}
          disabled={isGenerating || !selectedBackground}
          className="bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors"
        >
          {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
          <span>{isGenerating ? 'جاري التوليد...' : 'توليد الفيديو'}</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column: Settings */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Background Selection */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-violet-400" />
                1. اختيار الخلفية
              </h3>
              <button 
                onClick={fetchBackgrounds}
                disabled={isLoadingBackgrounds}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
              >
                <History className="w-3 h-3" /> تحديث
              </button>
            </div>
            
            {isLoadingBackgrounds ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Loader2 className="w-8 h-8 text-violet-500 animate-spin mb-2" />
                <p className="text-sm text-zinc-500">جاري تحميل الخلفيات...</p>
              </div>
            ) : backgrounds.length === 0 ? (
              <div className="text-center py-10 bg-zinc-950 rounded-xl border border-zinc-800 border-dashed">
                <p className="text-zinc-500">لا توجد خلفيات متاحة. قم بإنشاء خلفيات أولاً في مكتبة الخلفيات.</p>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
                {backgrounds.map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => setSelectedBackground(bg)}
                    className={`relative flex-shrink-0 w-24 h-40 rounded-xl overflow-hidden border-2 transition-all ${
                      selectedBackground?.id === bg.id ? 'border-violet-500 scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <video 
                      src={bg.url} 
                      className="w-full h-full object-cover"
                      muted
                      loop
                      autoPlay
                      playsInline
                    />
                    {selectedBackground?.id === bg.id && (
                      <div className="absolute inset-0 bg-violet-500/20 flex items-center justify-center">
                        <div className="w-6 h-6 bg-violet-500 rounded-full flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Template Selection */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <Palette className="w-5 h-5 text-emerald-400" />
              2. اختيار القالب واللون
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">القالب</label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {TEMPLATES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t.id)}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                        selectedTemplate === t.id 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                          : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:bg-zinc-800'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">اللون الأساسي</label>
                <div className="flex gap-3">
                  {COLORS.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedColor(c.id)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                        selectedColor === c.id ? 'ring-2 ring-offset-2 ring-offset-zinc-900 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    >
                      {selectedColor === c.id && <CheckCircle2 className="w-5 h-5 text-white drop-shadow-md" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Text Input */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <Type className="w-5 h-5 text-blue-400" />
              3. النص المضاف
            </h3>
            
            <textarea 
              value={overlayText}
              onChange={(e) => setOverlayText(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-200 focus:outline-none focus:border-violet-500 resize-none font-bold leading-loose" 
              rows={5}
              dir="rtl"
              placeholder="اكتب النص الذي سيظهر فوق الفيديو..."
            />
            <p className="text-[10px] text-zinc-500 mt-2">
              * استخدم سطرين فارغين (Enter مرتين) للفصل بين العنوان والنص الرئيسي.
            </p>
          </div>

        </div>

        {/* Right Column: Preview Player */}
        <div className="xl:col-span-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[600px] relative overflow-hidden">
          <h3 className="absolute top-4 right-4 font-bold text-white flex items-center gap-2 z-10">
            <Video className="w-5 h-5 text-zinc-400" />
            المعاينة
          </h3>

          <div className="w-[320px] h-[568px] bg-zinc-800 rounded-2xl border border-zinc-700 relative shadow-2xl overflow-hidden flex flex-col items-center group mt-8">
            
            {isGenerating ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/90 backdrop-blur-sm z-30">
                <Loader2 className="w-10 h-10 text-violet-500 animate-spin mb-4" />
                <p className="text-sm font-medium text-zinc-300 text-center px-4">جاري توليد الفيديو مع القالب...</p>
                <p className="text-xs text-zinc-500 mt-2">قد يستغرق هذا بضع ثوانٍ</p>
              </div>
            ) : generatedVideoUrl ? (
              <>
                <video 
                  src={generatedVideoUrl}
                  className="absolute inset-0 w-full h-full object-cover"
                  controls
                  autoPlay
                  loop
                  playsInline
                />
                <div className="absolute top-2 left-2 z-20">
                  <a 
                    href={generatedVideoUrl} 
                    download={`video-${selectedTemplate}-${Date.now()}.mp4`}
                    className="w-10 h-10 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-violet-600 transition-colors text-white"
                    title="تحميل الفيديو"
                  >
                    <Download className="w-5 h-5" />
                  </a>
                </div>
              </>
            ) : selectedBackground ? (
              <>
                <video 
                  src={selectedBackground.url}
                  className="absolute inset-0 w-full h-full object-cover opacity-60"
                  muted
                  loop
                  autoPlay
                  playsInline
                />
                <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                  <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10 text-center">
                    <p className="text-sm font-bold text-white">معاينة الخلفية</p>
                    <p className="text-xs text-zinc-400 mt-1">اضغط "توليد الفيديو" لرؤية النتيجة</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 p-6 text-center">
                <ImageIcon className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm">يرجى اختيار خلفية من القائمة للبدء</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
