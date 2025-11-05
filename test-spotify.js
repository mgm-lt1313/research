// test-spotify.js
// ターミナルで `npm install axios` を実行してから、 `node test-spotify.js` で実行します。
const axios = require('axios');

// --- 1. ここにSpotifyから取得した有効なアクセストークンを貼り付けます ---
// (ログにあった 'BQDdsFoe70...' のような文字列。期限切れの場合は再取得してください)
const MY_ACCESS_TOKEN = 'BQDLtXydNxZCeay-wwMIfFw1UYiGmTxKVVVnuqeXFchnGwwudH-sAhe02h3Umh16aunkYH5bRJMfbtCQ8S_o6SDiK_K8Busoi_cpm9f1ZrLA_sZ56tbuj5SStLz4Q5CqvWCvnpb4T19n8t9SMi1vXKK0X2yXGP6FjNMzKDqefVc7NjTnHzbgw_MtdDxvHL9bVx6qNyXhyIZWl7hjfQd6ax5e4n14VrTotX6QLSjuG8Yta5hd_z1itmB9tUvoP68a4bHvUmw4mUjn';

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