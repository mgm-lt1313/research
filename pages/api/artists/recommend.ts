import type { NextApiRequest, NextApiResponse } from 'next';
import Graph from 'graphology';
import { pagerank } from 'graphology-metrics/centrality'; // PageRankをインポート
import { getRelatedArtists } from '../../../lib/spotify'; // 関連アーティスト取得関数をインポート
import pool from '../../../lib/db';
import { PoolClient } from 'pg'; // データベースクライアントの型をインポート


// ----------------------------------------------------
// DBヘルパー関数
// ----------------------------------------------------

// データベースからユーザーの内部IDを取得
async function getUserIdBySpotifyId(client: PoolClient, spotifyUserId: string): Promise<number | null> {
    const res = await client.query('SELECT id FROM users WHERE spotify_user_id = $1', [spotifyUserId]);
    return res.rows.length > 0 ? res.rows[0].id : null;
}

// ----------------------------------------------------
// メインAPIハンドラ
// ----------------------------------------------------

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { accessToken, selectedArtistIds, spotifyUserId } = req.body; // シードアーティストIDの配列を受け取る

    if (!accessToken || !Array.isArray(selectedArtistIds) || selectedArtistIds.length === 0 || !spotifyUserId) {
        return res.status(400).json({ message: 'Missing required parameters: accessToken, selectedArtistIds, or spotifyUserId' });
    }
    
    // PageRankの計算結果の型定義
    interface PageRankResult {
        id: string;
        name: string;
        rank: number;
    }

    try {
        const graph = new Graph();
        // 🔽 修正1: デバッグログの追加 🔽
        console.log(`[DEBUG] Received ${selectedArtistIds.length} seed artists. First ID: ${selectedArtistIds[0]}`);

        // 1. ネットワーク構築 (BFSのような処理)
        const seedArtistIds = new Set(selectedArtistIds);
        const queue = [...selectedArtistIds];

        // シードアーティストをノードに追加
        for (const artistId of selectedArtistIds) {
            if (!graph.hasNode(artistId)) {
                // Spotify APIを叩いて名前と画像を取得 (今回は簡略化のためAPIコールを省略し、シードアーティストが既に情報を保持していると仮定)
                // 実際にはAPIで情報を取得する必要があるが、一旦ここでは簡略化。
                graph.addNode(artistId, { type: 'seed', name: artistId }); 
            }
        }

        for (const artistId of queue) {
            // 🔽 修正2: APIコール直前にデバッグログを追加 🔽
            console.log(`[DEBUG] Calling related artists API for ID: ${artistId}`);
            
            // 既に PageRank計算のために名前と画像は取得済みなので、ここではartistIdだけを使って関連アーティストを取得
            const relatedArtists = await getRelatedArtists(accessToken, artistId);

            if (!graph.hasNode(artistId)) continue; // ノードが存在しない場合はスキップ

            // 関連アーティストをノードとエッジに追加
            for (const related of relatedArtists) {
                if (!graph.hasNode(related.id)) {
                    // 関連アーティストをノードとして追加
                    graph.addNode(related.id, { 
                        type: 'related', 
                        name: related.name, 
                        image: related.images?.[0]?.url || null 
                    });
                }
                
                // 元のアーティスト -> 関連アーティスト のエッジを追加
                if (!graph.hasEdge(artistId, related.id)) {
                    graph.addEdge(artistId, related.id, { weight: 1 }); // 重み付けは一旦1
                    
                }
            }
        }

        // 2. PageRankの計算
        const ranks = pagerank(graph, {
            // dampingFactor: 0.85, // 一般的な PageRankの減衰率
            //normalized: true, // 正規化
            getEdgeWeight: 'weight',
        });

        // 3. 結果の抽出と整形
        const rankedResults: PageRankResult[] = [];
        
        graph.forEachNode((nodeId, attributes) => {
            // シードアーティスト自体を推薦結果から除外する
            if (!seedArtistIds.has(nodeId)) { 
                rankedResults.push({
                    id: nodeId,
                    name: attributes.name || 'Unknown',
                    rank: ranks[nodeId] || 0,
                });
            }
        });

        // PageRankスコアで降順ソート
        rankedResults.sort((a, b) => b.rank - a.rank);

        // 上位5件のみを抽出
        const top5 = rankedResults.slice(0, 5);

        // 4. 推薦結果をDBに保存
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const userId = await getUserIdBySpotifyId(client, spotifyUserId);
            
            if (userId) {
                // 既存の推薦アーティストを削除（もしあれば）
                await client.query('DELETE FROM recommended_artists WHERE user_id = $1', [userId]);

                // 新しい推薦アーティストを挿入
                const insertPromises = top5.map(artist => {
                    return client.query(
                        'INSERT INTO recommended_artists (user_id, spotify_artist_id, artist_name, pagerank_score) VALUES ($1, $2, $3, $4)',
                        [userId, artist.id, artist.name, artist.rank]
                    );
                });
                await Promise.all(insertPromises);
            }
            
            await client.query('COMMIT');
        } catch (dbError) {
            await client.query('ROLLBACK');
            console.error('Database save failed:', dbError);
        } finally {
            client.release();
        }


        res.status(200).json({ 
            message: 'Recommendations generated and saved.', 
            top5: top5.map(a => ({ id: a.id, name: a.name })),
            graphSize: { nodes: graph.size, edges: graph.order }
        });

    } catch (apiError) {
        console.error('API Error during network construction:', apiError);
        res.status(500).json({ message: 'Failed to generate recommendations due to API/Graph error.' });
    }
}