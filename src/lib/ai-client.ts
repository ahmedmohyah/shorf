import { GoogleGenAI } from "@google/genai";

// قائمة مفاتيح API التي قدمها المستخدم لتدويرها وتجنب حدود الاستخدام (429)
export const API_KEYS = [
  "AIzaSyAjXRMhcRx8W6zzqTMZ-5-d_07NLYROx6E",
  "AIzaSyDoevWt7943c0nsw-Otw_1pD8TNYl7J5GA",
  "AIzaSyB86O2SIwpeqZYKtAeYt4ZfO0z-jeBuiX0", // المفتاح الخامس من إعدادات فايربيز
  "gen-lang-client-0399399190",
  "project-ec216fac-2461-4fb0-bec"
];

// إضافة المفتاح الأساسي من البيئة إذا وجد
// @ts-ignore
const envKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
if (envKey && !API_KEYS.includes(envKey)) {
  API_KEYS.unshift(envKey);
}

let currentKeyIndex = 0;

/**
 * الحصول على نسخة من GoogleGenAI مع تدوير المفاتيح تلقائياً
 */
export function getAIClient(): GoogleGenAI {
  const apiKey = API_KEYS[currentKeyIndex];
  // تدوير للمرة القادمة
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  
  return new GoogleGenAI({ apiKey });
}

/**
 * الحصول على المفتاح الحالي المستخدم
 */
export function getCurrentApiKey(): string {
  return API_KEYS[currentKeyIndex === 0 ? API_KEYS.length - 1 : currentKeyIndex - 1];
}

/**
 * تأخير التنفيذ (ms)
 */
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * تنفيذ دالة مع محاولة إعادة المحاولة في حال حدوث خطأ 429 (تجاوز الحصة) أو رفض المفتاح
 */
export async function retryWithBackoff<T>(
  fn: (ai: GoogleGenAI) => Promise<T>,
  retries = API_KEYS.length * 2, // محاولة تدوير جميع المفاتيح مرتين على الأقل
  delayMs = 2000
): Promise<T> {
  const ai = getAIClient();
  try {
    return await fn(ai);
  } catch (error: any) {
    const errorMessage = error.message?.toLowerCase() || "";
    const isRateLimit = errorMessage.includes("429") || error.status === 429 || errorMessage.includes("quota");
    const isInvalidKey = errorMessage.includes("api key not valid") || 
                        errorMessage.includes("invalid api key") || 
                        errorMessage.includes("requested entity was not found") ||
                        errorMessage.includes("forbidden") ||
                        error.status === 403 ||
                        error.status === 401;
    
    if (retries > 0 && (isRateLimit || isInvalidKey)) {
      const reason = isRateLimit ? "Rate limit hit (429)" : "API key rejected/invalid";
      console.warn(`[AI Client] ${reason}. Retrying with next key... (${retries} attempts left)`);
      
      // إذا كان المفتاح مرفوضاً، ننتقل فوراً للمفتاح التالي
      if (isRateLimit) {
        await delay(delayMs);
      }
      
      // المحاولة التالية ستستخدم المفتاح التالي تلقائياً لأن getAIClient يقوم بالتدوير
      return retryWithBackoff(fn, retries - 1, isRateLimit ? delayMs * 2 : delayMs);
    }
    throw error;
  }
}
