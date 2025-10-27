// pages/api/follow/accept.ts (新規作成)
import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';
import { PoolClient } from 'pg';

async function getUserIdBySpotifyId(client: PoolClient, spotifyUserId: string): Promise<string | null> {
    const res = await client.query('SELECT id FROM users WHERE spotify_user_id = $1', [spotifyUserId]);
    return res.rows.length > 0 ? res.rows[0].id : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).end();

    const { selfSpotifyId, followId } = req.body;

    if (!selfSpotifyId || !followId) {
        return res.status(400).json({ message: 'Missing selfSpotifyId or followId.' });
    }
    // followId は数値 (bigint) か確認
    if (typeof followId !== 'number') {
        return res.status(400).json({ message: 'Invalid followId format, expected number.' });
    }

    const client = await pool.connect();
    try {
        const selfId = await getUserIdBySpotifyId(client, selfSpotifyId); // string | null (uuid)
        if (!selfId) return res.status(404).json({ message: 'User not found.' });

        // 指定された followId のレコードが、
        // 1. 自分がフォローされた側 (following_id = selfId) であり、
        // 2. 現在のステータスが 'pending' であること
        // を確認した上で、status を 'approved' に更新する。
        const updateRes = await client.query(
            `UPDATE follows
             SET status = 'approved'
             WHERE id = $1                 -- 指定された followId (bigint)
               AND following_id = $2     -- 自分がフォローされた側 (uuid)
               AND status = 'pending'      -- 現在承認待ちであること
             RETURNING id`, // 更新に成功したら id (bigint) を返す
            [followId, selfId]
        );

        // 更新された行が 0 行の場合 (条件に一致しなかった場合)
        if (updateRes.rowCount === 0) {
            // 既に承認済みか、リクエストが存在しない、または自分宛でない可能性
            return res.status(404).json({ message: 'Pending follow request not found for this user, or already approved/rejected.' });
        }

        // 承認成功
        res.status(200).json({ message: 'Match approved successfully!', match_id: updateRes.rows[0].id });

    } catch (dbError: unknown) { // unknown 型を使用
        console.error('Failed to accept follow request:', dbError);
        const message = dbError instanceof Error ? dbError.message : 'Unknown database error';
        res.status(500).json({ message: `Database error while accepting follow: ${message}` });
    } finally {
        client.release();
    }
}