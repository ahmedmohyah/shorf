import React, { useState } from 'react';
import { LayoutTemplate, Play, Pause } from 'lucide-react';

const templates = [
  { id: 'sigma', name: 'تحفيز ونجاح (Sigma)', font: 'Cairo', style: 'slanted' },
  { id: 'vintage', name: 'حقائق تاريخية (Vintage)', font: 'Amiri', style: 'ribbon' },
  { id: 'news', name: 'أخبار عاجلة (News)', font: 'Tajawal', style: 'solid' },
  { id: 'story', name: 'قصة وعبرة (Story)', font: 'Aref Ruqaa', style: 'elegant' },
  { id: 'tech', name: 'معلومات تقنية (Tech)', font: 'Changa', style: 'neon' },
  { id: 'sports', name: 'أخبار رياضية (Sports)', font: 'Lalezar', style: 'dynamic' },
  { id: 'quotes', name: 'اقتباسات خالدة (Quotes)', font: 'Reem Kufi', style: 'minimal' },
  { id: 'education', name: 'هل تعلم؟ (Education)', font: 'Readex Pro', style: 'highlight' },
  { id: 'gaming', name: 'أسرار الألعاب (Gaming)', font: 'Lemonada', style: 'pixel' },
  { id: 'islamic', name: 'نفحات إيمانية (Islamic)', font: 'Lateef', style: 'calligraphy' },
];

const colors = [
  { id: 'red', name: 'أحمر', value: '#EF4444' },
  { id: 'blue', name: 'أزرق', value: '#3B82F6' },
  { id: 'green', name: 'أخضر', value: '#10B981' },
  { id: 'gold', name: 'ذهبي', value: '#F59E0B' },
];

export function TemplatesView() {
  const [playing, setPlaying] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-purple-500/20 rounded-xl">
          <LayoutTemplate className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">مكتبة القوالب</h2>
          <p className="text-zinc-400">10 قوالب بتصاميم مختلفة، لكل قالب 4 ألوان</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {templates.map((template) => (
          <div key={template.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-zinc-800 bg-zinc-950/50">
              <h3 className="text-lg font-bold text-white">{template.name}</h3>
              <p className="text-sm text-zinc-400">الخط: {template.font}</p>
            </div>
            
            <div className="p-4 flex-1 grid grid-cols-2 gap-4">
              {colors.map((color) => {
                const previewId = `${template.id}-${color.id}`;
                const isPlaying = playing === previewId;
                
                return (
                  <div key={color.id} className="relative aspect-[9/16] bg-zinc-950 rounded-xl overflow-hidden group border border-zinc-800">
                    {/* Background placeholder */}
                    <img 
                      src={`https://picsum.photos/seed/${template.id}/400/800`} 
                      alt="Background" 
                      className="absolute inset-0 w-full h-full object-cover opacity-50"
                    />
                    
                    {/* Overlay simulation */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                      {/* Title simulation based on style */}
                      <div 
                        className={`mb-4 px-4 py-2 text-center text-white font-bold text-sm shadow-lg transform transition-all duration-500 ${isPlaying ? 'scale-110' : 'scale-100'}`}
                        style={{ 
                          backgroundColor: color.value,
                          fontFamily: template.font,
                          transform: template.style === 'slanted' ? 'skewX(-10deg)' : 'none',
                          borderRadius: template.style === 'solid' ? '8px' : '0'
                        }}
                      >
                        <span style={{ transform: template.style === 'slanted' ? 'skewX(10deg)' : 'none', display: 'block' }}>
                          {template.name.split(' ')[0]}
                        </span>
                      </div>
                      
                      {/* Text simulation */}
                      <div 
                        className={`text-center text-white text-xs leading-relaxed drop-shadow-md transition-all duration-700 ${isPlaying ? 'opacity-100 translate-y-0' : 'opacity-80 translate-y-2'}`}
                        style={{ fontFamily: template.font }}
                      >
                        نص تجريبي يوضح<br/>
                        طريقة عرض القالب<br/>
                        باللون {color.name}
                      </div>
                    </div>

                    {/* Play button overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => setPlaying(isPlaying ? null : previewId)}
                        className="w-10 h-10 rounded-full bg-purple-500 text-white flex items-center justify-center hover:bg-purple-600 transition-colors"
                      >
                        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
