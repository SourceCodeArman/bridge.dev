#!/usr/bin/env node

/**
 * Bridge.dev Task Recommender
 *
 * Reads TASKS.md from the repo root, parses numbered tasks + the
 * "Task Priority & Dependency Chart", and prints colorful
 * recommendations for what to work on next based on:
 *   - Priority (HIGH > MED > LOW)
 *   - Dependencies (only tasks whose deps are all completed)
 *
 * Usage:
 *   From the repo root run:
 *     node tasks-cli.js
 *
 * (Or make it executable: chmod +x tasks-cli.js && ./tasks-cli.js)
 */

const fs = require('fs');
const path = require('path');

// --- Simple ANSI color helpers (no external deps) ---
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const PRIORITY_ORDER = { HIGH: 0, MED: 1, LOW: 2 };

// Matches lines like:
// - [x] 1. **Create Django database models**
// - [~] 1. **Create Django database models** (in progress)
// - [ ] 1. **Create Django database models** (pending)
const taskLineRegex = /^- \[( |x|~)\]\s+(\d+)\.\s+\*\*(.+?)\*\*/;

// Matches rows in the priority/deps table, e.g.:
// |  1   |   HIGH   |   0                              |
const depsRowRegex = /^\|\s*(\d+)\s*\|\s*(HIGH|MED|LOW)\s*\|\s*([A-Za-z0-9,\s]+?)\s*\|$/;

function bold(text) {
  return colors.bold + text + colors.reset;
}

function colorPriority(p) {
  if (p === 'HIGH') return colors.red + p + colors.reset;
  if (p === 'MED') return colors.yellow + p + colors.reset;
  return colors.green + p + colors.reset;
}

function colorTaskId(id) {
  return colors.cyan + id + colors.reset;
}

function colorDeps(deps) {
  if (!deps || deps.length === 0) {
    return colors.gray + 'none' + colors.reset;
  }
  return colors.magenta + deps.join(', ') + colors.reset;
}

function findRepoRoot(startDir) {
  // Walk up until we find TASKS.md or reach filesystem root
  let current = startDir;
  while (true) {
    // Check root level
    const candidate = path.join(current, 'TASKS.md');
    if (fs.existsSync(candidate)) {
      return current;
    }
    // Check custom-task-manager subdirectory
    const customTaskManagerPath = path.join(current, 'custom-task-manager', 'TASKS.md');
    if (fs.existsSync(customTaskManagerPath)) {
      return path.join(current, 'custom-task-manager');
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return startDir;
}

function parseTasks(markdown) {
  const tasks = new Map();
  const lines = markdown.split('\n');
  const subtaskRegex = /^(\s{2})- \[( |x|~)\]\s+(.+)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = taskLineRegex.exec(line.trim());
    if (!match) continue;
    
    const [, statusFlag, idStr, title] = match;
    const id = Number(idStr);
    const status = statusFlag === 'x' ? 'done' : statusFlag === '~' ? 'in-progress' : 'pending';
    
    // Parse subtasks (indented lines following the main task)
    const subtasks = [];
    let j = i + 1;
    while (j < lines.length) {
      const nextLine = lines[j];
      // Check if it's a subtask (2 spaces indent, checkbox)
      const subtaskMatch = subtaskRegex.exec(nextLine);
      if (subtaskMatch) {
        const [, , subtaskStatus, subtaskTitle] = subtaskMatch;
        const subtaskStatusValue = subtaskStatus === 'x' ? 'done' : subtaskStatus === '~' ? 'in-progress' : 'pending';
        subtasks.push({
          title: subtaskTitle.trim(),
          status: subtaskStatusValue,
          done: subtaskStatusValue === 'done'
        });
        j++;
      } else if (nextLine.trim() === '' || nextLine.match(/^##/)) {
        // Empty line or new section - stop collecting subtasks
        break;
      } else if (taskLineRegex.exec(nextLine.trim())) {
        // Next main task - stop collecting subtasks
        break;
      } else {
        // Not a subtask, not empty, not a new section - might be continuation, skip
        j++;
      }
    }
    
    tasks.set(id, { 
      id, 
      title: title.trim(), 
      done: status === 'done', 
      status,
      subtasks 
    });
  }

  return tasks;
}

function parsePriorityDeps(markdown) {
  const lines = markdown.split('\n');
  const startIndex = lines.findIndex((l) =>
    l.includes('## Task Priority & Dependency Chart')
  );
  if (startIndex === -1) {
    return new Map();
  }

  const meta = new Map();

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) continue;

    const match = depsRowRegex.exec(line);
    if (!match) continue;

    const [, idStr, priority, depsStrRaw] = match;
    const id = Number(idStr);
    const depsStr = depsStrRaw.trim();

    let deps = [];
    if (depsStr !== '0' && depsStr.toUpperCase() !== 'NONE') {
      deps = depsStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => Number(s))
        .filter((n) => !Number.isNaN(n));
    }

    meta.set(id, { id, priority, deps });
  }

  return meta;
}

