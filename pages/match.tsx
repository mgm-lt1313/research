import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { SpotifyProfile, SpotifyArtist, getMyProfile, getMyFollowingArtists } from '../lib/spotify';
import Image from 'next/image';

// DBから取得するプロフィール情報のための型定義
interface UserProfile {
  nickname: string;
  profile_image_url: string | null;
  bio: string | null;
}

// 選択されたアーティストの型
interface SelectedArtist {
  id: string;
  name: string;
  image: string | null;
}

// UIのタブ状態
type MatchTab = 'profile' | 'artists';

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

  // 🔽 新しいステート 🔽
  const [selectedArtists, setSelectedArtists] = useState<SelectedArtist[]>([]); // 選択中のアーティスト
  const [activeTab, setActiveTab] = useState<MatchTab>('profile'); // 現在表示中のタブ

  const [isNewUser, setIsNewUser] = useState<boolean>(true); // 新規ユーザーかどうか
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false); // プロフィール編集モードかどうか
  const [isEditingArtists, setIsEditingArtists] = useState<boolean>(false); // アーティスト編集モードかどうか


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

        // 1. 既存プロフィールを確認
        const existingProfileRes = await axios.get<{ profile: UserProfile | null }>(
          `/api/profile/get?spotifyUserId=${profileData.id}`
        );
        
        const existingProfile = existingProfileRes.data.profile;

        if (existingProfile) {
            setNickname(existingProfile.nickname);
            setProfileImageUrl(existingProfile.profile_image_url || '');
            setBio(existingProfile.bio || '');
            setIsNewUser(false); 
        } else {
            setNickname(profileData.display_name || '');
            setProfileImageUrl(profileData.images?.[0]?.url || '');
            setIsNewUser(true); 
            // 🔽 新規ユーザーはプロフィール登録から開始 🔽
            setIsEditingProfile(true);
        }

        // 2. 既存の選択アーティストを取得（省略 - 今回は選択画面から更新）
        // TODO: ここで selected_artists のデータを取得するAPIを呼び出す

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

  // 選択アーティストの追加/削除ハンドラ
  const toggleArtistSelection = (artist: SpotifyArtist) => {
    const isSelected = selectedArtists.some(sa => sa.id === artist.id);
    const artistData: SelectedArtist = {
        id: artist.id,
        name: artist.name,
        image: artist.images?.[0]?.url || null,
    };

    if (isSelected) {
        // 削除
        setSelectedArtists(selectedArtists.filter(sa => sa.id !== artist.id));
    } else {
        // 追加 (3人制限)
        if (selectedArtists.length < 3) {
            setSelectedArtists([...selectedArtists, artistData]);
        } else {
            alert('選択できるアーティストは最大3人までです。');
        }
    }
  };

  // プロフィール登録/更新フォーム送信ハンドラ (既存)
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return setError('Spotifyプロフィールが読み込まれていません。');
    if (!nickname.trim()) return setError('ニックネームは必須です。');

    setLoading(true);
    setError(null);

    try {
      await axios.post('/api/profile/save', {
        spotifyUserId: profile.id,
        nickname,
        profileImageUrl,
        bio,
      });

      alert(isNewUser ? 'プロフィールを登録しました！' : 'プロフィールを更新しました！');
      
      setIsNewUser(false);
      setIsEditingProfile(false);
    } catch (e) {
      void e;
      // ... エラー処理 ...
    } finally {
      setLoading(false);
    }
  };

  // アーティスト選択保存ハンドラ (新規)
  const handleArtistSave = async () => {
    if (!profile) return setError('Spotifyプロフィールが読み込まれていません。');
    if (selectedArtists.length === 0) {
        alert('アーティストを1人以上選択してください。');
        return;
    }

    setLoading(true);
    setError(null);

    try {
        await axios.post('/api/artists/save', {
            spotifyUserId: profile.id,
            selectedArtists: selectedArtists.map(a => ({ id: a.id, name: a.name })), // IDと名前だけ送信
        });

        alert('マッチング用アーティストを保存しました！');
        setIsEditingArtists(false);
    } catch (e) {
        if (axios.isAxiosError(e)) {
            setError(`アーティストの保存中にエラーが発生しました: ${e.response?.status || '不明'}`);
        } else {
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
  
  // ----------------------------------------------------
  // 🔽 UI: プロフィール編集フォーム 🔽
  // ----------------------------------------------------
  const ProfileEditor = () => (
    <div className="p-4 max-w-xl mx-auto bg-gray-800 rounded-lg shadow-md mt-4">
        <h2 className="text-xl font-bold text-white mb-4">
            {isNewUser ? 'プロフィール登録' : 'プロフィール編集'}
        </h2>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
            {/* ... フォーム要素 (nickname, profileImageUrl, bio) はそのまま ... */}
            <div>
                <label htmlFor="nickname" className="block text-white text-sm font-bold mb-2">ニックネーム <span className="text-red-500">*</span></label>
                <input type="text" id="nickname" className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" value={nickname} onChange={(e) => setNickname(e.target.value)} required />
            </div>
            <div>
                <label htmlFor="profileImageUrl" className="block text-white text-sm font-bold mb-2">プロフィール画像URL (任意)</label>
                <input type="url" id="profileImageUrl" className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" value={profileImageUrl} onChange={(e) => setProfileImageUrl(e.target.value)} placeholder="例: http://example.com/your-image.jpg" />
                {profileImageUrl && <Image src={profileImageUrl} alt="Preview" className="mt-2 w-24 h-24 object-cover rounded-full" />}
            </div>
            <div>
                <label htmlFor="bio" className="block text-white text-sm font-bold mb-2">自己紹介文 (任意)</label>
                <textarea id="bio" className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-24 resize-none" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="あなたの好きな音楽のジャンルや、活動していることなど"></textarea>
            </div>
            <div className="flex justify-between">
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline" disabled={loading}>
                    {loading ? '保存中...' : (isNewUser ? 'プロフィールを登録' : '更新を保存')}
                </button>
                {isEditingProfile && (
                    <button type="button" onClick={() => setIsEditingProfile(false)} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline" disabled={loading}>
                        キャンセル
                    </button>
                )}
            </div>
        </form>
    </div>
  );

  // ----------------------------------------------------
  // 🔽 UI: アーティスト選択フォーム 🔽
  // ----------------------------------------------------
  const ArtistSelection = () => (
    <div className="p-4 max-w-2xl mx-auto bg-gray-800 rounded-lg shadow-md mt-4">
        <h2 className="text-xl font-bold text-white mb-4">マッチング用アーティスト選択 ({selectedArtists.length}/3)</h2>
        <p className="text-gray-400 mb-4">あなたのプロフィールを特徴づけるアーティストを3人まで選んでください。</p>
        
        <div className="mb-4 flex flex-wrap gap-2">
            <span className="text-white text-sm font-bold">選択中:</span>
            {selectedArtists.map(artist => (
                <span key={artist.id} className="bg-green-600 text-white text-xs font-semibold px-2 py-1 rounded-full">
                    {artist.name}
                </span>
            ))}
            {selectedArtists.length === 0 && <span className="text-gray-400 text-sm">選択されていません</span>}
        </div>
        
        <button
            onClick={handleArtistSave}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mb-4"
            disabled={loading || selectedArtists.length === 0}
        >
            {loading ? '保存中...' : '選択したアーティストを保存'}
        </button>

        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {artists.map((artist) => (
            <li
              key={artist.id}
              className="bg-gray-700 p-4 rounded-lg shadow-sm flex items-center space-x-3 cursor-pointer"
              onClick={() => toggleArtistSelection(artist)}
            >
              {artist.images?.[0]?.url && (
                <Image
                  src={artist.images[0].url}
                  alt={artist.name}
                  width={40}
                  height={40}
                  className="rounded-full object-cover"
                />
              )}
              <a
                href={artist.external_urls.spotify}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-300 hover:underline font-medium"
              >
                {artist.name}
              </a>
            </li>
          ))}
        </ul>
    </div>
  );

  // ----------------------------------------------------
  // 🔽 メインレンダリング 🔽
  // ----------------------------------------------------

  // プロフィール未登録の場合、登録フォームのみを表示
  if (isNewUser) {
    return (
        <div className="p-4 max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold text-white mb-6 mt-8 text-center">👋 ようこそ！プロフィールを登録してください</h1>
            <ProfileEditor />
        </div>
    );
  }

  // 編集モードの場合、編集画面をタブで表示
  if (isEditingProfile || isEditingArtists) {
    return (
        <div className="p-4 max-w-2xl mx-auto mt-8">
            {/* タブナビゲーション */}
            <div className="flex border-b border-gray-700 mb-4">
                <button
                    onClick={() => { setActiveTab('profile'); setIsEditingProfile(true); setIsEditingArtists(false); }}
                    className={`px-4 py-2 font-medium text-sm ${
                        (activeTab === 'profile' || isEditingProfile)
                            ? 'border-b-2 border-blue-500 text-blue-400'
                            : 'text-gray-400 hover:text-white'
                    }`}
                >
                    プロフィール編集
                </button>
                <button
                    onClick={() => { setActiveTab('artists'); setIsEditingArtists(true); setIsEditingProfile(false); }}
                    className={`px-4 py-2 font-medium text-sm ${
                        (activeTab === 'artists' || isEditingArtists)
                            ? 'border-b-2 border-blue-500 text-blue-400'
                            : 'text-gray-400 hover:text-white'
                    }`}
                >
                    アーティスト選択
                </button>
            </div>

            {/* コンテンツの表示 */}
            {(activeTab === 'profile' || isEditingProfile) && <ProfileEditor />}
            {(activeTab === 'artists' || isEditingArtists) && <ArtistSelection />}
            
            <div className='flex justify-center mt-6'>
                <button
                    onClick={() => { setIsEditingProfile(false); setIsEditingArtists(false); }}
                    className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                    メイン画面に戻る
                </button>
            </div>
        </div>
    );
  }

  // 登録済みで編集モードでない場合、メインコンテンツを表示
  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* プロフィール表示部分 */}
      {profile && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-md mb-6 relative">
          
          {/* 🔽 編集ボタンのグループ化 🔽 */}
          <div className="absolute top-4 right-4 flex space-x-2">
            <button
                onClick={() => { setIsEditingProfile(true); setActiveTab('profile'); }}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded text-sm"
            >
                プロフィール編集
            </button>
            <button
                onClick={() => { setIsEditingArtists(true); setActiveTab('artists'); }}
                className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-1 px-3 rounded text-sm"
            >
                アーティスト選択
            </button>
          </div>
          
          <div className="flex items-center space-x-4 mb-4">
            {(profileImageUrl || profile.images?.[0]?.url) && (
              // eslint-disable-next-line @next/next/no-img-element
              <Image
                src={profileImageUrl || profile.images?.[0]?.url || ''}
                alt={nickname || profile.display_name || 'プロフィール画像'}
                className="w-10 h-10 rounded-full object-cover" // Tailwindクラスを使用
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
            <li
              key={artist.id}
              className="bg-gray-700 p-4 rounded-lg shadow-sm flex items-center space-x-3 cursor-pointer"
              onClick={() => toggleArtistSelection(artist)}
            >
              {artist.images?.[0]?.url && (
                <Image
                  src={artist.images[0].url}
                  alt={artist.name}
                  width={40}
                  height={40}
                  className="rounded-full object-cover"
                />
              )}
              <a
                href={artist.external_urls.spotify}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-300 hover:underline font-medium"
              >
                {artist.name}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-400">フォローしているアーティストがいません。</p>
      )}
    </div>
  );
}