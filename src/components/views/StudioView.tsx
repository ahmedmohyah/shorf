import { useState, useEffect } from 'react';
import { Video, Wand2, Play, Settings2, Image as ImageIcon, Type, Loader2, AlertCircle, Palette, Download, History, CheckCircle2, Bookmark, List, Sparkles } from 'lucide-react';
import { db, auth } from '../../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { retryWithBackoff } from '../../lib/ai-client';

interface Background {
  id: string;
  url: string;
  thumbnail: string;
  prompt: string;
  source: 'history' | 'library';
}

const TEMPLATES = [
  { id: 'nano-3', name: 'نانو Gemini (3 صور)' },
  { id: 'nano-3-focus', name: 'نانو Gemini (3 صور - تركيز)' },
  { id: 'nano-2', name: 'نانو Gemini (صورتان)' },
  { id: 'nano-2-split', name: 'نانو Gemini (صورتان - تقسيم)' },
  { id: 'nano-1', name: 'نانو Gemini (صورة واحدة)' },
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
  { id: 'black', name: 'أسود', hex: '#18181b' },
  { id: 'gold', name: 'ذهبي', hex: '#d97706' },
  { id: 'green', name: 'أخضر', hex: '#059669' },
  { id: 'blue', name: 'أزرق', hex: '#2563eb' },
  { id: 'red', name: 'أحمر', hex: '#dc2626' }
];

const CATEGORIES = [
  "عام",
  "حقائق نفسية",
  "قصص تاريخية",
  "معلومات غريبة",
  "تطوير الذات",
  "اقتباسات ملهمة"
];

