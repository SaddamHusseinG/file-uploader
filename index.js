// index.js
require('dotenv').config(); // Load secrets from .env file
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');
const bcrypt = require('bcrypt');

// --- Basic Setup ---
const app = express();
const PORT = process.env.PORT || 6501;
const uploadFolder = path.join(__dirname, 'uploads');

// --- Secrets from .env file ---
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const SESSION_SECRET = process.env.SESSION_SECRET;

// --- SECURE HASHED PASSWORDS ---
const USERS = {
  winter: 'g', // Plaintext: 'g'
  enzo:   'balls', // Plaintext: 'balls'
  josh:   'polish'  // Plaintext: 'polish'
};


// Ensure uploads folder exists
if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder);

// Multer config
const storage = multer.diskStorage({
  destination: uploadFolder,
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({ storage });

// --- Middleware ---
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/file', express.static(uploadFolder));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if you are using HTTPS
}));


// --- Helper Functions ---
const sendToDiscord = async (message) => {
  if (!DISCORD_WEBHOOK) return console.log('Discord webhook URL not set.');
  try {
    await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message })
    });
  } catch (err) {
    console.error('Webhook failed:', err.message);
  }
};

const renderPage = (title, bodyContent) => `
  <html>
    <head>
      <title>${title}</title>
      <link rel="stylesheet" href="/style.css">
    </head>
    <body>
      <div id="tsparticles"></div>
      ${bodyContent}
      <script src="https://cdn.jsdelivr.net/npm/tsparticles@2.9.3/tsparticles.bundle.min.js"></script>
      <script>
        tsParticles.load("tsparticles", {
          fpsLimit: 60,
          particles: {
            number: { value: 80, density: { enable: true, value_area: 800 } },
            color: { value: "#9b59b6" },
            shape: { type: "circle" },
            opacity: { value: 0.5, random: true },
            size: { value: 3, random: { enable: true, minimumValue: 1 } },
            move: {
              enable: true,
              speed: 1,
              direction: "none",
              out_mode: "out"
            },
            line_linked: {
              enable: true,
              distance: 150,
              color: "#8e44ad",
              opacity: 0.4,
              width: 1
            }
          },
          interactivity: {
            events: {
              onhover: { enable: true, mode: "grab" },
              onclick: { enable: true, mode: "push" }
            },
            modes: {
              grab: { distance: 140, line_opacity: 1 },
              push: { particles_nb: 4 }
            }
          },
          retina_detect: true
        });
      </script>
    </body>
  </html>
`;


// --- Routes ---
app.get('/login', (req, res) => {
  const error = req.query.error ? `<p class="error">Invalid username or password</p>` : '';
  const body = `
    <div class="card">
      <h2>Login</h2>
      ${error}
      <form method="post" action="/login">
        <input name="username" placeholder="Username" required>
        <input name="password" type="password" placeholder="Password" required>
        <button type="submit">Login</button>
      </form>
    </div>
  `;
  res.send(renderPage('Login', body));
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const storedHash = USERS[username];

  if (storedHash && await bcrypt.compare(password, storedHash)) {
    req.session.loggedIn = true;
    req.session.username = username;
    sendToDiscord(`✅ **${username}** just logged in.`);
    res.redirect('/');
  } else {
    res.redirect('/login?error=1');
  }
});

app.get('/logout', (req, res) => {
  if (req.session.username) {
    sendToDiscord(`👋 **${req.session.username}** logged out.`);
  }
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/', (req, res) => {
  if (!req.session.loggedIn) return res.redirect('/login');
  const body = `
    <div class="card">
      <h2>Upload a File</h2>
      <p>Logged in as <b>${req.session.username}</b> | <a href="/logout">Logout</a></p>
      <form action="/upload" method="post" enctype="multipart/form-data">
        <input type="file" name="file" required />
        <button type="submit">Upload</button>
      </form>
    </div>
  `;
  res.send(renderPage('File Uploader', body));
});

// --- THIS IS THE UPDATED SECTION ---
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.session.loggedIn) return res.redirect('/login');
  if (!req.file) return res.status(400).send('No file uploaded.');

  const fileUrl = `${req.protocol}://${req.get('host')}/file/${req.file.filename}`;
  sendToDiscord(`📤 **${req.session.username}** uploaded a file:\n${fileUrl}`);
  
  const body = `
    <div class="card">
      <h2>✅ File Uploaded</h2>
      <p style="word-break: break-all;">
        <a href="${fileUrl}" target="_blank">${fileUrl}</a>
      </p>
      
      <!-- 1. The button is added here -->
      <button id="copy-btn" onclick="copyToClipboard('${fileUrl}')">Copy Link</button>
      
      <br><br>
      <a href="/">Upload another</a>
    </div>

    <!-- 2. The script is added here -->
    <script>
      function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
          // Change button text for user feedback instead of an alert
          const copyBtn = document.getElementById('copy-btn');
          const originalText = copyBtn.innerText;
          copyBtn.innerText = 'Copied!';
          setTimeout(() => {
            copyBtn.innerText = originalText;
          }, 2000); // Change back after 2 seconds
        }).catch(err => {
          console.error('Failed to copy: ', err);
        });
      }
    </script>
  `;
  res.send(renderPage('Uploaded', body));
});


// --- Start Server ---
app.listen(PORT, () => {
  console.log(`🟢 Uploader running at http://localhost:${PORT}`);
});
