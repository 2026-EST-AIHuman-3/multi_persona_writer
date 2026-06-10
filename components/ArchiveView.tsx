/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Search, Filter, BookOpen, Film, Gamepad2, Megaphone, ArrowUpRight, Trash2 } from "lucide-react";
import { Manuscript, ManuscriptStatus, Persona } from "@/types";

interface ArchiveViewProps {
  manuscripts: Manuscript[];
  personas: Persona[];
  onSelectManuscript: (manuscript: Manuscript) => void;
  onDelete?: (id: string) => void;
}

export default function ArchiveView({ manuscripts, personas, onSelectManuscript, onDelete }: ArchiveViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | "novel" | "script" | "other">("all");

  const getPersonaBadge = (personaId: string) => {
    const p = personas.find(x => x.id === personaId);
    if (!p) return { name: "알 수 없음", icon: <BookOpen size={12} /> };
    
    let icon = <BookOpen size={12} />;
    if (p.icon === 'game') icon = <Gamepad2 size={12} />;
    else if (p.icon === 'movie') icon = <Film size={12} />;
    else if (p.icon === 'ad') icon = <Megaphone size={12} />;

    return { name: p.name, icon };
  };

  const getStatusColor = (status: ManuscriptStatus) => {
    switch (status) {
      case "completed":
        return { bg: "bg-success", text: "완료됨" };
      case "draft":
        return { bg: "bg-warning", text: "초안 작성 중" };
      case "editing":
        return { bg: "bg-secondary", text: "수정 중" };
      default:
        return { bg: "bg-outline", text: "진행 중" };
    }
  };

  // Filtering manuscripts
  const filteredManuscripts = manuscripts.filter((m) => {
    // Search filter
    const matchesSearch = 
      m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.prompt.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // Category filter
    if (activeCategory === "all") return true;
    if (activeCategory === "novel") return m.personaId === "novel";
    if (activeCategory === "script") return m.personaId === "movie" || m.personaId === "game";
    if (activeCategory === "other") return m.personaId === "ad";

    return true;
  });

  return (
    <div className="flex-1 ml-0 md:ml-sidebar-width bg-bg-warm px-margin-page py-12 flex flex-col min-h-full overflow-y-auto">
      {/* Page Header & Search */}
      <div className="max-w-[1000px] w-full mx-auto mb-10 flex flex-col gap-6">
        <div>
          <span className="text-[9px] font-mono tracking-[0.4em] text-secondary uppercase font-bold">WRITING VAULT</span>
          <h1 className="font-serif italic text-3xl text-ink mt-1 font-semibold">원고 아카이브</h1>
        </div>
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-b border-border-warm pb-6">
          
          {/* Search Bar */}
          <div className="relative w-full md:w-96 flex items-center">
            <Search className="absolute left-3.5 text-muted-text" size={14} />
            <input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#121212] border border-border-warm focus:outline-none focus:border-secondary pl-11 pr-4 py-2.5 placeholder-muted-text text-xs rounded-none font-sans" 
              placeholder="원고 검색..." 
              type="text"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={() => setActiveCategory("all")}
              className={`px-4 py-2.5 border text-[9px] font-bold tracking-widest uppercase cursor-pointer transition-colors rounded-none ${
                activeCategory === "all"
                  ? "border-primary bg-primary text-on-primary"
                  : "border-border-warm text-on-surface-variant hover:border-primary hover:text-primary bg-transparent"
              }`}
            >
              모든 프로젝트
            </button>
            <button 
              onClick={() => setActiveCategory("novel")}
              className={`px-4 py-2.5 border text-[9px] font-bold tracking-widest uppercase cursor-pointer transition-colors rounded-none ${
                activeCategory === "novel"
                  ? "border-primary bg-primary text-on-primary"
                  : "border-border-warm text-on-surface-variant hover:border-primary hover:text-primary bg-transparent"
              }`}
            >
              소설
            </button>
            <button 
              onClick={() => setActiveCategory("script")}
              className={`px-4 py-2.5 border text-[9px] font-bold tracking-widest uppercase cursor-pointer transition-colors rounded-none ${
                activeCategory === "script"
                  ? "border-primary bg-primary text-on-primary"
                  : "border-border-warm text-on-surface-variant hover:border-primary hover:text-primary bg-transparent"
              }`}
            >
              시나리오
            </button>
            <button 
              onClick={() => setActiveCategory("other")}
              className={`px-4 py-2.5 border text-[9px] font-bold tracking-widest uppercase cursor-pointer transition-colors inline-flex items-center gap-1.5 rounded-none ${
                activeCategory === "other"
                  ? "border-primary bg-primary text-on-primary"
                  : "border-border-warm text-on-surface-variant hover:border-primary hover:text-primary bg-transparent"
              }`}
            >
              <Filter size={10} />
              광고/기타
            </button>
          </div>
        </div>
      </div>

      {/* Bento Grid Archive List */}
      <div className="max-w-[1000px] w-full mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-stack-gap pb-20">
        {filteredManuscripts.length === 0 ? (
          <div className="col-span-full py-20 text-center text-on-surface-variant opacity-60 font-serif italic text-sm">
            <p>검색 조건에 맞는 원고를 찾지 못했습니다.</p>
            <p className="text-xs font-sans not-italic mt-1.5 opacity-80">새 원고 버튼을 클릭해 첫 글작성을 시작해보세요.</p>
          </div>
        ) : (
          filteredManuscripts.map((m, index) => {
            const isFirst = index === 0;
            const badge = getPersonaBadge(m.personaId);
            const status = getStatusColor(m.status);

            return (
              <div 
                key={m.id}
                onClick={() => onSelectManuscript(m)}
                className={`bg-surface-warm border border-border-warm p-6 flex flex-col justify-between group hover:border-primary transition-all duration-200 cursor-pointer min-h-[220px] rounded-none relative ${
                  isFirst ? "lg:col-span-2 shadow-xl" : ""
                }`}
              >
                {/* 삭제 버튼 */}
                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`"${m.title}" 을(를) 삭제하시겠습니까?`)) onDelete(m.id);
                    }}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-muted-text hover:text-red-400 bg-transparent cursor-pointer"
                    title="삭제"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2 text-muted-text text-[10px] font-mono tracking-wider uppercase">
                    <span className={`w-1.5 h-1.5 ${status.bg}`}></span>
                    {status.text} · {m.createdAt}
                  </div>
                  {isFirst && (
                    <ArrowUpRight className="text-muted-text group-hover:text-primary transition-colors" size={14} />
                  )}
                </div>

                <div className="flex-grow">
                  <h3 className={`text-on-surface font-serif italic group-hover:text-primary transition-colors ${
                    isFirst ? "text-2xl font-normal" : "text-base font-semibold"
                  }`}>
                    {m.title}
                  </h3>
                  <p className="text-on-surface-variant text-xs line-clamp-2 mb-6 font-sans leading-relaxed mt-1 opacity-80">
                    {m.content || "빈 내용의 아카이브된 원고입니다."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-3 border-t border-border-warm/50">
                  <span className="bg-[#1A1A1A] px-2 py-1 border border-border-warm text-[9px] font-mono text-on-surface flex items-center gap-1.5 rounded-none uppercase">
                    {badge.name}
                  </span>
                  <span className="bg-[#1D1D1D] px-2 py-1 text-[9px] text-secondary font-mono border border-border-warm rounded-none uppercase">
                    {m.loraAdapter}
                  </span>
                  {m.wordCount > 0 && (
                    <span className="text-muted-text text-[9px] font-mono uppercase ml-auto">
                      {m.wordCount.toLocaleString()} words
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Embedded Simple Footer inside archive page */}
      <footer className="mt-auto max-w-[1000px] w-full mx-auto text-[10px] bg-bg-warm text-on-surface border-t border-border-warm py-12 flex flex-col md:flex-row justify-between items-center gap-stack-gap">
        <div className="font-serif italic text-base text-primary font-semibold">
          Persona Writer
        </div>
        <div className="text-muted-text font-mono text-center md:text-left">
          © 2026 PERSONA WRITER STUDIO. EDITORIAL AI CRAFT.
        </div>
        <div className="flex gap-6 font-mono text-muted-text uppercase tracking-widest text-[9px]">
          <a className="hover:text-primary transition-colors opacity-80" href="#privacy">PRIVACY</a>
          <a className="hover:text-primary transition-colors opacity-80" href="#tos">TERMS</a>
          <a className="hover:text-primary transition-colors opacity-80" href="#api">API docs</a>
        </div>
      </footer>
    </div>
  );
}
