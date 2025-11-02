
import React, { useState, useCallback, useRef } from 'react';
import { Chat } from '@google/genai';
import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { StyleSelector } from './components/StyleSelector';
import { ImageComparator } from './components/ImageComparator';
import { ChatInterface } from './components/ChatInterface';
import { Spinner } from './components/Spinner';
import { generateRedesignedImage, initializeChat } from './services/geminiService';
import { ChatMessage } from './types';
import { DESIGN_STYLES } from './constants';

export default function App() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<Record<string, string>>({});
  const [currentStyle, setCurrentStyle] = useState<string>(DESIGN_STYLES[0]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

  const chatRef = useRef<Chat | null>(null);

  const handleImageUpload = useCallback(async (file: File) => {
    try {
      setError(null);
      setIsLoading(true);
      setLoadingMessage('Converting image...');
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Image = reader.result as string;
        setOriginalImage(base64Image);
        setLoadingMessage(`Generating ${DESIGN_STYLES[0]} design...`);
        
        const firstStyleImage = await generateRedesignedImage(base64Image, DESIGN_STYLES[0]);
        const newGeneratedImages = { [DESIGN_STYLES[0]]: firstStyleImage };
        setGeneratedImages(newGeneratedImages);
        setCurrentStyle(DESIGN_STYLES[0]);
        setChatHistory([]);
        chatRef.current = initializeChat(DESIGN_STYLES[0]);

        setIsLoading(false);

        // Pre-generate other styles in the background
        for (let i = 1; i < DESIGN_STYLES.length; i++) {
          const style = DESIGN_STYLES[i];
          const image = await generateRedesignedImage(base64Image, style);
          setGeneratedImages(prev => ({ ...prev, [style]: image }));
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setError('Failed to generate image. Please try again.');
      setIsLoading(false);
    }
  }, []);

  const handleStyleChange = useCallback(async (style: string) => {
    setCurrentStyle(style);
    chatRef.current = initializeChat(style);
    setChatHistory([]); // Reset chat when style changes

    if (!generatedImages[style] && originalImage) {
      setIsGenerating(true);
      try {
        const newImage = await generateRedesignedImage(originalImage, style);
        setGeneratedImages(prev => ({ ...prev, [style]: newImage }));
      } catch (err) {
        console.error(err);
        setError(`Failed to generate ${style} design.`);
      } finally {
        setIsGenerating(false);
      }
    }
  }, [originalImage, generatedImages]);

  const handleSendMessage = useCallback(async (message: string) => {
    if (!chatRef.current) return;

    const userMessage: ChatMessage = { sender: 'user', text: message };
    setChatHistory(prev => [...prev, userMessage]);
    setIsChatLoading(true);

    try {
      const response = await chatRef.current.sendMessage(message);
      const botResponseText = response.text;
      
      let parsedResponse;
      try {
        // Check if the response is a JSON for image editing
        parsedResponse = JSON.parse(botResponseText);
      } catch (e) {
        // Not a JSON, so it's a regular chat message
        parsedResponse = null;
      }

      if (parsedResponse && parsedResponse.action === 'edit_image') {
        const currentImage = generatedImages[currentStyle];
        if (currentImage) {
          setIsGenerating(true);
          const editPrompt = parsedResponse.prompt;
          const editedImage = await generateRedesignedImage(currentImage, editPrompt, true);
          setGeneratedImages(prev => ({ ...prev, [currentStyle]: editedImage }));
          
          const botConfirmation: ChatMessage = { sender: 'bot', text: "Here is the updated design based on your request." };
          setChatHistory(prev => [...prev, botConfirmation]);
          setIsGenerating(false);
        }
      } else {
        const botMessage: ChatMessage = { sender: 'bot', text: botResponseText };
        setChatHistory(prev => [...prev, botMessage]);
      }

    } catch (err) {
      console.error(err);
      const errorMessage: ChatMessage = { sender: 'bot', text: "Sorry, I encountered an error. Please try again." };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  }, [currentStyle, generatedImages]);


  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8 flex flex-col items-center">
        {isLoading && (
          <div className="flex flex-col items-center justify-center text-center h-full">
            <Spinner />
            <p className="mt-4 text-lg text-gray-300">{loadingMessage}</p>
          </div>
        )}

        {!originalImage && !isLoading && (
          <ImageUploader onImageUpload={handleImageUpload} />
        )}
        
        {originalImage && !isLoading && (
          <div className="w-full max-w-5xl flex flex-col gap-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 flex flex-col gap-4">
                <h2 className="text-2xl font-bold text-center md:text-left text-indigo-400">Compare & Refine</h2>
                <div className="relative w-full aspect-video rounded-lg shadow-2xl bg-gray-800 overflow-hidden">
                    {isGenerating && (
                        <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center z-20">
                            <Spinner />
                            <p className="mt-2 text-white">Updating your design...</p>
                        </div>
                    )}
                    {generatedImages[currentStyle] && (
                        <ImageComparator
                            original={originalImage}
                            redesigned={generatedImages[currentStyle]}
                        />
                    )}
                </div>
              </div>

              <div className="md:col-span-1 flex flex-col gap-4">
                <StyleSelector
                    styles={DESIGN_STYLES}
                    selectedStyle={currentStyle}
                    onStyleChange={handleStyleChange}
                    generatedStatus={Object.keys(generatedImages)}
                />
              </div>
            </div>

            <ChatInterface
              chatHistory={chatHistory}
              onSendMessage={handleSendMessage}
              isLoading={isChatLoading}
            />
          </div>
        )}
        {error && <p className="text-red-500 mt-4">{error}</p>}
      </main>
    </div>
  );
}
