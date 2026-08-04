# NudgeAI — The Last-Minute Life Saver

**NudgeAI** is a premium, client-side productivity companion that plans, prioritizes, and resolves conflict blocks on your behalf before deadlines hit. Engineered with proactive agentic principles, it acts as a dynamic coordinator for students, freelancers, and professionals facing scheduling crunches.

---

## 🚀 Core Features

### 1. Dynamic Priority Engine
An integrated prioritization algorithm that automatically recalculates and re-ranks your task lists.
*   **AI Priority Score Formula**: Urgency (Deadline Proximity) × 40% + Effort (Duration) × 30% + Dependencies (Blockers) × 30%.
*   **Auto-Sorting**: Tasks automatically shift in real-time, bubble-sorting high-priority action items to the top of your checklist.

### 2. Smart Calendar & Conflict Coordinator
A visual timeline representation mapping fixed schedules and AI-proposed sessions.
*   **Dynamic conflict detection**: Flags overlapping events (e.g. fixed meetings overlapping with gym routines) and displays a warnings panel.
*   **Resolution Triggers**: Provides micro-actions to reschedule conflicting events automatically.

### 3. Habit Loop Tracker
Encourages daily reinforcement with custom streaks and progress logging.
*   Supports **Habits** (frequency-based trackers) and **Milestone Goals** (target date trackers).
*   Displays streaking scores and interactive checklist subtasks.

### 4. Proactive Nudge Feed
Dispatches context-aware alerts containing autonomous proposals.
*   **Urgency Escalation**: Suggests scheduling immediate study blocks when a deadline is less than 24 hours away.
*   **Autonomous Action**: Pre-drafts email requests for extensions (e.g., to professors or clients) when procrastination risks are high.

### 5. Conversational AI Companion
An interactive text channel where users can query NudgeAI.
*   Quick actions for immediate focus suggestions, deadline analysis, and conflict resolutions.


---

## 🎨 Design System & Aesthetics

NudgeAI is built with a premium **dark glassmorphic UI**:
*   **Theme Palette**: Sleek dark space background (`#0a0e1a`) with custom radial gradients in indigo, royal blue, and cyan.
*   **Typography**: Clean displaying styling using Google Fonts (`Outfit` for display headings, `Inter` for main panels).
*   **Interactive Micro-animations**: Smooth hover transitions, scale effects on buttons, and active status breathing glow widgets.

---

## 🛠️ File Structure

The project has been restored to a clean, zero-configuration client-side application:
*   [index.html](index.html): Document layout, view structure panels, modals, and CDN dependencies.
*   [style.css](style.css): Custom CSS variables, responsive grid coordinates, custom scrollbars, and animations.
*   [app.js](app.js): Application state manager, priority calculation algorithms, calendar slot resolvers, chat history arrays, and simulation step scripts.

---

## 💻 How to Run Locally

Since NudgeAI is fully client-side:
1. Double-click the [index.html](index.html) file, or drag and drop it into any modern web browser.
2. Alternatively, run a lightweight local static web server in the directory:
   ```bash
   # Python 3
   python -m http.server 3000
   ```
   Then navigate to `http://localhost:3000` in your web browser.
