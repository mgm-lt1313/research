import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

// Spotify APIのプロフィール情報の型定義
interface SpotifyProfile {
  display_name: string;
  id: string;
  // 他にも様々なプロパティがありますが、ここでは使用するものに絞っています
  // 必要に応じて追加してください
}

// Spotify APIのアーティスト情報の型定義
interface SpotifyArtist {
  id: string;
  name: string;
  // genre, imagesなどもここに追加できます
}

export default function Match() {
  const router = useRouter();
  // router.queryから取得する access_token は string | string[] の可能性があるため、string型に限定
  const { access_token } = router.query as { access_token?: string };

  // profile と artists に定義した型を適用
  const [profile, setProfile] = useState<SpotifyProfile | null>(null);
  const [artists, setArtists] = useState<SpotifyArtist[]>([]);

  useEffect(() => {
    if (!access_token) return;

    const fetchData = async () => {
      try {
        // プロフィール情報の取得
        const profileRes = await axios.get<SpotifyProfile>(
          'https://api.spotify.com/v1/me', // Spotify APIの正しいエンドポイント
          {
            headers: { Authorization: `Bearer ${access_token}` },
          }
        );
        setProfile(profileRes.data);

        // フォロー中のアーティスト情報の取得
        const followRes = await axios.get<{ artists: { items: SpotifyArtist[] } }>(
          'https://api.spotify.com/v1/me/following?type=artist', // Spotify APIの正しいエンドポイント
          {
            headers: { Authorization: `Bearer ${access_token}` },
          }
        );
        setArtists(followRes.data.artists.items);
      } catch (e) {
        // エラーハンドリングを強化 (例: HTTPステータスコードによるメッセージ分岐など)
        if (axios.isAxiosError(e)) {
          console.error('API Error:', e.response?.status, e.response?.data);
        } else {
          console.error('An unexpected error occurred:', e);
        }
      }
    };

    fetchData();
  }, [access_token]);

  return (
    <div className="p-4">
      {profile && (
        <div>
          <h1 className="text-2xl font-bold mb-2">こんにちは、{profile.display_name} さん！</h1>
          <p>Spotify ID: {profile.id}</p>
        </div>
      )}
      <h2 className="text-xl font-bold mt-4">フォロー中のアーティスト</h2>
      {artists.length > 0 ? (
        <ul className="list-disc pl-6">
          {artists.map((artist) => (
            <li key={artist.id}>{artist.name}</li>
          ))}
        </ul>
      ) : (
        <p>フォローしているアーティストがいません。</p>
      )}
    </div>
  );
}