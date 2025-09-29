// pages/api/login.ts
import type { NextApiRequest, NextApiResponse } from 'next';

// 認証時に使用するスコープ（権限）
// user-read-private: ユーザーのプライベートな情報（メールアドレスなど）
// user-read-email: ユーザーのメールアドレス
// user-follow-read: ユーザーがフォローしているアーティストやユーザーを読み取る
//const scope = 'user-read-private user-read-email user-follow-read';

// CSRF対策のためのランダムな文字列を生成
function generateRandomString(length: number) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const state = generateRandomString(16);

  // Spotifyの認証ページURL (以前修正済み)
  const authUrl = 'https://accounts.spotify.com/authorize?$'; 
  
  const scope = 'user-read-private user-read-email user-follow-read user-top-read';

  // 🔽 【修正点】URLSearchParamsのオブジェクトの組み立てをシンプル化 🔽
  const queryParams = new URLSearchParams({
    // response_typeが最重要。念のためクエリとして正しく記述
    response_type: 'code', 
    client_id: process.env.SPOTIFY_CLIENT_ID || '',
    scope: scope,
    redirect_uri: process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI || '',
    state: state,
  }).toString();

  // Spotifyの認証ページにリダイレクト
  // 🔽 URLが正しく組み立てられていることを確認 🔽
  res.redirect(`${authUrl}?${queryParams}`);
}