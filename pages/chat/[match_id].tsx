// pages/chat/[match_id].tsx (完全な修正版)
import { useRouter } from 'next/router';
import { useEffect, useState, useRef, FormEvent } from 'react';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link'; // 👈 Link の import

// メッセージの型
interface Message {
    id: number;
    created_at: string;
    sender_id: string; // uuid
    content: string;
}

// 相手のユーザー情報の型
interface OtherUser {
    id: string;
    nickname: string;
    profile_image_url: string | null;
}

export default function ChatRoom() {
    const router = useRouter();
    
    // --- 🔽★【重要】★ router.query から otherNickname と otherImageUrl を受け取る ---
    const { match_id, selfSpotifyId, otherUserId, otherNickname, otherImageUrl } = router.query as {
        match_id?: string;
        selfSpotifyId?: string;
        otherUserId?: string;
        otherNickname?: string; // 👈 エラー箇所で必要なため、ここで宣言
        otherImageUrl?: string; // 👈 エラー箇所で必要なため、ここで宣言
    };
    // --- 🔼★【重要】★ ---

    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [otherUserInfo, setOtherUserInfo] = useState<OtherUser | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // --- 🔽 相手のプロフィール情報を取得する useEffect (API呼び出しを削除) ---
    useEffect(() => {
        // router.query から受け取った値を使う
        if (otherUserId && otherNickname) {
            setOtherUserInfo({
                id: otherUserId,
                nickname: decodeURIComponent(otherNickname), // 👈 宣言した変数を使う
                profile_image_url: otherImageUrl ? decodeURIComponent(otherImageUrl) : null // 👈 宣言した変数を使う
            });
        } else if (otherUserId) {
            // 万が一パラメータが渡されなかった場合のフォールバック
            setOtherUserInfo({ id: otherUserId, nickname: `ユーザー(${otherUserId.substring(0, 6)}...)`, profile_image_url: null });
        }
    }, [otherUserId, otherNickname, otherImageUrl]); // 👈 依存配列にも追加
    // --- 🔼 修正ここまで ---

    // --- メッセージ履歴の取得 ---
    useEffect(() => {
        if (!match_id || !selfSpotifyId) return;

        const fetchMessages = async () => {
            setLoading(true);
            setError(null);
            console.log("Fetching messages for match_id:", match_id, "selfSpotifyId:", selfSpotifyId);
            try {
                const res = await axios.get(`/api/chat/${match_id}?selfSpotifyId=${selfSpotifyId}`);
                console.log("Messages API Response:", res.data);
                setMessages(res.data.messages || []);
            } catch (err: unknown) {
                console.error("Failed to fetch messages:", err);
                 let msg = 'メッセージの取得に失敗しました。';
                 if (axios.isAxiosError(err)) {
                     msg += ` (Status: ${err.response?.status}, ${err.response?.data?.message || '詳細不明'})`;
                 } else if (err instanceof Error) {
                     msg += ` ${err.message}`;
                 }
                setError(msg);
            } finally {
                setLoading(false);
            }
        };

        fetchMessages();
    }, [match_id, selfSpotifyId]);

    // --- 末尾への自動スクロール ---
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // --- メッセージ送信処理 ---
    const handleSendMessage = async (e: FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !match_id || !selfSpotifyId || sending) return;

        setSending(true);
        setError(null);
        const contentToSend = newMessage;
        setNewMessage('');

        console.log(`Sending message to match_id: ${match_id}`);
        console.log(`Data being sent:`, { senderSpotifyId: selfSpotifyId, content: contentToSend });

        try {
            const postResponse = await axios.post(`/api/chat/${match_id}`, {
                senderSpotifyId: selfSpotifyId,
                content: contentToSend,
            });
            console.log("Message sent successfully:", postResponse.data);

            const getUrl = `/api/chat/${match_id}?selfSpotifyId=${selfSpotifyId}`;
            console.log("Attempting to fetch messages with URL:", getUrl);
            const getResponse = await axios.get(getUrl);

            setMessages(getResponse.data.messages || []);

        } catch (err: unknown) {
           console.error("Failed to send message OR fetch after sending:", err);
           let detailedErrorMessage = 'メッセージの送信または再取得に失敗しました。';
            if (axios.isAxiosError(err)) {
                console.error("Axios error details:", { status: err.response?.status, data: err.response?.data, configData: err.config?.data });
                detailedErrorMessage += ` (サーバーエラー: ${err.response?.data?.message || err.message})`;
            } else if (err instanceof Error) {
                detailedErrorMessage += ` (${err.message})`;
            }
            setError(detailedErrorMessage);
            setNewMessage(contentToSend);
        } finally {
            setSending(false);
        }
    };

    // --- 🔽 router.query が準備できるまで待つ ---
    if (!router.isReady) {
         return <div className="text-white p-4">チャット情報を読み込み中...</div>;
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
                 {loading && messages.length === 0 && ( // 👈 初回ロード中のみ表示
                    <div className="text-center text-gray-400">メッセージ履歴を読み込み中...</div>
                 )}
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${
                        // 🔽 自分のIDと比較 (selfSpotifyId ではなく internalId の otherUserId)
                        msg.sender_id === otherUserId ? 'justify-start' : 'justify-end'
                    }`}>
                        <div className={`p-3 rounded-lg max-w-xs lg:max-w-md ${
                            msg.sender_id === otherUserId
                                ? 'bg-gray-700' // 相手のメッセージ
                                : 'bg-blue-600' // 自分のメッセージ
                        }`}>
                            <p>{msg.content}</p>
                        </div>
                    </div>
                ))}
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