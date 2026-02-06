import { GoogleGenAI, Type } from "@google/genai";
import { GarmentType, BodyType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Advanced Classification: Detects product context, model presence, and orientation.
 */
export const classifyImages = async (userPhoto: string, garmentPhoto: string): Promise<{ 
  garmentType: GarmentType, 
  bodyType: BodyType,
  hasModel: boolean,
  orientation: 'front' | 'back' | 'side' | 'unknown',
  confidenceScore: number
}> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: userPhoto.split(',')[1] } },
          { inlineData: { mimeType: 'image/jpeg', data: garmentPhoto.split(',')[1] } },
          { text: `Perform a technical vision audit for a Virtual Try-On system.
          Image 1: Target User
          Image 2: Product Reference
          
          Analyze Image 2 (Product) for:
          1. Garment Type: 'top', 'bottom', or 'full-outfit'.
          2. Model Presence: Is a human model wearing the garment? (boolean)
          3. Orientation: Is the garment shown from 'front', 'back', or 'side'?
          4. Confidence: Confidence score (0-1) that this image is suitable for virtual try-on.
          
          Analyze Image 1 (User) for:
          1. Framing: 'upper-body', 'lower-body', or 'full-body'.
          
          Return JSON only.` }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          garmentType: { type: Type.STRING },
          bodyType: { type: Type.STRING },
          hasModel: { type: Type.BOOLEAN },
          orientation: { type: Type.STRING },
          confidenceScore: { type: Type.NUMBER }
        },
        required: ["garmentType", "bodyType", "hasModel", "orientation", "confidenceScore"]
      }
    }
  });

  try {
    const data = JSON.parse(response.text || '{}');
    return {
      garmentType: (data.garmentType || 'unknown').toLowerCase() as GarmentType,
      bodyType: (data.bodyType || 'unknown').toLowerCase() as BodyType,
      hasModel: !!data.hasModel,
      orientation: (data.orientation || 'unknown').toLowerCase() as any,
      confidenceScore: data.confidenceScore || 0.5
    };
  } catch (e) {
    console.error("Classification failure:", e);
    return { garmentType: 'unknown', bodyType: 'unknown', hasModel: false, orientation: 'unknown', confidenceScore: 0 };
  }
};

/**
 * Advanced Garment Extraction & Transfer Engine.
 */
export const generateAdvancedTryOn = async (
  userPhoto: string,
  productPhoto: string,
  garmentType: GarmentType,
  hasModelInProduct: boolean,
  previousTop?: string,
  previousBottom?: string
): Promise<string> => {
  const parts: any[] = [
    { inlineData: { mimeType: 'image/jpeg', data: userPhoto.split(',')[1] } }, 
    { inlineData: { mimeType: 'image/jpeg', data: productPhoto.split(',')[1] } } 
  ];

  let prompt = `Action: Digital Garment Transfer.
  Source: Image 2 (Reference).
  Destination: Image 1 (User).
  
  Instructions:`;
  
  if (hasModelInProduct) {
    prompt += `
    1. SEGMENTATION: Identify the person wearing the clothing in Image 2. 
    2. ISOLATION: Extract ONLY the ${garmentType} fabric. Completely ignore the face, skin, hair, hands, and legs of the person in Image 2.
    3. TRANSFER: Apply the extracted fabric onto the person in Image 1.`;
  } else {
    prompt += `
    1. TRANSFER: Fit the ${garmentType} from Image 2 onto the person in Image 1.`;
  }

  if (garmentType === 'top') {
    if (previousBottom) {
      prompt += "\n4. CONTEXT: Combine this new top with the pants shown in Image 3.";
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: previousBottom.split(',')[1] } });
    }
  } else if (garmentType === 'bottom') {
    if (previousTop) {
      prompt += "\n4. CONTEXT: Combine these new pants with the shirt shown in Image 3.";
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: previousTop.split(',')[1] } });
    }
  }

  const systemInstruction = `You are an expert Virtual Try-On Rendering Engine.
  CORE CONSTRAINTS:
  - IDENTITY LOCK: The face, hair, skin tone, and background of Image 1 (User) MUST remain 100% identical.
  - FABRIC REALISM: Inherit the lighting and shadows from Image 1.
  - POSE MATCHING: Deform and align the garment from Image 2 to fit the exact posture and limb positions of the user in Image 1.
  - NO LEAKAGE: If Image 2 contains a human model, NEVER include their face, hands, or skin in the output.
  - SINGLE IMAGE: Return only the final photorealistic render.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: [{ parts: [...parts, { text: prompt }] }],
    config: {
      systemInstruction,
      imageConfig: {
        aspectRatio: "3:4"
      }
    }
  });

  const resultPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (resultPart?.inlineData) {
    return `data:image/png;base64,${resultPart.inlineData.data}`;
  }
  
  throw new Error("Smart fitting service failed to render the preview.");
};