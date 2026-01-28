<script setup lang="ts">
/**
 * OnlinePlayerCard - Card displaying an online player
 */
import { getClassName, getRaceName, formatPlaytime } from '~/utils/wow'
import type { OnlinePlayer } from '~/stores/community'
import UiBadge from '~/components/ui/UiBadge.vue'

export interface Props {
  player: OnlinePlayer
}

defineProps<Props>()

// Zone names would ideally come from DBC data
function getZoneName(zoneId: number): string {
  return `Zone ${zoneId}`
}
</script>

<template>
  <NuxtLink
    :to="`/character/${player.guid}/${player.realmId}`"
    class="online-player-card"
  >
    <header class="online-player-card__header">
      <h3 class="online-player-card__name">{{ player.characterName }}</h3>
      <UiBadge variant="level" outline>Level {{ player.level }}</UiBadge>
    </header>

    <dl class="online-player-card__info">
      <div class="online-player-card__row">
        <dt class="sr-only">Realm</dt>
        <dd class="online-player-card__realm">{{ player.realm }}</dd>
      </div>
      <div class="online-player-card__row">
        <dt class="sr-only">Race and Class</dt>
        <dd class="online-player-card__class-race">
          {{ getRaceName(player.race) }} {{ getClassName(player.class) }}
        </dd>
      </div>
      <div class="online-player-card__row">
        <dt class="sr-only">Zone</dt>
        <dd class="online-player-card__zone">{{ getZoneName(player.zone) }}</dd>
      </div>
      <div class="online-player-card__row">
        <dt class="sr-only">Playtime</dt>
        <dd class="online-player-card__playtime">⏱️ {{ formatPlaytime(player.playtime) }}</dd>
      </div>
    </dl>
  </NuxtLink>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use '~/styles/mixins' as *;

.online-player-card {
  @include card-base;
  display: block;
  text-decoration: none;
  color: inherit;

  &:hover {
    border-color: $blue-primary;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba($blue-primary, 0.2);
  }

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: $spacing-4;
    padding-bottom: $spacing-4;
    border-bottom: 1px solid $border-primary;
  }

  &__name {
    color: $blue-light;
    font-size: $font-size-xl;
    font-weight: $font-weight-semibold;
    margin: 0;
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
    margin: 0;
  }

  &__row {
    margin: 0;
  }

  &__realm {
    font-weight: $font-weight-semibold;
    color: $text-primary;
  }

  &__class-race {
    color: $text-secondary;
  }

  &__zone {
    color: $text-secondary;
    font-style: italic;
  }

  &__playtime {
    color: $text-secondary;
    font-size: $font-size-sm;
  }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
