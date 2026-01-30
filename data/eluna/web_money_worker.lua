--[[
    web_money_worker.lua

    Polls acore_characters.web_money_requests table and applies money changes
    to players (online or offline). Designed for direct-to-bag web shop purchases.

    The table is auto-created if it doesn't exist.

    Author: AzerothCore Nix Flake Project
    Version: 1.0
]]

local SCRIPT_NAME = "web_money_worker"
local POLL_INTERVAL_MS = 1000
local BATCH_SIZE = 50

-- Table creation SQL (runs once on startup)
local CREATE_TABLE_SQL = [[
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

-- SQL queries
local SELECT_PENDING_SQL = string.format(
                               "SELECT id, character_guid, delta_copper, reason FROM web_money_requests WHERE status='pending' ORDER BY id ASC LIMIT %d",
                               BATCH_SIZE)

--- Escape single quotes for SQL
---@param str string
---@return string
local function escapeSql(str)
    if not str then return "" end
    return tostring(str):gsub("'", "''"):sub(1, 250)
end

--- Mark a request as successfully processed
---@param id number
local function markDone(id)
    CharDBExecute(string.format(
                      "UPDATE web_money_requests SET status='done', processed_at=NOW() WHERE id=%d",
                      id))
end

--- Mark a request as failed with error text
---@param id number
---@param err string|nil
local function markError(id, err)
    local errText = escapeSql(err or "unknown error")
    CharDBExecute(string.format(
                      "UPDATE web_money_requests SET status='error', error_text='%s', processed_at=NOW() WHERE id=%d",
                      errText, id))
end

--- Process a single money request row
---@param row userdata ALEQuery row
---@return boolean success
local function processRow(row)
    -- Debug: try to see what we're getting
    PrintInfo(string.format("[%s] Row type: %s", SCRIPT_NAME, type(row)))

    -- Column indices are 0-based
    -- Try GetUInt32 for id since it should fit
    local rawId = row:GetUInt32(0)
    local rawGuid = row:GetUInt32(1)
    local rawDelta = row:GetInt32(2) -- Try Int32 instead of Int64
    local reason = row:GetString(3)

    PrintInfo(string.format(
                  "[%s] Raw values - id: %s (%s), guid: %s (%s), delta: %s (%s)",
                  SCRIPT_NAME, tostring(rawId), type(rawId), tostring(rawGuid),
                  type(rawGuid), tostring(rawDelta), type(rawDelta)))

    local id = tonumber(rawId)
    local guid = tonumber(rawGuid)
    local delta = tonumber(rawDelta)

    PrintInfo(string.format(
                  "[%s] Converted values - id: %s, guid: %s, delta: %s",
                  SCRIPT_NAME, tostring(id), tostring(guid), tostring(delta)))

    -- Validate data
    if not id or id == 0 then
        PrintError(string.format("[%s] Invalid request id", SCRIPT_NAME))
        return false
    end

    if not guid or guid == 0 then
        markError(id, "invalid character_guid")
        return false
    end

    if not delta then
        markError(id, "invalid delta_copper value")
        return false
    end

    -- Try to find online player first
    local player = GetPlayerByGUID(guid)

    if player then
        -- Player is online - modify money directly
        local currentMoney = tonumber(player:GetCoinage())
        local newMoney = currentMoney + delta

        -- Ensure we don't go negative
        if newMoney < 0 then
            markError(id, string.format("insufficient funds: has %d, needs %d",
                                        currentMoney, -delta))
            return false
        end

        -- Apply the change
        player:ModifyMoney(delta)
        player:SaveToDB()

        -- Send notification to player
        if reason and reason ~= "" then
            player:SendBroadcastMessage(string.format("|cff00ff00[Shop]|r %s",
                                                      reason))
        else
            if delta > 0 then
                player:SendBroadcastMessage(string.format(
                                                "|cff00ff00[Shop]|r You received %s",
                                                GetCoinTextureString(delta)))
            else
                player:SendBroadcastMessage(string.format(
                                                "|cff00ff00[Shop]|r %s was deducted",
                                                GetCoinTextureString(-delta)))
            end
        end

        PrintInfo(string.format(
                      "[%s] Processed request %d for online player (guid: %d, delta: %d)",
                      SCRIPT_NAME, id, guid, delta))
        markDone(id)
        return true
    else
        -- Player is offline - update database directly
        -- Check if character exists and get current money
        local checkQuery = CharDBQuery(string.format(
                                           "SELECT money FROM characters WHERE guid = %d",
                                           guid))

        if not checkQuery then
            markError(id, "character not found")
            return false
        end

        local currentMoney = tonumber(checkQuery:GetUInt32(0)) or 0
        PrintInfo(string.format("[%s] Offline player guid %d has %d copper",
                                SCRIPT_NAME, guid, currentMoney))

        -- Check for insufficient funds on negative delta
        if delta < 0 and currentMoney + delta < 0 then
            markError(id,
                      string.format(
                          "insufficient funds (offline): has %d, needs %d",
                          currentMoney, -delta))
            return false
        end

        -- Apply the change for offline player
        CharDBExecute(string.format(
                          "UPDATE characters SET money = GREATEST(0, CAST(money AS SIGNED) + (%d)) WHERE guid = %d",
                          delta, guid))

        PrintInfo(string.format(
                      "[%s] Processed request %d for offline player (guid: %d, delta: %d)",
                      SCRIPT_NAME, id, guid, delta))
        markDone(id)
        return true
    end
end

--- Main polling function - called every POLL_INTERVAL_MS
---@param eventId number
---@param delay number
---@param repeats number
local function pollRequests(eventId, delay, repeats)
    PrintInfo(string.format(
                  "[%s] Poll triggered, checking for pending requests...",
                  SCRIPT_NAME))

    local query = CharDBQuery(SELECT_PENDING_SQL)

    if not query then
        -- No pending requests, nothing to do
        PrintInfo(string.format("[%s] No pending requests found", SCRIPT_NAME))
        return
    end

    PrintInfo(string.format("[%s] Found pending requests, processing...",
                            SCRIPT_NAME))

    local processed = 0
    local errors = 0

    repeat
        local ok, result = pcall(processRow, query)
        if not ok then
            -- Lua error was thrown
            errors = errors + 1
            PrintError(string.format("[%s] Error processing row: %s",
                                     SCRIPT_NAME, tostring(result)))
        elseif result then
            -- processRow returned true (success)
            processed = processed + 1
        else
            -- processRow returned false (handled failure, already marked in DB)
            errors = errors + 1
        end
    until not query:NextRow()

    if processed > 0 or errors > 0 then
        PrintInfo(string.format("[%s] Batch complete: %d processed, %d errors",
                                SCRIPT_NAME, processed, errors))
    end
end

--- Initialize the worker on server startup
local function initialize()
    PrintInfo(
        string.format("[%s] Initializing web money worker...", SCRIPT_NAME))

    -- Create table if it doesn't exist
    CharDBExecute(CREATE_TABLE_SQL)
    PrintInfo(string.format("[%s] Ensured web_money_requests table exists",
                            SCRIPT_NAME))

    -- Register the polling event (runs every POLL_INTERVAL_MS, infinite repeats)
    local eventId = CreateLuaEvent(pollRequests, POLL_INTERVAL_MS, 0)

    if eventId then
        PrintInfo(string.format(
                      "[%s] Registered polling event (id: %d, interval: %dms)",
                      SCRIPT_NAME, eventId, POLL_INTERVAL_MS))
        PrintInfo(string.format("[%s] Web money worker started successfully!",
                                SCRIPT_NAME))
    else
        PrintError(string.format("[%s] Failed to register polling event!",
                                 SCRIPT_NAME))
    end
end

-- Run initialization
initialize()
