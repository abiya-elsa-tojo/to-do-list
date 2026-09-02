# TaskFlow &bull; Modern Responsive Task Board

A sleek, modern Kanban-style task management web application built with **pure HTML5, CSS3, and Vanilla JavaScript** (zero external framework dependencies).

---

## ✨ Features

- **🚀 Clean Start State**: Starts with an uncluttered empty state ready for your tasks.
- **📋 Kanban Workflow Columns**:
  - `To Do`
  - `In Progress`
  - `Under Review`
  - `Completed`
- **🎯 Rich Task Management**:
  - Task title, description, priority (*Low, Medium, High, Urgent*), due date indicators (*Overdue, Due Soon*), and custom category tags.
  - Interactive **Subtasks / Checklist** with live completion progress bar.
  - Full CRUD: Create, Edit, Duplicate, Delete, and Move tasks.
- **🖱️ Native HTML5 Drag and Drop**: Smooth drag-and-drop workflow across columns, plus mobile-friendly quick-move fallback selectors.
- **🔍 Instant Search & Filtering**:
  - Real-time search across titles, descriptions, tags, and checklist items.
  - Filter by priority or dynamic category tags.
  - Sort by Newest, Oldest, Due Date, or Priority.
- **📊 Live Productivity Metrics**:
  - Realtime counters for Total Tasks, In Progress, Completion Rate (%), and Overdue items.
- **🌓 Dark & Light Theme**: Built-in glassmorphic dark and light modes with persistent user preference.
- **💾 Local Storage & Portability**:
  - Automatic browser storage persistence.
  - Export tasks backup as JSON & Import from JSON.
  - Confirmation modals for destructive actions.
- **📱 Fully Responsive**: Optimized for desktop, tablet, and mobile screens.

---

## 🛠️ Technology Stack

- **HTML5**: Semantic markup, accessible modal dialogs, and metadata.
- **Vanilla CSS3**: Modern design tokens, glassmorphism, responsive grid & flexbox, micro-animations.
- **Vanilla JavaScript (ES6+)**: Modular architecture, LocalStorage API, Drag & Drop API, dynamic DOM rendering.
- **Typography**: Google Fonts (*Outfit* & *Inter*).

---

## 🚀 Getting Started

Simply open `index.html` in any modern web browser or serve via a local web server:

```bash
# Using Python
python -m http.server 3000

# Or using Node.js npx serve
npx serve .
```
