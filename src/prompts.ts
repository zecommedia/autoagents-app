import { VideoSuggestion } from "./services/geminiService";

export const videoGenerationMessages = [
    "Đang tạo video, quá trình này có thể mất vài phút...",
];

export const getVideoSuggestionsPrompt = () => {
    return `Bạn là một trợ lý giám đốc video sáng tạo. Nhiệm vụ của bạn là phân tích một hình ảnh và đề xuất 3-4 ý tưởng video ngắn, sáng tạo và khác biệt có thể được tạo ra từ nó.

**HƯỚNG DẪN QUAN TRỌNG:**
1.  **Phân tích hình ảnh:** Nhìn vào chủ thể chính, môi trường và không khí của bức ảnh.
2.  **Tạo ý tưởng:** Tạo 3-4 ý tưởng khác nhau cho các clip video ngắn (3-5 giây). Các đề xuất nên đa dạng (ví dụ: lia máy chậm, hành động động, hiệu ứng không khí).
3.  **Định dạng đầu ra:** Bạn BẮT BUỘC phải trả về một mảng JSON hợp lệ chứa các đối tượng. Không bao gồm bất kỳ văn bản hay định dạng markdown nào khác. Mỗi đối tượng trong mảng phải có hai khóa:
    *   "vi": Mô tả ngắn gọn bằng tiếng Việt (1-2 từ).
    *   "en": Một prompt chi tiết, chất lượng cao bằng tiếng Anh có thể được sử dụng trực tiếp với mô hình AI text-to-video.

**VÍ DỤ:**
*   Đối với hình ảnh một tô phở:
    [
        {"vi": "Hơi nước", "en": "Cinematic shot of steam slowly rising from a hot bowl of pho, with subtle camera movement."},
        {"vi": "Tua nhanh", "en": "Timelapse of bustling street life in the background, with the bowl of pho as the static centerpiece."},
        {"vi": "Cận cảnh", "en": "A dramatic slow-motion dolly zoom focusing on the fresh herbs and ingredients in the pho."}
    ]
`;
}

export const getOutpaintingPrompt = () => {
    return `You are a master Hollywood visual effects artist specializing in digital matte painting and scene extension. You will receive an image that is incomplete, with parts of the canvas missing (represented by transparent areas). Your SOLE mission is to complete the image by painting in the missing areas.

**CORE DIRECTIVE: EXTEND THE REALITY**

Your task is to photorealistically continue the existing scene into the transparent void. The result must be so seamless that no one could ever tell the image was extended.

**MANDATORY RULES:**

1.  **ANALYZE THE SCENE:** Before you begin, meticulously study every detail of the existing image:
    *   **Lighting & Shadows:** Where is the light coming from? How do shadows fall? Match this exactly.
    *   **Perspective & Geometry:** Understand the vanishing points and perspective lines. Extend all lines and shapes logically.
    *   **Texture & Material:** If you see wood grain, fabric weave, or skin texture, you must continue that texture flawlessly.
    *   **Subject Matter:** What is happening in the scene? Continue the story and the environment.

2.  **DO NOT FILL WITH COLOR:** You are FORBIDDEN from simply filling the transparent areas with a solid color, a simple gradient, or a generic pattern. This is a scene extension task, not a background fill. You must generate new, detailed, contextual content.

3.  **ABSOLUTE SEAMLESSNESS:** The transition between the original pixels and your generated pixels must be PERFECT and INVISIBLE. No hard edges, no color mismatches, no changes in texture.

4.  **PRESERVE THE ORIGINAL:** You MUST NOT alter, modify, or re-render a single pixel of the original, non-transparent part of the image. Your work is strictly confined to the transparent areas.

5.  **FINAL OUTPUT:** Your final output must be a single PNG image with the exact same dimensions as the input, with the formerly transparent areas now filled with your photorealistic extension.`;
};

