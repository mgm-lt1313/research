// pages/match.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios'; // axiosも必要なのでimport
import { SpotifyProfile, SpotifyArtist, getMyProfile, getMyFollowingArtists, getRelatedArtists } from '../lib/spotify';

export default function Match() {
  const router = useRouter();
  const { access_token } = router.query as { access_token?: string };

  const [profile, setProfile] = useState<SpotifyProfile | null>(null);
  const [artists, setArtists] = useState<SpotifyArtist[]>([]);
  const [relatedArtists, setRelatedArtists] = useState<SpotifyArtist[]>([]); // 新しく追加
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!access_token) {
      setLoading(false);
      if (router.query.error) {
        setError(`エラー: ${router.query.error}`);
      }
      return;
    }

    const fetchData = async () => {
      setLoading(true); // APIリクエスト開始前に loading を true にセット
      setError(null);
      try {
        const profileData = await getMyProfile(access_token);
        setProfile(profileData);

        const artistsData = await getMyFollowingArtists(access_token);
        setArtists(artistsData);

        // ★ ここから関連アーティスト取得ロジックを追加
        const relatedArtistsPromises: Promise<SpotifyArtist[]>[] = [];
        // フォローアーティストの中から、最初の3名の関連アーティストを取得する例
        // artistsDataが空の可能性があるため、チェックを追加
        const artistsToFetchRelated = artistsData.slice(0, Math.min(artistsData.length, 3)); 

        for (const artist of artistsToFetchRelated) {
            relatedArtistsPromises.push(getRelatedArtists(artist.id, access_token));
        }

        // 全ての関連アーティスト取得API呼び出しを並行して実行
        const allRelatedArtistsArrays = await Promise.all(relatedArtistsPromises);
        
        // 取得した関連アーティストのリストを平坦化し、重複を排除
        const uniqueRelatedArtists = Array.from(new Set(allRelatedArtistsArrays.flat().map(artist => artist.id)))
                                      .map(id => allRelatedArtistsArrays.flat().find(artist => artist.id === id)!);
        setRelatedArtists(uniqueRelatedArtists);

      } catch (e) {
        if (axios.isAxiosError(e)) {
          console.error('API Error:', e.response?.status, e.response?.data);
          setError(`APIエラーが発生しました: ${e.response?.status || '不明'}`);
        } else {
          console.error('予期せぬエラー:', e);
          setError('予期せぬエラーが発生しました。');
        }
      } finally {
        setLoading(false); // APIリクエスト終了後に loading を false にセット
      }
    };

    fetchData();
  }, [access_token, router.query]); // 依存配列から loading を削除

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">データをロード中...</div>;
  }

  if (error) {
    return <div className="flex justify-center items-center min-h-screen text-red-500">{error}</div>;
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {profile && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-md mb-6">
          <div className="flex items-center space-x-4 mb-4">
            {profile.images?.[0]?.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.images[0].url}
                alt={profile.display_name}
                className="w-20 h-20 rounded-full object-cover"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold text-white">こんにちは、{profile.display_name} さん！</h1>
              <p className="text-gray-400">Spotify ID: {profile.id}</p>
              <a
                href={profile.external_urls.spotify}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 hover:underline text-sm"
              >
                Spotifyで開く
              </a>
            </div>
          </div>
        </div>
      )}
      <h2 className="text-xl font-bold mt-4 text-white mb-4">フォロー中のアーティスト</h2>
      {artists.length > 0 ? (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {artists.map((artist) => (
            <li key={artist.id} className="bg-gray-700 p-4 rounded-lg shadow-sm flex items-center space-x-3">
              {artist.images?.[0]?.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={artist.images[0].url}
                  alt={artist.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              )}
              <div>
                <a
                  href={artist.external_urls.spotify}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-300 hover:underline font-medium"
                >
                  {artist.name}
                </a>
                {artist.genres && artist.genres.length > 0 && (
                  <p className="text-gray-400 text-sm">{artist.genres.join(', ')}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-400">フォローしているアーティストがいません。</p>
      )}

      {/* 関連アーティストの表示セクション */}
      <h2 className="text-xl font-bold mt-8 text-white mb-4">関連アーティスト（フォロー中から抜粋）</h2>
      {relatedArtists.length > 0 ? (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {relatedArtists.map((artist) => (
            <li key={artist.id} className="bg-gray-700 p-4 rounded-lg shadow-sm flex items-center space-x-3">
              {artist.images?.[0]?.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={artist.images[0].url}
                  alt={artist.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              )}
              <div>
                <a
                  href={artist.external_urls.spotify}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-300 hover:underline font-medium"
                >
                  {artist.name}
                </a>
                {artist.genres && artist.genres.length > 0 && (
                  <p className="text-gray-400 text-sm">{artist.genres.join(', ')}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-400">関連アーティストが見つかりませんでした。</p>
      )}
    </div>
  );
}