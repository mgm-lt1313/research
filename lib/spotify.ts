// lib/spotify.ts - 完全版

import axios from 'axios';

const SPOTIFY_BASE_URL = 'https://api.spotify.com/v1';

export interface SpotifyProfile {
  display_name: string;
  id: string;
  images: { url: string; height: number; width: number }[];
  external_urls: { spotify: string };
  href: string;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  images: { url: string; height: number; width: number }[];
  external_urls: { spotify: string };
  genres: string[];
  popularity: number;
}

export const getMyProfile = async (accessToken: string): Promise<SpotifyProfile> => {
  const { data } = await axios.get<SpotifyProfile>(`${SPOTIFY_BASE_URL}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
};

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
    const url = `${SPOTIFY_BASE_URL}/me/following?type=artist&limit=50${after ? `&after=${after}` : ''}`;
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
 * アーティスト情報を取得
 */
export const getArtistInfo = async (
  accessToken: string,
  artistId: string
): Promise<SpotifyArtist | null> => {
  try {
    console.log(`[Spotify API] Getting artist info for: ${artistId}`);
    const { data } = await axios.get<SpotifyArtist>(
      `${SPOTIFY_BASE_URL}/artists/${artistId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      }
    );
    console.log(`[Spotify API] Artist found: ${data.name}, Genres: ${data.genres.join(', ')}`);
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`[Spotify API] Artist not found: ${artistId}, Status: ${error.response?.status}`);
    }
    return null;
  }
};

/**
 * 複数のアーティスト情報を一括取得（効率化）
 */
export const getMultipleArtists = async (
  accessToken: string,
  artistIds: string[]
): Promise<SpotifyArtist[]> => {
  try {
    // Spotify APIは最大50アーティストまで一括取得可能
    const chunks = [];
    for (let i = 0; i < artistIds.length; i += 50) {
      chunks.push(artistIds.slice(i, i + 50));
    }

    const allArtists: SpotifyArtist[] = [];
    for (const chunk of chunks) {
      const { data } = await axios.get(
        `${SPOTIFY_BASE_URL}/artists`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { ids: chunk.join(',') },
          timeout: 10000,
        }
      );
      allArtists.push(...data.artists.filter((a: SpotifyArtist | null) => a !== null));
    }
    
    return allArtists;
  } catch (error) {
    console.error('[Spotify API] Failed to get multiple artists:', error);
    return [];
  }
};

/**
 * 関連アーティストを取得（複数の方法を試行）
 */
export const getArtistRelatedArtists = async (
  accessToken: string,
  artistId: string
): Promise<SpotifyArtist[]> => {
  console.log(`[Spotify API] Getting related artists for: ${artistId}`);
  
  // 方法1: related-artists エンドポイント
  try {
    const { data } = await axios.get(
      `${SPOTIFY_BASE_URL}/artists/${artistId}/related-artists`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
        validateStatus: (status) => status < 500, // 4xxエラーもキャッチ
      }
    );
    
    if (data.artists && data.artists.length > 0) {
      console.log(`[Spotify API] Method 1 success: Found ${data.artists.length} related artists`);
      return data.artists.slice(0, 10);
    }
  } catch (error: any) {
    console.warn(`[Spotify API] Method 1 (related-artists) failed for ${artistId}`);
  }

  // 方法2: アーティスト情報からジャンルベースで検索
  try {
    const artistInfo = await getArtistInfo(accessToken, artistId);
    
    if (!artistInfo) {
      console.error(`[Spotify API] Artist ${artistId} does not exist`);
      return [];
    }

    if (artistInfo.genres.length === 0) {
      console.warn(`[Spotify API] Artist ${artistId} has no genres`);
      // 方法3へ
    } else {
      const genreArtists = await searchArtistsByGenre(
        accessToken,
        artistInfo.genres[0],
        artistId
      );
      
      if (genreArtists.length > 0) {
        console.log(`[Spotify API] Method 2 success: Found ${genreArtists.length} artists by genre`);
        return genreArtists;
      }
    }
  } catch (error: any) {
    console.warn(`[Spotify API] Method 2 (genre search) failed for ${artistId}`);
  }

  // 方法3: ユーザーのトップアーティストから類似アーティストを取得
  try {
    const topArtists = await getUserTopArtists(accessToken);
    const similar = topArtists.filter(a => a.id !== artistId).slice(0, 10);
    
    if (similar.length > 0) {
      console.log(`[Spotify API] Method 3 success: Using ${similar.length} top artists`);
      return similar;
    }
  } catch (error: any) {
    console.warn(`[Spotify API] Method 3 (top artists) failed for ${artistId}`);
  }

  console.error(`[Spotify API] All methods failed for ${artistId}`);
  return [];
};

/**
 * ジャンルでアーティストを検索
 */
async function searchArtistsByGenre(
  accessToken: string,
  genre: string,
  excludeArtistId: string
): Promise<SpotifyArtist[]> {
  try {
    const { data } = await axios.get(
      `${SPOTIFY_BASE_URL}/search`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          q: `genre:"${genre}"`,
          type: 'artist',
          limit: 15,
        },
        timeout: 10000,
      }
    );
    
    const artists = data.artists?.items || [];
    return artists.filter((a: SpotifyArtist) => a.id !== excludeArtistId).slice(0, 10);
  } catch (error) {
    console.error(`[Spotify API] Genre search failed for "${genre}":`, error);
    return [];
  }
}

/**
 * ユーザーのトップアーティストを取得
 */
async function getUserTopArtists(accessToken: string): Promise<SpotifyArtist[]> {
  try {
    const { data } = await axios.get(
      `${SPOTIFY_BASE_URL}/me/top/artists`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          limit: 20,
          time_range: 'medium_term',
        },
        timeout: 10000,
      }
    );
    
    return data.items || [];
  } catch (error) {
    console.error('[Spotify API] Failed to get top artists:', error);
    return [];
  }
}