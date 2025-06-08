// pages/match.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { SpotifyProfile, SpotifyArtist, getMyProfile, getMyFollowingArtists } from '../lib/spotify';

export default function Match() {
  const router = useRouter();
  const { access_token } = router.query as { access_token?: string };

  const [profile, setProfile] = useState<SpotifyProfile | null>(null);
  const [artists, setArtists] = useState<SpotifyArtist[]>([]);
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
      setLoading(true);
      setError(null);
      try {
        const profileData = await getMyProfile(access_token);
        setProfile(profileData);

        const artistsData = await getMyFollowingArtists(access_token);
        setArtists(artistsData);
      } catch (e) {
        if (axios.isAxiosError(e)) {
          console.error('API Error:', e.response?.status, e.response?.data);
          setError(`APIエラーが発生しました: ${e.response?.status || '不明'}`);
        } else {
          console.error('予期せぬエラー:', e);
          setError('予期せぬエラーが発生しました。');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [access_token, router.query, loading]); // ★ 修正: loading を依存配列に追加

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
    </div>
  );
}