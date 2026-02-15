# AGENT.md — Azeroth Management Portal

> ## ⚠️ Agent Checklist — READ AND FOLLOW EVERY SESSION
>
> Before doing ANY work, complete this checklist:
>
> - [ ] **Read this file first.** Understand the architecture, conventions, and key files before making changes.
> - [ ] **Check `shared/utils/perks/`** if the task involves perks, buffs, scrolls, teleports, or the dice/gacha system. The registry is split across multiple files by group — don't look for a monolithic `perks.ts`.
> - [ ] **Check `server/utils/config/index.ts`** if the task involves environment variables, feature flags, or perk config resolution.
> - [ ] **Check `data/eluna/web_worker.lua`** if the task involves in-game delivery (items, spells, auras, teleports, bag delivery). This is the Lua bridge that processes queue tables.
> - [ ] **Run `get_errors`** after every edit to catch issues immediately.
> - [ ] **Update this file** if you add new files, directories, patterns, conventions, API routes, perk groups, delivery types, or config options. Keep it concise — tables and lists, not prose.
>
> **Common pitfalls:**
>
> - The perk registry is in `shared/utils/perks/` (a directory with barrel index), NOT a single file.
> - `getPerkConfig()` in `server/utils/config/index.ts` returns `{ groups, perks, failDebuff*, critFailDebuff* }` — it resolves per-perk env overrides.
> - Scroll delivery uses `'bag-item'` (direct to bags via `web_bag_requests`), NOT `'item'` (mail).
> - Buff/scroll perks use `rankGroup` for deduplication — the UI shows only the highest applicable rank per character level.
> - All queue tables are auto-created by `web_worker.lua` on startup.

## Project Overview

A full-stack management portal for AzerothCore WoW 3.3.5a private servers. Nuxt 4 (Vue 3 + Nitro), Pinia stores, MySQL (AzerothCore game databases), SQLite (local data + DBC cache), SCSS design system, PrimeVue module (registered but mostly replaced by custom `Ui*` components).

**Version**: See `package.json` → `version`
**License**: MIT
**Node**: 18+ (20+ recommended), npm

## Commands

| Command                    | Purpose                                                |
| -------------------------- | ------------------------------------------------------ |
| `npm run dev`              | Dev server (mock auth)                                 |
| `npm run dev:ssl`          | Dev server with HTTPS (mkcert certs in `certs/`)       |
| `npm run dev:local`        | Dev with `NODE_ENV=development`                        |
| `npm run dev:production`   | Dev with `NODE_ENV=production`                         |
| `npm run build`            | Production build                                       |
| `npm run build:production` | Production build (`NODE_ENV=production`)               |
| `npm run preview`          | Preview production build                               |
| `npm run import-dbc`       | Import DBC JSON → SQLite databases in `server/assets/` |

## Architecture

```
app/                 → Vue 3 frontend (pages, components, stores, composables, styles, types, utils)
server/              → Nitro backend (API routes, services, utils, assets)
shared/utils/        → Shared code between client and server (perk registry, config types)
data/                → DBC JSON exports, PNG icons, Eluna scripts (dev/build tooling, not served)
scripts/             → DB import/migration CLI scripts
docs/                → Detailed documentation (API, Auth, Config, Deploy, Dev, Setup)
```

### Key Files

| File                           | Purpose                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------ |
| `nuxt.config.ts`               | Nuxt config: modules, runtime config defaults, Vite/SCSS settings              |
| `app/app.vue`                  | Root Vue component                                                             |
| `app/layouts/default.vue`      | Main layout (nav, footer, mobile menu)                                         |
| `app/types/index.ts`           | All shared TypeScript types                                                    |
| `server/utils/config/index.ts` | Central server config — reads `process.env` at runtime (K8s-safe), perk config |
| `server/utils/db.ts`           | SQLite (better-sqlite3) for account_mappings — WAL mode, CRUD interface        |
| `server/utils/mysql.ts`        | MySQL connection pools (mysql2/promise) — cached in Map                        |
| `server/utils/auth.ts`         | Auth utilities: `getAuthenticatedUser()`, `requireGM()`, session management    |
| `server/utils/dbc-db.ts`       | DBC SQLite databases (items, spells, talents) — read-only server assets        |
| `server/utils/srp6.ts`         | SRP-6a password verification/creation (AzerothCore compatible)                 |
| `data/eluna/web_worker.lua`    | Eluna bridge script — processes all queue tables in-game (v2.6)                |
| `shared/utils/perks/index.ts`  | Perk registry barrel — re-exports types, groups, per-group arrays, helpers     |
| `shared/utils/config/index.ts` | Type-only re-exports for client/server shared config types                     |

