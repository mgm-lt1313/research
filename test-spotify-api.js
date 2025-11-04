// test-spotify-api.js
const axios = require('axios');

// ⚠️ ここに実際のアクセストークンを貼り付けてください
// トークンの取得方法は下記の「アクセストークンの取得方法」を参照
const ACCESS_TOKEN = 'YOUR_ACCESS_TOKEN_HERE';

// テストしたいアーティストID（エラーログから取得）
const ARTIST_IDS = [
  '3PRXdiVu8lUkeCKw4ZUX4B',
  '6qqNVTkY8uBg9cP3Jd7DAH',
  '74KM79TiuVKeVCqs8QtB0B'
];

async function testArtistExists(artistId) {
  console.log(`\n========================================`);
  console.log(`Testing Artist ID: ${artistId}`);
  console.log(`========================================`);
  
  try {
    // 1. アーティスト情報を取得
    console.log(`\n[1] GET /artists/${artistId}`);
    const artistResponse = await axios.get(
      `https://api.spotify.com/v1/artists/${artistId}`,
      {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
      }
    );
    console.log(`✅ SUCCESS - Artist exists: ${artistResponse.data.name}`);
    console.log(`   Genres: ${artistResponse.data.genres.join(', ')}`);
    console.log(`   Popularity: ${artistResponse.data.popularity}`);
    
    // 2. 関連アーティストを取得
    console.log(`\n[2] GET /artists/${artistId}/related-artists`);
    const relatedResponse = await axios.get(
      `https://api.spotify.com/v1/artists/${artistId}/related-artists`,
      {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
      }
    );
    console.log(`✅ SUCCESS - Found ${relatedResponse.data.artists.length} related artists`);
    relatedResponse.data.artists.slice(0, 3).forEach(artist => {
      console.log(`   - ${artist.name} (${artist.id})`);
    });
    
  } catch (error) {
    if (error.response) {
      console.log(`❌ ERROR - Status: ${error.response.status}`);
      console.log(`   Message: ${error.response.data.error?.message || 'No message'}`);
      console.log(`   Full URL: ${error.config.url}`);
    } else {
      console.log(`❌ ERROR - ${error.message}`);
    }
  }
}

async function main() {
  console.log('='.repeat(50));
  console.log('Spotify API Test Script');
  console.log('='.repeat(50));
  
  if (ACCESS_TOKEN === 'YOUR_ACCESS_TOKEN_HERE') {
    console.error('\n❌ ERROR: Please set your ACCESS_TOKEN in the script!');
    console.log('\nHow to get an access token:');
    console.log('1. Go to https://developer.spotify.com/console/get-artist/');
    console.log('2. Click "Get Token"');
    console.log('3. Copy the token and paste it into this script');
    process.exit(1);
  }
  
  for (const artistId of ARTIST_IDS) {
    await testArtistExists(artistId);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待機
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('Test completed!');
  console.log('='.repeat(50));
}

main();