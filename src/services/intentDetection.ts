// AI-powered intent detection service
// Uses lightweight AI model to classify user intent instead of keyword matching

import { cloudApiService } from '@/lib/services/cloudApiService';

export type UserIntent = 'IMAGE_GENERATION' | 'IMAGE_EDIT' | 'CHAT';

export interface IntentAnalysis {
  intent: UserIntent;
  confidence: number;
  reasoning?: string;
}

const INTENT_DETECTION_SYSTEM_PROMPT = `You are an intent classifier. Analyze the user's message and determine their intent.

Respond with ONLY ONE of these intents:
- IMAGE_GENERATION: User wants to create/generate/draw a NEW image from text description (NO existing image provided)
- IMAGE_EDIT: User wants to modify/edit/change an EXISTING image they provided or just displayed
- CHAT: User wants to have a normal conversation or ask questions

CRITICAL RULES:
1. If user provides an image → likely IMAGE_EDIT
2. If user provides MULTIPLE images → definitely IMAGE_EDIT (editing/compositing/comparing)
3. If message contains edit keywords (change, modify, replace, edit, remove, add, thay đổi, sửa, thay) → IMAGE_EDIT
4. If message references "the image", "this photo", "ảnh này", "bức ảnh" → IMAGE_EDIT
5. If creating NEW image from scratch (no image provided) → IMAGE_GENERATION
6. Otherwise → CHAT

Examples:
"create a monkey eating banana" (no image) → IMAGE_GENERATION
"draw a beautiful sunset" (no image) → IMAGE_GENERATION
"vẽ một con mèo" (no image) → IMAGE_GENERATION
"thay quả chuối thành quả cam" (after showing image) → IMAGE_EDIT
"change the banana to an apple" (with context) → IMAGE_EDIT
"remove the person from this photo" (with image) → IMAGE_EDIT
"make the background blue" → IMAGE_EDIT
"thay con khỉ bên phải vào con khỉ bên trái" (with 2 images) → IMAGE_EDIT
"compare these two images" (with 2+ images) → IMAGE_EDIT
"what is the weather today?" → CHAT
"how do I use this app?" → CHAT

Respond in JSON format:
{
  "intent": "IMAGE_GENERATION" | "IMAGE_EDIT" | "CHAT",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

/**
 * Analyze user intent using AI instead of keyword matching
 * This is more flexible and can understand context better
 * 
 * @param userText - The current user message text
 * @param hasImages - Whether current message has attached images
 * @param hasRecentImage - Whether recent chat history contains an image (for context)
 * @param numImages - Number of images attached (for better multi-image detection)
 */
export async function analyzeUserIntent(
  userText: string,
  hasImages: boolean = false,
  hasRecentImage: boolean = false,
  numImages: number = 0
): Promise<IntentAnalysis> {
  try {
    // Construct analysis prompt
    const imageInfo = numImages > 1 
      ? `YES - ${numImages} images attached (likely multi-image editing/compositing)`
      : (hasImages ? 'YES - 1 image attached' : 'NO');
    
    const analysisPrompt = `User message: "${userText}"
Has attached images: ${imageInfo}
Recent chat history contains image: ${hasRecentImage ? 'YES (user just saw an image)' : 'NO'}

Context: ${hasRecentImage ? 'User just received/viewed an image in chat. Message likely refers to that image.' : 'No recent image context.'}

