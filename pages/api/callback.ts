// pages/api/callback.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

// 🔽 修正1: Spotifyの認証サーバーのトークンURLに修正 🔽
const TOKEN_URL = 'https://accounts.spotify.com/api/token'; 

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const code = req.query.code || null;
  const state = req.query.state || null;
  // ... (state チェックはそのまま) ...

  // 🔽 修正2: フォームデータをURLSearchParamsで作成 🔽
  const data = new URLSearchParams({
    code: code as string,
    redirect_uri: process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI || '',
    grant_type: 'authorization_code',
  }).toString();

  // 🔽 修正3: Base64エンコードされた Authorization ヘッダーを生成 🔽
  const authHeader = 'Basic ' + Buffer.from(
    (process.env.SPOTIFY_CLIENT_ID || '') + ':' + (process.env.SPOTIFY_CLIENT_SECRET || '')
  ).toString('base64');
  
  const headers = {
    'Authorization': authHeader,
    'Content-Type': 'application/x-www-form-urlencoded', 
  };

  try {
    // 🔽 修正4: axios.postでデータとヘッダーを送信 🔽
    const response = await axios.post(TOKEN_URL, data, { headers }); 
    
    const { access_token, refresh_token } = response.data;

    // ... (リダイレクトロジックはそのまま) ...
  } catch (error) {
    // ... (エラー処理はそのまま) ...
  }
}