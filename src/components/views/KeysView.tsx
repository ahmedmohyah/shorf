import { useState, useEffect } from 'react';
import { Key, CheckCircle2, XCircle, Loader2, RefreshCw, ShieldCheck, AlertTriangle, List, Shield } from 'lucide-react';
import { retryWithBackoff, API_KEYS } from '../../lib/ai-client';

export function KeysView() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'success' | 'error' | null, message: string }>({ status: null, message: '' });

  const checkKeyStatus = async () => {
    try {
      // @ts-ignore
      if (window.aistudio) {
        // @ts-ignore
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } else {
        // Fallback check if running outside standard iframe but has env var
        // @ts-ignore
        const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
        setHasKey(!!apiKey);
      }
    } catch (err) {
      console.error("Error checking key status:", err);
      setHasKey(false);
    }
  };

  useEffect(() => {
    checkKeyStatus();
  }, []);

  const handleSelectKey = async () => {
    try {
      // @ts-ignore
      if (window.aistudio) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
        // Give it a moment to update
        setTimeout(checkKeyStatus, 1000);
      } else {
        setTestResult({ 
          status: 'error', 
          message: 'هذه الميزة متاحة فقط داخل بيئة AI Studio.' 
        });
      }
    } catch (err) {
      console.error("Error opening key selector:", err);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult({ status: null, message: '' });

    try {
      // Test with a fast model
      const response = await retryWithBackoff((ai) => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: 'Reply with "OK" if you receive this.',
      }));

      if (response.text) {
        setTestResult({ 
          status: 'success', 
          message: 'تم الاتصال بنجاح! المفتاح صالح ويعمل بشكل صحيح.' 
        });
      } else {
        throw new Error("استجابة فارغة من الخادم.");
      }
    } catch (err: any) {
      console.error("API Test Error:", err);
      let errorMessage = err.message || "حدث خطأ غير معروف أثناء الاتصال.";
      
      if (errorMessage.includes("API key not valid") || errorMessage.includes("Requested entity was not found")) {
        errorMessage = "مفتاح API غير صالح أو غير موجود. يرجى اختيار مفتاح صحيح.";
      } else if (errorMessage.includes("quota") || errorMessage.includes("429")) {
        errorMessage = "تم تجاوز الحد المسموح (Quota Exceeded) لهذا المفتاح.";
      }

      setTestResult({ 
        status: 'error', 
        message: errorMessage 
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir="rtl">
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          إدارة المفاتيح <Key className="w-6 h-6 text-violet-400" />
        </h2>
        <p className="text-zinc-400 mt-1">تحقق من حالة اتصال مفتاح API الخاص بك واختبر قدرته على التوليد.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-zinc-400" />
            حالة المفتاح الحالي
          </h3>
          
          <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-xl border border-zinc-800 mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasKey ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                {hasKey ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-sm font-medium text-white">حالة الاتصال</p>
                <p className={`text-xs ${hasKey ? 'text-emerald-400' : 'text-red-400'}`}>
                  {hasKey === null ? 'جاري التحقق...' : hasKey ? 'متصل وجاهز' : 'غير متصل'}
                </p>
              </div>
            </div>
            <button 
              onClick={handleSelectKey}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {hasKey ? 'تغيير المفتاح' : 'اختيار مفتاح'}
            </button>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-zinc-500 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>مفتاح API ضروري لتوليد الفيديوهات عبر Veo 3.1 والنصوص عبر Gemini. يتم تخزين المفتاح بشكل آمن في متصفحك.</span>
            </p>
          </div>
        </div>

        {/* Rotated Keys List */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <List className="w-5 h-5 text-zinc-400" />
            قائمة التدوير التلقائي (5 مفاتيح)
          </h3>
          
          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
            {API_KEYS.map((key, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-800/50">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-6 h-6 rounded-full bg-violet-500/10 text-violet-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {index + 1}
                  </div>
                  <code className="text-[10px] text-zinc-400 truncate font-mono">
                    {key.substring(0, 8)}...{key.substring(key.length - 4)}
                  </code>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] px-2 py-0.5 bg-zinc-800 text-zinc-500 rounded uppercase">Active</span>
                </div>
              </div>
            ))}
          </div>
          
          <p className="text-[10px] text-zinc-500 mt-4 italic">
            * يتم التبديل بين هذه المفاتيح تلقائياً عند حدوث خطأ 429 أو رفض المفتاح لضمان استمرارية العمل.
          </p>
        </div>

        {/* Test Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-zinc-400" />
            اختبار الاتصال
          </h3>
          
          <p className="text-sm text-zinc-400 mb-6">
            قم بإجراء اختبار سريع للاتصال بخوادم جوجل للتأكد من أن المفتاح يعمل بشكل صحيح ولديه الصلاحيات اللازمة.
          </p>

          <button 
            onClick={handleTestConnection}
            disabled={isTesting || !hasKey}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors mb-6"
          >
            {isTesting ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
            {isTesting ? 'جاري الاختبار...' : 'بدء الاختبار'}
          </button>

          {testResult.status && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 ${
              testResult.status === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
              {testResult.status === 'success' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-bold text-sm mb-1">
                  {testResult.status === 'success' ? 'نتيجة الاختبار: نجاح' : 'نتيجة الاختبار: فشل'}
                </p>
                <p className="text-xs opacity-90 leading-relaxed">{testResult.message}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
