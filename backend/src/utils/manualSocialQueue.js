// The publication guard and queue update must happen in one statement. A stale
// route-level read must never revert a concurrently completed publication.
export async function queueManualSocialPost(database, postId, userId) {
  if (!userId || !postId) return null;
  const { rows } = await database.query(
    `update marketing.social_posts
     set data = data || $3::jsonb, updated_at = now()
     where id = $1 and owner_id = $2
       and coalesce(data->>'published', 'false') <> 'true'
       and coalesce(data->>'status', 'draft') not in ('published', 'publishing')
     returning *`,
    [postId, userId, JSON.stringify({ status: 'queued', published: false, scheduledAt: null, queueMode: 'manual', automaticPublishing: false })],
  );
  return rows[0] || null;
}
