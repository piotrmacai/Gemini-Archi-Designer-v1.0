/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";

// Helper to crop a square image back to an original aspect ratio, removing padding.
const cropToOriginalAspectRatio = (
    imageDataUrl: string,
    originalWidth: number,
    originalHeight: number,
    targetDimension: number
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = imageDataUrl;
        img.onload = () => {
            // Re-calculate the dimensions of the content area within the padded square image
            const aspectRatio = originalWidth / originalHeight;
            let contentWidth, contentHeight;
            if (aspectRatio > 1) { // Landscape
                contentWidth = targetDimension;
                contentHeight = targetDimension / aspectRatio;
            } else { // Portrait or square
                contentHeight = targetDimension;
                contentWidth = targetDimension * aspectRatio;
            }

            // Calculate the top-left offset of the content area
            const x = (targetDimension - contentWidth) / 2;
            const y = (targetDimension - contentHeight) / 2;

            const canvas = document.createElement('canvas');
            // Set canvas to the final, un-padded dimensions
            canvas.width = contentWidth;
            canvas.height = contentHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not get canvas context for cropping.'));
            }
            
            // Draw the relevant part of the square generated image onto the new, smaller canvas
            ctx.drawImage(img, x, y, contentWidth, contentHeight, 0, 0, contentWidth, contentHeight);
            
            // Return the data URL of the newly cropped image
            resolve(canvas.toDataURL('image/jpeg', 0.95));
        };
        img.onerror = (err) => reject(new Error(`Image load error during cropping: ${err}`));
    });
};


// New resize logic inspired by the reference to enforce a consistent aspect ratio without cropping.
// It resizes the image to fit within a square and adds padding, ensuring a consistent
// input size for the AI model, which enhances stability.
const resizeImage = (file: File, targetDimension: number): Promise<File> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            if (!event.target?.result) {
                return reject(new Error("Failed to read file."));
            }
            const img = new Image();
            img.src = event.target.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = targetDimension;
                canvas.height = targetDimension;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('Could not get canvas context.'));
                }

                // Fill the canvas with a neutral background to avoid transparency issues
                // and ensure a consistent input format for the model.
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, targetDimension, targetDimension);

                // Calculate new dimensions to fit inside the square canvas while maintaining aspect ratio
                const aspectRatio = img.width / img.height;
                let newWidth, newHeight;

                if (aspectRatio > 1) { // Landscape image
                    newWidth = targetDimension;
                    newHeight = targetDimension / aspectRatio;
                } else { // Portrait or square image
                    newHeight = targetDimension;
                    newWidth = targetDimension * aspectRatio;
                }

                // Calculate position to center the image on the canvas
                const x = (targetDimension - newWidth) / 2;
                const y = (targetDimension - newHeight) / 2;
                
                // Draw the resized image onto the centered position
                ctx.drawImage(img, x, y, newWidth, newHeight);

                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(new File([blob], file.name, {
                            type: 'image/jpeg', // Force jpeg to handle padding color consistently
                            lastModified: Date.now()
                        }));
                    } else {
                        reject(new Error('Canvas to Blob conversion failed.'));
                    }
                }, 'image/jpeg', 0.95);
            };
            img.onerror = (err) => reject(new Error(`Image load error: ${err}`));
        };
        reader.onerror = (err) => reject(new Error(`File reader error: ${err}`));
    });
};

// Helper function to convert a File object to a Gemini API Part
const fileToPart = async (file: File): Promise<{ inlineData: { mimeType: string; data: string; } }> => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    
    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");
    
    const mimeType = mimeMatch[1];
    const data = arr[1];
    return { inlineData: { mimeType, data } };
};

// Helper to convert File to a data URL string
const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

/**
 * Generates a new room design using a multi-modal AI model.
 * @param imageToProcess The file for the room/scene to be redesigned (could be original, sketched, or previously generated).
 * @param originalWidth The width of the very first user-uploaded image, used for final cropping.
 * @param originalHeight The height of the very first user-uploaded image, used for final cropping.
 * @param userPrompt A text description of the desired design changes.
 * @param productImage An optional file for a specific product to include in the design.
 * @param backgroundImage An optional file to use as a new background for the scene.
 * @param isSketched A boolean indicating if the imageToProcess contains a user sketch.
 * @returns A promise that resolves to an object containing the data URL of the generated image and debug info.
 */
