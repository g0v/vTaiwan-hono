<template>
  <main>
    <div class="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <div class="policy-body rounded-lg bg-white p-6 shadow-md sm:p-8">
        <h1 class="mb-8 text-center text-3xl font-bold">使用條款</h1>

        <section class="mb-8">
          <h2 class="mb-4 text-2xl font-semibold">引言</h2>
          <p class="mb-4">歡迎使用 vTaiwan 平台。本使用條款規範您對我們服務的使用。</p>
        </section>

        <section class="mb-8">
          <h2 class="mb-4 text-2xl font-semibold">接受條款</h2>
          <p class="mb-4">
            透過使用我們的服務，您表示同意遵守本使用條款。如果您不同意這些條款，請勿使用我們的服務。
          </p>
        </section>

        <section class="mb-8">
          <h2 class="mb-4 text-2xl font-semibold">帳戶要求</h2>
          <p class="mb-4">使用某些功能需要註冊帳戶：</p>
          <div class="mb-4 border-l-4 border-yellow-400 bg-yellow-50 p-4">
            <p class="font-semibold text-yellow-800">重要：使用視訊及轉錄服務需要先註冊帳號</p>
          </div>
          <ul class="mb-4 list-disc pl-6">
            <li>您必須提供真實、準確的資訊</li>
            <li>您有責任保護您的帳戶安全</li>
            <li>您必須年滿 18 歲或獲得監護人同意</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="mb-4 text-2xl font-semibold">視訊服務</h2>
          <p class="mb-4">我們的視訊會議服務允許用戶進行線上討論和協作。</p>
          <div class="mb-4 border-l-4 border-blue-400 bg-blue-50 p-4">
            <p class="font-semibold text-blue-800">使用視訊服務需要註冊帳號並同意相關條款</p>
          </div>
        </section>

        <section class="mb-8">
          <h2 class="mb-4 text-2xl font-semibold">轉錄服務</h2>
          <p class="mb-4">我們提供會議轉錄服務，幫助記錄和整理討論內容。使用此服務需要：</p>
          <div class="mb-4 border-l-4 border-green-400 bg-green-50 p-4">
            <p class="font-semibold text-green-800">轉錄內容將以 CC-BY-SA 授權釋出</p>
          </div>
          <ul class="mb-4 list-disc pl-6">
            <li>註冊帳戶並登入</li>
            <li>同意轉錄內容的授權條款</li>
            <li>遵守社群規範和討論禮儀</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="mb-4 text-2xl font-semibold">內容授權</h2>
          <p class="mb-4">當您使用我們的轉錄服務時，您同意：</p>
          <div class="mb-4 border-l-4 border-purple-400 bg-purple-50 p-4">
            <p class="font-semibold text-purple-800">所有轉錄內容將以 CC-BY-SA 創用授權釋出</p>
          </div>
          <p class="mb-4">
            CC-BY-SA
            授權允許他人自由使用、修改和分享您的內容，但必須標明原作者並以相同授權釋出衍生作品。
          </p>
        </section>

        <section class="mb-8">
          <h2 class="mb-4 text-2xl font-semibold">用戶行為</h2>
          <p class="mb-4">使用我們的服務時，您同意：</p>
          <ul class="mb-4 list-disc pl-6">
            <li>尊重其他用戶，進行建設性的討論</li>
            <li>不發布違法、有害或攻擊性的內容</li>
            <li>不濫用系統或進行惡意行為</li>
            <li>遵守所有適用的法律法規</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="mb-4 text-2xl font-semibold">免責聲明</h2>
          <p class="mb-4">
            我們的服務按「現狀」提供，不提供任何明示或暗示的保證。我們不承擔因使用服務而產生的任何直接或間接損失。
          </p>
        </section>

        <section class="mb-8">
          <h2 class="mb-4 text-2xl font-semibold">條款修改</h2>
          <p class="mb-4">
            我們保留隨時修改本使用條款的權利。修改後的條款將在網站上公佈，繼續使用服務即表示接受修改後的條款。
          </p>
        </section>

        <section class="mb-8">
          <h2 class="mb-4 text-2xl font-semibold">聯絡我們</h2>
          <p class="mb-4">如果您對本使用條款有任何疑問，請透過以下方式聯絡我們：</p>
          <div class="rounded-lg bg-gray-50 p-4">
            <p><strong>電子郵件：</strong> info@vtaiwan.tw</p>
            <p>
              <strong>GitHub：</strong>
              <a
                href="https://github.com/g0v/vTaiwan-hono"
                class="text-blue-600 underline hover:text-blue-800"
                target="_blank"
                rel="noopener noreferrer"
                >https://github.com/g0v/vTaiwan-hono</a
              >
            </p>
          </div>
        </section>

        <section class="mb-8">
          <h2 class="mb-4 text-2xl font-semibold">生效日期</h2>
          <p class="mb-4">本使用條款自公佈之日起生效。</p>
          <p class="text-sm text-gray-600">最後更新：2025年9月</p>
        </section>

        <div class="mt-8 text-center">
          <RouterLink to="/" class="vt-btn vt-btn-primary !text-white">返回首頁</RouterLink>
        </div>
      </div>
    </div>
  </main>
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
