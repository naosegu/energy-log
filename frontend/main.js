// API Gateway の URL。デプロイ先が変わったらここを差し替える
const API_BASE_URL = 'https://anm6b5qvik.execute-api.ap-northeast-1.amazonaws.com';

const logForm = document.querySelector('#log-form');
const typeButtons = document.querySelector('#type-buttons');
const valueButtons = document.querySelector('#value-buttons');
const titleInput = document.querySelector('#title-input');
const titleCount = document.querySelector('#title-count');
const editingDate = document.querySelector('#editing-date');
const submitButton = document.querySelector('#submit-button');
const cancelButton = document.querySelector('#cancel-button');
const todayBalance = document.querySelector('#today-balance');
const weeklyAverage = document.querySelector('#weekly-average');
const balanceYesterday = document.querySelector('#balance-yesterday');
const balanceTwoDaysAgo = document.querySelector('#balance-two-days-ago');
const balanceThreeDaysAgo = document.querySelector('#balance-three-days-ago');
const summaryNote = document.querySelector('#summary-note');
const exampleBlock = document.querySelector('#example-block');
const logList = document.querySelector('#log-list');

let selectedType = 'charge';
let selectedValue = 1;
let editingCreatedAt = null;
let logs = [];

initialize();

async function initialize() {
  bindEvents();
  updateTitleCount();
  await loadLogs();
}

function bindEvents() {
  typeButtons.addEventListener('click', (event) => {
    const button = event.target.closest('[data-type]');
    if (!button) {
      return;
    }

    selectedType = button.dataset.type;
    syncTypeButtons();
    syncValueButtons();
  });

  valueButtons.addEventListener('click', (event) => {
    const button = event.target.closest('[data-value]');
    if (!button) {
      return;
    }

    selectedValue = Number(button.dataset.value);
    syncValueButtons();
  });

  titleInput.addEventListener('input', () => {
    updateTitleCount();
  });

  logForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const title = titleInput.value.trim();
    if (!title) {
      titleInput.focus();
      return;
    }

    if (editingCreatedAt) {
      await updateLog({
        createdAt: editingCreatedAt,
        type: selectedType,
        title,
        value: selectedValue,
      });
    } else {
      await createLog({
        type: selectedType,
        title,
        value: selectedValue,
      });
    }

    resetForm();
    await loadLogs();
  });

  cancelButton.addEventListener('click', () => {
    resetForm();
  });

  logList.addEventListener('click', async (event) => {
    const editButton = event.target.closest('[data-edit-created-at]');
    if (editButton) {
      startEdit(editButton.dataset.editCreatedAt);
      return;
    }

    const deleteButton = event.target.closest('[data-delete-created-at]');
    if (deleteButton) {
      await deleteLog(deleteButton.dataset.deleteCreatedAt);
      if (editingCreatedAt === deleteButton.dataset.deleteCreatedAt) {
        resetForm();
      }
      await loadLogs();
    }
  });
}

function updateTitleCount() {
  titleCount.textContent = `${titleInput.value.length} / 100`;
}

function syncTypeButtons() {
  for (const button of typeButtons.querySelectorAll('[data-type]')) {
    button.classList.toggle('is-active', button.dataset.type === selectedType);
  }
}

function syncValueButtons() {
  for (const button of valueButtons.querySelectorAll('[data-value]')) {
    const value = Number(button.dataset.value);
    button.classList.toggle('is-active', value === selectedValue);
    button.textContent = getStrengthIcons(selectedType, value);
  }
}

function resetForm() {
  editingCreatedAt = null;
  selectedType = 'charge';
  selectedValue = 1;
  titleInput.value = '';
  editingDate.textContent = '';
  editingDate.classList.add('is-hidden');
  submitButton.textContent = '追加する';
  cancelButton.classList.add('is-hidden');
  updateTitleCount();
  syncTypeButtons();
  syncValueButtons();
}

function startEdit(createdAt) {
  const log = logs.find((item) => item.createdAt === createdAt);
  if (!log) {
    return;
  }

  editingCreatedAt = log.createdAt;
  selectedType = log.type;
  selectedValue = log.value;
  titleInput.value = log.title;
  editingDate.textContent = `記録日時: ${formatDate(log.createdAt)}`;
  editingDate.classList.remove('is-hidden');
  submitButton.textContent = '更新する';
  cancelButton.classList.remove('is-hidden');
  updateTitleCount();
  syncTypeButtons();
  syncValueButtons();
  titleInput.focus();
}

