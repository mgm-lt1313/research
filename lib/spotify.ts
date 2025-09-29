// lib/spotify.ts
import axios from 'axios';

// Spotify APIのベースURL
const SPOTIFY_BASE_URL = 'https://api.spotify.com';

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
    const url = `https://api.spotify.com/me/following?type=artist&limit=50${after ? `&after=${after}` : ''}`;
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

// Spotify APIの関連アーティストレスポンスの型
export interface RelatedArtistsResponse {
  artists: SpotifyArtist[];
}

/**
 * 特定のアーティストに関連するアーティストのリストを取得
 * @param accessToken Spotify APIのアクセストークン
 * @param artistId 関連アーティストを取得したい元のアーティストID
 */
export const getRelatedArtists = async (accessToken: string, artistId: string): Promise<SpotifyArtist[]> => {
  // 正しいURL: https://api.spotify.com/v1/artists/{artist_id}/related-artists
  const { data } = await axios.get<RelatedArtistsResponse>(`${SPOTIFY_BASE_URL}/artists/${artistId}/related-artists`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data.artists || [];
};