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

  // ▼▼▼【追加】リクエストURLを構築 ▼▼▼
  const requestUrl = `${SPOTIFY_BASE_URL}/artists/${artistId}/related-artists`;

  // 🔽 トークンのログ出力（先頭10文字だけ）
  console.log(`[Debug] Fetching related artists for ${artistId}`);
  console.log(`[Debug] Access Token: ${accessToken?.slice(0, 10) || 'MISSING'}`);

  // ▼▼▼【追加】リクエスト直前にURLをVercelのログに出力 ▼▼▼
  console.log(`[Spotify API] Requesting URL: ${requestUrl}`);

  try {
    const { data } = await axios.get<RelatedArtistsResponse>(
      requestUrl,
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
  } catch (error: any) {
    const status = error.response?.status;
  if (status === 401) {
    console.error(`[Spotify API] 401 Unauthorized: Access token may have expired for ${artistId}`);
  } else if (status === 404) {
    console.warn(`[Spotify API] 404 Not Found: Artist ${artistId} not found or no related artists`);
  } else {
    console.error(`[Spotify API] Unexpected error (${status}) for ${artistId}`, error.message);
  }

  return [];
  }
};

export const verifyArtistExists = async (
  accessToken: string,
  artistId: string
): Promise<boolean> => {
  try {
    const { data } = await axios.get(
      `${SPOTIFY_BASE_URL}/artists/${artistId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      }
    );
    console.log(`[Verify] Artist ${artistId} exists: ${data.name}`);
    return true;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`[Verify] Artist ${artistId} does NOT exist. Status: ${error.response?.status}`);
    }
    return false;
  }
};