async function loadLogs() {
  try {
    const response = await fetch(`${API_BASE_URL}/logs`, {
      headers: {
        'x-anon-id': getAnonId(),
      },
    });
    const data = await response.json();

    logs = data.items ?? [];
    renderLogs();
    renderSummary();
  } catch (error) {
    console.error(error);
    summaryNote.textContent = 'ログの読み込みに失敗しました。';
  }
}

async function createLog(payload) {
  await fetch(`${API_BASE_URL}/logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-anon-id': getAnonId(),
    },
    body: JSON.stringify(payload),
  });
}

async function updateLog(payload) {
  await fetch(`${API_BASE_URL}/logs`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-anon-id': getAnonId(),
    },
    body: JSON.stringify(payload),
  });
}

async function deleteLog(createdAt) {
  await fetch(`${API_BASE_URL}/logs`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'x-anon-id': getAnonId(),
    },
    body: JSON.stringify({ createdAt }),
  });
}

function renderLogs() {
  exampleBlock.classList.toggle('is-hidden', logs.length > 0);
  logList.innerHTML = logs
    .map((log) => {
      const typeLabel = log.type === 'charge' ? '充電' : '放電';
      const strengthIcons = getStrengthIcons(log.type, log.value);
      const itemClass = log.type === 'charge' ? 'charge' : 'discharge';

      return `
        <article class="list-item ${itemClass}">
          <div>
            <p class="item-type">${typeLabel}</p>
            <h3>${escapeHtml(log.title)}</h3>
            <p class="item-meta">強さ: ${strengthIcons} / 記録: ${formatDate(log.createdAt)}</p>
          </div>
          <div class="item-actions">
            <button type="button" class="inline-button" data-edit-created-at="${log.createdAt}">編集</button>
            <button type="button" class="inline-button" data-delete-created-at="${log.createdAt}">削除</button>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderSummary() {
  const today = new Date();
  const todayValue = calculateDailyBalance(today);
  const weeklyValue = calculateWeeklyAverage(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(today.getDate() - 2);
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(today.getDate() - 3);
  const yesterdayValue = calculateDailyBalance(yesterday);
  const twoDaysAgoValue = calculateDailyBalance(twoDaysAgo);
  const threeDaysAgoValue = calculateDailyBalance(threeDaysAgo);

  setSummaryMetric(todayBalance, todayValue);
  setSummaryMetric(weeklyAverage, weeklyValue);
  setSummaryMetric(balanceYesterday, yesterdayValue);
  setSummaryMetric(balanceTwoDaysAgo, twoDaysAgoValue);
  setSummaryMetric(balanceThreeDaysAgo, threeDaysAgoValue);
  summaryNote.textContent = buildSummaryNote(todayValue, weeklyValue);
}

function calculateDailyBalance(baseDate) {
  const todayKey = toDateKey(baseDate);

  return logs.reduce((total, log) => {
    if (toDateKey(new Date(log.createdAt)) !== todayKey) {
      return total;
    }

    return total + toSignedValue(log);
  }, 0);
}

function calculateWeeklyAverage(baseDate) {
  let total = 0;

  for (let index = 0; index < 7; index += 1) {
    const targetDate = new Date(baseDate);
    targetDate.setDate(baseDate.getDate() - index);
    total += calculateDailyBalance(targetDate);
  }

  return Math.round((total / 7) * 10) / 10;
}

function buildSummaryNote(todayValue, weeklyValue) {
  if (logs.length === 0) {
    return 'まずは1件記録して、自分の流れを見てみましょう。';
  }

  if (todayValue > weeklyValue) {
    return '今日の収支は平均より高めです。';
  }

  if (todayValue < weeklyValue) {
    return '今日の収支は平均より低めです。';
  }

  return '今日は平均と近い値です。';
}

function getStrengthIcons(type, value) {
  const icon = type === 'charge' ? '🔋' : '⚡';
  return icon.repeat(Number(value));
}

function toSignedValue(log) {
  return log.type === 'charge' ? Number(log.value) : -Number(log.value);
}

function formatSignedNumber(value) {
  if (value > 0) {
    return `+${value}`;
  }

  return String(value);
}

function formatSummaryIcon(value) {
  if (value > 0) {
    return '🔋';
  }

  if (value < 0) {
    return '⚡';
  }

  return '';
}

function setSummaryMetric(element, value) {
  element.innerHTML = `
    <span class="summary-number-text">${formatSignedNumber(value)}</span>
    <span class="summary-number-icon">${formatSummaryIcon(value)}</span>
  `;
}

function formatDate(value) {
  const date = new Date(value);

  return date.toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toDateKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getAnonId() {
  let anonId = localStorage.getItem('energy-log-anon-id');
  if (!anonId) {
    anonId = crypto.randomUUID();
    localStorage.setItem('energy-log-anon-id', anonId);
  }

  return anonId;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
