import { Sparkles, Save, RefreshCw, MessageSquareQuote, AlignCenter } from 'lucide-react';

export function ScriptView() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-4rem)] flex flex-col" dir="rtl">
      <div>
        <h2 className="text-2xl font-bold text-white">توليد النصوص (Gemini 3.1) ✍️</h2>
        <p className="text-zinc-400 mt-1">توليد نكت، طرائف، أو اقتباسات قصيرة مصممة خصيصاً لفيديوهات الـ 8 ثوانٍ.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        {/* Source Text */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-zinc-800 bg-zinc-950/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquareQuote className="w-5 h-5 text-zinc-400" />
              <h3 className="font-semibold text-zinc-200">المصدر / الفكرة</h3>
            </div>
            <select className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-300">
              <option>نكت خليجية</option>
              <option>اقتباسات عميقة</option>
              <option>معلومات غريبة</option>
            </select>
          </div>
          <textarea 
            className="flex-1 w-full bg-transparent p-4 text-zinc-400 text-sm leading-relaxed resize-none focus:outline-none"
            placeholder="أدخل فكرة أو نص مسحوب هنا، وسيقوم الذكاء الاصطناعي بصياغته كنص قصير مناسب لفيديو 8 ثوانٍ..."
            defaultValue="أريد نكتة عن شخص بخيل في فصل الشتاء."
          />
          <div className="p-4 border-t border-zinc-800 bg-zinc-950/30">
            <button className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              توليد نص للفيديو
            </button>
          </div>
        </div>

        {/* AI Generated Script */}
        <div className="bg-zinc-900 border border-violet-500/30 rounded-2xl flex flex-col overflow-hidden shadow-[0_0_15px_rgba(139,92,246,0.1)] relative">
          <div className="p-4 border-b border-zinc-800 bg-zinc-950/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlignCenter className="w-5 h-5 text-violet-400" />
              <h3 className="font-semibold text-violet-100">النص النهائي (يظهر على الشاشة)</h3>
            </div>
            <div className="flex gap-2">
              <button className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors" title="إعادة توليد">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                <Save className="w-4 h-4" />
                حفظ
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center bg-zinc-950/50">
            
            {/* Visual representation of how it will look */}
            <div className="w-full max-w-sm space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 text-center">العنوان الرئيسي (المربع الأصفر)</label>
                <input 
                  type="text"
                  className="w-full bg-[#FFD700] text-black font-bold text-center rounded-lg p-3 text-lg focus:outline-none focus:ring-2 focus:ring-white"
                  defaultValue="نكت وطرائف"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 text-center">النص الداخلي (الشفاف)</label>
                <textarea 
                  className="w-full bg-zinc-900/80 border border-zinc-700 rounded-xl p-6 text-white text-center text-lg leading-loose focus:outline-none focus:border-violet-500 transition-colors resize-none"
                  rows={7}
                  defaultValue={`نكتة اليوم:\n\nسألوا بخيل\nوش تسوي لو\nبرد الجو؟\n\nقال أدفى\nعلى اللمبة.`}
                />
              </div>
              
              <p className="text-center text-xs text-zinc-500 mt-4">
                💡 نصيحة: اجعل الأسطر قصيرة لتسهيل القراءة السريعة خلال 8 ثوانٍ.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
