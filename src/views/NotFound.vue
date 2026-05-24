<template>
  <!-- Main Content Container -->
  <main class="flex items-center justify-center px-6 py-16">
    <div class="vt-glass max-w-2xl w-full rounded-2xl p-8 sm:p-12 text-center flex flex-col items-center">
        
        <!-- Premium Deliberation/Construction SVG Illustration -->
        <div class="relative w-full max-w-[320px] mb-8 select-none">
          <svg viewBox="0 0 240 200" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto drop-shadow-xl">
            <!-- Background Soft Glows -->
            <circle cx="120" cy="100" r="80" fill="url(#bg-glow)" opacity="0.4" />
            
            <!-- Isometric Network Grid Lines -->
            <path d="M120 20 L200 66 L200 154 L120 200 L40 154 L40 66 Z" stroke="url(#grid-gradient)" stroke-width="1.5" stroke-dasharray="4,4" />
            <path d="M120 20 L120 200" stroke="url(#grid-gradient)" stroke-width="1" opacity="0.3" />
            <path d="M40 66 L200 154" stroke="url(#grid-gradient)" stroke-width="1" opacity="0.3" />
            <path d="M40 154 L200 66" stroke="url(#grid-gradient)" stroke-width="1" opacity="0.3" />

            <!-- Core deliberation prism / platform being built -->
            <g class="assembling-prism">
              <!-- Left wall of prism -->
              <path d="M120 100 L70 70 L70 130 L120 160 Z" fill="#008888" fill-opacity="0.75" />
              <!-- Right wall of prism -->
              <path d="M120 100 L170 70 L170 130 L120 160 Z" fill="#d80000" fill-opacity="0.7" />
              <!-- Top wall of prism -->
              <path d="M120 40 L170 70 L120 100 L70 70 Z" fill="#db7700" fill-opacity="0.85" />
            </g>

            <!-- Large Deliberation Gear (Coordinating) -->
            <g class="gear-large">
              <circle cx="65" cy="140" r="22" fill="#0b0b0c" stroke="#008888" stroke-width="3" />
              <!-- Gear teeth -->
              <path d="M65 113 L65 120" stroke="#008888" stroke-width="4" stroke-linecap="round" />
              <path d="M65 160 L65 167" stroke="#008888" stroke-width="4" stroke-linecap="round" />
              <path d="M38 140 L45 140" stroke="#008888" stroke-width="4" stroke-linecap="round" />
              <path d="M85 140 L92 140" stroke="#008888" stroke-width="4" stroke-linecap="round" />
              <path d="M46 121 L51 126" stroke="#008888" stroke-width="4" stroke-linecap="round" />
              <path d="M79 154 L84 159" stroke="#008888" stroke-width="4" stroke-linecap="round" />
              <path d="M46 159 L51 154" stroke="#008888" stroke-width="4" stroke-linecap="round" />
              <path d="M79 121 L84 126" stroke="#008888" stroke-width="4" stroke-linecap="round" />
              <!-- Inner center -->
              <circle cx="65" cy="140" r="8" fill="#e0e0e0" />
            </g>

            <!-- Small Tech Wrench / Gear (Democratic Red) -->
            <g class="gear-small">
              <circle cx="170" cy="65" r="14" fill="#0b0b0c" stroke="#d80000" stroke-width="2.5" />
              <!-- Teeth -->
              <path d="M170 48 L170 53" stroke="#d80000" stroke-width="3" />
              <path d="M170 77 L170 82" stroke="#d80000" stroke-width="3" />
              <path d="M153 65 L158 65" stroke="#d80000" stroke-width="3" />
              <path d="M182 65 L187 65" stroke="#d80000" stroke-width="3" />
              <!-- Inner center -->
              <circle cx="170" cy="65" r="5" fill="#f8f8f8" />
            </g>

            <!-- Deliberative nodes / citizens' opinion bubbles (floating/assembling) -->
            <g class="float-bubble bubble-1">
              <circle cx="50" cy="50" r="10" fill="#db7700" fill-opacity="0.9" />
              <!-- mini text line inside bubble -->
              <path d="M45 50 H55" stroke="white" stroke-width="1.5" stroke-linecap="round" />
            </g>

            <g class="float-bubble bubble-2">
              <circle cx="190" cy="125" r="12" fill="#008888" fill-opacity="0.9" />
              <path d="M184 123 H196 M186 127 H194" stroke="white" stroke-width="1.5" stroke-linecap="round" />
            </g>

            <g class="float-bubble bubble-3">
              <circle cx="120" cy="180" r="8" fill="#d80000" fill-opacity="0.95" />
              <!-- checkmark -->
              <path d="M117 180 L119 182 L123 178" stroke="white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
            </g>

            <!-- Definitions of Gradients -->
            <defs>
              <radialGradient id="bg-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#008888" stop-opacity="0.3" />
                <stop offset="60%" stop-color="#d80000" stop-opacity="0.1" />
                <stop offset="100%" stop-color="#db7700" stop-opacity="0" />
              </radialGradient>
              <linearGradient id="grid-gradient" x1="40" y1="20" x2="200" y2="200">
                <stop offset="0%" stop-color="#d80000" stop-opacity="0.6" />
                <stop offset="50%" stop-color="#db7700" stop-opacity="0.5" />
                <stop offset="100%" stop-color="#008888" stop-opacity="0.6" />
              </linearGradient>
            </defs>
          </svg>
          
          <!-- Modern Floating Crane or Deliberation Crane beam -->
          <div class="absolute top-[10%] right-[32%] w-1.5 h-16 bg-gradient-to-b from-wheat-yellow to-transparent animate-pulse-line"></div>
        </div>

        <!-- Big Bold Title and Subtitle -->
        <h1 class="text-4xl sm:text-5xl font-extrabold text-ink tracking-tight mb-4 font-sans">
          施工中<span class="text-democratic-red">...</span>
        </h1>
        <p class="text-lg sm:text-xl font-medium text-vt-gray-700 max-w-md mx-auto mb-3 font-sans">
          數位民主空間建設中！
        </p>
        <p class="text-sm sm:text-base text-vt-gray-400 max-w-lg mx-auto mb-10">
          您所存取的頁面屬於 <span class="font-semibold text-ink font-sans">vue.vTaiwan-neo</span> 的新版規劃項目。
          我們正在 Hono 輕量化架構上重整此區塊，敬請期待更極速流暢的公共政策協作體驗。
        </p>

        <!-- Navigation Buttons -->
        <div class="flex flex-col sm:flex-row gap-4 w-full sm:w-auto font-sans">
          <RouterLink to="/" class="vt-btn vt-btn-primary justify-center">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回首頁
          </RouterLink>
          <RouterLink to="/#explore" class="vt-btn vt-btn-outline border-vt-gray-400 hover:border-ink hover:text-ink text-vt-gray-700 justify-center">
            瀏覽已開放的範例
          </RouterLink>
        </div>
    </div>
  </main>