## Directory Structure

### Frontend (`app/`)

#### Pages (file-based routing)

Pages are **thin orchestrators** — they call store actions and delegate rendering to components.

| Route                       | File                                   | Pattern                                               |
| --------------------------- | -------------------------------------- | ----------------------------------------------------- |
| `/`                         | `pages/index.vue`                      | Self-contained landing; `watchEffect` for stats       |
| `/login`                    | `pages/login.vue`                      | `layout: false`; standalone login form                |
| `/account`                  | `pages/account/index.vue`              | Account list; CreateAccountForm/LinkAccountForm       |
| `/account/:id`              | `pages/account/[id].vue`               | Account detail; 7 child components                    |
| `/admin`                    | `pages/admin/index.vue`                | Tab-based; delegates to Admin\* components            |
| `/character/:guid/:realmId` | `pages/character/[guid]/[realmId].vue` | Character showroom (equipment, stats, talents, perks) |
| `/shop`                     | `pages/shop/index.vue`                 | Character selection for shop                          |
| `/shop/:realmId/:guid`      | `pages/shop/[realmId]/[guid].vue`      | Item browsing per character                           |
| `/community`                | `pages/community/index.vue`            | Tab-based; online players, stats, leaderboards        |
| `/downloads`                | `pages/downloads/index.vue`            | File downloads                                        |

#### Components

Organized by feature domain. All use `<script setup lang="ts">` exclusively.

| Directory               | Prefix            | Components                                                                                                                                                                                                         |
| ----------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `components/ui/`        | `Ui`              | UiBadge, UiButton, UiCard, UiDataTable, UiEmptyState, UiFormGroup, UiInput, UiLoadingState, UiMessage, UiModal, UiPageHeader, UiProgressBar, UiSectionHeader, UiSelect, UiStatCard, UiTabPanel, UiTabs, UiTextarea |
| `components/account/`   | `Account`/Feature | AccountHeader, AccountSecurityInfo, AccountStatistics, CharacterActionModal, CharacterList, DangerZone, PasswordChangeForm                                                                                         |
| `components/admin/`     | `Admin`           | AdminAccountsTab, AdminFilesTab, AdminGMForm, AdminLinkAccountsTab, AdminMailForm, AdminMappingsTab                                                                                                                |
| `components/character/` | `Character`       | CharacterEquipmentSlot, CharacterTalentTree, **CharacterPerks**, **CharacterPerkCard**                                                                                                                             |
| `components/community/` | Feature           | DirectoryFilters, DistributionChart, OnlinePlayerCard, OnlinePlayersGrid, PlayerDirectoryBrowser, PvPStatistics, RealmFilter, StatsOverview, TopPlayersLeaderboard                                                 |
| `components/shop/`      | `Shop`            | ShopCategoryTabs, ShopCharacterSelect, ShopDeliveryToggle, ShopItemCard, ShopItemsGrid, ShopNotification, ShopPagination, ShopSearchControls, ShopSelectedCharacterBar                                             |
| `components/` (root)    | —                 | CreateAccountForm, LinkAccountForm                                                                                                                                                                                 |

#### Stores (`app/stores/`)

All use **Composition API** pattern: `defineStore('name', () => { ... })`.

| Store      | File            | Purpose                                                                         |
| ---------- | --------------- | ------------------------------------------------------------------------------- |
| Auth       | `auth.ts`       | User identity, GM level, login/logout. Uses `$fetch` for `/api/auth/*`          |
| Accounts   | `accounts.ts`   | WoW account CRUD. Has `error` ref + explicit `$reset()`                         |
| Characters | `characters.ts` | Character data + online polling via `setInterval`. Inter-store dep on community |
| Community  | `community.ts`  | Stats, leaderboards, player directory. Pagination/filtering state               |
| Shop       | `shop.ts`       | Shop config, character selection. Cross-store composition with accountsStore    |

