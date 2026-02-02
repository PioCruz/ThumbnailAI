import React, { useState, useRef, useEffect } from 'react';
import { Message, Role, Project, HistoryItem, Folder } from './types';
import { processThumbnailRequest } from './services/geminiService';
import { SendIcon, UploadIcon, DownloadIcon, SparklesIcon, LoadingIcon, UndoIcon, RedoIcon, PlusIcon, RegionIcon } from './components/Icons';

const LOCAL_STORAGE_KEY = 'thumbcraft_projects_v1';
const FOLDERS_STORAGE_KEY = 'thumbcraft_folders_v1';

const SUGGESTIONS = [
  "Remove Background",
  "Put in Space",
  "Brighten & Sharpen",
  "Cyberpunk Style",
  "Add Motion Blur",
  "Make it Cinematic",
  "Add Red Glow",
  "Anime Style"
];

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  
  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyPointer, setHistoryPointer] = useState(-1);
  
  // Projects & Folders State
  const [projects, setProjects] = useState<Project[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | 'all'>('all');
  
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  
  const [modal, setModal] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentItem = historyPointer >= 0 ? history[historyPointer] : null;
  const activeProject = projects.find(p => p.id === activeProjectId);

  // Load projects & folders
  useEffect(() => {
    const savedProjects = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedProjects) {
      try {
        setProjects(JSON.parse(savedProjects));
      } catch (e) {
        console.error("Failed to load projects", e);
      }
    }
    const savedFolders = localStorage.getItem(FOLDERS_STORAGE_KEY);
    if (savedFolders) {
      try {
        setFolders(JSON.parse(savedFolders));
      } catch (e) {
        console.error("Failed to load folders", e);
      }
    }
  }, []);

  // Save projects & folders
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(projects));
      localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders));
      setError(null);
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        setError("Storage Full! Delete old projects.");
      }
    }
  }, [projects, folders]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addMessage = (role: Role, content: string, imageUrl?: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      role,
      content,
      imageUrl,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const pushToHistory = (imageUrl: string, prompt: string) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      imageUrl,
      prompt,
      timestamp: Date.now()
    };

    setHistory(prev => {
      const newHistory = prev.slice(0, historyPointer + 1);
      newHistory.push(newItem);
      return newHistory.slice(-30);
    });
    setHistoryPointer(prev => {
      const nextPointer = prev + 1;
      return nextPointer >= 30 ? 29 : nextPointer;
    });

    if (activeProjectId) {
      setProjects(prev => prev.map(p => 
        p.id === activeProjectId ? { ...p, imageUrl: imageUrl, timestamp: Date.now() } : p
      ));
    }
  };

  const performNewProjectReset = () => {
    setHistory([]);
    setHistoryPointer(-1);
    setMessages([]);
    setError(null);
    setInput('');
    setActiveProjectId(null);
    setEditingProjectId(null);
    setModal(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNewProject = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (currentItem) {
      setModal({
        title: "Start New Session?",
        message: "This will clear everything and reset your environment. Current unsaved work will be lost.",
        confirmLabel: "Reset Session",
        onConfirm: performNewProjectReset
      });
    } else {
      performNewProjectReset();
    }
  };

  const handleClearCanvas = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setModal({
      title: "Clear Current Image?",
      message: "This will remove the current working image and its history from the editor. Chat history will be kept.",
      confirmLabel: "Clear Canvas",
      onConfirm: () => {
        setHistory([]);
        setHistoryPointer(-1);
        setModal(null);
      }
    });
  };

  const handleSaveToProjects = () => {
    if (!currentItem) return;
    if (activeProjectId) {
      setProjects(prev => prev.map(p => 
        p.id === activeProjectId ? { ...p, imageUrl: currentItem.imageUrl, timestamp: Date.now() } : p
      ));
      addMessage('assistant', `Project updated in gallery.`);
    } else {
      const newProject: Project = {
        id: Date.now().toString(),
        name: `Thumbnail ${projects.length + 1}`,
        imageUrl: currentItem.imageUrl,
        timestamp: Date.now(),
        folderId: activeFolderId === 'all' ? null : activeFolderId
      };
      setProjects(prev => [newProject, ...prev]);
      setActiveProjectId(newProject.id);
      addMessage('assistant', `Saved to gallery as "${newProject.name}"`);
    }
  };

  const handleDeleteProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    setModal({
      title: "Delete Thumbnail?",
      message: "This will permanently remove this project. This cannot be undone.",
      confirmLabel: "Delete Forever",
      onConfirm: () => {
        setProjects(prev => prev.filter(p => p.id !== id));
        if (activeProjectId === id) {
          setActiveProjectId(null);
          setHistory([]);
          setHistoryPointer(-1);
          setMessages([]);
        }
        setModal(null);
      }
    });
  };

  const handleLoadProject = (project: Project) => {
    const load = () => {
      const initialItem: HistoryItem = {
        id: 'initial-' + project.id,
        imageUrl: project.imageUrl,
        prompt: 'Restored Version',
        timestamp: project.timestamp
      };
      setHistory([initialItem]);
      setHistoryPointer(0);
      setMessages([]);
      setActiveProjectId(project.id);
      addMessage('assistant', `Loaded project: ${project.name}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setModal(null);
    };

    if (currentItem && activeProjectId !== project.id) {
      setModal({
        title: "Switch Project?",
        message: "Your current session edits will be replaced. Continue?",
        confirmLabel: "Load Project",
        onConfirm: load
      });
    } else {
      load();
    }
  };

  const handleSend = async (text?: string) => {
    const prompt = text || input.trim();
    if (!prompt || !currentItem) return;

    setError(null);
    setInput('');
    addMessage('user', prompt);
    setIsGenerating(true);

    try {
      const generatedImageUrl = await processThumbnailRequest(prompt, currentItem.imageUrl);
      pushToHistory(generatedImageUrl, prompt);
      addMessage('assistant', `Applied: "${prompt}"`, generatedImageUrl);
    } catch (err: any) {
      console.error(err);
      setError("AI Service Error. Try again.");
      addMessage('assistant', "Snag encountered. Try a simpler edit.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        pushToHistory(result, 'Original Image Upload');
        addMessage('user', 'Uploaded base image.', result);
        addMessage('assistant', 'Received! What should I change?');
      };
      reader.readAsDataURL(file);
    } else {
      setError("Please upload an image.");
    }
  };

  const createFolder = () => {
    const newFolder: Folder = {
      id: Date.now().toString(),
      name: 'New Folder'
    };
    setFolders([...folders, newFolder]);
    setActiveFolderId(newFolder.id);
  };

  const deleteFolder = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setModal({
      title: "Delete Folder?",
      message: "This will remove the folder. Projects inside will be kept but moved to 'Home'.",
      confirmLabel: "Delete Folder",
      onConfirm: () => {
        setFolders(prev => prev.filter(f => f.id !== id));
        setProjects(prev => prev.map(p => p.folderId === id ? { ...p, folderId: null } : p));
        if (activeFolderId === id) setActiveFolderId('all');
        setModal(null);
      }
    });
  };

  const moveProjectToFolder = (projectId: string, folderId: string | null) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, folderId } : p));
  };

  const filteredProjects = activeFolderId === 'all' 
    ? projects 
    : projects.filter(p => p.folderId === activeFolderId);

  const handleRegionEdit = () => {
    addMessage('assistant', "Region Selection mode coming soon! For now, please use text prompts like 'Change the color of the background' or 'Modify the object in the center'.");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {modal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-red-600/10 rounded-3xl flex items-center justify-center mb-8">
              <SparklesIcon className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-black text-white mb-3 tracking-tighter">{modal.title}</h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-10 font-medium">{modal.message}</p>
            <div className="flex gap-4">
              <button onClick={() => setModal(null)} className="flex-1 px-6 py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-300 transition-all active:scale-95">Cancel</button>
              <button onClick={modal.onConfirm} className="flex-1 px-6 py-4 bg-red-600 hover:bg-red-700 rounded-2xl text-xs font-black uppercase tracking-widest text-white transition-all shadow-xl shadow-red-900/40 active:scale-95">{modal.confirmLabel || 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto flex flex-col min-h-screen border-x border-slate-900 shadow-2xl overflow-hidden bg-slate-950/50">
        <header className="sticky top-0 z-40 shrink-0 flex items-center justify-between px-6 py-4 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-600 rounded-lg shadow-lg shadow-red-900/20">
              <SparklesIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tighter bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent leading-none uppercase">ThumbCraft AI</h1>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">Professional Editor</p>
            </div>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 overflow-y-auto">
          {/* Main Grid: Editor Area */}
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 min-h-[600px] lg:h-[750px] shrink-0 overflow-hidden">
            
            {/* Edit Timeline Sidebar */}
            <aside className="lg:col-span-2 hidden xl:flex flex-col bg-slate-900/40 rounded-[2rem] border border-slate-800/50 p-4 h-full overflow-hidden">
              <div className="flex items-center justify-between mb-4 px-2 shrink-0">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">History</h3>
                 <span className="text-[10px] font-bold text-slate-700">{history.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 opacity-20">
                     <UndoIcon className="w-6 h-6 mb-2" />
                     <p className="text-[8px] font-bold uppercase">Ready</p>
                  </div>
                ) : (
                  [...history].reverse().map((item, idx) => {
                    const originalIdx = history.length - 1 - idx;
                    return (
                      <button 
                        key={item.id}
                        onClick={() => setHistoryPointer(originalIdx)}
                        className={`w-full group text-left rounded-2xl border transition-all overflow-hidden ${historyPointer === originalIdx ? 'border-red-600 ring-1 ring-red-600 bg-red-600/5' : 'border-slate-800 hover:border-slate-600 bg-slate-900'}`}
                      >
                        <div className="aspect-video w-full bg-black overflow-hidden relative">
                           <img src={item.imageUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt={`Step ${originalIdx}`} />
                        </div>
                        <div className="p-2.5">
                          <p className={`text-[10px] line-clamp-2 leading-tight font-black uppercase tracking-tighter ${historyPointer === originalIdx ? 'text-red-500' : 'text-slate-400'}`}>
                            {originalIdx === 0 ? 'ORIGINAL' : item.prompt}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            {/* Editor Area */}
            <section 
              className={`lg:col-span-8 xl:col-span-7 flex flex-col bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden transition-all duration-300 h-full ${isDraggingFile ? 'ring-2 ring-red-500 bg-slate-800/50' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
              onDragLeave={() => setIsDraggingFile(false)}
              onDrop={(e) => { e.preventDefault(); setIsDraggingFile(false); const file = e.dataTransfer.files?.[0]; if (file) processFile(file); }}
            >
              {/* STATUS BAR: AT THE TOP OF THE CARD */}
              <div className="px-8 py-4 bg-slate-950/40 border-b border-slate-800/50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[200px]">{activeProject ? activeProject.name : "New Session"}</span>
                </div>
                {currentItem && (
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Version: {historyPointer + 1}</span>
                  </div>
                )}
              </div>

              <div className="flex-1 flex flex-col items-center justify-center relative p-6 overflow-hidden">
                {currentItem ? (
                  <div className="w-full h-full relative group flex items-center justify-center overflow-hidden">
                    <img src={currentItem.imageUrl} alt="Preview" className="max-w-full max-h-full object-contain rounded-2xl drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 text-center" onClick={() => fileInputRef.current?.click()}>
                    <div className="w-28 h-28 bg-slate-800 rounded-[3rem] flex items-center justify-center mb-10 border border-slate-700 shadow-2xl cursor-pointer hover:scale-105 active:scale-95 transition-all">
                      <UploadIcon className={`w-12 h-12 ${isDraggingFile ? 'text-red-500 animate-bounce' : 'text-slate-500'}`} />
                    </div>
                    <h2 className="text-3xl font-black text-white mb-4 tracking-tighter uppercase">Drop Base Image</h2>
                    <p className="max-w-[320px] text-slate-500 text-sm font-bold leading-relaxed mb-10 uppercase tracking-tight">High-impact 16:9 thumbnails start here.</p>
                    <button className="px-10 py-5 bg-red-600 hover:bg-red-700 rounded-[1.5rem] text-xs font-black uppercase tracking-[0.2em] transition-all shadow-2xl shadow-red-900/40">Browse Files</button>
                  </div>
                )}
                {isGenerating && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center z-30 rounded-[2.5rem]">
                    <LoadingIcon className="w-16 h-16 text-red-600 mb-8" />
                    <p className="text-sm font-black animate-pulse text-white tracking-[0.4em] uppercase text-center px-6">Applying Precision Edits...</p>
                  </div>
                )}
              </div>

              {/* Toolbar: Undo, Region, Redo | Save, Export, Delete */}
              {currentItem && (
                <div className="px-8 pb-6 flex items-center justify-center shrink-0">
                  <div className="flex items-center bg-slate-950/90 backdrop-blur-xl rounded-2xl p-1.5 border border-slate-700/50 shadow-2xl gap-2">
                    <div className="flex items-center bg-slate-900/50 rounded-xl p-0.5">
                      <button 
                        onClick={() => setHistoryPointer(p => Math.max(0, p-1))} 
                        disabled={historyPointer <= 0 || isGenerating} 
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all hover:bg-slate-800 disabled:opacity-20 text-slate-300"
                        title="Undo"
                      >
                        <UndoIcon className="w-4 h-4" />
                      </button>
                      
                      <div className="w-[1px] h-4 bg-slate-700 mx-1"></div>
                      
                      <button 
                        onClick={handleRegionEdit}
                        disabled={isGenerating}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all hover:bg-red-600/20 text-red-500"
                        title="Region Edit"
                      >
                        <RegionIcon className="w-4 h-4" />
                      </button>
                      
                      <div className="w-[1px] h-4 bg-slate-700 mx-1"></div>
                      
                      <button 
                        onClick={() => setHistoryPointer(p => Math.min(history.length-1, p+1))} 
                        disabled={historyPointer >= history.length - 1 || isGenerating} 
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all hover:bg-slate-800 disabled:opacity-20 text-slate-300"
                        title="Redo"
                      >
                        <RedoIcon className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="w-[1px] h-6 bg-slate-700/50 mx-1"></div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={handleSaveToProjects} 
                        disabled={isGenerating}
                        className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-900/20 text-white disabled:opacity-50"
                      >
                        <SparklesIcon className="w-4 h-4" /> {activeProjectId ? 'Sync' : 'Save'}
                      </button>
                      <button 
                        onClick={() => { const link = document.createElement('a'); link.href = currentItem.imageUrl; link.download = `thumbcraft-${Date.now()}.png`; link.click(); }} 
                        disabled={isGenerating}
                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-700 text-slate-300 disabled:opacity-50"
                      >
                        <DownloadIcon className="w-4 h-4" /> Export
                      </button>

                      {/* DISTINCT DELETE BUTTON (Clear Canvas Only) */}
                      <button 
                        onClick={handleClearCanvas} 
                        disabled={isGenerating}
                        className="flex items-center justify-center p-2.5 bg-slate-900 hover:bg-red-600/20 border border-slate-700 rounded-xl text-slate-500 hover:text-red-500 transition-all active:scale-90 disabled:opacity-50"
                        title="Delete Active Image (Clear Canvas)"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Chat Area */}
            <section className="lg:col-span-4 xl:col-span-3 flex flex-col bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden h-full">
              <div className="px-8 py-5 bg-slate-800/30 border-b border-slate-800 flex items-center justify-between shrink-0">
                 <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Editor Intel</h3>
                 <SparklesIcon className="w-4 h-4 text-slate-600" />
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-900/20 custom-scrollbar">
                {messages.length === 0 && !currentItem && (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                    <SendIcon className="w-10 h-10 text-slate-700 mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest leading-loose">Upload image to<br/>unlock AI instructions</p>
                  </div>
                )}
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[95%] p-4 rounded-2xl text-[13px] font-bold leading-relaxed shadow-lg ${msg.role === 'user' ? 'bg-red-600 text-white rounded-tr-none' : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-none'}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className={`p-6 bg-slate-900 border-t border-slate-800 shrink-0 ${!currentItem ? 'opacity-20 grayscale pointer-events-none' : 'opacity-100'}`}>
                {currentItem && !isGenerating && (
                  <div className="flex flex-wrap gap-2 mb-4 overflow-x-auto scrollbar-none pb-1">
                    {SUGGESTIONS.map(s => (
                      <button 
                        key={s} 
                        onClick={() => handleSend(s)}
                        className="flex-shrink-0 text-[9px] font-black uppercase tracking-wider px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full text-slate-400 hover:text-white transition-all active:scale-95"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {error && <div className="mb-4 text-[10px] text-red-500 font-black uppercase tracking-tighter bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">{error}</div>}
                <div className="relative flex items-center gap-3">
                  <input 
                    type="text" 
                    value={input} 
                    onChange={(e) => setInput(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
                    placeholder="E.g. Remove background" 
                    className="flex-1 bg-slate-800 border border-slate-700 text-slate-100 px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all placeholder:text-slate-600 text-sm font-medium shadow-inner" 
                    disabled={isGenerating || !currentItem} 
                  />
                  <button onClick={() => handleSend()} disabled={isGenerating || !input.trim() || !currentItem} className="p-5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-2xl transition-all shadow-2xl shadow-red-900/30 active:scale-90 shrink-0">
                    {isGenerating ? <LoadingIcon className="w-5 h-5" /> : <SendIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </section>
          </div>

          {/* Vault Section */}
          <section className="flex flex-col gap-8 pt-10 border-t border-slate-900 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 px-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.8)]"></div>
                  <h3 className="text-sm font-black uppercase tracking-[0.4em] text-slate-400">Vault</h3>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 px-6 py-2 rounded-full text-[10px] font-black text-slate-500 tracking-[0.3em]">
                {filteredProjects.length} PROJECTS FOUND
              </div>
            </div>

            {/* Folder Tabs System */}
            <div className="flex items-center gap-4 px-4 overflow-x-auto scrollbar-none pb-2">
              <button 
                onClick={() => setActiveFolderId('all')}
                onDragOver={(e) => { e.preventDefault(); setDragOverFolderId('all'); }}
                onDragLeave={() => setDragOverFolderId(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverFolderId(null);
                  const pid = e.dataTransfer.getData('projectId');
                  if (pid) moveProjectToFolder(pid, null);
                }}
                className={`flex-shrink-0 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeFolderId === 'all' ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' : 'bg-slate-900/50 border border-slate-800 text-slate-500 hover:text-slate-300'} ${dragOverFolderId === 'all' ? 'ring-2 ring-white scale-105' : ''}`}
              >
                Home
              </button>
              
              {folders.map(folder => (
                <div key={folder.id} className="relative group flex-shrink-0">
                  <button 
                    onClick={() => setActiveFolderId(folder.id)}
                    onDoubleClick={() => setEditingFolderId(folder.id)}
                    onDragOver={(e) => { e.preventDefault(); setDragOverFolderId(folder.id); }}
                    onDragLeave={() => setDragOverFolderId(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverFolderId(null);
                      const pid = e.dataTransfer.getData('projectId');
                      if (pid) moveProjectToFolder(pid, folder.id);
                    }}
                    className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all pr-12 ${activeFolderId === folder.id ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' : 'bg-slate-900/50 border border-slate-800 text-slate-500 hover:text-slate-300'} ${dragOverFolderId === folder.id ? 'ring-2 ring-white scale-105' : ''}`}
                  >
                    {editingFolderId === folder.id ? (
                      <input 
                        autoFocus
                        value={folder.name}
                        onChange={(e) => setFolders(prev => prev.map(f => f.id === folder.id ? { ...f, name: e.target.value } : f))}
                        onBlur={() => setEditingFolderId(null)}
                        onKeyDown={(e) => e.key === 'Enter' && setEditingFolderId(null)}
                        className="bg-transparent border-none outline-none text-white w-24"
                      />
                    ) : (
                      folder.name
                    )}
                  </button>
                  <button 
                    onClick={(e) => deleteFolder(e, folder.id)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-black/20 rounded-lg text-white/40 hover:text-white transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              
              <button 
                onClick={createFolder}
                className="flex-shrink-0 p-3 bg-slate-900 border border-slate-800 border-dashed rounded-2xl text-slate-500 hover:text-red-500 hover:border-red-500/50 transition-all active:scale-95"
                title="Create Folder"
              >
                <PlusIcon className="w-5 h-5" />
              </button>
            </div>

            {filteredProjects.length === 0 ? (
              <div 
                onClick={handleNewProject}
                className="group flex flex-col items-center justify-center p-24 bg-slate-900/30 rounded-[4rem] border-2 border-slate-800 border-dashed text-slate-600 hover:border-red-600/50 hover:bg-red-600/5 transition-all cursor-pointer"
              >
                <div className="w-20 h-20 bg-slate-800/40 rounded-[2rem] flex items-center justify-center mb-8 border border-slate-800 group-hover:scale-110 group-hover:bg-red-600/10 group-hover:border-red-600/30 transition-all">
                  <PlusIcon className="w-10 h-10 text-slate-500 group-hover:text-red-600" />
                </div>
                <h4 className="text-sm font-black text-slate-300 uppercase tracking-widest mb-2 group-hover:text-white">Start New Project</h4>
                <p className="font-black uppercase tracking-[0.2em] text-[10px] text-center max-w-xs leading-loose opacity-50">This Vault Segment is currently empty</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10 pb-20">
                {filteredProjects.map(project => (
                  <div 
                    key={project.id} 
                    onClick={() => handleLoadProject(project)} 
                    draggable 
                    onDragStart={(e) => e.dataTransfer.setData('projectId', project.id)}
                    className={`group relative bg-slate-900 rounded-[2.5rem] border overflow-hidden cursor-pointer transition-all hover:scale-[1.04] hover:-translate-y-2 shadow-2xl active:scale-95 active:rotate-1 ${activeProjectId === project.id ? 'border-red-600 ring-2 ring-red-600/20 shadow-[0_20px_50px_rgba(220,38,38,0.2)]' : 'border-slate-800 hover:border-red-500/40'}`}
                  >
                    <div className="aspect-video relative overflow-hidden bg-black">
                      <img src={project.imageUrl} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" alt={project.name} />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80"></div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-red-600/20 backdrop-blur-[2px]">
                         <div className="bg-white p-4 rounded-full shadow-2xl transform scale-75 group-hover:scale-100 transition-transform">
                            <SparklesIcon className="w-6 h-6 text-red-600" />
                         </div>
                      </div>
                      {activeProjectId === project.id && <div className="absolute top-4 left-6 bg-red-600 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-2xl z-10">Active</div>}
                      <button 
                        onClick={(e) => handleDeleteProject(e, project.id)}
                        className="absolute top-4 right-6 p-3 bg-slate-950/80 hover:bg-red-600 border border-slate-800 hover:border-red-500 rounded-2xl text-slate-400 hover:text-white transition-all shadow-2xl z-20 active:scale-75"
                        title="Delete Project"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                    <div className="p-7 bg-slate-900">
                      <div className="flex items-center justify-between gap-4 mb-3">
                        {editingProjectId === project.id ? (
                          <input autoFocus type="text" value={project.name} onClick={(e) => e.stopPropagation()} onBlur={() => setEditingProjectId(null)} onKeyDown={(e) => e.key === 'Enter' && setEditingProjectId(null)} onChange={(e) => setProjects(prev => prev.map(p => p.id === project.id ? { ...p, name: e.target.value } : p))} className="bg-slate-800 border-2 border-red-500 rounded-xl px-4 py-2 text-xs font-black text-white w-full focus:outline-none shadow-inner" />
                        ) : (
                          <span className="text-sm font-black text-slate-100 truncate hover:text-red-500 transition-colors uppercase tracking-tighter" onClick={(e) => { e.stopPropagation(); setEditingProjectId(project.id); }}>{project.name}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{new Date(project.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        <div className="w-1.5 h-1.5 bg-slate-800 rounded-full"></div>
                        <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest">{new Date(project.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Always show New Session as the last card if projects exist */}
                <div 
                  onClick={handleNewProject}
                  className="group relative aspect-video bg-slate-900/50 rounded-[2.5rem] border-2 border-slate-800 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all hover:border-red-600/50 hover:bg-red-600/5 hover:-translate-y-2"
                >
                   <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center group-hover:bg-red-600 transition-all group-hover:shadow-lg group-hover:shadow-red-900/20">
                      <PlusIcon className="w-6 h-6 text-slate-400 group-hover:text-white" />
                   </div>
                   <span className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 group-hover:text-red-500">New Session</span>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
};

export default App;