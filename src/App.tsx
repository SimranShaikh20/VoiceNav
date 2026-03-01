/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, 
  Settings, 
  Key, 
  Shield, 
  Eye, 
  Volume2, 
  Monitor, 
  Search, 
  CheckCircle2, 
  Clock, 
  Layers, 
  Zap, 
  ChevronRight, 
  X,
  ExternalLink,
  Info,
  ArrowRight,
  MousePointer2,
  Type as TypeIcon,
  RefreshCw,
  Loader2,
  MessageSquare,
  Smartphone,
  Server,
  Database,
  VolumeX,
  Play,
  Globe,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

type AgentStatus = 'IDLE' | 'LISTENING' | 'THINKING' | 'EXECUTING' | 'DONE';

interface ActionLogItem {
  id: string;
  type: string;
  detail: string;
  status: 'done' | 'active' | 'pending';
}

interface GeminiResult {
  title: string;
  description: string;
  price?: string;
  rating?: string;
  url: string;
  urlLabel: string;
  badge?: string;
}

interface GeminiResponse {
  agentThought: string;
  steps: { type: string; detail: string }[];
  spokenResponse: string;
  resultType: 'products' | 'flights' | 'hotels' | 'jobs' | 'links' | 'info' | 'form' | 'general';
  results: GeminiResult[];
  simulatedUrl: string;
  taskSummary: string;
}

// --- Constants ---

const SYSTEM_PROMPT = `
You are VoiceNav, an intelligent web automation agent.
The user gives you a task or question. You must respond 
ONLY with a valid JSON object in this exact format:

{
  "agentThought": "Brief explanation of what you are doing",
  "steps": [
    { "type": "SCREENSHOT", "detail": "..." },
    { "type": "CLICK", "detail": "CLICK(x,y) — element name" },
    { "type": "TYPE", "detail": "TYPE(text)" },
    { "type": "SCROLL", "detail": "SCROLL(down, 3)" },
    { "type": "OBSERVE", "detail": "..." },
    { "type": "FILTER", "detail": "..." },
    { "type": "SORT", "detail": "..." },
    { "type": "DONE", "detail": "task complete" }
  ],
  "spokenResponse": "Natural language response spoken to user",
  "resultType": "products OR flights OR info OR links OR form OR general",
  "results": [
    {
      "title": "Product/Result name",
      "description": "Short description",
      "price": "$XX (only for products)",
      "rating": "4.7★ (only for products)",
      "url": "https://real-working-url.com",
      "urlLabel": "View on Amazon / Book Now / Open Link",
      "badge": "Best Rated / Cheapest / Top Pick (optional)"
    }
  ],
  "simulatedUrl": "The URL the agent would navigate to e.g. amazon.com/s?k=...",
  "taskSummary": "One line summary of what was accomplished"
}

IMPORTANT RULES:
- Always include 3 to 5 real, working URLs in results
- For product searches: use real Amazon, Flipkart, or relevant store URLs
- For flight searches: use real Google Flights or MakeMyTrip URLs  
- For hotel searches: use real Booking.com or Airbnb URLs
- For job searches: use real LinkedIn or Indeed URLs
- For general info: use real Wikipedia, official, or news URLs
- For form filling: describe what fields would be filled
- Make steps realistic and specific to the actual task
- spokenResponse should sound natural and helpful
- Always generate steps that match the actual task
- URLs must be real clickable links, not made up
`;

const LANGUAGES = [
  { code: 'en-US', label: '🇺🇸 English (en-US)' },
  { code: 'hi-IN', label: '🇮🇳 Hindi (hi-IN)' },
  { code: 'en-IN', label: '🇮🇳 English India (en-IN)' },
  { code: 'es-ES', label: '🇪🇸 Spanish (es-ES)' },
  { code: 'fr-FR', label: '🇫🇷 French (fr-FR)' }
];

const SUGGESTIONS = [
  { icon: '🎧', text: "Find wireless headphones under $100 on Amazon" },
  { icon: '✈️', text: "Search flights from Mumbai to London in April" },
  { icon: '💼', text: "Find remote Python developer jobs on LinkedIn" },
  { icon: '🏨', text: "Find hotels in Goa under ₹3000 per night" }
];

// --- Components ---

