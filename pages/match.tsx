import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { SpotifyProfile, SpotifyArtist, getMyProfile, getMyFollowingArtists } from '../lib/spotify';

// DBから取得するプロフィール情報のための型定義
interface UserProfile {
  nickname: string;
  profile_image_url: string | null;
  bio: string | null;
}

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

  // 🔽 状態管理をより詳細に変更 🔽
  const [isNewUser, setIsNewUser] = useState<boolean>(true); // 新規ユーザーかどうか
  const [isEditing, setIsEditing] = useState<boolean>(false); // 編集モードかどうか

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

        // 1. 既存プロフィールを確認するAPIを呼び出す
        const existingProfileRes = await axios.get<{}, { data: { profile: UserProfile | null } }>(
          `/api/profile/get?spotifyUserId=${profileData.id}`
        );

        const existingProfile = existingProfileRes.data.profile;

        if (existingProfile) {
            // 2. 登録済みの場合: データをStateにロードし、新規ユーザーではないと設定
            setNickname(existingProfile.nickname);
            setProfileImageUrl(existingProfile.profile_image_url || '');
            setBio(existingProfile.bio || '');
            setIsNewUser(false); 
        } else {
            // 3. 未登録の場合: Spotifyの情報を初期値に設定し、新規ユーザーと設定
            setNickname(profileData.display_name || '');
            setProfileImageUrl(profileData.images?.[0]?.url || '');
            setIsNewUser(true); 
        }

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

  // プロフィール登録/更新フォーム送信ハンドラ
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
      // 既存の save API は新規登録と更新の両方を処理します
      const response = await axios.post('/api/profile/save', {
        spotifyUserId: profile.id,
        nickname,
        profileImageUrl,
        bio,
      });

      if (response.status === 200) {
        alert(isNewUser ? 'プロフィールを登録しました！' : 'プロフィールを更新しました！');
        
        // 登録が完了したら、状態を更新してメイン画面に戻す
        setIsNewUser(false);
        setIsEditing(false);
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

  // 🔽 新規ユーザーまたは編集モードの場合にフォームを表示 🔽
  if (isNewUser || isEditing) {
    return (
      <div className="p-4 max-w-xl mx-auto bg-gray-800 rounded-lg shadow-md mt-8">
        <h1 className="text-2xl font-bold text-white mb-4">
          {isNewUser ? 'プロフィールを登録しましょう！' : 'プロフィールを編集'}
        </h1>
        <p className="text-gray-400 mb-6">マッチング機能を利用するために、プロフィールを編集・登録します。</p>
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
          <div className="flex justify-between">
            <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                disabled={loading}
            >
                {loading ? '保存中...' : (isNewUser ? 'プロフィールを登録' : '更新を保存')}
            </button>
            {isEditing && (
                <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                    disabled={loading}
                >
                    キャンセル
                </button>
            )}
          </div>
        </form>
      </div>
    );
  }

  // 🔽 プロフィール登録済みの場合、メインコンテンツを表示 🔽
  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* プロフィール表示部分 */}
      {profile && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-md mb-6 relative">
          
          {/* 🔽 編集ボタンを追加 🔽 */}
          <button
            onClick={() => setIsEditing(true)}
            className="absolute top-4 right-4 bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded text-sm focus:outline-none focus:shadow-outline"
          >
            プロフィールを編集
          </button>
          
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
                  className="w-8 h-8 rounded-full object-cover" // 🔽 修正済み 🔽
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