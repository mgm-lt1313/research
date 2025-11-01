// pages/chats.tsx (新規作成)
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';

// 型定義: APIからのレスポンスの型
interface PendingRequest {
  follow_id: number; // followsテーブルのID (bigint)
  user_id: string;   // 相手のuser ID (uuid)
  nickname: string;
  profile_image_url: string | null;
}
interface ApprovedMatch {
  match_id: number; // followsテーブルのID (bigint) - チャットルームID
  other_user: {
    id: string; // 相手のuser ID (uuid)
    nickname: string;
    profile_image_url: string | null;
  };
}

export default function Chats() {
  const router = useRouter();
  // URLクエリ (?spotifyUserId=...) から自分のSpotify IDを取得
  const { spotifyUserId } = router.query as { spotifyUserId?: string };

  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [matches, setMatches] = useState<ApprovedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<number | null>(null); // 承認中ID

  useEffect(() => {
    // spotifyUserId がないとAPIを呼べないのでエラー表示
    if (!spotifyUserId) {
        setError('ユーザー情報がありません。ログインし直すか、前のページから再度アクセスしてください。');
        setLoading(false);
        return;
    }

    const fetchLists = async () => {
      setLoading(true);
      setError(null);
      try {
        // チャット一覧APIを呼び出す
        const res = await axios.get(`/api/follow/list?spotifyUserId=${spotifyUserId}`);
        setPending(res.data.pendingRequests || []);
        setMatches(res.data.approvedMatches || []);
      } catch (e: unknown) {
         console.error("Failed to fetch chat lists:", e);
         let msg = 'リストの取得に失敗しました。';
         if (axios.isAxiosError(e) && e.response?.data?.message) {
             msg += ` ${e.response.data.message}`;
         } else if (e instanceof Error) {
             msg += ` ${e.message}`;
         }
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchLists();
  }, [spotifyUserId]); // spotifyUserIdが変わったら再取得

  // 承認ボタンが押されたときの処理
  const handleAccept = async (followId: number) => {
    if (!spotifyUserId || acceptingId) return; // 既に処理中なら何もしない
    setAcceptingId(followId); // 処理中のIDをセット
    try {
      // 承認APIを呼び出す (ステップ5で作成)
      await axios.post('/api/follow/accept', {
        selfSpotifyId: spotifyUserId,
        followId: followId, // 承認するリクエストのID (bigint)
      });
      // 成功したらリストを再取得（またはローカルで更新）
      // ここでは簡易的にページをリロード
      router.reload();
    } catch (e: unknown) {
      console.error("Failed to accept follow request:", e);
      let msg = '承認に失敗しました。';
       if (axios.isAxiosError(e) && e.response?.data?.message) {
           msg += ` ${e.response.data.message}`;
       } else if (e instanceof Error) {
           msg += ` ${e.message}`;
       }
      alert(msg);
      setAcceptingId(null); // エラー時は処理中状態を解除
    }
    // finally は不要 (成功時はリロードするため)
  };

  if (loading) return <div className="text-white p-4">読み込み中...</div>;
  if (error) return <div className="text-red-500 p-4">{error}</div>;

  return (
    <div className="p-4 max-w-lg mx-auto text-white">
      <h1 className="text-3xl font-bold mb-6">チャット</h1>

      {/* --- 承認待ちリスト --- */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">承認待ちのリクエスト</h2>
        {pending.length > 0 ? (
          <ul className="space-y-3">
            {pending.map(req => (
              <li key={req.follow_id} className="bg-gray-700 p-3 rounded-lg flex justify-between items-center shadow">
                <div className="flex items-center space-x-3 overflow-hidden mr-2">
                  {req.profile_image_url ? (
                    <Image src={req.profile_image_url} alt={req.nickname} width={40} height={40} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  ): (
                    <div className="w-10 h-10 rounded-full bg-gray-600 flex-shrink-0"></div>
                  )}
                  <span className="font-medium truncate">{req.nickname}</span>
                </div>
                <button
                  onClick={() => handleAccept(req.follow_id)}
                  disabled={acceptingId === req.follow_id} // 処理中は無効化
                  className={`px-3 py-1 rounded text-sm font-semibold flex-shrink-0 ${
                    acceptingId === req.follow_id
                     ? 'bg-gray-500 cursor-wait'
                     : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {acceptingId === req.follow_id ? '承認中...' : '承認する'}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400 text-sm">承認待ちのリクエストはありません。</p>
        )}
      </section>

      {/* --- マッチ一覧 (チャットルームへのリンク) --- */}
      <section>
        <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">マッチ一覧</h2>
        {matches.length > 0 ? (
          <ul className="space-y-3">
            {matches.map(match => (
              <li key={match.match_id}>
                    {/* 🔽 href に otherNickname と otherImageUrl を追加 🔽 */}
                    <Link
                      href={`/chat/${match.match_id}?selfSpotifyId=${spotifyUserId}&otherUserId=${match.other_user.id}&otherNickname=${encodeURIComponent(match.other_user.nickname)}&otherImageUrl=${encodeURIComponent(match.other_user.profile_image_url || '')}`}
                      className="block bg-gray-800 p-4 rounded-lg flex items-center space-x-4 hover:bg-gray-700 transition-colors duration-150 shadow">

                  {match.other_user.profile_image_url ? (
                    <Image src={match.other_user.profile_image_url} alt={match.other_user.nickname} width={48} height={48} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                  ) : (
                     <div className="w-12 h-12 rounded-full bg-gray-600 flex-shrink-0"></div>
                  )}
                  <div className="overflow-hidden">
                    <h3 className="font-bold text-lg truncate">{match.other_user.nickname}</h3>
                    {/* 将来的に最新メッセージを表示 */}
                    <p className="text-gray-300 text-sm truncate">(チャットを開始する)</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400 text-sm">成立したマッチングはありません。</p>
        )}
      </section>
    </div>
  );
}