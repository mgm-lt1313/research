// pages/api/follow/accept.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';
import { PoolClient } from 'pg';

async function getUserIdBySpotifyId(client: PoolClient, spotifyUserId: string): Promise<string | null> {
    const res = await client.query('SELECT id FROM users WHERE spotify_user_id = $1', [spotifyUserId]);
    return res.rows.length > 0 ? res.rows[0].id : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).end();

    const { selfSpotifyId, followId: followIdInput } = req.body; // 👈 変数名を変更

    if (!selfSpotifyId || followIdInput === undefined || followIdInput === null) { // 👈 undefined/null チェックを追加
        return res.status(400).json({ message: 'Missing selfSpotifyId or followId.' });
    }

    // --- 🔽 型チェックと変換 ---
    let followId: number;
    if (typeof followIdInput === 'string') {
        followId = parseInt(followIdInput, 10); // 文字列なら数値に変換
        if (isNaN(followId)) { // 変換に失敗したらエラー
             return res.status(400).json({ message: 'Invalid followId format, expected number or numeric string.' });
        }
    } else if (typeof followIdInput === 'number') {
        followId = followIdInput; // もともと数値ならそのまま使う
    } else {
        // 数値でも文字列でもない場合はエラー
        return res.status(400).json({ message: 'Invalid followId type.' });
    }
    // --- 🔼 型チェックと変換 ---


    const client = await pool.connect();
    try {
        const selfId = await getUserIdBySpotifyId(client, selfSpotifyId); // string | null (uuid)
        if (!selfId) return res.status(404).json({ message: 'User not found.' });

        // followId (数値に変換済み) を使って更新
        const updateRes = await client.query(
            `UPDATE follows
             SET status = 'approved'
             WHERE id = $1                 -- bigint (数値)
               AND following_id = $2     -- uuid (文字列)
               AND status = 'pending'
             RETURNING id`,
            [followId, selfId] // 👈 変換後の followId を使用
        );

        if (updateRes.rowCount === 0) {
            return res.status(404).json({ message: 'Pending follow request not found for this user, or already approved/rejected.' });
        }

        res.status(200).json({ message: 'Match approved successfully!', match_id: updateRes.rows[0].id });

    } catch (dbError: unknown) {
        console.error('Failed to accept follow request:', dbError);
        const message = dbError instanceof Error ? dbError.message : 'Unknown database error';
        res.status(500).json({ message: `Database error while accepting follow: ${message}` });
    } finally {
        client.release();
    }
}