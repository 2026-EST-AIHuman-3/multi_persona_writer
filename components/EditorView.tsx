/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback, KeyboardEvent } from "react";
import { RefreshCw, Save, Sliders, CheckCircle2, Send, Bot, UserCircle, Copy, Check } from "lucide-react";
import { Manuscript, Persona } from "@/types";

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface EditorViewProps {
  manuscript: Manuscript | null;
  personas: Persona[];
  activePersonaId: string;
  onSave: (m: Partial<Manuscript>) => Promise<any>;
  onGenerate: (prompt: string, config: any) => Promise<string>;
}

export default function EditorView({
  manuscript,
  personas,
  activePersonaId,
  onSave,
  onGenerate
}: EditorViewProps) {
  const currentPersona = personas.find(p => p.id === activePersonaId) || personas[0];

  const [id, setId] = useState("");
  const [status, setStatus] = useState<"completed" | "draft" | "editing">("draft");

  // Chat state — per-persona sessions
  const [sessionsMap, setSessionsMap] = useState<Record<string, ChatMessage[]>>({});
  const [inputValue, setInputValue] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Derive current messages from sessionsMap
  const messages = sessionsMap[activePersonaId] || [];

  // Helper to update messages for a specific persona
  const updateMessages = useCallback((personaId: string, updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    setSessionsMap(prev => ({
      ...prev,
      [personaId]: updater(prev[personaId] || [])
    }));
  }, []);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // LoRA Parameter Sliders
  const [temperature, setTemperature] = useState(0.65);
  const [topP, setTopP] = useState(0.9);
  const [presencePenalty, setPresencePenalty] = useState(0.4);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load selected manuscript as a conversation if provided
  useEffect(() => {
    if (manuscript) {
      setId(manuscript.id);
      setStatus(manuscript.status);
      const loadedMessages: ChatMessage[] = [];
      if (manuscript.prompt) {
        loadedMessages.push({
          id: `loaded-user-${manuscript.id}`,
          role: 'user',
          content: manuscript.prompt,
          timestamp: new Date()
        });
      }
      if (manuscript.content) {
        loadedMessages.push({
          id: `loaded-ai-${manuscript.id}`,
          role: 'assistant',
          content: manuscript.content,
          timestamp: new Date()
        });
      }
      // Store under the manuscript's persona
      setSessionsMap(prev => ({
        ...prev,
        [manuscript.personaId]: loadedMessages
      }));
    } else {
      setId("");
      setStatus("draft");
    }
  }, [manuscript]);

  // Adjust sliders if persona preset changes
  useEffect(() => {
    if (currentPersona && !manuscript) {
      setTemperature(currentPersona.defaultConfig.temperature);
      setTopP(currentPersona.defaultConfig.topP);
      setPresencePenalty(currentPersona.defaultConfig.presencePenalty);
    }
  }, [currentPersona, manuscript]);

  // Send message
  const handleSend = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isGenerating) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date()
    };

    updateMessages(activePersonaId, prev => [...prev, userMessage]);
    setInputValue("");
    setIsGenerating(true);

    // Auto-resize textarea back
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    try {
      const generated = await onGenerate(trimmed, {
        personaName: currentPersona.name,
        personaDesc: currentPersona.description,
        loraAdapter: currentPersona.loraAdapter,
        temperature,
        topP,
        presencePenalty
      });

      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: generated,
        timestamp: new Date()
      };
      updateMessages(activePersonaId, prev => [...prev, aiMessage]);
    } catch (e) {
      console.error(e);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "죄송합니다, 응답 생성 중 오류가 발생했습니다. 다시 시도해 주세요.",
        timestamp: new Date()
      };
      updateMessages(activePersonaId, prev => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
      inputRef.current?.focus();
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  // Copy message content
  const handleCopy = (msgId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Save action - saves the last AI response as manuscript
  const handleSave = async () => {
    const lastAiMsg = [...messages].reverse().find(m => m.role === 'assistant');
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastAiMsg) return;

    setIsSaving(true);
    try {
      await onSave({
        id: id || undefined,
        title: lastUserMsg?.content.slice(0, 50) || "무제 원고",
        content: lastAiMsg.content,
        prompt: lastUserMsg?.content || "",
        personaId: currentPersona.id,
        loraAdapter: currentPersona.loraAdapter,
        status
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  // Word count from all AI messages
  const totalWords = messages
    .filter(m => m.role === 'assistant')
    .reduce((sum, m) => sum + m.content.trim().split(/\s+/).filter(Boolean).length, 0);

  return (
    <div className="flex-1 ml-0 md:ml-sidebar-width flex overflow-hidden">
      
      {/* Center Column: Chat Interface */}
      <div className="flex-1 bg-bg-warm flex flex-col h-[calc(100vh-64px)]">
        
        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[760px] mx-auto px-6 py-8 flex flex-col gap-1">

            {/* Empty state */}
            {messages.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center py-24 text-center">
                <div className="w-12 h-12 border border-border-warm flex items-center justify-center mb-5">
                  <Bot size={20} className="text-secondary" />
                </div>
                <h2 className="font-serif italic text-xl text-ink mb-2">
                  {currentPersona.name}
                </h2>
                <p className="text-muted-text text-xs max-w-sm leading-relaxed mb-6">
                  {currentPersona.description}
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-md">
                  {currentPersona.recommendedTasks.map((task, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setInputValue(task);
                        inputRef.current?.focus();
                      }}
                      className="px-3 py-1.5 border border-border-warm text-[10px] text-muted-text hover:text-primary hover:border-primary transition-colors cursor-pointer bg-transparent font-mono tracking-wider"
                    >
                      {task}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 py-5 ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {/* AI avatar */}
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 w-7 h-7 border border-border-warm flex items-center justify-center mt-0.5">
                    <Bot size={14} className="text-secondary" />
                  </div>
                )}

                <div
                  className={`relative group max-w-[85%] ${
                    msg.role === 'user'
                      ? 'bg-[#1E1E1E] border border-border-warm px-4 py-3'
                      : 'px-1 py-1'
                  }`}
                >
                  {/* Role label */}
                  <p className={`font-mono text-[9px] tracking-[0.3em] uppercase font-bold mb-2 ${
                    msg.role === 'user' ? 'text-muted-text' : 'text-secondary'
                  }`}>
                    {msg.role === 'user' ? 'YOU' : currentPersona.name}
                  </p>

                  {/* Message content */}
                  <div className={`text-on-surface leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'text-xs font-sans'
                      : 'text-sm font-serif tracking-wide leading-loose'
                  }`}>
                    {msg.content}
                  </div>

                  {/* Actions for AI messages */}
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border-warm/30">
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="flex items-center gap-1.5 text-[9px] font-mono tracking-wider text-muted-text hover:text-primary transition-colors cursor-pointer bg-transparent uppercase"
                      >
                        {copiedId === msg.id ? (
                          <><Check size={10} className="text-green-400" /> 복사됨</>
                        ) : (
                          <><Copy size={10} /> 복사</>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* User avatar */}
                {msg.role === 'user' && (
                  <div className="flex-shrink-0 w-7 h-7 bg-[#1E1E1E] border border-border-warm flex items-center justify-center mt-0.5">
                    <UserCircle size={14} className="text-muted-text" />
                  </div>
                )}
              </div>
            ))}

            {/* Generating indicator */}
            {isGenerating && (
              <div className="flex gap-3 py-5">
                <div className="flex-shrink-0 w-7 h-7 border border-border-warm flex items-center justify-center mt-0.5">
                  <Bot size={14} className="text-secondary" />
                </div>
                <div className="px-1 py-1">
                  <p className="font-mono text-[9px] tracking-[0.3em] uppercase font-bold mb-2 text-secondary">
                    {currentPersona.name}
                  </p>
                  <div className="flex items-center gap-2">
                    <RefreshCw size={14} className="text-secondary animate-spin" />
                    <span className="text-xs text-muted-text font-mono tracking-wider">
                      집필 중...
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Bottom Input Bar */}
        <div className="border-t border-border-warm bg-[#0E0E0E] px-6 py-4">
          <div className="max-w-[760px] mx-auto">
            <div className="flex items-end gap-3 bg-[#181818] border border-border-warm px-4 py-3 transition-colors focus-within:border-secondary/60">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                rows={1}
                className="flex-1 bg-transparent text-on-surface text-sm leading-relaxed resize-none focus:outline-none placeholder-muted-text font-sans"
                placeholder={`${currentPersona.name}에게 창작을 요청하세요...`}
                disabled={isGenerating}
              />
              <div className="flex items-center gap-2 flex-shrink-0">
                {messages.some(m => m.role === 'assistant') && (
                  <button
                    disabled={isSaving}
                    onClick={handleSave}
                    className="flex items-center gap-1.5 text-muted-text hover:text-primary transition-colors cursor-pointer bg-transparent p-1.5"
                    title="원고 저장"
                  >
                    <Save size={16} />
                  </button>
                )}
                <button
                  disabled={isGenerating || !inputValue.trim()}
                  onClick={handleSend}
                  className={`flex items-center justify-center w-8 h-8 transition-all cursor-pointer ${
                    inputValue.trim() && !isGenerating
                      ? 'bg-primary text-on-primary hover:opacity-90'
                      : 'bg-[#252525] text-muted-text cursor-not-allowed'
                  }`}
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
            <p className="text-[9px] text-muted-text font-mono tracking-wider mt-2 text-center">
              {currentPersona.loraAdapter} · Enter로 전송, Shift+Enter로 줄바꿈
            </p>
          </div>
        </div>
      </div>

      {/* Right Column: Style Guide & Parameter Panel */}
      <aside className="w-eval-panel-width bg-panel-dark border-l border-[#202020] flex flex-col h-full overflow-y-auto z-10 text-on-surface">
        {/* Adapter Status */}
        <div className="p-6 border-b border-border-warm/40 bg-[#0A0A0A]">
          <h3 className="font-mono text-[9px] tracking-[0.3em] text-secondary uppercase mb-2 font-bold">
            STYLE CONFIG : ACTIVE
          </h3>
          <p className="font-serif text-lg text-ink font-normal italic tracking-tight">
            {currentPersona.loraAdapter}
          </p>
          <p className="font-sans text-[10px] tracking-wide text-on-surface-variant mt-1.5 opacity-80">
            페르소나: {currentPersona.name}
          </p>
        </div>

        {/* LoRA Parameters Controller */}
        <div className="p-6 border-b border-border-warm/40">
          <h4 className="font-mono text-[9px] tracking-[0.3em] text-on-surface-variant mb-5 uppercase flex items-center gap-2 font-bold">
            <Sliders size={12} />
            LORA WEIGHTS CONTROLS
          </h4>
          
          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-[10px] font-mono mb-2">
                <span className="opacity-70">Temperature</span>
                <span className="text-secondary font-bold">{temperature.toFixed(2)}</span>
              </div>
              <input 
                type="range" min="0.1" max="1.0" step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full h-[2px] bg-border-warm appearance-none cursor-pointer accent-white"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] font-mono mb-2">
                <span className="opacity-70">Top P</span>
                <span className="text-secondary font-bold">{topP.toFixed(2)}</span>
              </div>
              <input 
                type="range" min="0.1" max="1.0" step="0.05"
                value={topP}
                onChange={(e) => setTopP(parseFloat(e.target.value))}
                className="w-full h-[2px] bg-border-warm appearance-none cursor-pointer accent-white"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] font-mono mb-2">
                <span className="opacity-70">Presence Penalty</span>
                <span className="text-secondary font-bold">{presencePenalty.toFixed(2)}</span>
              </div>
              <input 
                type="range" min="-2.0" max="2.0" step="0.1"
                value={presencePenalty}
                onChange={(e) => setPresencePenalty(parseFloat(e.target.value))}
                className="w-full h-[2px] bg-border-warm appearance-none cursor-pointer accent-white"
              />
            </div>
          </div>
        </div>

        {/* Session Stats */}
        <div className="p-6 mt-auto border-t border-border-warm/40 bg-[#0A0A0A]">
          <div className="flex justify-between text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">
            <span>MESSAGES</span>
            <span className="font-bold text-white">{messages.length}</span>
          </div>
          <div className="flex justify-between text-[10px] font-mono text-on-surface-variant uppercase tracking-wider mt-2.5">
            <span>AI WORDS</span>
            <span className="font-bold text-white">{totalWords.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-[10px] font-mono text-on-surface-variant uppercase tracking-wider mt-2.5">
            <span>STATUS</span>
            <span className="text-success flex items-center gap-1 font-bold">
              <CheckCircle2 size={10} /> {status}
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}