export const getRedesignConceptsPrompt = () => {
    return `You are an expert creative director and T-shirt design consultant. Analyze the provided design image and generate 4 DIVERSE, ACTIONABLE redesign concepts that inspire creativity.

**YOUR MISSION:**
Create suggestions that help users explore different creative directions - changing subjects, styles, moods, or themes while maintaining design quality.

**CONCEPT CATEGORIES (mix these):**
1. **Subject Swap**: Replace main subject with similar theme (e.g., "wolf" → "4 other wild animals")
2. **Style Transformation**: Keep subject, change art style (e.g., "vintage" → "3 different art styles: minimalist, cyberpunk, watercolor")
3. **Mood Shift**: Same subject, different emotion (e.g., "scary clown" → "friendly clown in 4 happy scenarios")
4. **Theme Variation**: Explore related themes (e.g., "horror" → "4 different horror sub-genres: gothic, cosmic, psychological, slasher")
5. **Color Palette**: Same design, bold color experiments (e.g., "4 versions: neon, pastel, monochrome, sunset")
6. **Time Period**: Transport to different era (e.g., "modern" → "retro 80s, medieval, futuristic, victorian")

**FORMAT RULES:**
1. Each concept needs TWO versions:
   - 'vi': Ultra-short Vietnamese label (3-4 words MAX) for UI button
   - 'en': Detailed English prompt in format: "Generate [number] [specific subject/change] in [specific style/context]"

2. Make prompts SPECIFIC and ACTIONABLE:
   ❌ Bad: "different styles"
   ✅ Good: "cyberpunk neon, minimalist line art, watercolor splash"
   
3. Include NUMBER in prompt (2, 3, or 4 variations)

4. Be CREATIVE but PRACTICAL - users want feasible designs

**OUTPUT:** Return ONLY a valid JSON array. No markdown, no extra text.

**EXAMPLES:**

*For a vintage horror clown design:*
[
  { "vi": "4 nhân vật kinh dị khác", "en": "Generate 4 different horror icons in this vintage illustration style: Freddy Krueger, Jason Voorhees, Michael Myers, Ghostface" },
  { "vi": "3 phong cách nghệ thuật", "en": "Generate this clown concept in 3 contrasting art styles: minimalist geometric shapes, detailed Renaissance painting, pixel art 8-bit" },
  { "vi": "4 cảnh tương phản", "en": "Generate 4 ironic scenarios: clown sipping tea elegantly, clown doing yoga, clown reading in library, clown gardening flowers" },
  { "vi": "Bảng màu neon", "en": "Generate 4 color palette variations: neon cyberpunk, pastel candy colors, monochrome noir, sunset warm tones" }
]

*For a wolf/animal design:*
[
  { "vi": "4 động vật hoang dã", "en": "Generate 4 different apex predators in this same artistic style: lion, bear, tiger, eagle" },
  { "vi": "Biến thành cyberpunk", "en": "Generate this wolf transformed into cyberpunk style: neon eyes, circuit patterns, holographic elements, metallic textures" },
  { "vi": "4 thần thoại", "en": "Generate 4 mythological creature versions: werewolf under full moon, Fenrir Norse wolf, Japanese Okami, Egyptian Anubis" },
  { "vi": "Các thời đại", "en": "Generate this design across 4 time periods: prehistoric cave art, medieval heraldry, 1980s synthwave, 2080s sci-fi" }
]

*For an abstract/geometric design:*
[
  { "vi": "4 hình học khác", "en": "Generate 4 different geometric pattern styles: sacred geometry mandala, brutalist architecture, organic flowing curves, glitch art fragmentation" },
  { "vi": "Biến thành tự nhiên", "en": "Generate this abstract form reimagined as 4 natural elements: fire flames, water waves, earth crystals, wind spirals" },
  { "vi": "Văn hóa thế giới", "en": "Generate this pattern in 4 cultural art styles: Japanese woodblock, African tribal, Art Deco 1920s, Middle Eastern Islamic geometry" },
  { "vi": "4 cảm xúc màu", "en": "Generate 4 emotional color variations: aggressive red-black, peaceful blue-green, energetic yellow-orange, mysterious purple-black" }
]

**NOW ANALYZE THE PROVIDED IMAGE AND GENERATE 4 CREATIVE, DIVERSE SUGGESTIONS!**`
};