</template>

<style scoped>
/* Scoped keyframes for visual Wow-factor */
@keyframes spin-clock {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes spin-counter {
  from { transform: rotate(360deg); }
  to { transform: rotate(0deg); }
}

@keyframes float-p {
  0% { transform: translateY(0px) scale(1); }
  50% { transform: translateY(-8px) scale(1.03); }
  100% { transform: translateY(0px) scale(1); }
}

@keyframes assemble-pulse {
  0% { transform: scale(0.98); opacity: 0.9; }
  50% { transform: scale(1.02); opacity: 1; }
  100% { transform: scale(0.98); opacity: 0.9; }
}

.gear-large {
  transform-origin: 65px 140px;
  animation: spin-clock 12s linear infinite;
}

.gear-small {
  transform-origin: 170px 65px;
  animation: spin-counter 8s linear infinite;
}

.assembling-prism {
  transform-origin: 120px 100px;
  animation: assemble-pulse 4s ease-in-out infinite;
}

.bubble-1 {
  transform-origin: 50px 50px;
  animation: float-p 5s ease-in-out infinite;
}

.bubble-2 {
  transform-origin: 190px 125px;
  animation: float-p 6s ease-in-out infinite 0.5s;
}

.bubble-3 {
  transform-origin: 120px 180px;
  animation: float-p 4.5s ease-in-out infinite 1s;
}

.animate-pulse-line {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>