What is the user's intent?`;

    // Call cloud chat API with intent detection system prompt
    const response = await cloudApiService.chat(
      [
        { role: 'system', content: INTENT_DETECTION_SYSTEM_PROMPT },
        { role: 'user', content: analysisPrompt }
      ],
      'gemini' // Use fast Gemini Flash for intent detection
    );

    // Parse response
    if (!response.success || !response.data) {
      throw new Error('Intent detection failed: No response data');
    }

    // Try to parse as JSON
    // Handle both string and object responses (cloud API may return nested structure)
    let responseText: string;
    if (typeof response.data === 'string') {
      responseText = response.data.trim();
    } else if (response.data && typeof response.data === 'object') {
      // Handle cloud API response structure: { choices: [{ message: { content: "..." } }] }
      if ((response.data as any).choices && (response.data as any).choices[0]?.message?.content) {
        responseText = (response.data as any).choices[0].message.content.trim();
      } else if ((response.data as any).content) {
        responseText = (response.data as any).content.trim();
      } else {
        responseText = JSON.stringify(response.data).trim();
      }
    } else {
      throw new Error('Unexpected response format');
    }
    
    let parsed: IntentAnalysis;

    try {
      // Remove markdown code blocks if present
      const jsonMatch = responseText.match(/```json\s*(\{[\s\S]*?\})\s*```/) 
        || responseText.match(/(\{[\s\S]*\})/);
      
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        // Fallback: Try to extract intent from text
        if (/IMAGE_GENERATION/i.test(responseText)) {
          parsed = { intent: 'IMAGE_GENERATION', confidence: 0.7 };
        } else if (/IMAGE_EDIT/i.test(responseText)) {
          parsed = { intent: 'IMAGE_EDIT', confidence: 0.7 };
        } else {
          parsed = { intent: 'CHAT', confidence: 0.5 };
        }
      }
    } catch (parseError) {
      console.error('Failed to parse intent response:', responseText);
      // Fallback to keyword-based detection
      return fallbackIntentDetection(userText, hasImages);
    }

    // Validate intent
    if (!['IMAGE_GENERATION', 'IMAGE_EDIT', 'CHAT'].includes(parsed.intent)) {
      console.warn('Invalid intent from AI:', parsed.intent);
      return fallbackIntentDetection(userText, hasImages);
    }

    return parsed;

  } catch (error) {
    console.error('Intent detection error:', error);
    // Fallback to simple keyword matching
    return fallbackIntentDetection(userText, hasImages);
  }
}

/**
 * Fallback intent detection using simple keywords
 * Used when AI service fails
 */
function fallbackIntentDetection(
  userText: string,
  hasImages: boolean
): IntentAnalysis {
  const lowerText = userText.toLowerCase();
  
  // Image generation keywords
  const genKeywords = [
    'create', 'generate', 'draw', 'make', 'vẽ', 've', 
    'tạo ảnh', 'tao anh', 'image of', 'picture of', 'photo of'
  ];
  
  // Image edit keywords
  const editKeywords = [
    'change', 'edit', 'modify', 'remove', 'add', 'replace',
    'thay đổi', 'thay doi', 'chỉnh sửa', 'chinh sua', 'xóa', 'xoa',
    'thêm', 'them', 'thay', 'sửa', 'sua', 'đổi', 'doi',
    'make it', 'make the', 'turn', 'convert'
  ];
  
  // Context references (indicates editing existing content)
  const contextKeywords = [
    'the image', 'this image', 'this photo', 'this picture',
    'ảnh này', 'anh nay', 'bức ảnh', 'buc anh', 'hình này', 'hinh nay'
  ];

  // Check for edit intent
  const hasEditKeyword = editKeywords.some(k => lowerText.includes(k));
  const hasContextReference = contextKeywords.some(k => lowerText.includes(k));
  
  if (hasImages || hasEditKeyword || hasContextReference) {
    // If user has images or uses edit language, likely wants to edit
    return {
      intent: 'IMAGE_EDIT',
      confidence: hasImages ? 0.9 : 0.7,
      reasoning: 'Fallback detection - edit keywords or images present'
    };
  }

  // Check for generation intent
  const hasGenKeyword = genKeywords.some(k => lowerText.includes(k));
  if (hasGenKeyword) {
    return {
      intent: 'IMAGE_GENERATION',
      confidence: 0.7,
      reasoning: 'Fallback detection - generation keywords'
    };
  }

  // Default to chat
  return {
    intent: 'CHAT',
    confidence: 0.5,
    reasoning: 'Fallback detection - no clear intent'
  };
}
