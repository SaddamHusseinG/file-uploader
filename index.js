const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const uploadFolder = path.join(__dirname, 'uploads');
const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1397901124589191329/jXG5RP9h0Q-Df96yNdVgfP1i4z7IOXHnEdBRYSPlcJpcVs3EED1LrCPaVwOtPD6BvuKt';

const USERS = {
  winter: 'g',
  enzo: 'balls',
  josh: 'polish'
};

// Ensure uploads folder exists
if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder);

// Multer config
const storage = multer.diskStorage({
  destination: uploadFolder,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});
const upload = multer({ storage });

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/file', express.static(uploadFolder));
app.use(session({
  secret: 'supersecret',
  resave: false,
  saveUninitialized: false
}));

// Login page
app.get('/login', (req, res) => {
  const error = req.query.error ? `<p class="error">Invalid credentials</p>` : '';
  res.send(`
    <html>
    <head><title>Login</title><link rel="stylesheet" href="/style.css"></head>
    <body>
      <div class="card">
        <h2>Login</h2>
        ${error}
        <form method="post" action="/login">
          <input name="username" placeholder="Username" required>
          <input name="password" type="password" placeholder="Password" required>
          <button type="submit">Login</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (USERS[username] && USERS[username] === password) {
    req.session.loggedIn = true;
    req.session.username = username;
    res.redirect('/');
  } else {
    res.redirect('/login?error=1');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// Upload form
app.get('/', (req, res) => {
  if (!req.session.loggedIn) return res.redirect('/login');
  res.send(`
    <html>
    <head><title>File Uploader</title><link rel="stylesheet" href="/style.css"></head>
    <body>
      <div class="card">
        <h2>Upload a File</h2>
        <p>Logged in as <b>${req.session.username}</b> | <a href="/logout">Logout</a></p>
        <form action="/upload" method="post" enctype="multipart/form-data">
          <input type="file" name="file" required />
          <button type="submit">Upload</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// Upload logic
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.session.loggedIn) return res.redirect('/login');

  const fileUrl = `${req.protocol}://${req.get('host')}/file/${req.file.filename}`;

  // Send to Discord webhook
  try {
    await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `📤 **${req.session.username}** uploaded a file:\n${fileUrl}`
      })
    });
  } catch (err) {
    console.error('Webhook failed:', err.message);
  }

  res.send(`
    <html>
    <head><title>Uploaded</title><link rel="stylesheet" href="/style.css"></head>
    <body>
      <div class="card">
        <h2>✅ File Uploaded</h2>
        <a href="${fileUrl}" target="_blank">${fileUrl}</a><br><br>
        <a href="/">Upload another</a>
      </div>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🟢 Uploader running at http://localhost:${PORT}`);
});
