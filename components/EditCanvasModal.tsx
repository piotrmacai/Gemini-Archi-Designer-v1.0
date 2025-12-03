/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface EditCanvasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (file: File) => void;
  imageFile: File | null;
}

const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

type Mode = 'trim' | 'expand';
type FillStyle = 'blur' | 'white' | 'black' | 'transparent';

const EditCanvasModal: React.FC<EditCanvasModalProps> = ({ isOpen, onClose, onSave, imageFile }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>('expand');
  const [fillStyle, setFillStyle] = useState<FillStyle>('blur');
  
  // Margins in percentages (0-50 usually safe, but we can allow up to larger amounts for expand)
  const [margins, setMargins] = useState({ top: 0, bottom: 0, left: 0, right: 0 });
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && imageFile) {
      // Reset state when opening
      setMargins({ top: 0, bottom: 0, left: 0, right: 0 });
      setMode('expand');
      
      // Load initial preview
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target?.result as string);
      reader.readAsDataURL(imageFile);
    }
  }, [isOpen, imageFile]);

  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !previewUrl) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
        // Original dimensions
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        
        let newW = w;
        let newH = h;
        let offsetX = 0;
        let offsetY = 0;

        // Convert percentage margins to pixels
        // For Trim: margin is percentage of ORIGINAL size to remove
        // For Expand: margin is percentage of ORIGINAL size to add
        const mTop = Math.floor(h * (margins.top / 100));
        const mBottom = Math.floor(h * (margins.bottom / 100));
        const mLeft = Math.floor(w * (margins.left / 100));
        const mRight = Math.floor(w * (margins.right / 100));

        if (mode === 'trim') {
            newW = Math.max(1, w - mLeft - mRight);
            newH = Math.max(1, h - mTop - mBottom);
            // Source offsets
            const sX = mLeft;
            const sY = mTop;
            
            canvas.width = newW;
            canvas.height = newH;
            
            ctx.clearRect(0, 0, newW, newH);
            ctx.drawImage(img, sX, sY, newW, newH, 0, 0, newW, newH);
        } else {
            // Expand
            newW = w + mLeft + mRight;
            newH = h + mTop + mBottom;
            offsetX = mLeft;
            offsetY = mTop;
            
            canvas.width = newW;
            canvas.height = newH;

            // Draw background
            if (fillStyle === 'transparent') {
                ctx.clearRect(0, 0, newW, newH);
            } else if (fillStyle === 'white') {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, newW, newH);
            } else if (fillStyle === 'black') {
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, newW, newH);
            } else if (fillStyle === 'blur') {
                 // Draw stretched blurred image first
                 ctx.filter = 'blur(20px)';
                 ctx.drawImage(img, 0, 0, newW, newH);
                 ctx.filter = 'none';
            }

            // Draw original image centered in the new canvas
            ctx.drawImage(img, offsetX, offsetY, w, h);
        }
    };
    img.src = previewUrl;

  }, [previewUrl, margins, mode, fillStyle]);

  useEffect(() => {
      drawPreview();
  }, [drawPreview]);

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
        if (blob) {
            const newFile = new File([blob], `edited-${Date.now()}.png`, { type: 'image/png' });
            onSave(newFile);
            onClose();
        }
    }, 'image/png');
  };

  const updateMargin = (side: keyof typeof margins, value: number) => {
      setMargins(prev => ({ ...prev, [side]: value }));
  };

  if (!isOpen || !imageFile) return null;

  const handleModalContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl flex flex-col md:flex-row overflow-hidden max-h-[90vh]"
        onClick={handleModalContentClick}
      >
        {/* Preview Area */}
        <div className="flex-1 bg-gray-100 dark:bg-black/50 p-4 flex items-center justify-center overflow-auto min-h-[300px]">
            <canvas ref={canvasRef} className="max-w-full max-h-full shadow-lg border border-gray-300 dark:border-gray-700" />
        </div>

        {/* Controls Area */}
        <div className="w-full md:w-80 p-6 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col gap-6 overflow-y-auto">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Edit Canvas</h2>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:hover:text-white"><CloseIcon /></button>
            </div>

            {/* Mode Toggle */}
            <div className="flex rounded-lg bg-gray-200 dark:bg-gray-700 p-1">
                <button 
                    onClick={() => setMode('expand')}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all ${mode === 'expand' ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                >
                    Expand
                </button>
                <button 
                    onClick={() => setMode('trim')}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all ${mode === 'trim' ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                >
                    Trim
                </button>
            </div>

            {/* Sliders */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    {mode === 'expand' ? 'Add Margin (%)' : 'Crop From Edge (%)'}
                </h3>
                
                {['top', 'bottom', 'left', 'right'].map((side) => (
                    <div key={side} className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 capitalize">
                            <span>{side}</span>
                            <span>{margins[side as keyof typeof margins]}%</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" 
                            max={mode === 'trim' ? "45" : "50"} // Limit trim to avoid 0 size
                            value={margins[side as keyof typeof margins]}
                            onChange={(e) => updateMargin(side as keyof typeof margins, parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                    </div>
                ))}
            </div>

            {/* Background Options (Only for Expand) */}
            {mode === 'expand' && (
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Fill Style</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {(['blur', 'white', 'black', 'transparent'] as FillStyle[]).map((style) => (
                            <button
                                key={style}
                                onClick={() => setFillStyle(style)}
                                className={`px-3 py-2 text-xs font-medium rounded border transition-colors capitalize ${
                                    fillStyle === style 
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' 
                                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                            >
                                {style}
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        "Blur" is recommended for AI generation to help blend the expanded area.
                    </p>
                </div>
            )}

            <div className="pt-4 mt-auto flex gap-3">
                 <button 
                    onClick={onClose}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleSave}
                    className="flex-1 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-bold rounded-lg hover:bg-gray-700 dark:hover:bg-gray-300 transition"
                >
                    Apply & Save
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default EditCanvasModal;
