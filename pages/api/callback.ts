// pages/api/callback.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

// Spotifyの認証サーバーの正しいURLに修正
const TOKEN_URL = 'https://accounts.spotify.com/api/token'; 

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const code = req.query.code || null;
  const state = req.query.state || null;

  // stateが不正な場合（CSRF対策）
  if (state === null /* || state !== storedState */) {
    res.redirect('/#' + new URLSearchParams({ error: 'state_mismatch' }).toString());
    return;
  }

  // 🔽 【修正点1: フォームデータをURLSearchParamsで作成】 🔽
  const data = new URLSearchParams({
    code: code as string,
    redirect_uri: process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI || '',
    grant_type: 'authorization_code',
  }).toString();

  // ヘッダー情報
  const headers = {
    // Base64エンコードされたクライアントIDとクライアントシークレット
    'Authorization': 'Basic ' + Buffer.from(
      (process.env.SPOTIFY_CLIENT_ID || '') + ':' + (process.env.SPOTIFY_CLIENT_SECRET || '')
    ).toString('base64'),
    // Content-Type は URLSearchParamsを使うことで自動で正しい形式になる
    'Content-Type': 'application/x-www-form-urlencoded', 
  };

  try {
    // 🔽 【修正点2: axios.postでデータとヘッダーを送信】 🔽
    const response = await axios.post(TOKEN_URL, data, { headers }); 
    
    const { access_token, refresh_token } = response.data;

    // 取得したトークンを /match ページにクエリパラメータとして渡してリダイレクト
    res.redirect(`/match?access_token=${access_token}&refresh_token=${refresh_token}`);
  } catch (error) {
    console.error('Error getting tokens:', error);
    // エラー時はトップページにリダイレクトし、エラー情報を渡す
    res.redirect('/#' + new URLSearchParams({ error: 'token_acquisition_failed' }).toString());
  }
}