"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from "react";
import { Plus, X } from "lucide-react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import LandingView from "@/components/LandingView";
import ArchiveView from "@/components/ArchiveView";
import EditorView from "@/components/EditorView";
import ComparisonView from "@/components/ComparisonView";
import { Persona, Manuscript } from "@/types";

export default function Home() {
  // Tabs: landing, editor, archive, comparison
  const [currentTab, setCurrentTab] = useState<'landing' | 'editor' | 'archive' | 'comparison'>('landing');
  const [activePersonaId, setActivePersonaId] = useState<string>('novel');
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [selectedManuscript, setSelectedManuscript] = useState<Manuscript | null>(null);

  // Dynamic Modals
  const [showCreatePersonaModal, setShowCreatePersonaModal] = useState(false);

  // Default Editorial Personas Base Preset
  const [personas, setPersonas] = useState<Persona[]>([
    {
      id: "novel",
      name: "소설가",
      loraAdapter: "LoRA: LITERARY_DARK",
      icon: "novel",
      description: "고전적 서사, 소설적이고 사색적인 풍성한 문장 묘사, 매혹적인 캐릭터 서술에 최적화된 문학 페르소나입니다.",
      recommendedTasks: ["장편 소설 한 대목", "단편 전개", "심리 묘사 아웃풋"],
      defaultConfig: { temperature: 0.8, topP: 0.95, presencePenalty: 0.5 }
    },
    {
      id: "movie",
      name: "영화 시나리오",
      loraAdapter: "LoRA: Noir_v3",
      icon: "movie",
      description: "대사와 지문, 명확한 신 구성([SCENE START]), 긴장감 넘치는 장르적 어조에 최적화된 시나리오 작가 페르소나입니다.",
      recommendedTasks: ["독백(V.O.) 씬", "신(Scene) 분할 지문", "등장인물 간의 고밀도 갈등 대사"],
      defaultConfig: { temperature: 0.7, topP: 0.9, presencePenalty: 0.4 }
    },
    {
      id: "game",
      name: "게임 시나리오",
      loraAdapter: "LoRA: Qwen3_Game_500_Final",
      icon: "game",
      description: "퀘스트 대화 트리, 분기 스크립트, 게임 세계관 NPC 및 상호작용 문답 구조에 최적화된 게이밍 라이터 페르소나입니다.",
      recommendedTasks: ["NPC 선택지 대사", "퀘스트 설명 스크립트", "게임 시스템 로그 풍 기사"],
      defaultConfig: { temperature: 0.5, topP: 0.8, presencePenalty: 0.65 }
    },
    {
      id: "game-50",
      name: "게임 시나리오 50",
      loraAdapter: "LoRA: Qwen3_Game_Checkpoint_50",
      icon: "game",
      description: "50 스텝 체크포인트 LoRA를 테스트하기 위한 게임 시나리오 페르소나입니다.",
      recommendedTasks: ["50 체크포인트 응답 비교", "게임 시나리오 진행 테스트", "한국어 안정성 확인"],
      defaultConfig: { temperature: 0.5, topP: 0.8, presencePenalty: 0.65 }
    },
    {
      id: "game-500",
      name: "게임 시나리오 500",
      loraAdapter: "LoRA: Qwen3_Game_500_Final",
      icon: "game",
      description: "500개 데이터 기반 최종 LoRA를 테스트하기 위한 게임 시나리오 페르소나입니다.",
      recommendedTasks: ["최종 LoRA 응답 비교", "게임 시나리오 진행 테스트", "반복/깨짐 확인"],
      defaultConfig: { temperature: 0.5, topP: 0.8, presencePenalty: 0.65 }
    },
    {
      id: "ad",
      name: "광고 카피",
      loraAdapter: "LoRA: Luxury_Brand_Voice",
      icon: "ad",
      description: "소리 없이 시선을 사로잡는 세련됨, 브랜드 고유의 프리미엄 에디토리얼 어조 및 감각적 슬로건 기구에 어울리는 광고 페르소나입니다.",
      recommendedTasks: ["인스타그램 광고 문구", "브랜드 마케팅 슬로건", "감성 제품 에세이"],
      defaultConfig: { temperature: 0.85, topP: 0.95, presencePenalty: 0.6 }
    }
  ]);

  // Form states for dynamic "Create Persona"
  const [newPersonaName, setNewPersonaName] = useState("");
  const [newPersonaAdapter, setNewPersonaAdapter] = useState("LoRA: Custom_Tune_V1");
  const [newPersonaDesc, setNewPersonaDesc] = useState("");
  const [newPersonaIcon, setNewPersonaIcon] = useState("novel");

  // Load manuscripts on mount
  useEffect(() => {
    fetchManuscripts();
  }, []);

  // 1. Fetch Manuscripts API
  const fetchManuscripts = async () => {
    try {
      const res = await fetch("/api/manuscripts");
      if (res.ok) {
        const data = await res.json();
        setManuscripts(data);
      }
    } catch (e) {
      console.error("Failed to fetch manuscripts from server, utilizing fallback.", e);
    }
  };

  // 2. Save Manuscript API (Create / Update)
  const handleSaveManuscript = async (manuscriptData: Partial<Manuscript>) => {
    try {
      const res = await fetch("/api/manuscripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manuscriptData)
      });
      if (res.ok) {
        const saved = await res.json();
        // Update local list
        setManuscripts(prev => {
          const idx = prev.findIndex(m => m.id === saved.id);
          if (idx !== -1) {
            const copy = [...prev];
            copy[idx] = saved;
            return copy;
          }
          return [saved, ...prev];
        });
        setSelectedManuscript(saved);
        // Toast style transition
        alert(`원고 "${saved.title}" 가 안전하게 아카이브에 저장되었습니다!`);
        setCurrentTab('archive');
      }
    } catch (e) {
      console.error("Save failed", e);
      alert("원고 저장 도중 예기치 못한 에러가 발생했습니다.");
    }
  };

  // 3. Generate Manuscript using backend Gemini API Proxy
  const handleGenerateManuscript = async (promptText: string, config: any): Promise<string> => {
    try {
      const res = await fetch("/api/generate-manuscript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          ...config
        })
      });
      if (res.ok) {
        const data = await res.json();
        return data.content;
      } else {
        throw new Error("서버 에러가 발생했습니다.");
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || "원고 자동 생성에 실패했습니다. API 키 구성을 확인해 주세요.");
      return "";
    }
  };

  // 5. Select manuscript to edit
  const handleSelectManuscript = (m: Manuscript) => {
    setSelectedManuscript(m);
    setActivePersonaId(m.personaId);
    setCurrentTab('editor');
  };

  // 6. Action for New Blank Draft
  const handleNewDraft = () => {
    setSelectedManuscript(null);
    setCurrentTab('editor');
  };

  // 7. Dynamic Persona Creator Submission
  const handleCreatePersonaSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!newPersonaName.trim()) return;

    const newId = `custom-${Date.now()}`;
    const newPersona: Persona = {
      id: newId,
      name: newPersonaName,
      loraAdapter: newPersonaAdapter,
      icon: newPersonaIcon,
      description: newPersonaDesc || "사용자가 직접 커스터마이징한 에디스 스타일의 AI 창작 모델입니다.",
      recommendedTasks: ["사용자 정의 에세이", "특수 구조 텍스트", "맞춤형 지시"],
      defaultConfig: { temperature: 0.75, topP: 0.9, presencePenalty: 0.3 }
    };

    setPersonas(prev => [...prev, newPersona]);
    setActivePersonaId(newId);
    setShowCreatePersonaModal(false);
    
    // Reset forms
    setNewPersonaName("");
    setNewPersonaAdapter("LoRA: Custom_Tune_V1");
    setNewPersonaDesc("");
    setNewPersonaIcon("novel");

    alert(`페르소나 "${newPersonaName}" 라이터가 스튜디오 세션에 등록되었습니다!`);
  };

  return (
    <div className="bg-bg-warm text-on-surface font-sans min-h-screen flex flex-col relative overflow-x-hidden selection:bg-surface-container-highest">
      {/* Header element */}
      <Header 
        currentTab={currentTab} 
        onChangeTab={setCurrentTab} 
        onNewDraft={handleNewDraft} 
      />

      <div className="flex flex-1 pt-16 min-h-[calc(100vh-64px)] w-full">
        {/* Sidebar Left panel (Visible on workspace views except landing) */}
        {currentTab !== 'landing' && (
          <Sidebar 
            personas={personas} 
            activePersonaId={activePersonaId} 
            onSelectPersona={setActivePersonaId} 
            onOpenCreateModal={() => setShowCreatePersonaModal(true)}
          />
        )}

        {/* Dynamic Nav Tabs Rendering Content Canvas */}
        {currentTab === 'landing' ? (
          <LandingView 
            onStartWriting={handleNewDraft}
          />
        ) : currentTab === 'archive' ? (
          <ArchiveView 
            manuscripts={manuscripts}
            personas={personas}
            onSelectManuscript={handleSelectManuscript}
          />
        ) : currentTab === 'editor' ? (
          <EditorView 
            manuscript={selectedManuscript}
            personas={personas}
            activePersonaId={activePersonaId}
            onSave={handleSaveManuscript}
            onGenerate={handleGenerateManuscript}
          />
        ) : currentTab === 'comparison' ? (
          <ComparisonView 
            personas={personas}
            onGenerate={handleGenerateManuscript}
          />
        ) : null}
      </div>

      {/* Dynamic Persona Creator Dialog / Modal */}
      {showCreatePersonaModal && (
        <div className="fixed inset-0 bg-panel-dark/85 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-bg-warm border border-border-warm rounded-none max-w-md w-full overflow-hidden text-on-surface shadow-2xl">
            <div className="p-6 border-b border-border-warm flex justify-between items-center bg-[#121212]">
              <div>
                <span className="text-[9px] font-mono tracking-[0.4em] text-secondary uppercase font-bold block mb-1">REGISTRATION</span>
                <h3 className="font-serif italic text-lg text-ink font-semibold">새 작가 페르소나 등록</h3>
              </div>
              <button 
                onClick={() => setShowCreatePersonaModal(false)}
                className="text-muted-text hover:text-primary transition-colors cursor-pointer border border-border-warm p-1.5 rounded-none"
              >
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleCreatePersonaSubmit} className="p-6 space-y-4 bg-bg-warm">
              <div>
                <label className="block text-[9px] font-bold text-muted-text mb-1.5 font-mono tracking-widest uppercase">작가명 (Persona Name)</label>
                <input 
                  required
                  value={newPersonaName}
                  onChange={(e) => setNewPersonaName(e.target.value)}
                  type="text" 
                  className="w-full bg-[#121212] border border-border-warm rounded-none p-3 focus:outline-none focus:border-primary text-xs"
                  placeholder="예: SF 장르 소설가, 현대 가전 마케터"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-muted-text mb-1.5 font-mono tracking-widest uppercase">LoRA 어댑터 튜닝 정보</label>
                <input 
                  value={newPersonaAdapter}
                  onChange={(e) => setNewPersonaAdapter(e.target.value)}
                  type="text" 
                  className="w-full bg-[#121212] border border-border-warm rounded-none p-3 focus:outline-none focus:border-primary font-mono text-[11px]"
                  placeholder="예: LoRA: Space_Future_0.9"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-muted-text mb-1.5 font-mono tracking-widest uppercase">아이콘 스타일 유형</label>
                <select 
                  value={newPersonaIcon}
                  onChange={(e) => setNewPersonaIcon(e.target.value)}
                  className="w-full bg-[#121212] border border-border-warm rounded-none p-3 text-xs focus:outline-none focus:border-primary text-on-surface"
                >
                  <option value="novel">소설가 대중 문학 (Book)</option>
                  <option value="movie">영화 및 극작 시나리오 (Film)</option>
                  <option value="game">게임 기획 및 대사 트리 (Game)</option>
                  <option value="ad">미디어 광고 카피라이팅 (Ad)</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-muted-text mb-1.5 font-mono tracking-widest uppercase">페르소나 설명 및 톤 정의</label>
                <textarea 
                  value={newPersonaDesc}
                  onChange={(e) => setNewPersonaDesc(e.target.value)}
                  className="w-full bg-[#121212] border border-border-warm rounded-none p-3 text-xs min-h-[90px] focus:outline-none focus:border-primary leading-relaxed"
                  placeholder="예: 주로 서술이 거칠고 디테일한 묘사를 지향합니다..."
                />
              </div>

              <div className="pt-5 border-t border-border-warm flex gap-3 justify-end text-[10px] font-bold tracking-widest uppercase">
                <button 
                  type="button"
                  onClick={() => setShowCreatePersonaModal(false)}
                  className="px-5 py-3 text-muted-text border border-border-warm bg-transparent hover:border-primary hover:text-primary rounded-none cursor-pointer transition-all"
                >
                  취소
                </button>
                <button 
                  type="submit"
                  className="px-6 py-3 bg-primary border border-primary text-on-primary rounded-none hover:bg-transparent hover:text-primary cursor-pointer transition-colors"
                >
                  등록하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
