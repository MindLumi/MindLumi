/**
 * Safety guard — tiered crisis detection for all chat messages.
 *
 * Runs BEFORE any AI call. At level >= 2, the AI is never invoked
 * and a hardcoded crisis response is returned instead.
 */

import { supabaseAdmin } from "./supabase-admin.ts";

// --- Crisis keyword lists (English + Arabic) ---

const LEVEL_3_KEYWORDS = [
  // English
  "kill myself", "end my life", "suicide plan", "want to die",
  "going to die", "better off dead", "no reason to live",
  "end it all", "take my own life", "hang myself", "shoot myself",
  "overdose", "jump off", "slit my wrists", "i have a plan to die",
  "drink myself to death", "pills to die",
  // Arabic
  "أريد أن أموت", "سأقتل نفسي", "أنهي حياتي", "لا سبب للعيش",
  "أفضل لو كنت ميتاً", "سأنتحر", "أشنق نفسي", "خطة للموت",
  "أريد الموت",
];

const LEVEL_2_KEYWORDS = [
  // English
  "self-harm", "hurt myself", "cutting myself", "suicidal",
  "don't want to be here", "can't go on", "no hope",
  "want to disappear", "nothing matters", "suicide",
  "don't want to live", "wish i was dead", "harming myself",
  "burning myself", "starving myself", "punish myself",
  // Arabic
  "أذيت نفسي", "أجرح نفسي", "لا أمل", "أريد أن أختفي",
  "انتحار", "لا أريد أن أعيش", "أعاقب نفسي",
];

const LEVEL_1_KEYWORDS = [
  // English
  "hopeless", "worthless", "overwhelmed", "can't cope",
  "falling apart", "breaking down", "so alone",
  "trapped", "no way out", "burden to everyone", "nobody cares",
  // Arabic
  "يائس", "عديم القيمة", "لا أستطيع التحمل", "وحيد جداً",
  "محاصر", "لا مخرج", "عبء على الجميع",
];

// --- Text normalization (prevent Unicode bypass) ---

function normalizeText(text: string): string {
  return text
    .normalize("NFKD")                         // decompose accented/combined chars
    .replace(/[\u200B-\u200F\uFEFF]/g, "")     // strip zero-width chars
    .replace(/[\u0300-\u036F]/g, "")            // strip combining diacriticals
    .replace(/\0/g, "")                         // strip null bytes
    .replace(/\s+/g, " ")                       // collapse whitespace
    .toLowerCase()
    .trim();
}

// --- Safety assessment ---

export interface SafetyResult {
  level: number;
  keywords: string[];
  requiresCrisisResponse: boolean;
}

export function assessSafety(message: string): SafetyResult {
  const normalized = normalizeText(message);
  const found: string[] = [];
  let maxLevel = 0;

  for (const kw of LEVEL_3_KEYWORDS) {
    if (normalized.includes(normalizeText(kw))) {
      found.push(kw);
      maxLevel = 3;
    }
  }
  if (maxLevel < 3) {
    for (const kw of LEVEL_2_KEYWORDS) {
      if (normalized.includes(normalizeText(kw))) {
        found.push(kw);
        maxLevel = Math.max(maxLevel, 2);
      }
    }
  }
  if (maxLevel < 2) {
    for (const kw of LEVEL_1_KEYWORDS) {
      if (normalized.includes(normalizeText(kw))) {
        found.push(kw);
        maxLevel = Math.max(maxLevel, 1);
      }
    }
  }

  return {
    level: maxLevel,
    keywords: found,
    requiresCrisisResponse: maxLevel >= 2,
  };
}

// --- Crisis response (hardcoded — no AI involved) ---

const CRISIS_RESPONSES: Record<string, string> = {
  en: `I'm really concerned about what you're sharing, and I want you to know that you matter and help is available right now.

**Please reach out to one of these resources immediately:**

🆘 **National Suicide Prevention Lifeline**: 988 (call or text)
🆘 **Crisis Text Line**: Text HOME to 741741
🆘 **International Association for Suicide Prevention**: https://www.iasp.info/resources/Crisis_Centres/

If you're in immediate danger, please call your local emergency number (911 in the US).

You don't have to go through this alone. A trained crisis counselor can help you right now. 💙`,

  ar: `أنا قلق جداً مما تشاركه معي، وأريدك أن تعرف أنك مهم وأن المساعدة متاحة الآن.

**يرجى التواصل مع أحد هذه الموارد فوراً:**

🆘 **خط مساندة**: 920033360
🆘 **خط نجدة الصحة النفسية**: 920033360

إذا كنت في خطر فوري، يرجى الاتصال برقم الطوارئ المحلي.

لا يجب أن تمر بهذا وحدك. مستشار أزمات مدرب يمكنه مساعدتك الآن. 💙`,
};

export function buildCrisisResponse(language = "en"): string {
  return CRISIS_RESPONSES[language] ?? CRISIS_RESPONSES.en;
}

// --- Log safety event ---

export async function logSafetyEvent(params: {
  userId: string;
  sessionId: string;
  messageId?: string;
  level: number;
  keywords: string[];
  triggerContent: string;
  responseAction: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("safety_events").insert({
    user_id: params.userId,
    session_id: params.sessionId,
    message_id: params.messageId ?? null,
    safety_level: params.level,
    trigger_keywords: params.keywords,
    trigger_content: params.triggerContent.slice(0, 200),
    response_action: params.responseAction,
  });

  if (error) {
    console.error("Failed to log safety event:", error.message);
  }
}