export const redesignRoom = async (
    imageToProcess: File,
    originalWidth: number,
    originalHeight: number,
    userPrompt: string,
    productImage: File | null,
    backgroundImage: File | null,
    isSketched: boolean,
): Promise<{ finalImageUrl: string; debugImageUrl: string; finalPrompt: string; }> => {
  console.log('Starting room redesign process...');
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
  
  // Define standard dimension for model inputs
  const MAX_DIMENSION = 1024;
  
  // STEP 1: Prepare image by resizing
  console.log('Resizing room image...');
  const resizedRoomImage = await resizeImage(imageToProcess, MAX_DIMENSION);
  const debugImageUrl = await fileToDataUrl(resizedRoomImage);
  
  // STEP 2: Generate composite image using the resized image and the prompt
  console.log('Preparing to generate new room design...');

  const parts: ({ inlineData: { mimeType: string; data: string; }; } | { text: string; })[] = [await fileToPart(resizedRoomImage)];
  
  let prompt = `**Role and Goal:**
You are an expert AI photo-editor specializing in realistic architectural and landscape modifications. Your task is to edit the provided image based on the user's instructions.

**Primary Directive: EDIT, DO NOT REPLACE.**
This is your most important instruction. You must treat this as an image editing task, not an image generation task.
-   **Preserve the Original:** Maintain the original image's composition, camera angle, lighting, and core structures.
-   **Do Not Alter:** Do not change the fundamental shape of the house, roofline, window placements, door placements, or any other element not explicitly mentioned in the user's request.
-   **Ignore Padding:** The base image may have black padding around it; this padding should be ignored and is not part of the scene to be edited.

**User's Edit Instructions:**
Apply the following changes to the image: "${userPrompt}"
`;
  
  if (isSketched) {
      prompt += `
**Critical Instruction: Sketch-Based Editing ONLY.**
The user has provided a sketch on top of the image. This sketch indicates the *only* areas you are allowed to modify.
-   You MUST confine ALL edits *exclusively* to the areas indicated by the sketch.
-   Do NOT alter any other part of the image. The rest of the image must remain identical to the original.
-   The user's text prompt should be interpreted as instructions for *what* to do within the sketched areas. For example, if the prompt says "add a flowerbed" and the user has drawn a circle on the lawn, you must create the flowerbed only inside that circle.
-   Integrate these sketched elements realistically into the scene, matching the existing style and lighting.
`;
  }

  if (productImage) {
      console.log('Adding product image to request...');
      parts.push(await fileToPart(productImage));
      prompt += `
**Product Placement Instructions:**
The user has provided a second image containing a specific element to add.
-   You MUST photorealistically integrate this exact element into the main scene.
-   Ensure the added element's scale, lighting, and perspective are seamlessly blended into the scene to look natural.
`;
  }

  if (backgroundImage) {
      console.log('Adding background image to request...');
      parts.push(await fileToPart(backgroundImage));
      prompt += `
**Critical Task: Background Replacement**
The user has provided a new background image. Your primary task is to perform a professional-grade photo composition.

**Image Roles:**
-   **Main Image (first image):** Contains the primary subject (e.g., a house, a person, an object).
-   **Background Image (third image provided):** This is the new environment.

**Step-by-Step Composition Directive:**
1.  **Isolate the Subject:** Accurately identify and isolate the main subject from the first image. Ignore its original background.
2.  **Analyze the New Environment:** Scrutinize the provided background image. Pay close attention to:
    -   **Lighting Source & Direction:** Where is the sun or primary light? What direction are the shadows falling?
    -   **Color Temperature:** Is the light warm (golden hour) or cool (overcast day)?
    -   **Atmosphere:** Is it sunny, foggy, nighttime?
3.  **Integrate and Harmonize:**
    -   Place the isolated subject realistically into the new background.
    -   **Crucially, you MUST re-light the subject.** Adjust its highlights, shadows, and color grading to perfectly match the lighting conditions of the new background. The subject must look like it truly belongs in the new scene, not like it was cut and pasted.
    -   Ensure shadows cast *by* the subject onto the new background are consistent with the environment's light source.
4.  **Scale and Perspective:** Adjust the subject's size and perspective to be believable within the new scene.
5.  **Final Blend:** Seamlessly blend the edges of the subject into the background to create a photorealistic final image. The user's text prompt ("${userPrompt}") should guide any additional stylistic modifications *after* the composition is complete.
`;
  }

  prompt += `
**Final Output Requirements:**
-   The output must be a single, high-quality, photorealistic image that is an edited version of the original.
-   It should ONLY contain the modified image. No text, logos, or other artifacts.
`;

  const textPart = { text: prompt };
  parts.push(textPart);

  console.log('Sending image(s) and prompt to the model...');
  
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  });

  console.log('Received response from model.');
  
  const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

  if (imagePartFromResponse?.inlineData) {
    const { mimeType, data } = imagePartFromResponse.inlineData;
    console.log(`Received image data (${mimeType}), length:`, data.length);
    const generatedSquareImageUrl = `data:${mimeType};base64,${data}`;
    
    console.log('Cropping generated image to original aspect ratio...');
    const finalImageUrl = await cropToOriginalAspectRatio(
        generatedSquareImageUrl,
        originalWidth,
        originalHeight,
        MAX_DIMENSION
    );
    
    return { finalImageUrl, debugImageUrl, finalPrompt: prompt };
  }

  console.error("Model response did not contain an image part.", response);
  // FIX: Removed typo 'a' from 'throw a new Error'.
  throw new Error("The AI model did not return an image. Please try again.");
};

