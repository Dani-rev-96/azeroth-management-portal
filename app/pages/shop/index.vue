<template>
  <div class="shop-page">
    <UiPageHeader
      title="Shop"
      subtitle="Select a character to start shopping"
    />

    <!-- Character Selection -->
    <ShopCharacterSelect
      :characters="characters"
      :loading="loading"
      :error="error"
      :get-class-icon="getClassIcon"
      :format-money="formatMoney"
      @select="selectCharacter"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useShopStore } from '~/stores/shop'
import type { Character } from '~/stores/characters'

const router = useRouter()
const shopStore = useShopStore()

// State
const loading = computed(() => shopStore.charactersLoading)
const error = computed(() => shopStore.charactersError)
const characters = computed(() => shopStore.sortedCharacters)

// Utility functions
function getClassIcon(classId: number): string {
  return shopStore.getClassIcon(classId)
}

function formatMoney(copper: number): string {
  return shopStore.formatMoney(copper)
}

// Navigation - push to character-specific route
function selectCharacter(character: Character) {
  router.push(`/shop/${character.realmId}/${character.guid}`)
}

// Lifecycle
onMounted(async () => {
  await shopStore.loadConfig()
  await shopStore.loadCharacters()
})
</script>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use '~/styles/mixins' as *;

.shop-page {
  @include container;
}
</style>
