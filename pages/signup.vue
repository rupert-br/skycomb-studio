<script setup lang="ts">
// Signup — UI-only preview: no account is actually created or persisted (there's no
// backend for that yet, see CONCEPT.md's roadmap). Submitting just simulates a request
// and shows a success state.
import { CheckCircle2 } from '@lucide/vue'

useHead({ title: 'Sign up: Skycomb Studio' })

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const submitting = ref(false)
const done = ref(false)

async function onSubmit() {
  error.value = ''
  if (password.value.length < 8) {
    error.value = 'Password must be at least 8 characters.'
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords don’t match.'
    return
  }

  submitting.value = true
  await new Promise((resolve) => setTimeout(resolve, 600))
  submitting.value = false
  done.value = true
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-background px-6 py-16 text-foreground">
    <div class="w-full max-w-sm">
      <NuxtLink to="/" class="flex items-center gap-2 font-display text-base tracking-tight text-foreground">
        <LogoMark />
        Skycomb Studio
      </NuxtLink>

      <Card class="mt-6 gap-6 p-6">
        <template v-if="!done">
          <div>
            <CardTitle class="font-display text-2xl tracking-tight text-card-foreground">
              Create an account
            </CardTitle>
            <CardDescription class="mt-1 text-sm text-muted-foreground">
              Accounts and saved designs are coming soon &mdash; this is a preview of what signing up will look like.
            </CardDescription>
          </div>

          <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
            <div class="flex flex-col gap-1.5">
              <Label for="signup-name">Name</Label>
              <Input id="signup-name" v-model="name" type="text" autocomplete="name" required placeholder="Ada Lovelace" />
            </div>

            <div class="flex flex-col gap-1.5">
              <Label for="signup-email">Email</Label>
              <Input id="signup-email" v-model="email" type="email" autocomplete="email" required placeholder="ada@example.com" />
            </div>

            <div class="flex flex-col gap-1.5">
              <Label for="signup-password">Password</Label>
              <Input id="signup-password" v-model="password" type="password" autocomplete="new-password" required minlength="8" placeholder="At least 8 characters" />
            </div>

            <div class="flex flex-col gap-1.5">
              <Label for="signup-confirm">Confirm password</Label>
              <Input id="signup-confirm" v-model="confirmPassword" type="password" autocomplete="new-password" required minlength="8" />
            </div>

            <p v-if="error" class="text-xs text-destructive">{{ error }}</p>

            <Button type="submit" :disabled="submitting" class="mt-2 w-full">
              {{ submitting ? 'Creating account…' : 'Create account' }}
            </Button>
          </form>

          <p class="text-center text-xs text-muted-foreground">
            Already have an account?
            <NuxtLink to="/" class="text-foreground underline underline-offset-4">Back home</NuxtLink>
          </p>
        </template>

        <template v-else>
          <div class="flex flex-col items-center gap-3 py-4 text-center">
            <div class="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <CheckCircle2 :size="20" />
            </div>
            <div>
              <CardTitle class="font-display text-xl tracking-tight text-card-foreground">
                You're on the list
              </CardTitle>
              <CardDescription class="mt-1 text-sm text-muted-foreground">
                We'll email {{ email }} once accounts are ready. Nothing was actually created yet.
              </CardDescription>
            </div>
            <Button as-child variant="outline" class="mt-2">
              <NuxtLink to="/">Back home</NuxtLink>
            </Button>
          </div>
        </template>
      </Card>
    </div>
  </main>
</template>
