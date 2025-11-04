// test-spotify.js
// ターミナルで `npm install axios` を実行してから、 `node test-spotify.js` で実行します。
const axios = require('axios');

// --- 1. ここにSpotifyから取得した有効なアクセストークンを貼り付けます ---
// (ログにあった 'BQDdsFoe70...' のような文字列。期限切れの場合は再取得してください)
const MY_ACCESS_TOKEN = 'BQD0z_t5cfpOalzfH89NKvzVOUMbDIB8zGDXkRt0wPOTeoaxljYn8LCYtqGZZQYjjg-6GkTHkf3WIZNAOMI7tZxfX0wzbn4HsBd55C3Hz3Od--XcSW8fBvPHhWh0gyJlfXtXVSoz9Ofmax0XAcqFJF2SJe5q2l5KFUvIeQYhtVbVMJsgffDB7ZMo6FJk6T9fdbxmenDt-8SNA_tpn9ZQWGVPH2-FQzHpOQSfcbMF1KLqTJYunQIr55ny66BgXoLHmRc8voyhN7hL';

// --- 2. アーティストID (ログから) ---
const ARTIST_ID = '6M2wZ9GZgrQXHCFfjv46we'; // (ログにあったアーティストID)

// --- 3. 現在コードに設定されている「間違った」URL ---
const WRONG_URL = `https://api.spotify.com/v1/artists/${ARTIST_ID}/related-artists`;

// --- 4. Spotifyの「正しい」URL ---
const CORRECT_URL = `https://api.spotify.com/v1/artists/${ARTIST_ID}/related-artists`;

// --- 5. テストを実行する関数 ---
const runTest = async () => {
  if (MY_ACCESS_TOKEN === 'YOUR_VALID_ACCESS_TOKEN_HERE') {
    console.error('!!! スクリプトの10行目にある MY_ACCESS_TOKEN を、実際のトークンに書き換えてください。 !!!');
    return;
  }

  const headers = {
    'Authorization': `Bearer ${MY_ACCESS_TOKEN}`
  };

  console.log('--- Test 1: 現在コードに設定されている「間違った」URLでのテスト... ---');
  console.log(`Requesting: ${WRONG_URL}`);
  try {
    await axios.get(WRONG_URL, { headers });
    console.log('✅ Test 1: Succeeded (これは予期しない動作です)');
  } catch (error) {
    if (error.response) {
      console.error(`❌ Test 1 Failed (予期した通り): ${error.response.status} ${error.response.statusText}`);
    } else {
      console.error('❌ Test 1 Failed:', error.message);
    }
  }

  console.log('\n--- Test 2: Spotifyの「正しい」URLでのテスト... ---');
  console.log(`Requesting: ${CORRECT_URL}`);
  try {
    const response = await axios.get(CORRECT_URL, { headers });
    console.log(`✅ Test 2 Succeeded: ${response.status} OK`);
    console.log('取得できた関連アーティスト:', response.data.artists.map(a => a.name).join(', '));
  } catch (error) {
    if (error.response) {
      console.error(`❌ Test 2 Failed: ${error.response.status} ${error.response.statusText}`);
      console.error('トークンが古いか、アーティストIDが正しくない可能性があります。');
    } else {
      console.error('❌ Test 2 Failed:', error.message);
    }
  }
};

runTest();