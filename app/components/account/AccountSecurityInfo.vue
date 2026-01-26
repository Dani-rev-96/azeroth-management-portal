<template>
  <div class="section security-section">
    <h2>Account Security</h2>
    <div class="info-grid">
      <div class="info-item">
        <span class="label">Last Login:</span>
        <span class="value">{{ formatDateTime(account?.last_login) }}</span>
      </div>
      <div class="info-item">
        <span class="label">Last IP:</span>
        <span class="value">{{ account?.last_ip || 'N/A' }}</span>
      </div>
      <div class="info-item">
        <span class="label">Account Created:</span>
        <span class="value">{{ formatDateTime(account?.joindate) }}</span>
      </div>
      <div class="info-item">
        <span class="label">Status:</span>
        <span :class="['value', 'status', account?.online ? 'online' : 'offline']">
          {{ account?.online ? 'Online' : 'Offline' }}
        </span>
      </div>
      <div class="info-item">
        <span class="label">Expansion:</span>
        <span class="value">{{ getExpansionName(account?.expansion) }}</span>
      </div>
      <div class="info-item">
        <span class="label">Email:</span>
        <span class="value">{{ account?.email || 'Not set' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AzerothCoreAccount } from '~/types'

defineProps<{
  account: AzerothCoreAccount | null
}>()

const formatDateTime = (dateStr: string | null | undefined) => {
  if (!dateStr) return 'Never'
  return new Date(dateStr).toLocaleString()
}

const getExpansionName = (expansion: number | undefined) => {
  const expansions: Record<number, string> = {
    0: 'Classic',
    1: 'The Burning Crusade',
    2: 'Wrath of the Lich King',
    3: 'Cataclysm'
  }
  return expansions[expansion || 0] || 'Unknown'
}
</script>

<style scoped lang="scss">
.section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  h2 {
    margin: 0 0 1rem 0;
    font-size: 1.5rem;
  }
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;

  .info-item {
    display: flex;
    justify-content: space-between;
    padding: 0.75rem;
    background: #f5f5f5;
    border-radius: 4px;

    .label {
      font-weight: 600;
      color: #555;
    }

    .value {
      color: #333;

      &.status {
        font-weight: 600;
        
        &.online {
          color: #4caf50;
        }

        &.offline {
          color: #999;
        }
      }
    }
  }
}
</style>
