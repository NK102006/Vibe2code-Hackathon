const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'nudgeai-hackathon-super-secret-key-12345';

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname)));

// Initialize database schema on start
db.initializeSchema()
  .then(() => console.log('Database tables successfully initialized.'))
  .catch(err => console.error('Database tables initialization error:', err));

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
}

// Default seed helper
async function seedUserData(userId) {
  const defaultTasks = [
    [`task-1-${userId}`, userId, 'Research Paper Draft', 14, 3.0, 'Literature Review', 'Academic', 1, 0, 92, 40],
    [`task-2-${userId}`, userId, 'Prep Interview Answers', 36, 2.0, '', 'Career', 1, 0, 74, 0],
    [`task-3-${userId}`, userId, 'Gym Session', 8, 1.5, '', 'Personal', 0, 0, 45, 0]
  ];

  const defaultCalBlocks = [
    [`cal-1-${userId}`, userId, 'Weekly Status Sync (Fixed)', 9, 1.0, 'today', 'fixed', 0],
    [`cal-2-${userId}`, userId, 'Research Paper Draft (Suggested)', 11, 2.0, 'today', 'suggested', 0],
    [`cal-3-${userId}`, userId, 'Gym Session (Conflict Event)', 18, 1.5, 'today', 'fixed', 0],
    [`cal-4-${userId}`, userId, 'Mock Interview (Fixed)', 10, 1.5, 'tomorrow', 'fixed', 0]
  ];

  const defaultGoals = [
    [`goal-1-${userId}`, userId, 'Apply to 5 jobs a week', 'Habit', '5 times/week', 4, JSON.stringify(['Tailor resume', 'Submit LinkedIn apps', 'Follow up emails']), 80],
    [`goal-2-${userId}`, userId, 'Finish Thesis Outline', 'Milestone', 'Due Dec 15', 0, JSON.stringify(['Intro draft', 'Methodology chapter', 'Bibliography list']), 30]
  ];

  // Insert Seed Tasks
  for (const task of defaultTasks) {
    await db.query(
      `INSERT INTO tasks (id, user_id, title, deadline_hours, duration, dependency, goal_category, auto_execute, completed, score, progress) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      task
    );
  }

  // Insert Seed Calendar Blocks
  for (const block of defaultCalBlocks) {
    await db.query(
      `INSERT INTO calendar_blocks (id, user_id, title, start_hour, duration, day, type, completed) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      block
    );
  }

  // Insert Seed Goals
  for (const goal of defaultGoals) {
    await db.query(
      `INSERT INTO goals (id, user_id, title, type, target, streak, subtasks, progress) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      goal
    );
  }

  // Log seed activity
  await db.query(
    `INSERT INTO user_activities (user_id, activity_type, description) VALUES ($1, $2, $3)`,
    [userId, 'auth', 'Default workspace data seeded successfully.']
  );
}

// ----------------------------------------------------
// AUTH ENDPOINTS
// ----------------------------------------------------

// Register
app.post('/api/auth/register', async (req, res) => {
  const { username, password, fullName, role } = req.body;
  if (!username || !password || !fullName || !role) {
    return res.status(400).json({ error: 'Please provide all user details.' });
  }

  try {
    // Check if username already exists
    const userCheck = await db.query('SELECT username FROM users WHERE username = $1', [username]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert user
    const registerResult = await db.query(
      `INSERT INTO users (username, password, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id`,
      [username, hashedPassword, fullName, role]
    );

    const userId = registerResult.insertId || (registerResult.rows[0] && registerResult.rows[0].id);

    // Seed default tasks/goals/calendar
    await seedUserData(userId);

    // Log Registration
    await db.query(`INSERT INTO user_activities (user_id, activity_type, description) VALUES ($1, $2, $3)`,
      [userId, 'auth', 'User registered account.']
    );

    const token = jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({
      token,
      user: { id: userId, username, fullName, role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Please enter username and password.' });
  }

  try {
    const userResult = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = userResult.rows[0];
    if (!user) return res.status(400).json({ error: 'Invalid username or password.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid username or password.' });

    // Log Login
    await db.query(`INSERT INTO user_activities (user_id, activity_type, description) VALUES ($1, $2, $3)`,
      [user.id, 'auth', 'User logged in successfully.']
    );

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({
      token,
      user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get profile
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const userResult = await db.query('SELECT id, username, full_name, role FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });

    res.json({
      user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// TASKS ENDPOINTS
// ----------------------------------------------------

// Get tasks
app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const rowsResult = await db.query('SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    
    const tasks = rowsResult.rows.map(row => ({
      id: row.id,
      title: row.title,
      deadlineHours: row.deadline_hours,
      duration: row.duration,
      dependency: row.dependency,
      goalCategory: row.goal_category,
      autoExecute: !!row.auto_execute,
      completed: !!row.completed,
      score: row.score,
      progress: row.progress
    }));
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add task
app.post('/api/tasks', authenticateToken, async (req, res) => {
  const { id, title, deadlineHours, duration, dependency, goalCategory, autoExecute } = req.body;
  if (!title) return res.status(400).json({ error: 'Task title is required.' });

  try {
    const completed = 0;
    const progress = 0;
    const score = 50;

    await db.query(
      `INSERT INTO tasks (id, user_id, title, deadline_hours, duration, dependency, goal_category, auto_execute, completed, score, progress) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, req.user.id, title, deadlineHours, duration, dependency, goalCategory, autoExecute ? 1 : 0, completed, score, progress]
    );

    // Log task creation
    await db.query(`INSERT INTO user_activities (user_id, activity_type, description) VALUES ($1, $2, $3)`,
      [req.user.id, 'task_create', `Created task: "${title}"`]
    );

    res.status(201).json({ id, title, deadlineHours, duration, dependency, goalCategory, autoExecute, completed: false, score, progress });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update task completion
app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
  const { completed } = req.body;
  const taskId = req.params.id;

  try {
    // Find task title first to create log entry
    const taskResult = await db.query('SELECT title, completed FROM tasks WHERE id = $1 AND user_id = $2', [taskId, req.user.id]);
    const task = taskResult.rows[0];
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    const newCompleted = completed ? 1 : 0;
    
    await db.query(
      'UPDATE tasks SET completed = $1 WHERE id = $2 AND user_id = $3',
      [newCompleted, taskId, req.user.id]
    );

    const actionText = completed ? 'Completed' : 'Re-opened';
    const logType = completed ? 'task_complete' : 'task_reopen';

    // Log task update
    await db.query(
      `INSERT INTO user_activities (user_id, activity_type, description) VALUES ($1, $2, $3)`,
      [req.user.id, logType, `${actionText} task: "${task.title}"`]
    );

    res.json({ message: 'Task updated successfully', completed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// CALENDAR ENDPOINTS
// ----------------------------------------------------

app.get('/api/calendar', authenticateToken, async (req, res) => {
  try {
    const calendarResult = await db.query('SELECT * FROM calendar_blocks WHERE user_id = $1', [req.user.id]);
    
    const blocks = calendarResult.rows.map(row => ({
      id: row.id,
      title: row.title,
      startHour: row.start_hour,
      duration: row.duration,
      day: row.day,
      type: row.type,
      completed: !!row.completed
    }));
    res.json(blocks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/calendar', authenticateToken, async (req, res) => {
  const { id, title, startHour, duration, day, type } = req.body;
  
  try {
    await db.query(
      `INSERT INTO calendar_blocks (id, user_id, title, start_hour, duration, day, type, completed) VALUES ($1, $2, $3, $4, $5, $6, $7, 0)`,
      [id, req.user.id, title, startHour, duration, day, type]
    );
    res.status(201).json({ id, title, startHour, duration, day, type, completed: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/calendar/:id', authenticateToken, async (req, res) => {
  const { completed, type } = req.body;
  const calId = req.params.id;

  try {
    await db.query(
      'UPDATE calendar_blocks SET completed = $1, type = $2 WHERE id = $3 AND user_id = $4',
      [completed ? 1 : 0, type, calId, req.user.id]
    );
    res.json({ message: 'Calendar event updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// GOALS ENDPOINTS
// ----------------------------------------------------

app.get('/api/goals', authenticateToken, async (req, res) => {
  try {
    const goalsResult = await db.query('SELECT * FROM goals WHERE user_id = $1', [req.user.id]);
    
    const goals = goalsResult.rows.map(row => ({
      id: row.id,
      title: row.title,
      type: row.type,
      target: row.target,
      streak: row.streak,
      subtasks: JSON.parse(row.subtasks || '[]'),
      progress: row.progress
    }));
    res.json(goals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/goals', authenticateToken, async (req, res) => {
  const { id, title, type, target } = req.body;
  const subtasks = type === 'Habit' 
    ? ['Complete routine tracker'] 
    : ['Initialize milestone roadmap'];
  const progress = 0;
  const streak = 0;

  try {
    await db.query(
      `INSERT INTO goals (id, user_id, title, type, target, streak, subtasks, progress) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, req.user.id, title, type, target, streak, JSON.stringify(subtasks), progress]
    );

    // Log goal creation
    await db.query(
      `INSERT INTO user_activities (user_id, activity_type, description) VALUES ($1, $2, $3)`,
      [req.user.id, 'goal_create', `Created long-term goal: "${title}"`]
    );

    res.status(201).json({ id, title, type, target, streak, subtasks, progress });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// ACTIVITY LOG ENDPOINTS
// ----------------------------------------------------

// Get user activities
app.get('/api/activities', authenticateToken, async (req, res) => {
  try {
    const activitiesResult = await db.query(
      'SELECT * FROM user_activities WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 50',
      [req.user.id]
    );
    
    const mapped = activitiesResult.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      activity_type: row.activity_type,
      description: row.description,
      timestamp: row.timestamp
    }));
    
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear user activities
app.delete('/api/activities', authenticateToken, async (req, res) => {
  try {
    await db.query('DELETE FROM user_activities WHERE user_id = $1', [req.user.id]);
    
    // Log clearing action itself (fresh new activity start)
    await db.query(
      `INSERT INTO user_activities (user_id, activity_type, description) VALUES ($1, $2, $3)`,
      [req.user.id, 'auth', 'Cleared activity log history.']
    );

    res.json({ message: 'Activity log cleared successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