function computeProgress(tasks) {
  let done = 0;
  let inProgress = 0;
  let pending = 0;
  const total = tasks.size;

  for (const [id, info] of tasks.entries()) {
    if (info.status === 'done') done++;
    else if (info.status === 'in-progress') inProgress++;
    else pending++;
  }

  const percentage = total > 0 ? Math.round((done / total) * 100) : 0;

  return { done, inProgress, pending, total, percentage };
}

function computeReadyTasks(tasks, meta) {
  const ready = [];

  for (const [id, info] of tasks.entries()) {
    if (info.done) continue;
    const metaInfo = meta.get(id);
    if (!metaInfo) continue;

    const deps = metaInfo.deps || [];
    const allDepsDone = deps.every((depId) => {
      const dep = tasks.get(depId);
      return dep && dep.done;
    });

    if (!allDepsDone) continue;

    ready.push({ id, task: info, meta: metaInfo });
  }

  ready.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.meta.priority] ?? 99;
    const pb = PRIORITY_ORDER[b.meta.priority] ?? 99;
    if (pa !== pb) return pa - pb;
    return a.id - b.id;
  });

  return ready;
}

function printProgressBar(percentage, width = 40) {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  
  let barColor = colors.green;
  if (percentage === 0) barColor = colors.gray;
  else if (percentage < 25) barColor = colors.red;
  else if (percentage < 50) barColor = colors.yellow;
  else if (percentage < 75) barColor = colors.cyan;
  
  const filledBar = filled > 0 ? barColor + '█'.repeat(filled) : '';
  const emptyBar = colors.gray + '░'.repeat(empty) + colors.reset;
  return filledBar + emptyBar;
}

function printProgress(progress) {
  console.log(bold('📊 Progress Overview\n'));
  
  // Progress bar
  const bar = printProgressBar(progress.percentage, 40);
  console.log(`  ${bar} ${colors.bold}${progress.percentage}%${colors.reset}\n`);
  
  // Statistics
  const stats = [
    { label: '✅ Done', value: progress.done, color: colors.green },
    { label: '🔄 In Progress', value: progress.inProgress, color: colors.yellow },
    { label: '⏳ Pending', value: progress.pending, color: colors.gray },
    { label: '📋 Total', value: progress.total, color: colors.cyan },
  ];
  
  const maxLabelLen = Math.max(...stats.map(s => s.label.length));
  
  for (const stat of stats) {
    const paddedLabel = stat.label.padEnd(maxLabelLen);
    const valueColor = stat.color;
    console.log(`  ${paddedLabel}: ${valueColor}${stat.value}${colors.reset}`);
  }
  
  console.log('');
  console.log(colors.gray + '─'.repeat(60) + colors.reset);
  console.log('');
}

function printHeader() {
  const title = bold('Bridge.dev Task Recommender');
  const subtitle = `${colors.gray}Based on TASKS.md priorities & dependencies${colors.reset}`;
  console.log(`${title}\n${subtitle}\n`);
}

