// pages/api/artists/save.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';
import { PoolClient } from 'pg';
import { getArtistRelatedArtists } from '../../../lib/spotify'; // 関連アーティスト取得関数
import Graph from 'graphology'; // グラフ作成
import { pagerank } from 'graphology-metrics/centrality'; // PageRank計算

// 選択されたアーティストの型 (フロントから渡される)
interface SelectedArtistInput {
  id: string;
  name: string;
  image: string | null;
}

// 関連アーティスト情報（キャッシュ用）
interface ArtistCache {
  id: string;
  name: string;
  image: string | null;
  score?: number;
}

// DBからユーザーの内部IDを取得するヘルパー関数
async function getUserIdBySpotifyId(client: PoolClient, spotifyUserId: string): Promise<number | null> {
    const res = await client.query('SELECT id FROM users WHERE spotify_user_id = $1', [spotifyUserId]);
    return res.rows.length > 0 ? res.rows[0].id : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // 🔽 accessToken と image を含む selectedArtists を受け取る
    const { spotifyUserId, selectedArtists, accessToken } = req.body as {
        spotifyUserId: string;
        selectedArtists: SelectedArtistInput[];
        accessToken: string; // Spotify API呼び出しに必要
    };

    console.log("Access token received:", accessToken?.slice(0, 10) || "MISSING");

    if (!spotifyUserId || !Array.isArray(selectedArtists) || !accessToken) {
        return res.status(400).json({ message: 'Missing required fields or invalid data format.' });
    }
    
    if (selectedArtists.length === 0 || selectedArtists.length > 3) {
        return res.status(400).json({ message: 'You must select between 1 and 3 artists.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // トランザクション開始

        // 1. usersテーブルから内部IDを取得
        const userId = await getUserIdBySpotifyId(client, spotifyUserId);
        
        if (!userId) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'User profile not found.' });
        }

        // 2. 既存の「選択アーティスト」をすべて削除
        await client.query('DELETE FROM selected_artists WHERE user_id = $1', [userId]);

        // 3. 新しい「選択アーティスト」を挿入 (image_url も保存)
        const insertPromises = selectedArtists.map((artist) => {
            return client.query(
                'INSERT INTO selected_artists (user_id, spotify_artist_id, artist_name, image_url) VALUES ($1, $2, $3, $4)',
                [userId, artist.id, artist.name, artist.image]
            );
        });
        await Promise.all(insertPromises);

        // ----------------------------------------------------
        // 4. 関連アーティストの計算 (PageRank)
        // ----------------------------------------------------
        const graph = new Graph();
        // API呼び出し回数を減らすため、取得したアーティスト情報を一時的にキャッシュ
        const artistCache = new Map<string, ArtistCache>();

        // グラフのノードとエッジを構築
        for (const artist of selectedArtists) {
            // 選択されたアーティストをノードとして追加
            if (!graph.hasNode(artist.id)) {
                graph.addNode(artist.id);
                artistCache.set(artist.id, { id: artist.id, name: artist.name, image: artist.image });
            }

            // Spotify APIから関連アーティストを取得
            const related = await getArtistRelatedArtists(accessToken, artist.id);

            for (const relArtist of related) {
                // 関連アーティストをノードとして追加
                if (!graph.hasNode(relArtist.id)) {
                    graph.addNode(relArtist.id);
                    artistCache.set(relArtist.id, {
                        id: relArtist.id,
                        name: relArtist.name,
                        image: relArtist.images?.[0]?.url || null,
                    });
                }
                // 選択アーティストと関連アーティスト間にエッジ（つながり）を追加
                if (!graph.hasUndirectedEdge(artist.id, relArtist.id)) {
                    graph.addUndirectedEdge(artist.id, relArtist.id);
                }
            }
        }

        // PageRankを計算
        const ranks = pagerank(graph);

        // ランクをスコア順にソート
        const sortedRanks = Object.entries(ranks)
            .sort(([, scoreA], [, scoreB]) => scoreB - scoreA);

        // ▼▼▼ デバッグログ追加 ▼▼▼
        console.log(`[API Save] PageRank calculated. Total nodes in graph: ${graph.order}, Total ranks: ${sortedRanks.length}`);
        // ▲▲▲ デバッグログ追加 ▲▲▲

        // 選択されたアーティスト（元）のIDセット
        const selectedIds = new Set(selectedArtists.map(a => a.id));
        
        // 🔽 top5Calculated の型を ArtistCache[] に変更 (score を含む) 🔽
        const top5Calculated: ArtistCache[] = [];

        for (const [artistId, score] of sortedRanks) {
            if (!selectedIds.has(artistId)) {
                const details = artistCache.get(artistId);
                if (details) {
                    // 🔽 score をオブジェクトに追加してpush 🔽
                    top5Calculated.push({ ...details, score: score });
                }
            }
            if (top5Calculated.length >= 5) {
                break;
            }
        }

        // ▼▼▼ デバッグログ追加 ▼▼▼
        // Vercelのログで、最終的な算出結果が何件だったか確認します。
        console.log(`[API Save] Top 5 calculated artists (result): ${top5Calculated.length} found.`);
        // ▲▲▲ デバッグログ追加 ▲▲▲

        // 5. 既存の「算出アーティスト」をすべて削除
        await client.query('DELETE FROM calculated_artists WHERE user_id = $1', [userId]);

        // 6. 新しい「算出アーティスト」をDBに挿入
        const calcInsertPromises = top5Calculated.map((artist) => {
            return client.query(
                'INSERT INTO calculated_artists (user_id, spotify_artist_id, artist_name, image_url, score) VALUES ($1, $2, $3, $4, $5)',
                [userId, artist.id, artist.name, artist.image, artist.score]
            );
        });
        await Promise.all(calcInsertPromises);

        // // 🔽 artist.score が存在することを確認して使用 🔽
        //     if (artist.score === undefined) {
        //         // 通常はありえないが、念のためエラーハンドリング
        //         console.error('Calculated artist missing score:', artist);
        //         throw new Error('Calculated artist missing score');
        //     }
        //     return client.query(
        //         'INSERT INTO calculated_artists (user_id, spotify_artist_id, artist_name, image_url, score) VALUES ($1, $2, $3, $4, $5)',
        //         [userId, artist.id, artist.name, artist.image, artist.score]
        //     );
        // });
        // await Promise.all(calcInsertPromises);

        await client.query('COMMIT'); // すべて成功したらトランザクションをコミット
        
        // 算出結果をフロントエンドに返す
        res.status(200).json({ 
            message: 'Selected artists saved and calculated successfully.',
            calculatedArtists: top5Calculated // 算出結果を返す
        });

    } catch (dbError) {
        await client.query('ROLLBACK'); // エラー時はロールバック
        console.error('Database transaction failed:', dbError);
        res.status(500).json({ message: 'Failed to save or calculate artists due to database/API error.' });
    } finally {
        client.release();
    }
}

