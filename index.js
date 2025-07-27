// index.js
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

// --- Basic Setup ---
const app = express();
const PORT = process.env.PORT || 6501;
const uploadFolder = path.join(__dirname, 'uploads');

// --- Secrets from .env file ---
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const SESSION_SECRET = process.env.SESSION_SECRET;

// --- PLAIN TEXT PASSWORDS (Insecure) ---
const USERS = {
  winter: 'g',
  enzo:   'balls',
  josh:   'polish'
};

if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder);

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
  cookie: { secure: false }
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

const renderPage = (title, bodyContent, extraScript = '') => `
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
          fpsLimit: 60, particles: { number: { value: 80, density: { enable: true, value_area: 800 } }, color: { value: "#9b59b6" }, shape: { type: "circle" }, opacity: { value: 0.5, random: true }, size: { value: 3, random: { enable: true, minimumValue: 1 } }, move: { enable: true, speed: 1, direction: "none", out_mode: "out" }, line_linked: { enable: true, distance: 150, color: "#8e44ad", opacity: 0.4, width: 1 } }, interactivity: { events: { onhover: { enable: true, mode: "grab" }, onclick: { enable: true, mode: "push" } }, modes: { grab: { distance: 140, line_opacity: 1 }, push: { particles_nb: 4 } } }, retina_detect: true
        });
      </script>
      ${extraScript}
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
        <input name="username" type="text" placeholder="Username" required>
        <input name="password" type="password" placeholder="Password" required>
        <button type="submit">Login</button>
      </form>
    </div>
  `;
  res.send(renderPage('Login', body));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const storedPassword = USERS[username];
  if (storedPassword && password === storedPassword) {
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
      <p class="user-info">Logged in as <b>${req.session.username}</b> | <a href="/logout">Logout</a></p>
      
      <form id="upload-form">
        <div class="file-input-wrapper">
          <input type="file" name="file" id="file-input" class="file-input-hidden" required />
          <label for="file-input" class="file-input-label">Choose a File</label>
          <span class="file-name">No file chosen</span>
        </div>
        <button type="submit" id="upload-btn">Upload</button>
      </form>

      <div class="progress-container">
        <div class="progress-bar"></div>
        <div class="progress-text">0%</div>
      </div>
    </div>
  `;

  const uploadScript = `
    <script>
      const form = document.getElementById('upload-form');
      const fileInput = document.getElementById('file-input');
      const uploadBtn = document.getElementById('upload-btn');
      const fileNameSpan = document.querySelector('.file-name');
      const progressContainer = document.querySelector('.progress-container');
      const progressBar = document.querySelector('.progress-bar');
      const progressText = document.querySelector('.progress-text');

      fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
          fileNameSpan.textContent = fileInput.files[0].name;
        } else {
          fileNameSpan.textContent = 'No file chosen';
        }
      });

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const file = fileInput.files[0];
        if (!file) return;

        progressContainer.style.display = 'block';
        uploadBtn.disabled = true;
        uploadBtn.innerText = 'Uploading...';

        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/upload', true);

        xhr.upload.onprogress = function(event) {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            progressBar.style.width = percentComplete + '%';
            progressText.textContent = percentComplete + '%';
          }
        };

        xhr.onload = function() {
          if (xhr.status === 200) {
            document.documentElement.innerHTML = xhr.responseText;
          } else {
            alert('Upload failed. Please try again.');
            uploadBtn.disabled = false;
            uploadBtn.innerText = 'Upload';
            progressContainer.style.display = 'none';
          }
        };
        
        xhr.onerror = function() {
            alert('An error occurred during the upload. Please try again.');
            uploadBtn.disabled = false;
            uploadBtn.innerText = 'Upload';
            progressContainer.style.display = 'none';
        };

        xhr.send(formData);
      });
    </script>
  `;
  res.send(renderPage('File Uploader', body, uploadScript));
});

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.session.loggedIn) return res.status(401).send('Not authorized');
  if (!req.file) return res.status(400).send('No file uploaded.');

  const fileUrl = `${req.protocol}://${req.get('host')}/file/${req.file.filename}`;
  sendToDiscord(`📤 **${req.session.username}** uploaded a file:\n${fileUrl}`);
  
  const body = `
    <div class="card">
      <h2>✅ File Uploaded</h2>
      <p style="word-break: break-all;">
        <a href="${fileUrl}" target="_blank">${fileUrl}</a>
      </p>
      <button id="copy-btn" onclick="copyToClipboard('${fileUrl}')">Copy Link</button>
      <br><br>
      <a href="/">Upload another</a>
    </div>
  `;
  
  const copyScript = `
    <script>
      function copyToClipboard(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        
        const btn = document.getElementById('copy-btn');
        btn.innerText = 'Copied!';
        setTimeout(() => { btn.innerText = 'Copy Link'; }, 2000);
      }
    </script>
  `;

  res.send(renderPage('Uploaded', body, copyScript));
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`🟢 Uploader running at http://localhost:${PORT}`);
});