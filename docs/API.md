# API Reference

Complete reference for all backend API endpoints.

## Table of Contents

- [Authentication](#authentication)
- [Accounts](#accounts)
- [Characters](#characters)
- [Community](#community)
- [Admin](#admin)
- [Downloads](#downloads)
- [Error Handling](#error-handling)

## Authentication

### Get Current User

Returns the currently authenticated user with GM status.

```http
GET /api/auth/me
```

**Response**

```json
{
	"sub": "user123",
	"preferred_username": "testuser",
	"email": "test@example.com",
	"email_verified": true,
	"isGM": true,
	"gmLevel": 3
}
```

**Response Codes**
| Code | Description |
|------|-------------|
| 200 | Success |
| 401 | Not authenticated |

### Logout

Clears the user session.

```http
POST /api/auth/logout
```

**Response**

```json
{
	"success": true
}
```

## Accounts

### Get User Accounts

Get all WoW accounts linked to an external auth user.

```http
GET /api/accounts/user/:externalId
```

**Parameters**
| Name | Type | Description |
|------|------|-------------|
| `externalId` | string | External auth user ID |

**Response**

```json
[
	{
		"mapping": {
			"externalId": "user123",
			"displayName": "testuser",
			"email": "user@example.com",
			"wowAccountId": 1,
			"wowAccountName": "WOWACCOUNT",
			"createdAt": "2024-01-15T10:30:00Z",
			"lastUsed": "2024-01-20T15:45:00Z"
		},
		"wowAccount": {
			"id": 1,
			"username": "WOWACCOUNT",
			"email": "user@example.com",
			"last_login": "2024-01-20T15:45:00Z",
			"expansion": 2
		},
		"realms": [
			{
				"realm": {
					"id": "1",
					"name": "Azeroth WoTLK"
				},
				"characters": [
					{
						"guid": 1,
						"name": "Thrall",
						"race": 2,
						"class": 1,
						"level": 80
					}
				]
			}
		]
	}
]
```

### Create Account

Create a new WoW account in the auth database.

```http
POST /api/accounts/create
```

**Request Body**

```json
{
	"username": "newaccount",
	"password": "securePassword123",
	"email": "user@example.com"
}
```

**Validation Rules**

- Username: 3-16 characters, alphanumeric only
- Password: minimum 8 characters
- Email: valid format (optional)

**Response**

```json
{
	"success": true,
	"account": {
		"id": 42,
		"username": "NEWACCOUNT",
		"email": "user@example.com",
		"expansion": 2,
		"joindate": "2024-01-20T10:00:00Z"
	}
}
```

**Error Codes**
| Code | Description |
|------|-------------|
| 400 | Validation failed |
| 409 | Account already exists |
| 500 | Server error |

### Link Account

Link a WoW account to the current external auth user. Only available when using external authentication modes.

```http
POST /api/accounts/map
```

**Request Body**

```json
{
	"externalId": "user123",
	"wowAccountName": "MYACCOUNT",
	"wowAccountPassword": "mypassword"
}
```

**Response**

```json
{
	"mapping": {
		"externalId": "user123",
		"displayName": "testuser",
		"wowAccountId": 1,
		"wowAccountName": "MYACCOUNT",
		"createdAt": "2024-01-20T10:00:00Z"
	},
	"wowAccount": {
		/* ... */
	},
	"realms": [
		/* ... */
	]
}
```

**Error Codes**
| Code | Description |
|------|-------------|
| 400 | Missing fields |
| 401 | Invalid WoW credentials |
| 409 | Account already linked |

### Unlink Account

Remove a WoW account link.

```http
DELETE /api/accounts/map/:externalId/:wowAccountId
```

**Response**

```json
{
	"success": true
}
```

### Change Password

Change password for a linked WoW account.

```http
POST /api/accounts/password
```

**Request Body**

```json
{
	"wowAccountId": 1,
	"currentPassword": "oldpassword",
	"newPassword": "newpassword123"
}
```

**Response**

```json
{
	"success": true,
	"message": "Password changed successfully"
}
```

## Characters

### Get Character Details

Get detailed information about a character.

```http
GET /api/characters/:guid
```

**Query Parameters**
| Name | Type | Description |
|------|------|-------------|
| `realm` | string | Realm ID (e.g., "1") |

**Response**

```json
{
	"character": {
		"guid": 1,
		"name": "Thrall",
		"race": 2,
		"class": 1,
		"gender": 0,
		"level": 80,
		"money": 1000000,
		"playedTime": 360000
	},
	"equipment": [
		{
			"slot": 0,
			"itemId": 12345,
			"name": "Helm of Valor",
			"quality": 4,
			"itemLevel": 200,
			"enchantments": [
				{
					"id": 3820,
					"name": "+30 Stamina and Minor Speed"
				}
			]
		}
	],
	"stats": {
		/* ... */
	},
	"talents": {
		/* ... */
	}
}
```

### Character Actions

Perform actions on a character.

```http
POST /api/characters/action
```

**Request Body**

```json
{
	"guid": 1,
	"realm": "1",
	"action": "rename",
	"params": {
		"newName": "NewThrall"
	}
}
```

**Available Actions**
| Action | Description | Params |
|--------|-------------|--------|
| `rename` | Rename character | `newName` |
| `unstuck` | Reset position | - |
| `restore` | Restore deleted | - |

## Community

### Get Online Players

List currently online players.

```http
GET /api/community/online
```

**Query Parameters**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `realm` | string | `all` | Filter by realm |

**Response**

```json
{
	"players": [
		{
			"guid": 1,
			"name": "Thrall",
			"race": 2,
			"class": 1,
			"level": 80,
			"zone": "Orgrimmar",
			"realm": "1"
		}
	],
	"total": 42,
	"bots": 10
}
```

### Get Server Stats

Get aggregate server statistics.

```http
GET /api/community/stats
```

**Query Parameters**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `realm` | string | `all` | Filter by realm |

**Response**

```json
{
	"onlinePlayers": 42,
	"onlineBots": 10,
	"totalAccounts": 1500,
	"totalCharacters": 3200,
	"totalGuilds": 45,
	"maxLevelCharacters": 800,
	"averageLevel": 45,
	"activeRealms": 3
}
```

### Get Top Players

Get player leaderboards.

```http
GET /api/community/top-players
```

**Query Parameters**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `realm` | string | `all` | Filter by realm |
| `metric` | string | `level` | Ranking metric |
| `limit` | number | `10` | Number of results |

**Metrics**

- `level` - Highest level characters
- `playtime` - Most played characters
- `achievements` - Most achievement points

**Response**

```json
{
	"metric": "level",
	"players": [
		{
			"rank": 1,
			"name": "Thrall",
			"class": 1,
			"race": 2,
			"level": 80,
			"value": 80,
			"realm": "1"
		}
	]
}
```

### Get PvP Stats

Get PvP rankings and statistics.

```http
GET /api/community/pvp-stats
```

**Response**

```json
{
	"arena": {
		"2v2": [
			/* top teams */
		],
		"3v3": [
			/* top teams */
		],
		"5v5": [
			/* top teams */
		]
	},
	"honorKills": [
		/* top players */
	]
}
```

## Admin

All admin endpoints require GM level ≥ 1.

### List All Accounts

Get paginated list of all accounts.

```http
GET /api/admin/accounts
```

**Query Parameters**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `page` | number | `1` | Page number |
| `limit` | number | `50` | Items per page |
| `search` | string | - | Search by username |

**Response**

```json
{
	"accounts": [
		{
			"id": 1,
			"username": "TESTUSER",
			"email": "test@example.com",
			"joindate": "2024-01-01",
			"last_login": "2024-01-20",
			"expansion": 2,
			"gmlevel": 0
		}
	],
	"total": 1500,
	"page": 1,
	"pages": 30
}
```

### Get Account Mappings

Get all external-to-WoW account mappings.

```http
GET /api/admin/account-mappings
```

**Response**

```json
{
	"mappings": [
		{
			"id": 1,
			"externalId": "user123",
			"displayName": "testuser",
			"email": "user@example.com",
			"wowAccountId": 1,
			"wowAccountUsername": "WOWACCOUNT",
			"createdAt": "2024-01-15"
		}
	]
}
```

### Set GM Level

Assign or revoke GM privileges.

```http
POST /api/admin/gm/set-level
```

**Request Body**

```json
{
	"accountId": 1,
	"gmLevel": 2,
	"realmId": -1
}
```

**Notes**

- `realmId: -1` grants access to all realms
- Only admins (level 3) can grant level 2+
- Cannot modify your own GM level

### Send Mail

Send in-game mail to players.

```http
POST /api/admin/mail/send
```

**Request Body**

```json
{
	"realm": "1",
	"recipient": "Thrall",
	"subject": "Welcome!",
	"body": "Welcome to our server!",
	"items": [{ "itemId": 12345, "count": 1 }],
	"money": 10000
}
```

### File Management

#### List Files

```http
GET /api/admin/files
```

#### Upload File

```http
POST /api/admin/files/upload
Content-Type: multipart/form-data
```

#### Delete File

```http
DELETE /api/admin/files/:filename
```

### Export Data

Export account or character data.

```http
POST /api/admin/export
```

**Request Body**

```json
{
	"type": "accounts",
	"format": "csv",
	"filters": {
		"dateFrom": "2024-01-01",
		"dateTo": "2024-01-31"
	}
}
```

## Downloads

### List Available Files

Get list of downloadable files.

```http
GET /api/downloads/list
```

**Response**

```json
[
	{
		"name": "wow-client-3.3.5a.7z",
		"size": 15728640000,
		"modified": "2024-01-15T10:00:00Z"
	}
]
```

### Download File

Download a file with resume support.

```http
GET /api/downloads/:filename
```

**Headers**

- `Range: bytes=0-1000` - Resume support

**Response Headers**

- `Accept-Ranges: bytes`
- `Content-Length: <size>`
- `Content-Disposition: attachment; filename="<name>"`

## Error Handling

### Error Response Format

```json
{
	"statusCode": 400,
	"statusMessage": "Bad Request",
	"message": "Detailed error message"
}
```

### Common Status Codes

| Code | Description                          |
| ---- | ------------------------------------ |
| 200  | Success                              |
| 400  | Bad Request - Invalid input          |
| 401  | Unauthorized - Not authenticated     |
| 403  | Forbidden - Insufficient permissions |
| 404  | Not Found - Resource doesn't exist   |
| 409  | Conflict - Resource already exists   |
| 500  | Server Error - Internal error        |

### Rate Limiting

Currently no rate limiting is implemented. For production, consider adding rate limiting at the ingress/proxy level.
