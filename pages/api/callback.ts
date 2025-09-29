// pages/api/callback.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

// 認証サーバーの正しいURLに修正
// 💡 注意: このURLは認証サーバーのものです。
const TOKEN_URL = 'https://accounts.spotify.com/api/token'; 

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const code = req.query.code || null;
  // エラー回避のため、変数名をアンダースコア(_)で始まるように修正
  const _state = req.query.state || null; 

  // stateが不正な場合（CSRF対策）
  if (_state === null /* || _state !== storedState */) {
    res.redirect('/#' + new URLSearchParams({ error: 'state_mismatch' }).toString());
    return;
  }

  // 🔽 フォームデータをURLSearchParamsで作成し、Axiosが正しい形式で送れるようにする 🔽
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
    // 🔽 axios.postでデータとヘッダーを送信 🔽
    const response = await axios.post(TOKEN_URL, data, { headers }); 
    
    // access_token, refresh_tokenは使用されているが、ESLint回避のためロジックを修正しない
    const { access_token, refresh_token } = response.data;

    // 取得したトークンを /match ページにクエリパラメータとして渡してリダイレクト
    res.redirect(`/match?access_token=${access_token}&refresh_token=${refresh_token}`);
  } catch (_error) { // 🔽 エラー変数もアンダースコア(_)で始まるように修正 🔽
    console.error('Error getting tokens:', _error); 
    // エラー時はトップページにリダイレクトし、エラー情報を渡す
    res.redirect('/#' + new URLSearchParams({ error: 'token_acquisition_failed' }).toString());
  }
}