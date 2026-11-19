<template>
  <main>
    <div class="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <div class="policy-body rounded-lg bg-white p-6 shadow-md sm:p-8">
        <h1 class="mb-8 text-center text-3xl font-bold">{{ $t('privacy.title') }}</h1>

        <section class="mb-8">
          <h2 class="mb-4 text-2xl font-semibold">{{ $t('privacy.introduction.title') }}</h2>
          <p class="mb-4">{{ $t('privacy.introduction.content') }}</p>
        </section>

        <section class="mb-8">
          <h2 class="mb-4 text-2xl font-semibold">{{ $t('privacy.dataCollection.title') }}</h2>
          <p class="mb-4">{{ $t('privacy.dataCollection.content') }}</p>
          <ul class="mb-4 list-disc pl-6">
            <li>{{ $t('privacy.dataCollection.item1') }}</li>
            <li>{{ $t('privacy.dataCollection.item2') }}</li>
            <li>{{ $t('privacy.dataCollection.item3') }}</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="mb-4 text-2xl font-semibold">{{ $t('privacy.dataUsage.title') }}</h2>
          <p class="mb-4">{{ $t('privacy.dataUsage.content') }}</p>
          <ul class="mb-4 list-disc pl-6">
            <li>{{ $t('privacy.dataUsage.item1') }}</li>
            <li>{{ $t('privacy.dataUsage.item2') }}</li>
            <li>{{ $t('privacy.dataUsage.item3') }}</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="mb-4 text-2xl font-semibold">{{ $t('privacy.dataSharing.title') }}</h2>
          <p class="mb-4">{{ $t('privacy.dataSharing.content') }}</p>
          <p class="mb-4">{{ $t('privacy.dataSharing.publicInfo') }}</p>
          <div class="mb-4 border-l-4 border-blue-400 bg-blue-50 p-4">
            <p class="font-semibold text-blue-800">{{ $t('privacy.dataSharing.highlight') }}</p>
          </div>
        </section>

        <section class="mb-8">
          <h2 class="mb-4 text-2xl font-semibold">{{ $t('privacy.dataSecurity.title') }}</h2>
          <p class="mb-4">{{ $t('privacy.dataSecurity.content') }}</p>
        </section>

        <section class="mb-8">
          <h2 class="mb-4 text-2xl font-semibold">{{ $t('privacy.userRights.title') }}</h2>
          <p class="mb-4">{{ $t('privacy.userRights.content') }}</p>
          <ul class="mb-4 list-disc pl-6">
            <li>{{ $t('privacy.userRights.item1') }}</li>
            <li>{{ $t('privacy.userRights.item2') }}</li>
            <li>{{ $t('privacy.userRights.item3') }}</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="mb-4 text-2xl font-semibold">{{ $t('privacy.contact.title') }}</h2>
          <p class="mb-4">{{ $t('privacy.contact.content') }}</p>
          <div class="rounded-lg bg-gray-50 p-4">
            <p>
              <strong>{{ $t('privacy.contact.email') }}：</strong> info@vtaiwan.tw
            </p>
            <p>
              <strong>{{ $t('privacy.contact.github') }}：</strong>
              <a href="https://github.com/g0v/vTaiwan-hono" class="text-blue-600 underline hover:text-blue-800" target="_blank" rel="noopener noreferrer">https://github.com/g0v/vTaiwan-hono</a>
            </p>
          </div>
        </section>

        <section class="mb-8">
          <h2 class="mb-4 text-2xl font-semibold">{{ $t('privacy.updates.title') }}</h2>
          <p class="mb-4">{{ $t('privacy.updates.content') }}</p>
          <p class="text-sm text-gray-600">{{ $t('privacy.updates.lastUpdated') }}</p>
        </section>

        <div class="mt-8 text-center">
          <RouterLink to="/" class="vt-btn vt-btn-primary !text-white">{{ $t('privacy.backToHome') }}</RouterLink>
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
