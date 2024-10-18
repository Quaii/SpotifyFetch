const express = require('express');
const axios = require('axios');
const fs = require('fs');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

let accessToken = null;

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
        console.log('Access Token refreshed:', accessToken); // Log the new access token
    } catch (error) {
        console.error('Error fetching access token:', error);
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

        // Check if there is a currently playing track
        if (response.status === 204 || !response.data) {
            console.log('No song is currently playing.');
            return;
        }

        // Extract song data
        const songData = {
            song: response.data.item.name,
            artist: response.data.item.artists.map(artist => artist.name).join(', '),
            album: response.data.item.album.name,
            albumArt: response.data.item.album.images[0].url,
        };

        // Write song data to JSON file
        fs.writeFileSync('./current_song.json', JSON.stringify(songData, null, 2));
        console.log('Current song data written to JSON file:', songData);
    } catch (error) {
        console.error('Error fetching current track:', error);
    }
};

// Run the task every 5 seconds (adjust the cron expression as needed)
cron.schedule('*/5 * * * * *', async () => {  // Runs every 5 seconds
    if (!accessToken) await getAccessToken(); // Get a new access token if it's not available
    await getCurrentPlayingTrack(); // Fetch the current playing track
});

// Set up a route for the root URL
app.get('/', (req, res) => {
    res.send('Welcome to the Spotify Fetch API! Access the current song data at <a href="/current-song">/current-song</a>.');
});

// Set up a route to serve the JSON data
app.get('/current-song', (req, res) => {
    try {
        const data = fs.readFileSync('./current_song.json');
        res.json(JSON.parse(data)); // Send the current song data as JSON response
    } catch (error) {
        res.status(500).json({ error: 'No song data available.' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
