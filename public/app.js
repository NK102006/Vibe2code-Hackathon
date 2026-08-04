// NudgeAI Core Application Logic

// Initial Application State
let tasks = [];
let calendarBlocks = [];
let nudges = [];
let goals = [];

let chatHistory = [
  {
    sender: "assistant",
    text: "Hello! I am NudgeAI, your proactive companion. I've analyzed your upcoming commitments and set a focus priority score. Ask me to schedule, draft emails, or analyze deadlines."
  }
];

let activeTab = "dashboard";
let taskFilter = "all";
let missedTasks = [];

// Pomodoro Focus Timer State
let focusTimerState = {
  status: 'idle', // 'idle' | 'running' | 'paused'
  remainingSeconds: 1500, // 25 minutes
  intervalId: null,
  activeTaskId: null
};

// Initialization
document.addEventListener("DOMContentLoaded", async () => {
  const authOverlay = document.getElementById("auth-overlay");
  
  let user = null;
  const session = localStorage.getItem("nudgeai_session");
  
  if (session) {
    user = JSON.parse(session);
    if (authOverlay) authOverlay.classList.remove("active");
  } else {
    if (authOverlay) authOverlay.classList.add("active");
    toggleAuthTab('login');
  }

  if (user) {
    updateUserProfileUI(user);
    loadUserData(user.email);
  }

  // Initialize Lucide Icons
  lucide.createIcons();
  
  // Set Calendar Dates
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  const options = { month: 'short', day: 'numeric' };
  document.getElementById("calendar-today-date").innerText = today.toLocaleDateString('en-US', options);
  document.getElementById("calendar-tomorrow-date").innerText = tomorrow.toLocaleDateString('en-US', options);
});

