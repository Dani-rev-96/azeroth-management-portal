/**
 * POST /api/admin/feature-grants
 * Create a new feature grant (time-limited admin feature access for a user)
 * GM only
 *
 * Body: { userId: string, username: string, featureId: string, startTime: string, endTime: string, reason?: string }
 */
import { getAuthenticatedGM } from '#server/utils/auth'
import { FeatureGrantDB, ADMIN_FEATURES, type AdminFeatureId } from '#server/utils/user-settings'

export default defineEventHandler(async (event) => {
  const { username: gmUsername } = await getAuthenticatedGM(event)

  const body = await readBody(event)
  const { userId, username, featureId, startTime, endTime, reason, ownAccountOnly } = body as {
    userId: string
    username: string
    featureId: string
    startTime: string
    endTime: string
    reason?: string
    ownAccountOnly?: boolean
  }

  if (!userId || typeof userId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'User ID is required' })
  }
  if (!username || typeof username !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Username is required' })
  }
  if (!featureId || !(featureId in ADMIN_FEATURES)) {
    throw createError({ statusCode: 400, statusMessage: `Invalid feature ID: ${featureId}` })
  }
  if (!startTime || !endTime) {
    throw createError({ statusCode: 400, statusMessage: 'Start time and end time are required' })
  }

  const start = new Date(startTime)
  const end = new Date(endTime)

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid date format' })
  }
  if (end <= start) {
    throw createError({ statusCode: 400, statusMessage: 'End time must be after start time' })
  }

  try {
    const grant = FeatureGrantDB.create({
      userId,
      username,
      featureId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      grantedBy: gmUsername,
      reason,
      ownAccountOnly: ownAccountOnly || false,
    })

    const featureMeta = ADMIN_FEATURES[featureId as AdminFeatureId]
    console.log(`[FeatureGrants] GM ${gmUsername} granted "${featureMeta.label}" to ${username} (${userId}) from ${startTime} to ${endTime}`)

    return {
      success: true,
      message: `Granted "${featureMeta.label}" to ${username} until ${new Date(endTime).toLocaleString()}`,
      grant,
    }
  } catch (error: any) {
    if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw createError({ statusCode: 409, statusMessage: 'This exact grant already exists' })
    }
    throw createError({ statusCode: 500, statusMessage: 'Failed to create feature grant' })
  }
})
