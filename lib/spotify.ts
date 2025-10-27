// lib/spotify.ts
import axios from 'axios';

// Spotify APIのベースURL
const SPOTIFY_BASE_URL = 'https://api.spotify.com/v1';

// Spotify APIのプロフィール情報の型定義
export interface SpotifyProfile {
  display_name: string;
  id: string;
  images: { url: string; height: number; width: number }[];
  external_urls: { spotify: string };
  href: string;
  // 必要に応じて他のプロパティも追加
}

// Spotify APIのアーティスト情報の型定義
export interface SpotifyArtist {
  id: string;
  name: string;
  images: { url: string; height: number; width: number }[];
  external_urls: { spotify: string };
  genres: string[];
  popularity: number;
  // 必要に応じて他のプロパティも追加
}

/**
 * 現在のユーザーのプロフィール情報を取得
 * @param accessToken Spotify APIのアクセストークン
 */
export const getMyProfile = async (accessToken: string): Promise<SpotifyProfile> => {
  const { data } = await axios.get<SpotifyProfile>(`${SPOTIFY_BASE_URL}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
};

/**
 * 現在のユーザーがフォローしているアーティストのリストを取得
 * @param accessToken Spotify APIのアクセストークン
 */
interface SpotifyFollowingArtistsResponse {
  artists: {
    items: SpotifyArtist[];
    cursors: { after?: string };
    total: number;
    limit: number;
    href: string;
  };
}

export async function getMyFollowingArtists(accessToken: string): Promise<SpotifyArtist[]> {
  let artists: SpotifyArtist[] = [];
  let after: string | undefined = undefined;
  let hasNext = true;

  while (hasNext) {
    const params = new URLSearchParams({
      type: 'artist',
      limit: '50',
    });
    if (after) {
      params.append('after', after);
    }
    // 正しいエンドポイント /me/following を使う
    const url = `${SPOTIFY_BASE_URL}/me/following?${params.toString()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data: SpotifyFollowingArtistsResponse = await res.json();

    const items = data.artists?.items || [];
    artists = artists.concat(items);

    if (items.length === 50 && data.artists.cursors?.after) {
      after = data.artists.cursors.after;
    } else {
      hasNext = false;
    }
  }

  return artists;
}

/**
 * 指定したアーティストの関連アーティストを取得
 * @param accessToken Spotify APIのアクセストークン
 * @param artistId アーティストID
 */
interface RelatedArtistsResponse {
  artists: SpotifyArtist[];
}

export const getArtistRelatedArtists = async (
  accessToken: string,
  artistId: string
): Promise<SpotifyArtist[]> => {
  try {
    const { data } = await axios.get<RelatedArtistsResponse>(
      `${SPOTIFY_BASE_URL}/artists/${artistId}/related-artists`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

// ▼▼▼ デバッグログ追加 ▼▼▼
    // Vercelのログで、Spotify APIが何件の関連アーティストを返したか確認します。
    console.log(`[Spotify API] Related artists for ${artistId}: ${data.artists.length} found.`);
    // ▲▲▲ デバッグログ追加 ▲▲▲

    // 関連アーティストは最大10人まで取得（多すぎると計算が重くなるため）
    return data.artists.slice(0, 10);
  } catch (error) {
    console.error(`Failed to get related artists for ${artistId}:`, error);
    // // 404以外のエラー（401認証エラーなど）もここでキャッチされます
    // // ▼▼▼ エラーログ強化 ▼▼▼
    // console.error(`Failed to get related artists for ${artistId}:`, error.response?.status, error.message);
    // // ▲▲▲ エラーログ強化 ▲▲▲
    return []; // エラー時は空配列を返す
  }
};