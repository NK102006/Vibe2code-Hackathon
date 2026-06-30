// NudgeAI Core Application Logic

// Initial Application State
let tasks = [
  {
    id: "task-1",
    title: "Research Paper Draft",
    deadlineHours: 14,
    duration: 3,
    dependency: "Literature Review",
    goalCategory: "Academic",
    autoExecute: true,
    completed: false,
    score: 92,
    progress: 40
  },
  {
    id: "task-2",
    title: "Prep Interview Answers",
    deadlineHours: 36,
    duration: 2,
    dependency: "",
    goalCategory: "Career",
    autoExecute: true,
    completed: false,
    score: 74,
    progress: 0
  },
  {
    id: "task-3",
    title: "Gym Session",
    deadlineHours: 8,
    duration: 1.5,
    dependency: "",
    goalCategory: "Personal",
    autoExecute: false,
    completed: false,
    score: 45,
    progress: 0
  }
];

let calendarBlocks = [
  {
    id: "cal-1",
    title: "Weekly Status Sync (Fixed)",
    startHour: 9, // 9:00 AM
    duration: 1.0,
    day: "today",
    type: "fixed",
    completed: false
  },
  {
    id: "cal-2",
    title: "Research Paper Draft (Suggested)",
    startHour: 11, // 11:00 AM
    duration: 2.0,
    day: "today",
    type: "suggested",
    completed: false
  },
  {
    id: "cal-3",
    title: "Gym Session (Conflict Event)",
    startHour: 18, // 6:00 PM
    duration: 1.5,
    day: "today",
    type: "fixed",
    completed: false
  },
  {
    id: "cal-4",
    title: "Mock Interview (Fixed)",
    startHour: 10, // 10:00 AM
    duration: 1.5,
    day: "tomorrow",
    type: "fixed",
    completed: false
  }
];

let nudges = [
  {
    id: "nudge-1",
    type: "urgent",
    title: "Urgency Escalation",
    message: "Research Paper Draft is due in 14 hours. Only 40% complete. Let's schedule a 2-hour focus block now.",
    actionLabel: "Schedule Block",
    actionType: "schedule_research"
  },
  {
    id: "nudge-2",
    type: "action",
    title: "Autonomous Action Pending",
    message: "Based on your procrastination risk, I pre-drafted an email to Professor Jones requesting a 24h extension.",
    actionLabel: "Review Draft",
    actionType: "view_email_draft"
  },
  {
    id: "nudge-3",
    type: "suggested",
    title: "Calendar Conflict Detected",
    message: "Gym Session at 6 PM conflicts with Essay Outline block. Move Gym to 7:30 PM to resolve?",
    actionLabel: "Reschedule Gym",
    actionType: "resolve_gym"
  }
];

let goals = [
  {
    id: "goal-1",
    title: "Apply to 5 jobs a week",
    type: "Habit",
    target: "5 times/week",
    streak: 4,
    subtasks: ["Tailor resume", "Submit LinkedIn apps", "Follow up emails"],
    progress: 80
  },
  {
    id: "goal-2",
    title: "Finish Thesis Outline",
    type: "Milestone",
    target: "Due Dec 15",
    streak: 0,
    subtasks: ["Intro draft", "Methodology chapter", "Bibliography list"],
    progress: 30
  }
];

let chatHistory = [
  {
    sender: "assistant",
    text: "Hello! I am NudgeAI, your proactive companion. I've analyzed your upcoming commitments and set a focus priority score. Ask me to schedule, draft emails, or analyze deadlines."
  }
];

let simulatorStep = 0;
let activeTab = "dashboard";
let taskFilter = "all";

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  // Re-render UI elements
  renderTasks();
  renderNudges();
  renderGoals();
  renderCalendar();
  renderChat();
  
  // Initialize Lucide Icons
  lucide.createIcons();
  
  // Set Calendar Dates
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  const options = { month: 'short', day: 'numeric' };
  document.getElementById("calendar-today-date").innerText = today.toLocaleDateString('en-US', options);
  document.getElementById("calendar-tomorrow-date").innerText = tomorrow.toLocaleDateString('en-US', options);
  
  // Seed initial task select dependencies
  updateDependencyDropdown();
});

