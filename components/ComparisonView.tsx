/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { ArrowLeftRight, Check, Download } from "lucide-react";
import { Persona } from "@/types";

interface ComparisonViewProps {
  personas: Persona[];
  onGenerate: (prompt: string, config: any) => Promise<string>;
}

export default function ComparisonView({ personas, onGenerate }: ComparisonViewProps) {
  const modelA = personas.find(p => p.id === 'movie') || personas[0];
  const modelB = personas.find(p => p.id === 'novel') || personas[1] || personas[0];

  const [prompt, setPrompt] = useState("NEO-NOIR INTRO SEQUENCE. Create a cynical, atmosphere-heavy opening in an alley.");
  
  // States
  const [contentA, setContentA] = useState<string>(
    `[SCENE START]\n\nEXT. CITY STREETS - NIGHT\n\nRain slicks the asphalt, reflecting the sickly neon of a dying diner sign. Detective MARLOWE (40s, trench coat permanently stained with cheap coffee and regret) stands under the broken awning.\n\nHe sparks a match. The flare illuminates his craggy features for a split second before the downpour claims it.\n\nMARLOWE (V.O.)\nThis city doesn't sleep. It just lies there with its eyes open, waiting for someone to make a mistake.\n\n[SCENE END]`
  );
  const [contentB, setContentB] = useState<string>(
    `The city wept that night, a relentless, driving rain that turned the streets into obsidian mirrors. Under the stuttering neon hum of a forgotten diner, Elias stood motionless.\n\nHis coat, heavy with the deluge, clung to him like a second skin woven from old mistakes. He reached into his pocket, retrieving a crumpled pack and a solitary match.\n\nThe brief flare of sulfur painted his weathered face in harsh, unforgiving light—a fleeting portrait of a man entirely consumed by the shadows around him. The city, he mused silently, never truly slept; it merely waited, insomniac and predatory, for the next poor soul to stumble.`
  );

  const [isComparing, setIsComparing] = useState(false);
  


  // Triggers Generation in Parallel for both selected models!
  const handleCompareGenerate = async () => {
    if (!prompt.trim()) return;
    setIsComparing(true);

    
    try {
      // Parallel execution via Promise.all
      const [resA, resB] = await Promise.all([
        onGenerate(prompt, {
          personaName: modelA.name,
          personaDesc: modelA.description,
          loraAdapter: modelA.loraAdapter,
          temperature: 0.7,
          topP: 0.9,
          presencePenalty: 0.4
        }),
        onGenerate(prompt, {
          personaName: modelB.name,
          personaDesc: modelB.description,
          loraAdapter: modelB.loraAdapter,
          temperature: 0.8,
          topP: 0.95,
          presencePenalty: 0.5
        })
      ]);

      setContentA(resA);
      setContentB(resB);


    } catch (e: any) {
      console.error(e);
    } finally {
      setIsComparing(false);
    }
  };

  const [exportSuccess, setExportSuccess] = useState(false);

  const handleExport = () => {
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 2000);
  };

  return (
    <div className="flex-1 ml-0 md:ml-sidebar-width bg-bg-warm h-[calc(100vh-64px)] flex overflow-hidden">
      
      {/* Main Comparison Canvas */}
      <div className="flex-1 p-margin-page flex flex-col gap-6 overflow-y-auto font-sans text-on-surface">
        <header className="flex justify-between items-end mb-4 border-b border-border-warm pb-4">
          <div>
            <span className="text-[9px] font-mono tracking-[0.4em] text-secondary uppercase font-bold">PARALLEL EXPERIMENT</span>
            <h1 className="font-serif italic text-3xl text-ink mt-1 font-semibold">대조 분석</h1>
            <p className="font-mono text-[9px] text-muted-text mt-2 tracking-wider uppercase">
              RUN_ID: 8847-EVAL-X // CONF: TWO_COMPANIONS_V2
            </p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={handleExport}
              className="px-4 py-2.5 border border-primary text-primary font-bold text-[10px] uppercase tracking-widest rounded-none hover:bg-primary hover:text-on-primary transition-colors cursor-pointer flex items-center gap-2 bg-transparent"
            >
              {exportSuccess ? <Check size={12} /> : <Download size={12} />}
              <span>데이터 내보내기</span>
            </button>
          </div>
        </header>

        {/* Dynamic Prompt Trigger for Parallel Comparison */}
        <div className="bg-[#121212] p-4 rounded-none border border-border-warm flex gap-4 items-center">
          <input 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="flex-1 bg-[#1A1A1A] text-on-surface border border-border-warm focus:outline-none focus:border-secondary p-3 rounded-none font-sans text-xs placeholder-muted-text"
            placeholder="동일한 프롬프트로 여러 페르소나의 동시 창작을 비교해 보세요..."
          />
          <button 
            disabled={isComparing || !prompt.trim()}
            onClick={handleCompareGenerate}
            className={`border border-[#3A3A3A] text-on-surface hover:text-primary hover:border-primary text-[10px] font-bold tracking-[0.2em] px-5 py-3 uppercase transition-all bg-transparent rounded-none cursor-pointer ${
              (isComparing || !prompt.trim()) ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <ArrowLeftRight size={12} className={isComparing ? "animate-spin" : ""} />
            <span>{isComparing ? "LORA SYNCHRONIZING..." : "대조 창작 시작"}</span>
          </button>
        </div>

        {/* 2-Columns grid representing model outputs */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-gutter h-full">
          
          {/* Persona 1 Output (Movie) */}
          <div className="bg-surface-warm rounded-none border border-border-warm flex flex-col overflow-hidden max-h-[500px]">
            <div className="p-4 border-b border-border-warm bg-[#0D0D0D] flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="text-secondary text-sm">✦</span>
                <h3 className="font-serif italic text-base text-ink font-semibold">{modelA.name}</h3>
              </div>
              <span className="px-2.5 py-1 bg-transparent border border-border-warm text-on-surface-variant font-mono text-[9px] uppercase tracking-widest rounded-none">
                {modelA.loraAdapter}
              </span>
            </div>
            <div className="p-6 overflow-y-auto flex-1 font-serif text-sm text-on-surface leading-loose select-all whitespace-pre-wrap">
              {contentA}
            </div>
          </div>

          {/* Persona 2 Output (Novel) */}
          <div className="bg-surface-warm rounded-none border border-border-warm flex flex-col overflow-hidden max-h-[500px]">
            <div className="p-4 border-b border-border-warm bg-[#0D0D0D] flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="text-secondary text-sm">✦</span>
                <h3 className="font-serif italic text-base text-ink font-semibold">{modelB.name}</h3>
              </div>
              <span className="px-2.5 py-1 bg-transparent border border-border-warm text-on-surface-variant font-mono text-[9px] uppercase tracking-widest rounded-none">
                {modelB.loraAdapter}
              </span>
            </div>
            <div className="p-6 overflow-y-auto flex-1 font-serif text-sm text-on-surface leading-loose select-all whitespace-pre-wrap">
              {contentB}
            </div>
          </div>
        </div>
      </div>


    </div>
  );
}