function printRecommendations(ready) {
  if (ready.length === 0) {
    console.log(
      colors.green +
        'All tasks with satisfied dependencies are complete! 🎉' +
        colors.reset
    );
    console.log(
      colors.gray +
        'Update TASKS.md or adjust the priority/dependency chart if needed.' +
        colors.reset
    );
    return;
  }

  const top = ready.slice(0, 3);
  const rows = top.map(({ id, task, meta }) => ({
    id,
    title: task.title,
    prio: meta.priority,
    deps: meta.deps,
  }));

  // Table rendering
  const headers = ['TASK', 'PRIORITY', 'DEPS', 'TITLE'];

  const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
  const visibleLen = (s) => stripAnsi(String(s)).length;

  const colWidths = {
    TASK: Math.max(4, ...rows.map((r) => visibleLen(r.id))),
    PRIORITY: Math.max(8, ...rows.map((r) => visibleLen(r.prio))),
    DEPS: Math.max(
      4,
      ...rows.map((r) => {
        const raw = r.deps.length ? r.deps.join(', ') : 'none';
        return visibleLen(raw);
      })
    ),
    TITLE: Math.max(5, ...rows.map((r) => visibleLen(r.title))),
  };

  function pad(str, width) {
    const s = String(str);
    const len = visibleLen(s);
    if (len >= width) return s;
    return s + ' '.repeat(width - len);
  }

  function border() {
    return (
      '+' +
      '-'.repeat(colWidths.TASK + 2) +
      '+' +
      '-'.repeat(colWidths.PRIORITY + 2) +
      '+' +
      '-'.repeat(colWidths.DEPS + 2) +
      '+' +
      '-'.repeat(colWidths.TITLE + 2) +
      '+'
    );
  }

  console.log(bold('Top 3 Recommendations (ready now):'));
  console.log(border());
  console.log(
    `| ${pad(headers[0], colWidths.TASK)} | ${pad(
      headers[1],
      colWidths.PRIORITY
    )} | ${pad(headers[2], colWidths.DEPS)} | ${pad(
      headers[3],
      colWidths.TITLE
    )} |`
  );
  console.log(border());

  for (const r of rows) {
    const prio = colorPriority(r.prio);
    const depsStrRaw = r.deps.length ? r.deps.join(', ') : 'none';
    const depsCol =
      r.deps.length === 0
        ? colorDeps([])
        : colors.magenta + depsStrRaw + colors.reset;
    console.log(
      `| ${pad(colorTaskId(r.id), colWidths.TASK)} | ${pad(
        prio,
        colWidths.PRIORITY
      )} | ${pad(depsCol, colWidths.DEPS)} | ${pad(r.title, colWidths.TITLE)} |`
    );
  }
  console.log(border());

  if (ready.length > 3) {
    console.log(
      colors.gray +
        `...and ${ready.length - 3} more tasks are ready (sorted by priority, then id).` +
        colors.reset
    );
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  
  for (const arg of args) {
    if (arg.startsWith('--id=')) {
      parsed.id = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--set-status=')) {
      parsed.status = arg.split('=')[1].toLowerCase();
    } else if (arg.startsWith('--show-task=') || arg.startsWith('--task=')) {
      parsed.showTask = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    }
  }
  
  return parsed;
}

function updateTaskStatus(markdown, taskId, newStatus) {
  // Map status to checkbox marker
  const statusMap = {
    'done': 'x',
    'in-progress': '~',
    'inprogress': '~',
    'pending': ' ',
  };
  
  const marker = statusMap[newStatus];
  if (marker === undefined) {
    throw new Error(`Invalid status: ${newStatus}. Use: done, in-progress, or pending`);
  }
  
  // Find and replace the task line
  const lines = markdown.split('\n');
  let found = false;
  let updated = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = taskLineRegex.exec(line.trim());
    
    if (match) {
      const [, currentMarker, idStr] = match;
      const id = Number(idStr);
      
      if (id === taskId) {
        found = true;
        // Replace the marker in the original line (preserve indentation)
        const newLine = line.replace(/^(\s*)- \[( |x|~)\]/, `$1- [${marker}]`);
        if (newLine !== line) {
          lines[i] = newLine;
          updated = true;
        }
        break;
      }
    }
  }
  
  if (!found) {
    throw new Error(`Task ${taskId} not found in TASKS.md`);
  }
  
  if (!updated) {
    throw new Error(`Task ${taskId} is already marked as ${newStatus}`);
  }
  
  return lines.join('\n');
}

