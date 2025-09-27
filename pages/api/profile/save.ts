import type { NextApiRequest, NextApiResponse } from 'next';
// 修正後の正しいパス
import pool from '../../../lib/db'; // lib/db.ts からデータベース接続をインポート // lib/db.ts からデータベース接続をインポート

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    // POSTリクエスト以外は許可しない
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // リクエストボディから必要な情報を取得
  const { spotifyUserId, nickname, profileImageUrl, bio } = req.body;

  // 必須項目（ここではnicknameとspotifyUserId）のチェック
  if (!spotifyUserId || !nickname) {
    return res.status(400).json({ message: 'Missing required fields: spotifyUserId and nickname' });
  }

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN'); // トランザクション開始

      // ユーザーが存在するか確認（spotify_user_idで）
      const userCheck = await client.query(
        'SELECT id FROM users WHERE spotify_user_id = $1',
        [spotifyUserId]
      );

      let userId;
      if (userCheck.rows.length > 0) {
        // ユーザーが既に存在する場合は更新
        userId = userCheck.rows[0].id;
        await client.query(
          'UPDATE users SET nickname = $1, profile_image_url = $2, bio = $3, updated_at = CURRENT_TIMESTAMP WHERE spotify_user_id = $4',
          [nickname, profileImageUrl || null, bio || null, spotifyUserId]
        );
        console.log(`User ${nickname} (ID: ${spotifyUserId}) updated in DB.`);
      } else {
        // ユーザーが存在しない場合は新規挿入
        const insertResult = await client.query(
          'INSERT INTO users (spotify_user_id, nickname, profile_image_url, bio) VALUES ($1, $2, $3, $4) RETURNING id',
          [spotifyUserId, nickname, profileImageUrl || null, bio || null]
        );
        userId = insertResult.rows[0].id;
        console.log(`New user ${nickname} (ID: ${spotifyUserId}) inserted into DB.`);
      }

      await client.query('COMMIT'); // トランザクションコミット
      res.status(200).json({ message: 'Profile saved successfully!', userId: userId });

    } catch (dbError) {
      await client.query('ROLLBACK'); // エラー時はロールバック
      console.error('Database transaction failed:', dbError);
      res.status(500).json({ message: 'Failed to save profile due to database error.' });
    } finally {
      client.release(); // クライアントをプールに戻す
    }
  } catch (poolError) {
    console.error('Failed to connect to database pool:', poolError);
    res.status(500).json({ message: 'Failed to connect to database.' });
  }
}