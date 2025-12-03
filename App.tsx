/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { redesignRoom, generateRotatedView } from './services/geminiService';
import { saveSessionsToDB, loadSessionsFromDB } from './services/storageService';
import { getImageDimensions } from './utils/fileUtils';
import Header from './components/Header';
import ImageUploader from './components/ImageUploader';
import Spinner from './components/Spinner';
import DebugModal from './components/DebugModal';
import DrawingModal from './components/DrawingModal';
import AddProductModal from './components/AddProductModal';
import AddBackgroundModal from './components/AddBackgroundModal';
import EditCanvasModal from './components/EditCanvasModal';
import HistorySidebar from './components/HistorySidebar';
import { DesignSession } from './types';

const loadingMessages = [
    "Analyzing your property's layout...",
    "Interpreting your design sketch...",
    "Consulting with our AI architect...",
    "Placing virtual furniture...",
    "Arranging decor and features...",
    "Rendering your beautiful new space...",
    "Generating a new perspective...",
    "Rotating the camera view...",
];

const ArrowLeftIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M15 18l-6-6 6-6"/></svg>
);

const ArrowRightIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M9 18l6-6-6-6"/></svg>
);

const UndoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M21 9H6.47a2 2 0 0 0-1.79 1.11L2 16"/><path d="M6 13 2 16l4 3"/></svg>
);

const RedoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M3 9h14.53a2 2 0 0 1 1.79 1.11L22 16"/><path d="M18 13l4 3-4 3"/></svg>
);

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
);

const ScissorsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line></svg>
);