function updateProgressSummary(markdown, tasks) {
  const progress = computeProgress(tasks);
  
  // Find and update the progress summary section
  const lines = markdown.split('\n');
  const summaryStart = lines.findIndex((l) => 
    l.includes('## Progress Summary')
  );
  
  if (summaryStart === -1) {
    return markdown; // No summary section found, skip update
  }
  
  // Find the status line
  for (let i = summaryStart; i < lines.length && i < summaryStart + 10; i++) {
    if (lines[i].includes('**Status:**')) {
      lines[i] = `**Status:** ${progress.done} done | ${progress.pending} pending | ${progress.inProgress} in progress`;
      break;
    }
  }
  
  // Find the completion line
  for (let i = summaryStart; i < lines.length && i < summaryStart + 10; i++) {
    if (lines[i].includes('**Completion:**')) {
      lines[i] = `**Completion:** ${progress.percentage}% (${progress.done}/${progress.total} tasks completed)`;
      break;
    }
  }
  
  return lines.join('\n');
}

function printTaskDetails(taskId, task, meta, tasks) {
  if (!task) {
    console.error(colors.red + `Task ${taskId} not found.` + colors.reset);
    process.exit(1);
  }
  
  console.log(bold(`Task ${colorTaskId(taskId)}: ${task.title}\n`));
  
  // Status
  const statusDisplay = task.status === 'done' ? colors.green + '✅ Done' + colors.reset :
                       task.status === 'in-progress' ? colors.yellow + '🔄 In Progress' + colors.reset :
                       colors.gray + '⏳ Pending' + colors.reset;
  console.log(`  Status: ${statusDisplay}`);
  
  // Priority
  if (meta) {
    const priorityDisplay = colorPriority(meta.priority);
    console.log(`  Priority: ${priorityDisplay}`);
    
    // Dependencies
    const deps = meta.deps || [];
    if (deps.length > 0) {
      const depsStatus = deps.map(depId => {
        const dep = tasks.get(depId);
        if (!dep) return `${depId} (not found)`;
        const icon = dep.done ? '✅' : dep.status === 'in-progress' ? '🔄' : '⏳';
        const status = dep.done ? colors.green : dep.status === 'in-progress' ? colors.yellow : colors.gray;
        return `${icon} ${status}Task ${depId}${colors.reset}`;
      });
      
      const allDepsDone = deps.every(depId => {
        const dep = tasks.get(depId);
        return dep && dep.done;
      });
      
      const depsStatusIcon = allDepsDone ? colors.green + '✅' : colors.yellow + '⏳';
      const depsStatusText = allDepsDone ? 'All dependencies satisfied' : 'Some dependencies pending';
      
      console.log(`  Dependencies: ${depsStatusIcon} ${depsStatusText}${colors.reset}`);
      console.log(`    ${depsStatus.join('\n    ')}`);
    } else {
      console.log(`  Dependencies: ${colors.gray}none${colors.reset}`);
    }
  }
  
  // Subtasks
  if (task.subtasks && task.subtasks.length > 0) {
    console.log(`  Subtasks:`);
    const allSubtasksDone = task.subtasks.every(st => st.done);
    const doneCount = task.subtasks.filter(st => st.done).length;
    const inProgressCount = task.subtasks.filter(st => st.status === 'in-progress').length;
    const pendingCount = task.subtasks.filter(st => st.status === 'pending').length;
    
    console.log(`    ${colors.gray}Progress: ${doneCount}/${task.subtasks.length} done${colors.reset}`);
    
    for (const subtask of task.subtasks) {
      const subtaskIcon = subtask.done ? '✅' : subtask.status === 'in-progress' ? '🔄' : '☐';
      const subtaskColor = subtask.done ? colors.green : subtask.status === 'in-progress' ? colors.yellow : colors.gray;
      console.log(`    ${subtaskIcon} ${subtaskColor}${subtask.title}${colors.reset}`);
    }
  }
  
  console.log('');
}

function printHelp() {
  console.log(bold('Bridge.dev Task Manager - CLI Usage\n'));
  console.log('Usage:');
  console.log('  node tasks-cli.js                    # Show progress and recommendations');
  console.log('  node tasks-cli.js --id=N --set-status=STATUS  # Update task status');
  console.log('  node tasks-cli.js --show-task=N      # Show details for a specific task\n');
  console.log('Options:');
  console.log('  --id=N              Task ID to update (required for status updates)');
  console.log('  --set-status=STATUS Status to set: done, in-progress, or pending');
  console.log('  --show-task=N       Show detailed information about a task');
  console.log('  --task=N            Alias for --show-task=N');
  console.log('  --help, -h          Show this help message\n');
  console.log('Examples:');
  console.log(`  ${colors.cyan}node tasks-cli.js --id=1 --set-status=done${colors.reset}`);
  console.log(`  ${colors.cyan}node tasks-cli.js --id=5 --set-status=in-progress${colors.reset}`);
  console.log(`  ${colors.cyan}node tasks-cli.js --show-task=1${colors.reset}`);
  console.log(`  ${colors.cyan}node tasks-cli.js --task=5${colors.reset}`);
  console.log('');
}

