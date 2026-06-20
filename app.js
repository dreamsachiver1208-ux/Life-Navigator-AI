import { AgentOrchestrator, GOAL_TEMPLATES } from './agents.js';

// Global Application State
let orchestrator = new AgentOrchestrator();
let selectedTemplate = null;
let chartInstance = null;
let currentEnergyLevel = "Medium";
let activeBoardMilestoneIdx = 0;
let savedScenarios = [];

// Initialize Page
document.addEventListener('DOMContentLoaded', () => {
  // Bind Nav Elements
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const target = item.getAttribute('data-target');
      switchView(target);
    });
  });

  // Init Icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Bind Terminal Commands
  const terminalInput = document.getElementById('terminal-input');
  if (terminalInput) {
    terminalInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleTerminalCommand();
      }
    });
  }

  // Load state from localStorage if available
  loadSavedGoal();
});

// View Navigation Controller
window.switchView = function(viewId) {
  // Update nav active styling
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('data-target') === viewId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Hide all panels
  document.querySelectorAll('.content-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  // Show active panel
  const activePanel = document.getElementById(viewId);
  if (activePanel) {
    activePanel.classList.add('active');
  }

  // Update top status bar title
  const titleMap = {
    'dashboard-view': 'Dashboard Overview',
    'wizard-view': 'Goal Strategist Wizard',
    'roadmap-view': 'Milestone Roadmap Board',
    'simulation-view': 'Future Simulation Engine',
    'nexus-view': 'Agent Nexus Control'
  };
  document.getElementById('bar-title').innerText = titleMap[viewId] || 'Life Navigator';

  // Trigger specialized view renders
  if (viewId === 'simulation-view') {
    initOrUpdateChart();
  }
};

// Select Goal Template in Wizard
window.selectTemplate = function(templateId) {
  selectedTemplate = templateId;
  
  // Update template cards visual selected state
  document.querySelectorAll('.template-card').forEach(card => {
    card.classList.remove('selected');
  });
  
  const selectedCard = document.getElementById(`temp-${templateId}`);
  if (selectedCard) {
    selectedCard.classList.add('selected');
  }

  // Prepopulate custom goal description
  const template = GOAL_TEMPLATES[templateId];
  if (template) {
    document.getElementById('custom-goal-text').value = template.description;
    document.getElementById('weekly-hours').value = Math.round(template.baseHoursNeeded / 15); // suggest default
    document.getElementById('slider-hours-val').innerText = document.getElementById('weekly-hours').value;
    
    // Auto-select category
    const catSelect = document.getElementById('goal-category');
    for (let i = 0; i < catSelect.options.length; i++) {
      if (catSelect.options[i].value === template.category) {
        catSelect.selectedIndex = i;
        break;
      }
    }
  }
};

// Generate Strategic Roadmap
window.generateGoalRoadmap = function() {
  const customText = document.getElementById('custom-goal-text').value.trim();
  const weeklyHours = parseInt(document.getElementById('weekly-hours').value);
  const category = document.getElementById('goal-category').value;
  const skill = document.getElementById('skill-level').value;
  const constraints = document.getElementById('constraints-text').value.trim();

  if (!customText) {
    alert("Please enter a goal description or select a template first.");
    return;
  }

  // Run Orchestrator Goal Initialization
  const result = orchestrator.initiateGoal(customText, weeklyHours, constraints);
  
  // Save to LocalStorage
  saveGoalToStorage();

  // Load into terminal logs
  renderLogs(result.logs);

  // Set active board milestone
  activeBoardMilestoneIdx = 0;

  // Refresh UI
  updateDashboardUI();
  updateRoadmapUI();
  updateSimulationUI();
  
  // Transition View to Dashboard
  switchView('dashboard-view');
  
  // Animate Terminal Activity Alert
  setTimeout(() => {
    appendSystemLog("Planning Agent (Atlas) successfully pushed strategy parameters to Recommendation Engine.");
  }, 1000);
};

// Update UI Panels based on Active Goal
function updateDashboardUI() {
  const emptyState = document.getElementById('dashboard-empty-state');
  const activeState = document.getElementById('dashboard-active-state');
  const badge = document.getElementById('active-goal-badge');
  const goalName = document.getElementById('active-goal-name');

  if (!orchestrator.activeRoadmap) {
    emptyState.style.display = 'flex';
    activeState.style.display = 'none';
    badge.style.display = 'none';
    return;
  }

  // Goal loaded
  emptyState.style.display = 'none';
  activeState.style.display = 'grid';
  badge.style.display = 'flex';
  
  const title = orchestrator.activeGoal.title;
  goalName.innerText = title.length > 25 ? title.substring(0, 22) + "..." : title;
  
  // Dashboard Text details
  document.getElementById('dashboard-goal-desc').innerText = orchestrator.activeGoal.description;
  document.getElementById('dash-meta-hours').innerText = `${orchestrator.activeGoal.baseHoursNeeded} hrs`;
  document.getElementById('dash-meta-budget').innerText = `${orchestrator.activeRoadmap.hoursPerWeek} hrs/wk`;
  document.getElementById('dash-meta-weeks').innerText = `${orchestrator.activeRoadmap.totalWeeks} wks`;

  // Stats Card
  document.getElementById('stat-progress').innerText = `${orchestrator.activeRoadmap.progressPercentage}%`;
  document.getElementById('stat-velocity').innerText = `${orchestrator.activeRoadmap.velocityIndex}%`;
  
  // Streak calculations
  const streak = Math.round(orchestrator.activeRoadmap.progressPercentage * 0.3 + 1);
  document.getElementById('stat-streak').innerText = `${streak} Days`;

  // Render Daily Recommendation Action
  renderRecommendation();

  // Render Dashboard Milestone Sidebar List
  renderMiniRoadmap();
}

function renderMiniRoadmap() {
  const container = document.getElementById('mini-roadmap-list');
  container.innerHTML = '';

  orchestrator.activeRoadmap.milestones.forEach((m, idx) => {
    const isActive = idx === orchestrator.activeRoadmap.currentMilestoneIndex;
    const isCompleted = m.completed;
    
    let statusClass = '';
    if (isCompleted) statusClass = 'completed';
    else if (isActive) statusClass = 'active';

    const item = document.createElement('div');
    item.className = `milestone-item ${statusClass}`;
    item.onclick = () => {
      activeBoardMilestoneIdx = idx;
      updateRoadmapUI();
      switchView('roadmap-view');
    };

    item.innerHTML = `
      <div>
        <div class="milestone-title-text" style="color: ${isActive ? 'var(--color-purple)' : 'var(--text-primary)'}">${m.title}</div>
        <div class="milestone-sub-lbl">${m.durationWeeks} weeks • ${m.weeklyDistribution.reduce((acc, w)=>acc+w.tasks.length, 0)} tasks</div>
      </div>
      <div class="milestone-dot"></div>
    `;
    container.appendChild(item);
  });
}

function renderRecommendation() {
  const rec = orchestrator.agents.recommendation.generateNextAction(orchestrator.messageBus, orchestrator.activeRoadmap, currentEnergyLevel);
  
  document.getElementById('action-title').innerText = rec.taskName;
  document.getElementById('action-reason').innerText = rec.reason;
  document.getElementById('action-time').innerText = `${rec.estimatedMinutes} mins`;
}

// Adjust energy slider on recommender card
window.adjustEnergy = function(energy) {
  currentEnergyLevel = energy;
  
  // Highlight buttons
  document.getElementById('energy-low').classList.remove('active');
  document.getElementById('energy-medium').classList.remove('active');
  document.getElementById('energy-high').classList.remove('active');

  document.getElementById(`energy-${energy.toLowerCase()}`).classList.add('active');

  renderRecommendation();
};

// Complete recommended item
window.completeRecommendedAction = function() {
  if (!orchestrator.activeRoadmap) return;

  const currentM = orchestrator.activeRoadmap.milestones[orchestrator.activeRoadmap.currentMilestoneIndex];
  if (!currentM) return;

  const currentWIdx = Math.min(currentM.weeklyDistribution.length - 1, orchestrator.activeRoadmap.currentWeekIndex - 1);
  const week = currentM.weeklyDistribution[currentWIdx];
  
  // Find first incomplete task
  const task = week.tasks.find(t => !t.completed);
  if (task) {
    // Complete it in the orchestrator
    const taskIdx = week.tasks.indexOf(task);
    const result = orchestrator.toggleTaskCompletion(currentM.id, currentWIdx, taskIdx);
    
    // Save state
    saveGoalToStorage();

    // Render Logs & UI
    renderLogs(result.logs);
    updateDashboardUI();
    updateRoadmapUI();
    updateSimulationUI();
    
    appendSystemLog(`[Progress Tracker] Task completed: "${task.name}". Overall progress: ${orchestrator.activeRoadmap.progressPercentage}%`);
  }
};

// Simulate missing tasks
window.simulateSlackDay = function() {
  if (!orchestrator.activeRoadmap) return;

  // Let's assume user missed 2 tasks this week
  const result = orchestrator.simulateMissedDays(2);
  
  saveGoalToStorage();
  
  renderLogs(result.logs);
  updateDashboardUI();
  updateRoadmapUI();
  updateSimulationUI();
  
  appendSystemLog("CRITICAL: Missed targets triggered adaptive re-planning meeting. Review updated roadmap board.", "warning");
};

// ROADMAP VIEW BOARD RENDER
function updateRoadmapUI() {
  const empty = document.getElementById('roadmap-empty-state');
  const active = document.getElementById('roadmap-active-state');

  if (!orchestrator.activeRoadmap) {
    empty.style.display = 'flex';
    active.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  active.style.display = 'grid';

  // Render Milestones vertical sidebar
  const mList = document.getElementById('board-milestone-list');
  mList.innerHTML = '';

  orchestrator.activeRoadmap.milestones.forEach((m, idx) => {
    const isCompleted = m.completed;
    const isSelected = idx === activeBoardMilestoneIdx;
    
    let statusClass = '';
    if (isCompleted) statusClass = 'completed';
    else if (isSelected) statusClass = 'active';

    const item = document.createElement('div');
    item.className = `milestone-item ${statusClass}`;
    item.onclick = () => {
      activeBoardMilestoneIdx = idx;
      updateRoadmapUI();
    };

    item.innerHTML = `
      <div>
        <div class="milestone-title-text">${m.title}</div>
        <div class="milestone-sub-lbl">${m.durationWeeks} weeks • ${m.completed ? 'COMPLETED' : 'IN PROGRESS'}</div>
      </div>
      <div class="milestone-dot"></div>
    `;
    mList.appendChild(item);
  });

  // Render active weekly tasks for selected milestone
  const selectedM = orchestrator.activeRoadmap.milestones[activeBoardMilestoneIdx];
  document.getElementById('board-active-milestone-title').innerText = selectedM.title;
  document.getElementById('board-active-milestone-desc').innerText = `Proportional Milestone Weight: ${Math.round(selectedM.weight * 100)}%`;
  
  const tasksContainer = document.getElementById('board-tasks-list');
  tasksContainer.innerHTML = '';

  selectedM.weeklyDistribution.forEach((w, wIdx) => {
    const weekDiv = document.createElement('div');
    weekDiv.className = 'week-section';
    weekDiv.innerHTML = `<div class="week-title">Week ${w.weekIndex} Targets</div>`;
    
    w.tasks.forEach((t, tIdx) => {
      const row = document.createElement('div');
      row.className = `task-check-row ${t.completed ? 'completed' : ''}`;
      row.onclick = () => toggleTaskBoardState(selectedM.id, wIdx, tIdx);
      
      row.innerHTML = `
        <div class="task-checkbox">✓</div>
        <span class="task-label-text">${t.name}</span>
      `;
      weekDiv.appendChild(row);
    });

    tasksContainer.appendChild(weekDiv);
  });
}

function toggleTaskBoardState(milestoneId, wIdx, tIdx) {
  const result = orchestrator.toggleTaskCompletion(milestoneId, wIdx, tIdx);
  saveGoalToStorage();
  renderLogs(result.logs);
  updateDashboardUI();
  updateRoadmapUI();
  updateSimulationUI();
}

// FUTURE SIMULATOR UI
function updateSimulationUI() {
  const empty = document.getElementById('simulation-empty-state');
  const active = document.getElementById('simulation-active-state');

  if (!orchestrator.activeRoadmap) {
    empty.style.display = 'flex';
    active.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  active.style.display = 'grid';

  // Load slider default value based on roadmap
  const hoursSlider = document.getElementById('sim-weekly-hours');
  document.getElementById('sim-hours-val').innerText = hoursSlider.value;

  // Render saved scenarios grid
  renderSavedScenarios();
}

function renderSavedScenarios() {
  const container = document.getElementById('sim-scenarios-grid');
  container.innerHTML = '';

  // Propose default base scenarios if list is empty
  let scenariosToShow = [...savedScenarios];
  if (scenariosToShow.length === 0) {
    // Generate standard comparison scenarios
    const activeHrs = orchestrator.activeRoadmap.hoursPerWeek;
    
    // Slow Scenario
    const slow = orchestrator.agents.simulation.simulateScenario(null, orchestrator.activeGoal.baseHoursNeeded, Math.max(2, activeHrs - 4), orchestrator.activeRoadmap);
    slow.name = "Slow & Steady";
    
    // Active Scenario
    const active = orchestrator.agents.simulation.simulateScenario(null, orchestrator.activeGoal.baseHoursNeeded, activeHrs, orchestrator.activeRoadmap);
    active.name = "Current Commitment";
    active.isActive = true;
    
    // Fast Scenario
    const fast = orchestrator.agents.simulation.simulateScenario(null, orchestrator.activeGoal.baseHoursNeeded, Math.min(25, activeHrs + 5), orchestrator.activeRoadmap);
    fast.name = "Fast Sprint";

    scenariosToShow = [slow, active, fast];
  }

  scenariosToShow.forEach(sc => {
    const card = document.createElement('div');
    card.className = `scenario-summary-card ${sc.isActive ? 'active-scenario' : ''}`;
    
    card.innerHTML = `
      <div class="scenario-label">${sc.name || `${sc.hoursCommitted}h/week Scenario`}</div>
      <div class="scenario-value" style="color: ${sc.isActive ? 'var(--color-cyan)' : 'var(--text-primary)'}">${sc.realExpectedWeeks} Weeks</div>
      <div class="scenario-meta">
        <span>Completion probability: <strong>${sc.successProbability}%</strong></span>
        <span>Burnout Risk index: <strong style="color: ${sc.burnoutRisk > 60 ? 'var(--color-rose)' : 'var(--text-secondary)'}">${sc.burnoutRisk}%</strong></span>
        <span>Total effort target: <strong>${sc.hoursCommitted * sc.weeksRequired} hrs</strong></span>
      </div>
    `;
    container.appendChild(card);
  });
}

// Chart.js Projections rendering
window.updateSimulationSliders = function(hours) {
  document.getElementById('sim-hours-val').innerText = hours;
  initOrUpdateChart(parseInt(hours));
};

window.saveActiveSimulationScenario = function() {
  const currentSimHrs = parseInt(document.getElementById('sim-weekly-hours').value);
  const sc = orchestrator.agents.simulation.simulateScenario(null, orchestrator.activeGoal.baseHoursNeeded, currentSimHrs, orchestrator.activeRoadmap);
  sc.name = `Custom ${currentSimHrs}h/wk Pace`;
  
  savedScenarios.push(sc);
  if (savedScenarios.length > 3) savedScenarios.shift(); // limit to 3 comparison rows
  
  updateSimulationUI();
  initOrUpdateChart(currentSimHrs);
  appendSystemLog(`Zephyr Saved comparison model: ${currentSimHrs} hrs/week over ${sc.realExpectedWeeks} weeks.`);
};

function initOrUpdateChart(simHours = null) {
  if (!orchestrator.activeRoadmap) return;

  const currentHrs = simHours || orchestrator.activeRoadmap.hoursPerWeek;
  const baseHours = orchestrator.activeGoal.baseHoursNeeded;
  
  const simData = orchestrator.agents.simulation.simulateScenario(null, baseHours, currentHrs, orchestrator.activeRoadmap);
  
  const ctx = document.getElementById('projectionChart').getContext('2d');
  
  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: simData.chartData.labels,
      datasets: [
        {
          label: 'Theoretical Progress Curve',
          data: simData.chartData.baseline,
          borderColor: '#b55fe6',
          backgroundColor: 'rgba(181, 95, 230, 0.05)',
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.1,
          fill: true
        },
        {
          label: `Projected Velocity (${currentHrs} hrs/week)`,
          data: simData.chartData.projected,
          borderColor: '#00f0ff',
          backgroundColor: 'rgba(0, 240, 255, 0.15)',
          borderWidth: 3,
          tension: 0.3,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { family: 'Outfit', size: 12 } }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: { color: '#64748b' }
        },
        y: {
          min: 0,
          max: 100,
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: {
            color: '#64748b',
            callback: function(value) { return value + "%"; }
          }
        }
      }
    }
  });
}

