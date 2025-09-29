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

  // プロフィール登録用ステート
  const [nickname, setNickname] = useState<string>('');
  const [profileImageUrl, setProfileImageUrl] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [profileRegistered, setProfileRegistered] = useState<boolean>(false);

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
        
        // フォローアーティストはDB保存にも使うので取得
        const artistsData = await getMyFollowingArtists(access_token);
        setArtists(artistsData);

        // プロフィール登録済みか確認するAPIエンドポイントを呼び出す（まだ実装していませんが、後で必要になります）
        // const existingProfileRes = await axios.get(`/api/profile/get?spotifyUserId=${profileData.id}`);
        // if (existingProfileRes.data.profile) {
        //     const existingProfile = existingProfileRes.data.profile;
        //     setNickname(existingProfile.nickname);
        //     setProfileImageUrl(existingProfile.profile_image_url || '');
        //     setBio(existingProfile.bio || '');
        //     setProfileRegistered(true);
        // } else {
            // Spotifyの表示名を初期値に設定
            setNickname(profileData.display_name || '');
            // Spotifyのプロフィール画像を初期値に設定
            setProfileImageUrl(profileData.images?.[0]?.url || '');
            setProfileRegistered(false);
        // }

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
  }, [access_token, router.query]);

  // プロフィール登録フォーム送信ハンドラ
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
        setError('Spotifyプロフィールが読み込まれていません。');
        return;
    }
    if (!nickname.trim()) {
        setError('ニックネームは必須です。');
        return;
    }

    setLoading(true);
    setError(null);

    try {
      // プロフィールをDBに保存するAPIエンドポイントにPOSTリクエストを送る
      const response = await axios.post('/api/profile/save', {
        spotifyUserId: profile.id,
        nickname,
        profileImageUrl,
        bio,
      });

      if (response.status === 200) {
        alert('プロフィールを登録しました！');
        setProfileRegistered(true);
      } else {
        setError('プロフィールの保存に失敗しました。');
      }
    } catch (e) {
      if (axios.isAxiosError(e)) {
        console.error('Profile Save API Error:', e.response?.status, e.response?.data);
        setError(`プロフィールの保存中にエラーが発生しました: ${e.response?.status || '不明'}`);
      } else {
        console.error('予期せぬエラー:', e);
        setError('予期せぬエラーが発生しました。');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">データをロード中...</div>;
  }

  if (error) {
    return <div className="flex justify-center items-center min-h-screen text-red-500">{error}</div>;
  }

  // プロフィール登録がまだの場合
  if (!profileRegistered && profile) {
    return (
      <div className="p-4 max-w-xl mx-auto bg-gray-800 rounded-lg shadow-md mt-8">
        <h1 className="text-2xl font-bold text-white mb-4">プロフィールを登録しましょう！</h1>
        <p className="text-gray-400 mb-6">マッチング機能を利用するために、簡単なプロフィール登録をお願いします。</p>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <label htmlFor="nickname" className="block text-white text-sm font-bold mb-2">
              ニックネーム <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="nickname"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="profileImageUrl" className="block text-white text-sm font-bold mb-2">
              プロフィール画像URL (任意)
            </label>
            <input
              type="url"
              id="profileImageUrl"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={profileImageUrl}
              onChange={(e) => setProfileImageUrl(e.target.value)}
              placeholder="例: http://example.com/your-image.jpg"
            />
             {profileImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profileImageUrl} alt="Preview" className="mt-2 w-24 h-24 object-cover rounded-full" />
            )}
            <p className="text-gray-500 text-xs mt-1">Spotifyのプロフィール画像を初期値としています。</p>
          </div>
          <div>
            <label htmlFor="bio" className="block text-white text-sm font-bold mb-2">
              自己紹介文 (任意)
            </label>
            <textarea
              id="bio"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-24 resize-none"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="あなたの好きな音楽のジャンルや、活動していることなど"
            ></textarea>
          </div>
          <button
            type="submit"
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            disabled={loading}
          >
            {loading ? '登録中...' : 'プロフィールを登録'}
          </button>
        </form>
      </div>
    );
  }

  // プロフィール登録済みの場合、メインコンテンツを表示
  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* 既存のプロフィール表示部分 */}
      {profile && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-md mb-6">
          <div className="flex items-center space-x-4 mb-4">
            {(profileImageUrl || profile.images?.[0]?.url) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profileImageUrl || profile.images[0].url}
                alt={nickname || profile.display_name}
                className="w-20 h-20 rounded-full object-cover"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold text-white">こんにちは、{nickname || profile.display_name} さん！</h1>
              <p className="text-gray-400">Spotify ID: {profile.id}</p>
              {bio && <p className="text-gray-300 mt-2">{bio}</p>}
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
                  className="w-6 h-6 rounded-full object-cover"
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