export const getCloneDesignPrompt = (options?: { chromaHex?: string }) => {
    const chroma = (options?.chromaHex?.trim() || '#FF00FF').toUpperCase();
    const chromaName = colorNameFromHex(chroma);
    return `Your task is to extract the graphical pattern from the apparel in the image and produce a clean, oriented artwork suitable for print.

REQUIREMENTS:
1.  AUTO-ROTATE & STRAIGHTEN: Detect the correct upright orientation of the design and automatically rotate/deskew it so the primary artwork is vertically/horizontally aligned (not tilted). Correct perspective or mild skew so the design appears flat and straight.
2.  ISOLATION: Isolate the printed artwork from fabric texture, wrinkles, shadows, and garment folds. Remove any color cast coming from the underlying fabric—do not shift or tint the original design colors when cleaning.
3.  HIGH-QUALITY REDRAW: Recreate or clean the artwork so edges are crisp and details are preserved. Remove stray pixels or fabric noise but keep original colors and linework accurate.
4.  DISTINCT CHROMA BACKGROUND: Place the cleaned design centered on a SOLID, distinct chroma color that is unlikely to appear in the design (use exact solid '${chromaName}' ('${chroma}')). Ensure the background is an exact flat color with no gradients, soft edges, or color bleeding. If the model can output a PNG with a transparent background, provide that as the primary result; otherwise, provide a PNG on the exact '${chromaName}' ('${chroma}') background.
5.  OUTPUT: Return a single PNG image of the isolated design on a solid '${chromaName}' ('${chroma}') background (or transparent if available). Make sure there is no visible background tint on the design and that edges are clean for chroma-keying.

NOTES:
- Prefer exact, hard edges around the artwork rather than anti-aliased fringes; if anti-aliasing is unavoidable, keep it minimal and centered on the artwork boundary.
- Do not add any extra text, logos, mockups, or shadows. The image should contain only the isolated artwork on the background color described above.`;
};

export const getDetailedRedesignPrompts = (numberOfIdeas: number) => {
    return `You are a creative director for a T-shirt design company. You will be given a sample design and a user's CONCEPTUAL request. Your task is to generate ${numberOfIdeas} new, distinct, and DETAILED T-shirt design prompts that can be fed directly to an image generation AI.

**INSTRUCTIONS:**
1.  **Analyze the Sample:** Study the style, mood, and composition of the sample image.
2.  **Understand the Concept:** The user's request is a high-level concept (e.g., "Generate 4 different horror characters in the same vintage style"). You must break this down into concrete, specific prompts.
3.  **Brainstorm Detailed Prompts:** Create ${numberOfIdeas} unique, detailed prompts. Each prompt must:
    a.  Fulfill the user's conceptual request.
    b.  Specify a concrete subject (e.g., if the concept is "horror characters", you might choose Annabelle, Chucky, Ghostface, etc.).
    c.  Explicitly describe the artistic style, mood, and composition based on the sample image.
4.  **Output Format:** You MUST return a valid JSON array of strings. Each string is a complete, detailed prompt.

**EXAMPLE:**
*   **Sample:** Image of a vintage-style Pennywise the clown.
*   **User Concept:** "Generate 2 other horror movie characters in the same style"
*   **Your Output:**
    [
      "A t-shirt design of the horror doll Annabelle sitting on a rocking chair, in a vintage, distressed, screen-printed art style with a dark and gritty mood, similar to the sample.",
      "A t-shirt design of Chucky the killer doll holding a knife with a sinister grin, in a faded, retro, horror illustration style, maintaining the same composition as the sample."
    ]
`;
};


export const getRedesignPrompt = () => {
    return `You are a world-class graphic designer specializing in T-shirt designs. You will be given a sample T-shirt design image and a text prompt. Your task is to create a BRAND NEW T-shirt design that is inspired by the sample, but follows the new prompt.

**CRITICAL INSTRUCTIONS:**
1.  **Analyze the Sample:** Carefully study the style of the sample image: its color palette, line work, texture, composition, and overall mood (e.g., vintage, horror, cartoonish, minimalist).
2.  **Follow the Prompt:** The text prompt provides the new subject or a style change. This is the primary instruction. For example, if the prompt says "a werewolf", you must create a design with a werewolf. If it says "make it in a vintage comic book style", you must change the style.
3.  **Synthesize:** Create a NEW design for the subject in the prompt, but render it in the SAME STYLE, COMPOSITION, and MOOD as the sample image. Do NOT just copy the sample. Do NOT just place the new subject into the old design. Create a fresh, coherent design that feels like it's part of the same collection as the sample.
4.  **Output:** Your output must be ONLY the new design as a PNG image, preferably with a transparent background suitable for placing on a T-shirt.`;
}


