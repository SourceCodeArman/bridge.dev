# Command for AI Agents: Generate TASKS.md

Use this prompt to instruct an AI agent to generate a TASKS.md file based on a PRD:

---

**PROMPT:**

Generate a TASKS.md file based on the provided PRD (Product Requirements Document). The file must follow this exact structure and format for compatibility with our task management CLI tool:

## Required Structure

1. **Header Section:**
   ```
   # Bridge.dev - Development Task List
   
   This document outlines all tasks needed to build the MVP of Bridge.dev, a no-code integration platform.
   
   **Last Updated:** [Date]
   **Status:** [Status description]
   
   ---
   ```

2. **Phase Sections:**
   Organize tasks into phases (e.g., "Phase 1: Foundation", "Phase 2: Core Features", "Phase 3: Polish & Scale"). Each phase should have descriptive subsections.

3. **Task Format (CRITICAL - must match exactly):**
   Each task must use this exact format:
   ```
   - [ ] [NUMBER]. **[TASK TITLE]**
     - [ ] Subtask 1
     - [ ] Subtask 2
     - [x] Completed subtask (if any)
   ```
   
   **Important rules:**
   - Use `- [ ]` for incomplete tasks, `- [x]` for completed
   - Number must be followed by a period and space: `23.`
   - Title must be wrapped in double asterisks: `**Title**`
   - Subtasks are indented with 2 spaces and use same checkbox format

4. **Task Priority & Dependency Chart (REQUIRED):**
   Must include a markdown table at the end with this exact format:
   ```
   ## Task Priority & Dependency Chart
   
    ----------------------------------------------------
   | TASK | PRIORITY |              DEPS                |
    ----------------------------------------------------
   |  1   |   HIGH   |   0                              |
   |  2   |   HIGH   |   1                              |
   |  23  |   HIGH   |   7,19                           |
    ----------------------------------------------------
   ```
   
   **Critical formatting rules:**
   - Table rows must start with `|` and end with `|`
   - Task number in first column (no leading zeros except for single digits)
   - Priority must be exactly: `HIGH`, `MED`, or `LOW` (all caps)
   - Dependencies column: Use `0` or `NONE` for no dependencies, comma-separated numbers for dependencies (e.g., `7,19` or `1,2,3`)
   - Must include header row and separator row

5. **Additional Sections (optional but recommended):**
   - Progress Tracking section with task counts
   - Completed Tasks section with checkmarks
   - Notes section
   - Recommended Starting Order section

## Validation Requirements

1. Every numbered task in the main content must have a corresponding row in the dependency chart
2. Dependency numbers must reference actual task numbers that exist
3. Task numbers should be sequential (no gaps required, but logical ordering preferred)
4. All task titles must be wrapped in `**double asterisks**`
5. All checkboxes must use the exact format: `- [ ]` or `- [x]`

## Example Task Entry:
```
- [ ] 23. **Add API access management for users**
  - [ ] Create API keys management section in Settings page
  - [ ] Implement API key generation endpoint (backend)
  - [ ] Display list of user's API keys
  - [ ] Allow users to create new API keys
  - [ ] Implement API key rotation/regeneration
```

## Example Dependency Chart Row:
```
|  23  |   HIGH   |   7,19                           |
```

## Instructions:

1. Read the provided PRD carefully
2. Break down the requirements into discrete, actionable tasks
3. Assign each task a unique number (starting from 1, incrementing sequentially)
4. Group related tasks into logical phases
5. Determine dependencies: which tasks must be completed before others can start
6. Assign priorities: HIGH (critical path), MED (important but not blocking), LOW (nice to have)
7. Generate the TASKS.md file with the exact structure above
8. Ensure all formatting matches the examples exactly (especially spacing, checkbox format, and table structure)

## Critical: Test Your Output

After generating, verify the file can be parsed by checking:
- All task lines match: `^- \[( |x)\]\s+(\d+)\.\s+\*\*(.+?)\*\*`
- All dependency chart rows match: `^\|\s*(\d+)\s*\|\s*(HIGH|MED|LOW)\s*\|\s*([A-Za-z0-9,\s]+?)\s*\|$`
- Every numbered task has a dependency chart entry
- No syntax errors in markdown tables

Generate the complete TASKS.md file now.