/**
 * Generates a new view of an existing design by rotating the camera perspective.
 * @param currentImage The file of the currently generated design.
 * @param originalWidth The width of the user's original uploaded photo.
 * @param originalHeight The height of the user's original uploaded photo.
 * @param direction The direction to rotate the view ('left' or 'right').
 * @returns A promise that resolves to an object containing the data URL of the new rotated image.
 */
export const generateRotatedView = async (
    currentImage: File,
    originalWidth: number,
    originalHeight: number,
    direction: 'left' | 'right'
): Promise<{ finalImageUrl: string; }> => {
    console.log(`Generating rotated view to the ${direction}...`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const MAX_DIMENSION = 1024;
    
    // STEP 1: Resize the current image to fit the model's expected input
    const resizedImage = await resizeImage(currentImage, MAX_DIMENSION);
    const imagePart = await fileToPart(resizedImage);
    
    // STEP 2: Create a specific prompt for the rotation task
    const prompt = `**Role and Goal:** You are an expert AI architectural visualizer. Your function is to generate a photorealistic rendering of a building from a different camera angle, maintaining absolute fidelity to the design shown in the input image.

**Core Task: Incremental Camera Rotation**
The input image is a single viewpoint of a building. Your task is to generate a new photorealistic image showing the *exact same building and its surroundings*, but with the camera viewpoint rotated **precisely 45 degrees to the ${direction}** from the current view.

**Critical Directives for Continuity and Accuracy:**
-   **Treat Input as Ground Truth:** The provided image is the current state. Your output must be a direct continuation of this view. If the input image is already a rotated view, your task is to rotate it *further*.
-   **Unalterable Architecture:** The building's design, style, materials, textures, and colors are immutable. You MUST NOT alter any existing architectural elements (walls, rooflines, windows, doors, etc.).
-   **Realistic Extrapolation:** The primary challenge is to realistically render the parts of the building and environment that become visible after the 45-degree rotation. These newly visible sections MUST be a logical and consistent extension of the visible architecture. For example, a brick wall must continue as a brick wall. A window pattern should continue logically.
-   **Consistent Environment:** Maintain the identical lighting conditions (time of day, shadow direction), weather, and landscaping style from the input image. The world around the building does not change, only the camera's position.
-   **Ignore Padding:** The input image may have black padding. This is an artifact and must be completely ignored. It is not part of the scene.

**Final Output Requirements:**
-   The output MUST be a single, high-quality, photorealistic image of the building from the new 45-degree viewpoint.
-   The image should be clean, without any text, watermarks, or other artifacts.
-   Ensure the perspective shift is accurate and feels like a real camera movement.
`;
    const textPart = { text: prompt };

    // STEP 3: Call the AI model
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [imagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    console.log('Received response from model for rotation.');
    
    // STEP 4: Process the response
    const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
    if (imagePartFromResponse?.inlineData) {
        const { mimeType, data } = imagePartFromResponse.inlineData;
        const generatedSquareImageUrl = `data:${mimeType};base64,${data}`;
        
        // Crop the result back to the original aspect ratio
        const finalImageUrl = await cropToOriginalAspectRatio(
            generatedSquareImageUrl,
            originalWidth,
            originalHeight,
            MAX_DIMENSION
        );
        return { finalImageUrl };
    }
    
    console.error("Model response did not contain an image part for rotation.", response);
    throw new Error("The AI model did not return an image for rotation.");
};