const App: React.FC = () => {
  // Session management state
  const [sessions, setSessions] = useState<DesignSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [sessionsLoaded, setSessionsLoaded] = useState<boolean>(false);

  // Active session's working state
  const [sceneImage, setSceneImage] = useState<File | null>(null);
  const [productImage, setProductImage] = useState<File | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<File | null>(null);
  const [sketchedImage, setSketchedImage] = useState<File | null>(null);
  const [history, setHistory] = useState<File[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [prompt, setPrompt] = useState<string>('');
  const [originalDimensions, setOriginalDimensions] = useState<{width: number, height: number} | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  
  const [debugImageUrl, setDebugImageUrl] = useState<string | null>(null);
  const [debugPrompt, setDebugPrompt] = useState<string | null>(null);
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);
  const [isDrawingModalOpen, setIsDrawingModalOpen] = useState(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isAddBackgroundModalOpen, setIsAddBackgroundModalOpen] = useState(false);
  const [isEditCanvasModalOpen, setIsEditCanvasModalOpen] = useState(false);

  const sceneUploaderRef = useRef<HTMLImageElement>(null);

  const currentGeneratedImage = history[historyIndex] ?? null;
  
  // The image that is currently main on the screen. This is what we edit.
  const currentWorkingImage = sketchedImage || currentGeneratedImage || sceneImage;

  const sceneImageUrl = sceneImage ? URL.createObjectURL(sceneImage) : null;
  const sketchedImageUrl = sketchedImage ? URL.createObjectURL(sketchedImage) : null;
  const generatedImageUrl = currentGeneratedImage ? URL.createObjectURL(currentGeneratedImage) : null;
  const displayImageUrl = generatedImageUrl || sketchedImageUrl || sceneImageUrl;
  
  // Effect to cycle loading messages
  useEffect(() => {
    if (isLoading) {
      const interval = setInterval(() => {
        setLoadingMessageIndex((prevIndex) => (prevIndex + 1) % loadingMessages.length);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [isLoading]);

  // Effect for loading/saving sessions from/to storage
  useEffect(() => {
    loadSessionsFromDB().then(loadedSessions => {
      setSessions(loadedSessions);
      if (loadedSessions.length > 0) {
        // Activate the most recent session
        handleSelectSession(loadedSessions[0].id);
      }
      setSessionsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (sessionsLoaded) {
      saveSessionsToDB(sessions);
    }
  }, [sessions, sessionsLoaded]);


  const clearWorkingState = () => {
    setSceneImage(null);
    setProductImage(null);
    setBackgroundImage(null);
    setSketchedImage(null);
    setHistory([]);
    setHistoryIndex(-1);
    setPrompt('');
    setError(null);
    setIsLoading(false);
    setDebugImageUrl(null);
    setDebugPrompt(null);
    setOriginalDimensions(null);
  }

  const handleNewProject = useCallback(() => {
    clearWorkingState();
    setActiveSessionId(null);
  }, []);
  
  const handleSelectSession = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      clearWorkingState();
      setSceneImage(session.sceneImage);
      setOriginalDimensions(session.originalDimensions);
      setHistory(session.generations);
      setHistoryIndex(session.generations.length - 1);
      setActiveSessionId(session.id);
    }
  }, [sessions]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    const remainingSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(remainingSessions);

    if (activeSessionId === sessionId) {
      if (remainingSessions.length > 0) {
        handleSelectSession(remainingSessions[0].id);
      } else {
        handleNewProject();
      }
    }
  }, [activeSessionId, sessions, handleSelectSession, handleNewProject]);

  const handleSceneImageUpload = async (file: File) => {
    try {
      const dimensions = await getImageDimensions(file);
      const thumbnailReader = new FileReader();
      thumbnailReader.readAsDataURL(file);
      thumbnailReader.onload = () => {
        const newSession: DesignSession = {
          id: Date.now().toString(),
          name: `Design ${sessions.length + 1}`,
          timestamp: Date.now(),
          thumbnail: thumbnailReader.result as string,
          sceneImage: file,
          originalDimensions: dimensions,
          generations: []
        };
        
        setSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
        
        // Load this new session into the working state
        setSceneImage(file);
        setOriginalDimensions(dimensions);
        setHistory([]);
        setHistoryIndex(-1);
        setPrompt('');
        setSketchedImage(null);
        setProductImage(null);
        setBackgroundImage(null);
        setError(null);
      }
    } catch(err) {
      console.error("Could not create new session:", err);
      setError("Could not read image dimensions. Please try a different image.");
    }
  };

  const handleInstantStart = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch('https://storage.googleapis.com/aistudio-web-public-prod/prompts/v1/exterior.jpeg');
      if (!response.ok) {
        throw new Error('Failed to load default image');
      }
      const blob = await response.blob();
      const file = new File([blob], 'exterior.jpeg', { type: 'image/jpeg' });
      await handleSceneImageUpload(file);
      setPrompt('Add a modern stone pathway, plant vibrant flowerbeds along the front, and add a large oak tree on the right.');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Could not load default image. Details: ${errorMessage}`);
      console.error(err);
    }
  }, [sessions]);
  
  const addImageToHistory = (newImage: File) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newImage);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);

    if (activeSessionId) {
      setSessions(prevSessions => prevSessions.map(s => 
        s.id === activeSessionId ? { ...s, generations: newHistory } : s
      ));
    }
  };

  const handleGenerate = useCallback(async () => {
    const imageToProcess = currentWorkingImage;
    if (!imageToProcess || !prompt || !originalDimensions) {
      setError('Please upload an image of your property and provide a design prompt.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const { finalImageUrl, debugImageUrl, finalPrompt } = await redesignRoom(
        imageToProcess,
        originalDimensions.width,
        originalDimensions.height,
        prompt,
        productImage,
        backgroundImage,
        !!sketchedImage,
      );
      
      const newGeneratedFile = await (await fetch(finalImageUrl)).blob().then(blob => new File([blob], `generated-scene-${Date.now()}.jpeg`, {type: 'image/jpeg'}));
      
      addImageToHistory(newGeneratedFile);
      
      setSketchedImage(null);
      setProductImage(null);
      setBackgroundImage(null);
      setPrompt('');

      setDebugImageUrl(debugImageUrl);
      setDebugPrompt(finalPrompt);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to generate the image. ${errorMessage}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkingImage, prompt, productImage, backgroundImage, originalDimensions, history, historyIndex, activeSessionId]);

  const handleRotateView = useCallback(async (direction: 'left' | 'right') => {
    const imageToRotate = currentWorkingImage;
    if (!imageToRotate || !originalDimensions) {
      setError('An image must be present to create a rotated view.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
        const { finalImageUrl } = await generateRotatedView(
            imageToRotate,
            originalDimensions.width,
            originalDimensions.height,
            direction
        );
        const newRotatedFile = await (await fetch(finalImageUrl)).blob().then(blob => new File([blob], `rotated-scene-${Date.now()}.jpeg`, {type: 'image/jpeg'}));
        addImageToHistory(newRotatedFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to generate the rotated view. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentWorkingImage, originalDimensions, activeSessionId]);

  const handleRevertToOriginal = useCallback(() => {
    setHistory([]);
    setHistoryIndex(-1);
    setSketchedImage(null);
    if (activeSessionId) {
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId ? { ...s, generations: [] } : s
      ));
    }
  }, [activeSessionId]);

  const handleSaveSketch = useCallback(async (dataUrl: string) => {
    const file = await (await fetch(dataUrl)).blob().then(blob => new File([blob], `sketch-${Date.now()}.png`, {type: 'image/png'}));
    setSketchedImage(file);
    setIsDrawingModalOpen(false);
  }, []);

  const handleSaveCanvasEdit = async (newFile: File) => {
      try {
          const dimensions = await getImageDimensions(newFile);
          
          // When we edit the canvas, we essentially start a new branch or reset the base image
          // because coordinates for sketches or previous generations might be invalid.
          setSceneImage(newFile);
          setOriginalDimensions(dimensions);
          
          // Clear dependent states that might be misaligned
          setSketchedImage(null); 
          
          // We can choose to keep history or clear it. 
          // Clearing it avoids confusion with different aspect ratios in the undo stack.
          // A safer UX for now is to treat this as a new "Base".
          setHistory([]);
          setHistoryIndex(-1);
          
          if (activeSessionId) {
              setSessions(prev => prev.map(s => 
                  s.id === activeSessionId 
                  ? { ...s, sceneImage: newFile, originalDimensions: dimensions, generations: [] } 
                  : s
              ));
          }
      } catch (e) {
          console.error("Failed to update image dimensions", e);
          setError("Failed to process edited image.");
      }
  };
  
  const handleDownload = () => {
    if (!generatedImageUrl) return;
    const link = document.createElement('a');
    link.href = generatedImageUrl;
    link.download = `design-${Date.now()}.jpeg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleUndo = () => historyIndex >= 0 && setHistoryIndex(historyIndex - 1);
  const handleRedo = () => historyIndex < history.length - 1 && setHistoryIndex(historyIndex + 1);
  const handleRemoveSketch = () => setSketchedImage(null);
  const handleRemoveProduct = () => setProductImage(null);
  const handleRemoveBackground = () => setBackgroundImage(null);

  const handleAddCustomProduct = (file: File) => {
    setProductImage(file);
    setIsAddProductModalOpen(false);
  };

  const handleAddCustomBackground = (file: File) => {
    setBackgroundImage(file);
    setIsAddBackgroundModalOpen(false);
  };
  
  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      <div className="w-full max-w-8xl mx-auto flex flex-1 overflow-hidden px-4 sm:px-6 md:px-8">
        <HistorySidebar 
          isOpen={isSidebarOpen}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewProject}
          onDeleteSession={handleDeleteSession}
        />
        <main className={`flex-1 flex flex-col items-center p-0 sm:p-2 md:p-4 transition-all duration-300 ${isSidebarOpen ? 'md:ml-72' : 'ml-0'}`}>
          <div className="w-full max-w-4xl mx-auto flex flex-col gap-8">
            <div className={`relative p-4 sm:p-6 bg-white dark:bg-gray-800/50 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 transition-opacity duration-500 ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
              
              <div className="relative group">
                <ImageUploader
                  ref={sceneUploaderRef}
                  id="scene-uploader"
                  onFileSelect={handleSceneImageUpload}
                  imageUrl={displayImageUrl}
                  disabled={isLoading || !!activeSessionId}
                />
                
                {sceneImage && (
                  <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    {history.length > 0 && (
                        <>
                            <button onClick={handleUndo} disabled={!canUndo} className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white disabled:opacity-50 disabled:cursor-not-allowed"><UndoIcon /></button>
                            <button onClick={handleRedo} disabled={!canRedo} className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white disabled:opacity-50 disabled:cursor-not-allowed"><RedoIcon /></button>
                        </>
                    )}
                    <button onClick={() => handleRotateView('left')} disabled={isLoading} className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white disabled:opacity-50 disabled:cursor-not-allowed"><ArrowLeftIcon /></button>
                    <button onClick={() => handleRotateView('right')} disabled={isLoading} className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white disabled:opacity-50 disabled:cursor-not-allowed"><ArrowRightIcon /></button>
                    {(history.length > 0 || sketchedImage) && (
                        <button onClick={handleRevertToOriginal} className="p-2 bg-red-600/80 hover:bg-red-600 rounded-full text-white"><TrashIcon /></button>
                    )}
                  </div>
                )}
                
                {sketchedImage && (
                  <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-2 shadow-lg">
                    <span>Sketch Applied</span>
                    <button onClick={handleRemoveSketch} className="font-bold text-lg leading-none hover:text-blue-200 transition">&times;</button>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 flex flex-col gap-2">
                  {productImage && (
                    <div className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-2 shadow-lg">
                      <span>Product Added</span>
                      <button onClick={handleRemoveProduct} className="font-bold text-lg leading-none hover:text-green-200 transition">&times;</button>
                    </div>
                  )}
                  {backgroundImage && (
                    <div className="bg-purple-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-2 shadow-lg">
                      <span>Background Added</span>
                      <button onClick={handleRemoveBackground} className="font-bold text-lg leading-none hover:text-purple-200 transition">&times;</button>
                    </div>
                  )}
                </div>
              </div>

              {!sceneImage && !isLoading && (
                <div className="mt-4 text-center">
                  <p className="text-gray-500 dark:text-gray-400">Or, try an example:</p>
                  <button onClick={handleInstantStart} className="mt-2 font-bold text-gray-800 dark:text-gray-200 hover:underline">
                    Start with a sample project
                  </button>
                </div>
              )}
              
              {sceneImage && (
                <div className="mt-6 flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row items-center gap-4">
                    <input
                      type="text"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Describe your vision, e.g., 'Add a pool and a modern deck'"
                      className="flex-grow w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300 focus:outline-none transition"
                      disabled={isLoading}
                    />
                    <button
                      onClick={handleGenerate}
                      disabled={isLoading || !prompt}
                      className="w-full md:w-auto px-6 py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-bold rounded-lg hover:bg-gray-700 dark:hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-shrink-0"
                    >
                      Generate
                    </button>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
                    <button onClick={() => setIsDrawingModalOpen(true)} className="w-full sm:w-auto px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                      Sketch on Image
                    </button>
                    <button onClick={() => setIsEditCanvasModalOpen(true)} className="w-full sm:w-auto px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition flex items-center justify-center gap-2">
                      <ScissorsIcon />
                      Trim / Expand
                    </button>
                    <button onClick={() => setIsAddProductModalOpen(true)} className="w-full sm:w-auto px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                      Add Product
                    </button>
                    <button onClick={() => setIsAddBackgroundModalOpen(true)} className="w-full sm:w-auto px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                      Upload Background
                    </button>
                    {generatedImageUrl && (
                      <button onClick={handleDownload} className="w-full sm:w-auto px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                        Download Design
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {isLoading && (
              <div className="fixed inset-0 bg-white/80 dark:bg-gray-900/80 z-40 flex flex-col items-center justify-center backdrop-blur-sm">
                <Spinner />
                <p className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-300 animate-pulse">{loadingMessages[loadingMessageIndex]}</p>
              </div>
            )}
            
            {error && (
              <div className="w-full p-4 bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-700 text-red-800 dark:text-red-200 rounded-lg animate-fade-in" role="alert">
                <strong>Error:</strong> {error}
              </div>
            )}
          
            <footer className="w-full max-w-4xl mx-auto flex justify-between items-center pb-8">
              <button onClick={handleNewProject} className="text-sm text-gray-500 dark:text-gray-400 hover:underline">Start New Project</button>
              {debugImageUrl && (
                <button onClick={() => setIsDebugModalOpen(true)} className="text-sm text-gray-500 dark:text-gray-400 hover:underline">Show Debug View</button>
              )}
            </footer>

          </div>
        </main>
      </div>

      <DebugModal isOpen={isDebugModalOpen} onClose={() => setIsDebugModalOpen(false)} imageUrl={debugImageUrl} prompt={debugPrompt} />
      <EditCanvasModal isOpen={isEditCanvasModalOpen} onClose={() => setIsEditCanvasModalOpen(false)} onSave={handleSaveCanvasEdit} imageFile={currentWorkingImage} />
      {displayImageUrl && (
        <DrawingModal isOpen={isDrawingModalOpen} onClose={() => setIsDrawingModalOpen(false)} onSave={handleSaveSketch} backgroundImageUrl={displayImageUrl} />
      )}
      <AddProductModal isOpen={isAddProductModalOpen} onClose={() => setIsAddProductModalOpen(false)} onFileSelect={handleAddCustomProduct} />
      <AddBackgroundModal isOpen={isAddBackgroundModalOpen} onClose={() => setIsAddBackgroundModalOpen(false)} onFileSelect={handleAddCustomBackground} />
    </div>
  );
};

export default App;