export function StudioView() {
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [isLoadingBackgrounds, setIsLoadingBackgrounds] = useState(true);
  const [selectedBackground, setSelectedBackground] = useState<Background | null>(null);
  
  const [selectedTemplate, setSelectedTemplate] = useState('nano-3');
  const [selectedColor, setSelectedColor] = useState('red');
  const [overlayText, setOverlayText] = useState("سحر الطبيعة الخلابة\n\nتأمل في جمال الكون واكتشف أسراره المذهلة.");
  const [selectedCategory, setSelectedCategory] = useState("عام");
  const [batchSize, setBatchSize] = useState(1);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSmartGenerating, setIsSmartGenerating] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBackgrounds();
  }, []);

  const fetchBackgrounds = async () => {
    try {
      setIsLoadingBackgrounds(true);
      setError(null);
      
      let allBackgrounds: Background[] = [];

      // Fetch from Geminigen History as default
      const response = await fetch('/api/geminigen/history?filter_by=all&items_per_page=20&page=1');
      if (!response.ok) throw new Error('فشل في جلب الخلفيات من التاريخ');
      
      const data = await response.json();
      if (data.result && data.result.length > 0) {
        allBackgrounds = data.result
          .filter((item: any) => (item.type.includes('video') || item.inference_type.includes('video')))
          .map((item: any) => ({
            id: item.uuid,
            url: item.generate_result || item.last_frame_url || '',
            thumbnail: item.thumbnail_url || item.last_frame_url,
            prompt: item.input_text || 'بدون وصف',
            source: 'history'
          }));
      }

      setBackgrounds(allBackgrounds);
      if (allBackgrounds.length > 0 && !selectedBackground) {
        setSelectedBackground(allBackgrounds[0]);
      }
    } catch (err: any) {
      console.error("Error fetching backgrounds:", err);
      setError("حدث خطأ أثناء جلب الخلفيات. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsLoadingBackgrounds(false);
    }
  };

  const handleSmartGenerate = async () => {
    setIsSmartGenerating(true);
    setError(null);
    try {
      const prompt = `قم بتوليد موضوع جذاب وقصير جداً (لا يتجاوز 15 كلمة) مع عنوان مناسب لفيديو قصير (Shorts) في تصنيف "${selectedCategory}".
      
      يجب أن يكون الرد بالتنسيق التالي فقط:
      [العنوان الجذاب هنا]
      
      [النص القصير هنا]`;

      const generatedText = await retryWithBackoff(async (ai) => {
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
          config: {
            temperature: 0.9,
          }
        });
        return response.text || "";
      });

      if (generatedText) {
        setOverlayText(generatedText.trim());
      } else {
        throw new Error("لم يتم توليد أي نص");
      }
    } catch (err: any) {
      console.error("Smart generation error:", err);
      setError("حدث خطأ أثناء التوليد الذكي للنص. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsSmartGenerating(false);
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

      const bgUrl = selectedBackground.url;
      const templateId = `${selectedTemplate}-${selectedColor}`;
      
      // Construct proxy URL
      const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(bgUrl)}&overlayText=${encodeURIComponent(overlayText)}&templateId=${encodeURIComponent(templateId)}`;

      console.log(`[Studio] Generating with URL: ${bgUrl}`);
      
      // Fetch the video through the proxy
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[Studio] Proxy error:", errorData);
        throw new Error(errorData.details || "فشل توليد الفيديو. تأكد من أن رابط الخلفية صالح.");
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

  // Helper function to render text with newlines
  const renderTextWithNewlines = (text: string) => {
    return text.split('\n').map((line, i) => (
      <span key={i}>
        {line}
        {i !== text.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10" dir="rtl">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wand2 className="w-6 h-6 text-violet-500" />
            استوديو Veo 3.1 (سيرفر)
          </h2>
          <p className="text-zinc-400 mt-1">المعاينة والتوليد من السيرفر بطابور تسلسلي (طلب واحد بعد واحد) حتى 20 طلب نشط.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5">
            <span className="text-sm text-zinc-400 ml-2">الدفعة:</span>
            <input 
              type="number" 
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value) || 1)}
              className="w-12 bg-transparent text-white text-center focus:outline-none" 
              min="1"
              max="20"
            />
          </div>
          <button 
            onClick={handleGenerate}
            disabled={isGenerating || !selectedBackground}
            className="bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors"
          >
            <span>إرسال للطابور</span>
            <Play className="w-5 h-5 fill-current" />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Right Column: Settings */}
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
                <p className="text-zinc-500">لا توجد خلفيات متاحة حالياً.</p>
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
                    {bg.url.toLowerCase().endsWith('.jpg') || bg.url.toLowerCase().endsWith('.png') || bg.url.toLowerCase().endsWith('.jpeg') ? (
                      <img 
                        src={bg.url} 
                        className="w-full h-full object-cover"
                        alt={bg.prompt}
                      />
                    ) : (
                      <video 
                        src={bg.url} 
                        className="w-full h-full object-cover"
                        muted
                        loop
                        autoPlay
                        playsInline
                      />
                    )}
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
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-xs font-medium text-zinc-400">القالب</label>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {TEMPLATES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t.id)}
                      className={`py-2.5 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                        selectedTemplate === t.id 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/50' 
                          : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:bg-zinc-800'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-xs font-medium text-zinc-400">اللون الأساسي</label>
                </div>
                <div className="flex justify-end gap-3">
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
            
            <div className="flex gap-3 mb-4">
              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 w-1/4"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <textarea 
                value={overlayText}
                onChange={(e) => setOverlayText(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 resize-none min-h-[100px]"
                placeholder="اكتب النص هنا..."
                dir="rtl"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button 
                onClick={handleSmartGenerate}
                disabled={isSmartGenerating}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {isSmartGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                توليد ذكي
              </button>
              <button className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors">
                توليد محتوى متنوع
              </button>
              <button className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
                <Wand2 className="w-4 h-4" />
                توليد النص من مولد النصوص
              </button>
            </div>
          </div>

        </div>

        {/* Left Column: Preview & Queue */}
        <div className="xl:col-span-1 space-y-6">
          
          {/* Preview */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[500px] relative overflow-hidden">
            <div className="absolute top-4 right-4 left-4 flex justify-between items-center z-10">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Video className="w-5 h-5 text-zinc-400" />
                المعاينة
              </h3>
            </div>

            <div className="w-[280px] h-[500px] bg-zinc-800 rounded-2xl border border-zinc-700 relative shadow-2xl overflow-hidden flex flex-col items-center group mt-8">
              
              {isGenerating ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/90 backdrop-blur-sm z-30">
                  <Loader2 className="w-10 h-10 text-violet-500 animate-spin mb-4" />
                  <div className="space-y-2 text-center px-4">
                    <p className="text-sm font-medium text-zinc-300">جاري توليد الفيديو مع القالب...</p>
                    <p className="text-xs text-zinc-500">يتم الآن دمج النص مع الخلفية المختارة</p>
                    <div className="w-32 h-1 bg-zinc-800 rounded-full mx-auto overflow-hidden">
                      <div className="h-full bg-violet-500 animate-progress"></div>
                    </div>
                  </div>
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
                  {selectedBackground.url.toLowerCase().endsWith('.jpg') || selectedBackground.url.toLowerCase().endsWith('.png') || selectedBackground.url.toLowerCase().endsWith('.jpeg') ? (
                    <img 
                      src={selectedBackground.url}
                      className="absolute inset-0 w-full h-full object-cover"
                      alt={selectedBackground.prompt}
                    />
                  ) : (
                    <video 
                      src={selectedBackground.url}
                      className="absolute inset-0 w-full h-full object-cover"
                      muted
                      loop
                      autoPlay
                      playsInline
                    />
                  )}
                  {/* Overlay Preview */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 z-20 pointer-events-none">
                    <div className={`w-full max-w-[90%] text-center ${
                      selectedTemplate.includes('nano') ? 'bg-black/40 backdrop-blur-sm border border-white/20 p-4 rounded-xl' :
                      selectedTemplate === 'sigma' ? 'bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 rounded-t-3xl mt-auto' :
                      selectedTemplate === 'modern' ? 'bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-2xl shadow-2xl' :
                      selectedTemplate === 'neon' ? 'bg-black/60 border-2 border-current p-4 rounded-xl shadow-[0_0_15px_currentColor]' :
                      selectedTemplate === 'elegant' ? 'bg-black/30 backdrop-blur-md border-y border-white/30 py-6 px-4' :
                      selectedTemplate === 'bold' ? 'bg-black p-6 border-4 border-current transform -skew-x-6' :
                      selectedTemplate === 'minimal' ? 'bg-transparent p-4' :
                      selectedTemplate === 'cinematic' ? 'bg-gradient-to-b from-transparent via-black/60 to-black p-8 mt-auto' :
                      selectedTemplate === 'tech' ? 'bg-black/80 border border-current p-4 font-mono' :
                      selectedTemplate === 'news' ? 'bg-blue-900/90 border-b-4 border-current p-4 mt-auto w-full max-w-full rounded-none' :
                      selectedTemplate === 'story' ? 'bg-black/40 p-6 rounded-3xl backdrop-blur-sm' :
                      'bg-black/50 p-4 rounded-lg'
                    }`}
                    style={{ color: COLORS.find(c => c.id === selectedColor)?.hex || '#ffffff' }}
                    >
                      <h2 className={`mb-2 ${
                        selectedTemplate.includes('nano') ? 'text-2xl font-bold text-white drop-shadow-md' :
                        selectedTemplate === 'sigma' ? 'text-3xl font-bold text-white drop-shadow-lg' :
                        selectedTemplate === 'modern' ? 'text-2xl font-medium text-white tracking-wide' :
                        selectedTemplate === 'neon' ? 'text-3xl font-black drop-shadow-[0_0_8px_currentColor]' :
                        selectedTemplate === 'elegant' ? 'text-2xl font-serif text-white tracking-widest' :
                        selectedTemplate === 'bold' ? 'text-4xl font-black uppercase tracking-tighter' :
                        selectedTemplate === 'minimal' ? 'text-xl font-light text-white tracking-widest' :
                        selectedTemplate === 'cinematic' ? 'text-3xl font-bold text-white tracking-widest uppercase' :
                        selectedTemplate === 'tech' ? 'text-xl font-bold text-green-400 tracking-tight' :
                        selectedTemplate === 'news' ? 'text-2xl font-bold text-white' :
                        selectedTemplate === 'story' ? 'text-2xl font-medium text-white leading-relaxed' :
                        'text-xl font-bold text-white'
                      }`}>
                        {overlayText.split('\n')[0]}
                      </h2>
                      {overlayText.split('\n').length > 1 && (
                        <p className={`leading-relaxed ${
                          selectedTemplate.includes('nano') ? 'text-base text-gray-200 drop-shadow' :
                          selectedTemplate === 'sigma' ? 'text-lg text-gray-300 drop-shadow-md' :
                          selectedTemplate === 'modern' ? 'text-sm text-gray-200 font-light' :
                          selectedTemplate === 'neon' ? 'text-lg text-white drop-shadow-[0_0_5px_currentColor]' :
                          selectedTemplate === 'elegant' ? 'text-sm text-gray-300 font-serif italic' :
                          selectedTemplate === 'bold' ? 'text-xl font-bold text-white' :
                          selectedTemplate === 'minimal' ? 'text-sm text-gray-400 font-light' :
                          selectedTemplate === 'cinematic' ? 'text-base text-gray-300' :
                          selectedTemplate === 'tech' ? 'text-xs text-green-500 font-mono' :
                          selectedTemplate === 'news' ? 'text-sm text-gray-200' :
                          selectedTemplate === 'story' ? 'text-base text-gray-200' :
                          'text-sm text-gray-300'
                        }`}>
                          {renderTextWithNewlines(overlayText.substring(overlayText.indexOf('\n') + 1).trim())}
                        </p>
                      )}
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

          {/* Queue */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white flex items-center gap-2">
                <List className="w-5 h-5 text-violet-400" />
                طابور الاستوديو
              </h3>
              <button className="text-xs text-zinc-400 hover:text-white flex items-center gap-1">
                <History className="w-3 h-3" /> تحديث
              </button>
            </div>
            
            <div className="flex justify-between text-xs text-zinc-400 mb-4">
              <span>إجمالي: 21</span>
              <span>نشط: 0/20</span>
            </div>

            <div className="space-y-2">
              {/* Mock queue item */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-emerald-400 text-xs font-bold">completed</span>
                  <span className="text-zinc-500 text-[10px]">studio_1774896472549_6343</span>
                </div>
                <span className="text-zinc-500 text-xs">٩:٤٧:٥٢ م</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

