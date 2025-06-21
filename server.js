const express = require('express');
const path = require('path');
const app = express();

// Hanya layani file statis untuk aset tertentu (misalnya CSS, JS, gambar)
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Rute utama langsung ke home.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});

// Rute eksplisit ke index.html
app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Tangani rute lain dengan redirect ke home
app.get('*', (req, res) => {
    res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
