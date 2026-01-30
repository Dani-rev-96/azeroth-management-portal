--[[
    web_worker.lua

    Unified worker script that polls queue tables and processes:
    - Money additions/deductions (web_money_requests)
    - Item delivery via mail (web_item_requests)
    - Direct-to-bag item delivery (web_bag_requests)

    Using a single polling timer is more efficient than separate scripts,
    reduces database connections, and shares common utility functions.

    The tables are auto-created if they don't exist.

    Author: AzerothCore Nix Flake Project
    Version: 2.0
]]

local SCRIPT_NAME = "web_worker"
local POLL_INTERVAL_MS = 1000
local BATCH_SIZE = 50

-- Mail constants
local MAIL_STATIONERY_DEFAULT = 61 -- GM stationery

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
    item_entry INT UNSIGNED NOT NULL,
    item_count INT UNSIGNED NOT NULL DEFAULT 1,
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

--------------------------------------------------------------------------------
-- SQL Queries
--------------------------------------------------------------------------------

local SELECT_PENDING_MONEY_SQL = string.format(
    "SELECT id, character_guid, delta_copper, reason FROM web_money_requests WHERE status='pending' ORDER BY id ASC LIMIT %d",
    BATCH_SIZE
)

local SELECT_PENDING_ITEM_SQL = string.format(
    "SELECT id, character_guid, item_entry, item_count, mail_subject, mail_body, money, reason FROM web_item_requests WHERE status='pending' ORDER BY id ASC LIMIT %d",
    BATCH_SIZE
)

-- For bag requests, we also select 'waiting' status (player was offline, retry)
local SELECT_PENDING_BAG_SQL = string.format(
    "SELECT id, character_guid, item_entry, item_count, reason FROM web_bag_requests WHERE status IN ('pending', 'waiting') ORDER BY id ASC LIMIT %d",
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

--- Process a single mail item request row
---@param row userdata Query row
---@return boolean success
local function processItemRow(row)
    local id = tonumber(row:GetUInt32(0))
    local guid = tonumber(row:GetUInt32(1))
    local itemEntry = tonumber(row:GetUInt32(2)) or 0
    local itemCount = tonumber(row:GetUInt32(3)) or 1
    local mailSubject = row:GetString(4) or "Web Delivery"
    local mailBody = row:GetString(5) or "Your items have been delivered."
    local money = tonumber(row:GetUInt32(6)) or 0
    local reason = row:GetString(7)

    if not id or id == 0 then
        PrintError(string.format("[%s] Mail: Invalid request id", SCRIPT_NAME))
        return false
    end

    if not guid or guid == 0 then
        markError("web_item_requests", id, "invalid character_guid")
        return false
    end

    local isMoneyOnly = itemEntry == 0

    if not isMoneyOnly then
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
    end

    if isMoneyOnly and money == 0 then
        markError("web_item_requests", id, "money-only request has no money")
        return false
    end

    local charName = getCharacterName(guid)
    if not charName then
        markError("web_item_requests", id, "character not found")
        return false
    end

    -- Build items table
    local itemsTable = {}
    if not isMoneyOnly then
        table.insert(itemsTable, {itemEntry, itemCount})
    end

    -- SendMail properly allocates item GUIDs via the server
    local success = SendMail(
        mailSubject,
        mailBody,
        guid,
        0, -- sender = system
        MAIL_STATIONERY_DEFAULT,
        0, -- delay
        money,
        0, -- COD
        itemsTable
    )

    if success then
        -- Notify if online
        local player = GetPlayerByGUID(guid)
        if player then
            local msg = reason or string.format("You have new mail with %dx item(s)!", itemCount)
            player:SendBroadcastMessage(string.format("|cff00ff00[Shop]|r %s", msg))
        end

        PrintInfo(string.format("[%s] Mail: Processed %d for %s - item %d x%d",
            SCRIPT_NAME, id, charName, itemEntry, itemCount))
        markDone("web_item_requests", id)
        return true
    else
        markError("web_item_requests", id, "SendMail failed")
        return false
    end
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

    if processed > 0 then
        player:SaveToDB()
        PrintInfo(string.format("[%s] Login delivery for %d: %d items delivered, %d failed",
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
    PrintInfo(string.format("[%s] Ensured all queue tables exist", SCRIPT_NAME))

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
