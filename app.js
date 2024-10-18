const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

let accessToken = null;
let currentSongData = null; // Variable to store current song data

// Get a new access token
const getAccessToken = async () => {
    try {
        const response = await axios({
            method: 'post',
            url: 'https://accounts.spotify.com/api/token',
            params: {
                grant_type: 'refresh_token',
                refresh_token: process.env.SPOTIFY_REFRESH_TOKEN,
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: 'Basic ' + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64'),
            },
        });
        accessToken = response.data.access_token;
        console.log('Access token obtained:', accessToken); // Log access token
    } catch (error) {
        console.error('Error fetching access token:', error.response ? error.response.data : error.message);
    }
};

// Fetch the current playing track
const getCurrentPlayingTrack = async () => {
    try {
        const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        // Log the status and data received
        console.log('Current playing response status:', response.status);
        console.log('Current playing response data:', response.data);

        if (response.status === 204 || !response.data) {
            console.log('No song is currently playing.');
            currentSongData = null; // Clear song data if nothing is playing
            return;
        }

        currentSongData = {
            song: response.data.item.name,
            artist: response.data.item.artists.map(artist => artist.name).join(', '),
            album: response.data.item.album.name,
            albumArt: response.data.item.album.images[0].url,
        };

        console.log('Current song data updated:', currentSongData);
    } catch (error) {
        console.error('Error fetching current track:', error.response ? error.response.data : error.message);
    }
};

// Run the task every second
cron.schedule('* * * * * *', async () => {
    if (!accessToken) await getAccessToken();
    await getCurrentPlayingTrack();
});

// Set up a route to serve the JSON data
app.get('/current-song', (req, res) => {
    if (!currentSongData) {
        console.log('No song data available to send.');
        return res.status(404).json({ error: 'No song data available.' });
    }
    res.json(currentSongData); // Send the current song data as a JSON response
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