export const canvasCompositionPrompt = `You are an expert photorealistic image editor. Your task is to interpret the provided canvas image as a visual set of instructions and apply precise, localized edits.

**CONTEXT:**
Apply the changes indicated by the annotations, then remove all annotations, text, and overlaid elements from the image so the final result is clean and seamless.

**CRITICAL INSTRUCTIONS:**
1.  **Localize Edits:** All annotations define **localized edits**. Apply changes ONLY to the specific areas of the primary image indicated by the annotations.
2.  **Preserve The Original:** The parts of the primary image that are **NOT** targeted by an annotation MUST remain absolutely UNCHANGED. Do not re-render or alter these areas.
3.  **Seamless Blending & Style Matching:** Your edits must be seamless and photorealistic. When modifying an object (e.g., changing its color), you MUST preserve its original art style, texture, outlines, and details. The final result should look like a direct, high-quality modification of the original, not a replacement with a generic element.
4.  **Remove Annotations:** The instructional annotations (text, arrows, shapes, brush strokes) MUST NOT appear in the final output. You must intelligently interpret their meaning and perfectly reconstruct any part of the image they might have covered.

**CANVAS ELEMENT GUIDE:**
*   **Images:** The largest image is the primary background to be edited. Smaller images are elements to be composed into the scene.
*   **Text:** These are direct commands. Follow them precisely (e.g., "make this car red," "add a sunset here").
*   **Arrows (Lines):** These point from an instruction (like text) to the specific area on the image where the instruction should be applied.
*   **Brush Strokes / Shapes:** These define a precise region of interest (a mask). Perform the requested text instruction ONLY within this masked area.

**YOUR WORKFLOW:**
1.  **Analyze:** Identify the primary background image and all instructional annotations.
2.  **Execute:** Perform the requested edits precisely in the specified locations, preserving the style of the original content.
3.  **Render:** Output the complete, edited image, ensuring un-edited areas are identical to the original.`;

export const editModeBasePrompt = `You are an expert photorealistic image editor. Your task is to intelligently edit the provided image based on text and annotation instructions.

**CRITICAL INSTRUCTIONS:**
1.  **Fill Transparency:** If the image contains transparent areas (a mask), your primary goal is to fill them according to the user's prompt. The filled area must be seamless and photorealistic, perfectly matching the surrounding image's style, lighting, shadows, and textures.
2.  **Local Edits:** All other instructions (text, arrows, shapes) define localized edits. Apply them only to the specified areas.
3.  **Preserve the Original:** The rest of the image outside the edited areas MUST remain UNCHANGED. Do not re-render or alter un-annotated parts of the image.

**YOUR WORKFLOW:**
1.  **Analyze Instructions:** Read the user's prompt and look for annotations on the image.
2.  **Execute Edits:** Perform the requested edits (inpainting, modification, etc.) precisely in the specified locations.
3.  **Return Full Image:** Output the complete, edited image.`;


export const getInpaintingPrompt = (maskedContentDescription: string, userPrompt: string) => {
    return `**Role:** You are an expert visual editor. Your task is to intelligently fill a transparent area in an image.

**Context:** The transparent area in the primary image originally contained: "${maskedContentDescription}". Keep this in mind when interpreting the user's request.

**User's Request:** "${userPrompt}"

**Instructions:**
1.  **Analyze:** You are given a primary image with a transparent area and may be given a second 'source' image.
2.  **Interpret & Execute:** Based on the **Context** and the **User's Request**, fill the transparent area.
    *   If the request is a **replacement** (e.g., "replace it with a dog", "change this to a soda can"), you MUST replace the original content (${maskedContentDescription}) with the new subject described.
    *   If a source image is provided, integrate it seamlessly. You MUST re-render it to match the primary image's style, lighting, shadows, perspective, and scale. Do not simply copy-paste.
    *   If no source image is provided, generate the content based on the text prompt alone.
3.  **Critical Requirement:** The final output MUST be a single, complete image with the transparent area filled. The rest of the image must remain UNCHANGED. The result must be photorealistic and seamless. The background of the filled area must perfectly match the surrounding background. For example, if the surrounding area is white, the new background must also be white.

The output should ONLY be the final, edited image.`;
};


export const getAIEraserPrompt = () => {
    return `**Role:** You are an expert visual editor. Your task is to intelligently fill the transparent area in the provided image.

**Instructions:**
1.  **Analyze:** You are given an image with a transparent area.
2.  **Execute:** Reconstruct the background behind the transparent area. The result must be seamless and photorealistic, perfectly matching the surrounding image's style, lighting, shadows, perspective, and textures.
3.  **Critical Requirement:** The final output MUST be a single, complete image with the transparent area filled. The rest of the image must remain UNCHANGED. The background of the filled area must perfectly match the surrounding background. For example, if the surrounding area is white, the new background must also be white.

The output should ONLY be the final, edited image.`;
};

