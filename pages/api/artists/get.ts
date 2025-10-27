// pages/api/artists/get.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';
import { PoolClient } from 'pg';

// DBからユーザーの内部IDを取得するヘルパー関数
async function getUserIdBySpotifyId(client: PoolClient, spotifyUserId: string): Promise<number | null> {
    const res = await client.query('SELECT id FROM users WHERE spotify_user_id = $1', [spotifyUserId]);
    return res.rows.length > 0 ? res.rows[0].id : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { spotifyUserId } = req.query;

    if (!spotifyUserId || typeof spotifyUserId !== 'string') {
        return res.status(400).json({ message: 'Missing spotifyUserId.' });
    }

    const client = await pool.connect();
    try {
        const userId = await getUserIdBySpotifyId(client, spotifyUserId);
        if (!userId) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // 1. 選択済みアーティストを取得
        const selectedRes = await client.query(
            `SELECT 
                spotify_artist_id as id, 
                artist_name as name, 
                image_url as image 
             FROM selected_artists 
             WHERE user_id = $1`,
            [userId]
        );

        // 2. 算出済みアーティストを取得 (スコア順)
        const calculatedRes = await client.query(
            `SELECT 
                spotify_artist_id as id, 
                artist_name as name, 
                image_url as image 
             FROM calculated_artists 
             WHERE user_id = $1 
             ORDER BY score DESC`,
            [userId]
        );

        res.status(200).json({
            selectedArtists: selectedRes.rows,
            calculatedArtists: calculatedRes.rows,
        });

    } catch (dbError) {
        console.error('Failed to get artists:', dbError);
        res.status(500).json({ message: 'Failed to get artists due to database error.' });
    } finally {
        client.release();
    }
}