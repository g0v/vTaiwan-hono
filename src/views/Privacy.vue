<script setup lang="ts">
import NavBar from '../components/NavBar.vue'
import Footer from '../components/Footer.vue'
</script>

<template>
  <div class="font-serif min-h-screen flex flex-col bg-vt-gray-100">
    <NavBar />

    <main class="flex-grow">
      <div class="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        <div class="policy-body rounded-lg bg-white p-6 shadow-md sm:p-8">
          <h1 class="mb-8 text-center text-3xl font-bold">隱私政策</h1>

          <section class="mb-8">
            <h2 class="mb-4 text-2xl font-semibold">引言</h2>
            <p class="mb-4">
              vTaiwan 致力於保護用戶的隱私權。本隱私政策說明我們如何收集、使用、儲存和保護您的個人資料。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="mb-4 text-2xl font-semibold">資料收集</h2>
            <p class="mb-4">我們可能收集以下類型的資料：</p>
            <ul class="mb-4 list-disc pl-6">
              <li>帳戶資訊：當您註冊帳戶時提供的姓名、電子郵件地址等</li>
              <li>使用資料：您使用我們服務時的活動記錄和偏好設定</li>
              <li>技術資料：IP 地址、瀏覽器類型、作業系統等技術資訊</li>
            </ul>
          </section>

          <section class="mb-8">
            <h2 class="mb-4 text-2xl font-semibold">資料使用</h2>
            <p class="mb-4">我們使用收集的資料用於以下目的：</p>
            <ul class="mb-4 list-disc pl-6">
              <li>提供和改善我們的服務</li>
              <li>與您溝通並提供客戶支援</li>
              <li>確保平台安全和防止濫用</li>
            </ul>
          </section>

          <section class="mb-8">
            <h2 class="mb-4 text-2xl font-semibold">資料分享</h2>
            <p class="mb-4">
              除了必要的分析記錄用途之外，我們承諾不會將您的瀏覽記錄與個人資料出售、出租或分享給第三方。
            </p>
            <div class="mb-4 border-l-4 border-blue-400 bg-blue-50 p-4">
              <p class="font-semibold text-blue-800">重要：我們不會將您的個人資料傳遞給第三方</p>
            </div>
          </section>

          <section class="mb-8">
            <h2 class="mb-4 text-2xl font-semibold">資料安全</h2>
            <p class="mb-4">
              我們採取適當的技術和組織措施來保護您的個人資料，防止未經授權的存取、使用或洩露。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="mb-4 text-2xl font-semibold">用戶權利</h2>
            <p class="mb-4">您對自己的個人資料享有以下權利：</p>
            <ul class="mb-4 list-disc pl-6">
              <li>存取權：要求查看我們持有的您的個人資料</li>
              <li>更正權：要求更正不準確的個人資料</li>
              <li>刪除權：要求刪除您的個人資料</li>
            </ul>
          </section>

          <section class="mb-8">
            <h2 class="mb-4 text-2xl font-semibold">聯絡我們</h2>
            <p class="mb-4">
              如果您對本隱私政策有任何疑問，或希望行使您的權利，請透過以下方式聯絡我們：
            </p>
            <div class="rounded-lg bg-gray-50 p-4">
              <p><strong>電子郵件：</strong> info@vtaiwan.tw</p>
              <p>
                <strong>GitHub：</strong>
                <a
                  href="https://github.com/g0v/vTaiwan-hono"
                  class="text-blue-600 underline hover:text-blue-800"
                  target="_blank"
                  rel="noopener noreferrer"
                >https://github.com/g0v/vTaiwan-hono</a>
              </p>
            </div>
          </section>

          <section class="mb-8">
            <h2 class="mb-4 text-2xl font-semibold">政策更新</h2>
            <p class="mb-4">
              我們可能會不時更新本隱私政策。任何重大變更都會在網站上公佈。
            </p>
            <p class="text-sm text-gray-600">最後更新：2025年9月</p>
          </section>

          <div class="mt-8 text-center">
            <RouterLink to="/" class="vt-btn vt-btn-primary !text-white">返回首頁</RouterLink>
          </div>
        </div>
      </div>
    </main>

    <Footer />
  </div>
</template>

<style scoped>
.policy-body h2 {
  color: #111827;
}
.policy-body p {
  color: #374151;
  line-height: 1.75;
}
.policy-body ul {
  color: #374151;
}
.policy-body li {
  margin-bottom: 0.5rem;
}
</style>