// Switch Dashboard Tab Views
function switchTab(tabId) {
  activeTab = tabId;
  
  // Update nav UI active class
  document.querySelectorAll(".nav-item").forEach(btn => btn.classList.remove("active"));
  document.getElementById(`nav-${tabId}`).classList.add("active");
  
  // Update content active class
  document.querySelectorAll(".tab-view").forEach(view => view.classList.remove("active"));
  document.getElementById(`view-${tabId}`).classList.add("active");
  
  // Set headers
  const titleMap = {
    dashboard: "Dashboard Overview",
    calendar: "Smart Scheduling & Conflicts",
    goals: "Habits & Streaks Tracker",
    chat: "Conversational AI Companion",
    simulator: "Agentic Workflow Simulator"
  };
  
  const subtitleMap = {
    dashboard: "Proactively guiding your productivity today.",
    calendar: "Visualizing scheduled blocks, suggested AI sessions, and dynamic conflict resolutions.",
    goals: "Reinforcing positive habits and long-term milestones.",
    chat: "Chat with your advisor to query tasks, authorize actions, and handle scheduling.",
    simulator: "Trace NudgeAI's automated pipeline in a high-urgency scenario."
  };
  
  document.getElementById("view-title").innerText = titleMap[tabId];
  document.getElementById("view-subtitle").innerText = subtitleMap[tabId];
  
  // Refresh page visual styles or charts
  if (tabId === "calendar") renderCalendar();
  if (tabId === "dashboard") {
    renderTasks();
    renderNudges();
  }
  if (tabId === "goals") renderGoals();
  
  // Dismiss badge if entering chat
  if (tabId === "chat") {
    document.getElementById("chat-badge").style.display = "none";
  }
  
  // Refresh icons
  lucide.createIcons();
}

// ----------------------------------------------------
// DYNAMIC PRIORITY ENGINE
// ----------------------------------------------------
function calculateAIScore(task) {
  // AI score logic: combination of:
  // 1. Deadline proximity (urgency): 0 hrs -> 100 points, 72+ hrs -> 0 points
  const urgencyWeight = 0.4;
  const deadlineScore = Math.max(0, 100 - (task.deadlineHours * 1.5));
  
  // 2. Estimated Duration (effort weight)
  const effortWeight = 0.3;
  const durationScore = Math.min(100, task.duration * 12);
  
  // 3. Dependencies weight (if another task depends on it)
  const dependencyWeight = 0.3;
  const dependencyScore = task.dependency ? 80 : 20;
  
  let totalScore = (deadlineScore * urgencyWeight) + (durationScore * effortWeight) + (dependencyScore * dependencyWeight);
  
  // Adjust based on category focus
  if (task.goalCategory === "Academic") totalScore += 5;
  if (task.goalCategory === "Career") totalScore += 10;
  
  // Cap between 0 and 99
  return Math.min(99, Math.max(10, Math.round(totalScore)));
}

function updateAllPriorities() {
  tasks.forEach(t => {
    if (!t.completed) {
      t.score = calculateAIScore(t);
    }
  });
  // Sort tasks in descending order of AI score
  tasks.sort((a, b) => {
    if (a.completed && !b.completed) return 1;
    if (!a.completed && b.completed) return -1;
    return b.score - a.score;
  });
}

