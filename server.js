const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/githubClone')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ DB connection error:', err));

// Schemas
const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String
});

const repoSchema = new mongoose.Schema({
  name: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  description: String,
  createdAt: { type: Date, default: Date.now }
});

const fileSchema = new mongoose.Schema({
  filename: String,
  content: Buffer,
  repo: { type: mongoose.Schema.Types.ObjectId, ref: 'Repo' },
  createdAt: { type: Date, default: Date.now }
});

// Models
const User = mongoose.model('User', userSchema);
const Repo = mongoose.model('Repo', repoSchema);
const File = mongoose.model('File', fileSchema);

// Routes
app.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  const user = new User({ username, email, password });
  await user.save();
  res.send({ message: 'User registered successfully!' });
});

app.post('/signin', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email, password });
  if (user) res.send({ message: 'Login successful', user });
  else res.status(401).send({ message: 'Invalid credentials' });
});

// Create a new repository
app.post('/repos', async (req, res) => {
  const { name, description, owner } = req.body;

  if (!name || !owner) {
    return res.status(400).json({ message: 'Repository name and owner are required.' });
  }

  const repo = new Repo({ name, description, owner });
  await repo.save();
  res.json({ message: 'Repository created successfully!', repo });
});

// Get all repos for a user
app.get('/repos/:userId', async (req, res) => {
  const { userId } = req.params;
  const repos = await Repo.find({ owner: userId });
  res.json(repos);
});

// Create a new file in a repo
app.post('/files', async (req, res) => {
  const { filename, content, repoId } = req.body;

  if (!filename || !repoId) {
    return res.status(400).json({ message: 'Filename and repoId required.' });
  }

  const file = new File({ filename, content, repo: repoId });
  await file.save();
  res.json({ message: 'File created successfully!', file });
});

// Get all files in a repo
// Make sure you have this exact route in server.js
app.get('/files/:repoId', async (req, res) => {
  try {
    const { repoId } = req.params;
    const files = await File.find({ repo: repoId });
    res.json(files);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});


const multer = require('multer');

// Use memory storage so we can store file in MongoDB
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload file to a repo
app.post('/uploadFile', upload.single('file'), async (req, res) => {
  const { repoId } = req.body;
  console.log(repoId);
  if (!repoId || !req.file) {
    return res.status(400).json({ message: 'Repository and file are required' });
  }

  const file = new File({
    filename: req.file.originalname,
    content: req.file.buffer, // convert buffer to string
    repo: repoId
  });

  await file.save();
  res.json({ message: 'File uploaded successfully!',  fileId: file._id});
});


// Start server
app.listen(5000, () => console.log('🚀 Server running on port 5000'));
