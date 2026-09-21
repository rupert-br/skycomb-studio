<template>
  <header class="sticky top-4 z-50 mx-4 sm:mx-6">
    <div
      class="mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full bg-card px-4 py-2.5 shadow-elevation-1"
    >
      <NuxtLink
        to="/"
        class="flex items-center gap-2 font-display text-base tracking-tight text-card-foreground"
        ><LogoMark />Skycomb Studio</NuxtLink
      >
      <nav class="flex items-center gap-1 sm:gap-2">
        <NuxtLink
          to="/about"
          class="hidden rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-block"
        >
          About
        </NuxtLink>
        <NuxtLink
          to="/signup"
          class="hidden rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-block"
        >
          Sign up
        </NuxtLink>
        <Button as-child variant="default" size="sm">
          <NuxtLink to="/studio">Open the studio</NuxtLink>
        </Button>
      </nav>
    </div>
  </header>
</template>
