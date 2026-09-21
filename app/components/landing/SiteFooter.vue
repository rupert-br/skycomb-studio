<template>
  <footer class="mx-auto max-w-6xl px-6 py-12">
    <div
      class="flex flex-col items-start justify-between gap-6 border-t border-border pt-8 sm:flex-row sm:items-center"
    >
      <div>
        <p class="font-display text-base tracking-tight text-foreground">
          Skycomb Studio
        </p>
        <p class="mt-1 max-w-sm text-xs text-muted-foreground">
          Elevation: AWS Terrain Tiles. Summit names: © OpenStreetMap
          contributors (ODbL).
        </p>
      </div>
      <nav class="flex items-center gap-4 text-xs text-muted-foreground">
        <NuxtLink to="/about" class="hover:text-foreground">About</NuxtLink>
        <NuxtLink to="/signup" class="hover:text-foreground">Sign up</NuxtLink>
        <!-- `external`: the route is a server-side redirect, so skip client-side routing -->
        <NuxtLink to="/impressum" external class="hover:text-foreground">Impressum</NuxtLink>
        <NuxtLink to="/studio" class="hover:text-foreground"
          >Open the studio</NuxtLink
        >
      </nav>
    </div>
  </footer>
</template>
