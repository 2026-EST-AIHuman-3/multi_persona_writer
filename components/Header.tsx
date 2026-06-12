"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BookOpen, HelpCircle, Settings, User } from "lucide-react";
import { useRouter } from "next/navigation";

interface HeaderProps {
  currentTab: 'landing' | 'editor' | 'archive' | 'comparison';
  onChangeTab: (tab: 'landing' | 'editor' | 'archive' | 'comparison') => void;
  onNewDraft: () => void;
}

export default function Header({ currentTab, onChangeTab, onNewDraft }: HeaderProps) {
  const router = useRouter();

  const handleLogout = () => {
    if (confirm("로그아웃 하시겠습니까?")) {
      document.cookie = "isLoggedIn=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      router.push("/login");
    }
  };
  return (
    <header className="bg-bg-warm border-b border-border-warm flex justify-between items-center px-margin-page h-16 w-full fixed top-0 z-50">
      <div className="flex items-center gap-10">
        <div 
          onClick={() => onChangeTab('landing')}
          className="font-serif italic text-xl text-primary cursor-pointer tracking-tight hover:opacity-90 font-semibold"
        >
          Persona Writer
        </div>
        <nav className="hidden md:flex gap-8 items-center h-full">
          <button
            onClick={() => onChangeTab('archive')}
            className={`text-[10px] font-bold tracking-[0.3em] h-full transition-colors uppercase py-5 leading-none select-none border-b ${
              currentTab === 'archive'
                ? 'text-primary border-primary'
                : 'text-on-surface-variant border-transparent hover:text-primary'
            }`}
          >
            아카이브
          </button>

          <button
            onClick={() => onChangeTab('editor')}
            className={`text-[10px] font-bold tracking-[0.3em] h-full transition-colors uppercase py-5 leading-none select-none border-b ${
              currentTab === 'editor'
                ? 'text-primary border-primary'
                : 'text-on-surface-variant border-transparent hover:text-primary'
            }`}
          >
            LORA 라이브러리 (집필)
          </button>
        </nav>
      </div>

      <div className="flex items-center gap-6">
        <button 
          onClick={onNewDraft}
          className="border border-primary text-primary text-[10px] uppercase tracking-[0.2em] font-bold px-5 py-2.5 transition-colors cursor-pointer hover:bg-primary hover:text-on-primary bg-transparent"
        >
          새 원고 작성
        </button>
        <div className="flex items-center gap-3 text-on-surface-variant border-l border-border-warm pl-4">
          <button 
            onClick={handleLogout}
            className="hover:text-primary transition-colors p-1.5 hover:bg-surface-warm rounded"
            title="로그아웃"
          >
            <User size={15} />
          </button>
          <button className="hover:text-primary transition-colors p-1.5 hover:bg-surface-warm rounded">
            <Settings size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