// ----------------------------------------------------
// TASK LIST MANAGEMENT
// ----------------------------------------------------
function renderTasks() {
  updateAllPriorities();
  const taskListContainer = document.getElementById("dashboard-task-list");
  taskListContainer.innerHTML = "";
  
  let filtered = tasks;
  if (taskFilter === "pending") {
    filtered = tasks.filter(t => !t.completed);
  } else if (taskFilter === "completed") {
    filtered = tasks.filter(t => t.completed);
  }
  
  if (filtered.length === 0) {
    taskListContainer.innerHTML = `
      <div class="empty-state">
        <i data-lucide="check-circle" style="width: 48px; height: 48px; color: var(--text-muted);"></i>
        <p>No tasks found in this view. Add one to see AI prioritization!</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }
  
  filtered.forEach(task => {
    const isCompletedClass = task.completed ? "completed" : "";
    const isChecked = task.completed ? "checked" : "";
    const checkboxIcon = task.completed ? '<i data-lucide="check"></i>' : '';
    
    // Check for dependency styling
    const depPill = task.dependency ? `<span class="pill-dependency">Blocked by: ${task.dependency}</span>` : "";
    
    const taskItem = document.createElement("div");
    taskItem.className = `task-item ${isCompletedClass}`;
    taskItem.setAttribute("data-id", task.id);
    taskItem.innerHTML = `
      <button class="checkbox-btn ${isChecked}" onclick="toggleTaskCompletion('${task.id}')">
        ${checkboxIcon}
      </button>
      <div class="task-details">
        <span class="task-title">${task.title}</span>
        <div class="task-meta">
          <span class="task-meta-item meta-urgency">
            <i data-lucide="clock"></i>
            <span>Due in ${task.deadlineHours}h</span>
          </span>
          <span class="task-meta-item meta-duration">
            <i data-lucide="hourglass"></i>
            <span>Est. ${task.duration}h</span>
          </span>
          <div class="task-pills">
            <span class="pill-category">${task.goalCategory}</span>
            ${depPill}
          </div>
        </div>
      </div>
      <div class="task-score">
        <span class="score-number">${task.completed ? '-' : task.score}</span>
        <span class="score-label">AI PRIORITY</span>
      </div>
    `;
    taskListContainer.appendChild(taskItem);
  });
  
  lucide.createIcons();
}

function filterTasks(type) {
  taskFilter = type;
  document.querySelectorAll(".filter-chip").forEach(chip => chip.classList.remove("active"));
  document.getElementById(`filter-${type}`).classList.add("active");
  renderTasks();
}

function toggleTaskCompletion(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    task.completed = !task.completed;
    
    // Toggle matching calendar blocks completion
    calendarBlocks.forEach(block => {
      if (block.title.includes(task.title)) {
        block.completed = task.completed;
        block.type = task.completed ? "completed" : "suggested";
      }
    });
    
    showToast(task.completed ? `Completed task: ${task.title}` : `Re-opened task: ${task.title}`, "success");
    renderTasks();
    renderCalendar();
  }
}

// Add task modals
function openAddTaskModal() {
  document.getElementById("add-task-modal").classList.add("active");
}

function closeAddTaskModal() {
  document.getElementById("add-task-modal").classList.remove("active");
}

function updateDependencyDropdown() {
  const select = document.getElementById("task-dependency");
  select.innerHTML = '<option value="">None</option>';
  tasks.forEach(t => {
    if (!t.completed) {
      const opt = document.createElement("option");
      opt.value = t.title;
      opt.innerText = t.title;
      select.appendChild(opt);
    }
  });
}

function submitAddTask() {
  const title = document.getElementById("task-title").value.trim();
  const deadlineHours = parseInt(document.getElementById("task-deadline").value);
  const duration = parseFloat(document.getElementById("task-duration").value);
  const dependency = document.getElementById("task-dependency").value;
  const goalCategory = document.getElementById("task-goal-category").value;
  const autoExecute = document.getElementById("task-auto-execute").checked;
  
  if (!title) {
    showToast("Please enter a task name.", "warning");
    return;
  }
  
  const newTask = {
    id: `task-${Date.now()}`,
    title,
    deadlineHours,
    duration,
    dependency,
    goalCategory,
    autoExecute,
    completed: false,
    score: 50,
    progress: 0
  };
  
  tasks.push(newTask);
  closeAddTaskModal();
  
  // Proactively suggest calendar block
  suggestCalendarBlockForTask(newTask);
  
  showToast(`Task "${title}" prioritized by AI!`, "success");
  
  renderTasks();
  renderCalendar();
  updateDependencyDropdown();
  
  // Reset fields
  document.getElementById("task-title").value = "";
  document.getElementById("task-deadline").value = "24";
  document.getElementById("task-duration").value = "2";
}

function suggestCalendarBlockForTask(task) {
  // Propose scheduling slots (e.g. afternoon or evening tomorrow)
  const isConflict = calendarBlocks.some(b => b.startHour === 14 && b.day === "today");
  const hour = isConflict ? 16 : 14;
  const day = task.deadlineHours < 24 ? "today" : "tomorrow";
  
  calendarBlocks.push({
    id: `cal-${Date.now()}`,
    title: `${task.title} (Suggested)`,
    startHour: hour,
    duration: task.duration,
    day: day,
    type: "suggested",
    completed: false
  });
  
  // Trigger a context aware nudge
  nudges.unshift({
    id: `nudge-${Date.now()}`,
    type: "suggested",
    title: "AI Suggested Scheduling",
    message: `Scheduled ${task.duration}h for "${task.title}" on ${day.toUpperCase()} at ${formatHour(hour)}.`,
    actionLabel: "Change Slot",
    actionType: "schedule_chat_reschedule"
  });
  renderNudges();
}

// ----------------------------------------------------
// PROACTIVE NUDGES FEED
// ----------------------------------------------------
function renderNudges() {
  const nudgeFeed = document.getElementById("dashboard-nudge-feed");
  const nudgeCount = document.getElementById("nudge-count");
  
  nudgeFeed.innerHTML = "";
  nudgeCount.innerText = nudges.length;
  
  if (nudges.length === 0) {
    nudgeFeed.innerHTML = `
      <div class="empty-state" style="padding: 24px 0;">
        <p style="font-size: 12px; color: var(--text-muted);">All nudges resolved! NudgeAI is actively monitoring.</p>
      </div>
    `;
    return;
  }
  
  nudges.forEach(n => {
    let headerClass = "suggested";
    let cardClass = "";
    if (n.type === "urgent") {
      headerClass = "urgent";
      cardClass = "nudge-urgent";
    } else if (n.type === "action") {
      headerClass = "action";
      cardClass = "nudge-action";
    }
    
    const card = document.createElement("div");
    card.className = `nudge-card ${cardClass}`;
    card.innerHTML = `
      <div class="nudge-header ${headerClass}">
        <i data-lucide="${n.type === 'urgent' ? 'alert-triangle' : n.type === 'action' ? 'mail' : 'info'}" style="width: 14px; height: 14px;"></i>
        <span>${n.title}</span>
      </div>
      <div class="nudge-body">${n.message}</div>
      <div class="nudge-actions">
        <button class="nudge-btn-approve" onclick="handleNudgeAction('${n.id}', '${n.actionType}')">${n.actionLabel}</button>
        <button class="nudge-btn-dismiss" onclick="dismissNudge('${n.id}')">Dismiss</button>
      </div>
    `;
    nudgeFeed.appendChild(card);
  });
  lucide.createIcons();
}

function dismissNudge(id) {
  nudges = nudges.filter(n => n.id !== id);
  renderNudges();
}

function handleNudgeAction(nudgeId, actionType) {
  dismissNudge(nudgeId);
  
  if (actionType === "schedule_research") {
    // Schedule a suggested block for Research Paper
    calendarBlocks.push({
      id: `cal-research-focus`,
      title: "Research Paper Draft Focus Session",
      startHour: 13, // 1:00 PM
      duration: 2.0,
      day: "today",
      type: "suggested",
      completed: false
    });
    showToast("Added Focus block to your calendar today at 1:00 PM", "success");
    renderCalendar();
  } else if (actionType === "view_email_draft") {
    // Open email draft modal
    openDraftModal();
  } else if (actionType === "resolve_gym") {
    // Reschedule Gym block automatically
    const gymBlock = calendarBlocks.find(b => b.title.includes("Gym"));
    if (gymBlock) {
      gymBlock.startHour = 19.5; // Move to 7:30 PM
      gymBlock.title = "Gym Session (Rescheduled by AI)";
      showToast("Gym Session rescheduled to 7:30 PM to resolve overlap.", "success");
      renderCalendar();
    }
  } else if (actionType === "schedule_chat_reschedule") {
    switchTab("chat");
    sendChatPrompt("I need to change the scheduled block for my new task.");
  } else if (actionType === "sim_approve_schedule") {
    runSimStep(4);
  }
}

// Email Draft Modal Logic
function openDraftModal() {
  const content = `Dear Professor Jones,

I am writing to request a short 24-hour extension on the upcoming Research Paper due to an unexpected scheduling bottleneck with multiple deadlines this week. 

I have drafted a progress outline and have already completed approximately 40% of the core content. Having an extra day would allow me to thoroughly refine the literature review and deliver a draft that meets the high standards of your course.

Thank you very much for your time and consideration.

Sincerely,
Alex Newman`;
  
  document.getElementById("draft-body-content").innerText = content;
  document.getElementById("draft-overlay").classList.add("active");
}

function closeDraftModal() {
  document.getElementById("draft-overlay").classList.remove("active");
}

function approveDraftEmail() {
  closeDraftModal();
  showToast("Email extension request sent to Prof. Jones autonomously!", "success");
  
  // Add console log if simulator is active
  if (simulatorStep >= 1) {
    logToConsole(">> [ACTION LAYER] Email extension request approved and dispatched to prof.jones@university.edu");
  }
}

// ----------------------------------------------------
// SMART CALENDAR RENDERER
// ----------------------------------------------------
function renderCalendar() {
  const slotsToday = document.getElementById("calendar-slots-today");
  const slotsTomorrow = document.getElementById("calendar-slots-tomorrow");
  
  slotsToday.innerHTML = "";
  slotsTomorrow.innerHTML = "";
  
  calendarBlocks.forEach(block => {
    const container = block.day === "today" ? slotsToday : slotsTomorrow;
    
    // Coordinate mapping: Start hour starts at 8 AM. Each hour is 60px height.
    const startOffset = block.startHour - 8;
    const topPosition = startOffset * 60;
    const heightPosition = block.duration * 60;
    
    // Check conflict (if other blocks overlap)
    let isConflict = false;
    let conflictText = "";
    calendarBlocks.forEach(other => {
      if (other.id !== block.id && other.day === block.day) {
        const startA = block.startHour;
        const endA = block.startHour + block.duration;
        const startB = other.startHour;
        const endB = other.startHour + other.duration;
        
        if (startA < endB && startB < endA) {
          isConflict = true;
        }
      }
    });
    
    if (isConflict && block.type !== "completed") {
      conflictText = `<span class="block-conflict-warn"><i data-lucide="alert-triangle" style="width: 10px; height: 10px;"></i> Conflict</span>`;
    }
    
    const blockEl = document.createElement("div");
    blockEl.className = `calendar-block type-${block.type}`;
    blockEl.style.top = `${topPosition}px`;
    blockEl.style.height = `${heightPosition}px`;
    
    blockEl.innerHTML = `
      <div>
        <div class="block-title">${block.title}</div>
        <div class="block-time">
          <i data-lucide="clock" style="width: 10px; height: 10px;"></i>
          <span>${formatHour(block.startHour)} - ${formatHour(block.startHour + block.duration)}</span>
        </div>
      </div>
      ${conflictText}
    `;
    
    // Click action: Toggle completion in calendar
    blockEl.onclick = () => {
      block.completed = !block.completed;
      block.type = block.completed ? "completed" : "suggested";
      showToast(`${block.completed ? 'Finished' : 'Rescheduled'} slot: ${block.title}`, "success");
      
      // Update tasks completed state if task title matches
      tasks.forEach(t => {
        if (block.title.includes(t.title)) {
          t.completed = block.completed;
        }
      });
      
      renderCalendar();
      renderTasks();
    };
    
    container.appendChild(blockEl);
  });
  
  lucide.createIcons();
}

function formatHour(h) {
  const isPM = h >= 12;
  let displayHour = Math.floor(h);
  if (displayHour > 12) displayHour -= 12;
  if (displayHour === 0) displayHour = 12;
  
  const minutes = Math.round((h - Math.floor(h)) * 60);
  const minText = minutes === 0 ? "" : `:${minutes.toString().padStart(2, '0')}`;
  
  return `${displayHour}${minText} ${isPM ? 'PM' : 'AM'}`;
}

// ----------------------------------------------------
// GOALS & STREAKS MANAGMENT
// ----------------------------------------------------
function renderGoals() {
  const miniList = document.getElementById("goals-mini-list");
  const fullList = document.getElementById("goals-full-list");
  
  miniList.innerHTML = "";
  fullList.innerHTML = "";
  
  // Render mini dashboard stats
  goals.slice(0, 2).forEach(g => {
    const item = document.createElement("div");
    item.className = "goal-mini-item";
    item.innerHTML = `
      <div class="goal-mini-title-row">
        <span>${g.title}</span>
        <span>${g.streak} day streak</span>
      </div>
      <div class="goal-mini-progress-bg">
        <div class="goal-mini-progress-bar" style="width: ${g.progress}%"></div>
      </div>
    `;
    miniList.appendChild(item);
  });
  
  // Render full list on goals page
  goals.forEach(g => {
    const subtaskHTML = g.subtasks.map(s => `
      <div class="subtask-item">
        <span class="subtask-bullet"></span>
        <span>${s}</span>
      </div>
    `).join("");
    
    const card = document.createElement("div");
    card.className = "goal-card";
    card.innerHTML = `
      <div class="goal-card-header">
        <div class="goal-title-container">
          <span class="goal-card-type">${g.type}</span>
          <h4 class="goal-card-title">${g.title}</h4>
        </div>
        <div class="streak-badge">
          <i data-lucide="flame" style="width: 14px; height: 14px;"></i>
          <span>${g.streak} Days</span>
        </div>
      </div>
      
      <div class="goal-mini-progress-bg">
        <div class="goal-mini-progress-bar" style="width: ${g.progress}%"></div>
      </div>
      
      <div>
        <div class="goal-subtasks-header">Action Items</div>
        <div class="goal-subtasks-list">
          ${subtaskHTML}
        </div>
      </div>
      
      <div class="goal-card-footer">
        <span class="goal-target-text">Target: ${g.target}</span>
        <button class="goal-action-btn" onclick="incrementStreak('${g.id}')">Log Progress</button>
      </div>
    `;
    fullList.appendChild(card);
  });
  
  lucide.createIcons();
}

function incrementStreak(goalId) {
  const g = goals.find(goal => goal.id === goalId);
  if (g) {
    g.streak += 1;
    g.progress = Math.min(100, g.progress + 10);
    
    // Update dashboard displaying overall streak
    if (g.id === "goal-1") {
      document.getElementById("streak-val-display").innerText = g.streak + 1; // display overall sync
    }
    
    showToast(`Progress logged! Streak updated to ${g.streak} days.`, "success");
    renderGoals();
  }
}

// Add Goal functions
function openAddGoalModal() {
  document.getElementById("add-goal-modal").classList.add("active");
}

function closeAddGoalModal() {
  document.getElementById("add-goal-modal").classList.remove("active");
}

function submitAddGoal() {
  const title = document.getElementById("goal-title").value.trim();
  const type = document.getElementById("goal-type").value;
  const target = document.getElementById("goal-target").value.trim();
  
  if (!title) {
    showToast("Please enter a goal title.", "warning");
    return;
  }
  
  goals.push({
    id: `goal-${Date.now()}`,
    title,
    type,
    target: target || "Continuous",
    streak: 0,
    subtasks: ["Initial research", "Schedule recurring block", "First draft execution"],
    progress: 10
  });
  
  closeAddGoalModal();
  showToast(`Goal "${title}" added to habits tracker!`, "success");
  renderGoals();
  
  // Clear fields
  document.getElementById("goal-title").value = "";
  document.getElementById("goal-target").value = "";
}

// ----------------------------------------------------
// AI COMPANION (CHAT CHANNELS)
// ----------------------------------------------------
function renderChat() {
  const chatContainer = document.getElementById("chat-messages-container");
  chatContainer.innerHTML = "";
  
  chatHistory.forEach(msg => {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${msg.sender}`;
    bubble.innerText = msg.text;
    
    if (msg.card) {
      const card = document.createElement("div");
      card.className = "chat-bubble-card";
      card.innerHTML = `
        <div class="chat-bubble-card-title">${msg.card.title}</div>
        <div>${msg.card.body}</div>
      `;
      bubble.appendChild(card);
    }
    chatContainer.appendChild(bubble);
  });
  
  // Scroll to bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function handleChatSubmit(e) {
  if (e.key === "Enter") {
    submitChat();
  }
}

