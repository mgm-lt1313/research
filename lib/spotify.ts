// lib/spotify.ts
import axios from 'axios';

// Spotify APIのベースURL
const SPOTIFY_BASE_URL = 'https://api.spotify.com/v1'; // 正しいSpotify APIのベースURL

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
export const getMyFollowingArtists = async (accessToken: string): Promise<SpotifyArtist[]> => {
  const { data } = await axios.get<{ artists: { items: SpotifyArtist[] } }>(
    `${SPOTIFY_BASE_URL}/me/following?type=artist`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  return data.artists.items;
};

/**
 * 指定されたアーティストの関連アーティストを取得
 * @param artistId 関連アーティストを取得したいアーティストのID
 * @param accessToken Spotify APIのアクセストークン
 */
export const getRelatedArtists = async (artistId: string, accessToken: string): Promise<SpotifyArtist[]> => {
  const { data } = await axios.get<{ artists: SpotifyArtist[] }>(
    `${SPOTIFY_BASE_URL}/artists/${artistId}/related-artists`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  return data.artists;
};