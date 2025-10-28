// pages/api/chat/[match_id].ts (新規作成)
import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';
import { PoolClient } from 'pg';

// ユーザーID (uuid) を取得するヘルパー関数
async function getUserIdBySpotifyId(client: PoolClient, spotifyUserId: string): Promise<string | null> {
    const res = await client.query('SELECT id FROM users WHERE spotify_user_id = $1', [spotifyUserId]);
    return res.rows.length > 0 ? res.rows[0].id : null;
}

// 認証チェック (簡易版 - 本来はミドルウェアなどで行う)
// 指定された match_id (follows.id) にユーザーが参加しているか確認
async function verifyUserMatchAccess(client: PoolClient, userId: string, matchId: number): Promise<boolean> {
     const res = await client.query(
         `SELECT 1 FROM follows
          WHERE id = $1 AND (follower_id = $2 OR following_id = $2) AND status = 'approved'`,
         [matchId, userId]
     );
     // --- 🔽 null 合体演算子 (??) を使って null の場合に 0 として評価 ---
     // return res.rowCount > 0; // 元のコード
     return (res.rowCount ?? 0) > 0; // 👈 修正後
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { match_id: matchIdStr } = req.query as { match_id?: string };
    // 自分のSpotify ID (GET時はクエリ, POST時はボディから取得 - 実際の認証方法に合わせる)
    const selfSpotifyId = (req.method === 'GET' ? req.query.selfSpotifyId : req.body.senderSpotifyId) as string | undefined;

    // --- 🔽 ログを追加 (リクエスト受信直後) ---
    console.log(`[API /api/chat/${matchIdStr}] Received ${req.method} request.`);
    console.log(`  Query params:`, req.query);
    console.log(`  Body params:`, req.body);
    console.log(`  Resolved selfSpotifyId:`, selfSpotifyId);
    // --- 🔼 ログを追加 ---

    // --- IDのバリデーション ---
    if (!matchIdStr) {
        return res.status(400).json({ message: 'Missing match_id in URL path.' });
    }
    const matchId = parseInt(matchIdStr, 10);
    if (isNaN(matchId)) {
        return res.status(400).json({ message: 'Invalid match_id format, expected number.' });
    }
    if (!selfSpotifyId) {
        return res.status(401).json({ message: 'Missing authentication information (selfSpotifyId).' });
    }
    // --- バリデーションここまで ---

    const client = await pool.connect();
    try {
        // 自分の内部ID (uuid) を取得
        const selfId = await getUserIdBySpotifyId(client, selfSpotifyId);
        // --- 🔽 ログを追加 (ユーザーID取得後) ---
        console.log(`  Internal selfId (uuid):`, selfId);
        // --- 🔼 ログを追加 ---
        if (!selfId) {
            return res.status(401).json({ message: 'User not found or invalid credentials.' });
        }

        // このユーザーが指定された matchId のチャットにアクセス権があるか確認
        const isParticipant = await verifyUserMatchAccess(client, selfId, matchId);
        // --- 🔽 ログを追加 (アクセス権確認後) ---
        console.log(`  Is participant authorized:`, isParticipant);
        // --- 🔼 ログを追加 ---
        if (!isParticipant) {
            return res.status(403).json({ message: 'You do not have access to this chat room.' });
        }

        // --- HTTPメソッドに応じて処理を分岐 ---
        if (req.method === 'GET') {
            // メッセージ履歴を取得 (新しい順)
            const messagesRes = await client.query(
                `SELECT id, created_at, sender_id, content
                 FROM messages
                 WHERE match_id = $1
                 ORDER BY created_at ASC`, // 昇順で取得 (古い順)
                [matchId]
            );
            res.status(200).json({ messages: messagesRes.rows });

        } else if (req.method === 'POST') {
            const { content } = req.body;
            // --- 🔽 ログを追加 (POST処理開始時) ---
             console.log(`  POST content:`, content);
             // --- 🔼 ログを追加 ---
            if (!content || typeof content !== 'string' || content.trim().length === 0) {
                return res.status(400).json({ message: 'Message content cannot be empty.' });
            }
            // --- 🔽 ログを追加 (DB挿入前) ---
            console.log(`  Attempting to insert message: matchId=${matchId}, senderId=${selfId}, content=${content.trim()}`);
            // --- 🔼 ログを追加 ---

            // 新しいメッセージを messages テーブルに挿入
            const insertRes = await client.query(
                `INSERT INTO messages (match_id, sender_id, content)
                 VALUES ($1, $2, $3)
                 RETURNING id, created_at, sender_id, content`, // 挿入したメッセージ情報を返す
                [matchId, selfId, content.trim()] // sender_id は selfId (uuid)
            );
            // --- 🔽 ログを追加 (DB挿入後) ---
            console.log(`  Message inserted successfully:`, insertRes.rows[0]);
            // --- 🔼 ログを追加 ---

            // (任意) リアルタイム通知などを実装する場合はここで行う (例: Supabase Realtime)

            res.status(201).json({ message: 'Message sent successfully.', newMessage: insertRes.rows[0] });

        } else {
            // GET, POST 以外のメソッドは許可しない
            res.setHeader('Allow', ['GET', 'POST']);
            res.status(405).json({ message: `Method ${req.method} Not Allowed` });
        }

    } catch (dbError: unknown) {
        console.error(`Chat API error for match ${matchId}:`, dbError);
        const message = dbError instanceof Error ? dbError.message : 'Unknown database error';
        res.status(500).json({ message: `Database error in chat API: ${message}` });
    } finally {
        client.release();
    }
}