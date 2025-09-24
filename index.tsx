/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI } from "@google/genai";

// Read API Key from the global window object set by config.js
const API_KEY = (window as any).GEMINI_API_KEY;

document.addEventListener('DOMContentLoaded', () => {
    // DOM Element References
    const imageUploadInput = document.getElementById('image-upload') as HTMLInputElement;
    const imagePreview = document.getElementById('image-preview') as HTMLImageElement;
    const generateButton = document.getElementById('generate-btn') as HTMLButtonElement;
    const resetButton = document.getElementById('reset-btn') as HTMLButtonElement;
    const videoPlayer = document.getElementById('video-player') as HTMLVideoElement;
    const loader = document.getElementById('loader') as HTMLDivElement;
    const videoContainer = document.getElementById('video-container') as HTMLDivElement;
    const uploadContainer = document.getElementById('upload-container') as HTMLDivElement;
    const errorContainer = document.getElementById('error-container') as HTMLDivElement;
    const loadingMessage = document.getElementById('loading-message') as HTMLParagraphElement;

    // --- Check for API Key ---
    if (!API_KEY) {
        uploadContainer.style.display = 'none';
        errorContainer.textContent = 'خطأ في الإعداد: مفتاح API غير موجود. يرجى التأكد من إضافته بشكل صحيح في إعدادات Netlify.';
        errorContainer.style.display = 'block';
        return; // Stop execution if no API key
    }

    let imageBase64: string | null = null;
    let imageMimeType: string | null = null;

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = error => reject(error);
        });
    };
    
    const resetUI = () => {
        uploadContainer.style.display = 'flex';
        loader.style.display = 'none';
        videoContainer.style.display = 'none';
        errorContainer.style.display = 'none';
        
        generateButton.disabled = true;
        imagePreview.style.display = 'none';
        imagePreview.src = '';
        imageUploadInput.value = '';
        imageBase64 = null;
        imageMimeType = null;
    };

    imageUploadInput.addEventListener('change', async (event) => {
        const files = (event.target as HTMLInputElement).files;
        if (!files || files.length === 0) return;

        const file = files[0];
        if (!file.type.startsWith('image/')) {
            errorContainer.textContent = 'الرجاء اختيار ملف صورة صالح.';
            errorContainer.style.display = 'block';
            return;
        }

        errorContainer.style.display = 'none';
        imageMimeType = file.type;
        try {
            imageBase64 = await fileToBase64(file);
            imagePreview.src = `data:${imageMimeType};base64,${imageBase64}`;
            imagePreview.style.display = 'block';
            generateButton.disabled = false;
        } catch (err) {
            console.error('Error reading file:', err);
            errorContainer.textContent = 'حدث خطأ أثناء قراءة الصورة.';
            errorContainer.style.display = 'block';
        }
    });

    generateButton.addEventListener('click', async () => {
        if (!imageBase64 || !imageMimeType) {
            errorContainer.textContent = 'الرجاء رفع صورة أولاً.';
            errorContainer.style.display = 'block';
            return;
        }

        uploadContainer.style.display = 'none';
        loader.style.display = 'flex';
        errorContainer.style.display = 'none';
        videoContainer.style.display = 'none';
        videoPlayer.src = '';

        try {
            const ai = new GoogleGenAI({ apiKey: API_KEY });
            const prompt = "Animate only the main subject in this image. The camera must be absolutely fixed and static. Do not zoom, pan, tilt, or move the camera in any way. The background must also remain completely still. Do not add any visual effects like smoke, vapor, dust, or particles. The animation should be subtle and short.";
            
            setLoadingMessage("جاري تهيئة عملية إنشاء الفيديو...");

            let operation = await ai.models.generateVideos({
                model: 'veo-2.0-generate-001',
                prompt: prompt,
                image: { imageBytes: imageBase64, mimeType: imageMimeType },
                config: { numberOfVideos: 1 }
            });

            const loadingMessages = [
                "الذكاء الاصطناعي يقوم بصياغة الفيديو الخاص بك...",
                "هذه العملية قد تستغرق بضع دقائق، شكراً لصبرك.",
                "يتم الآن صقل التفاصيل النهائية...",
                "أوشكنا على الانتهاء، يتم وضع اللمسات الأخيرة..."
            ];
            let messageIndex = 0;
            setLoadingMessage(loadingMessages[messageIndex]);

            while (!operation.done) {
                await new Promise(resolve => setTimeout(resolve, 10000));
                if (messageIndex < loadingMessages.length - 1) {
                    messageIndex++;
                    setLoadingMessage(loadingMessages[messageIndex]);
                }
                operation = await ai.operations.getVideosOperation({ operation: operation });
            }

            if (operation.error) {
                // Fix: Ensure argument to Error constructor is always a string.
                throw new Error(String(operation.error.message || 'حدث خطأ غير معروف أثناء إنشاء الفيديو.'));
            }

            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (!downloadLink) {
                throw new Error('فشل إنشاء الفيديو في إنتاج نتيجة.');
            }

            setLoadingMessage("جاري تحميل الفيديو...");
            const response = await fetch(`${downloadLink}&key=${API_KEY}`);
            if (!response.ok) {
                throw new Error(`فشل تحميل الفيديو: ${response.statusText}`);
            }

            const videoBlob = await response.blob();
            const videoUrl = URL.createObjectURL(videoBlob);

            videoPlayer.src = videoUrl;
            videoContainer.style.display = 'flex';

        } catch (err: any) {
            console.error(err);
            errorContainer.textContent = `خطأ: ${err.message || 'حدث خطأ غير متوقع. الرجاء المحاولة مرة أخرى.'}`;
            errorContainer.style.display = 'block';
            uploadContainer.style.display = 'flex'; // Show upload again on error
        } finally {
            loader.style.display = 'none';
        }
    });
    
    resetButton.addEventListener('click', resetUI);
    
    // Initialize UI on first load, but only if the API key exists
    if (API_KEY) {
        resetUI(); 
    }
});

function setLoadingMessage(message: string) {
    const loadingMessageElement = document.getElementById('loading-message') as HTMLParagraphElement;
    if (loadingMessageElement) {
        loadingMessageElement.textContent = message;
    }
}