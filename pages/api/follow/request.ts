// pages/api/follow/request.ts (新規作成)
import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db'; // lib/db からインポート
import { PoolClient } from 'pg';

// ユーザーID (uuid) を取得するヘルパー関数
async function getUserIdBySpotifyId(client: PoolClient, spotifyUserId: string): Promise<string | null> {
    const res = await client.query('SELECT id FROM users WHERE spotify_user_id = $1', [spotifyUserId]);
    return res.rows.length > 0 ? res.rows[0].id : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // POSTメソッド以外は 405 エラーを返す
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // リクエストボディから自分のSpotifyIDと相手のユーザーID (uuid) を取得
    const { selfSpotifyId, targetUserId } = req.body;

    // 必須パラメータのチェック
    if (!selfSpotifyId || !targetUserId) {
        return res.status(400).json({ message: 'Missing selfSpotifyId or targetUserId.' });
    }
    // IDの型が uuid (string) であることを確認 (簡易チェック)
    if (typeof selfSpotifyId !== 'string' || typeof targetUserId !== 'string' || selfSpotifyId.length < 10 || targetUserId.length < 10 ) {
         return res.status(400).json({ message: 'Invalid ID format.' });
    }
    // 自分自身へのフォローは禁止
    if (selfSpotifyId === targetUserId) { // Spotify ID で比較しても良い
         return res.status(400).json({ message: 'Cannot follow yourself.' });
    }

    const client = await pool.connect();
    try {
        // 自分の内部ID (uuid) を取得
        const selfId = await getUserIdBySpotifyId(client, selfSpotifyId);
        if (!selfId) {
            return res.status(404).json({ message: 'Self user not found in database.' });
        }

        // 相手が自分自身でないことを確認 (内部IDで比較)
        if (selfId === targetUserId) {
             return res.status(400).json({ message: 'Internal check: Cannot follow yourself.' });
        }

        // 相手のユーザー (targetUserId) が DB に存在するか確認
        const targetUserCheck = await client.query('SELECT id FROM users WHERE id = $1', [targetUserId]);
        if (targetUserCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Target user not found.' });
        }

        // 既にリクエスト/マッチ済みか確認 (双方向でチェック)
        const check = await client.query(
            `SELECT id, follower_id, status FROM follows
             WHERE (follower_id = $1 AND following_id = $2)
                OR (follower_id = $2 AND following_id = $1)`,
            [selfId, targetUserId] // uuid (string) で比較
        );

        if (check.rows.length > 0) {
            const existingRequest = check.rows[0];
            // 相手からリクエストが来ていた場合 (follower_id が相手のIDと一致)
            if (existingRequest.follower_id === targetUserId && existingRequest.status === 'pending') {
                // 自動で 'approved' (マッチ成立) に更新
                await client.query(
                    'UPDATE follows SET status = $1 WHERE id = $2',
                    ['approved', existingRequest.id] // id は bigint
                );
                // 成功レスポンス (マッチ成立)
                return res.status(200).json({ message: 'Match approved automatically!', status: 'approved' });
            }
            // 自分が既にリクエスト済み、または既にマッチ済みなどの場合
            return res.status(409).json({ message: 'Request already exists or is in a different state.', status: existingRequest.status });
        }

        // 新規リクエスト (follower_id, following_id は uuid)
        await client.query(
            'INSERT INTO follows (follower_id, following_id, status) VALUES ($1, $2, $3)',
            [selfId, targetUserId, 'pending'] // status を 'pending' で作成
        );

        // 成功レスポンス (リクエスト送信完了)
        res.status(201).json({ message: 'Follow request sent!', status: 'pending' });

    } catch (dbError: unknown) { // unknown 型を使用
        console.error('Follow request database operation failed:', dbError);
        let errorMessage = 'Database error occurred during follow request.';
        if (dbError instanceof Error) {
            errorMessage += ` Details: ${dbError.message}`;
            // PostgreSQLのエラーコードなどを確認する場合
            // if (dbError.code === '...') { /* 特定のエラー処理 */ }
        }
        res.status(500).json({ message: errorMessage });
    } finally {
        client.release(); // DB接続をプールに返す
    }
}