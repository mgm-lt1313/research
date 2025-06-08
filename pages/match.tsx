import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import axios from 'axios'

export default function Match() {
  const router = useRouter()
  const { access_token } = router.query
  const [profile, setProfile] = useState<any>(null)
  const [artists, setArtists] = useState<any[]>([])

  useEffect(() => {
    if (!access_token) return

    const fetchData = async () => {
      try {
        const profileRes = await axios.get('https://api.spotify.com/v1/me', {
          headers: { Authorization: `Bearer ${access_token}` },
        })
        setProfile(profileRes.data)

        const followRes = await axios.get(
          'https://api.spotify.com/v1/me/following?type=artist&limit=20',
          {
            headers: { Authorization: `Bearer ${access_token}` },
          }
        )
        setArtists(followRes.data.artists.items)
      } catch (e) {
        console.error(e)
      }
    }

    fetchData()
  }, [access_token])

  return (
    <div className="p-4">
      {profile && (
        <div>
          <h1 className="text-2xl font-bold mb-2">こんにちは、{profile.display_name} さん！</h1>
          <p>Spotify ID: {profile.id}</p>
        </div>
      )}
      <h2 className="text-xl font-bold mt-4">フォロー中のアーティスト</h2>
      <ul className="list-disc pl-6">
        {artists.map((artist) => (
          <li key={artist.id}>{artist.name}</li>
        ))}
      </ul>
    </div>
  )
}
