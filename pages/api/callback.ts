// pages/api/callback.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const code = req.query.code || null;
  const state = req.query.state || null;
  // const storedState = req.cookies ? req.cookies[STATE_KEY] : null; // CSRF対策用のstateチェックがあればここで行う

  // stateが不正な場合（CSRF対策）
  if (state === null /* || state !== storedState */) { // storedStateと照合する場合はコメントアウトを外す
    res.redirect('/#' + new URLSearchParams({ error: 'state_mismatch' }).toString());
    return;
  }

  // Spotify APIのトークンエンドポイント
  const tokenUrl = 'https://accounts.spotify.com/api/token'; 

  // トークン取得のためのリクエストオプション
  const authOptions = {
    url: tokenUrl,
    method: 'post' as const, // 'post' を const アサーションすることで型推論を正確にする
    params: {
      code: code,
      redirect_uri: process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI || '',
      grant_type: 'authorization_code',
    },
    headers: {
      // Base64エンコードされたクライアントIDとクライアントシークレット
      'Authorization': 'Basic ' + Buffer.from(
        process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
      ).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };

  try {
    const response = await axios(authOptions); // axios関数でurlとmethodを渡す
    const { access_token, refresh_token } = response.data;

    // 取得したトークンを /match ページにクエリパラメータとして渡してリダイレクト
    // 本来はHTTP Only Cookieなどで安全に渡すべきですが、簡便のためクエリパラメータで
    res.redirect(`/match?access_token=${access_token}&refresh_token=${refresh_token}`);
  } catch (error) {
    console.error('Error getting tokens:', error);
    // エラー時はトップページにリダイレクトし、エラー情報を渡す
    res.redirect('/#' + new URLSearchParams({ error: 'token_acquisition_failed' }).toString());
  }
}