// Toggle Sidebar Drawer for Mobile
function toggleSidebar(show) {
  const sidebar = document.querySelector(".sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  if (!sidebar || !backdrop) return;
  
  if (show) {
    sidebar.classList.add("open");
    backdrop.classList.add("active");
  } else {
    sidebar.classList.remove("open");
    backdrop.classList.remove("active");
  }
}

// Switch Dashboard Tab Views
function switchTab(tabId) {
  activeTab = tabId;
  
  // Close mobile sidebar if open
  toggleSidebar(false);
  
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
    chat: "Conversational AI Companion"
  };
  
  const subtitleMap = {
    dashboard: "Proactively guiding your productivity today.",
    calendar: "Visualizing scheduled blocks, suggested AI sessions, and dynamic conflict resolutions.",
    goals: "Reinforcing positive habits and long-term milestones.",
    chat: "Chat with your advisor to query tasks, authorize actions, and handle scheduling."
  };
  
  document.getElementById("view-title").innerText = titleMap[tabId];
  document.getElementById("view-subtitle").innerText = subtitleMap[tabId];
  
  // Refresh page visual styles or charts
  if (tabId === "calendar") renderCalendar();
  if (tabId === "dashboard") {
    renderTasks();
    renderNudges();
    renderMissedTasks();
  }
  if (tabId === "goals") renderGoals();
  
  // Dismiss badge if entering chat
  if (tabId === "chat") {
    document.getElementById("chat-badge").style.display = "none";
  }
  
  const viewContainer = document.querySelector(".view-container");
  if (viewContainer) {
    if (tabId === "chat") {
      viewContainer.style.overflow = "hidden";
    } else {
      viewContainer.style.overflow = "auto";
    }
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

// Helper to format due time nicely (hours/mins/secs)
function formatDeadline(hours) {
  if (hours <= 0) return "Missed deadline";
  if (hours >= 1.0) {
    return `Due in ${hours.toFixed(1)}h`;
  } else {
    const totalSecs = Math.max(1, Math.round(hours * 3600));
    if (totalSecs >= 60) {
      const mins = Math.round(totalSecs / 60);
      return `Due in ${mins}m`;
    } else {
      return `Due in ${totalSecs}s`;
    }
  }
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
            <span>${formatDeadline(task.deadlineHours)}</span>
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
  updateFocusSuggestion();
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
    syncDatabase('tasks', 'update', task.id, { completed: task.completed });
    
    // Toggle matching calendar blocks completion
    calendarBlocks.forEach(block => {
      if (block.title.includes(task.title)) {
        block.completed = task.completed;
        block.type = task.completed ? "completed" : "suggested";
        syncDatabase('calendar', 'update', block.id, { completed: block.completed, type: block.type });
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
    dueDate: Date.now() + (deadlineHours * 60 * 60 * 1000),
    duration,
    dependency,
    goalCategory,
    autoExecute,
    completed: false,
    score: 50,
    progress: 0
  };
  
  tasks.push(newTask);
  syncDatabase('tasks', 'create', null, newTask);
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
  
  const newBlock = {
    id: `cal-${Date.now()}`,
    title: `${task.title} (Suggested)`,
    startHour: hour,
    duration: task.duration,
    day: day,
    type: "suggested",
    completed: false
  };
  calendarBlocks.push(newBlock);
  syncDatabase('calendar', 'create', null, newBlock);
  
  // Trigger a context aware nudge
  const newNudge = {
    id: `nudge-${Date.now()}`,
    type: "suggested",
    title: "AI Suggested Scheduling",
    message: `Scheduled ${task.duration}h for "${task.title}" on ${day.toUpperCase()} at ${formatHour(hour)}.`,
    actionLabel: "Change Slot",
    actionType: "schedule_chat_reschedule"
  };
  nudges.unshift(newNudge);
  syncDatabase('nudges', 'create', null, newNudge);
  renderNudges();
}

// ----------------------------------------------------
// PROACTIVE NUDGES FEED
// ----------------------------------------------------
function renderNudges() {
  const nudgeFeed = document.getElementById("dashboard-nudge-feed");
  const nudgeCount = document.getElementById("nudge-count");
  const globalPopupContainer = document.getElementById("global-popup-container");
  
  if (nudgeFeed) nudgeFeed.innerHTML = "";
  if (nudgeCount) nudgeCount.innerText = nudges.length;
  if (globalPopupContainer) globalPopupContainer.innerHTML = "";
  
  if (nudges.length === 0) {
    if (nudgeFeed) {
      nudgeFeed.innerHTML = `
        <div class="empty-state" style="padding: 24px 0;">
          <p style="font-size: 12px; color: var(--text-muted);">All nudges resolved! NudgeAI is actively monitoring.</p>
        </div>
      `;
    }
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
    
    // Render to dashboard sidebar feed if it exists
    if (nudgeFeed) {
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
    }
    
    // Render to global popup container
    if (globalPopupContainer) {
      const popupCard = document.createElement("div");
      popupCard.className = `global-popup-card`;
      popupCard.innerHTML = `
        <div class="global-popup-header ${headerClass}">
          <i data-lucide="${n.type === 'urgent' ? 'alert-triangle' : n.type === 'action' ? 'mail' : 'info'}" style="width: 14px; height: 14px;"></i>
          <span>${n.title}</span>
        </div>
        <div class="global-popup-body">${n.message}</div>
        <div class="global-popup-actions">
          <button class="global-popup-btn-approve" onclick="handleNudgeAction('${n.id}', '${n.actionType}')">${n.actionLabel}</button>
          <button class="global-popup-btn-dismiss" onclick="dismissNudge('${n.id}')">Dismiss</button>
        </div>
      `;
      globalPopupContainer.appendChild(popupCard);
    }
  });
  lucide.createIcons();
}

function dismissNudge(id) {
  nudges = nudges.filter(n => n.id !== id);
  syncDatabase('nudges', 'delete', id);
  renderNudges();
}

function handleNudgeAction(nudgeId, actionType) {
  dismissNudge(nudgeId);
  
  if (actionType === "schedule_research") {
    // Schedule a suggested block for Research Paper
    const newBlock = {
      id: `cal-research-focus`,
      title: "Research Paper Draft Focus Session",
      startHour: 13, // 1:00 PM
      duration: 2.0,
      day: "today",
      type: "suggested",
      completed: false
    };
    calendarBlocks.push(newBlock);
    syncDatabase('calendar', 'create', null, newBlock);
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
      syncDatabase('calendar', 'update', gymBlock.id, { startHour: 19.5, title: gymBlock.title });
      showToast("Gym Session rescheduled to 7:30 PM to resolve overlap.", "success");
      renderCalendar();
    }
  } else if (actionType === "schedule_chat_reschedule") {
    switchTab("chat");
    sendChatPrompt("I need to change the scheduled block for my new task.");
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
      syncDatabase('calendar', 'update', block.id, { completed: block.completed, type: block.type });
      
      // Update tasks completed state if task title matches
      tasks.forEach(t => {
        if (block.title.includes(t.title)) {
          t.completed = block.completed;
          syncDatabase('tasks', 'update', t.id, { completed: t.completed });
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
    syncDatabase('goals', 'update', g.id, { streak: g.streak, progress: g.progress });
    
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
  
  const newGoal = {
    id: `goal-${Date.now()}`,
    title,
    type,
    target: target || "Continuous",
    streak: 0,
    subtasks: ["Initial research", "Schedule recurring block", "First draft execution"],
    progress: 10
  };
  goals.push(newGoal);
  syncDatabase('goals', 'create', null, newGoal);
  
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
      const activeTasks = tasks.filter(t => !t.completed);
      if (activeTasks.length === 0) {
        responseText = "You don't have any pending focus list tasks right now. Great job keeping your plate clean!";
      } else {
        const highest = activeTasks.reduce((max, t) => t.score > max.score ? t : max, activeTasks[0]);
        responseText = `Right now, your highest priority task based on proximity and duration is "${highest.title}" (AI Priority Score: ${highest.score}). ${formatDeadline(highest.deadlineHours)}.`;
      }
    } else if (lowerQuery.includes("deadline") || lowerQuery.includes("track")) {
      const activeTasks = tasks.filter(t => !t.completed);
      if (activeTasks.length === 0) {
        responseText = "You have no active deadlines right now. Everything is fully on track!";
      } else {
        const urgentCount = activeTasks.filter(t => t.deadlineHours < 24).length;
        responseText = `You have ${activeTasks.length} active deadlines. `;
        if (urgentCount > 0) {
          responseText += `${urgentCount} task(s) need immediate attention (due in less than 24 hours). `;
        } else {
          responseText += `All of them have more than 24 hours remaining. You are in good shape! `;
        }
        const highest = activeTasks.reduce((max, t) => t.score > max.score ? t : max, activeTasks[0]);
        responseText += `Currently, "${highest.title}" needs the most attention (${formatDeadline(highest.deadlineHours)}).`;
      }
    } else if (lowerQuery.includes("reschedule") || lowerQuery.includes("conflict")) {
      let conflictBlockA = null;
      let conflictBlockB = null;
      
      for (let i = 0; i < calendarBlocks.length; i++) {
        const block = calendarBlocks[i];
        if (block.completed) continue;
        for (let j = i + 1; j < calendarBlocks.length; j++) {
          const other = calendarBlocks[j];
          if (other.completed || block.day !== other.day) continue;
          
          const startA = block.startHour;
          const endA = block.startHour + block.duration;
          const startB = other.startHour;
          const endB = other.startHour + other.duration;
          
          if (startA < endB && startB < endA) {
            conflictBlockA = block;
            conflictBlockB = other;
            break;
          }
        }
        if (conflictBlockA) break;
      }
      
      if (conflictBlockA && conflictBlockB) {
        const newStart = conflictBlockA.startHour + conflictBlockA.duration;
        responseText = `I detected a conflict between "${conflictBlockA.title}" (${formatHour(conflictBlockA.startHour)}) and "${conflictBlockB.title}" (${formatHour(conflictBlockB.startHour)}) on ${conflictBlockA.day}. I recommend rescheduling "${conflictBlockB.title}" to start at ${formatHour(newStart)}. Would you like me to resolve this conflict?`;
        
        attachedCard = {
          title: "Proposed Reschedule Action",
          body: `Move "${conflictBlockB.title}" from ${formatHour(conflictBlockB.startHour)} to ${formatHour(newStart)} on ${conflictBlockB.day}.`
        };
        
        setTimeout(() => {
          conflictBlockB.startHour = newStart;
          conflictBlockB.title = `${conflictBlockB.title} (Rescheduled)`;
          syncDatabase('calendar', 'update', conflictBlockB.id, { startHour: conflictBlockB.startHour, title: conflictBlockB.title });
          showToast(`Rescheduled "${conflictBlockB.title.replace(' (Rescheduled)', '')}" to resolve conflict.`, "success");
          renderCalendar();
        }, 3500);
      } else {
        responseText = "I analyzed your schedule and found no scheduling conflicts at the moment. Excellent planning!";
      }
    } else if (lowerQuery.includes("break down") || lowerQuery.includes("essay") || lowerQuery.includes("outline")) {
      const targetTask = tasks.find(t => !t.completed && (t.title.toLowerCase().includes("essay") || t.title.toLowerCase().includes("paper") || t.title.toLowerCase().includes("homework") || t.title.toLowerCase().includes("prep") || t.title.toLowerCase().includes("task")));
      if (targetTask) {
        responseText = `I've analyzed your task "${targetTask.title}" (${formatDeadline(targetTask.deadlineHours)}). I recommend breaking this down into: (1) Initial research and outline, (2) Core drafting and execution, and (3) Refinement and review. Would you like me to populate these sub-objectives?`;
      } else {
        responseText = "To help you break down a goal, please add a task or tell me which of your goals you want to outline.";
      }
    } else if (lowerQuery.startsWith("add")) {
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
      syncDatabase('tasks', 'create', null, newTask);
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
// MISSED TASK & DEADLINE COUNTDOWN ENGINE
// ----------------------------------------------------
function renderMissedTasks() {
  const missedListContainer = document.getElementById("dashboard-missed-task-list");
  if (!missedListContainer) return;
  missedListContainer.innerHTML = "";
  
  if (missedTasks.length === 0) {
    missedListContainer.innerHTML = `
      <div class="empty-state" style="padding: 20px;">
        <p style="color: var(--text-muted); font-size: 13px;">No missed deadlines. You're fully on track!</p>
      </div>
    `;
    return;
  }
  
  missedTasks.forEach(task => {
    const taskItem = document.createElement("div");
    taskItem.className = "task-item completed";
    taskItem.style.borderColor = "rgba(244, 63, 94, 0.2)";
    taskItem.style.background = "rgba(244, 63, 94, 0.02)";
    taskItem.innerHTML = `
      <button class="checkbox-btn checked" style="background: var(--color-rose); border-color: var(--color-rose); cursor: default;">
        <i data-lucide="x"></i>
      </button>
      <div class="task-details">
        <span class="task-title" style="color: var(--text-secondary); text-decoration: none;">${task.title}</span>
        <div class="task-meta">
          <span class="task-meta-item meta-urgency">
            <i data-lucide="alert-triangle"></i>
            <span>Missed deadline (${task.missedAt})</span>
          </span>
          <div class="task-pills">
            <span class="pill-category">${task.goalCategory}</span>
          </div>
        </div>
      </div>
      <div class="task-score">
        <span class="score-number" style="background: linear-gradient(135deg, #f43f5e, #fb7185); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">MISSED</span>
      </div>
    `;
    missedListContainer.appendChild(taskItem);
  });
  
  lucide.createIcons();
}

// Background interval to calculate and decrement deadlines in real-time
setInterval(() => {
  let expiredFound = false;
  
  // Update each active task's deadlineHours in real-time based on dueDate
  for (let i = tasks.length - 1; i >= 0; i--) {
    const task = tasks[i];
    if (!task.completed && task.dueDate) {
      const msRemaining = task.dueDate - Date.now();
      const hoursRemaining = Math.max(0, msRemaining / (1000 * 60 * 60));
      task.deadlineHours = parseFloat(hoursRemaining.toFixed(4));
      
      // If deadline reaches 0 and task is not completed, it is missed
      if (task.deadlineHours <= 0) {
        // Move to missed tasks list
        missedTasks.push({
          ...task,
          missedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        
        // Remove from active tasks
        tasks.splice(i, 1);
        expiredFound = true;
        
        // Show toast warning
        showToast(`Deadline Missed: "${task.title}" has been moved to Missed Tasks!`, "warning");
        
        // Generate a new proactive nudge about this missed deadline
        nudges.unshift({
          id: `nudge-missed-${Date.now()}`,
          type: "urgent",
          title: "Missed Deadline Mitigation",
          message: `You missed the deadline for "${task.title}". Let NudgeAI draft an extension email or reschedule dependencies?`,
          actionLabel: "Mitigate Now",
          actionType: "view_email_draft" // opens draft modal
        });
        
        // Clean up calendar blocks referencing this task
        calendarBlocks = calendarBlocks.filter(block => !block.title.includes(task.title));
      }
    }
  }
  
  if (expiredFound) {
    renderTasks();
    renderNudges();
    renderCalendar();
    renderMissedTasks();
    updateDependencyDropdown();
  } else if (activeTab === "dashboard") {
    // Just refresh view countdown values
    renderTasks();
  }
}, 1000);

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

function formatFocusTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateFocusSuggestion() {
  const container = document.getElementById("focus-widget-container");
  const label = document.getElementById("focus-label");
  const textVal = document.getElementById("current-focus-text");
  const timerDisplay = document.getElementById("focus-timer-display");
  const startBtn = document.getElementById("focus-start-btn");
  const completeBtn = document.getElementById("focus-complete-btn");
  const resetBtn = document.getElementById("focus-reset-btn");
  
  if (!container || !textVal) return;

  // Find the current highest priority pending task
  const highestTask = tasks.find(t => !t.completed);

  // If there's an active session, verify the task still exists and is not completed
  if (focusTimerState.status !== 'idle') {
    const activeTask = tasks.find(t => t.id === focusTimerState.activeTaskId);
    if (!activeTask || activeTask.completed) {
      // Reset if task was deleted or marked completed elsewhere
      if (focusTimerState.intervalId) {
        clearInterval(focusTimerState.intervalId);
      }
      focusTimerState.intervalId = null;
      focusTimerState.status = 'idle';
      focusTimerState.remainingSeconds = 1500;
      focusTimerState.activeTaskId = null;
    }
  }

  if (!highestTask && focusTimerState.status === 'idle') {
    textVal.innerText = "All caught up! Great job!";
    label.innerText = "CURRENT FOCUS SUGGESTION";
    label.style.color = "var(--text-muted)";
    if (timerDisplay) timerDisplay.style.display = "none";
    if (startBtn) {
      startBtn.style.display = "inline-block";
      startBtn.innerText = "Start";
      startBtn.disabled = true;
      startBtn.style.opacity = "0.5";
      startBtn.style.cursor = "not-allowed";
    }
    if (completeBtn) completeBtn.style.display = "none";
    if (resetBtn) resetBtn.style.display = "none";
    container.className = "focus-widget glass-panel";
    return;
  }

  // If startBtn was disabled, re-enable it
  if (startBtn) {
    startBtn.disabled = false;
    startBtn.style.opacity = "1";
    startBtn.style.cursor = "pointer";
  }

  if (focusTimerState.status === 'idle') {
    focusTimerState.activeTaskId = highestTask.id;
    label.innerText = "CURRENT FOCUS SUGGESTION";
    label.style.color = "";
    textVal.innerText = `${highestTask.title} (${highestTask.goalCategory})`;
    
    if (timerDisplay) timerDisplay.style.display = "none";
    if (startBtn) {
      startBtn.style.display = "inline-block";
      startBtn.innerText = "Start";
    }
    if (completeBtn) completeBtn.style.display = "none";
    if (resetBtn) resetBtn.style.display = "none";
    container.className = "focus-widget glass-panel";
  } else {
    // running or paused
    const activeTask = tasks.find(t => t.id === focusTimerState.activeTaskId);
    if (!activeTask) return;
    
    textVal.innerText = `${activeTask.title}`;
    
    if (focusTimerState.status === 'running') {
      label.innerText = "FOCUS SESSION ACTIVE";
      container.className = "focus-widget glass-panel active-running";
      if (startBtn) startBtn.innerText = "Pause";
    } else {
      label.innerText = "FOCUS SESSION PAUSED";
      container.className = "focus-widget glass-panel active-paused";
      if (startBtn) startBtn.innerText = "Resume";
    }
    
    if (timerDisplay) {
      timerDisplay.style.display = "inline-block";
      timerDisplay.innerText = formatFocusTime(focusTimerState.remainingSeconds);
    }
    if (completeBtn) completeBtn.style.display = "inline-flex";
    if (resetBtn) resetBtn.style.display = "inline-flex";
  }
}

function toggleFocusSession() {
  const activeTask = tasks.find(t => t.id === focusTimerState.activeTaskId);
  if (!activeTask) {
    showToast("No active task available to focus on.", "warning");
    return;
  }

  if (focusTimerState.status === 'idle') {
    focusTimerState.status = 'running';
    showToast(`Focus session started for: ${activeTask.title}. Stay productive!`, "success");
    startTimerInterval();
  } else if (focusTimerState.status === 'running') {
    focusTimerState.status = 'paused';
    if (focusTimerState.intervalId) {
      clearInterval(focusTimerState.intervalId);
      focusTimerState.intervalId = null;
    }
    showToast("Focus session paused.", "success");
  } else if (focusTimerState.status === 'paused') {
    focusTimerState.status = 'running';
    showToast("Focus session resumed.", "success");
    startTimerInterval();
  }
  
  updateFocusSuggestion();
}

function startTimerInterval() {
  if (focusTimerState.intervalId) {
    clearInterval(focusTimerState.intervalId);
  }
  focusTimerState.intervalId = setInterval(() => {
    if (focusTimerState.remainingSeconds > 0) {
      focusTimerState.remainingSeconds--;
      updateFocusSuggestion();
    } else {
      completeFocusSession(true);
    }
  }, 1000);
}

function resetFocusSession() {
  if (focusTimerState.intervalId) {
    clearInterval(focusTimerState.intervalId);
  }
  focusTimerState.intervalId = null;
  focusTimerState.status = 'idle';
  focusTimerState.remainingSeconds = 1500;
  showToast("Focus session timer reset.", "success");
  updateFocusSuggestion();
}

function completeFocusSession(isAuto = false) {
  if (focusTimerState.intervalId) {
    clearInterval(focusTimerState.intervalId);
  }
  focusTimerState.intervalId = null;
  
  const activeTask = tasks.find(t => t.id === focusTimerState.activeTaskId);
  
  focusTimerState.status = 'idle';
  focusTimerState.remainingSeconds = 1500;
  
  if (activeTask) {
    if (isAuto) {
      showToast(`Focus session completed! Great job on: ${activeTask.title}`, "success");
    }
    if (!activeTask.completed) {
      toggleTaskCompletion(activeTask.id);
    }
  }
  
  updateFocusSuggestion();
}

// ----------------------------------------------------
// DATABASE & AUTHENTICATION FLOW LAYER (RESTORED & UPGRADED)
let currentOTP = null;
let resendTimerInterval = null;

// Helper to load user's data from MongoDB
async function loadUserData(email) {
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(email)}/data`);
    if (res.ok) {
      const data = await res.json();
      tasks = data.tasks || [];
      calendarBlocks = data.calendarBlocks || [];
      goals = data.goals || [];
      nudges = data.nudges || [];
      
      // Update due dates dynamically
      tasks.forEach(t => {
        t.dueDate = Date.now() + (t.deadlineHours * 60 * 60 * 1000);
      });
      
      renderTasks();
      renderNudges();
      renderGoals();
      renderCalendar();
      renderChat();
      renderMissedTasks();
      updateDependencyDropdown();
    } else {
      showToast("Failed to load user data from backend.", "warning");
    }
  } catch (err) {
    console.error("Load user data error:", err);
    showToast("Network error. Running in local mode.", "warning");
  }
}

// Helper to sync changes to MongoDB
async function syncDatabase(type, action, id, data) {
  const session = localStorage.getItem("nudgeai_session");
  if (!session) return;
  const user = JSON.parse(session);
  const email = encodeURIComponent(user.email);
  
  let url = `/api/users/${email}/${type}`;
  if (id) url += `/${id}`;
  
  let method = 'POST';
  if (action === 'update') method = 'PUT';
  if (action === 'delete') method = 'DELETE';
  
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (data) options.body = JSON.stringify(data);
    
    const res = await fetch(url, options);
    if (!res.ok) {
      console.warn(`[SYNC ERROR] Failed to ${action} ${type}: ${res.statusText}`);
    }
  } catch (err) {
    console.error(`[SYNC ERROR]`, err);
  }
}

// Handle User Logging Out
window.handleSignOut = function() {
  localStorage.removeItem("nudgeai_session");
  window.location.reload();
};

// Update sidebar profile elements dynamically
function updateUserProfileUI(user) {
  const avatar = document.getElementById("user-avatar");
  const name = document.getElementById("user-display-name");
  const role = document.getElementById("user-display-role");
  
  if (name) name.innerText = user.name || "Alex Newman";
  if (role) role.innerText = user.role || "Student / Freelancer";
  
  if (avatar) {
    const initials = (user.name || "Alex Newman")
      .split(" ")
      .map(n => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
    avatar.innerText = initials;
  }
}

let verifiedForgotEmail = null;

// Helper to show/clear authentication errors
function showAuthError(message) {
  const errorMsg = document.getElementById("auth-error-message");
  const errorText = document.getElementById("auth-error-text");
  if (errorMsg && errorText) {
    errorText.innerText = message;
    errorMsg.style.display = "flex";
  }
}

function clearAuthError() {
  const errorMsg = document.getElementById("auth-error-message");
  const errorText = document.getElementById("auth-error-text");
  if (errorMsg && errorText) {
    errorMsg.style.display = "none";
    errorText.innerText = "";
  }
}

// Toggle between Sign In, Sign Up, Forgot Password, and Reset Password views
window.toggleAuthTab = function(tab) {
  const tabsContainer = document.getElementById("auth-tabs-container");
  const loginForm = document.getElementById("form-login");
  const signupForm = document.getElementById("form-signup");
  const forgotForm = document.getElementById("form-forgot");
  const resetForm = document.getElementById("form-reset");

  const tabLoginBtn = document.getElementById("tab-login");
  const tabSignupBtn = document.getElementById("tab-signup");

  // Reset forms active state
  loginForm.classList.remove("active");
  signupForm.classList.remove("active");
  forgotForm.classList.remove("active");
  resetForm.classList.remove("active");

  clearAuthError();

  if (tab === "login") {
    tabsContainer.style.display = "flex";
    tabLoginBtn.classList.add("active");
    tabSignupBtn.classList.remove("active");
    loginForm.classList.add("active");
    document.getElementById("auth-title-text").innerText = "Welcome to NudgeAI";
    document.getElementById("auth-subtitle-text").innerText = "Your proactive productivity companion.";
  } else if (tab === "signup") {
    tabsContainer.style.display = "flex";
    tabSignupBtn.classList.add("active");
    tabLoginBtn.classList.remove("active");
    signupForm.classList.add("active");
    document.getElementById("auth-title-text").innerText = "Create Account";
    document.getElementById("auth-subtitle-text").innerText = "Join NudgeAI to automate your schedule.";
  } else if (tab === "forgot") {
    tabsContainer.style.display = "none";
    forgotForm.classList.add("active");
    document.getElementById("auth-title-text").innerText = "Reset Password";
    document.getElementById("auth-subtitle-text").innerText = "Provide your Name and Email to verify identity.";
  } else if (tab === "reset") {
    tabsContainer.style.display = "none";
    resetForm.classList.add("active");
    document.getElementById("auth-title-text").innerText = "Choose New Password";
    document.getElementById("auth-subtitle-text").innerText = "Secure your account with a new password.";
  }
};

// Handle Sign In submission
window.handleLoginSubmit = async function(event) {
  event.preventDefault();
  clearAuthError();
  const name = document.getElementById("login-name").value;
  const password = document.getElementById("login-password").value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      showToast("Signed in successfully!", "success");
      localStorage.setItem("nudgeai_session", JSON.stringify(data.user));
      document.getElementById("auth-overlay").classList.remove("active");
      updateUserProfileUI(data.user);
      loadUserData(data.user.email);
      // Clear inputs
      document.getElementById("login-name").value = "";
      document.getElementById("login-password").value = "";
    } else {
      showAuthError(data.error || "Authentication failed.");
      showToast(data.error || "Authentication failed.", "warning");
    }
  } catch (err) {
    console.error("Login error:", err);
    showAuthError("Network error occurred during login.");
    showToast("Network error occurred during login.", "warning");
  }
};

// Handle Sign Up submission
window.handleSignUpSubmit = async function(event) {
  event.preventDefault();
  clearAuthError();
  const name = document.getElementById("signup-name").value;
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;

  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      showToast("Account created successfully!", "success");
      localStorage.setItem("nudgeai_session", JSON.stringify(data.user));
      document.getElementById("auth-overlay").classList.remove("active");
      updateUserProfileUI(data.user);
      loadUserData(data.user.email);
      // Clear inputs
      document.getElementById("signup-name").value = "";
      document.getElementById("signup-email").value = "";
      document.getElementById("signup-password").value = "";
    } else {
      showAuthError(data.error || "Registration failed.");
      showToast(data.error || "Registration failed.", "warning");
    }
  } catch (err) {
    console.error("Signup error:", err);
    showAuthError("Network error occurred during registration.");
    showToast("Network error occurred during registration.", "warning");
  }
};

// Handle Forgot Password Verification submission
window.handleForgotSubmit = async function(event) {
  event.preventDefault();
  clearAuthError();
  const name = document.getElementById("forgot-name").value;
  const email = document.getElementById("forgot-email").value;

  try {
    const res = await fetch('/api/auth/verify-forgot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      verifiedForgotEmail = data.email;
      toggleAuthTab('reset');
      // Clear inputs
      document.getElementById("forgot-name").value = "";
      document.getElementById("forgot-email").value = "";
    } else {
      showAuthError(data.error || "Verification failed.");
      showToast(data.error || "Verification failed.", "warning");
    }
  } catch (err) {
    console.error("Forgot verification error:", err);
    showAuthError("Network error occurred during verification.");
    showToast("Network error occurred during verification.", "warning");
  }
};

// Handle Reset Password submission
window.handleResetSubmit = async function(event) {
  event.preventDefault();
  clearAuthError();
  const password = document.getElementById("reset-password").value;

  if (!verifiedForgotEmail) {
    showToast("Session expired. Please verify details again.", "warning");
    toggleAuthTab('forgot');
    return;
  }

  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: verifiedForgotEmail, password })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      showToast("Password updated successfully! Please sign in.", "success");
      verifiedForgotEmail = null;
      document.getElementById("reset-password").value = "";
      toggleAuthTab('login');
    } else {
      showAuthError(data.error || "Failed to reset password.");
      showToast(data.error || "Failed to reset password.", "warning");
    }
  } catch (err) {
    console.error("Reset password error:", err);
    showAuthError("Network error occurred during password reset.");
    showToast("Network error occurred during password reset.", "warning");
  }
};

