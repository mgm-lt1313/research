// pages/chat/[match_id].tsx (新規作成)
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef, FormEvent } from 'react';
import axios from 'axios';
import Image from 'next/image';

// メッセージの型
interface Message {
    id: number;
    created_at: string;
    sender_id: string; // uuid
    content: string;
    // 必要に応じて送信者のニックネームなどを追加
}

// 相手のユーザー情報の型 (仮)
interface OtherUser {
    id: string;
    nickname: string;
    profile_image_url: string | null;
}

export default function ChatRoom() {
    const router = useRouter();
    // URLから match_id (チャットルームID), selfSpotifyId, otherUserId を取得
    const { match_id, selfSpotifyId, otherUserId } = router.query as {
        match_id?: string;
        selfSpotifyId?: string; // 自分のSpotify ID
        otherUserId?: string;   // 相手の users.id (uuid)
    };

    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [otherUserInfo, setOtherUserInfo] = useState<OtherUser | null>(null); // 相手情報

    // メッセージリストの末尾にスクロールするための参照
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // --- 相手のプロフィール情報を取得 ---
    useEffect(() => {
        if (!otherUserId) return;
        const fetchOtherUserInfo = async () => {
             try {
                // profile/get APIを流用 (相手のSpotify IDではなく、内部IDで検索するAPIがあればより良い)
                // ここでは仮実装として、内部IDからSpotify IDを逆引きするAPIを想定
                // もしくは、chats.tsxからプロフィール情報を渡す方法もある
                 const profileRes = await axios.get(`/api/profile/get?internalUserId=${otherUserId}`); // 仮のAPIエンドポイント
                 if (profileRes.data.profile) {
                     setOtherUserInfo({
                         id: otherUserId, // ここは internalId (uuid)
                         nickname: profileRes.data.profile.nickname,
                         profile_image_url: profileRes.data.profile.profile_image_url
                     });
                 } else {
                     // 簡易的にIDを表示
                     setOtherUserInfo({ id: otherUserId, nickname: `ユーザー(${otherUserId.substring(0, 6)}...)`, profile_image_url: null });
                 }
             } catch (err) {
                 console.error("Failed to fetch other user info:", err);
                 // 取得できなくてもチャットはできるように簡易表示
                 setOtherUserInfo({ id: otherUserId, nickname: `ユーザー(${otherUserId.substring(0, 6)}...)`, profile_image_url: null });
             }
        };
        fetchOtherUserInfo();
    }, [otherUserId]);


    // --- メッセージ履歴の取得 ---
    useEffect(() => {
        if (!match_id) return; // match_id が取得できるまで待つ

        const fetchMessages = async () => {
            setLoading(true);
            setError(null);
            try {
                // チャットAPI (GET) を呼び出す (次のステップで作成)
                const res = await axios.get(`/api/chat/${match_id}`);
                setMessages(res.data.messages || []);
            } catch (err: unknown) {
                console.error("Failed to fetch messages:", err);
                setError('メッセージの取得に失敗しました。');
            } finally {
                setLoading(false);
            }
        };

        fetchMessages();

        // (任意) ポーリング: 定期的にメッセージを再取得する場合
        // const intervalId = setInterval(fetchMessages, 5000); // 5秒ごと
        // return () => clearInterval(intervalId); // コンポーネント破棄時にクリア

    }, [match_id]); // match_id が変わったら再取得

    // --- 末尾への自動スクロール ---
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]); // messages が更新されたら実行

    // --- メッセージ送信処理 ---
    const handleSendMessage = async (e: FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !match_id || !selfSpotifyId || sending) return;

        setSending(true);
        setError(null);
        const contentToSend = newMessage; // 送信中の内容を保持
        setNewMessage(''); // 入力欄をクリア

        try {
            // チャットAPI (POST) を呼び出す (次のステップで作成)
            await axios.post(`/api/chat/${match_id}`, {
                senderSpotifyId: selfSpotifyId, // 送信者のSpotify ID
                content: contentToSend,
            });
            // 成功したらメッセージリストを再取得 (ポーリングがない場合)
            const res = await axios.get(`/api/chat/${match_id}`);
            setMessages(res.data.messages || []);
        } catch (err: unknown) {
            console.error("Failed to send message:", err);
            setError('メッセージの送信に失敗しました。');
            setNewMessage(contentToSend); // 送信失敗したら入力欄に戻す
        } finally {
            setSending(false);
        }
    };

    if (!match_id || !selfSpotifyId || !otherUserId) {
        return <div className="text-white p-4">チャット情報の読み込み中...</div>;
    }

    if (loading && messages.length === 0) { // 初回ロード中のみ表示
        return <div className="text-white p-4">メッセージ履歴を読み込み中...</div>;
    }

    if (error) {
        return <div className="text-red-500 p-4">{error}</div>;
    }

    return (
        <div className="flex flex-col h-screen max-w-lg mx-auto bg-gray-900 text-white">
            {/* ヘッダー: 相手の情報 */}
            <header className="bg-gray-800 p-4 shadow-md flex items-center space-x-3 sticky top-0 z-10">
                <Link href={`/chats?spotifyUserId=${selfSpotifyId}`} className="text-blue-400 hover:text-blue-300">
                    &lt; 戻る
                </Link>
                {otherUserInfo?.profile_image_url ? (
                     <Image src={otherUserInfo.profile_image_url} alt={otherUserInfo.nickname} width={40} height={40} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                     <div className="w-10 h-10 rounded-full bg-gray-600"></div>
                )}
                <h1 className="font-bold text-lg">{otherUserInfo?.nickname || '読み込み中...'}</h1>
            </header>

            {/* メッセージリスト */}
            <main className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender_id === otherUserId ? 'justify-start' : 'justify-end'}`}>
                        <div className={`p-3 rounded-lg max-w-xs lg:max-w-md ${
                            msg.sender_id === otherUserId
                                ? 'bg-gray-700' // 相手のメッセージ
                                : 'bg-blue-600' // 自分のメッセージ
                        }`}>
                            <p>{msg.content}</p>
                            {/* <span className="text-xs text-gray-400 block mt-1 text-right">
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span> */}
                        </div>
                    </div>
                ))}
                {/* スクロール用の空要素 */}
                <div ref={messagesEndRef} />
            </main>

            {/* メッセージ入力フォーム */}
            <footer className="bg-gray-800 p-4 sticky bottom-0 z-10">
                <form onSubmit={handleSendMessage} className="flex space-x-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="メッセージを入力..."
                        className="flex-1 p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                        disabled={sending}
                    />
                    <button
                        type="submit"
                        className={`px-4 py-2 rounded font-semibold ${
                            sending || !newMessage.trim()
                                ? 'bg-gray-500 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                        disabled={sending || !newMessage.trim()}
                    >
                        {sending ? '送信中...' : '送信'}
                    </button>
                </form>
            </footer>
        </div>
    );
}