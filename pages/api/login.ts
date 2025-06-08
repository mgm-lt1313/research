// pages/api/login.ts
import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const scope = 'user-follow-read user-read-email'
  const queryParams = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    scope,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
  })

  res.redirect(`https://accounts.spotify.com/authorize?${queryParams.toString()}`)
}
