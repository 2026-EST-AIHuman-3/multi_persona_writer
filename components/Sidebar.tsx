/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BookOpen, Gamepad2, Film, Megaphone, HelpCircle, Settings } from "lucide-react";
import { Persona } from "@/types";

interface SidebarProps {
  personas: Persona[];
  activePersonaId: string;
  onSelectPersona: (id: string) => void;
  onOpenCreateModal?: () => void;
}

export default function Sidebar({ personas, activePersonaId, onSelectPersona, onOpenCreateModal }: SidebarProps) {
  // Map icon strings to Lucide components
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'game': return <Gamepad2 size={14} />;
      case 'movie': return <Film size={14} />;
      case 'novel': return <BookOpen size={14} />;
      case 'ad': return <Megaphone size={14} />;
      default: return <BookOpen size={14} />;
    }
  };

  return (
    <aside className="hidden md:flex flex-col bg-bg-warm fixed left-0 top-16 h-[calc(100vh-64px)] w-sidebar-width border-r border-border-warm py-8 px-5 z-40">
      {/* Profile/Persona header */}
      <div className="mb-8 px-1 flex flex-col gap-3">
        <div className="h-10 w-10 bg-[#1A1A1A] rounded-full flex items-center justify-center mb-1 overflow-hidden border border-border-warm">
          <img 
            alt="Abstract dark avatar" 
            className="w-full h-full object-cover opacity-80" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCvh3FN0lTkL1218XTH3eYi7iN4nq16EphxRPWuPIQUPH9iB2QeOPHx1PjHgpG_tAggQCcEd0IPSzav6-Pm40EeiKHmWPaDdN3LtrKyM6et7wcX-CtkcDKBR08oFlsD59Dd7vvMcOcBiYaJYnZYMG0YUoqnsvoBenoK1bFUSzgYHYQrFgIIKLGI_BStkLXkJHkoA8EQpHR1Tz5z_6S4scElxiTAPiMVMoJBtOAfob22dvpqztLmRiXrsJT9dJgtWPQuTAFnT3zKV1oh"
          />
        </div>
        <div>
          <h2 className="text-[10px] font-bold tracking-[0.3em] uppercase text-on-surface opacity-80">작가 페르소나</h2>
          <span className="text-[10px] font-mono text-on-surface-variant opacity-60">Issue No. 08</span>
        </div>
      </div>

      {/* Nav Link Lists */}
      <nav className="flex-1 flex flex-col gap-1">
        {personas.map((persona) => {
          const isActive = persona.id === activePersonaId;
          return (
            <button
              key={persona.id}
              onClick={() => onSelectPersona(persona.id)}
              className={`flex items-center gap-3 px-3 py-3 transition-all duration-200 ease-in-out font-medium text-xs text-left cursor-pointer border-l ${
                isActive
                  ? 'bg-primary-container text-on-primary-container border-primary font-semibold'
                  : 'text-on-surface-variant border-transparent hover:text-primary hover:bg-surface-warm'
              }`}
            >
              <span className={isActive ? 'text-on-primary-container' : 'text-on-surface-variant'}>
                {getIcon(persona.icon)}
              </span>
              <span className="tracking-wide">{persona.name}</span>
            </button>
          )
        })}
      </nav>

      {/* Footer Nav inside sidebar */}
      <div className="mt-auto flex flex-col gap-4">

        <div className="border-t border-border-warm pt-4 flex flex-col gap-0.5">
          <a className="flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:text-primary transition-all rounded text-[10px] font-bold tracking-widest uppercase" href="#help">
            <HelpCircle size={12} />
            도움말
          </a>
          <a className="flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:text-primary transition-all rounded text-[10px] font-bold tracking-widest uppercase" href="#settings">
            <Settings size={12} />
            설정
          </a>
        </div>
      </div>
    </aside>
  );
}