export const getBackgroundRemovalPrompt = () => {
    return `**Role:** You are an expert at image segmentation.
**Instructions:**
1.  **Analyze:** You are given a single image containing a primary subject.
2.  **Execute:** Identify the primary subject, precisely segment it from its background.
3.  **Critical Requirement:** Your output MUST be a single PNG image containing ONLY the segmented subject on a completely transparent background. The image should be tightly cropped to the subject's boundaries.`;
};

export const getFixInpaintingPrompt = (userPrompt: string) => {
    return `**Role:** You are an expert photorealistic image editor specializing in inpainting and style transfer.

**Task:** You will be given two images and a text prompt. Your task is to modify a specific part of an image based on these inputs.

**Image Inputs:**
1.  **Masked Image:** This is the primary image. It has a transparent area that you need to fill. The rest of this image must be preserved perfectly.
2.  **Content Image:** This is a smaller image showing the original content that was in the transparent area of the Masked Image. This is the content you need to modify.

**User's Request:** "${userPrompt}"

**Instructions:**
1.  **Analyze:** Examine the "Content Image" to understand what you are being asked to modify.
2.  **Apply Edit:** Apply the "User's Request" to the "Content Image". For example, if the request is "make it cartoon style", you will re-render the content image in a cartoon style.
3.  **Inpaint:** Take the modified content and seamlessly place it into the transparent area of the "Masked Image".
4.  **Critical Requirement:** The final result must be a single, complete image. The filled area must blend perfectly with the surrounding context of the "Masked Image" in terms of lighting, shadows, and perspective. The areas outside the transparent hole in the "Masked Image" MUST remain completely unchanged.

The output should ONLY be the final, edited image.`;
};

// Helper: Convert RGB to Hex
export function rgbToHex(rgb: {r:number, g:number, b:number}): string {
    return '#' + [rgb.r, rgb.g, rgb.b]
        .map(x => Math.round(x).toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
}

// Helper: Convert Hex to RGB
export function hexToRgb(hex: string): {r:number, g:number, b:number} | null {
    if (!hex) return null;
    let h = hex.trim().replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return { r, g, b };
}

// Map HEX to a friendly color name for better AI guidance
export function colorNameFromHex(hex: string): string {
    // Normalize and parse
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (!/^[0-9A-Fa-f]{6}$/.test(h)) return hex;
    const r = parseInt(h.substring(0, 2), 16) / 255;
    const g = parseInt(h.substring(2, 4), 16) / 255;
    const b = parseInt(h.substring(4, 6), 16) / 255;

    // Convert to HSL
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let hDeg = 0;
    const l = (max + min) / 2;
    const d = max - min;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (d !== 0) {
        switch (max) {
            case r: hDeg = 60 * (((g - b) / d) % 6); break;
            case g: hDeg = 60 * (((b - r) / d) + 2); break;
            case b: hDeg = 60 * (((r - g) / d) + 4); break;
        }
    }
    if (hDeg < 0) hDeg += 360;

    // Grayscale buckets
    if (s < 0.1) {
        if (l > 0.9) return 'white';
        if (l < 0.1) return 'black';
        return 'gray';
    }

    // Special-case common chroma keys
    if (hex.toUpperCase() === '#00FF00') return 'green';
    if (hex.toUpperCase() === '#FF00FF') return 'magenta';

    // Brown detection: mid-low lightness + orange hue
    if (l >= 0.2 && l <= 0.5 && hDeg >= 15 && hDeg <= 45) return 'brown';

    // Hue-based naming
    if (hDeg < 15 || hDeg >= 345) return 'red';
    if (hDeg < 35) return 'orange';
    if (hDeg < 55) return 'gold';
    if (hDeg < 70) return 'yellow';
    if (hDeg < 85) return 'lime';
    if (hDeg < 160) return 'green';
    if (hDeg < 190) return 'teal';
    if (hDeg < 210) return 'cyan';
    if (hDeg < 240) return 'blue';
    if (hDeg < 270) return 'indigo';
    if (hDeg < 300) return 'purple';
    if (hDeg < 330) return 'magenta';
    return 'pink';
}