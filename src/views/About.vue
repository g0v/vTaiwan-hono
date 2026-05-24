<template>
  <main class="container">
    <h1>About</h1>
    <p>
      This template demonstrates server-side rendering of Vue 3 components
      inside a Cloudflare Worker, with Hono handling routing.
    </p>
    <p>
      Each route injects its own &lt;title&gt; and Open Graph meta tags
      via <code>src/ssr/heads.ts</code>.
    </p>
    <p><RouterLink to="/">Back home</RouterLink></p>
  </main>
</template>
