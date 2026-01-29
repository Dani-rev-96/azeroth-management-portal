/**
 * Character Service
 * Server-side service for querying WoW character data
 */

import type { RowDataPacket } from 'mysql2/promise'
import type { WoWCharacter, RealmId } from '~/types'
import { getCharactersDbPool } from '#server/utils/mysql'

/**
 * Get all characters for an account on a specific realm
 */
export async function getCharactersByAccountId(
  accountId: number,
  realmId: RealmId
): Promise<WoWCharacter[]> {
  const pool = await getCharactersDbPool(realmId)

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
      guid, name, race, class, gender, level, xp, money, online,
      skin, face, hairStyle, hairColor, facialStyle, playerFlags,
      deleteInfos_Account, deleteInfos_Name, deleteDate
    FROM characters
    WHERE account = ?
    ORDER BY level DESC, name ASC`,
    [accountId]
  )

  return rows.map(row => ({
    guid: row.guid,
    name: row.name,
    race: row.race,
    class: row.class,
    gender: row.gender,
    level: row.level,
    xp: row.xp,
    money: row.money,
    online: row.online === 1,
    skin: row.skin,
    face: row.face,
    hairStyle: row.hairStyle,
    hairColor: row.hairColor,
    facialStyle: row.facialStyle,
    flags: row.playerFlags,
    deleteInfos_Account: row.deleteInfos_Account,
    deleteInfos_Name: row.deleteInfos_Name,
    deleteDate: row.deleteDate,
  }))
}

/**
 * Get a single character by GUID
 */
export async function getCharacterByGuid(
  guid: number,
  realmId: RealmId
): Promise<WoWCharacter | null> {
  const pool = await getCharactersDbPool(realmId)

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
      guid, name, race, class, gender, level, xp, money,
      skin, face, hairStyle, hairColor, facialStyle, playerFlags,
      deleteInfos_Account, deleteInfos_Name, deleteDate
    FROM characters
    WHERE guid = ?`,
    [guid]
  )

  if (rows.length === 0) {
    return null
  }

  const row = rows[0]
  return {
    guid: row.guid,
    name: row.name,
    race: row.race,
    class: row.class,
    gender: row.gender,
    level: row.level,
    xp: row.xp,
    money: row.money,
    skin: row.skin,
    face: row.face,
    hairStyle: row.hairStyle,
    hairColor: row.hairColor,
    facialStyle: row.facialStyle,
    flags: row.playerFlags,
    deleteInfos_Account: row.deleteInfos_Account,
    deleteInfos_Name: row.deleteInfos_Name,
    deleteDate: row.deleteDate,
  }
}