function main() {
  const args = parseArgs();
  
  // Show help if requested
  if (args.help) {
    printHelp();
    process.exit(0);
  }
  
  const cwd = process.cwd();
  const root = findRepoRoot(cwd);
  const tasksPath = path.join(root, 'TASKS.md');

  if (!fs.existsSync(tasksPath)) {
    console.error(
      colors.red +
        `Could not find TASKS.md (looked starting from ${cwd}).` +
        colors.reset
    );
    process.exit(1);
  }

  // Handle show task
  if (args.showTask !== undefined) {
    const markdown = fs.readFileSync(tasksPath, 'utf8');
    const tasks = parseTasks(markdown);
    const meta = parsePriorityDeps(markdown);
    
    const task = tasks.get(args.showTask);
    const taskMeta = meta.get(args.showTask);
    
    printHeader();
    printTaskDetails(args.showTask, task, taskMeta, tasks);
    
    // Show if task is ready to work on
    if (task && !task.done) {
      const deps = taskMeta?.deps || [];
      const allDepsDone = deps.every(depId => {
        const dep = tasks.get(depId);
        return dep && dep.done;
      });
      
      if (allDepsDone && deps.length > 0) {
        console.log(colors.green + '✅ Ready to work on! All dependencies are satisfied.' + colors.reset);
      } else if (deps.length > 0) {
        console.log(colors.yellow + '⏳ Waiting for dependencies to be completed.' + colors.reset);
      } else {
        console.log(colors.cyan + '🚀 Ready to work on! No dependencies.' + colors.reset);
      }
    }
    
    return;
  }
  
  // Handle status update
  if (args.id !== undefined && args.status) {
    try {
      let markdown = fs.readFileSync(tasksPath, 'utf8');
      
      // Update task status
      markdown = updateTaskStatus(markdown, args.id, args.status);
      
      // Re-parse to get updated task list
      const tasks = parseTasks(markdown);
      
      // Update progress summary
      markdown = updateProgressSummary(markdown, tasks);
      
      // Write back to file
      fs.writeFileSync(tasksPath, markdown, 'utf8');
      
      // Show confirmation
      const statusDisplay = args.status === 'done' ? colors.green + '✅ done' + colors.reset :
                           args.status === 'in-progress' || args.status === 'inprogress' ? 
                           colors.yellow + '🔄 in progress' + colors.reset :
                           colors.gray + '⏳ pending' + colors.reset;
      
      const task = tasks.get(args.id);
      const taskTitle = task ? task.title : `Task ${args.id}`;
      
      console.log(bold('Task Updated Successfully!\n'));
      console.log(`  Task ${colors.cyan}${args.id}${colors.reset}: ${bold(taskTitle)}`);
      console.log(`  Status: ${statusDisplay}\n`);
      
      // Show updated progress
      const progress = computeProgress(tasks);
      printProgress(progress);
      
    } catch (error) {
      console.error(colors.red + 'Error: ' + error.message + colors.reset);
      process.exit(1);
    }
    return;
  }
  
  // Default: show progress and recommendations
  const markdown = fs.readFileSync(tasksPath, 'utf8');
  const tasks = parseTasks(markdown);
  const meta = parsePriorityDeps(markdown);

  printHeader();

  if (tasks.size === 0 || meta.size === 0) {
    console.log(
      colors.red +
        'No tasks or priority/dependency metadata found in TASKS.md.' +
        colors.reset
    );
    console.log(
      colors.gray +
        'Ensure tasks are numbered like "- [ ] 23. **Title**" and the chart is present.' +
        colors.reset
    );
    process.exit(1);
  }

  // Calculate and display progress
  const progress = computeProgress(tasks);
  printProgress(progress);

  const ready = computeReadyTasks(tasks, meta);
  printRecommendations(ready);
}

if (require.main === module) {
  main();
}


