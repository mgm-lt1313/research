import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';
import { PoolClient } from 'pg';

// DBからユーザーの内部IDを取得するヘルパー関数
async function getUserIdBySpotifyId(client: PoolClient, spotifyUserId: string): Promise<number | null> {
    const res = await client.query('SELECT id FROM users WHERE spotify_user_id = $1', [spotifyUserId]);
    return res.rows.length > 0 ? res.rows[0].id : null;
}

// 全ユーザーの選択アーティストを取得するヘルパー関数
interface UserArtists {
    user_id: number;
    spotify_artist_id: string;
    artist_name: string;
}

async function getAllSelectedArtists(client: PoolClient): Promise<Map<number, UserArtists[]>> {
    const res = await client.query('SELECT user_id, spotify_artist_id, artist_name FROM selected_artists');
    
    const userMap = new Map<number, UserArtists[]>();
    for (const row of res.rows) {
        if (!userMap.has(row.user_id)) {
            userMap.set(row.user_id, []);
        }
        userMap.get(row.user_id)!.push({
            user_id: row.user_id,
            spotify_artist_id: row.spotify_artist_id,
            artist_name: row.artist_name,
        });
    }
    return userMap;
}


// ----------------------------------------------------
// メインAPIハンドラ
// ----------------------------------------------------

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { spotifyUserId } = req.body;

    if (!spotifyUserId) {
        return res.status(400).json({ message: 'Missing spotifyUserId.' });
    }

    const client = await pool.connect();
    try {
        // 1. リクエスト元の内部IDと選択アーティストを取得
        const currentUserId = await getUserIdBySpotifyId(client, spotifyUserId);
        if (!currentUserId) {
            return res.status(404).json({ message: 'Current user profile not found.' });
        }
        
        // 2. 全ユーザーの選択アーティスト情報を取得
        const allUserArtistsMap = await getAllSelectedArtists(client);

        const currentUserArtists = allUserArtistsMap.get(currentUserId)?.map(a => a.spotify_artist_id) || [];

        const matches: { matched_user_id: number, score: number }[] = [];
        
        // 3. 全ユーザーとマッチングスコアを計算
        for (const [matchedUserId, matchedUserArtists] of allUserArtistsMap.entries()) {
            if (matchedUserId === currentUserId) continue; // 自分自身はスキップ
            
            const matchedArtistIds = matchedUserArtists.map(a => a.spotify_artist_id);
            
            let score = 0;
            const sharedArtists: string[] = []; // 共有アーティストIDを保持
            
            for (const artistId of currentUserArtists) {
                if (matchedArtistIds.includes(artistId)) {
                    score++;
                    sharedArtists.push(artistId);
                }
            }

            if (score > 0) {
                matches.push({
                    matched_user_id: matchedUserId,
                    score: score,
                    // 将来的に sharedArtists を表示に使いたい場合は、ここでDBに保存する
                });
            }
        }

        // 4. スコアで降順ソート
        matches.sort((a, b) => b.score - a.score);

        // 5. マッチング結果を返す (ここではDB保存はせず、結果のみ返す)
        res.status(200).json({ matches });

    } catch (dbError) {
        console.error('Matching calculation failed:', dbError);
        res.status(500).json({ message: 'Matching calculation failed due to database error.' });
    } finally {
        client.release();
    }
}