import { query } from '../config/db.js';

export async function listMessagesForThread(threadId) {
  const result = await query('SELECT * FROM messages WHERE thread_id = $1 ORDER BY created_at ASC', [threadId]);
  return result.rows;
}