export default function App() {
  // State
  const [apiKey, setApiKey] = useState<string>('');
  const [tempKey, setTempKey] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'AGENT' | 'HISTORY' | 'ARCHITECTURE'>('AGENT');
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('IDLE');
  const [currentCommand, setCurrentCommand] = useState('');
  const [stepCount, setStepCount] = useState(0);
  const [actionLog, setActionLog] = useState<ActionLogItem[]>([]);
  const [speakText, setSpeakText] = useState('VoiceNav is ready to assist.');
  const [isExecuting, setIsExecuting] = useState(false);
  const [safeMode, setSafeMode] = useState(true);
  const [visionMode, setVisionMode] = useState('screenshot');
  const [persona, setPersona] = useState('professional');
  const [language, setLanguage] = useState('en-US');
  const [isMuted, setIsMuted] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [geminiData, setGeminiData] = useState<GeminiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState('');

  const logEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Scroll to bottom of log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [actionLog]);

  // Handle TTS
  const speak = useCallback((text: string) => {
    if (isMuted) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  }, [isMuted]);

  // Handle Gemini API Call
  const handleGeminiCall = async (userCommand: string) => {
    if (!apiKey) {
      setIsModalOpen(true);
      return;
    }

    setAgentStatus('THINKING');
    setSpeakText('Gemini is analyzing your request...');
    setError(null);
    setGeminiData(null);
    setActionLog([]);
    setStepCount(0);

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: SYSTEM_PROMPT + "\n\nUser command: " + userCommand
            }]
          }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) throw new Error('Gemini API Error — Check your API key');

      const data = await response.json();
      const textResponse = data.candidates[0].content.parts[0].text;
      
      let parsed: GeminiResponse;
      try {
        parsed = JSON.parse(textResponse);
      } catch (e) {
        // Fallback if JSON parse fails
        parsed = {
          agentThought: "I encountered an issue parsing the structured response, but I can still help you search.",
          spokenResponse: "I'm sorry, I had trouble processing that request. Let me try a general search for you.",
          steps: [{ type: 'SEARCH', detail: 'Performing general search...' }],
          resultType: 'general',
          results: [{
            title: "Search Results",
            description: `Searching for: ${userCommand}`,
            url: `https://www.google.com/search?q=${encodeURIComponent(userCommand)}`,
            urlLabel: "View on Google"
          }],
          simulatedUrl: `google.com/search?q=${encodeURIComponent(userCommand)}`,
          taskSummary: "General search performed."
        };
      }

      setGeminiData(parsed);
      setAgentStatus('EXECUTING');
      speak(parsed.spokenResponse);
      
      // Animate action log
      animateSteps(parsed.steps);

    } catch (err: any) {
      setError(err.message || 'API Connection Failed');
      setAgentStatus('IDLE');
      setTimeout(() => setError(null), 4000);
    }
  };

  const animateSteps = (steps: { type: string; detail: string }[]) => {
    let i = 0;
    const interval = setInterval(() => {
      if (i >= steps.length) {
        clearInterval(interval);
        setAgentStatus('DONE');
        setTimeout(() => setAgentStatus('IDLE'), 3000);
        return;
      }
      
      const step = steps[i];
      setStepCount(i + 1);
      setActionLog(prev => [
        ...prev.map(item => ({ ...item, status: 'done' as const })),
        { id: Date.now().toString() + i, type: step.type, detail: step.detail, status: 'active' as const }
      ]);
      i++;
    }, 600);
  };

  // Web Speech API Setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        
        setInterimTranscript(transcript);
        
        if (event.results[0].isFinal) {
          setCurrentCommand(transcript);
          setAgentStatus('THINKING');
          handleGeminiCall(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          setHasPermission(false);
        }
        setAgentStatus('IDLE');
      };

      recognition.onend = () => {
        if (agentStatus === 'LISTENING') {
          setAgentStatus('IDLE');
        }
      };

      recognitionRef.current = recognition;
    }
  }, [language, apiKey]);

  const toggleMic = () => {
    if (agentStatus === 'LISTENING') {
      recognitionRef.current?.stop();
      setAgentStatus('IDLE');
    } else if (agentStatus === 'IDLE') {
      try {
        recognitionRef.current?.start();
        setAgentStatus('LISTENING');
        setInterimTranscript('');
        setCurrentCommand('');
      } catch (e) {
        console.error("Mic start error", e);
      }
    }
  };

  // Keyboard Shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        toggleMic();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [agentStatus]);

  const requestPermission = () => {
    recognitionRef.current?.start();
    recognitionRef.current?.stop();
    setHasPermission(true);
  };

  const saveApiKey = () => {
    if (tempKey.startsWith('AIza')) {
      setApiKey(tempKey);
      setIsModalOpen(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-bg-dark bg-grid">
      {/* Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand/10 blur-[120px] rounded-full -z-10" />

      {/* Header */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-bg-dark/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-brand/20 flex items-center justify-center border border-brand/30">
            <Zap className="w-5 h-5 text-brand" />
          </div>
          <h1 className="text-xl font-bold tracking-tighter">
            VOICE<span className="text-brand">NAV</span>
          </h1>
          <span className="text-[10px] bg-brand/10 text-brand px-2 py-0.5 rounded-full border border-brand/20 font-bold">
            v2.0 BETA
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-3">
            <StatusPill label="SAFETY" color="text-brand" active={agentStatus !== 'IDLE'} />
            <StatusPill label="VISION" color="text-blue-400" active={agentStatus === 'EXECUTING'} />
            <StatusPill label="VOICE" color="text-purple-400" active={agentStatus === 'LISTENING'} />
          </div>
          
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white/5 transition-colors text-sm font-medium border border-white/10"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">SETTINGS</span>
          </button>

          <button 
            onClick={() => apiKey ? null : setIsModalOpen(true)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md transition-all text-sm font-bold border ${
              apiKey 
                ? 'bg-brand/10 text-brand border-brand/30' 
                : 'bg-white/5 text-white border-white/10 hover:bg-white/10'
            }`}
          >
            {apiKey ? <CheckCircle2 className="w-4 h-4" /> : <Key className="w-4 h-4" />}
            <span>{apiKey ? 'API CONNECTED' : 'ADD API KEY'}</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.aside 
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              className="w-72 border-r border-white/5 bg-bg-dark/95 backdrop-blur-xl p-6 flex flex-col gap-8 z-30"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white/50">SYSTEM CONFIG</h2>
                <button onClick={() => setIsSidebarOpen(false)} className="text-white/30 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold flex items-center gap-2">
                      <Shield className="w-3 h-3 text-brand" /> SAFE MODE
                    </label>
                    <Toggle active={safeMode} onToggle={() => setSafeMode(!safeMode)} />
                  </div>
                  <p className="text-[10px] text-white/40">Confirm before irreversible actions like purchases or deletions.</p>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold flex items-center gap-2">
                    <Eye className="w-3 h-3 text-blue-400" /> VISION MODE
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {['screenshot', 'video', 'live-stream'].map(mode => (
                      <button 
                        key={mode}
                        onClick={() => setVisionMode(mode)}
                        className={`text-[10px] text-left px-3 py-2 rounded border transition-all ${
                          visionMode === mode 
                            ? 'bg-blue-400/10 border-blue-400/30 text-blue-400' 
                            : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                        }`}
                      >
                        {mode.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold flex items-center gap-2">
                    <Volume2 className="w-3 h-3 text-purple-400" /> AGENT PERSONA
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {['professional', 'friendly', 'concise'].map(p => (
                      <button 
                        key={p}
                        onClick={() => setPersona(p)}
                        className={`text-[10px] text-left px-3 py-2 rounded border transition-all ${
                          persona === p 
                            ? 'bg-purple-400/10 border-purple-400/30 text-purple-400' 
                            : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                        }`}
                      >
                        {p.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-6 border-t border-white/5 space-y-4">
                <h3 className="text-[10px] font-bold text-white/30">TECH STACK</h3>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    'Google Cloud Run',
                    'Gemini Vision API',
                    'Gemini Live API',
                    'Google ADK',
                    'Cloud Storage',
                    'Cloud Logging'
                  ].map(tech => (
                    <div key={tech} className="flex items-center gap-2 text-[10px] text-white/60">
                      <CheckCircle2 className="w-3 h-3 text-brand" />
                      {tech}
                    </div>
                  ))}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-white/5 px-6 bg-bg-dark/40">
            <TabButton active={activeTab === 'AGENT'} onClick={() => setActiveTab('AGENT')} icon={<Zap className="w-4 h-4" />} label="AGENT" />
            <TabButton active={activeTab === 'HISTORY'} onClick={() => setActiveTab('HISTORY')} icon={<Clock className="w-4 h-4" />} label="TASK HISTORY" />
            <TabButton active={activeTab === 'ARCHITECTURE'} onClick={() => setActiveTab('ARCHITECTURE')} icon={<Layers className="w-4 h-4" />} label="ARCHITECTURE" />
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'AGENT' && (
              <div className="h-full flex flex-col md:flex-row">
                {/* Left Column: Main Area */}
                <div className="flex-1 flex flex-col p-6 gap-6 overflow-hidden">
                  {/* Command Status Bar */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full glow-dot ${
                          agentStatus === 'IDLE' ? 'bg-white/20' : 
                          agentStatus === 'LISTENING' ? 'bg-red-500 animate-pulse' :
                          agentStatus === 'THINKING' ? 'bg-amber-500 animate-pulse' :
                          'bg-brand animate-pulse'
                        }`} />
                        <span className="text-xs font-bold tracking-widest">{agentStatus}</span>
                      </div>
                      <div className="h-4 w-px bg-white/10" />
                      <div className="text-sm text-white/80 font-medium truncate max-w-[300px]">
                        {currentCommand || (agentStatus === 'IDLE' ? 'Waiting for command...' : '...')}
                      </div>
                    </div>
                    {stepCount > 0 && (
                      <div className="text-[10px] bg-white/5 px-2 py-1 rounded border border-white/10 text-white/50">
                        Step {stepCount}/8
                      </div>
                    )}
                  </div>

                  {/* Screen Viewer */}
                  <div className="flex-1 bg-black rounded-2xl border border-white/10 overflow-hidden flex flex-col relative">
                    {/* Browser Chrome */}
                    <div className="h-10 bg-white/5 border-b border-white/10 flex items-center px-4 gap-4">
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
                      </div>
                      <div className="flex-1 bg-black/40 h-6 rounded-md border border-white/5 flex items-center px-3 gap-2">
                        <Search className="w-3 h-3 text-white/20" />
                        <span className="text-[10px] text-white/40">
                          {agentStatus === 'IDLE' ? 'about:blank' : 'amazon.com/s?k=wireless+headphones'}
                        </span>
                      </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 relative flex items-center justify-center">
                      {agentStatus === 'EXECUTING' && (
                        <div className="absolute inset-0 z-10 pointer-events-none">
                          <div className="w-full h-[2px] bg-brand/5 shadow-[0_0_15px_rgba(0,255,200,0.5)] animate-scan" />
                        </div>
                      )}

                      {agentStatus === 'THINKING' && (
                        <div className="flex flex-col items-center gap-4">
                          <Loader2 className="w-12 h-12 text-brand animate-spin" />
                          <span className="text-xs font-bold text-brand animate-pulse">GEMINI IS ANALYZING...</span>
                        </div>
                      )}

                      {!geminiData ? (
                        agentStatus !== 'THINKING' && (
                          <div className="flex flex-col items-center gap-4 text-white/20">
                            <Monitor className="w-16 h-16" />
                            <span className="text-sm font-bold tracking-widest">NO ACTIVE SESSION</span>
                          </div>
                        )
                      ) : (
                        <div className="w-full h-full p-6 flex flex-col gap-6 overflow-y-auto">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold truncate">Results for "{currentCommand}"</h3>
                            <div className="flex gap-2">
                              <span className="text-[10px] bg-brand/10 text-brand px-2 py-1 rounded border border-brand/20">
                                {geminiData.resultType.toUpperCase()}
                              </span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 gap-4">
                            {/* Top Result Preview */}
                            <div className="bg-brand/5 border border-brand/30 rounded-xl p-4">
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="text-sm font-bold text-brand">{geminiData.results[0].title}</h4>
                                {geminiData.results[0].badge && (
                                  <span className="text-[10px] bg-brand text-bg-dark px-2 py-0.5 rounded font-bold">
                                    {geminiData.results[0].badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-white/60 mb-3">{geminiData.results[0].description}</p>
                              <div className="flex justify-between items-center">
                                <span className="text-lg font-bold text-white">{geminiData.results[0].price || ''}</span>
                                <span className="text-xs font-bold text-white/40">View all results below ↓</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Voice Control Bar */}
                  <div className="flex flex-col items-center gap-6 py-8">
                    {/* Live Transcript Display */}
                    <AnimatePresence>
                      {(agentStatus === 'LISTENING' || currentCommand) && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="w-full max-w-2xl bg-black/80 border border-brand/30 rounded-xl p-4 relative"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                            <span className="text-[10px] font-bold text-brand tracking-widest uppercase">🎤 HEARING:</span>
                          </div>
                          <p className="text-sm italic text-white/70 leading-relaxed min-h-[1.5em]">
                            {interimTranscript || currentCommand || "..."}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Mic Button Area */}
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        {agentStatus === 'LISTENING' && (
                          <>
                            <div className="absolute inset-0 rounded-full bg-red-500/20 animate-mic-pulse" />
                            <div className="absolute inset-0 rounded-full bg-red-500/20 animate-mic-pulse [animation-delay:0.5s]" />
                            <div className="absolute inset-0 rounded-full bg-red-500/20 animate-mic-pulse [animation-delay:1s]" />
                          </>
                        )}
                        <button 
                          onClick={toggleMic}
                          disabled={agentStatus === 'THINKING' || agentStatus === 'EXECUTING'}
                          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all relative z-10 shadow-2xl ${
                            agentStatus === 'IDLE' ? 'bg-gradient-to-br from-brand to-emerald-600 text-bg-dark glow-teal' :
                            agentStatus === 'LISTENING' ? 'bg-gradient-to-br from-red-500 to-red-700 text-white' :
                            agentStatus === 'THINKING' ? 'bg-gradient-to-br from-amber-500 to-amber-700 text-white' :
                            agentStatus === 'EXECUTING' ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white' :
                            'bg-brand text-bg-dark'
                          }`}
                        >
                          {agentStatus === 'IDLE' && <Mic className="w-10 h-10" />}
                          {agentStatus === 'LISTENING' && <div className="w-6 h-6 rounded-sm bg-white" />}
                          {agentStatus === 'THINKING' && <RefreshCw className="w-10 h-10 animate-spin" />}
                          {agentStatus === 'EXECUTING' && <Zap className="w-10 h-10" />}
                          {agentStatus === 'DONE' && <CheckCircle2 className="w-10 h-10" />}
                        </button>
                      </div>
                      
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs font-bold tracking-widest uppercase text-white/40">
                          {agentStatus === 'IDLE' ? 'TAP TO SPEAK' : 
                           agentStatus === 'LISTENING' ? 'LISTENING... TAP TO STOP' :
                           agentStatus === 'THINKING' ? 'GEMINI IS THINKING...' :
                           agentStatus === 'EXECUTING' ? 'EXECUTING TASK...' :
                           'TAP TO SPEAK AGAIN'}
                        </span>
                        <span className="text-[10px] text-white/20">Press SPACE to speak</span>
                      </div>
                    </div>

                    {/* Language & Mute Controls */}
                    <div className="flex items-center gap-6 mt-2">
                      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                        <Globe className="w-3 h-3 text-white/40" />
                        <select 
                          value={language}
                          onChange={(e) => setLanguage(e.target.value)}
                          className="bg-transparent text-[10px] font-bold focus:outline-none cursor-pointer"
                        >
                          {LANGUAGES.map(lang => (
                            <option key={lang.code} value={lang.code} className="bg-bg-dark">{lang.label}</option>
                          ))}
                        </select>
                      </div>
                      <button 
                        onClick={() => setIsMuted(!isMuted)}
                        className={`p-2 rounded-lg border transition-all ${
                          isMuted ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
                        }`}
                      >
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Suggestion Chips */}
                    <div className="flex flex-col items-center gap-3 mt-4">
                      <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Try saying:</span>
                      <div className="flex flex-wrap justify-center gap-2">
                        {SUGGESTIONS.map((s, idx) => (
                          <button 
                            key={idx}
                            onClick={() => {
                              setCurrentCommand(s.text);
                              handleGeminiCall(s.text);
                            }}
                            className="px-3 py-1.5 rounded-full bg-white/5 border border-brand/20 text-[10px] font-medium hover:bg-brand/10 hover:border-brand/50 transition-all flex items-center gap-2"
                          >
                            <span>{s.icon}</span>
                            {s.text}
                          </button>
                        ))}
                      </div>
                    </div>

                    <p className="text-[11px] text-white/10 mt-4">Works best on Chrome and Edge browsers</p>
                  </div>

                  {/* Results Display */}
                  {geminiData && (
                    <div className="px-6 pb-12 space-y-8">
                      {/* Agent Says Box */}
                      <div className="bg-black/40 border-l-4 border-brand rounded-r-xl p-6 relative">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                          <span className="text-xs font-bold text-brand tracking-widest uppercase">💬 AGENT SAYS</span>
                          <button 
                            onClick={() => speak(geminiData.spokenResponse)}
                            className="ml-auto p-1.5 rounded-md hover:bg-white/5 text-white/40 hover:text-brand transition-colors"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm italic text-white/80 leading-relaxed typewriter-text">
                          {geminiData.spokenResponse}
                        </p>
                      </div>

                      {/* Result Cards Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {geminiData.results.map((res, idx) => (
                          <ResultCard key={idx} result={res} type={geminiData.resultType} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Action Log */}
                <div className="w-full md:w-[320px] border-l border-white/5 flex flex-col bg-bg-dark/40">
                  <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <h2 className="text-xs font-bold tracking-widest text-white/50">ACTION LOG</h2>
                    <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                      {actionLog.length} STEPS
                    </span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {actionLog.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center gap-4 text-white/10 text-center p-8">
                        {agentStatus === 'THINKING' ? (
                          <div className="space-y-4 w-full">
                            <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
                            <div className="h-12 bg-white/5 rounded-lg animate-pulse [animation-delay:0.2s]" />
                            <div className="h-12 bg-white/5 rounded-lg animate-pulse [animation-delay:0.4s]" />
                          </div>
                        ) : (
                          <>
                            <RefreshCw className="w-8 h-8" />
                            <p className="text-xs font-medium">Actions will appear here during execution</p>
                          </>
                        )}
                      </div>
                    ) : (
                      actionLog.map((action) => (
                        <div 
                          key={action.id}
                          className={`p-3 rounded-lg border bg-white/5 transition-all ${
                            action.status === 'active' ? 'border-amber-500/50 ring-1 ring-amber-500/20' : 'border-white/5'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[10px] font-bold ${
                              action.type === 'SCREENSHOT' ? 'text-blue-400' :
                              action.type === 'CLICK' ? 'text-brand' :
                              action.type === 'TYPE' ? 'text-purple-400' :
                              'text-amber-400'
                            }`}>
                              {action.type}
                            </span>
                            {action.status === 'done' && <CheckCircle2 className="w-3 h-3 text-brand" />}
                            {action.status === 'active' && <Loader2 className="w-3 h-3 text-amber-500 animate-spin" />}
                          </div>
                          <p className="text-[11px] text-white/70 leading-relaxed">{action.detail}</p>
                        </div>
                      ))
                    )}
                    <div ref={logEndRef} />
                  </div>

                  {agentStatus === 'THINKING' && (
                    <div className="p-4 bg-amber-500/10 border-t border-amber-500/20">
                      <div className="flex items-start gap-3">
                        <MessageSquare className="w-4 h-4 text-amber-500 mt-1" />
                        <div className="flex-1">
                          <p className="text-[10px] font-bold text-amber-500 mb-1">AGENT THINKING</p>
                          <p className="text-[11px] text-white/80 italic">"{geminiData?.agentThought || 'Planning optimal route...'}"</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'HISTORY' && (
              <div className="p-8 max-w-4xl mx-auto space-y-6">
                <h2 className="text-xl font-bold flex items-center gap-3">
                  <Clock className="w-6 h-6 text-brand" /> RECENT TASKS
                </h2>
                <div className="grid grid-cols-1 gap-4">
                  <HistoryItem icon="🎧" description="Find wireless headphones under $100 on Amazon" timeAgo="2 hours ago" />
                  <HistoryItem icon="📧" description="Find latest invoice from supplier in Gmail" timeAgo="5 hours ago" />
                  <HistoryItem icon="✈️" description="Search flights Mumbai to London for next month" timeAgo="1 day ago" />
                </div>
              </div>
            )}

            {activeTab === 'ARCHITECTURE' && (
              <div className="p-8 max-w-6xl mx-auto space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <ArchCard 
                    title="Frontend" 
                    color="border-brand" 
                    items={['React 19', 'Tailwind CSS 4', 'Lucide Icons', 'Motion Animations']} 
                    icon={<Smartphone className="w-5 h-5" />}
                  />
                  <ArchCard 
                    title="Google Cloud Backend" 
                    color="border-blue-500" 
                    items={['Cloud Run (Hosting)', 'Gemini 3.1 Pro (Logic)', 'Gemini Vision (Sight)', 'Gemini Live (Voice)']} 
                    icon={<Server className="w-5 h-5" />}
                  />
                  <ArchCard 
                    title="Storage & Infra" 
                    color="border-purple-500" 
                    items={['Cloud Storage (Images)', 'Cloud Logging (Debug)', 'ADK Orchestration', 'SQLite (Local State)']} 
                    icon={<Database className="w-5 h-5" />}
                  />
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-bold flex items-center gap-3">
                    <RefreshCw className="w-5 h-5 text-brand" /> EXECUTION FLOW
                  </h3>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-8 overflow-x-auto">
                    <div className="flex items-center gap-4 min-w-[800px]">
                      <FlowStep icon="🎤" label="Voice Input" />
                      <FlowArrow />
                      <FlowStep icon="📡" label="Gemini Live API" />
                      <FlowArrow />
                      <FlowStep icon="🧠" label="ADK Agent" />
                      <FlowArrow />
                      <FlowStep icon="📸" label="Screenshot" />
                      <FlowArrow />
                      <FlowStep icon="👁" label="Gemini Vision" />
                      <FlowArrow />
                      <FlowStep icon="⚡" label="Execute Action" />
                      <FlowArrow />
                      <FlowStep icon="🔄" label="Verify Result" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* API Key Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-lg bg-bg-dark border border-white/10 rounded-2xl p-8 relative z-10 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-3">
                  <Key className="w-5 h-5 text-brand" /> Connect Gemini API
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-white/30 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-white/60 mb-6 leading-relaxed">
                To enable VoiceNav's visual and voice capabilities, please provide your Gemini API key. 
                Your key is stored locally in your browser and never sent to our servers.
              </p>

              <div className="space-y-4 mb-8">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-widest">GEMINI API KEY</label>
                  <input 
                    type="password" 
                    placeholder="AIza..."
                    value={tempKey}
                    onChange={(e) => setTempKey(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand/50 transition-colors font-mono"
                  />
                </div>
                <a 
                  href="https://aistudio.google.com/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-brand hover:underline flex items-center gap-1.5"
                >
                  Get your free Gemini API key from Google AI Studio <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="bg-white/5 rounded-xl p-4 border border-white/5 mb-8">
                <div className="flex items-start gap-3">
                  <Info className="w-4 h-4 text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-white/80 mb-2">What gets enabled:</p>
                    <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <li className="text-[10px] text-white/50 flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-brand" /> Gemini Vision
                      </li>
                      <li className="text-[10px] text-white/50 flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-brand" /> Gemini Live API
                      </li>
                      <li className="text-[10px] text-white/50 flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-brand" /> ADK Orchestration
                      </li>
                      <li className="text-[10px] text-white/50 flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-brand" /> Real-time Execution
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-lg border border-white/10 text-sm font-bold hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveApiKey}
                  disabled={!tempKey.startsWith('AIza')}
                  className={`flex-1 px-4 py-3 rounded-lg text-sm font-bold transition-all ${
                    tempKey.startsWith('AIza') 
                      ? 'bg-brand text-bg-dark glow-teal' 
                      : 'bg-white/5 text-white/30 cursor-not-allowed'
                  }`}
                >
                  ACTIVATE VOICENAV
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Permission Prompt */}
      <AnimatePresence>
        {hasPermission === null && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-md bg-bg-dark border border-brand/30 rounded-2xl p-8 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-brand/10 flex items-center justify-center mx-auto mb-6 border border-brand/20">
                <Mic className="w-10 h-10 text-brand" />
              </div>
              <h2 className="text-xl font-bold mb-4">Microphone Access Required</h2>
              <p className="text-sm text-white/60 mb-8 leading-relaxed">
                VoiceNav needs microphone access to work. Click below to allow microphone.
              </p>
              <button 
                onClick={requestPermission}
                className="w-full bg-brand text-bg-dark py-4 rounded-xl font-bold glow-teal hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                ALLOW MICROPHONE
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Permission Denied Error */}
      <AnimatePresence>
        {hasPermission === false && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-md bg-bg-dark border border-red-500/30 rounded-2xl p-8 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                <VolumeX className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-xl font-bold mb-4 text-red-500">Access Denied</h2>
              <p className="text-sm text-white/60 mb-8 leading-relaxed">
                Microphone access denied. Please allow microphone in browser settings to use VoiceNav.
              </p>
              <div className="bg-white/5 p-4 rounded-lg border border-white/10 text-left">
                <p className="text-[10px] font-bold text-white/40 uppercase mb-2">How to enable:</p>
                <p className="text-xs text-white/60">1. Click the lock icon in the address bar</p>
                <p className="text-xs text-white/60">2. Toggle Microphone to "On"</p>
                <p className="text-xs text-white/60">3. Refresh the page</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* API Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-full font-bold shadow-2xl flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---

interface ResultCardProps {
  result: GeminiResult;
  type: string;
}

const ResultCard: React.FC<ResultCardProps> = ({ result, type }) => {
  const getIcon = () => {
    switch (type) {
      case 'products': return '🛒';
      case 'flights': return '✈️';
      case 'hotels': return '🏨';
      case 'jobs': return '💼';
      case 'links': return '🔗';
      case 'info': return '📖';
      case 'form': return '📝';
      default: return '🌐';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-[#0d1117] border border-brand/15 border-l-[3px] border-l-brand rounded-xl overflow-hidden flex flex-col h-full group"
    >
      <div className="p-5 flex-1 space-y-3">
        <div className="flex justify-between items-start">
          <h4 className="text-sm font-bold text-white group-hover:text-brand transition-colors leading-snug">
            {result.title}
          </h4>
          {result.badge && (
            <span className="text-[9px] bg-brand/10 text-brand px-2 py-0.5 rounded border border-brand/20 font-bold whitespace-nowrap">
              {result.badge}
            </span>
          )}
        </div>
        <p className="text-xs text-white/50 leading-relaxed">{result.description}</p>
        {(result.price || result.rating) && (
          <div className="flex items-center gap-4 pt-1">
            {result.price && <span className="text-sm font-bold text-brand">{result.price}</span>}
            {result.rating && <span className="text-xs font-bold text-amber-400">{result.rating}</span>}
          </div>
        )}
      </div>
      <div className="p-4 pt-0">
        <a 
          href={result.url} 
          target="_blank" 
          rel="noreferrer"
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-brand/30 text-brand text-[11px] font-bold hover:bg-brand hover:text-bg-dark transition-all"
        >
          <span>{getIcon()}</span>
          {result.urlLabel}
        </a>
      </div>
    </motion.div>
  );
};

// --- Sub-components ---

function StatusPill({ label, color, active }: { label: string, color: string, active: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 ${color}`}>
      <div className={`w-1.5 h-1.5 rounded-full glow-dot ${active ? 'bg-current animate-pulse' : 'bg-white/20'}`} />
      <span className="text-[10px] font-bold tracking-widest">{label}</span>
    </div>
  );
}

function Toggle({ active, onToggle }: { active: boolean, onToggle: () => void }) {
  return (
    <button 
      onClick={onToggle}
      className={`w-8 h-4 rounded-full relative transition-colors ${active ? 'bg-brand' : 'bg-white/10'}`}
    >
      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${active ? 'left-4.5' : 'left-0.5'}`} />
    </button>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-all text-xs font-bold tracking-widest ${
        active ? 'border-brand text-brand bg-brand/5' : 'border-transparent text-white/40 hover:text-white/60'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ProductCard({ name, price, rating, highlighted = false }: { name: string, price: string, rating: string, highlighted?: boolean }) {
  return (
    <div className={`p-4 rounded-xl border transition-all ${
      highlighted ? 'bg-brand/5 border-brand/30' : 'bg-white/5 border-white/10'
    }`}>
      <div className="flex justify-between items-start mb-2">
        <h4 className={`text-sm font-bold ${highlighted ? 'text-brand' : 'text-white/90'}`}>{name}</h4>
        <span className="text-xs font-bold text-white/50">{rating}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-lg font-bold text-white">{price}</span>
        {highlighted && (
          <span className="text-[10px] bg-brand text-bg-dark px-2 py-0.5 rounded font-bold">BEST RATED</span>
        )}
      </div>
    </div>
  );
}

function HistoryItem({ icon, description, timeAgo }: { icon: string, description: string, timeAgo: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between hover:border-brand/30 transition-colors group">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-xl">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-white/90">{description}</p>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">{timeAgo}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-[10px] bg-brand/10 text-brand px-2 py-1 rounded border border-brand/20 font-bold">DONE</span>
        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-brand transition-colors" />
      </div>
    </div>
  );
}

function ArchCard({ title, color, items, icon }: { title: string, color: string, items: string[], icon: React.ReactNode }) {
  return (
    <div className={`bg-white/5 border-l-4 ${color} rounded-r-xl p-6 space-y-4`}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white/5 rounded-lg text-white/60">
          {icon}
        </div>
        <h3 className="font-bold text-white/90">{title}</h3>
      </div>
      <ul className="space-y-2">
        {items.map(item => (
          <li key={item} className="text-xs text-white/50 flex items-center gap-2">
            <ArrowRight className="w-3 h-3 text-white/20" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FlowStep({ icon, label }: { icon: string, label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-white/5 border border-white/10 rounded-xl min-w-[120px]">
      <span className="text-2xl">{icon}</span>
      <span className="text-[10px] font-bold text-white/60 text-center">{label}</span>
    </div>
  );
}

function FlowArrow() {
  return <ChevronRight className="w-4 h-4 text-white/10 flex-shrink-0" />;
}
