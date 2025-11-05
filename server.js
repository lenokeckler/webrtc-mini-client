const express = require('express');
const app = express();
const path = require('node:path');

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'src')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Client server listening on port ${PORT}`);
});
