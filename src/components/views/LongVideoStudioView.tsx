import React, { useState } from 'react';
import { Video, Wand2, Loader2, Play, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { GoogleGenAI, Type, Modality } from '@google/genai';
import { getCurrentApiKey } from '../../lib/ai-client';
import { db, auth } from '../../firebase';
import { collection, addDoc } from 'firebase/firestore';

export function LongVideoStudioView() {
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!topic) return;
    setIsGenerating(true);
    setProgress(0);
    setError(null);
    setVideoUrl(null);

    try {
      const apiKey = getCurrentApiKey();
      if (!apiKey) throw new Error('API Key is missing');
      const ai = new GoogleGenAI({ apiKey });

      // 1. Generate Script and Image Prompts
      setStatusText('جاري كتابة السيناريو وتحديد المشاهد...');
      setProgress(10);
      
      const scriptResponse = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `اكتب سيناريو احترافي وجذاب لفيديو يوتيوب مدته دقيقة واحدة (حوالي 120 إلى 150 كلمة) عن الموضوع التالي: "${topic}".
        قم بتقسيم السيناريو إلى 8 مشاهد متتالية.
        لكل مشهد، قدم النص الذي سيتم قراءته (text)، ووصف دقيق جداً للصورة التي تعبر عن المشهد باللغة الإنجليزية (imagePrompt).
        يجب أن يكون وصف الصورة (imagePrompt) سينمائياً، عالي الجودة، واقعي جداً، وجذاباً للمشاهد (Cinematic, photorealistic, highly detailed, 8k resolution, dramatic lighting). المشهد الأول يجب أن يكون جذاباً جداً ليستخدم كصورة مصغرة (Thumbnail).`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING, description: 'النص العربي للمشهد' },
                imagePrompt: { type: Type.STRING, description: 'وصف الصورة باللغة الإنجليزية' }
              },
              required: ['text', 'imagePrompt']
            }
          }
        }
      });

      const scenes = JSON.parse(scriptResponse.text || '[]');
      if (!scenes || scenes.length === 0) throw new Error('فشل في توليد السيناريو');

      // 2 & 3. Generate Images and Audio per scene
      const processedScenes = [];
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        setStatusText(`جاري توليد الصورة والصوت للمشهد ${i + 1} من ${scenes.length}...`);
        
        // Generate Image
        const imageResponse = await ai.models.generateContent({
          model: 'gemini-3.1-flash-image-preview',
          contents: scene.imagePrompt,
          config: {
            imageConfig: {
              aspectRatio: '16:9',
              imageSize: '1K'
            }
          }
        });
        
        let base64Image = null;
        for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            base64Image = part.inlineData.data;
            break;
          }
        }
        if (!base64Image) throw new Error(`فشل في توليد الصورة للمشهد ${i + 1}`);

        // Generate Audio
        const audioResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-preview-tts',
          contents: [{ parts: [{ text: scene.text }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Zephyr' }
              }
            }
          }
        });

        const base64Audio = audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new Error(`فشل في توليد التعليق الصوتي للمشهد ${i + 1}`);

        processedScenes.push({
          text: scene.text,
          image: base64Image,
          audio: base64Audio
        });

        setProgress(10 + ((i + 1) / scenes.length) * 70); // Progress from 10% to 80%
      }

      // 4. Send to backend to render video
      setStatusText('جاري دمج المشاهد وإضافة الترجمة والموسيقى (قد يستغرق بعض الوقت)...');
      setProgress(80);
      
      const renderRes = await fetch('/api/video/render-long', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenes: processedScenes,
          topic
        })
      });

      if (!renderRes.ok) {
        let errorMessage = 'فشل في إنشاء الفيديو';
        try {
          const errData = await renderRes.json();
          errorMessage = errData.error || errorMessage;
        } catch (e) {
          // If response is not JSON (e.g. 502 Bad Gateway or 413 Payload Too Large HTML page)
          errorMessage = `خطأ في الخادم (الكود: ${renderRes.status})`;
        }
        throw new Error(errorMessage);
      }

      const renderData = await renderRes.json();
      setVideoUrl(renderData.videoUrl);
      setProgress(100);
      setStatusText('تم إنشاء الفيديو بنجاح! تم حفظه في مكتبة الفيديوهات.');

      // 5. Save to Library (Firestore)
      if (auth.currentUser) {
        try {
          await addDoc(collection(db, 'scheduledVideos'), {
            title: topic,
            overlayText: topic,
            veoPrompt: topic,
            category: 'فيديو طويل',
            template: 'long-video',
            status: 'completed',
            rawTimestamp: Date.now(),
            userId: auth.currentUser.uid,
            createdAt: new Date().toISOString(),
            videoUrl: renderData.videoUrl,
            thumbnail: `data:image/jpeg;base64,${processedScenes[0].image}`
          });
        } catch (saveErr) {
          console.error("Failed to save to library:", saveErr);
        }
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">استديو الفيديوهات الطويلة</h1>
          <p className="text-zinc-400">قم بإنشاء فيديوهات وثائقية أو تعليمية طويلة بضغطة زر</p>
        </div>
        <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center border border-blue-500/30">
          <Video className="w-6 h-6 text-blue-400" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-white">موضوع الفيديو</label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="مثال: تاريخ الذكاء الاصطناعي وتأثيره على المستقبل..."
                className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !topic}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  جاري الإنشاء...
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  إنشاء الفيديو
                </>
              )}
            </button>
          </div>

          {isGenerating && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-400 font-medium">{statusText}</span>
                <span className="text-zinc-400 font-mono">{Math.round(progress)}%</span>
              </div>
              <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col">
          <h2 className="text-lg font-bold text-white mb-4">النتيجة النهائية</h2>
          
          <div className="flex-1 bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden relative flex items-center justify-center min-h-[300px]">
            {videoUrl ? (
              <video 
                src={videoUrl} 
                controls 
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto">
                  <Play className="w-6 h-6 text-zinc-700 ml-1" />
                </div>
                <p className="text-zinc-500 text-sm">سيظهر الفيديو هنا بعد الانتهاء من توليده</p>
              </div>
            )}
          </div>

          {videoUrl && (
            <div className="mt-4 flex justify-end">
              <a 
                href={videoUrl}
                download={`video-${Date.now()}.mp4`}
                className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold flex items-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                تحميل الفيديو
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
