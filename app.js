const express = require('express');
const axios = require('axios');
const session = require('express-session');
const app = express();

const SPOTIFY_CLIENT_ID = '5d566c4c0f7c4e07a61b564b75f0a343';
const SPOTIFY_CLIENT_SECRET = '95dc383328074fb8aff03b8d1f5e5114';
const REDIRECT_URI = 'https://spotifyfetch.onrender.com/callback';

app.use(session({
    secret: 'your-session-secret',
    resave: false,
    saveUninitialized: true,
}));

// Step 1: Redirect to Spotify Authorization
app.get('/login', (req, res) => {
    const scope = 'user-read-playback-state user-modify-playback-state user-read-currently-playing';
    res.redirect(`https://accounts.spotify.com/authorize?response_type=code&client_id=${SPOTIFY_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scope)}`);
});

// Step 2: Handle Callback from Spotify
app.get('/callback', async (req, res) => {
    const code = req.query.code;

    if (!code) {
        return res.send('Authorization failed. No code received.');
    }

    try {
        const response = await axios.post('https://accounts.spotify.com/api/token', null, {
            params: {
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64'),
            },
        });

        const { access_token, refresh_token } = response.data;
        console.log('Access Token:', access_token);
        console.log('Refresh Token:', refresh_token);

        // Save tokens in session for later use
        req.session.access_token = access_token;
        req.session.refresh_token = refresh_token;

        res.send('Authorization successful! You can now <a href="/current-playback">check the current playback</a>.');
    } catch (error) {
        console.error('Error exchanging code for token:', error.response.data);
        res.send('Error during authorization: ' + error.response.data.error_description);
    }
});

// Step 3: Fetch Current Playback State
app.get('/current-playback', async (req, res) => {
    const accessToken = req.session.access_token;

    if (!accessToken) {
        return res.send('No access token found. Please log in again.');
    }

    try {
        const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const filteredData = filterPlaybackData(response.data);
        res.json(filteredData); // Send filtered data as JSON
    } catch (error) {
        console.error('Error fetching current playback:', error.response.data);

        if (error.response.status === 401) {
            // If the access token is invalid, try refreshing it
            const newAccessToken = await refreshAccessToken(req.session.refresh_token);
            req.session.access_token = newAccessToken; // Update session with new access token
            
            // Retry fetching the current playback state with the new access token
            try {
                const retryResponse = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
                    headers: {
                        Authorization: `Bearer ${newAccessToken}`,
                    },
                });

                const filteredData = filterPlaybackData(retryResponse.data);
                res.json(filteredData); // Send filtered data as JSON
            } catch (retryError) {
                console.error('Error fetching current playback after refresh:', retryError.response.data);
                res.send('Error fetching current playback: ' + retryError.response.data.error.message);
            }
        } else {
            res.send('Error fetching current playback: ' + error.response.data.error.message);
        }
    }
});

// Step 4: Refresh Access Token
const refreshAccessToken = async (refreshToken) => {
    try {
        const response = await axios.post('https://accounts.spotify.com/api/token', null, {
            params: {
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64'),
            },
        });

        console.log('New Access Token:', response.data.access_token);
        return response.data.access_token; // The new access token
    } catch (error) {
        console.error('Error refreshing access token:', error.response.data);
        throw error;
    }
};

// Function to filter playback data
const filterPlaybackData = (data) => {
    const filteredData = {
        albumArt: {
            small: null,
            medium: null
        },
        artistName: null,
        songTitle: null
    };

    // Check if there's a currently playing item
    if (data && data.item) {
        const images = data.item.album.images;

        images.forEach(image => {
            if (image.width === 64) {
                filteredData.albumArt.small = image.url;
            }
            if (image.width === 300) {
                filteredData.albumArt.medium = image.url;
            }
        });

        // Get the artist name
        if (data.item.artists.length > 0) {
            filteredData.artistName = data.item.artists[0].name;
        }

        // Get the song title
        filteredData.songTitle = data.item.name;
    }

    return filteredData;
};

// Start your server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
