"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Eye, EyeOff, ArrowRight, BookOpen, Feather, PenTool } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate login delay
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setIsLoading(false);
    
    // 로그인 쿠키 설정 (1일 유지)
    document.cookie = "isLoggedIn=true; path=/; max-age=86400";
    
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-bg-warm flex relative overflow-hidden">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-[55%] relative items-center justify-center overflow-hidden">
        {/* Background grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(var(--color-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-primary) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-bg-warm via-surface-warm to-bg-warm opacity-90" />

        {/* Decorative floating elements */}
        <div className="relative z-10 flex flex-col items-center gap-12 px-16 max-w-[600px]">
          {/* Floating writing cards */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative w-full"
          >
            {/* Top decorative card */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-6 -left-4 w-56 bg-surface-warm border border-border-warm p-5 shadow-xl transform -rotate-3 z-10"
            >
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="text-secondary" size={12} />
                <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-on-surface">소설가</span>
              </div>
              <p className="text-[10px] text-on-surface-variant leading-relaxed font-light">
                네온 불빛이 도시 하층 구역의 웅덩이로 스며들고 있었다...
              </p>
              <div className="mt-3 font-mono text-[8px] text-secondary tracking-widest uppercase">
                LoRA: LITERARY_DARK
              </div>
            </motion.div>

            {/* Main hero card */}
            <div className="relative bg-surface-warm border border-border-warm p-8 shadow-2xl mt-16 ml-8 z-20">
              <div className="font-mono text-[9px] text-muted-text mb-5 border-b border-border-warm pb-3 flex justify-between tracking-[0.3em] uppercase">
                <span>EDITORIAL STUDIO</span>
                <span className="text-secondary">v2.0</span>
              </div>
              <div className="space-y-4">
                <h2 className="font-serif italic text-2xl text-ink leading-tight">
                  당신만의 창작 세계에<br />
                  오신 것을 환영합니다
                </h2>
                <p className="text-[11px] text-on-surface-variant leading-relaxed font-light tracking-wide">
                  다양한 작가 페르소나와 함께 영감을 채워보세요.<br />
                  AI가 당신의 창작 파트너가 됩니다.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-border-warm flex items-center gap-3">
                <div className="flex -space-x-2">
                  <div className="w-6 h-6 bg-primary-container border border-border-warm rounded-full flex items-center justify-center">
                    <Feather size={10} className="text-primary" />
                  </div>
                  <div className="w-6 h-6 bg-secondary-container border border-border-warm rounded-full flex items-center justify-center">
                    <PenTool size={10} className="text-secondary" />
                  </div>
                  <div className="w-6 h-6 bg-primary-container border border-border-warm rounded-full flex items-center justify-center">
                    <BookOpen size={10} className="text-primary" />
                  </div>
                </div>
                <span className="text-[9px] text-muted-text font-mono tracking-wider">6 PERSONAS ACTIVE</span>
              </div>
            </div>

            {/* Bottom floating accent */}
            <motion.div
              animate={{ y: [0, 5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
              className="absolute -bottom-4 right-0 w-48 bg-surface-dark border border-border-warm p-4 shadow-lg transform rotate-2 z-10"
            >
              <div className="font-mono text-[9px] text-on-surface-variant mb-2 flex justify-between uppercase tracking-wider">
                <span>스타일 일치율</span>
                <span className="text-secondary font-bold">94%</span>
              </div>
              <div className="w-full bg-[#202020] h-[3px] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "94%" }}
                  transition={{ duration: 1.5, delay: 1 }}
                  className="bg-secondary h-full"
                />
              </div>
            </motion.div>
          </motion.div>

          {/* Branding text */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="text-center mt-8"
          >
            <span className="text-[9px] font-mono tracking-[0.5em] text-muted-text uppercase block mb-2">
              AI-POWERED CREATIVE WRITING
            </span>
            <p className="text-[11px] text-on-surface-variant font-light tracking-wide leading-relaxed max-w-[360px]">
              전문적인 시나리오 작가 페르소나와 정교한 LoRA 어댑터 기술이 만난 전용 에디토리얼 스튜디오
            </p>
          </motion.div>
        </div>

        {/* Edge gradient fade to right panel */}
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-bg-warm to-transparent z-30" />
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-16 relative">
        {/* Subtle corner accent */}
        <div className="absolute top-8 right-8 w-16 h-16 border-t border-r border-border-warm opacity-40" />
        <div className="absolute bottom-8 left-8 w-16 h-16 border-b border-l border-border-warm opacity-40 lg:hidden" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="w-full max-w-[400px]"
        >
          {/* Logo */}
          <div className="mb-12">
            <div className="font-serif italic text-2xl text-primary tracking-tight font-semibold mb-2">
              Persona Writer
            </div>
            <span className="text-[9px] font-mono tracking-[0.4em] text-muted-text uppercase block">
              EDITORIAL STUDIO — SIGN IN
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Email field */}
            <div className="relative">
              <label
                htmlFor="login-email"
                className={`block text-[9px] font-bold mb-2 font-mono tracking-[0.3em] uppercase transition-colors duration-200 ${
                  focusedField === "email" ? "text-primary" : "text-muted-text"
                }`}
              >
                이메일
              </label>
              <div className="relative">
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  className={`w-full bg-transparent border-b-2 pb-3 pt-1 text-sm text-on-surface focus:outline-none transition-colors duration-300 placeholder:text-[#333] font-light tracking-wide ${
                    focusedField === "email"
                      ? "border-primary"
                      : "border-border-warm hover:border-outline"
                  }`}
                  placeholder="name@example.com"
                />
                <motion.div
                  className="absolute bottom-0 left-0 h-[2px] bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: focusedField === "email" ? "100%" : "0%" }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {/* Password field */}
            <div className="relative">
              <label
                htmlFor="login-password"
                className={`block text-[9px] font-bold mb-2 font-mono tracking-[0.3em] uppercase transition-colors duration-200 ${
                  focusedField === "password" ? "text-primary" : "text-muted-text"
                }`}
              >
                비밀번호
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  className={`w-full bg-transparent border-b-2 pb-3 pt-1 text-sm text-on-surface focus:outline-none transition-colors duration-300 placeholder:text-[#333] font-light tracking-wide pr-10 ${
                    focusedField === "password"
                      ? "border-primary"
                      : "border-border-warm hover:border-outline"
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-text hover:text-primary transition-colors cursor-pointer p-1"
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <motion.div
                  className="absolute bottom-0 left-0 h-[2px] bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: focusedField === "password" ? "100%" : "0%" }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer group" htmlFor="remember-me">
                <input
                  id="remember-me"
                  type="checkbox"
                  className="w-3.5 h-3.5 appearance-none border border-outline bg-transparent checked:bg-primary checked:border-primary cursor-pointer transition-colors relative
                  after:content-[''] after:absolute after:top-[1px] after:left-[3.5px] after:w-[5px] after:h-[8px] after:border-r-[1.5px] after:border-b-[1.5px] after:border-on-primary after:rotate-45 after:opacity-0 checked:after:opacity-100"
                />
                <span className="text-[10px] text-muted-text group-hover:text-on-surface-variant transition-colors tracking-wide">
                  로그인 유지
                </span>
              </label>
              <button
                type="button"
                className="text-[10px] text-muted-text hover:text-primary transition-colors tracking-wide cursor-pointer"
              >
                비밀번호 찾기
              </button>
            </div>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={`w-full mt-4 border text-[10px] font-bold tracking-[0.3em] uppercase py-4 transition-all duration-300 cursor-pointer flex items-center justify-center gap-3 group ${
                isLoading
                  ? "bg-primary/20 border-primary/40 text-primary/60 cursor-wait"
                  : "bg-primary border-primary text-on-primary hover:bg-transparent hover:text-primary"
              }`}
            >
              {isLoading ? (
                <>
                  <motion.div
                    className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                  <span>인증 중...</span>
                </>
              ) : (
                <>
                  <span>로그인</span>
                  <ArrowRight
                    size={14}
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  />
                </>
              )}
            </motion.button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-border-warm" />
            <span className="text-[9px] font-mono text-muted-text tracking-[0.3em] uppercase">
              OR
            </span>
            <div className="flex-1 h-px bg-border-warm" />
          </div>

          {/* Register link */}
          <div className="text-center">
            <p className="text-[11px] text-muted-text tracking-wide">
              아직 계정이 없으신가요?{" "}
              <button className="text-primary hover:underline underline-offset-4 font-medium cursor-pointer transition-colors tracking-wider">
                회원가입
              </button>
            </p>
          </div>

          {/* Footer */}
          <div className="mt-16 pt-6 border-t border-border-warm">
            <p className="text-[9px] text-muted-text font-mono tracking-wider text-center leading-relaxed">
              © 2026 PERSONA WRITER STUDIO — ALL RIGHTS RESERVED
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
