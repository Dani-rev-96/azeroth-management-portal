--[[
    web_worker.lua

    Unified worker script that polls queue tables and processes:
    - Money additions/deductions (web_money_requests)
    - Item delivery via mail (web_item_requests)
    - Direct-to-bag item delivery (web_bag_requests)
    - Spell learning (web_spell_requests)
    - Aura/debuff application (web_aura_requests)
    - Teleportation to coordinates (web_teleport_requests)
    - Level setting (web_level_requests)
    - Skill/profession setting (web_skill_requests)
    - Reputation setting (web_reputation_requests)
    - Quest completion (web_quest_requests)
    - Title management (web_title_requests)

    Using a single polling timer is more efficient than separate scripts,
    reduces database connections, and shares common utility functions.

    The tables are auto-created if they don't exist.

    Supports multiple items per mail (up to 12) via items_json column.
    Format: [{"entry":12345,"count":1},{"entry":67890,"count":2}]

    Author: AzerothCore Nix Flake Project
    Version: 2.10
]]

local SCRIPT_NAME = "web_worker"
local POLL_INTERVAL_MS = 1000
local BATCH_SIZE = 50

-- Mail constants
local MAIL_STATIONERY_DEFAULT = 61 -- GM stationery
-- Note: WoW allows max 12 different item types per mail
-- For a single item type, the stack size is limited by the item's max stack size

--------------------------------------------------------------------------------
-- Table Creation SQL (runs once on startup)
--------------------------------------------------------------------------------