**Store convention**: `ref()` for state → `computed()` for getters → `async function` for actions → `$reset()` → explicit `return {}`.

#### Composables (`app/composables/`)

| Composable        | Purpose                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `useAuth`         | Wraps auth store + router — provides `login()`, `logout()`, `isAuthenticated`, `isGM`    |
| `useAuthConfig`   | Fetches auth mode from `/api/auth/config` — uses `useState` (SSR-safe)                   |
| `useServerConfig` | Fetches realm list from `/api/realms` — uses `useAsyncData` (SSR-compatible)             |
| `useUrlTab`       | URL-synced tab state via `useRoute`/`useRouter` — provides `activeTab` writable computed |

#### Styles (`app/styles/`)

| File               | Content                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_variables.scss`  | Naming: `$bg-*`, `$text-*`, `$border-*`, `$blue-*`, `$purple-*`, `$orange-*`, `$success`/`$error`/`$warning`/`$info`, `$quality-*` (WoW item quality), `$faction-*`, `$class-*` (WoW classes), `$spacing-*`, `$font-size-*`, `$radius-*`, `$shadow-*`, `$glow-*`, `$breakpoint-*`, `$z-*`, `$gradient-*`                                                                                                    |
| `_mixins.scss`     | Categories: layout (`container`, `flex-center`, `grid-auto`), cards (`card-base`, `card-hover`), buttons (`button-primary`, `button-danger`), forms (`form-input`, `form-group`), badges (`badge-status($color)`), tables, state (`loading-state`, `empty-state`), messages, text (`gradient-text`, `text-clamp`), tabs, animation (`fade-in`, `slide-up`), responsive (`respond-to($breakpoint)`), section |
| `_animations.scss` | `fadeIn`, `fadeInScale`, `slideUp`, `slideDown`, `slideInRight`, `pulse`, `spin`, `shimmer`                                                                                                                                                                                                                                                                                                                 |
| `main.scss`        | Global utility classes: `.btn-primary`, `.card`, `.form-group`, `.empty-state`, `.badge`, `.spinner`, `.gradient-text`, margin/flex utilities                                                                                                                                                                                                                                                               |

**Usage in components**: `@use '~/styles/variables' as *` and `@use '~/styles/mixins' as *` in `<style scoped lang="scss">`.

### Backend (`server/`)

#### API Routes (`server/api/`)

File-based routing with HTTP verb suffixes: `.get.ts`, `.post.ts`, `.delete.ts`. Dynamic params via `[paramName]` directories. **No PUT/PATCH** — mutations use POST.

| Group           | Files                                                                                                                                                                                                                     | Auth                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `auth/`         | `config.get`, `login.post`, `logout.post`, `me.get`                                                                                                                                                                       | Public (config), Direct-mode (login/logout), Any (me)  |
| `accounts/`     | `create.post`, `map.post`, `password.post`, `detail/[accountId].get`, `map/[externalId]/[wowAccountId].delete`, `user/[externalId].get`, `user/mapping/[wowAccountId].get`                                                | Authenticated                                          |
| `characters/`   | `action.post`, `activate-perk.post`, `perk-config.get`, `perk-status.get`, `[guid]/[realmId].get`, `talent-tree/[classId].get`                                                                                            | Authenticated (action, perks), Public (detail, talent) |
| `admin/`        | `accounts.get`, `account-mappings.get`, `account-mappings.post`, `account-mappings/[id].delete`, `export.post`, `files/upload.post`, `files/[filename].delete`, `gm/set-level.post`, `items/search.get`, `mail/send.post` | GM required (`requireGM()`)                            |
| `community/`    | `online.get`, `stats.get`, `top-players.get`, `pvp-stats.get`, `players.get`, `zones.get`                                                                                                                                 | Public                                                 |
| `shop/`         | `config.get`, `items.get`, `purchase.post`                                                                                                                                                                                | Varies                                                 |
| `downloads/`    | `list.get`, `[filename].get`                                                                                                                                                                                              | Public                                                 |
| `stats/`        | `overview.get`                                                                                                                                                                                                            | Public                                                 |
| `realms.get.ts` | Realm list (also K8s health endpoint)                                                                                                                                                                                     | Public                                                 |

**API handler pattern**:

```typescript
export default defineEventHandler(async (event) => {
	// 1. Auth check: getAuthenticatedUser(event) or requireGM(event)
	// 2. Read inputs: readBody(event), getRouterParams(event), getQuery(event)
	// 3. Validate
	// 4. Service/DB call
	// 5. Return plain object (auto-serialized)
	// catch: re-throw H3 errors, wrap unknowns in createError({ statusCode: 500 })
});
```

#### Services (`server/services/`)

Pure functions (not classes). Import pool factories from `server/utils/mysql.ts`.

| Service   | File           | Purpose                                           |
| --------- | -------------- | ------------------------------------------------- |
| Account   | `account.ts`   | WoW account CRUD, SRP-6a password ops, ban checks |
| Character | `character.ts` | Character queries, equipment, inventory           |
| Community | `community.ts` | Cross-realm stats aggregation, leaderboards, PvP  |
| GM        | `gm.ts`        | GM level checks, access management                |
| Realm     | `realm.ts`     | Cross-realm orchestration, parallel queries       |
| SOAP      | `soap.ts`      | Execute GM commands via SOAP XML to game server   |

#### Utils (`server/utils/`)

| Utility        | File                | Purpose                                                                                                                                                |
| -------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Config         | `config/index.ts`   | Central config hub. Reads `process.env` at runtime. `getRealmConfigs()`, `getAuthDbConfig()`, `getShopConfig()`, `getElunaConfig()`, `getPerkConfig()` |
| DB (SQLite)    | `db.ts`             | `account_mappings` CRUD. WAL mode, periodic checkpointing, graceful shutdown.                                                                          |
| MySQL          | `mysql.ts`          | Pool factories: `getAuthPool()`, `getCharactersPool(realmId)`, `getWorldPool(realmId)`. Cached in Map.                                                 |
| Auth           | `auth.ts`           | `getAuthenticatedUser(event)`, `requireGM(event)`, `isDirectAuth()`, session CRUD. 4 auth modes.                                                       |
| SRP-6a         | `srp6.ts`           | `verifySRP6Password()`, `createSRP6Credentials()`. Uses `@azerothcore/ac-nodejs-srp6`.                                                                 |
| DBC DB         | `dbc-db.ts`         | Read-only SQLite for game data. `getItemById()`, `getSpellById()`, `getTalentsByTab()`, etc.                                                           |
| API Errors     | `api-errors.ts`     | `handleApiError()`, factory functions: `notFoundError()`, `forbiddenError()`, `validationError()`.                                                     |
| Account Filter | `account-filter.ts` | `getNonBotAccountFilter()` — SQL `IN(...)` clause excluding bot accounts. 30s cache.                                                                   |
| Realm Query    | `realm-query.ts`    | `getTargetRealms()`, cross-realm query helpers.                                                                                                        |
| Enchantments   | `enchantments.ts`   | WoW enchantment/suffix parsing for equipment display.                                                                                                  |
| Export         | `export.ts`         | CSV/JSON export for admin data.                                                                                                                        |
| DB Credentials | `db-credentials.ts` | Legacy credential loader (deprecated, use config/index.ts).                                                                                            |

### Perk System (Gambling/Gacha)

The perk system lets characters unlock abilities, receive buffs, get items, or teleport — gated by a dice roll. It spans frontend, backend, shared registry, and the in-game Eluna bridge.

#### Perk Registry (`shared/utils/perks/`)

The registry is split into **8 files by concern**. All exports are re-exported from the barrel `index.ts`.

| File          | Lines | Contents                                                                                               |
| ------------- | ----- | ------------------------------------------------------------------------------------------------------ |
| `types.ts`    | ~87   | `PerkGroup`, `PerkDeliveryType`, `PerkDefinition`, `PerkGroupMeta`                                     |
| `groups.ts`   | ~45   | `PERK_GROUPS` — group metadata (label, icon, env toggle key)                                           |
| `mount.ts`    | ~26   | `MOUNT_PERKS` — 1 perk (Old World Flying)                                                              |
| `quest.ts`    | ~29   | `QUEST_PERKS` — 1 perk (Drakefire Amulet)                                                              |
| `buffs.ts`    | ~1170 | `BUFF_PERKS` — 54 entries (8 buff types × multiple ranks)                                              |
| `scrolls.ts`  | ~1080 | `SCROLL_PERKS` — 48 entries (6 stats × 8 tiers I–VIII)                                                 |
| `teleport.ts` | ~266  | `TELEPORT_PERKS` — 10 cities (Alliance, Horde, Neutral)                                                |
| `index.ts`    | ~66   | Barrel: `PERK_REGISTRY` (concat of all), helpers (`getPerkById`, `getPerksByGroup`, `getActiveGroups`) |

**Import path**: `import { ... } from '~~/shared/utils/perks'` (resolves to `index.ts`).

#### Perk Groups

| Group      | Delivery Type | Count | Key Features                                                  |
| ---------- | ------------- | ----- | ------------------------------------------------------------- |
| `mount`    | `spell`       | 1     | One-time permanent unlock                                     |
| `quest`    | `item`        | 1     | One-time, mailed via `web_item_requests`                      |
| `buffs`    | `aura`        | 54    | `rankGroup` dedup, `auraDurationMs`, per-perk debuff duration |
| `scrolls`  | `bag-item`    | 48    | `rankGroup` dedup, direct bag delivery via `web_bag_requests` |
| `teleport` | `teleport`    | 10    | Uses Dazed (spell 1604) as fail debuff                        |

#### Delivery Types

| Type       | Queue Table             | Eluna Action             | Notes                            |
| ---------- | ----------------------- | ------------------------ | -------------------------------- |
| `spell`    | `web_spell_requests`    | `player:LearnSpell()`    | Permanent                        |
| `item`     | `web_item_requests`     | SendMail with attachment | Mailed to player                 |
| `bag-item` | `web_bag_requests`      | `player:AddItem()`       | Direct to bags; waits if offline |
| `aura`     | `web_aura_requests`     | `player:AddAura()`       | Temporary; has duration          |
| `teleport` | `web_teleport_requests` | `player:Teleport()`      | Requires online                  |

#### PerkDefinition Key Fields

| Field                   | Purpose                                                             |
| ----------------------- | ------------------------------------------------------------------- |
| `rankGroup`             | Groups perk ranks — UI shows only highest applicable rank per level |
| `auraDurationMs`        | Buff duration in ms (aura type only)                                |
| `failDebuffSpellId`     | Per-perk override for fail debuff spell (default: 11196)            |
| `failDebuffDurationMs`  | Per-perk override for fail debuff duration (default: 600000ms)      |
| `critFailDebuffSpellId` | Per-perk override for critfail debuff spell (default: 15007)        |
| `envPrefix`             | Env var prefix for per-perk dice/threshold/limit/level overrides    |
| `requiresOnline`        | Character must be online (checked via DB `online` column + polling) |

#### Perk API Routes

| Route                                | Purpose                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------ |
| `GET /api/characters/perk-config`    | Returns enabled groups + resolved per-perk config for UI                 |
| `GET /api/characters/perk-status`    | Returns daily usage counts per perk for a character                      |
| `POST /api/characters/activate-perk` | Dice roll → deliver or debuff. Validates level, online, ownership, limit |

#### Perk Config Resolution (`server/utils/config/index.ts`)

`getPerkConfig()` returns:

- `groups` — `Record<PerkGroup, { enabled: boolean }>` (from `NUXT_PERK_GROUP_<GROUP>_ENABLED` env vars, default `true`)
- `perks` — `Record<string, ResolvedPerkConfig>` with per-perk `diceSides`, `rollThreshold`, `dailyLimit`, `requiredLevel` (env overrides via `NUXT_PERK_<PREFIX>_*`)
- `failDebuffSpellId` / `failDebuffDurationMs` — global defaults (overridable per-perk on `PerkDefinition`)
- `critFailDebuffSpellId` / `critFailDebuffDurationMs` — global defaults

#### Perk UI (`app/components/character/`)

| Component               | Purpose                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `CharacterPerks.vue`    | Container — collapsible groups (collapsed by default), level filtering, `rankGroup` dedup via `visiblePerks()`, online polling |
| `CharacterPerkCard.vue` | Individual perk card — dice roll animation, outcome display, usage counter                                                     |

#### Debuff System

| Scenario      | Default Spell             | Default Duration | Per-Perk Override                                             |
| ------------- | ------------------------- | ---------------- | ------------------------------------------------------------- |
| Normal fail   | 11196 (Recently Bandaged) | 10 min           | `perk.failDebuffSpellId`, `perk.failDebuffDurationMs`         |
| Critical fail | 15007 (Res Sickness)      | 10 min           | `perk.critFailDebuffSpellId`, `perk.critFailDebuffDurationMs` |
| Teleport fail | 1604 (Dazed, -50% speed)  | 60s              | Set on all teleport perk definitions                          |
| Buff fail     | 11196 (global default)    | = buff duration  | `failDebuffDurationMs` matches `auraDurationMs`               |

### Databases

| Database           | Engine | Purpose                                            | Access Pattern                                |
| ------------------ | ------ | -------------------------------------------------- | --------------------------------------------- |
| `acore_auth`       | MySQL  | Shared auth DB (accounts, bans, GM access)         | `getAuthPool()` — single pool                 |
| `acore_characters` | MySQL  | Per-realm character data + Eluna queue tables      | `getCharactersPool(realmId)` — per-realm pool |
| `acore_world`      | MySQL  | Per-realm game data (items, spells, templates)     | `getWorldPool(realmId)` — per-realm pool      |
| `mappings.db`      | SQLite | External auth → WoW account links                  | `server/utils/db.ts` — single instance        |
| DBC databases      | SQLite | Read-only game data cache (items, spells, talents) | `server/utils/dbc-db.ts` — server assets      |

### Multi-Realm Support

- Env vars `NUXT_DB_REALM_0_*` through `NUXT_DB_REALM_9_*` (up to 10 realms)
- Each realm: ID, NAME, DESCRIPTION, HOST, PORT, USER, PASSWORD, optional SOAP\_\* config
- `acore_auth` is shared across all realms
- `acore_characters` and `acore_world` are per-realm (separate MySQL pools)
- API routes accept `?realm=` query param for filtering
- Community service aggregates stats across all realms

### Eluna Integration

The web portal queues requests in MySQL tables; the Eluna Lua script (`data/eluna/web_worker.lua` v2.6) polls and processes them in-game every 1 second:

| Queue Table             | Purpose                | Status Flow                                      |
| ----------------------- | ---------------------- | ------------------------------------------------ |
| `web_money_requests`    | Add/deduct gold        | `pending` → `done`/`error`                       |
| `web_item_requests`     | Mail items to players  | `pending` → `done`/`error`                       |
| `web_bag_requests`      | Direct-to-bag delivery | `pending` → `waiting` (offline) → `done`/`error` |
| `web_spell_requests`    | Teach spells           | `pending` → `waiting` (offline) → `done`/`error` |
| `web_aura_requests`     | Apply buffs/debuffs    | `pending` → `waiting` (offline) → `done`/`error` |
| `web_teleport_requests` | Teleport to coords     | `pending` → `waiting` (offline) → `done`/`error` |

Feature flags: `NUXT_ELUNA_ENABLED`, `NUXT_ELUNA_SHOP_ENABLED`, `NUXT_ELUNA_GM_MAIL_ENABLED`.

All tables are auto-created by `web_worker.lua` on startup. The `waiting` status means the character was offline; the request retries on next login.

### Authentication Modes

| Mode        | Env Value     | Mechanism                                 | Use Case               |
| ----------- | ------------- | ----------------------------------------- | ---------------------- |
| Mock        | `mock`        | Simulated user from config                | Local development      |
| OAuth-Proxy | `oauth-proxy` | `X-Auth-Request-*` headers                | Kubernetes + OIDC      |
| Header      | `header`      | `X-Remote-User` / `X-Forwarded-User`      | Nginx basic auth       |
| Direct      | `direct`      | WoW credentials + session cookie (SRP-6a) | Standalone deployments |

Set via `NUXT_PUBLIC_AUTH_MODE`. External modes (oauth-proxy, header) enable account linking. Direct mode = user IS the WoW account.

### Caching

All in-process memory (no Redis):

- MySQL pools: permanent (Map)
- Realm config: permanent (cached on first call)
- Non-bot account IDs: 30s TTL
- DBC database connections: permanent
- Auth sessions (direct mode): 24h TTL (in-memory Map)

## Coding Conventions

### General

- **TypeScript everywhere**. Use `type` over `interface` (exception: `PerkDefinition` uses `interface` for readability).
- **Import utilities from `utils/` folders** — don't re-export from stores.
- **Remove unused/redundant code**, especially styles and store exports.
- **Unify styles** — reuse SCSS variables/mixins. Check `_variables.scss` and `_mixins.scss` before adding new ones.
- **Broader project analysis** for any change touching shared style, components, or code.

### Frontend

- **Pages**: Minimal — delegate to components. Use `definePageMeta()` for layout control.
- **Components**: `<script setup lang="ts">`, scoped SCSS with `@use '~/styles/variables' as *` and `@use '~/styles/mixins' as *`.
- **Props**: `defineProps<{...}>()` with TypeScript, `withDefaults()` for optionals.
- **Emits**: `defineEmits<{ eventName: [payload] }>()` with typed payloads.
- **Stores**: Composition API: `defineStore('name', () => { ... })`. State as `ref()`, getters as `computed()`, actions as `async function`, explicit `$reset()`, explicit `return {}`.
- **API calls**: Use `$fetch('/api/...')` with relative paths. `useAsyncData` for SSR, `$fetch` for client-only.
- **Navigation**: `<NuxtLink>` for links, `navigateTo()` for redirects, `router.replace()` for URL updates.
- **Explicit imports**: Vue APIs (`ref`, `computed`, `watch`, `onMounted`) and Pinia stores are explicitly imported. Nuxt composables (`useRoute`, `useRouter`, `navigateTo`, `definePageMeta`) are auto-imported.

### Backend

- **API route naming**: `resource.verb.ts` (e.g., `create.post.ts`), dynamic params as `[param]` directories.
- **Mutations use POST only** — no PUT/PATCH routes exist.
- **Auth checks**: `getAuthenticatedUser(event)` for user routes, `requireGM(event)` for admin routes.
- **Error handling**: `throw createError({ statusCode, statusMessage })`. Catch blocks re-throw H3 errors, wrap unknowns in 500.
- **Database queries**: Always use parameterized queries (`pool.execute(sql, [params])`).
- **Services are pure functions**, not classes.
- **Config reads `process.env` at runtime** (not `useRuntimeConfig()` for DB credentials) — critical for K8s.
- **No explicit middleware files** — auth is inline per route.

### Perk Development

- **Adding a new perk**: Add entry to the appropriate file in `shared/utils/perks/` (e.g., `buffs.ts` for a new buff). It will automatically appear in `PERK_REGISTRY` via the barrel.
- **Adding a new perk group**: Create a new file in `shared/utils/perks/`, add the group to `PERK_GROUPS` in `groups.ts`, update `PerkGroup` type in `types.ts`, import + spread in `index.ts`.
- **Adding a new delivery type**: Add to `PerkDeliveryType` in `types.ts`, add case to `deliverPerk()` in `activate-perk.post.ts`, ensure Eluna handles the queue table.
- **Rank groups (`rankGroup`)**: Perks sharing a `rankGroup` are deduplicated by `visiblePerks()` in `CharacterPerks.vue` — only the highest-level qualifying rank is shown.
- **Per-perk env overrides**: `NUXT_PERK_<envPrefix>_DICE_SIDES`, `_ROLL_THRESHOLD`, `_DAILY_LIMIT`, `_REQUIRED_LEVEL`.

### Documentation

- Update `README.md` and linked `docs/` files for user-facing changes.
- **Update this `AGENT.md`** for architectural changes, new patterns, new files/directories, new perk groups, delivery types, or convention changes. Keep it concise.

## External Documentation

| Resource                                 | URL                                                  |
| ---------------------------------------- | ---------------------------------------------------- |
| World database (`acore_world`)           | https://www.azerothcore.org/wiki/database-world      |
| Characters database (`acore_characters`) | https://www.azerothcore.org/wiki/database-characters |
| GM commands (SOAP)                       | https://www.azerothcore.org/wiki/gm-commands         |
| Eluna API                                | https://www.azerothcore.org/eluna/                   |
| Nuxt 4 docs                              | https://nuxt.com/docs                                |
| PrimeVue docs                            | https://primevue.org/                                |
| VueUse docs                              | https://vueuse.org/                                  |

## Environment Variables

### Database (server-only, read from `process.env` at runtime)

```bash
# Auth DB (shared across all realms)
NUXT_DB_AUTH_HOST=localhost
NUXT_DB_AUTH_PORT=3306
NUXT_DB_AUTH_USER=acore
NUXT_DB_AUTH_PASSWORD=acore

