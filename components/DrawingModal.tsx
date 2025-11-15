/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useEffect, useState, useCallback } from 'react';

interface DrawingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
  backgroundImageUrl: string;
}

const colors = ['#EF4444', '#F97316', '#10B981', '#3B82F6', '#6366F1', '#EC4899', '#333333', '#FFFFFF'];

const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const UndoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
);

const DrawingModal: React.FC<DrawingModalProps> = ({ isOpen, onClose, onSave, backgroundImageUrl }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const history = useRef<ImageData[]>([]);
  const historyIndex = useRef<number>(-1);

  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState(colors[0]);
  const [brushSize, setBrushSize] = useState(10);
  const [isErasing, setIsErasing] = useState(false);

  const saveToHistory = useCallback(() => {
    if (contextRef.current && canvasRef.current) {
      const imageData = contextRef.current.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
      history.current.splice(historyIndex.current + 1);
      history.current.push(imageData);
      historyIndex.current = history.current.length - 1;
    }
  }, []);
  
  const restoreFromHistory = useCallback(() => {
    if (history.current.length > 0 && contextRef.current) {
        const imageData = history.current[historyIndex.current];
        contextRef.current.putImageData(imageData, 0, 0);
    }
  }, []);
  
  const initializeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    contextRef.current = context;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = backgroundImageUrl;
    img.onload = () => {
      const container = canvas.parentElement!;
      const { width, height } = container.getBoundingClientRect();
      const aspectRatio = img.naturalWidth / img.naturalHeight;
      
      let canvasWidth = width;
      let canvasHeight = width / aspectRatio;

      if (canvasHeight > height) {
        canvasHeight = height;
        canvasWidth = height * aspectRatio;
      }

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Reset history
      history.current = [];
      historyIndex.current = -1;
      saveToHistory(); // Save initial state
    };
  }, [backgroundImageUrl, saveToHistory]);

  useEffect(() => {
    if (isOpen) {
      initializeCanvas();
      window.addEventListener('resize', initializeCanvas);
    }
    return () => {
        window.removeEventListener('resize', initializeCanvas);
    }
  }, [isOpen, initializeCanvas]);

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
        return {
            x: e.touches[0].clientX - rect.left,
            y: e.touches[0].clientY - rect.top,
        };
    }
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const context = contextRef.current;
    if (!context) return;
    
    setIsDrawing(true);
    const { x, y } = getCoords(e);
    context.beginPath();
    context.moveTo(x, y);
    context.lineWidth = brushSize;
    context.strokeStyle = color;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.globalCompositeOperation = isErasing ? 'destination-out' : 'source-over';
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !contextRef.current) return;
    e.preventDefault(); // Prevent scrolling on touch devices
    const { x, y } = getCoords(e);
    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing && contextRef.current) {
        contextRef.current.closePath();
        saveToHistory();
    }
    setIsDrawing(false);
  };
  
  const handleUndo = () => {
    if (historyIndex.current > 0) {
      historyIndex.current -= 1;
      restoreFromHistory();
    }
  };
  
  const handleClear = () => {
    historyIndex.current = 0;
    restoreFromHistory();
  };
  
  const handleSave = () => {
    if (canvasRef.current) {
        onSave(canvasRef.current.toDataURL('image/png'));
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex flex-col items-center justify-center p-4 animate-fade-in"
      aria-modal="true"
      role="dialog"
    >
      {/* Header Tools */}
      <div className="w-full max-w-7xl flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded-t-lg border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <button onClick={handleUndo} className="text-gray-600 dark:text-gray-300 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50" disabled={historyIndex.current <= 0} aria-label="Undo">
            <UndoIcon />
          </button>
          <button onClick={handleClear} className="text-gray-600 dark:text-gray-300 font-semibold p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm" aria-label="Clear sketch">
            Clear
          </button>
        </div>
        <div className="text-lg text-gray-900 dark:text-gray-100 font-bold">Sketch Your Vision</div>
        <div className="flex items-center gap-4">
            <button onClick={handleSave} className="bg-gray-900 hover:bg-gray-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm">
                Save Sketch
            </button>
            <button onClick={onClose} className="text-gray-500 dark:text-gray-400 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" aria-label="Close drawing mode">
                <CloseIcon />
            </button>
        </div>
      </div>
      
      {/* Canvas Area */}
      <div className="w-full max-w-7xl h-full flex-grow bg-gray-100 dark:bg-gray-900 flex items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="cursor-crosshair"
        />
      </div>

      {/* Footer Tools */}
      <div className="w-full max-w-7xl flex flex-col sm:flex-row justify-between items-center gap-4 p-3 bg-white dark:bg-gray-800 rounded-b-lg border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          {colors.map(c => (
            <button 
              key={c}
              onClick={() => { setColor(c); setIsErasing(false); }}
              className={`w-8 h-8 rounded-full transition-transform transform hover:scale-110 ${color === c && !isErasing ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-800 ring-gray-900 dark:ring-gray-200' : ''}`}
              style={{ backgroundColor: c, border: c === '#FFFFFF' ? '1px solid #ccc' : 'none' }}
              aria-label={`Select color ${c}`}
            />
          ))}
          <button
            onClick={() => setIsErasing(true)}
            className={`w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-800 dark:text-gray-200 transition-transform transform hover:scale-110 ${isErasing ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-800 ring-gray-900 dark:ring-gray-200' : ''}`}
            aria-label="Eraser tool"
          >
           E
          </button>
        </div>
        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
          <span>Brush Size</span>
          <input 
            type="range"
            min="2"
            max="50"
            value={brushSize}
            onChange={e => setBrushSize(Number(e.target.value))}
            className="w-36 accent-gray-900 dark:accent-indigo-500"
          />
        </div>
      </div>
    </div>
  );
};

export default DrawingModal;