local CREATE_MONEY_TABLE_SQL = [[
CREATE TABLE IF NOT EXISTS web_money_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    character_guid INT UNSIGNED NOT NULL,
    delta_copper BIGINT NOT NULL,
    reason VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL DEFAULT NULL,
    status ENUM('pending','done','error') NOT NULL DEFAULT 'pending',
    error_text VARCHAR(255) NULL,
    PRIMARY KEY (id),
    KEY idx_pending (status, created_at),
    KEY idx_char (character_guid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
]]

local CREATE_ITEM_TABLE_SQL = [[
CREATE TABLE IF NOT EXISTS web_item_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    character_guid INT UNSIGNED NOT NULL,
    item_entry INT UNSIGNED NOT NULL DEFAULT 0,
    item_count INT UNSIGNED NOT NULL DEFAULT 1,
    items_json TEXT NULL,
    mail_subject VARCHAR(128) NULL DEFAULT 'Web Delivery',
    mail_body VARCHAR(8000) NULL DEFAULT 'Your items have been delivered.',
    money INT UNSIGNED NOT NULL DEFAULT 0,
    reason VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL DEFAULT NULL,
    status ENUM('pending','done','error') NOT NULL DEFAULT 'pending',
    error_text VARCHAR(255) NULL,
    PRIMARY KEY (id),
    KEY idx_pending (status, created_at),
    KEY idx_char (character_guid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
]]

-- Migration: Add items_json column if it doesn't exist
-- We check if the column exists first since MySQL doesn't support ADD COLUMN IF NOT EXISTS
local CHECK_ITEMS_JSON_COLUMN_SQL = [[
SELECT COUNT(*) FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'web_item_requests'
AND COLUMN_NAME = 'items_json'
]]

local ADD_ITEMS_JSON_COLUMN_SQL = [[
ALTER TABLE web_item_requests ADD COLUMN items_json TEXT NULL AFTER item_count
]]

local CREATE_BAG_TABLE_SQL = [[
CREATE TABLE IF NOT EXISTS web_bag_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    character_guid INT UNSIGNED NOT NULL,
    item_entry INT UNSIGNED NOT NULL,
    item_count INT UNSIGNED NOT NULL DEFAULT 1,
    reason VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL DEFAULT NULL,
    status ENUM('pending','done','error','waiting') NOT NULL DEFAULT 'pending',
    error_text VARCHAR(255) NULL,
    PRIMARY KEY (id),
    KEY idx_pending (status, created_at),
    KEY idx_char (character_guid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
]]

local CREATE_SPELL_TABLE_SQL = [[
CREATE TABLE IF NOT EXISTS web_spell_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    character_guid INT UNSIGNED NOT NULL,
    spell_id INT UNSIGNED NOT NULL,
    reason VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL DEFAULT NULL,
    status ENUM('pending','done','error','waiting') NOT NULL DEFAULT 'pending',
    error_text VARCHAR(255) NULL,
    PRIMARY KEY (id),
    KEY idx_pending (status, created_at),
    KEY idx_char (character_guid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
]]

local CREATE_AURA_TABLE_SQL = [[
CREATE TABLE IF NOT EXISTS web_aura_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    character_guid INT UNSIGNED NOT NULL,
    spell_id INT UNSIGNED NOT NULL,
    duration_ms INT UNSIGNED NOT NULL DEFAULT 0,
    stacks INT UNSIGNED NOT NULL DEFAULT 1,
    reason VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL DEFAULT NULL,
    status ENUM('pending','done','error','waiting') NOT NULL DEFAULT 'pending',
    error_text VARCHAR(255) NULL,
    PRIMARY KEY (id),
    KEY idx_pending (status, created_at),
    KEY idx_char (character_guid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
]]

local CREATE_TELEPORT_TABLE_SQL = [[
CREATE TABLE IF NOT EXISTS web_teleport_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    character_guid INT UNSIGNED NOT NULL,
    map_id INT UNSIGNED NOT NULL,
    x FLOAT NOT NULL,
    y FLOAT NOT NULL,
    z FLOAT NOT NULL,
    o FLOAT NOT NULL DEFAULT 0,
    reason VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL DEFAULT NULL,
    status ENUM('pending','done','error','waiting') NOT NULL DEFAULT 'pending',
    error_text VARCHAR(255) NULL,
    PRIMARY KEY (id),
    KEY idx_pending (status, created_at),
    KEY idx_char (character_guid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
]]

local CREATE_LEVEL_TABLE_SQL = [[
CREATE TABLE IF NOT EXISTS web_level_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    character_guid INT UNSIGNED NOT NULL,
    level TINYINT UNSIGNED NOT NULL,
    reason VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL DEFAULT NULL,
    status ENUM('pending','done','error','waiting') NOT NULL DEFAULT 'pending',
    error_text VARCHAR(255) NULL,
    PRIMARY KEY (id),
    KEY idx_pending (status, created_at),
    KEY idx_char (character_guid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
]]

local CREATE_SKILL_TABLE_SQL = [[
CREATE TABLE IF NOT EXISTS web_skill_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    character_guid INT UNSIGNED NOT NULL,
    skill_id SMALLINT UNSIGNED NOT NULL,
    skill_value SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    skill_max SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    reason VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL DEFAULT NULL,
    status ENUM('pending','done','error','waiting') NOT NULL DEFAULT 'pending',
    error_text VARCHAR(255) NULL,
    PRIMARY KEY (id),
    KEY idx_pending (status, created_at),
    KEY idx_char (character_guid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
]]

local CREATE_REPUTATION_TABLE_SQL = [[
CREATE TABLE IF NOT EXISTS web_reputation_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    character_guid INT UNSIGNED NOT NULL,
    faction_id INT UNSIGNED NOT NULL,
    standing INT NOT NULL DEFAULT 0,
    reason VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL DEFAULT NULL,
    status ENUM('pending','done','error','waiting') NOT NULL DEFAULT 'pending',
    error_text VARCHAR(255) NULL,
    PRIMARY KEY (id),
    KEY idx_pending (status, created_at),
    KEY idx_char (character_guid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
]]

local CREATE_QUEST_TABLE_SQL = [[
CREATE TABLE IF NOT EXISTS web_quest_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    character_guid INT UNSIGNED NOT NULL,
    quest_id INT UNSIGNED NOT NULL,
    action ENUM('complete','remove') NOT NULL DEFAULT 'complete',
    reason VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL DEFAULT NULL,
    status ENUM('pending','done','error','waiting') NOT NULL DEFAULT 'pending',
    error_text VARCHAR(255) NULL,
    PRIMARY KEY (id),
    KEY idx_pending (status, created_at),
    KEY idx_char (character_guid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
]]

local CREATE_TITLE_TABLE_SQL = [[
CREATE TABLE IF NOT EXISTS web_title_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    character_guid INT UNSIGNED NOT NULL,
    title_id INT UNSIGNED NOT NULL,
    action ENUM('add','remove') NOT NULL DEFAULT 'add',
    reason VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL DEFAULT NULL,
    status ENUM('pending','done','error','waiting') NOT NULL DEFAULT 'pending',
    error_text VARCHAR(255) NULL,
    PRIMARY KEY (id),
    KEY idx_pending (status, created_at),
    KEY idx_char (character_guid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
]]

--------------------------------------------------------------------------------
-- SQL Queries
--------------------------------------------------------------------------------

local SELECT_PENDING_MONEY_SQL = string.format(
    "SELECT id, character_guid, delta_copper, reason FROM web_money_requests WHERE status='pending' ORDER BY id ASC LIMIT %d",
    BATCH_SIZE
)

-- Note: items_json column may not exist on older installations
-- The query is built dynamically in initialize() after migration check
local SELECT_PENDING_ITEM_SQL = nil

local SELECT_PENDING_ITEM_WITH_JSON_SQL = string.format(
    "SELECT id, character_guid, item_entry, item_count, items_json, mail_subject, mail_body, money, reason FROM web_item_requests WHERE status='pending' ORDER BY id ASC LIMIT %d",
    BATCH_SIZE
)

local SELECT_PENDING_ITEM_LEGACY_SQL = string.format(
    "SELECT id, character_guid, item_entry, item_count, NULL as items_json, mail_subject, mail_body, money, reason FROM web_item_requests WHERE status='pending' ORDER BY id ASC LIMIT %d",
    BATCH_SIZE
)

-- For bag requests, we also select 'waiting' status (player was offline, retry)
local SELECT_PENDING_BAG_SQL = string.format(
    "SELECT id, character_guid, item_entry, item_count, reason FROM web_bag_requests WHERE status IN ('pending', 'waiting') ORDER BY id ASC LIMIT %d",
    BATCH_SIZE
)

-- For spell requests, we also select 'waiting' status (player was offline, retry)
local SELECT_PENDING_SPELL_SQL = string.format(
    "SELECT id, character_guid, spell_id, reason FROM web_spell_requests WHERE status IN ('pending', 'waiting') ORDER BY id ASC LIMIT %d",
    BATCH_SIZE
)

-- For aura requests, we also select 'waiting' status (player was offline, retry)
local SELECT_PENDING_AURA_SQL = string.format(
    "SELECT id, character_guid, spell_id, duration_ms, stacks, reason FROM web_aura_requests WHERE status IN ('pending', 'waiting') ORDER BY id ASC LIMIT %d",
    BATCH_SIZE
)

-- For teleport requests, we also select 'waiting' status (player was offline, retry)
local SELECT_PENDING_TELEPORT_SQL = string.format(
    "SELECT id, character_guid, map_id, x, y, z, o, reason FROM web_teleport_requests WHERE status IN ('pending', 'waiting') ORDER BY id ASC LIMIT %d",
    BATCH_SIZE
)

-- For level requests, we also select 'waiting' status (player was offline, retry)
local SELECT_PENDING_LEVEL_SQL = string.format(
    "SELECT id, character_guid, level, reason FROM web_level_requests WHERE status IN ('pending', 'waiting') ORDER BY id ASC LIMIT %d",
    BATCH_SIZE
)

-- For skill requests, we also select 'waiting' status (player was offline, retry)
local SELECT_PENDING_SKILL_SQL = string.format(
    "SELECT id, character_guid, skill_id, skill_value, skill_max, reason FROM web_skill_requests WHERE status IN ('pending', 'waiting') ORDER BY id ASC LIMIT %d",
    BATCH_SIZE
)

-- For reputation requests, we also select 'waiting' status (player was offline, retry)
local SELECT_PENDING_REPUTATION_SQL = string.format(
    "SELECT id, character_guid, faction_id, standing, reason FROM web_reputation_requests WHERE status IN ('pending', 'waiting') ORDER BY id ASC LIMIT %d",
    BATCH_SIZE
)

-- For quest requests, we also select 'waiting' status (player was offline, retry)
local SELECT_PENDING_QUEST_SQL = string.format(
    "SELECT id, character_guid, quest_id, action, reason FROM web_quest_requests WHERE status IN ('pending', 'waiting') ORDER BY id ASC LIMIT %d",
    BATCH_SIZE
)

-- For title requests, we also select 'waiting' status (player was offline, retry)
local SELECT_PENDING_TITLE_SQL = string.format(
    "SELECT id, character_guid, title_id, action, reason FROM web_title_requests WHERE status IN ('pending', 'waiting') ORDER BY id ASC LIMIT %d",
    BATCH_SIZE
)

--------------------------------------------------------------------------------
-- Utility Functions
--------------------------------------------------------------------------------

--- Escape single quotes for SQL
---@param str string
---@return string
local function escapeSql(str)
    if not str then return "" end
    return tostring(str):gsub("'", "''"):sub(1, 250)
end

--- Simple JSON array parser for items
--- Parses: [[1019,1],[2576,1]] (array of [entry, count] pairs)
--- Also supports legacy format: [{"entry":12345,"count":1},{"entry":67890,"count":2}]
---@param jsonStr string|nil
---@return table|nil items Array of {entry=number, count=number} or nil on error
local function parseItemsJson(jsonStr)
    if not jsonStr or jsonStr == "" then
        return nil
    end

    local items = {}

    -- Try array format first: [[1019,1],[2576,1]]
    -- Match pairs like [1019,1] inside the outer array
    for entryStr, countStr in jsonStr:gmatch('%[%s*(%d+)%s*,%s*(%d+)%s*%]') do
        local entry = tonumber(entryStr)
        local count = tonumber(countStr)
        if entry and entry > 0 and count and count > 0 then
            table.insert(items, { entry = entry, count = count })
        end
    end

    -- If array format didn't find anything, try object format: {"entry":12345,"count":1}
    if #items == 0 then
        for entryStr, countStr in jsonStr:gmatch('"entry"%s*:%s*(%d+)%s*,%s*"count"%s*:%s*(%d+)') do
            local entry = tonumber(entryStr)
            local count = tonumber(countStr)
            if entry and entry > 0 and count and count > 0 then
                table.insert(items, { entry = entry, count = count })
            end
        end

        -- Also try reverse order: {"count":1,"entry":12345}
        for countStr, entryStr in jsonStr:gmatch('"count"%s*:%s*(%d+)%s*,%s*"entry"%s*:%s*(%d+)') do
            local entry = tonumber(entryStr)
            local count = tonumber(countStr)
            if entry and entry > 0 and count and count > 0 then
                -- Check if already added (avoid duplicates)
                local exists = false
                for _, item in ipairs(items) do
                    if item.entry == entry and item.count == count then
                        exists = true
                        break
                    end
                end
                if not exists then
                    table.insert(items, { entry = entry, count = count })
                end
            end
        end
    end

    if #items > 0 then
        PrintInfo(string.format("[%s] parseItemsJson: Parsed %d items from '%s'",
            SCRIPT_NAME, #items, jsonStr:sub(1, 50)))
        return items
    end

    PrintError(string.format("[%s] parseItemsJson: Failed to parse '%s'", SCRIPT_NAME, jsonStr:sub(1, 100)))
    return nil
end

--- Mark a request as successfully processed
---@param table_name string
---@param id number
local function markDone(table_name, id)
    CharDBExecute(string.format(
        "UPDATE %s SET status='done', processed_at=NOW() WHERE id=%d",
        table_name, id
    ))
end

--- Mark a request as failed with error text
---@param table_name string
---@param id number
---@param err string|nil
local function markError(table_name, id, err)
    local errText = escapeSql(err or "unknown error")
    CharDBExecute(string.format(
        "UPDATE %s SET status='error', error_text='%s', processed_at=NOW() WHERE id=%d",
        table_name, errText, id
    ))
end

--- Mark a bag request as waiting (player offline)
---@param id number
local function markWaiting(id)
    CharDBExecute(string.format(
        "UPDATE web_bag_requests SET status='waiting' WHERE id=%d",
        id
    ))
end

--- Mark a spell request as waiting (player offline)
---@param id number
local function markWaitingSpell(id)
    CharDBExecute(string.format(
        "UPDATE web_spell_requests SET status='waiting' WHERE id=%d",
        id
    ))
end

--- Mark an aura request as waiting (player offline)
---@param id number
local function markWaitingAura(id)
    CharDBExecute(string.format(
        "UPDATE web_aura_requests SET status='waiting' WHERE id=%d",
        id
    ))
end

--- Mark a teleport request as waiting (player offline)
---@param id number
local function markWaitingTeleport(id)
    CharDBExecute(string.format(
        "UPDATE web_teleport_requests SET status='waiting' WHERE id=%d",
        id
    ))
end

--- Mark a level request as waiting (player offline)
---@param id number
local function markWaitingLevel(id)
    CharDBExecute(string.format(
        "UPDATE web_level_requests SET status='waiting' WHERE id=%d",
        id
    ))
end

--- Mark a skill request as waiting (player offline)
---@param id number
local function markWaitingSkill(id)
    CharDBExecute(string.format(
        "UPDATE web_skill_requests SET status='waiting' WHERE id=%d",
        id
    ))
end

--- Mark a reputation request as waiting (player offline)
---@param id number
local function markWaitingReputation(id)
    CharDBExecute(string.format(
        "UPDATE web_reputation_requests SET status='waiting' WHERE id=%d",
        id
    ))
end

--- Mark a quest request as waiting (player offline)
---@param id number
local function markWaitingQuest(id)
    CharDBExecute(string.format(
        "UPDATE web_quest_requests SET status='waiting' WHERE id=%d",
        id
    ))
end

--- Mark a title request as waiting (player offline)
---@param id number
local function markWaitingTitle(id)
    CharDBExecute(string.format(
        "UPDATE web_title_requests SET status='waiting' WHERE id=%d",
        id
    ))
end

--- Validate item exists in world database
---@param itemEntry number
---@return boolean exists
local function validateItemEntry(itemEntry)
    if itemEntry == 0 then
        return true -- 0 means money-only for mail
    end
    local query = WorldDBQuery(string.format(
        "SELECT entry FROM item_template WHERE entry = %d LIMIT 1",
        itemEntry
    ))
    return query ~= nil
end

--- Get character name by GUID
---@param guid number
---@return string|nil name
local function getCharacterName(guid)
    local query = CharDBQuery(string.format(
        "SELECT name FROM characters WHERE guid = %d",
        guid
    ))
    if query then
        return query:GetString(0)
    end
    return nil
end

--------------------------------------------------------------------------------
-- Money Request Processing
--------------------------------------------------------------------------------

--- Process a single money request row
---@param row userdata Query row
---@return boolean success
local function processMoneyRow(row)
    local id = tonumber(row:GetUInt32(0))
    local guid = tonumber(row:GetUInt32(1))
    local delta = tonumber(row:GetInt32(2))
    local reason = row:GetString(3)

    if not id or id == 0 then
        PrintError(string.format("[%s] Money: Invalid request id", SCRIPT_NAME))
        return false
    end

    if not guid or guid == 0 then
        markError("web_money_requests", id, "invalid character_guid")
        return false
    end

    if not delta then
        markError("web_money_requests", id, "invalid delta_copper value")
        return false
    end

    -- Try online player first
    local player = GetPlayerByGUID(guid)

    if player then
        local currentMoney = tonumber(player:GetCoinage())
        local newMoney = currentMoney + delta

        if newMoney < 0 then
            markError("web_money_requests", id, string.format(
                "insufficient funds: has %d, needs %d", currentMoney, -delta
            ))
            return false
        end

        player:ModifyMoney(delta)
        player:SaveToDB()

        -- Notify player
        if reason and reason ~= "" then
            player:SendBroadcastMessage(string.format("|cff00ff00[Shop]|r %s", reason))
        else
            if delta > 0 then
                player:SendBroadcastMessage(string.format(
                    "|cff00ff00[Shop]|r You received %s", GetCoinTextureString(delta)
                ))
            else
                player:SendBroadcastMessage(string.format(
                    "|cff00ff00[Shop]|r %s was deducted", GetCoinTextureString(-delta)
                ))
            end
        end

        PrintInfo(string.format("[%s] Money: Processed %d for online player %d (delta: %d)",
            SCRIPT_NAME, id, guid, delta))
        markDone("web_money_requests", id)
        return true
    else
        -- Player offline - update database directly
        local query = CharDBQuery(string.format(
            "SELECT money FROM characters WHERE guid = %d", guid
        ))

        if not query then
            markError("web_money_requests", id, "character not found")
            return false
        end

        local currentMoney = tonumber(query:GetUInt32(0)) or 0

        if delta < 0 and currentMoney + delta < 0 then
            markError("web_money_requests", id, string.format(
                "insufficient funds (offline): has %d, needs %d", currentMoney, -delta
            ))
            return false
        end

        CharDBExecute(string.format(
            "UPDATE characters SET money = GREATEST(0, CAST(money AS SIGNED) + (%d)) WHERE guid = %d",
            delta, guid
        ))

        PrintInfo(string.format("[%s] Money: Processed %d for offline player %d (delta: %d)",
            SCRIPT_NAME, id, guid, delta))
        markDone("web_money_requests", id)
        return true
    end
end

--------------------------------------------------------------------------------
-- Mail Item Request Processing
--------------------------------------------------------------------------------

--- Send mail with multiple items using the global SendMail function
--- Eluna's SendMail signature allows multiple entry,count pairs at the end:
---   SendMail(subject, text, receiverGUIDLow, senderGUIDLow, stationary, delay, money, cod, entry1, count1, entry2, count2, ...)
--- Maximum 12 different items per mail.
---@param guid number Character GUID (low)
---@param subject string Mail subject
---@param body string Mail body
---@param money number Money in copper
---@param items table Array of {entry=number, count=number} or nil for money-only
---@return boolean success, string|nil errorMessage
local function sendMailWithItems(guid, subject, body, money, items)
    local itemCount = items and #items or 0

    -- Debug logging
    PrintInfo(string.format("[%s] sendMailWithItems: guid=%d, items=%d, money=%d",
        SCRIPT_NAME, guid, itemCount, money))

    if itemCount > 12 then
        return false, "Too many items (max 12 per mail)"
    end

    -- Use global SendMail function with varargs for items
    local ok, err = pcall(function()
        if itemCount == 0 then
            -- Money-only mail (no items)
            SendMail(
                subject,                    -- 1: subject (string)
                body,                       -- 2: text/body (string)
                guid,                       -- 3: receiver GUID low (number)
                0,                          -- 4: sender GUID low (0 = system)
                MAIL_STATIONERY_DEFAULT,    -- 5: stationery type (number)
                0,                          -- 6: delay in seconds (number)
                money,                      -- 7: money in copper (number)
                0                           -- 8: COD amount (number)
            )
        elseif itemCount == 1 then
            -- Single item
            SendMail(subject, body, guid, 0, MAIL_STATIONERY_DEFAULT, 0, money, 0,
                items[1].entry, items[1].count)
        elseif itemCount == 2 then
            SendMail(subject, body, guid, 0, MAIL_STATIONERY_DEFAULT, 0, money, 0,
                items[1].entry, items[1].count,
                items[2].entry, items[2].count)
        elseif itemCount == 3 then
            SendMail(subject, body, guid, 0, MAIL_STATIONERY_DEFAULT, 0, money, 0,
                items[1].entry, items[1].count,
                items[2].entry, items[2].count,
                items[3].entry, items[3].count)
        elseif itemCount == 4 then
            SendMail(subject, body, guid, 0, MAIL_STATIONERY_DEFAULT, 0, money, 0,
                items[1].entry, items[1].count,
                items[2].entry, items[2].count,
                items[3].entry, items[3].count,
                items[4].entry, items[4].count)
        elseif itemCount == 5 then
            SendMail(subject, body, guid, 0, MAIL_STATIONERY_DEFAULT, 0, money, 0,
                items[1].entry, items[1].count,
                items[2].entry, items[2].count,
                items[3].entry, items[3].count,
                items[4].entry, items[4].count,
                items[5].entry, items[5].count)
        elseif itemCount == 6 then
            SendMail(subject, body, guid, 0, MAIL_STATIONERY_DEFAULT, 0, money, 0,
                items[1].entry, items[1].count,
                items[2].entry, items[2].count,
                items[3].entry, items[3].count,
                items[4].entry, items[4].count,
                items[5].entry, items[5].count,
                items[6].entry, items[6].count)
        elseif itemCount == 7 then
            SendMail(subject, body, guid, 0, MAIL_STATIONERY_DEFAULT, 0, money, 0,
                items[1].entry, items[1].count,
                items[2].entry, items[2].count,
                items[3].entry, items[3].count,
                items[4].entry, items[4].count,
                items[5].entry, items[5].count,
                items[6].entry, items[6].count,
                items[7].entry, items[7].count)
        elseif itemCount == 8 then
            SendMail(subject, body, guid, 0, MAIL_STATIONERY_DEFAULT, 0, money, 0,
                items[1].entry, items[1].count,
                items[2].entry, items[2].count,
                items[3].entry, items[3].count,
                items[4].entry, items[4].count,
                items[5].entry, items[5].count,
                items[6].entry, items[6].count,
                items[7].entry, items[7].count,
                items[8].entry, items[8].count)
        elseif itemCount == 9 then
            SendMail(subject, body, guid, 0, MAIL_STATIONERY_DEFAULT, 0, money, 0,
                items[1].entry, items[1].count,
                items[2].entry, items[2].count,
                items[3].entry, items[3].count,
                items[4].entry, items[4].count,
                items[5].entry, items[5].count,
                items[6].entry, items[6].count,
                items[7].entry, items[7].count,
                items[8].entry, items[8].count,
                items[9].entry, items[9].count)
        elseif itemCount == 10 then
            SendMail(subject, body, guid, 0, MAIL_STATIONERY_DEFAULT, 0, money, 0,
                items[1].entry, items[1].count,
                items[2].entry, items[2].count,
                items[3].entry, items[3].count,
                items[4].entry, items[4].count,
                items[5].entry, items[5].count,
                items[6].entry, items[6].count,
                items[7].entry, items[7].count,
                items[8].entry, items[8].count,
                items[9].entry, items[9].count,
                items[10].entry, items[10].count)
        elseif itemCount == 11 then
            SendMail(subject, body, guid, 0, MAIL_STATIONERY_DEFAULT, 0, money, 0,
                items[1].entry, items[1].count,
                items[2].entry, items[2].count,
                items[3].entry, items[3].count,
                items[4].entry, items[4].count,
                items[5].entry, items[5].count,
                items[6].entry, items[6].count,
                items[7].entry, items[7].count,
                items[8].entry, items[8].count,
                items[9].entry, items[9].count,
                items[10].entry, items[10].count,
                items[11].entry, items[11].count)
        elseif itemCount == 12 then
            SendMail(subject, body, guid, 0, MAIL_STATIONERY_DEFAULT, 0, money, 0,
                items[1].entry, items[1].count,
                items[2].entry, items[2].count,
                items[3].entry, items[3].count,
                items[4].entry, items[4].count,
                items[5].entry, items[5].count,
                items[6].entry, items[6].count,
                items[7].entry, items[7].count,
                items[8].entry, items[8].count,
                items[9].entry, items[9].count,
                items[10].entry, items[10].count,
                items[11].entry, items[11].count,
                items[12].entry, items[12].count)
        end
    end)

    if not ok then
        PrintError(string.format("[%s] sendMailWithItems: SendMail error: %s", SCRIPT_NAME, tostring(err)))
        return false, tostring(err)
    end

    PrintInfo(string.format("[%s] sendMailWithItems: Mail sent successfully to guid %d with %d items",
        SCRIPT_NAME, guid, itemCount))
    return true, nil
end

--- Process a single mail item request row
--- Supports both legacy (item_entry/item_count) and new (items_json) formats
---@param row userdata Query row
---@return boolean success
local function processItemRow(row)
    -- Column order: id, character_guid, item_entry, item_count, items_json, mail_subject, mail_body, money, reason
    local id = tonumber(row:GetUInt32(0))
    local guid = tonumber(row:GetUInt32(1))
    local itemEntry = tonumber(row:GetUInt32(2)) or 0
    local itemCount = tonumber(row:GetUInt32(3)) or 1
    local itemsJson = row:GetString(4) -- May be nil or empty
    local mailSubject = row:GetString(5) or "Web Delivery"
    local mailBody = row:GetString(6) or "Your items have been delivered."
    local money = tonumber(row:GetUInt32(7)) or 0
    local reason = row:GetString(8)

    if not id or id == 0 then
        PrintError(string.format("[%s] Mail: Invalid request id", SCRIPT_NAME))
        return false
    end

    if not guid or guid == 0 then
        markError("web_item_requests", id, "invalid character_guid")
        return false
    end

    -- Build items list from either items_json or legacy columns
    local items = nil

    -- Try to parse items_json first (preferred, supports multiple items)
    if itemsJson and itemsJson ~= "" then
        items = parseItemsJson(itemsJson)
        if items then
            PrintInfo(string.format("[%s] Mail: Parsed %d items from items_json for request %d",
                SCRIPT_NAME, #items, id))
            -- Validate all items exist
            for i, item in ipairs(items) do
                if not validateItemEntry(item.entry) then
                    markError("web_item_requests", id, string.format(
                        "item_entry %d (index %d) not found", item.entry, i
                    ))
                    return false
                end
            end
        end
    end

    -- Fall back to legacy single item format
    if not items and itemEntry > 0 then
        if itemCount < 1 then
            markError("web_item_requests", id, "invalid item_count")
            return false
        end
        if not validateItemEntry(itemEntry) then
            markError("web_item_requests", id, string.format(
                "item_entry %d not found", itemEntry
            ))
            return false
        end
        items = {{ entry = itemEntry, count = itemCount }}
    end

    -- Check for money-only mail
    local isMoneyOnly = (not items or #items == 0)
    if isMoneyOnly and money == 0 then
        markError("web_item_requests", id, "money-only request has no money")
        return false
    end

    local charName = getCharacterName(guid)
    if not charName then
        markError("web_item_requests", id, "character not found")
        return false
    end

    -- Limit items to 12 per mail
    if items and #items > 12 then
        markError("web_item_requests", id, string.format(
            "too many items: %d (max 12 per mail)", #items
        ))
        return false
    end

    -- Send the mail using the helper function
    local success, errMsg = sendMailWithItems(
        guid,
        mailSubject,
        mailBody,
        money,
        items
    )

    if not success then
        markError("web_item_requests", id, errMsg or "SendMail failed")
        return false
    end

    -- Notify if online
    local player = GetPlayerByGUID(guid)
    if player then
        local totalItems = items and #items or 0
        local msg = reason or string.format("You have new mail with %d item(s)!", totalItems)
        player:SendBroadcastMessage(string.format("|cff00ff00[Shop]|r %s", msg))
    end

    local itemCountForLog = items and #items or 0
    PrintInfo(string.format("[%s] Mail: Processed %d for %s - %d items, %d money",
        SCRIPT_NAME, id, charName, itemCountForLog, money))
    markDone("web_item_requests", id)
    return true
end

--------------------------------------------------------------------------------
-- Bag Item Request Processing
--------------------------------------------------------------------------------

--- Process a single bag item request row
---@param row userdata Query row
---@return boolean success
local function processBagRow(row)
    local id = tonumber(row:GetUInt32(0))
    local guid = tonumber(row:GetUInt32(1))
    local itemEntry = tonumber(row:GetUInt32(2))
    local itemCount = tonumber(row:GetUInt32(3)) or 1
    local reason = row:GetString(4)

    if not id or id == 0 then
        PrintError(string.format("[%s] Bag: Invalid request id", SCRIPT_NAME))
        return false
    end

    if not guid or guid == 0 then
        markError("web_bag_requests", id, "invalid character_guid")
        return false
    end

    if not itemEntry or itemEntry == 0 then
        markError("web_bag_requests", id, "invalid item_entry")
        return false
    end

    if itemCount < 1 then
        markError("web_bag_requests", id, "invalid item_count")
        return false
    end

    if not validateItemEntry(itemEntry) then
        markError("web_bag_requests", id, string.format(
            "item_entry %d not found", itemEntry
        ))
        return false
    end

    -- Player MUST be online for bag delivery
    local player = GetPlayerByGUID(guid)
    if not player then
        -- Mark as waiting - will be retried when player is online
        markWaiting(id)
        return false -- Not an error, just waiting
    end

    -- Add item directly to bag using server's proper GUID allocation
    -- AddItem returns the created Item object, or nil on failure
    local addedItem = player:AddItem(itemEntry, itemCount)

    if addedItem then
        player:SaveToDB()

        -- Notify player
        if reason and reason ~= "" then
            player:SendBroadcastMessage(string.format("|cff00ff00[Shop]|r %s", reason))
        else
            player:SendBroadcastMessage(string.format(
                "|cff00ff00[Shop]|r %dx item(s) added to your bags!", itemCount
            ))
        end

        PrintInfo(string.format("[%s] Bag: Processed %d for player %d - item %d x%d",
            SCRIPT_NAME, id, guid, itemEntry, itemCount))
        markDone("web_bag_requests", id)
        return true
    else
        -- Failed to add - likely bags are full
        markError("web_bag_requests", id, "failed to add item (bags full?)")
        return false
    end
end

--------------------------------------------------------------------------------
-- Spell Request Processing
--------------------------------------------------------------------------------

--- Process a single spell request row
---@param row userdata Query row
---@return boolean success
local function processSpellRow(row)
    local id = tonumber(row:GetUInt32(0))
    local guid = tonumber(row:GetUInt32(1))
    local spellId = tonumber(row:GetUInt32(2))
    local reason = row:GetString(3)

    if not id or id == 0 then
        PrintError(string.format("[%s] Spell: Invalid request id", SCRIPT_NAME))
        return false
    end

    if not guid or guid == 0 then
        markError("web_spell_requests", id, "invalid character_guid")
        return false
    end

    if not spellId or spellId == 0 then
        markError("web_spell_requests", id, "invalid spell_id")
        return false
    end

    -- Player MUST be online to learn a spell
    local player = GetPlayerByGUID(guid)
    if not player then
        -- Mark as waiting - will be retried when player is online
        markWaitingSpell(id)
        return false -- Not an error, just waiting
    end

    -- Check if player already knows the spell
    if player:HasSpell(spellId) then
        PrintInfo(string.format("[%s] Spell: Player %d already knows spell %d, marking done",
            SCRIPT_NAME, guid, spellId))
        markDone("web_spell_requests", id)
        return true
    end

    -- Teach the spell
    player:LearnSpell(spellId)

    -- NOTE: No SaveToDB() here — LearnSpell() updates memory and client
    -- immediately. The server's periodic auto-save persists the change.
    -- Calling SaveToDB() can conflict with concurrent skill updates.

    -- Notify player
    if reason and reason ~= "" then
        player:SendBroadcastMessage(string.format("|cff00ff00[System]|r %s", reason))
    else
        player:SendBroadcastMessage(string.format(
            "|cff00ff00[System]|r You have learned a new spell!"
        ))
    end

    PrintInfo(string.format("[%s] Spell: Processed %d for player %d - spell %d",
        SCRIPT_NAME, id, guid, spellId))
    markDone("web_spell_requests", id)
    return true
end

--------------------------------------------------------------------------------
-- Aura/Debuff Request Processing
--------------------------------------------------------------------------------

--- Process a single aura request row
--- Applies a temporary aura (buff/debuff) to the character
---@param row userdata Query row
---@return boolean success
local function processAuraRow(row)
    local id = tonumber(row:GetUInt32(0))
    local guid = tonumber(row:GetUInt32(1))
    local spellId = tonumber(row:GetUInt32(2))
    local durationMs = tonumber(row:GetUInt32(3)) or 0
    local stacks = tonumber(row:GetUInt32(4)) or 1
    local reason = row:GetString(5)

    if not id or id == 0 then
        PrintError(string.format("[%s] Aura: Invalid request id", SCRIPT_NAME))
        return false
    end

    if not guid or guid == 0 then
        markError("web_aura_requests", id, "invalid character_guid")
        return false
    end

    if not spellId or spellId == 0 then
        markError("web_aura_requests", id, "invalid spell_id")
        return false
    end

    -- Player MUST be online to receive an aura
    local player = GetPlayerByGUID(guid)
    if not player then
        markWaitingAura(id)
        return false -- Not an error, just waiting
    end

    -- Cast the aura on the player (self-cast for debuffs/buffs)
    local ok, err = pcall(function()
        player:AddAura(spellId, player)
    end)

    if not ok then
        markError("web_aura_requests", id, string.format("AddAura failed: %s", tostring(err)))
        return false
    end

    -- Optionally set duration if specified
    if durationMs > 0 then
        local aura = player:GetAura(spellId)
        if aura then
            aura:SetDuration(durationMs)
        end
    end

    -- Notify player
    if reason and reason ~= "" then
        player:SendBroadcastMessage(string.format("|cffff4444[Fate]|r %s", reason))
    end

    PrintInfo(string.format("[%s] Aura: Processed %d for player %d - spell %d (duration: %dms, stacks: %d)",
        SCRIPT_NAME, id, guid, spellId, durationMs, stacks))
    markDone("web_aura_requests", id)
    return true
end

--------------------------------------------------------------------------------
-- Teleport Request Processing
--------------------------------------------------------------------------------

--- Process a single teleport request row
--- Teleports the player to the specified map coordinates
---@param row userdata Query row
---@return boolean success
local function processTeleportRow(row)
    local id = tonumber(row:GetUInt32(0))
    local guid = tonumber(row:GetUInt32(1))
    local mapId = tonumber(row:GetUInt32(2))
    local x = row:GetFloat(3)
    local y = row:GetFloat(4)
    local z = row:GetFloat(5)
    local o = row:GetFloat(6)
    local reason = row:GetString(7)

    if not id or id == 0 then
        PrintError(string.format("[%s] Teleport: Invalid request id", SCRIPT_NAME))
        return false
    end

    if not guid or guid == 0 then
        markError("web_teleport_requests", id, "invalid character_guid")
        return false
    end

    if not mapId then
        markError("web_teleport_requests", id, "invalid map_id")
        return false
    end

    -- Player MUST be online to teleport
    local player = GetPlayerByGUID(guid)
    if not player then
        markWaitingTeleport(id)
        return false -- Not an error, just waiting
    end

    -- Attempt teleport
    local ok, err = pcall(function()
        player:Teleport(mapId, x, y, z, o)
    end)

    if not ok then
        markError("web_teleport_requests", id, string.format("Teleport failed: %s", tostring(err)))
        return false
    end

    -- Notify player
    if reason and reason ~= "" then
        player:SendBroadcastMessage(string.format("|cff00ccff[Portal]|r %s", reason))
    else
        player:SendBroadcastMessage("|cff00ccff[Portal]|r You have been teleported!")
    end

    PrintInfo(string.format("[%s] Teleport: Processed %d for player %d - map %d (%.1f, %.1f, %.1f)",
        SCRIPT_NAME, id, guid, mapId, x, y, z))
    markDone("web_teleport_requests", id)
    return true
end

--------------------------------------------------------------------------------
-- Level Request Processing
--------------------------------------------------------------------------------

--- Process a single level request row
--- Sets the character's level via player:SetLevel() if online,
--- or direct DB update if offline (safe since server won't overwrite)
---@param row userdata Query row
---@return boolean success
local function processLevelRow(row)
    local id = tonumber(row:GetUInt32(0))
    local guid = tonumber(row:GetUInt32(1))
    local level = tonumber(row:GetUInt32(2))
    local reason = row:GetString(3)

    if not id or id == 0 then
        PrintError(string.format("[%s] Level: Invalid request id", SCRIPT_NAME))
        return false
    end

    if not guid or guid == 0 then
        markError("web_level_requests", id, "invalid character_guid")
        return false
    end

    if not level or level < 1 or level > 80 then
        markError("web_level_requests", id, string.format("invalid level: %s", tostring(level)))
        return false
    end

    -- Try online player first (uses proper server API)
    local player = GetPlayerByGUID(guid)
    if player then
        local oldLevel = player:GetLevel()
        player:SetLevel(level)
        player:SaveToDB()

        -- Notify player
        if reason and reason ~= "" then
            player:SendBroadcastMessage(string.format("|cff00ff00[GM]|r %s", reason))
        else
            player:SendBroadcastMessage(string.format(
                "|cff00ff00[GM]|r Your level has been set to %d!", level
            ))
        end

        PrintInfo(string.format("[%s] Level: Processed %d for online player %d (%d -> %d)",
            SCRIPT_NAME, id, guid, oldLevel, level))
        markDone("web_level_requests", id)
        return true
    else
        -- Player offline - direct DB update is safe (no in-memory cache to conflict)
        local query = CharDBQuery(string.format(
            "SELECT guid FROM characters WHERE guid = %d", guid
        ))

        if not query then
            markError("web_level_requests", id, "character not found")
            return false
        end

        CharDBExecute(string.format(
            "UPDATE characters SET level = %d WHERE guid = %d",
            level, guid
        ))

        PrintInfo(string.format("[%s] Level: Processed %d for offline player %d (set to %d)",
            SCRIPT_NAME, id, guid, level))
        markDone("web_level_requests", id)
        return true
    end
end

--------------------------------------------------------------------------------
-- Skill/Profession Request Processing
--------------------------------------------------------------------------------

--- Process a single skill request row
--- Sets the character's skill via player:SetSkill() if online,
--- or direct DB update if offline (safe since server won't overwrite)
---@param row userdata Query row
---@return boolean success
local function processSkillRow(row)
    local id = tonumber(row:GetUInt32(0))
    local guid = tonumber(row:GetUInt32(1))
    local skillId = tonumber(row:GetUInt32(2))
    local skillValue = tonumber(row:GetUInt32(3)) or 0
    local skillMax = tonumber(row:GetUInt32(4)) or 0
    local reason = row:GetString(5)

    if not id or id == 0 then
        PrintError(string.format("[%s] Skill: Invalid request id", SCRIPT_NAME))
        return false
    end

    if not guid or guid == 0 then
        markError("web_skill_requests", id, "invalid character_guid")
        return false
    end

    if not skillId or skillId == 0 then
        markError("web_skill_requests", id, "invalid skill_id")
        return false
    end

    -- Try online player first (uses proper server API)
    local player = GetPlayerByGUID(guid)
    if player then
        if skillValue == 0 and skillMax == 0 then
            -- Remove the skill: set step to 0 which effectively removes it
            -- SetSkill(skillId, step, currVal, maxVal) - step 0 removes
            player:SetSkill(skillId, 0, 0, 0)
        else
            -- Determine the step (rank) from max value
            -- Grand Master = 6 (450), Master = 5 (375), Artisan = 4 (300),
            -- Expert = 3 (225), Journeyman = 2 (150), Apprentice = 1 (75)
            local step = 1
            if skillMax >= 450 then step = 6
            elseif skillMax >= 375 then step = 5
            elseif skillMax >= 300 then step = 4
            elseif skillMax >= 225 then step = 3
            elseif skillMax >= 150 then step = 2
            end

            player:SetSkill(skillId, step, skillValue, skillMax)
        end

        -- NOTE: We do NOT call player:SaveToDB() here.
        -- SetSkill() updates the player object in memory and sends the
        -- update to the client immediately. The server's periodic auto-save
        -- will persist the change to the database.
        -- Calling SaveToDB() here can conflict with concurrent spell learning
        -- (training spells for the profession rank).

        -- Notify player
        if reason and reason ~= "" then
            player:SendBroadcastMessage(string.format("|cff00ff00[GM]|r %s", reason))
        else
            if skillValue == 0 and skillMax == 0 then
                player:SendBroadcastMessage(string.format("|cff00ff00[GM]|r Profession skill %d has been removed.", skillId))
            else
                player:SendBroadcastMessage(string.format("|cff00ff00[GM]|r Profession skill updated to %d/%d.", skillValue, skillMax))
            end
        end

        PrintInfo(string.format("[%s] Skill: Processed %d for online player %d (skill %d: %d/%d)",
            SCRIPT_NAME, id, guid, skillId, skillValue, skillMax))
        markDone("web_skill_requests", id)
        return true
    else
        -- Player offline - direct DB update is safe
        local query = CharDBQuery(string.format(
            "SELECT guid FROM characters WHERE guid = %d", guid
        ))

        if not query then
            markError("web_skill_requests", id, "character not found")
            return false
        end

        if skillValue == 0 and skillMax == 0 then
            -- Remove the skill
            CharDBExecute(string.format(
                "DELETE FROM character_skills WHERE guid = %d AND skill = %d",
                guid, skillId
            ))
            PrintInfo(string.format("[%s] Skill: Processed %d for offline player %d (removed skill %d)",
                SCRIPT_NAME, id, guid, skillId))
        else
            -- Check if skill exists
            local skillQuery = CharDBQuery(string.format(
                "SELECT skill FROM character_skills WHERE guid = %d AND skill = %d",
                guid, skillId
            ))

            if skillQuery then
                -- Update existing
                CharDBExecute(string.format(
                    "UPDATE character_skills SET value = %d, max = %d WHERE guid = %d AND skill = %d",
                    skillValue, skillMax, guid, skillId
                ))
            else
                -- Insert new
                CharDBExecute(string.format(
                    "INSERT INTO character_skills (guid, skill, value, max) VALUES (%d, %d, %d, %d)",
                    guid, skillId, skillValue, skillMax
                ))
            end
            PrintInfo(string.format("[%s] Skill: Processed %d for offline player %d (skill %d: %d/%d)",
                SCRIPT_NAME, id, guid, skillId, skillValue, skillMax))
        end

        markDone("web_skill_requests", id)
        return true
    end
end

--------------------------------------------------------------------------------
-- Reputation Request Processing
--------------------------------------------------------------------------------

--- Process a single reputation request row
--- Sets faction standing via player:SetReputation() if online,
--- or direct DB update if offline
---@param row userdata Query row
---@return boolean success
local function processReputationRow(row)
    local id = tonumber(row:GetUInt32(0))
    local guid = tonumber(row:GetUInt32(1))
    local factionId = tonumber(row:GetUInt32(2))
    local standing = tonumber(row:GetInt32(3)) or 0
    local reason = row:GetString(4)

    if not id or id == 0 then
        PrintError(string.format("[%s] Reputation: Invalid request id", SCRIPT_NAME))
        return false
    end

    if not guid or guid == 0 then
        markError("web_reputation_requests", id, "invalid character_guid")
        return false
    end

    if not factionId or factionId == 0 then
        markError("web_reputation_requests", id, "invalid faction_id")
        return false
    end

    -- Try online player first
    local player = GetPlayerByGUID(guid)
    if player then
        local ok, err = pcall(function()
            player:SetReputation(factionId, standing)
        end)

        if not ok then
            markError("web_reputation_requests", id, string.format("SetReputation failed: %s", tostring(err)))
            return false
        end

        player:SaveToDB()

        if reason and reason ~= "" then
            player:SendBroadcastMessage(string.format("|cff00ff00[GM]|r %s", reason))
        end

        PrintInfo(string.format("[%s] Reputation: Processed %d for online player %d (faction %d: %d)",
            SCRIPT_NAME, id, guid, factionId, standing))
        markDone("web_reputation_requests", id)
        return true
    else
        -- Player offline - direct DB update
        local query = CharDBQuery(string.format(
            "SELECT guid FROM characters WHERE guid = %d", guid
        ))

        if not query then
            markError("web_reputation_requests", id, "character not found")
            return false
        end

        -- Check if reputation row exists
        local repQuery = CharDBQuery(string.format(
            "SELECT faction FROM character_reputation WHERE guid = %d AND faction = %d",
            guid, factionId
        ))

        if repQuery then
            CharDBExecute(string.format(
                "UPDATE character_reputation SET standing = %d WHERE guid = %d AND faction = %d",
                standing, guid, factionId
            ))
        else
            CharDBExecute(string.format(
                "INSERT INTO character_reputation (guid, faction, standing, flags) VALUES (%d, %d, %d, 1)",
                guid, factionId, standing
            ))
        end

        PrintInfo(string.format("[%s] Reputation: Processed %d for offline player %d (faction %d: %d)",
            SCRIPT_NAME, id, guid, factionId, standing))
        markDone("web_reputation_requests", id)
        return true
    end
end

--------------------------------------------------------------------------------
-- Quest Request Processing
--------------------------------------------------------------------------------

--- Process a single quest request row
--- Completes a quest via player:CompleteQuest() if online,
--- or direct DB insert if offline
---@param row userdata Query row
---@return boolean success
local function processQuestRow(row)
    local id = tonumber(row:GetUInt32(0))
    local guid = tonumber(row:GetUInt32(1))
    local questId = tonumber(row:GetUInt32(2))
    local action = row:GetString(3) or "complete"
    local reason = row:GetString(4)

    if not id or id == 0 then
        PrintError(string.format("[%s] Quest: Invalid request id", SCRIPT_NAME))
        return false
    end

    if not guid or guid == 0 then
        markError("web_quest_requests", id, "invalid character_guid")
        return false
    end

    if not questId or questId == 0 then
        markError("web_quest_requests", id, "invalid quest_id")
        return false
    end

    -- Try online player first
    local player = GetPlayerByGUID(guid)
    if player then
        if action == "complete" then
            -- Check if quest is already rewarded
            local alreadyRewarded = CharDBQuery(string.format(
                "SELECT quest FROM character_queststatus_rewarded WHERE guid = %d AND quest = %d",
                guid, questId
            ))
            if alreadyRewarded then
                PrintInfo(string.format("[%s] Quest: Quest %d already rewarded for player %d, skipping",
                    SCRIPT_NAME, questId, guid))
                markDone("web_quest_requests", id)
                return true
            end

            -- Use CompleteQuest to mark objectives done (updates client immediately)
            local ok, err = pcall(function()
                player:CompleteQuest(questId)
            end)

            if not ok then
                markError("web_quest_requests", id, string.format("CompleteQuest failed: %s", tostring(err)))
                return false
            end

            -- NOTE: CompleteQuest() marks the quest as "ready to turn in" in the
            -- server's memory and sends the update to the client immediately.
            -- We do NOT manipulate the DB here because SaveToDB() would overwrite
            -- our changes. The player can visit the quest giver to turn in and
            -- receive proper rewards (XP, gold, items, reputation).
            -- This matches the behavior of the GM command ".quest complete".

            if reason and reason ~= "" then
                player:SendBroadcastMessage(string.format("|cff00ff00[GM]|r %s", reason))
            else
                player:SendBroadcastMessage("|cff00ff00[GM]|r Quest objectives completed! Visit the quest giver to turn in for rewards.")
            end
        end

        PrintInfo(string.format("[%s] Quest: Processed %d for online player %d (quest %d, action: %s)",
            SCRIPT_NAME, id, guid, questId, action))
        markDone("web_quest_requests", id)
        return true
    else
        -- Player offline - direct DB manipulation
        local query = CharDBQuery(string.format(
            "SELECT guid FROM characters WHERE guid = %d", guid
        ))

        if not query then
            markError("web_quest_requests", id, "character not found")
            return false
        end

        if action == "complete" then
            -- Remove from active quest log
            CharDBExecute(string.format(
                "DELETE FROM character_queststatus WHERE guid = %d AND quest = %d",
                guid, questId
            ))
            -- Insert into rewarded table
            CharDBExecute(string.format(
                "INSERT IGNORE INTO character_queststatus_rewarded (guid, quest, active) VALUES (%d, %d, 1)",
                guid, questId
            ))
        end

        PrintInfo(string.format("[%s] Quest: Processed %d for offline player %d (quest %d, action: %s)",
            SCRIPT_NAME, id, guid, questId, action))
        markDone("web_quest_requests", id)
        return true
    end
end

--------------------------------------------------------------------------------
-- Title Request Processing
--------------------------------------------------------------------------------

--- Process a single title request row
--- Adds/removes titles via player:SetKnownTitle()/UnsetKnownTitle() if online,
--- or direct bitmask manipulation if offline
---@param row userdata Query row
---@return boolean success
local function processTitleRow(row)
    local id = tonumber(row:GetUInt32(0))
    local guid = tonumber(row:GetUInt32(1))
    local titleId = tonumber(row:GetUInt32(2))
    local action = row:GetString(3) or "add"
    local reason = row:GetString(4)

    if not id or id == 0 then
        PrintError(string.format("[%s] Title: Invalid request id", SCRIPT_NAME))
        return false
    end

    if not guid or guid == 0 then
        markError("web_title_requests", id, "invalid character_guid")
        return false
    end

    if not titleId then
        markError("web_title_requests", id, "invalid title_id")
        return false
    end

    -- Try online player first
    local player = GetPlayerByGUID(guid)
    if player then
        local ok, err
        if action == "add" then
            ok, err = pcall(function()
                player:SetKnownTitle(titleId)
            end)
        else
            ok, err = pcall(function()
                player:UnsetKnownTitle(titleId)
            end)
        end

        if not ok then
            markError("web_title_requests", id, string.format("Title %s failed: %s", action, tostring(err)))
            return false
        end

        player:SaveToDB()

        if reason and reason ~= "" then
            player:SendBroadcastMessage(string.format("|cff00ff00[GM]|r %s", reason))
        end

        PrintInfo(string.format("[%s] Title: Processed %d for online player %d (title %d, action: %s)",
            SCRIPT_NAME, id, guid, titleId, action))
        markDone("web_title_requests", id)
        return true
    else
        -- Player offline - manipulate knownTitles bitmask directly
        local query = CharDBQuery(string.format(
            "SELECT knownTitles FROM characters WHERE guid = %d", guid
        ))

        if not query then
            markError("web_title_requests", id, "character not found")
            return false
        end

        local knownTitles = query:GetString(0) or ""
        local fields = {}
        for field in knownTitles:gmatch("%S+") do
            table.insert(fields, tonumber(field) or 0)
        end

        local fieldIndex = math.floor(titleId / 32) + 1 -- Lua is 1-indexed
        local bitIndex = titleId % 32

        -- Ensure array is large enough
        while #fields < fieldIndex do
            table.insert(fields, 0)
        end

        if action == "add" then
            -- Use bit manipulation: set the bit
            local mask = 2 ^ bitIndex
            if fields[fieldIndex] % (mask * 2) < mask then
                fields[fieldIndex] = fields[fieldIndex] + mask
            end
        else
            -- Clear the bit
            local mask = 2 ^ bitIndex
            if fields[fieldIndex] % (mask * 2) >= mask then
                fields[fieldIndex] = fields[fieldIndex] - mask
            end
        end

        -- Rebuild the string
        local parts = {}
        for _, v in ipairs(fields) do
            table.insert(parts, tostring(math.floor(v)))
        end
        local newKnownTitles = table.concat(parts, " ")

        CharDBExecute(string.format(
            "UPDATE characters SET knownTitles = '%s' WHERE guid = %d",
            escapeSql(newKnownTitles), guid
        ))

        PrintInfo(string.format("[%s] Title: Processed %d for offline player %d (title %d, action: %s)",
            SCRIPT_NAME, id, guid, titleId, action))
        markDone("web_title_requests", id)
        return true
    end
end

--------------------------------------------------------------------------------
-- Main Polling Function
--------------------------------------------------------------------------------

--- Process all pending requests from all queues
---@param eventId number
---@param delay number
---@param repeats number
local function pollAllQueues(eventId, delay, repeats)
    local totalProcessed = 0
    local totalErrors = 0
    local totalWaiting = 0

    -- Process money requests
    local moneyQuery = CharDBQuery(SELECT_PENDING_MONEY_SQL)
    if moneyQuery then
        repeat
            local ok, result = pcall(processMoneyRow, moneyQuery)
            if not ok then
                totalErrors = totalErrors + 1
                PrintError(string.format("[%s] Money error: %s", SCRIPT_NAME, tostring(result)))
            elseif result then
                totalProcessed = totalProcessed + 1
            else
                totalErrors = totalErrors + 1
            end
        until not moneyQuery:NextRow()
    end

    -- Process mail item requests
    local itemQuery = CharDBQuery(SELECT_PENDING_ITEM_SQL)
    if itemQuery then
        repeat
            local ok, result = pcall(processItemRow, itemQuery)
            if not ok then
                totalErrors = totalErrors + 1
                PrintError(string.format("[%s] Mail error: %s", SCRIPT_NAME, tostring(result)))
            elseif result then
                totalProcessed = totalProcessed + 1
            else
                totalErrors = totalErrors + 1
            end
        until not itemQuery:NextRow()
    end

    -- Process bag item requests
    local bagQuery = CharDBQuery(SELECT_PENDING_BAG_SQL)
    if bagQuery then
        repeat
            local ok, result = pcall(processBagRow, bagQuery)
            if not ok then
                totalErrors = totalErrors + 1
                PrintError(string.format("[%s] Bag error: %s", SCRIPT_NAME, tostring(result)))
            elseif result then
                totalProcessed = totalProcessed + 1
            else
                -- Bag requests return false when player is offline (waiting state)
                -- Don't count these as errors
                totalWaiting = totalWaiting + 1
            end
        until not bagQuery:NextRow()
    end

    -- Process spell requests
    local spellQuery = CharDBQuery(SELECT_PENDING_SPELL_SQL)
    if spellQuery then
        repeat
            local ok, result = pcall(processSpellRow, spellQuery)
            if not ok then
                totalErrors = totalErrors + 1
                PrintError(string.format("[%s] Spell error: %s", SCRIPT_NAME, tostring(result)))
            elseif result then
                totalProcessed = totalProcessed + 1
            else
                -- Spell requests return false when player is offline (waiting state)
                totalWaiting = totalWaiting + 1
            end
        until not spellQuery:NextRow()
    end

    -- Process aura requests
    local auraQuery = CharDBQuery(SELECT_PENDING_AURA_SQL)
    if auraQuery then
        repeat
            local ok, result = pcall(processAuraRow, auraQuery)
            if not ok then
                totalErrors = totalErrors + 1
                PrintError(string.format("[%s] Aura error: %s", SCRIPT_NAME, tostring(result)))
            elseif result then
                totalProcessed = totalProcessed + 1
            else
                -- Aura requests return false when player is offline (waiting state)
                totalWaiting = totalWaiting + 1
            end
        until not auraQuery:NextRow()
    end

    -- Process teleport requests
    local teleportQuery = CharDBQuery(SELECT_PENDING_TELEPORT_SQL)
    if teleportQuery then
        repeat
            local ok, result = pcall(processTeleportRow, teleportQuery)
            if not ok then
                totalErrors = totalErrors + 1
                PrintError(string.format("[%s] Teleport error: %s", SCRIPT_NAME, tostring(result)))
            elseif result then
                totalProcessed = totalProcessed + 1
            else
                -- Teleport requests return false when player is offline (waiting state)
                totalWaiting = totalWaiting + 1
            end
        until not teleportQuery:NextRow()
    end

    -- Process level requests
    local levelQuery = CharDBQuery(SELECT_PENDING_LEVEL_SQL)
    if levelQuery then
        repeat
            local ok, result = pcall(processLevelRow, levelQuery)
            if not ok then
                totalErrors = totalErrors + 1
                PrintError(string.format("[%s] Level error: %s", SCRIPT_NAME, tostring(result)))
            elseif result then
                totalProcessed = totalProcessed + 1
            else
                totalWaiting = totalWaiting + 1
            end
        until not levelQuery:NextRow()
    end

    -- Process skill requests
    local skillQuery = CharDBQuery(SELECT_PENDING_SKILL_SQL)
    if skillQuery then
        repeat
            local ok, result = pcall(processSkillRow, skillQuery)
            if not ok then
                totalErrors = totalErrors + 1
                PrintError(string.format("[%s] Skill error: %s", SCRIPT_NAME, tostring(result)))
            elseif result then
                totalProcessed = totalProcessed + 1
            else
                totalWaiting = totalWaiting + 1
            end
        until not skillQuery:NextRow()
    end

    -- Process reputation requests
    local repQuery = CharDBQuery(SELECT_PENDING_REPUTATION_SQL)
    if repQuery then
        repeat
            local ok, result = pcall(processReputationRow, repQuery)
            if not ok then
                totalErrors = totalErrors + 1
                PrintError(string.format("[%s] Reputation error: %s", SCRIPT_NAME, tostring(result)))
            elseif result then
                totalProcessed = totalProcessed + 1
            else
                totalWaiting = totalWaiting + 1
            end
        until not repQuery:NextRow()
    end

    -- Process quest requests
    local questQuery = CharDBQuery(SELECT_PENDING_QUEST_SQL)
    if questQuery then
        repeat
            local ok, result = pcall(processQuestRow, questQuery)
            if not ok then
                totalErrors = totalErrors + 1
                PrintError(string.format("[%s] Quest error: %s", SCRIPT_NAME, tostring(result)))
            elseif result then
                totalProcessed = totalProcessed + 1
            else
                totalWaiting = totalWaiting + 1
            end
        until not questQuery:NextRow()
    end

    -- Process title requests
    local titleQuery = CharDBQuery(SELECT_PENDING_TITLE_SQL)
    if titleQuery then
        repeat
            local ok, result = pcall(processTitleRow, titleQuery)
            if not ok then
                totalErrors = totalErrors + 1
                PrintError(string.format("[%s] Title error: %s", SCRIPT_NAME, tostring(result)))
            elseif result then
                totalProcessed = totalProcessed + 1
            else
                totalWaiting = totalWaiting + 1
            end
        until not titleQuery:NextRow()
    end

    -- Only log if something happened
    if totalProcessed > 0 or totalErrors > 0 then
        PrintInfo(string.format("[%s] Poll complete: %d processed, %d errors, %d waiting",
            SCRIPT_NAME, totalProcessed, totalErrors, totalWaiting))
    end
end

--------------------------------------------------------------------------------
-- Player Login Hook (for pending bag items)
--------------------------------------------------------------------------------

--- When a player logs in, immediately process any waiting bag requests for them
---@param event number
---@param player userdata
local function onPlayerLogin(event, player)
    local guid = player:GetGUIDLow()

    -- Check for waiting bag requests for this player
    local query = CharDBQuery(string.format(
        "SELECT id, item_entry, item_count, reason FROM web_bag_requests WHERE character_guid = %d AND status = 'waiting' ORDER BY id ASC LIMIT %d",
        guid, BATCH_SIZE
    ))

    if not query then
        return -- No waiting requests
    end

    local processed = 0
    local errors = 0

    PrintInfo(string.format("[%s] Processing waiting bag requests for player %d on login", SCRIPT_NAME, guid))

    repeat
        local id = tonumber(query:GetUInt32(0))
        local itemEntry = tonumber(query:GetUInt32(1))
        local itemCount = tonumber(query:GetUInt32(2)) or 1
        local reason = query:GetString(3)

        local addedItem = player:AddItem(itemEntry, itemCount)

        if addedItem then
            if reason and reason ~= "" then
                player:SendBroadcastMessage(string.format("|cff00ff00[Shop]|r %s", reason))
            else
                player:SendBroadcastMessage(string.format(
                    "|cff00ff00[Shop]|r %dx item(s) added to your bags!", itemCount
                ))
            end
            markDone("web_bag_requests", id)
            processed = processed + 1
        else
            markError("web_bag_requests", id, "failed on login (bags full?)")
            errors = errors + 1
        end
    until not query:NextRow()

    -- Check for waiting spell requests for this player
    local spellQuery = CharDBQuery(string.format(
        "SELECT id, spell_id, reason FROM web_spell_requests WHERE character_guid = %d AND status = 'waiting' ORDER BY id ASC LIMIT %d",
        guid, BATCH_SIZE
    ))

    if spellQuery then
        PrintInfo(string.format("[%s] Processing waiting spell requests for player %d on login", SCRIPT_NAME, guid))

        repeat
            local spellReqId = tonumber(spellQuery:GetUInt32(0))
            local spellId = tonumber(spellQuery:GetUInt32(1))
            local spellReason = spellQuery:GetString(2)

            if player:HasSpell(spellId) then
                markDone("web_spell_requests", spellReqId)
                processed = processed + 1
            else
                player:LearnSpell(spellId)
                if spellReason and spellReason ~= "" then
                    player:SendBroadcastMessage(string.format("|cff00ff00[System]|r %s", spellReason))
                else
                    player:SendBroadcastMessage("|cff00ff00[System]|r You have learned a new spell!")
                end
                markDone("web_spell_requests", spellReqId)
                processed = processed + 1
            end
        until not spellQuery:NextRow()
    end

    -- Check for waiting aura requests for this player
    local auraQuery = CharDBQuery(string.format(
        "SELECT id, spell_id, duration_ms, stacks, reason FROM web_aura_requests WHERE character_guid = %d AND status = 'waiting' ORDER BY id ASC LIMIT %d",
        guid, BATCH_SIZE
    ))

    if auraQuery then
        PrintInfo(string.format("[%s] Processing waiting aura requests for player %d on login", SCRIPT_NAME, guid))

        repeat
            local auraReqId = tonumber(auraQuery:GetUInt32(0))
            local auraSpellId = tonumber(auraQuery:GetUInt32(1))
            local auraDuration = tonumber(auraQuery:GetUInt32(2)) or 0
            local auraStacks = tonumber(auraQuery:GetUInt32(3)) or 1
            local auraReason = auraQuery:GetString(4)

            local auraOk, auraErr = pcall(function()
                player:AddAura(auraSpellId, player)
            end)

            if auraOk then
                if auraDuration > 0 then
                    local aura = player:GetAura(auraSpellId)
                    if aura then
                        aura:SetDuration(auraDuration)
                    end
                end

                if auraReason and auraReason ~= "" then
                    player:SendBroadcastMessage(string.format("|cffff4444[Fate]|r %s", auraReason))
                end

                markDone("web_aura_requests", auraReqId)
                processed = processed + 1
            else
                markError("web_aura_requests", auraReqId, string.format("AddAura failed on login: %s", tostring(auraErr)))
                errors = errors + 1
            end
        until not auraQuery:NextRow()
    end

    -- Check for waiting teleport requests for this player
    local teleportQuery = CharDBQuery(string.format(
        "SELECT id, map_id, x, y, z, o, reason FROM web_teleport_requests WHERE character_guid = %d AND status = 'waiting' ORDER BY id ASC LIMIT 1",
        guid
    ))

    if teleportQuery then
        PrintInfo(string.format("[%s] Processing waiting teleport request for player %d on login", SCRIPT_NAME, guid))

        -- Only process the most recent waiting teleport (limit 1) to avoid chain-teleporting
        local tpReqId = tonumber(teleportQuery:GetUInt32(0))
        local tpMapId = tonumber(teleportQuery:GetUInt32(1))
        local tpX = teleportQuery:GetFloat(2)
        local tpY = teleportQuery:GetFloat(3)
        local tpZ = teleportQuery:GetFloat(4)
        local tpO = teleportQuery:GetFloat(5)
        local tpReason = teleportQuery:GetString(6)

        local tpOk, tpErr = pcall(function()
            player:Teleport(tpMapId, tpX, tpY, tpZ, tpO)
        end)

        if tpOk then
            if tpReason and tpReason ~= "" then
                player:SendBroadcastMessage(string.format("|cff00ccff[Portal]|r %s", tpReason))
            else
                player:SendBroadcastMessage("|cff00ccff[Portal]|r You have been teleported!")
            end
            markDone("web_teleport_requests", tpReqId)
            processed = processed + 1
        else
            markError("web_teleport_requests", tpReqId, string.format("Teleport failed on login: %s", tostring(tpErr)))
            errors = errors + 1
        end

        -- Mark any remaining waiting teleport requests as done (stale - only latest matters)
        CharDBExecute(string.format(
            "UPDATE web_teleport_requests SET status='done', processed_at=NOW() WHERE character_guid = %d AND status = 'waiting'",
            guid
        ))
    end

    -- Check for waiting level requests for this player (only apply the latest)
    local levelQuery = CharDBQuery(string.format(
        "SELECT id, level, reason FROM web_level_requests WHERE character_guid = %d AND status = 'waiting' ORDER BY id DESC LIMIT 1",
        guid
    ))

    if levelQuery then
        PrintInfo(string.format("[%s] Processing waiting level request for player %d on login", SCRIPT_NAME, guid))

        local lvlReqId = tonumber(levelQuery:GetUInt32(0))
        local lvlLevel = tonumber(levelQuery:GetUInt32(1))
        local lvlReason = levelQuery:GetString(2)

        if lvlLevel and lvlLevel >= 1 and lvlLevel <= 80 then
            player:SetLevel(lvlLevel)

            if lvlReason and lvlReason ~= "" then
                player:SendBroadcastMessage(string.format("|cff00ff00[GM]|r %s", lvlReason))
            else
                player:SendBroadcastMessage(string.format(
                    "|cff00ff00[GM]|r Your level has been set to %d!", lvlLevel
                ))
            end

            markDone("web_level_requests", lvlReqId)
            processed = processed + 1
        else
            markError("web_level_requests", lvlReqId, "invalid level on login")
            errors = errors + 1
        end

        -- Mark any remaining waiting level requests as done (stale - only latest matters)
        CharDBExecute(string.format(
            "UPDATE web_level_requests SET status='done', processed_at=NOW() WHERE character_guid = %d AND status = 'waiting'",
            guid
        ))
    end

    -- Check for waiting skill requests for this player
    local skillLoginQuery = CharDBQuery(string.format(
        "SELECT id, skill_id, skill_value, skill_max, reason FROM web_skill_requests WHERE character_guid = %d AND status = 'waiting' ORDER BY id ASC LIMIT %d",
        guid, BATCH_SIZE
    ))

    if skillLoginQuery then
        PrintInfo(string.format("[%s] Processing waiting skill requests for player %d on login", SCRIPT_NAME, guid))

        repeat
            local skillReqId = tonumber(skillLoginQuery:GetUInt32(0))
            local skillReqSkillId = tonumber(skillLoginQuery:GetUInt32(1))
            local skillReqValue = tonumber(skillLoginQuery:GetUInt32(2)) or 0
            local skillReqMax = tonumber(skillLoginQuery:GetUInt32(3)) or 0
            local skillReason = skillLoginQuery:GetString(4)

            if skillReqValue == 0 and skillReqMax == 0 then
                player:SetSkill(skillReqSkillId, 0, 0, 0)
            else
                local step = 1
                if skillReqMax >= 450 then step = 6
                elseif skillReqMax >= 375 then step = 5
                elseif skillReqMax >= 300 then step = 4
                elseif skillReqMax >= 225 then step = 3
                elseif skillReqMax >= 150 then step = 2
                end
                player:SetSkill(skillReqSkillId, step, skillReqValue, skillReqMax)
            end

            if skillReason and skillReason ~= "" then
                player:SendBroadcastMessage(string.format("|cff00ff00[GM]|r %s", skillReason))
            end

            markDone("web_skill_requests", skillReqId)
            processed = processed + 1
        until not skillLoginQuery:NextRow()
    end

    -- Check for waiting reputation requests for this player
    local repLoginQuery = CharDBQuery(string.format(
        "SELECT id, faction_id, standing, reason FROM web_reputation_requests WHERE character_guid = %d AND status = 'waiting' ORDER BY id ASC LIMIT %d",
        guid, BATCH_SIZE
    ))

    if repLoginQuery then
        PrintInfo(string.format("[%s] Processing waiting reputation requests for player %d on login", SCRIPT_NAME, guid))

        repeat
            local repReqId = tonumber(repLoginQuery:GetUInt32(0))
            local repFactionId = tonumber(repLoginQuery:GetUInt32(1))
            local repStanding = tonumber(repLoginQuery:GetInt32(2)) or 0
            local repReason = repLoginQuery:GetString(3)

            local repOk, repErr = pcall(function()
                player:SetReputation(repFactionId, repStanding)
            end)

            if repOk then
                if repReason and repReason ~= "" then
                    player:SendBroadcastMessage(string.format("|cff00ff00[GM]|r %s", repReason))
                end
                markDone("web_reputation_requests", repReqId)
                processed = processed + 1
            else
                markError("web_reputation_requests", repReqId, string.format("SetReputation failed on login: %s", tostring(repErr)))
                errors = errors + 1
            end
        until not repLoginQuery:NextRow()
    end

    -- Check for waiting quest requests for this player
    local questLoginQuery = CharDBQuery(string.format(
        "SELECT id, quest_id, action, reason FROM web_quest_requests WHERE character_guid = %d AND status = 'waiting' ORDER BY id ASC LIMIT %d",
        guid, BATCH_SIZE
    ))

    if questLoginQuery then
        PrintInfo(string.format("[%s] Processing waiting quest requests for player %d on login", SCRIPT_NAME, guid))

        repeat
            local questReqId = tonumber(questLoginQuery:GetUInt32(0))
            local questReqQuestId = tonumber(questLoginQuery:GetUInt32(1))
            local questAction = questLoginQuery:GetString(2) or "complete"
            local questReason = questLoginQuery:GetString(3)

            if questAction == "complete" then
                local questOk, questErr = pcall(function()
                    player:CompleteQuest(questReqQuestId)
                end)

                if questOk then
                    -- CompleteQuest marks objectives done immediately on login.
                    -- Player can turn in at quest giver for proper rewards.

                    if questReason and questReason ~= "" then
                        player:SendBroadcastMessage(string.format("|cff00ff00[GM]|r %s", questReason))
                    else
                        player:SendBroadcastMessage(string.format("|cff00ff00[GM]|r Quest %d objectives completed! Visit the quest giver to turn in.", questReqQuestId))
                    end
                    markDone("web_quest_requests", questReqId)
                    processed = processed + 1
                else
                    markError("web_quest_requests", questReqId, string.format("CompleteQuest failed on login: %s", tostring(questErr)))
                    errors = errors + 1
                end
            end
        until not questLoginQuery:NextRow()
    end

    -- Check for waiting title requests for this player
    local titleLoginQuery = CharDBQuery(string.format(
        "SELECT id, title_id, action, reason FROM web_title_requests WHERE character_guid = %d AND status = 'waiting' ORDER BY id ASC LIMIT %d",
        guid, BATCH_SIZE
    ))

    if titleLoginQuery then
        PrintInfo(string.format("[%s] Processing waiting title requests for player %d on login", SCRIPT_NAME, guid))

        repeat
            local titleReqId = tonumber(titleLoginQuery:GetUInt32(0))
            local titleReqTitleId = tonumber(titleLoginQuery:GetUInt32(1))
            local titleAction = titleLoginQuery:GetString(2) or "add"
            local titleReason = titleLoginQuery:GetString(3)

            local titleOk, titleErr
            if titleAction == "add" then
                titleOk, titleErr = pcall(function()
                    player:SetKnownTitle(titleReqTitleId)
                end)
            else
                titleOk, titleErr = pcall(function()
                    player:UnsetKnownTitle(titleReqTitleId)
                end)
            end

            if titleOk then
                if titleReason and titleReason ~= "" then
                    player:SendBroadcastMessage(string.format("|cff00ff00[GM]|r %s", titleReason))
                end
                markDone("web_title_requests", titleReqId)
                processed = processed + 1
            else
                markError("web_title_requests", titleReqId, string.format("Title %s failed on login: %s", titleAction, tostring(titleErr)))
                errors = errors + 1
            end
        until not titleLoginQuery:NextRow()
    end

    if processed > 0 then
        player:SaveToDB()
        PrintInfo(string.format("[%s] Login delivery for %d: %d items/spells delivered, %d failed",
            SCRIPT_NAME, guid, processed, errors))
    end
end

--------------------------------------------------------------------------------
-- Initialization
--------------------------------------------------------------------------------

local function initialize()
    PrintInfo(string.format("[%s] Initializing unified web worker...", SCRIPT_NAME))

    -- Create tables if they don't exist
    CharDBExecute(CREATE_MONEY_TABLE_SQL)
    CharDBExecute(CREATE_ITEM_TABLE_SQL)
    CharDBExecute(CREATE_BAG_TABLE_SQL)
    CharDBExecute(CREATE_SPELL_TABLE_SQL)
    CharDBExecute(CREATE_AURA_TABLE_SQL)
    CharDBExecute(CREATE_TELEPORT_TABLE_SQL)
    CharDBExecute(CREATE_LEVEL_TABLE_SQL)
    CharDBExecute(CREATE_SKILL_TABLE_SQL)
    CharDBExecute(CREATE_REPUTATION_TABLE_SQL)
    CharDBExecute(CREATE_QUEST_TABLE_SQL)
    CharDBExecute(CREATE_TITLE_TABLE_SQL)
    PrintInfo(string.format("[%s] Ensured all queue tables exist", SCRIPT_NAME))

    -- Check if items_json column exists and add it if not
    local hasItemsJson = false
    local checkQuery = CharDBQuery(CHECK_ITEMS_JSON_COLUMN_SQL)
    if checkQuery then
        local count = checkQuery:GetUInt64(0)
        hasItemsJson = (count and count > 0)
    end

    if hasItemsJson then
        PrintInfo(string.format("[%s] items_json column already exists", SCRIPT_NAME))
        SELECT_PENDING_ITEM_SQL = SELECT_PENDING_ITEM_WITH_JSON_SQL
    else
        -- Try to add the column
        local ok, err = pcall(function()
            CharDBExecute(ADD_ITEMS_JSON_COLUMN_SQL)
        end)
        if ok then
            PrintInfo(string.format("[%s] Added items_json column to web_item_requests", SCRIPT_NAME))
            SELECT_PENDING_ITEM_SQL = SELECT_PENDING_ITEM_WITH_JSON_SQL
        else
            PrintError(string.format("[%s] Failed to add items_json column: %s", SCRIPT_NAME, tostring(err)))
            PrintInfo(string.format("[%s] Falling back to legacy mode (single item per mail)", SCRIPT_NAME))
            SELECT_PENDING_ITEM_SQL = SELECT_PENDING_ITEM_LEGACY_SQL
        end
    end

    -- Register the unified polling event
    local eventId = CreateLuaEvent(pollAllQueues, POLL_INTERVAL_MS, 0)

    if eventId then
        PrintInfo(string.format("[%s] Registered polling event (id: %d, interval: %dms)",
            SCRIPT_NAME, eventId, POLL_INTERVAL_MS))
    else
        PrintError(string.format("[%s] Failed to register polling event!", SCRIPT_NAME))
        return
    end

    -- Register player login hook for immediate bag delivery
    RegisterPlayerEvent(3, onPlayerLogin) -- PLAYER_EVENT_ON_LOGIN = 3

    PrintInfo(string.format("[%s] Unified web worker started successfully!", SCRIPT_NAME))
end

-- Run initialization
initialize()
