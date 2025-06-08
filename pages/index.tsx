// pages/index.tsx
import Head from 'next/head';
import Link from 'next/link'; // Linkコンポーネントをインポート

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <Head>
        <title>Spotify音楽嗜好マッチング</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center">
        <h1 className="text-4xl font-bold mb-6">
          Spotify音楽嗜好マッチング
        </h1>

        <p className="mt-3 text-xl mb-8">
          あなたのSpotifyフォローアーティストから、音楽の趣味が合う人を見つけよう！
        </p>

        <a
          href="/api/login" // Spotify認証APIルートへのリンク
          className="px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 md:py-4 md:text-lg md:px-10"
        >
          Spotifyでログイン
        </a>
      </main>
    </div>
  );
}