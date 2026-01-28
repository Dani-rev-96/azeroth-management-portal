# Development Guide

Guide for developers who want to contribute to or customize the Azeroth Management Portal.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Code Architecture](#code-architecture)
- [Adding Features](#adding-features)
- [Testing](#testing)
- [Code Style](#code-style)
- [Contributing](#contributing)

## Development Setup

### Prerequisites

- Node.js 18+ (20 recommended)
- pnpm 8+ (recommended)
- Git
- MySQL client (for testing)
- VS Code (recommended)

### Quick Start

```bash
# Clone repository
git clone https://github.com/your-org/azeroth-management-portal.git
cd azeroth-management-portal

# Install dependencies
pnpm install

# Create local credentials
cat > .db.local.json << 'EOF'
{
  "databases": {
    "auth-db": { "host": "localhost", "port": 3306, "user": "acore", "password": "acore" },
    "blizzlike-db": { "host": "localhost", "port": 3306, "user": "acore", "password": "acore" },
    "ip-db": { "host": "localhost", "port": 3306, "user": "acore", "password": "acore" },
    "ip-boosted-db": { "host": "localhost", "port": 3306, "user": "acore", "password": "acore" }
  },
  "env": { "authMode": "mock", "mockUser": "admin", "mockGMLevel": 3 }
}
EOF

# Start development server
pnpm dev:local
```

### VS Code Extensions

Recommended extensions for development:

```json
{
	"recommendations": [
		"vue.volar",
		"dbaeumer.vscode-eslint",
		"esbenp.prettier-vscode",
		"bradlc.vscode-tailwindcss",
		"antfu.unocss"
	]
}
```

### Development Commands

| Command           | Description               |
| ----------------- | ------------------------- |
| `pnpm dev`        | Start dev server          |
| `pnpm dev:local`  | Start with mock auth      |
| `pnpm dev:ssl`    | Start with HTTPS          |
| `pnpm build`      | Build for production      |
| `pnpm preview`    | Preview production build  |
| `pnpm import-dbc` | Import DBC data to SQLite |

## Project Structure

```
azeroth-management-portal/
├── app/                          # Frontend (Nuxt app directory)
│   ├── components/               # Vue components
│   │   ├── account/              # Account-related components
│   │   ├── admin/                # Admin panel components
│   │   ├── character/            # Character display components
│   │   ├── community/            # Community hub components
│   │   └── ui/                   # Reusable UI components
│   ├── composables/              # Vue composables
│   │   ├── useAuth.ts            # Auth helpers
│   │   ├── useServerConfig.ts    # Config access
│   │   └── useUrlTab.ts          # URL-synced tabs
│   ├── layouts/                  # Page layouts
│   ├── pages/                    # File-based routes
│   │   ├── account/              # Account pages
│   │   ├── admin/                # Admin pages
│   │   ├── character/            # Character pages
│   │   ├── community/            # Community pages
│   │   └── downloads/            # Download pages
│   ├── stores/                   # Pinia stores
│   │   ├── auth.ts               # Authentication state
│   │   ├── accounts.ts           # Account management
│   │   └── community.ts          # Community data
│   ├── styles/                   # Global SCSS
│   ├── types/                    # TypeScript definitions
│   └── utils/                    # Utility functions
├── server/                       # Backend (Nitro server)
│   ├── api/                      # API routes
│   │   ├── auth/                 # Auth endpoints
│   │   ├── accounts/             # Account endpoints
│   │   ├── admin/                # Admin endpoints
│   │   ├── characters/           # Character endpoints
│   │   ├── community/            # Community endpoints
│   │   └── downloads/            # File download endpoints
│   ├── services/                 # Business logic
│   │   ├── account.ts            # Account operations
│   │   ├── character.ts          # Character queries
│   │   ├── community.ts          # Community stats
│   │   └── gm.ts                 # GM operations
│   └── utils/                    # Server utilities
│       ├── auth.ts               # Auth helpers
│       ├── db.ts                 # SQLite (mappings)
│       ├── mysql.ts              # MySQL connections
│       ├── srp6.ts               # SRP-6a password
│       └── dbc-db.ts             # DBC data access
├── shared/                       # Shared code
│   └── utils/
│       └── config/               # Realm configurations
│           ├── local.ts          # Dev config
│           └── production.ts     # Prod config
├── data/                         # Data files
│   ├── dbcJsons/                 # DBC JSON exports
│   └── png/Icons/                # Item icons
├── scripts/                      # Build scripts
│   └── import-dbc-to-sqlite.js   # DBC importer
└── docs/                         # Documentation
```

## Code Architecture

### Frontend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Pages                               │
│   Route-based entry points, minimal logic                   │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                       Components                            │
│   Reusable UI, grouped by feature                           │
└────────────────┬────────────────────────────┬───────────────┘
                 │                            │
┌────────────────▼────────────┐  ┌────────────▼───────────────┐
│         Stores (Pinia)      │  │       Composables          │
│   Global state management   │  │   Shared reactive logic    │
└────────────────┬────────────┘  └────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│                      API ($fetch)                           │
│   Type-safe API calls to Nitro backend                      │
└─────────────────────────────────────────────────────────────┘
```

### Backend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     API Routes                              │
│   HTTP handlers in server/api/                              │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                       Services                              │
│   Business logic, reusable across routes                    │
└────────────────┬────────────────────────────┬───────────────┘
                 │                            │
┌────────────────▼────────────┐  ┌────────────▼───────────────┐
│          Utils              │  │      External DBs          │
│   MySQL, SQLite, Auth       │  │   AzerothCore databases    │
└─────────────────────────────┘  └────────────────────────────┘
```

### Key Patterns

#### API Route Pattern

```typescript
// server/api/example/[id].get.ts
export default defineEventHandler(async (event) => {
	// 1. Auth check
	const { username } = await getAuthenticatedUser(event);

	// 2. Validation
	const id = getRouterParam(event, "id");
	if (!id) {
		throw createError({ statusCode: 400, message: "ID required" });
	}

	// 3. Business logic (delegate to service)
	const result = await someService.getData(id);

	// 4. Return response
	return result;
});
```

#### Store Pattern

```typescript
// app/stores/example.ts
export const useExampleStore = defineStore("example", () => {
	// State
	const items = ref<Item[]>([]);
	const loading = ref(false);

	// Getters
	const itemCount = computed(() => items.value.length);

	// Actions
	async function fetchItems() {
		loading.value = true;
		try {
			items.value = await $fetch("/api/items");
		} finally {
			loading.value = false;
		}
	}

	return { items, loading, itemCount, fetchItems };
});
```

#### Composable Pattern

```typescript
// app/composables/useExample.ts
export const useExample = () => {
	const store = useExampleStore();
	const router = useRouter();

	// Derived state or combined logic
	const handleAction = async () => {
		await store.fetchItems();
		router.push("/items");
	};

	return { handleAction };
};
```

## Adding Features

### Adding a New Page

1. Create page in `app/pages/`:

   ```vue
   <!-- app/pages/newfeature/index.vue -->
   <script setup lang="ts">
   const authStore = useAuthStore();
   </script>

   <template>
   	<div class="new-feature">
   		<h1>New Feature</h1>
   	</div>
   </template>
   ```

2. Add route protection if needed in component or middleware

### Adding a New API Endpoint

1. Create handler in `server/api/`:

   ```typescript
   // server/api/newfeature/action.post.ts
   export default defineEventHandler(async (event) => {
   	const body = await readBody(event);
   	// Handle request
   	return { success: true };
   });
   ```

2. Add types to `app/types/index.ts` if needed

### Adding a New Realm

1. Update type in `app/types/index.ts`:

   ```typescript
   export type RealmId = "wotlk" | "wotlk-ip" | "new-realm";
   ```

2. Add config in `shared/utils/config/local.ts`:

   ```typescript
   export const realms: Record<RealmId, RealmConfig> = {
   	// ...existing
   	"new-realm": {
   		id: "new-realm",
   		realmId: 4,
   		name: "New Realm",
   		// ...
   	},
   };
   ```

3. Add database credentials to `.db.local.json`

### Adding a New Component

1. Create component in appropriate directory:

   ```vue
   <!-- app/components/feature/FeatureCard.vue -->
   <script setup lang="ts">
   interface Props {
   	title: string;
   	data: FeatureData;
   }
   const props = defineProps<Props>();
   </script>

   <template>
   	<div class="feature-card">
   		<h3>{{ title }}</h3>
   	</div>
   </template>
   ```

2. Components are auto-imported by Nuxt

## Testing

### Manual Testing

```bash
# Start dev server
pnpm dev:local

# Test API endpoints
curl http://localhost:3000/api/auth/me
curl http://localhost:3000/api/community/stats
```

### Database Testing

```bash
# Connect to auth database
mysql -h localhost -u acore -p acore_auth

# Test queries
SELECT COUNT(*) FROM account;
SELECT * FROM account_access WHERE gmlevel > 0;
```

## Code Style

### TypeScript

- Use strict mode
- Define types for all API responses
- Use type inference where possible
- Avoid `any` type

### Vue Components

- Use `<script setup>` syntax
- Use Composition API
- Define props with TypeScript interfaces
- Use PascalCase for component names

### Naming Conventions

| Type        | Convention                  | Example               |
| ----------- | --------------------------- | --------------------- |
| Components  | PascalCase                  | `AccountCard.vue`     |
| Composables | camelCase with `use` prefix | `useAuth.ts`          |
| Stores      | camelCase with `use` prefix | `useAuthStore`        |
| API routes  | kebab-case                  | `get-accounts.get.ts` |
| Types       | PascalCase                  | `AccountMapping`      |

### File Organization

- Group by feature, not type
- Keep related files together
- Use index files for exports

## Contributing

### Commit Messages

Use conventional commits:

```
feat: add character rename feature
fix: resolve login redirect issue
docs: update API documentation
refactor: simplify auth flow
```

### Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and commit
4. Push to your fork
5. Open a Pull Request

### Code Review Checklist

- [ ] Code follows style guidelines
- [ ] Types are properly defined
- [ ] No console.log in production code
- [ ] API errors are properly handled
- [ ] Documentation is updated
- [ ] No sensitive data exposed

### Getting Help

- Check existing issues
- Read the documentation
- Join the community Discord