// AGENT NEXUS INTERFACES
window.selectAgentNode = function(agentId) {
  document.querySelectorAll('.agent-node').forEach(node => {
    node.classList.remove('active');
  });

  const node = document.getElementById(`node-${agentId}`);
  if (node) node.classList.add('active');

  const agent = orchestrator.agents[agentId];
  if (agent) {
    document.getElementById('terminal-active-title').innerText = `${agent.name.toUpperCase()} SYSTEM LOGS`;
    
    // Filter terminal output logs to show only selected agent
    const filtered = orchestrator.messageBus.filter(l => l.agentId === agentId);
    renderLogs(filtered);
    
    appendSystemLog(`[Diagnostic] Filtered inter-communication logs for ${agent.name} (${agent.role}).`);
  }
};

function renderLogs(logsArray) {
  const container = document.getElementById('terminal-log-output');
  container.innerHTML = '';

  logsArray.forEach(l => {
    const line = document.createElement('div');
    line.className = 'log-line';
    line.innerHTML = `
      <span class="log-time">[${l.timestamp}]</span>
      <span class="log-agent" style="color: ${l.accentColor}">${l.agentName}</span>
      <span class="log-text ${l.level}">${l.text}</span>
    `;
    container.appendChild(line);
  });
  
  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

function appendSystemLog(text, level = "info") {
  const container = document.getElementById('terminal-log-output');
  const line = document.createElement('div');
  line.className = 'log-line';
  line.innerHTML = `
    <span class="log-time">[${new Date().toLocaleTimeString()}]</span>
    <span class="log-agent" style="color: #64748b">System</span>
    <span class="log-text ${level}">${text}</span>
  `;
  container.appendChild(line);
  container.scrollTop = container.scrollHeight;
}

// DIRECTIVE CONSOLE INTERFACES
window.handleTerminalCommand = function() {
  const input = document.getElementById('terminal-input');
  const command = input.value.trim();
  if (!command) return;

  input.value = '';

  // Trigger agent directive process
  const result = orchestrator.executeDirective(command);
  
  saveGoalToStorage();
  
  // Reload details
  renderLogs(result.logs);
  updateDashboardUI();
  updateRoadmapUI();
  updateSimulationUI();
};

// STORAGE ACTIONS
function saveGoalToStorage() {
  const data = {
    activeGoal: orchestrator.activeGoal,
    activeRoadmap: orchestrator.activeRoadmap,
    messageBus: orchestrator.messageBus,
    savedScenarios: savedScenarios
  };
  localStorage.setItem('life_navigator_data', JSON.stringify(data));
}

function loadSavedGoal() {
  const dataStr = localStorage.getItem('life_navigator_data');
  if (dataStr) {
    try {
      const data = JSON.parse(dataStr);
      orchestrator.activeGoal = data.activeGoal;
      orchestrator.activeRoadmap = data.activeRoadmap;
      orchestrator.messageBus = data.messageBus || [];
      savedScenarios = data.savedScenarios || [];
      
      updateDashboardUI();
      updateRoadmapUI();
      updateSimulationUI();
      
      renderLogs(orchestrator.messageBus);
      
      appendSystemLog("Goal strategy coordinates loaded from persistent storage matrix.");
    } catch (e) {
      console.error("Local storage load failed", e);
    }
  }
}
