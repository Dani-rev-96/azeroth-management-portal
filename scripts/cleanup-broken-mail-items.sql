-- ============================================================================
-- Cleanup Broken Mail Items Script
-- ============================================================================
-- This script finds and removes broken mail, mail_items, and item_instance
-- entries where items don't belong to the mail receiver.
-- ============================================================================

-- ============================================================================
-- DIAGNOSTIC QUERIES (Run these first to see what will be affected)
-- ============================================================================

-- 1. Find mail_items where the item's owner doesn't match the mail receiver
-- This catches items that were incorrectly assigned to mail
SELECT
    m.id AS mail_id,
    m.receiver AS mail_receiver_guid,
    m.subject,
    mi.item_guid,
    ii.owner_guid AS item_owner_guid,
    c_receiver.name AS receiver_name,
    c_owner.name AS item_owner_name
FROM acore_characters.mail m
INNER JOIN acore_characters.mail_items mi ON m.id = mi.mail_id
INNER JOIN acore_characters.item_instance ii ON mi.item_guid = ii.guid
LEFT JOIN acore_characters.characters c_receiver ON m.receiver = c_receiver.guid
LEFT JOIN acore_characters.characters c_owner ON ii.owner_guid = c_owner.guid
WHERE ii.owner_guid != m.receiver;

-- 2. Find mail_items referencing non-existent items (orphaned mail_items)
SELECT
    m.id AS mail_id,
    m.receiver AS mail_receiver_guid,
    m.subject,
    mi.item_guid AS missing_item_guid,
    c.name AS receiver_name
FROM acore_characters.mail m
INNER JOIN acore_characters.mail_items mi ON m.id = mi.mail_id
LEFT JOIN acore_characters.item_instance ii ON mi.item_guid = ii.guid
LEFT JOIN acore_characters.characters c ON m.receiver = c.guid
WHERE ii.guid IS NULL;

-- 3. Count of affected entries
SELECT
    'mail_items with wrong owner' AS issue_type,
    COUNT(*) AS count
FROM acore_characters.mail m
INNER JOIN acore_characters.mail_items mi ON m.id = mi.mail_id
INNER JOIN acore_characters.item_instance ii ON mi.item_guid = ii.guid
WHERE ii.owner_guid != m.receiver

UNION ALL

SELECT
    'mail_items with missing item' AS issue_type,
    COUNT(*) AS count
FROM acore_characters.mail_items mi
LEFT JOIN acore_characters.item_instance ii ON mi.item_guid = ii.guid
WHERE ii.guid IS NULL

UNION ALL

SELECT
    'mail with broken items (total mails affected)' AS issue_type,
    COUNT(DISTINCT m.id) AS count
FROM acore_characters.mail m
INNER JOIN acore_characters.mail_items mi ON m.id = mi.mail_id
LEFT JOIN acore_characters.item_instance ii ON mi.item_guid = ii.guid
WHERE ii.guid IS NULL OR ii.owner_guid != m.receiver;


-- ============================================================================
-- CLEANUP QUERIES (Run after verifying diagnostic results)
-- ============================================================================

-- STEP 1: Delete mail_items where item owner doesn't match mail receiver
-- This removes the link between mail and wrongly-owned items
DELETE mi FROM acore_characters.mail_items mi
INNER JOIN acore_characters.mail m ON mi.mail_id = m.id
INNER JOIN acore_characters.item_instance ii ON mi.item_guid = ii.guid
WHERE ii.owner_guid != m.receiver;

-- STEP 2: Delete mail_items referencing non-existent items
DELETE mi FROM acore_characters.mail_items mi
LEFT JOIN acore_characters.item_instance ii ON mi.item_guid = ii.guid
WHERE ii.guid IS NULL;

-- STEP 3: Delete mail entries that now have no items AND had items_count > 0
-- (These are now empty mails that were supposed to have items)
DELETE m FROM acore_characters.mail m
LEFT JOIN acore_characters.mail_items mi ON m.id = mi.mail_id
WHERE m.has_items = 1
  AND mi.mail_id IS NULL;

-- ALTERNATIVE STEP 3: If you want to keep the mail but fix has_items flag
-- UPDATE mail m
-- LEFT JOIN mail_items mi ON m.id = mi.mail_id
-- SET m.has_items = 0
-- WHERE m.has_items = 1 AND mi.mail_id IS NULL;


-- ============================================================================
-- OPTIONAL: Find orphaned item_instances (items with no owner in characters)
-- ============================================================================

-- Find items owned by non-existent characters (might be intentional for guild bank, etc.)
SELECT
    ii.guid AS item_guid,
    ii.owner_guid,
    ii.itemEntry,
    ii.count
FROM acore_characters.item_instance ii
LEFT JOIN acore_characters.characters c ON ii.owner_guid = c.guid
WHERE ii.owner_guid != 0 AND c.guid IS NULL
LIMIT 100;


-- ============================================================================
-- TRANSACTION WRAPPER (Recommended for safety)
-- ============================================================================
-- Uncomment and use this wrapper for the cleanup queries:

/*
START TRANSACTION;

-- Run cleanup queries here...

-- Verify results look correct, then:
-- COMMIT;

-- Or if something went wrong:
-- ROLLBACK;
*/