function submitChat() {
  const input = document.getElementById("chat-input");
  const query = input.value.trim();
  
  if (!query) return;
  
  // Add user message to history
  chatHistory.push({
    sender: "user",
    text: query
  });
  
  input.value = "";
  renderChat();
  
  // Simulate assistant typing
  simulateTypingResponse(query);
}

function sendChatPrompt(promptText) {
  chatHistory.push({
    sender: "user",
    text: promptText
  });
  renderChat();
  simulateTypingResponse(promptText);
}

function simulateTypingResponse(query) {
  const chatContainer = document.getElementById("chat-messages-container");
  
  // Render typing bubble
  const typingBubble = document.createElement("div");
  typingBubble.className = "chat-bubble assistant typing-bubble";
  typingBubble.innerHTML = `
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  chatContainer.appendChild(typingBubble);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  
  setTimeout(() => {
    // Remove typing bubble
    typingBubble.remove();
    
    // Analyze response logic
    let responseText = "I'm listening. Ask me something like 'What should I focus on right now?' or 'reschedule my conflicts'.";
    let attachedCard = null;
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes("focus") || lowerQuery.includes("right now")) {
      responseText = "Right now, your highest priority task based on proximity and duration is the Research Paper Draft (AI Priority Score: 92). I've blocked 11:00 AM to 1:00 PM for this session.";
    } else if (lowerQuery.includes("deadline") || lowerQuery.includes("track")) {
      responseText = "You have 3 active deadlines. Research Paper is critical (due in 14 hours). Your Interview Prep is tomorrow (36 hours remaining). You are on track for Interview Prep, but Research Paper needs attention.";
    } else if (lowerQuery.includes("reschedule") || lowerQuery.includes("conflict")) {
      responseText = "I detected a conflict between your Gym Session (6:00 PM) and study schedules. I recommend moving the Gym session to 7:30 PM today. Should I reschedule this block?";
      attachedCard = {
        title: "Proposed Reschedule Action",
        body: "Move 'Gym Session' from 6:00 PM to 7:30 PM today. Resolves calendar overlaps."
      };
      
      // Auto reschedule in 3s if authorized
      setTimeout(() => {
        const gymBlock = calendarBlocks.find(b => b.title.includes("Gym"));
        if (gymBlock) {
          gymBlock.startHour = 19.5;
          gymBlock.title = "Gym Session (Rescheduled by AI)";
          showToast("Autonomously resolved calendar conflict.", "success");
          renderCalendar();
        }
      }, 3500);
      
    } else if (lowerQuery.includes("break down") || lowerQuery.includes("essay") || lowerQuery.includes("outline")) {
      responseText = "I've analyzed 'English Essay' due tomorrow. I broke this down into: (1) Outline, (2) Research sources, (3) Drafting paragraph 1-3, (4) Editor review. Would you like me to populate these into your habit objectives?";
    } else if (lowerQuery.startsWith("add")) {
      // Simulate adding a task via voice/text chat command
      const taskName = query.replace(/add/i, "").trim();
      const newTask = {
        id: `task-${Date.now()}`,
        title: taskName || "Chat-added Assignment",
        deadlineHours: 24,
        duration: 2,
        dependency: "",
        goalCategory: "Academic",
        completed: false,
        score: 68,
        progress: 0
      };
      tasks.push(newTask);
      suggestCalendarBlockForTask(newTask);
      renderTasks();
      renderCalendar();
      responseText = `I've successfully created the task "${newTask.title}", calculated an AI Priority Score of ${newTask.score}, and suggested calendar slots!`;
    }
    
    chatHistory.push({
      sender: "assistant",
      text: responseText,
      card: attachedCard
    });
    
    renderChat();
  }, 1200);
}

