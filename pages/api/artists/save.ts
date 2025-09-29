import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db'; 
import axios from 'axios';

// データベースからユーザーの内部IDを取得するヘルパー関数
async function getUserIdBySpotifyId(client: any, spotifyUserId: string): Promise<number | null> {
    const res = await client.query('SELECT id FROM users WHERE spotify_user_id = $1', [spotifyUserId]);
    return res.rows.length > 0 ? res.rows[0].id : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // リクエストボディから Spotify User ID と選択されたアーティストの配列を取得
    const { spotifyUserId, selectedArtists } = req.body; // selectedArtists: { id, name }[]

    if (!spotifyUserId || !Array.isArray(selectedArtists)) {
        return res.status(400).json({ message: 'Missing required fields or invalid data format.' });
    }
    
    // 選択は最大3人に制限
    if (selectedArtists.length > 3) {
        return res.status(400).json({ message: 'You can select a maximum of 3 artists.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // トランザクション開始

        // 1. usersテーブルから内部IDを取得
        const userId = await getUserIdBySpotifyId(client, spotifyUserId);
        
        if (!userId) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'User profile not found. Please register your profile first.' });
        }

        // 2. 既存の選択をすべて削除
        await client.query('DELETE FROM selected_artists WHERE user_id = $1', [userId]);

        // 3. 新しい選択を挿入
        const insertPromises = selectedArtists.map((artist: { id: string, name: string }) => {
            return client.query(
                'INSERT INTO selected_artists (user_id, spotify_artist_id, artist_name) VALUES ($1, $2, $3)',
                [userId, artist.id, artist.name]
            );
        });

        await Promise.all(insertPromises);

        await client.query('COMMIT'); // トランザクションコミット
        res.status(200).json({ message: 'Selected artists saved successfully.' });

    } catch (dbError) {
        await client.query('ROLLBACK'); // エラー時はロールバック
        console.error('Database transaction failed:', dbError);
        res.status(500).json({ message: 'Failed to save selected artists due to database error.' });
    } finally {
        client.release();
    }
}