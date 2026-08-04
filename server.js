const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nudgeai';
mongoose.connect(MONGODB_URI)
  .then(() => console.log(`[MONGODB] Connected to database: ${MONGODB_URI}`))
  .catch(err => {
    console.error(`[MONGODB ERROR] Connection failed:`, err);
    console.log('[MONGODB] Running without database persistence if MongoDB isn\'t started.');
  });

// Define Mongoose Schemas
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  role: { type: String, default: 'Student / Freelancer', trim: true },
  password: { type: String, trim: true }
});

const TaskSchema = new mongoose.Schema({
  id: { type: String, required: true },
  userEmail: { type: String, required: true, lowercase: true, trim: true },
  title: { type: String, required: true, trim: true },
  deadlineHours: { type: Number, default: 24 },
  duration: { type: Number, default: 2 },
  dependency: { type: String, default: '' },
  goalCategory: { type: String, default: 'General' },
  autoExecute: { type: Boolean, default: false },
  completed: { type: Boolean, default: false },
  score: { type: Number, default: 50 },
  progress: { type: Number, default: 0 },
  dueDate: { type: Number }
});

const CalendarBlockSchema = new mongoose.Schema({
  id: { type: String, required: true },
  userEmail: { type: String, required: true, lowercase: true, trim: true },
  title: { type: String, required: true, trim: true },
  startHour: { type: Number, required: true },
  duration: { type: Number, required: true },
  day: { type: String, required: true },
  type: { type: String, required: true },
  completed: { type: Boolean, default: false }
});

const GoalSchema = new mongoose.Schema({
  id: { type: String, required: true },
  userEmail: { type: String, required: true, lowercase: true, trim: true },
  title: { type: String, required: true, trim: true },
  type: { type: String, required: true },
  target: { type: String, required: true },
  streak: { type: Number, default: 0 },
  subtasks: { type: [String], default: [] },
  progress: { type: Number, default: 0 }
});

const NudgeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  userEmail: { type: String, required: true, lowercase: true, trim: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  actionLabel: { type: String, required: true },
  actionType: { type: String, required: true }
});

const User = mongoose.model('User', UserSchema);
const Task = mongoose.model('Task', TaskSchema);
const CalendarBlock = mongoose.model('CalendarBlock', CalendarBlockSchema);
const Goal = mongoose.model('Goal', GoalSchema);
const Nudge = mongoose.model('Nudge', NudgeSchema);

// Initial Seed Data for New Users (Empty to start with a clean slate)
const defaultTasks = [];
const defaultCalendarBlocks = [];
const defaultNudges = [];
const defaultGoals = [];

// Helper function to seed user data if it doesn't exist
async function seedUserData(email) {
  try {
    // Delete any old default seeded items to clean up existing databases
    await Task.deleteMany({ id: { $in: ["task-1", "task-2", "task-3"] } });
    await CalendarBlock.deleteMany({ id: { $in: ["cal-1", "cal-2", "cal-3", "cal-4"] } });
    await Nudge.deleteMany({ id: { $in: ["nudge-1", "nudge-2", "nudge-3"] } });
    await Goal.deleteMany({ id: { $in: ["goal-1", "goal-2"] } });

    const tasksCount = await Task.countDocuments({ userEmail: email });
    if (tasksCount === 0 && defaultTasks.length > 0) {
      const tasksToInsert = defaultTasks.map(t => ({
        ...t,
        userEmail: email,
        dueDate: Date.now() + (t.deadlineHours * 60 * 60 * 1000)
      }));
      await Task.insertMany(tasksToInsert);
      console.log(`[SEED] Tasks seeded for user: ${email}`);
    }

    const calCount = await CalendarBlock.countDocuments({ userEmail: email });
    if (calCount === 0 && defaultCalendarBlocks.length > 0) {
      const calToInsert = defaultCalendarBlocks.map(c => ({ ...c, userEmail: email }));
      await CalendarBlock.insertMany(calToInsert);
      console.log(`[SEED] Calendar blocks seeded for user: ${email}`);
    }

    const nudgesCount = await Nudge.countDocuments({ userEmail: email });
    if (nudgesCount === 0 && defaultNudges.length > 0) {
      const nudgesToInsert = defaultNudges.map(n => ({ ...n, userEmail: email }));
      await Nudge.insertMany(nudgesToInsert);
      console.log(`[SEED] Nudges seeded for user: ${email}`);
    }

    const goalsCount = await Goal.countDocuments({ userEmail: email });
    if (goalsCount === 0 && defaultGoals.length > 0) {
      const goalsToInsert = defaultGoals.map(g => ({ ...g, userEmail: email }));
      await Goal.insertMany(goalsToInsert);
      console.log(`[SEED] Goals seeded for user: ${email}`);
    }
  } catch (err) {
    console.error(`[SEED ERROR] Failed to seed user data for ${email}:`, err);
  }
}

const crypto = require('crypto');

function hashPassword(password) {
  if (!password) return '';
  return crypto.createHash('sha256').update(password).digest('hex');
}

