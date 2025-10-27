// pages/api/match/calculate.ts (修正済み・全体)
import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';
import { PoolClient } from 'pg';

async function getUserIdBySpotifyId(client: PoolClient, spotifyUserId: string): Promise<string | null> {
    const res = await client.query('SELECT id FROM users WHERE spotify_user_id = $1', [spotifyUserId]);
    return res.rows.length > 0 ? res.rows[0].id : null;
}

interface UserArtists {
    user_id: string; // uuid
    spotify_artist_id: string;
    artist_name: string;
}

async function getAllSelectedArtists(client: PoolClient): Promise<Map<string, UserArtists[]>> {
    const res = await client.query('SELECT user_id, spotify_artist_id, artist_name FROM selected_artists');
    const userMap = new Map<string, UserArtists[]>(); // uuid
    for (const row of res.rows) {
        if (!userMap.has(row.user_id)) {
            userMap.set(row.user_id, []);
        }
        userMap.get(row.user_id)!.push({
            user_id: row.user_id,
            spotify_artist_id: row.spotify_artist_id,
            artist_name: row.artist_name,
        });
    }
    return userMap;
}

interface UserProfile {
    user_id: string; // uuid
    nickname: string;
    profile_image_url: string | null;
    bio: string | null;
}

async function getAllUserProfiles(client: PoolClient): Promise<Map<string, UserProfile>> {
    const res = await client.query('SELECT id as user_id, nickname, profile_image_url, bio FROM users');
    const userMap = new Map<string, UserProfile>(); // uuid
    for (const row of res.rows) {
        userMap.set(row.user_id, row);
    }
    return userMap;
}

interface MatchResult {
    matched_user_id: string; // uuid
    score: number;
    profile: Omit<UserProfile, 'user_id'> | null;
    sharedArtists: string[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }
    const { spotifyUserId } = req.body;
    if (!spotifyUserId) {
        return res.status(400).json({ message: 'Missing spotifyUserId.' });
    }

    const client = await pool.connect();
    try {
        const currentUserId = await getUserIdBySpotifyId(client, spotifyUserId); // string | null (uuid)
        if (!currentUserId) {
            return res.status(404).json({ message: 'Current user profile not found.' });
        }

        const [allUserArtistsMap, allUserProfilesMap] = await Promise.all([
            getAllSelectedArtists(client),
            getAllUserProfiles(client)
        ]);

        const currentUserArtists = allUserArtistsMap.get(currentUserId)?.map(a => a.spotify_artist_id) || [];
        const matches: MatchResult[] = [];

        for (const [matchedUserId, matchedUserArtists] of allUserArtistsMap.entries()) { // matchedUserId is string (uuid)
            if (matchedUserId === currentUserId) continue;

            const matchedArtistIds = matchedUserArtists.map(a => a.spotify_artist_id);
            let score = 0;
            const sharedArtists: string[] = [];

            for (const artistId of currentUserArtists) {
                if (matchedArtistIds.includes(artistId)) {
                    score++;
                    sharedArtists.push(artistId);
                }
            }

            if (score > 0) {
                const matchedProfile = allUserProfilesMap.get(matchedUserId) || null;
                matches.push({
                    matched_user_id: matchedUserId, // string (uuid)
                    score: score,
                    profile: matchedProfile ? {
                        nickname: matchedProfile.nickname,
                        profile_image_url: matchedProfile.profile_image_url,
                        bio: matchedProfile.bio
                    } : null,
                    sharedArtists: sharedArtists
                });
            }
        }

        matches.sort((a, b) => b.score - a.score);
        res.status(200).json({ matches });

    } catch (dbError) {
        console.error('Matching calculation failed:', dbError);
        res.status(500).json({ message: 'Matching calculation failed due to database error.' });
    } finally {
        client.release();
    }
}