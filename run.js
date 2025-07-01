const http = require('http');
const fs = require('fs').promises;
const path = require('path');

const port = 3000;

const server = http.createServer(async (req, res) => {
    if (req.url === '/' && req.method === 'GET') {
        // Serve index.html
        const html = await fs.readFile(path.join(__dirname, 'public', 'index.html'));
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    } else if (req.url === '/code.js' && req.method === 'GET') {
        // Serve code.js
        const code = await fs.readFile(path.join(__dirname, 'code.js'));
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(code);
    } else if (req.url === '/run' && req.method === 'POST') {
        // Handle code execution
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { code } = JSON.parse(body);
                await fs.writeFile('temp.js', code);
                const { exec } = require('child_process');
                const util = require('util');
                const execPromise = util.promisify(exec);
                const { stdout, stderr } = await execPromise('node temp.js');
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(stderr || stdout);
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(error.message);
            } finally {
                try { await fs.unlink('temp.js'); } catch (e) {}
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

server.listen(port, () => {
    console.log(`Local server running at http://localhost:${port}`);
});