// API Signup
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanName = name.trim();
  
  try {
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    const hashedPassword = hashPassword(password);
    const user = new User({
      email: cleanEmail,
      name: cleanName,
      password: hashedPassword
    });
    
    await user.save();
    await seedUserData(cleanEmail);
    res.status(200).json({ success: true, user });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

// API Login
app.post('/api/auth/login', async (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) {
    return res.status(400).json({ error: 'Name and password are required.' });
  }

  const cleanName = name.trim();
  
  try {
    const user = await User.findOne({ name: cleanName });
    if (!user) {
      return res.status(400).json({ error: 'User not found.' });
    }

    const hashedPassword = hashPassword(password);
    if (user.password !== hashedPassword) {
      return res.status(400).json({ error: 'Incorrect password.' });
    }

    res.status(200).json({ success: true, user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Authentication failed.' });
  }
});

// API Verify Forgot
app.post('/api/auth/verify-forgot', async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanName = name.trim();

  try {
    const user = await User.findOne({ name: cleanName, email: cleanEmail });
    if (!user) {
      return res.status(400).json({ error: 'Name and Email combination not found.' });
    }

    res.status(200).json({ success: true, email: cleanEmail });
  } catch (err) {
    console.error('Verify forgot error:', err);
    res.status(500).json({ error: 'Verification failed.' });
  }
});

// API Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and new password are required.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const hashedPassword = hashPassword(password);

  try {
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(400).json({ error: 'User not found.' });
    }

    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// API Direct Login (Auto sign in or sign up)
app.post('/api/auth/direct-login', async (req, res) => {
  const { email, name, role } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }
  
  const cleanEmail = email.toLowerCase().trim();
  try {
    let user = await User.findOne({ email: cleanEmail });
    if (!user) {
      user = new User({ email: cleanEmail, name: name || "Alex Newman", role: role || "Student / Freelancer" });
      await user.save();
    }
    await seedUserData(cleanEmail);
    res.status(200).json({ success: true, user });
  } catch (err) {
    console.error('Direct login error:', err);
    res.status(500).json({ error: 'Authentication failed.' });
  }
});

// API Fetch All Data for a User
app.get('/api/users/:email/data', async (req, res) => {
  const email = req.params.email.toLowerCase().trim();
  try {
    const tasks = await Task.find({ userEmail: email });
    const calendarBlocks = await CalendarBlock.find({ userEmail: email });
    const goals = await Goal.find({ userEmail: email });
    const nudges = await Nudge.find({ userEmail: email });
    res.json({ tasks, calendarBlocks, goals, nudges });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve user data.' });
  }
});

// Tasks CRUD API
app.post('/api/users/:email/tasks', async (req, res) => {
  const email = req.params.email.toLowerCase().trim();
  try {
    const task = new Task({ ...req.body, userEmail: email });
    await task.save();
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:email/tasks/:id', async (req, res) => {
  const email = req.params.email.toLowerCase().trim();
  const id = req.params.id;
  try {
    const task = await Task.findOneAndUpdate({ id, userEmail: email }, req.body, { new: true });
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:email/tasks/:id', async (req, res) => {
  const email = req.params.email.toLowerCase().trim();
  const id = req.params.id;
  try {
    const task = await Task.findOneAndDelete({ id, userEmail: email });
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Calendar CRUD API
app.post('/api/users/:email/calendar', async (req, res) => {
  const email = req.params.email.toLowerCase().trim();
  try {
    const block = new CalendarBlock({ ...req.body, userEmail: email });
    await block.save();
    res.status(201).json(block);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:email/calendar/:id', async (req, res) => {
  const email = req.params.email.toLowerCase().trim();
  const id = req.params.id;
  try {
    const block = await CalendarBlock.findOneAndUpdate({ id, userEmail: email }, req.body, { new: true });
    if (!block) return res.status(404).json({ error: 'Calendar block not found.' });
    res.json(block);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:email/calendar/:id', async (req, res) => {
  const email = req.params.email.toLowerCase().trim();
  const id = req.params.id;
  try {
    const block = await CalendarBlock.findOneAndDelete({ id, userEmail: email });
    if (!block) return res.status(404).json({ error: 'Calendar block not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Goals CRUD API
app.post('/api/users/:email/goals', async (req, res) => {
  const email = req.params.email.toLowerCase().trim();
  try {
    const goal = new Goal({ ...req.body, userEmail: email });
    await goal.save();
    res.status(201).json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:email/goals/:id', async (req, res) => {
  const email = req.params.email.toLowerCase().trim();
  const id = req.params.id;
  try {
    const goal = await Goal.findOneAndUpdate({ id, userEmail: email }, req.body, { new: true });
    if (!goal) return res.status(404).json({ error: 'Goal not found.' });
    res.json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Nudges CRUD API
app.post('/api/users/:email/nudges', async (req, res) => {
  const email = req.params.email.toLowerCase().trim();
  try {
    const nudge = new Nudge({ ...req.body, userEmail: email });
    await nudge.save();
    res.status(201).json(nudge);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:email/nudges/:id', async (req, res) => {
  const email = req.params.email.toLowerCase().trim();
  const id = req.params.id;
  try {
    const nudge = await Nudge.findOneAndDelete({ id, userEmail: email });
    if (!nudge) return res.status(404).json({ error: 'Nudge not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve static dashboard files
app.use(express.static(path.join(__dirname, 'public')));





// Start listening
app.listen(PORT, () => {
  console.log(`[SERVER] NudgeAI backend server running on http://localhost:${PORT}`);
});
