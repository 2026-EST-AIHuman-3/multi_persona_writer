/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Edit3, Compass, Gamepad2, Film, CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";

interface LandingViewProps {
  onStartWriting: () => void;
}

export default function LandingView({ onStartWriting }: LandingViewProps) {
  return (
    <div className="flex-grow pt-24 px-margin-page w-full max-w-[1400px] mx-auto flex flex-col lg:flex-row gap-12 items-center justify-center min-h-[calc(100vh-80px)]">
      {/* Hero Text */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="lg:w-1/2 flex flex-col gap-8 pr-4 z-10"
      >
        <span className="text-[10px] font-mono tracking-[0.4em] text-secondary uppercase font-semibold">
          AI-Powered Persona Studio
        </span>
        <h1 className="font-serif text-4xl md:text-5xl text-ink max-w-[650px] leading-[1.3] font-normal italic break-keep">
          크리에이터를 위해,<br />
          아이디어 기획부터<br />
          초안 생성까지 지원하는<br />
          창작 콘텐츠 제작 도우미<br />
          <span className="font-serif italic font-semibold border-b border-secondary pb-1">AI 서비스</span>
        </h1>
        <p className="font-sans text-body-md text-on-surface-variant max-w-[500px] font-light break-keep leading-relaxed tracking-wide opacity-90">
          전문적인 시나리오 작가 페르소나와 정교한 LoRA 어댑터 기술이 만난 전용 에디토리얼 스튜디오 환경입니다. 창작의 맥락을 완벽히 보존하면서 다양한 작가 페르소나를 자유롭게 오가며 영감을 채우세요.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <button
            onClick={onStartWriting}
            className="border border-primary text-primary hover:bg-primary hover:text-on-primary text-xs font-bold tracking-[0.2em] uppercase px-8 py-4 transition-all cursor-pointer bg-transparent"
          >
            집필 시작하기
          </button>
        </div>
      </motion.div>

      {/* Visual Composition */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.1 }}
        className="lg:w-1/2 relative w-full h-[600px] flex items-center justify-center p-4"
      >
        {/* Abstract background graphic indicating studio space */}
        <div className="absolute inset-x-4 inset-y-12 bg-surface-warm border border-border-warm transform rotate-1 z-0 hidden lg:block overflow-hidden">
          <div className="w-full h-8 border-b border-border-warm flex items-center px-4 gap-2 opacity-50">
            <div className="w-1.5 h-1.5 bg-border-warm rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-border-warm rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-border-warm rounded-full"></div>
          </div>
        </div>

        {/* Central Editor Window Mock */}
        <div className="relative z-20 w-full max-w-[420px] bg-surface-warm border border-border-warm shadow-2xl p-7">
          <div className="font-mono text-[10px] text-muted-text mb-4 border-b border-border-warm pb-3 flex justify-between tracking-wider uppercase">
            <span>DRAFT: UNTITLED_v2</span>
            <span>01/08</span>
          </div>
          <div className="space-y-4 font-sans text-xs text-on-surface leading-loose tracking-wide">
            <p className="opacity-80">네온 불빛이 도시 하층 구역의 웅덩이로 스며들고 있었다. 태양의 온기를 잊은 지 오래된 황량한 복합 체계의 도시.</p>
            <div className="flex items-start gap-3 bg-[#1A1A1A] p-4 border-l border-secondary">
              <span className="text-secondary text-base mt-px select-none">✦</span>
              <p className="text-[11px] leading-relaxed text-on-surface">
                "그녀는 트렌치 코트의 칼라를 바짝 세웠지만, 산성 비가 섞인 스모그로부터 몸을 지킬 수는 없었다..." <span className="animate-pulse font-bold text-secondary">|</span>
              </p>
            </div>
          </div>
          <div className="mt-6 flex justify-between items-center pt-4 border-t border-border-warm text-[10px] font-mono">
            <span className="text-secondary uppercase tracking-widest">LORA: SCREENPLAY_V4</span>
            <span className="text-muted-text">352 words</span>
          </div>
        </div>

        {/* Floating Persona Cards */}
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute z-30 top-12 left-2 bg-surface-warm border border-primary p-3.5 shadow-xl transform -rotate-2 w-48"
        >
          <div className="flex items-center gap-2 mb-2">
            <Gamepad2 className="text-primary animate-pulse" size={12} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface">게임 작가</span>
          </div>
          <div className="font-mono text-[8px] text-secondary tracking-widest uppercase">
            LORA: RPG_QUEST_GEN
          </div>
        </motion.div>

        <motion.div
          animate={{ y: [0, 4, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          className="absolute z-10 bottom-16 right-4 bg-surface-warm border border-border-warm p-3.5 shadow-lg transform rotate-3 w-48 opacity-80 hover:opacity-100 transition-opacity"
        >
          <div className="flex items-center gap-2 mb-2">
            <Film className="text-tertiary" size={12} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface font-sans">영화 각본</span>
          </div>
          <div className="font-mono text-[8px] text-tertiary tracking-widest uppercase">
            LORA: SCREENPLAY_V1
          </div>
        </motion.div>

        {/* Evaluation Match Meter Float */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="absolute z-10 top-32 -right-4 bg-surface-dark text-on-primary border border-border-warm p-4 shadow-2xl transform rotate-1 w-56 hidden md:block text-xs"
        >
          <div className="font-mono text-[9px] text-on-surface-variant mb-2.5 flex justify-between uppercase tracking-wider">
            <span>스타일 일치율</span><span className="text-secondary font-bold">94%</span>
          </div>
          <div className="w-full bg-[#202020] h-[3px] mb-3.5 overflow-hidden">
            <div className="bg-secondary h-full w-[94%]"></div>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-mono tracking-widest text-on-surface-variant uppercase">
            <span className="w-1.5 h-1.5 bg-success inline-block"></span> 톤 일관성 우수
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