# Per-realm (0–9)
NUXT_DB_REALM_{n}_ID=1
NUXT_DB_REALM_{n}_NAME=RealmName
NUXT_DB_REALM_{n}_DESCRIPTION=Description
NUXT_DB_REALM_{n}_HOST=localhost
NUXT_DB_REALM_{n}_PORT=3306
NUXT_DB_REALM_{n}_USER=acore
NUXT_DB_REALM_{n}_PASSWORD=acore

# Per-realm SOAP (optional)
NUXT_DB_REALM_{n}_SOAP_ENABLED=true
NUXT_DB_REALM_{n}_SOAP_HOST=localhost
NUXT_DB_REALM_{n}_SOAP_PORT=7878
NUXT_DB_REALM_{n}_SOAP_USERNAME=admin
NUXT_DB_REALM_{n}_SOAP_PASSWORD=admin
```

### Public (browser-accessible, `NUXT_PUBLIC_*`)

```bash
NUXT_PUBLIC_AUTH_MODE=mock          # mock|oauth-proxy|header|direct
NUXT_PUBLIC_MOCK_USER=admin
NUXT_PUBLIC_MOCK_EMAIL=admin@localhost
NUXT_PUBLIC_MOCK_GM_LEVEL=3
NUXT_PUBLIC_APP_BASE_URL=http://localhost:3000
NUXT_PUBLIC_DEBUG_MODE=false
NUXT_PUBLIC_SHOP_DELIVERY_METHOD=mail  # mail|bag|both
NUXT_PUBLIC_SHOP_MARKUP_PERCENT=20
```

### Feature Flags

```bash
NUXT_ELUNA_ENABLED=true
NUXT_ELUNA_SHOP_ENABLED=true
NUXT_ELUNA_GM_MAIL_ENABLED=true
```

### Perk Configuration

```bash
# Per-group enable/disable (default: true)
NUXT_PERK_GROUP_MOUNT_ENABLED=true
NUXT_PERK_GROUP_QUEST_ENABLED=true
NUXT_PERK_GROUP_BUFFS_ENABLED=true
NUXT_PERK_GROUP_SCROLLS_ENABLED=true
NUXT_PERK_GROUP_TELEPORT_ENABLED=true

