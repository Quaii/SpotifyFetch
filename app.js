const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

let accessToken = null;
let refreshToken = process.env.SPOTIFY_REFRESH_TOKEN; // Ensure your refresh token is set in your .env file

// Function to get a new access token
const getAccessToken = async () => {
    try {
        const response = await axios({
            method: 'post',
            url: 'https://accounts.spotify.com/api/token',
            params: {
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: 'Basic ' + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64'),
            },
        });
        
        accessToken = response.data.access_token;
        console.log('New access token fetched successfully');
    } catch (error) {
        console.error('Error fetching access token:', error.response ? error.response.data : error.message);
        if (error.response && error.response.data.error === 'invalid_grant') {
            console.error('Invalid refresh token. You may need to reauthorize.');
        }
    }
};

// Function to fetch the current playing track
const getCurrentPlayingTrack = async () => {
    try {
        const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (response.status === 204 || !response.data) {
            console.log('No song is currently playing.');
            return;
        }

        const songData = {
            song: response.data.item.name,
            artist: response.data.item.artists.map(artist => artist.name).join(', '),
            album: response.data.item.album.name,
            albumArt: response.data.item.album.images[0].url,
        };

        // Respond with the current song data
        return songData;
    } catch (error) {
        console.error('Error fetching current track:', error.response ? error.response.data : error.message);
    }
};

// Endpoint to get current song
app.get('/current-song', async (req, res) => {
    if (!accessToken) await getAccessToken();
    
    const currentTrack = await getCurrentPlayingTrack();
    
    if (currentTrack) {
        res.json(currentTrack);
    } else {
        res.status(500).json({ error: 'No song data available or unable to fetch current track.' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// Initial token fetch for access token
(async () => {
    await getAccessToken();
})();
