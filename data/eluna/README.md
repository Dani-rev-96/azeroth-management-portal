# Eluna Worker Script

This Lua script runs on your AzerothCore game server with the Eluna Lua Engine installed. It processes queue tables to safely handle web-initiated operations like item delivery and money modifications.

## Why This Script Is Needed

The AzerothCore world server maintains an internal counter for `item_instance` GUIDs. When the server starts, it loads the highest existing GUID and generates new GUIDs from there.

**The Problem**: If you insert items directly into `item_instance` via SQL while the server is running, the server doesn't know about these entries. When it creates new items, it may reuse GUIDs that were already assigned by your SQL inserts, causing:

- Items to disappear when players log in
- Duplicate item entries
- Database corruption

**The Solution**: The worker script uses the server's native APIs (`SendMail`, `Player:AddItem()`) which properly allocate GUIDs through the server's internal systems.

## Installation

1. Copy `web_worker.lua` to your AzerothCore `lua_scripts` directory
2. Restart the world server or reload lua scripts (`.reload eluna`)

The script will automatically create its queue tables on startup.

## Unified Design

The script uses a **single polling timer** to process all three queue types efficiently:

- Reduces database connections compared to separate scripts
- Shares common utility functions
- Single point of maintenance

## Queue Tables

All tables are created in `acore_characters` database.

### web_money_requests

Processes money additions and deductions for characters (online or offline).

| Column         | Type                           | Description                                   |
| -------------- | ------------------------------ | --------------------------------------------- |
| id             | BIGINT UNSIGNED AUTO_INCREMENT | Request ID                                    |
| character_guid | INT UNSIGNED                   | Target character GUID                         |
| delta_copper   | BIGINT                         | Amount to add (positive) or remove (negative) |
| reason         | VARCHAR(255)                   | Human-readable reason                         |
| status         | ENUM('pending','done','error') | Processing status                             |
| error_text     | VARCHAR(255)                   | Error message if failed                       |
| created_at     | TIMESTAMP                      | When the request was created                  |
| processed_at   | TIMESTAMP                      | When the request was processed                |

**Example Insert**:

```sql
INSERT INTO web_money_requests (character_guid, delta_copper, reason, status)
VALUES (1234, 100000, 'Shop refund: 10 gold', 'pending');
```

### web_item_requests

Delivers items to characters via in-game mail using the server's native `SendMail` function.

| Column         | Type                           | Description                                    |
| -------------- | ------------------------------ | ---------------------------------------------- |
| id             | BIGINT UNSIGNED AUTO_INCREMENT | Request ID                                     |
| character_guid | INT UNSIGNED                   | Target character GUID                          |
| item_entry     | INT UNSIGNED                   | Item template entry ID (0 for money-only mail) |
| item_count     | INT UNSIGNED                   | Quantity of items                              |
| mail_subject   | VARCHAR(128)                   | Mail subject line                              |
| mail_body      | VARCHAR(8000)                  | Mail body text                                 |
| money          | INT UNSIGNED                   | Money to include in mail (copper)              |
| reason         | VARCHAR(255)                   | Human-readable reason                          |
| status         | ENUM('pending','done','error') | Processing status                              |
| error_text     | VARCHAR(255)                   | Error message if failed                        |
| created_at     | TIMESTAMP                      | When the request was created                   |
| processed_at   | TIMESTAMP                      | When the request was processed                 |

**Example Insert**:

```sql
-- Send item via mail
INSERT INTO web_item_requests (character_guid, item_entry, item_count, mail_subject, mail_body, reason, status)
VALUES (1234, 49623, 1, 'Shop Purchase', 'Thanks for your purchase!', 'Shop: Shadowmourne', 'pending');

-- Send money-only mail
INSERT INTO web_item_requests (character_guid, item_entry, item_count, mail_subject, mail_body, money, reason, status)
VALUES (1234, 0, 0, 'GM Gift', 'Here is some gold!', 1000000, 'GM gift: 100g', 'pending');
```

### web_bag_requests

Delivers items directly to character bags using `Player:AddItem()`. Requires the player to be online.

| Column         | Type                                     | Description                    |
| -------------- | ---------------------------------------- | ------------------------------ |
| id             | BIGINT UNSIGNED AUTO_INCREMENT           | Request ID                     |
| character_guid | INT UNSIGNED                             | Target character GUID          |
| item_entry     | INT UNSIGNED                             | Item template entry ID         |
| item_count     | INT UNSIGNED                             | Quantity of items              |
| reason         | VARCHAR(255)                             | Human-readable reason          |
| status         | ENUM('pending','done','error','waiting') | Processing status              |
| error_text     | VARCHAR(255)                             | Error message if failed        |
| created_at     | TIMESTAMP                                | When the request was created   |
| processed_at   | TIMESTAMP                                | When the request was processed |

**Status Values**:

- `pending` - New request, will be processed on next poll
- `waiting` - Player was offline, will be retried on next poll or when they log in
- `done` - Successfully processed
- `error` - Failed (see error_text)

**Example Insert**:

```sql
INSERT INTO web_bag_requests (character_guid, item_entry, item_count, reason, status)
VALUES (1234, 49623, 1, 'Shop purchase: Shadowmourne', 'pending');
```

## Player Login Hook

The script also registers for `PLAYER_EVENT_ON_LOGIN` to immediately process any `waiting` bag requests when a player logs in. This ensures items are delivered as soon as the player is available.

## Polling Interval

The script polls all queue tables every 1000ms (1 second) by default. You can modify this by changing `POLL_INTERVAL_MS` at the top of the script.

## Batch Size

Each poll processes up to 50 pending requests per table. You can modify this by changing `BATCH_SIZE` at the top of the script.

## Logging

The script logs its activity using `PrintInfo` and `PrintError`. Look for entries prefixed with `[web_worker]` in your server logs.

## Error Handling

- Failed requests are marked with `status='error'` and include an error message in `error_text`
- The script validates that characters exist before processing
- Items are validated against `item_template` before sending
- Money operations check for sufficient funds when deducting
- Bag operations check for bags full condition

## Used By

This script is used by the web frontend's:

- **Shop** - For purchasing items with gold (bag or mail delivery)
- **GM Mail** - For sending items to players
- **Future features** - Any feature that needs to safely modify character data

## Requirements

- AzerothCore with Eluna Lua Engine
- Access to character database for queue tables
- Access to world database for item validation