# Per-perk overrides (via envPrefix, e.g. FLYING, DRAKEFIRE, SCROLL_INT_I, TP_STORMWIND)
NUXT_PERK_<PREFIX>_DICE_SIDES=20
NUXT_PERK_<PREFIX>_ROLL_THRESHOLD=8
NUXT_PERK_<PREFIX>_DAILY_LIMIT=5
NUXT_PERK_<PREFIX>_REQUIRED_LEVEL=60

# Global debuff defaults (overridable per-perk on PerkDefinition)
NUXT_PERK_FAIL_DEBUFF_SPELL_ID=11196
NUXT_PERK_FAIL_DEBUFF_DURATION_MS=600000
NUXT_PERK_CRITFAIL_DEBUFF_SPELL_ID=15007
NUXT_PERK_CRITFAIL_DEBUFF_DURATION_MS=600000
```

## Scripts

| Script                                  | Command              | Purpose                                                                  |
| --------------------------------------- | -------------------- | ------------------------------------------------------------------------ |
| `scripts/import-dbc-to-sqlite.js`       | `npm run import-dbc` | Converts DBC JSON files → SQLite databases in `server/assets/`           |
| `scripts/import-item-display-info.js`   | `node scripts/...`   | Deprecated legacy importer (use import-dbc instead)                      |
| `scripts/migrate-db-schema.js`          | `node scripts/...`   | Migrates `account_mappings` from Keycloak-specific → generic auth schema |
| `scripts/cleanup-broken-mail-items.sql` | Manual SQL           | Diagnoses/fixes broken mail_items in `acore_characters`                  |
