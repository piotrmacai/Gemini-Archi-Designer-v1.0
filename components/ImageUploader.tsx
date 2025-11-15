/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useCallback, useRef, useState, useImperativeHandle, forwardRef, useEffect } from 'react';

interface ImageUploaderProps {
  id: string;
  label?: string;
  onFileSelect: (file: File) => void;
  imageUrl: string | null;
  showDebugButton?: boolean;
  onDebugClick?: () => void;
  disabled?: boolean;
  aspectRatio?: 'video' | 'square';
  // Props for product drop zone
  isProductDraggingOver?: boolean;
  onProductDragOver?: (e: React.DragEvent) => void;
  onProductDragLeave?: (e: React.DragEvent) => void;
  onProductDrop?: (e: React.DragEvent) => void;
}

const UploadIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
);

const WarningIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-4a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
);


const ImageUploader = forwardRef<HTMLImageElement, ImageUploaderProps>(({ id, label, onFileSelect, imageUrl, showDebugButton, onDebugClick, disabled = false, aspectRatio = 'video', isProductDraggingOver, onProductDragOver, onProductDragLeave, onProductDrop }, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [fileTypeError, setFileTypeError] = useState<string | null>(null);

  // Expose the internal imgRef to the parent component via the forwarded ref
  useImperativeHandle(ref, () => imgRef.current as HTMLImageElement);
  
  useEffect(() => {
    if (!imageUrl) {
      setFileTypeError(null);
    }
  }, [imageUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setFileTypeError('For best results, please use PNG, JPG, or JPEG formats.');
        onFileSelect(file); // still pass it up, let parent decide
      } else {
        setFileTypeError(null);
        onFileSelect(file);
      }
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    inputRef.current?.click();
  };
  
  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (disabled) return;
      if (event.dataTransfer.types.includes('Files')) {
        setIsDraggingOver(true);
      }
  }, [disabled]);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDraggingOver(false);
      if (disabled) return;
      
      const file = event.dataTransfer.files?.[0];
      if (file && file.type.startsWith('image/')) {
          const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
          if (!allowedTypes.includes(file.type)) {
              setFileTypeError('For best results, please use PNG, JPG, or JPEG formats.');
              onFileSelect(file);
          } else {
              setFileTypeError(null);
              onFileSelect(file);
          }
      }
  }, [onFileSelect, disabled]);
  
  const isActionable = !disabled;

  const uploaderClasses = `w-full ${aspectRatio === 'square' ? 'aspect-square' : 'aspect-video'} bg-gray-100 dark:bg-gray-800 border-2 border-dashed rounded-xl flex items-center justify-center transition-all duration-300 relative overflow-hidden ${
      isDraggingOver ? 'border-gray-900 dark:border-gray-300 bg-gray-100 dark:bg-gray-700'
    : 'border-gray-300 dark:border-gray-600'
  } ${isActionable ? 'hover:border-gray-400 dark:hover:border-gray-500 cursor-pointer' : ''} ${disabled && !imageUrl ? 'cursor-not-allowed opacity-70 dark:opacity-60' : ''}`;

  return (
    <div className="flex flex-col items-center w-full">
      {label && <h3 className="text-xl font-semibold mb-4 text-gray-700">{label}</h3>}
      <div
        className={uploaderClasses}
        onClick={isActionable ? handleClick : undefined}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-dropzone-id={id}
      >
        <input
          type="file"
          id={id}
          ref={inputRef}
          onChange={handleFileChange}
          accept="image/png, image/jpeg, image/webp"
          className="hidden"
          disabled={disabled}
        />
        {imageUrl ? (
          <>
            <img 
              ref={imgRef}
              src={imageUrl} 
              alt={label || 'Uploaded Scene'} 
              className="w-full h-full object-contain" 
            />
          </>
        ) : (
          <div className="text-center text-gray-500 dark:text-gray-400 p-4">
            <UploadIcon />
            <p>Click to upload or drag & drop</p>
            {disabled && <p className="text-xs mt-1">(Create a new project first)</p>}
          </div>
        )}
      </div>
      {fileTypeError && (
        <div className="w-full mt-2 text-sm text-yellow-800 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700/50 rounded-lg p-3 flex items-center animate-fade-in" role="alert">
            <WarningIcon />
            <span>{fileTypeError}</span>
        </div>
      )}
    </div>
  );
});

export default ImageUploader;