// ----------------------------------------------------
// AGENTIC WORKFLOW CRUNCH SIMULATOR (SECTION 5.2)
// ----------------------------------------------------
function logToConsole(text, type = "system") {
  const consoleEl = document.getElementById("sim-console");
  const line = document.createElement("div");
  line.className = `console-line ${type}`;
  line.innerText = text;
  consoleEl.appendChild(line);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function runSimStep(step) {
  if (step !== simulatorStep + 1) return; // Must proceed step by step
  
  simulatorStep = step;
  
  // Highlight active step layout
  document.querySelectorAll(".scenario-step").forEach(s => s.classList.remove("active"));
  document.getElementById(`sim-step-${step}`).classList.add("active");
  document.getElementById(`sim-step-${step}`).classList.add("completed");
  
  // Enable next button
  const nextBtn = document.getElementById(`sim-btn-${step + 1}`);
  if (nextBtn) {
    nextBtn.removeAttribute("disabled");
    nextBtn.classList.remove("disabled");
  }
  
  // Disable current button
  document.getElementById(`sim-btn-${step}`).setAttribute("disabled", "true");
  document.getElementById(`sim-btn-${step}`).classList.add("disabled");
  
  // Execution Logic for each step
  if (step === 1) {
    logToConsole(">> [INTEGRATION LAYER] New assignment detected automatically from Canvas/email API: 'English Essay'");
    logToConsole(">> [REASONING ENGINE] Essay due in 18 hours. Stated progress is 0%. Escalating priority scores.");
    
    // Ingest English Essay task
    const essayTask = {
      id: "sim-essay-task",
      title: "English Essay Assignment",
      deadlineHours: 18,
      duration: 4,
      dependency: "",
      goalCategory: "Academic",
      completed: false,
      score: 98, // Extreme score
      progress: 0
    };
    
    tasks.unshift(essayTask);
    renderTasks();
    showToast("NudgeAI detected critical task: 'English Essay Assignment' due in 18h!", "warning");
    
  } else if (step === 2) {
    logToConsole(">> [REASONING ENGINE] Decomposing 'English Essay Assignment' (4 hours total) into sub-tasks:");
    logToConsole("   - [1] Sources Research & Thesis Drafting (1.0h)");
    logToConsole("   - [2] Structural Outline Setup (1.0h)");
    logToConsole("   - [3] Main Body Drafting (1.5h)");
    logToConsole("   - [4] Grammar & Citation Check (0.5h)");
    
    // Add subtasks directly to goals mock list
    goals.push({
      id: "sim-goal-essay",
      title: "Complete English Essay",
      type: "Milestone",
      target: "Due in 18 hours",
      streak: 0,
      subtasks: ["Sources Research", "Essay Outline Setup", "Drafting Body", "Grammar Check"],
      progress: 0
    });
    
    renderGoals();
    showToast("AI decomposed Essay into 4 actionable steps.", "success");
    
  } else if (step === 3) {
    logToConsole(">> [ENGAGEMENT LAYER] Dispatching context-aware nudge via push, SMS, and dashboard alert.");
    logToConsole(">> [ALERT] 'Your essay is due in 18 hours and no progress has been logged. Want me to block 2 hours now and 2 hours tonight?'");
    
    // Dispatch nudge alert
    nudges.unshift({
      id: "sim-nudge-toast",
      type: "urgent",
      title: "Critical Time Constraint",
      message: "English Essay is due in 18 hours. Let NudgeAI schedule 2 Focus blocks today?",
      actionLabel: "Approve Schedule",
      actionType: "sim_approve_schedule"
    });
    
    renderNudges();
    showToast("Urgent Nudge: Schedule essay focus sessions?", "warning");
    
  } else if (step === 4) {
    logToConsole(">> [ACTION LAYER] User approved suggested outline creation and calendar blocking.");
    logToConsole(">> [CALENDAR] Writing task blocks directly to calendar: 4:00 PM - 6:00 PM (Part 1) & 8:00 PM - 10:00 PM (Part 2) today.");
    logToConsole(">> [ACTION LAYER] Drafted Starter Outline: 'Topic: Modern Procrastination. Thesis: How AI agentic assistants bridge execution gaps.'");
    
    // Block calendar
    calendarBlocks.push({
      id: "sim-cal-part1",
      title: "English Essay Focus - Part 1 (Suggested)",
      startHour: 16, // 4 PM
      duration: 2.0,
      day: "today",
      type: "suggested",
      completed: false
    }, {
      id: "sim-cal-part2",
      title: "English Essay Focus - Part 2 (Suggested)",
      startHour: 20, // 8 PM
      duration: 2.0,
      day: "today",
      type: "suggested",
      completed: false
    });
    
    // Pre-draft essay outline - add to dashboard top recommendation widget
    document.getElementById("current-focus-text").innerText = "English Essay (Part 1 Focus Session)";
    
    renderCalendar();
    showToast("Focus blocks written to Google Calendar. Starter outline generated!", "success");
    
  } else if (step === 5) {
    logToConsole(">> [MEMORY LAYER] User skipped focus slot Part 1 at 4:00 PM. No progress logged.");
    logToConsole(">> [REASONING ENGINE] Recalculating remaining workload. 4 hours needed, 14 hours until deadline.");
    logToConsole(">> [RE-PLANNING] Relocating focus blocks. Scheduled blocks updated: 8:00 PM - 10:00 PM tonight AND 8:00 AM - 10:00 AM tomorrow.");
    
    // Re-plan: Remove skipped block and add a slot tomorrow morning
    calendarBlocks = calendarBlocks.filter(b => b.id !== "sim-cal-part1");
    calendarBlocks.push({
      id: "sim-cal-replanned",
      title: "English Essay Focus - Part 1 (Replanned)",
      startHour: 8, // 8 AM tomorrow
      duration: 2.0,
      day: "tomorrow",
      type: "suggested",
      completed: false
    });
    
    renderCalendar();
    showToast("Re-planned: Focus block shifted to tomorrow morning.", "warning");
    logToConsole(">> [SUCCESS] Simulator workflow complete. NudgeAI closed execution loop.");
  }
}

function resetSimulator() {
  simulatorStep = 0;
  
  // Clean up simulator tasks/goals/cal blocks
  tasks = tasks.filter(t => t.id !== "sim-essay-task");
  goals = goals.filter(g => g.id !== "sim-goal-essay");
  calendarBlocks = calendarBlocks.filter(b => !b.id.startsWith("sim-cal-"));
  nudges = nudges.filter(n => !n.id.startsWith("sim-nudge-"));
  
  document.getElementById("current-focus-text").innerText = "Research Paper Draft (Peak Focus Hour)";
  
  // Re-enable and reset controls
  document.querySelectorAll(".scenario-step").forEach(s => {
    s.classList.remove("active");
    s.classList.remove("completed");
  });
  
  document.getElementById("sim-btn-1").removeAttribute("disabled");
  document.getElementById("sim-btn-1").classList.remove("disabled");
  
  for (let i = 2; i <= 5; i++) {
    const btn = document.getElementById(`sim-btn-${i}`);
    if (btn) {
      btn.setAttribute("disabled", "true");
      btn.classList.add("disabled");
    }
  }
  
  // Clear console
  document.getElementById("sim-console").innerHTML = `<div class="console-line system">&gt;&gt; Ready to run simulator. Click "Simulate Step 1" to begin.</div>`;
  
  renderTasks();
  renderNudges();
  renderGoals();
  renderCalendar();
  showToast("Simulator reset successfully.", "success");
}

// ----------------------------------------------------
// UI GENERAL UTILITIES
// ----------------------------------------------------
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}" style="width: 16px; height: 16px;"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  
  // Refresh icons inside toast
  lucide.createIcons();
  
  // Fade out and remove
  setTimeout(() => {
    toast.style.transition = "opacity 0.5s ease-out, transform 0.5s ease-out";
    toast.style.opacity = "0";
    toast.style.transform = "translateX(50px)";
    setTimeout(() => toast.remove(), 500);
  }, 3500);
}

function startFocusSession() {
  const curFocus = document.getElementById("current-focus-text").innerText;
  showToast(`Focus session started for: ${curFocus}. Stay productive!`, "success");
}
