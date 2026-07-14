// AuraAttend Core Logic, Calendar, OCR Timetable Parser & Storage Sync

let state = {
  subjects: [],
  logs: {},      // Format: { "YYYY-MM-DD": { "subjectId": "present" | "absent" | "none" } }
  schedule: {},  // Format: { "Monday": ["Subject Name 1", ...], ... }
  targetPercentage: 75
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PROGRESS_CIRCUMFERENCE = 439.82; // 2 * pi * r (r=70)

// Calendar View State
let currentCalendarDate = new Date();
let selectedDateString = null;

// Temporary schedule draft parsed during import
let tempParsedSchedule = {};

// DOM Elements - Profile Switcher
const btnProfileDropdown = document.getElementById('btn-profile-dropdown');
const profileDropdownMenu = document.getElementById('profile-dropdown-menu');
const activeProfileNameLabel = document.getElementById('active-profile-name');

// DOM Elements - Navigation & Modals
const tabBtnDashboard = document.getElementById('tab-btn-dashboard');
const tabBtnCalendar = document.getElementById('tab-btn-calendar');
const tabBtnTimetableView = document.getElementById('tab-btn-timetable-view');
const viewDashboard = document.getElementById('view-dashboard');
const viewCalendar = document.getElementById('view-calendar');
const viewTimetable = document.getElementById('view-timetable');

const timetableSlotsBody = document.getElementById('timetable-slots-body');
const btnEditTimetableGrid = document.getElementById('btn-edit-timetable-grid');

const btnConfig = document.getElementById('btn-config');
const btnBackup = document.getElementById('btn-backup');
const btnTimetable = document.getElementById('btn-timetable');

const btnCloseConfig = document.getElementById('btn-close-config');
const btnCloseBackup = document.getElementById('btn-close-backup');
const btnCloseTimetable = document.getElementById('btn-close-timetable');

const btnCancelConfig = document.getElementById('btn-cancel-config');
const btnCancelTimetable = document.getElementById('btn-cancel-timetable');

const btnSaveConfig = document.getElementById('btn-save-config');
const modalConfig = document.getElementById('modal-config');
const modalBackup = document.getElementById('modal-backup');
const modalTimetable = document.getElementById('modal-timetable');

const targetRange = document.getElementById('target-range');
const targetValueLabel = document.getElementById('target-value');

// Missing DOM elements for stats/counters
const subjectsCountLabel = document.getElementById('subjects-count');
const overallPercentageLabel = document.getElementById('overall-percentage');
const overallAttendedLabel = document.getElementById('overall-attended');
const overallTotalLabel = document.getElementById('overall-total');
const countSafeLabel = document.getElementById('count-safe');
const countDangerLabel = document.getElementById('count-danger');
const overallProgressCircle = document.getElementById('overall-progress-circle');

// DOM Elements - Dashboard Views
const subjectsGrid = document.getElementById('subjects-grid');
const emptyState = document.getElementById('empty-state');
const btnEmptySetup = document.getElementById('btn-empty-setup');
const btnAddSubjectRow = document.getElementById('btn-add-subject-row');
const subjectEditorList = document.getElementById('subject-editor-list');

// Today's Schedule Card Elements
const todayScheduleCard = document.getElementById('today-schedule-card');
const todayDayNameLabel = document.getElementById('today-day-name');
const todayScheduleList = document.getElementById('today-schedule-list');

// DOM Elements - Calendar Views
const calendarMonthYear = document.getElementById('calendar-month-year');
const calendarDaysGrid = document.getElementById('calendar-days');
const btnPrevMonth = document.getElementById('btn-prev-month');
const btnNextMonth = document.getElementById('btn-next-month');
const logSelectedDateLabel = document.getElementById('log-selected-date-label');
const logSubjectsList = document.getElementById('log-subjects-list');
const logEditorContainer = document.getElementById('log-editor-container');

// DOM Elements - Timetable Modal
const timetableUploadZone = document.getElementById('timetable-upload-zone');
const timetableFileInput = document.getElementById('timetable-file');
const timetableTextInput = document.getElementById('timetable-text-input');
const ocrLoader = document.getElementById('ocr-loader');
const ocrLoaderText = document.getElementById('ocr-loader-text');
const timetablePreview = document.getElementById('timetable-preview');
const weekdayGridEditor = document.getElementById('weekday-grid-editor');
const btnParseText = document.getElementById('btn-parse-text');
const btnConfirmTimetable = document.getElementById('btn-confirm-timetable');
const timetableInputMethods = document.getElementById('timetable-input-methods');

// Shared Timetable elements
const sharedTemplatesSection = document.getElementById('shared-templates-section');
const selectSharedTemplate = document.getElementById('select-shared-template');
const btnLoadTemplate = document.getElementById('btn-load-template');
const chkSaveTemplate = document.getElementById('chk-save-template');
const txtTemplateName = document.getElementById('txt-template-name');

// Hardcoded Firebase Config for direct scaling
const firebaseConfig = {
  apiKey: "AIzaSyCjisXQ9V94dINr6EdWaTONRwwQ80fradQ",
  authDomain: "auraattend.firebaseapp.com",
  projectId: "auraattend",
  storageBucket: "auraattend.firebasestorage.app",
  messagingSenderId: "446998700910",
  appId: "1:446998700910:web:ae5d9c72fc712a83e6177f",
  measurementId: "G-R8EBVGBQY5"
};

let firestoreDb = null;
let isSyncingFromCloud = false;
let currentUser = null;
let sharedTemplates = [];

// Firebase Auth DOM Elements
const authContainer = document.getElementById('auth-container');
const authSignupFields = document.getElementById('auth-signup-fields');
const authNameInput = document.getElementById('auth-name');
const authClassInput = document.getElementById('auth-class');
const authDivisionInput = document.getElementById('auth-division');
const authRollInput = document.getElementById('auth-roll');
const authEmailInput = document.getElementById('auth-email');
const authPasswordInput = document.getElementById('auth-password');
const authErrorBox = document.getElementById('auth-error-box');
const btnAuthSubmit = document.getElementById('btn-auth-submit');
const btnTabSignin = document.getElementById('btn-tab-signin');
const btnTabSignup = document.getElementById('btn-tab-signup');
const btnSignOut = document.getElementById('btn-sign-out');
const userEmailLabel = document.getElementById('user-email-label');

// Backup actions
const btnExport = document.getElementById('btn-export');
const fileImport = document.getElementById('import-file');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Firebase connection immediately on load
  initFirebaseConnection(firebaseConfig);
  setupAuthObserver();
  setupAuthEventListeners();
  
  setupEventListeners();
  setupProfileEventListeners();
  setupTimetableDragAndDrop();
  
  selectedDateString = getTodayDateString();
  
  renderApp();
  renderProfileDropdownList();
  lucide.createIcons();
});

function normalizeState() {
  if (!Array.isArray(state.subjects)) state.subjects = [];
  if (!state.logs || typeof state.logs !== 'object') state.logs = {};
  if (!state.schedule || typeof state.schedule !== 'object') state.schedule = {};
  if (typeof state.targetPercentage !== 'number') state.targetPercentage = 75;
  
  // Normalize legacy logs (string -> array of strings)
  Object.keys(state.logs).forEach(date => {
    const dayLog = state.logs[date];
    if (dayLog && typeof dayLog === 'object') {
      Object.keys(dayLog).forEach(subjId => {
        if (typeof dayLog[subjId] === 'string') {
          dayLog[subjId] = [dayLog[subjId]];
        }
      });
    }
  });

  // Ensure historical fields are present
  state.subjects.forEach(sub => {
    if (sub.historicalPresent === undefined) sub.historicalPresent = 0;
    if (sub.historicalTotal === undefined) sub.historicalTotal = 0;
  });

  targetRange.value = state.targetPercentage;
  targetValueLabel.textContent = `${state.targetPercentage}%`;
}

function resetToDefaultState() {
  state = {
    subjects: [],
    logs: {},
    schedule: {},
    targetPercentage: 75
  };
  targetRange.value = 75;
  targetValueLabel.textContent = '75%';
}

// Save state directly to Firestore subcollections
function saveStateToLocalStorage() {
  if (!firestoreDb || !currentUser || isSyncingFromCloud) return;

  // 1. Sync subjects to users/{uid}/subjects/{id} and delete orphaned subjects
  state.subjects.forEach(sub => {
    firestoreDb.collection("users").doc(currentUser.uid).collection("subjects").doc(sub.id).set(sub)
      .catch(e => console.error("Error saving subject to cloud:", e));
  });
  
  firestoreDb.collection("users").doc(currentUser.uid).collection("subjects").get().then(snapshot => {
    snapshot.forEach(doc => {
      const dbSubId = doc.id;
      if (!state.subjects.some(s => s.id === dbSubId)) {
        firestoreDb.collection("users").doc(currentUser.uid).collection("subjects").doc(dbSubId).delete()
          .catch(e => console.error("Error deleting orphaned subject:", e));
      }
    });
  }).catch(e => console.error("Failed to read subjects for cleanup:", e));

  // 2. Sync attendance logs for the current selectedDateString
  if (selectedDateString) {
    const dayLogs = state.logs[selectedDateString] || {};
    
    // First, save all active session logs to Firestore
    Object.keys(dayLogs).forEach(subjId => {
      const statuses = dayLogs[subjId] || [];
      statuses.forEach((status, idx) => {
        const sessionIndex = idx + 1;
        const docId = `${selectedDateString}_${subjId}_${sessionIndex}`;
        firestoreDb.collection("users").doc(currentUser.uid).collection("attendance").doc(docId).set({
          date: selectedDateString,
          subjectId: subjId,
          sessionIndex: sessionIndex,
          status: status
        }).catch(e => console.error("Error saving log doc:", e));
      });
    });
    
    // Then, find and delete any obsolete/orphaned session log documents for this date
    firestoreDb.collection("users").doc(currentUser.uid).collection("attendance")
      .where("date", "==", selectedDateString).get().then(snapshot => {
        snapshot.forEach(doc => {
          const logId = doc.id;
          const parts = logId.split('_');
          if (parts.length >= 3) {
            const subjId = parts[1];
            const sessionIndex = parseInt(parts[2], 10);
            
            const currentStatuses = dayLogs[subjId] || [];
            if (!dayLogs[subjId] || sessionIndex > currentStatuses.length) {
              firestoreDb.collection("users").doc(currentUser.uid).collection("attendance").doc(logId).delete()
                .catch(e => console.error("Error deleting orphaned session:", e));
            }
          }
        });
      }).catch(e => console.error("Failed to query logs for deletion:", e));
  }

  // 3. Sync personal timetable
  firestoreDb.collection("users").doc(currentUser.uid).collection("timetable").doc("weekly").set({
    schedule: state.schedule
  }).catch(e => console.error("Error saving timetable to cloud:", e));
  
  // 4. Sync target percentage
  firestoreDb.collection("users").doc(currentUser.uid).update({
    targetPercentage: state.targetPercentage
  }).catch(() => {
    firestoreDb.collection("users").doc(currentUser.uid).set({
      targetPercentage: state.targetPercentage
    }, { merge: true }).catch(e => console.error("Error updating target percentage:", e));
  });
}

// Bind event listeners for profile dropdown
function setupProfileEventListeners() {
  btnProfileDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
    profileDropdownMenu.classList.toggle('hidden');
  });

  // Close profile dropdown when clicking outside
  window.addEventListener('click', () => {
    profileDropdownMenu.classList.add('hidden');
  });
}

function renderProfileDropdownList() {
  // User metadata name is rendered dynamically in initUserCloudSync
  lucide.createIcons();
}

let unsubUser = null;
let unsubSubjects = null;
let unsubAttendance = null;
let unsubTimetable = null;

function initFirebaseConnection(config) {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
    firestoreDb = firebase.firestore();
    
    // Sync Firestore shared templates real-time (global for everyone)
    firestoreDb.collection("timetableTemplates").onSnapshot(snapshot => {
      const templates = [];
      snapshot.forEach(doc => {
        templates.push(doc.data());
      });
      sharedTemplates = templates;
      if (modalTimetable.classList.contains('active')) {
        renderSharedTemplatesList();
      }
    }, err => {
      console.error("Shared templates sync failed:", err);
    });

    return true;
  } catch (e) {
    console.error("Firebase connection failed:", e);
    return false;
  }
}

function initUserCloudSync(userId) {
  if (!firestoreDb) return;
  
  isSyncingFromCloud = true;
  
  if (unsubUser) unsubUser();
  if (unsubSubjects) unsubSubjects();
  if (unsubAttendance) unsubAttendance();
  if (unsubTimetable) unsubTimetable();

  // 1. Sync User Metadata
  unsubUser = firestoreDb.collection("users").doc(userId).onSnapshot(doc => {
    if (doc.exists) {
      const data = doc.data();
      state.targetPercentage = data.targetPercentage || 75;
      
      const activeProfileNameLabel = document.getElementById('active-profile-name');
      activeProfileNameLabel.textContent = data.name || "Default Student";
      
      userEmailLabel.innerHTML = `
        <div style="font-weight:600; color:#fff; margin-bottom:0.15rem;">${data.name || 'Student'}</div>
        <div style="color:var(--text-secondary); margin-bottom:0.15rem;">${data.email}</div>
        <div style="color:var(--text-muted); font-size:0.7rem;">Roll: ${data.rollNo || 'N/A'} | Class: ${data.class || 'N/A'} | Div: ${data.division || 'N/A'}</div>
      `;
      normalizeState();
      renderApp();
    }
  }, err => console.error("User metadata sync failed:", err));

  // 2. Sync Subjects subcollection
  unsubSubjects = firestoreDb.collection("users").doc(userId).collection("subjects").onSnapshot(snapshot => {
    isSyncingFromCloud = true;
    const dbSubjects = [];
    snapshot.forEach(doc => {
      dbSubjects.push(doc.data());
    });
    state.subjects = dbSubjects;
    normalizeState();
    renderApp();
    isSyncingFromCloud = false;
  }, err => console.error("Subjects sync failed:", err));

  // 3. Sync Attendance Logs subcollection
  unsubAttendance = firestoreDb.collection("users").doc(userId).collection("attendance").onSnapshot(snapshot => {
    isSyncingFromCloud = true;
    state.logs = {};
    snapshot.forEach(doc => {
      const logEntry = doc.data();
      const date = logEntry.date;
      const subjId = logEntry.subjectId;
      const status = logEntry.status;
      const sessionIndex = logEntry.sessionIndex || 1;
      
      if (date && subjId) {
        if (!state.logs[date]) {
          state.logs[date] = {};
        }
        if (!state.logs[date][subjId]) {
          state.logs[date][subjId] = [];
        }
        // Set the status at the correct index (0-based inside array)
        state.logs[date][subjId][sessionIndex - 1] = status;
      }
    });
    normalizeState();
    renderApp();
    isSyncingFromCloud = false;
  }, err => console.error("Attendance sync failed:", err));

  // 4. Sync Timetable
  unsubTimetable = firestoreDb.collection("users").doc(userId).collection("timetable").doc("weekly").onSnapshot(doc => {
    isSyncingFromCloud = true;
    if (doc.exists) {
      state.schedule = doc.data().schedule || {};
    } else {
      state.schedule = {};
    }
    normalizeState();
    renderApp();
    isSyncingFromCloud = false;
  }, err => console.error("Timetable sync failed:", err));
}

function setupAuthObserver() {
  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      currentUser = user;
      authContainer.classList.add('hidden');
      initUserCloudSync(user.uid);
    } else {
      currentUser = null;
      if (unsubUser) unsubUser();
      if (unsubSubjects) unsubSubjects();
      if (unsubAttendance) unsubAttendance();
      if (unsubTimetable) unsubTimetable();
      
      state = { subjects: [], logs: {}, schedule: {}, targetPercentage: 75 };
      authContainer.classList.remove('hidden');
      profileDropdownMenu.classList.add('hidden');
    }
  });
}

let authMode = 'signin';

function setupAuthEventListeners() {
  btnTabSignin.addEventListener('click', () => {
    authMode = 'signin';
    btnTabSignin.classList.add('active');
    btnTabSignup.classList.remove('active');
    btnAuthSubmit.textContent = 'Sign In';
    authErrorBox.classList.add('hidden');
    authSignupFields.classList.add('hidden');
    authNameInput.required = false;
    authClassInput.required = false;
    authDivisionInput.required = false;
    authRollInput.required = false;
  });

  btnTabSignup.addEventListener('click', () => {
    authMode = 'signup';
    btnTabSignup.classList.add('active');
    btnTabSignin.classList.remove('active');
    btnAuthSubmit.textContent = 'Sign Up';
    authErrorBox.classList.add('hidden');
    authSignupFields.classList.remove('hidden');
    authNameInput.required = true;
    authClassInput.required = true;
    authDivisionInput.required = true;
    authRollInput.required = true;
  });

  btnSignOut.addEventListener('click', () => {
    if (confirm("Are you sure you want to sign out?")) {
      firebase.auth().signOut()
        .then(() => alert("Signed out successfully!"))
        .catch(err => alert("Sign out failed: " + err.message));
    }
  });
}

window.handleAuthSubmit = function(event) {
  event.preventDefault();
  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;
  
  authErrorBox.classList.add('hidden');
  btnAuthSubmit.disabled = true;
  btnAuthSubmit.textContent = authMode === 'signin' ? 'Signing In...' : 'Signing Up...';

  if (authMode === 'signin') {
    firebase.auth().signInWithEmailAndPassword(email, password)
      .then(() => {
        btnAuthSubmit.disabled = false;
        btnAuthSubmit.textContent = 'Sign In';
      })
      .catch(err => {
        authErrorBox.textContent = err.message;
        authErrorBox.classList.remove('hidden');
        btnAuthSubmit.disabled = false;
        btnAuthSubmit.textContent = 'Sign In';
      });
  } else {
    const nameVal = authNameInput.value.trim();
    const classVal = authClassInput.value.trim();
    const divVal = authDivisionInput.value.trim();
    const rollVal = authRollInput.value.trim();

    firebase.auth().createUserWithEmailAndPassword(email, password)
      .then((userCredential) => {
        const user = userCredential.user;
        // Save user metadata to users/{uid}
        return firestoreDb.collection("users").doc(user.uid).set({
          name: nameVal,
          email: email,
          rollNo: rollVal,
          class: classVal,
          division: divVal,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      })
      .then(() => {
        alert("Account successfully created!");
        btnAuthSubmit.disabled = false;
        btnAuthSubmit.textContent = 'Sign Up';
      })
      .catch(err => {
        authErrorBox.textContent = err.message;
        authErrorBox.classList.remove('hidden');
        btnAuthSubmit.disabled = false;
        btnAuthSubmit.textContent = 'Sign Up';
      });
  }
};

// Set up all interactive event listeners
function setupEventListeners() {
  // Navigation Tabs switching
  tabBtnDashboard.addEventListener('click', () => switchTab('dashboard'));
  tabBtnCalendar.addEventListener('click', () => switchTab('calendar'));
  tabBtnTimetableView.addEventListener('click', () => switchTab('timetable'));

  // Modal toggle actions
  btnConfig.addEventListener('click', () => openConfigModal());
  btnEmptySetup.addEventListener('click', () => openConfigModal());
  btnBackup.addEventListener('click', () => openModal(modalBackup));
  btnTimetable.addEventListener('click', () => openTimetableModal(false));
  btnEditTimetableGrid.addEventListener('click', () => openTimetableModal(true));
  
  btnCloseConfig.addEventListener('click', () => closeModal(modalConfig));
  btnCancelConfig.addEventListener('click', () => closeModal(modalConfig));
  
  btnCloseBackup.addEventListener('click', () => closeModal(modalBackup));
  
  btnCloseTimetable.addEventListener('click', () => closeModal(modalTimetable));
  btnCancelTimetable.addEventListener('click', () => closeModal(modalTimetable));
  
  // Close modals when clicking outside card
  window.addEventListener('click', (e) => {
    if (e.target === modalConfig) closeModal(modalConfig);
    if (e.target === modalBackup) closeModal(modalBackup);
    if (e.target === modalTimetable) closeModal(modalTimetable);
  });

  // Save subject settings
  btnSaveConfig.addEventListener('click', saveSubjectsConfig);

  // Add subject row in config modal
  btnAddSubjectRow.addEventListener('click', () => renderSubjectEditRow('', 0, 0));

  // Threshold slider change
  targetRange.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    state.targetPercentage = val;
    targetValueLabel.textContent = `${val}%`;
    saveStateToLocalStorage();
    renderApp();
  });

  // Calendar Controls
  btnPrevMonth.addEventListener('click', () => changeMonth(-1));
  btnNextMonth.addEventListener('click', () => changeMonth(1));

  // Timetable Parser trigger
  btnParseText.addEventListener('click', () => {
    const text = timetableTextInput.value.trim();
    if (!text) {
      alert("Please paste some timetable text first!");
      return;
    }
    parseAndShowTimetable(text);
  });

  // Confirm extracted schedule
  btnConfirmTimetable.addEventListener('click', confirmTimetableImport);

  // Toggle template name input when chkSaveTemplate is changed
  chkSaveTemplate.addEventListener('change', () => {
    if (chkSaveTemplate.checked) {
      txtTemplateName.classList.remove('hidden');
      txtTemplateName.focus();
    } else {
      txtTemplateName.classList.add('hidden');
    }
  });

  // Load shared template trigger
  btnLoadTemplate.addEventListener('click', () => {
    const templateId = selectSharedTemplate.value;
    if (!templateId) {
      alert("Please select a template to load!");
      return;
    }
    const selected = sharedTemplates.find(t => t.id === templateId);
    if (selected) {
      // Load schedule into tempParsedSchedule
      tempParsedSchedule = JSON.parse(JSON.stringify(selected.schedule));
      renderTimetablePreviewEditor();
      alert(`Loaded template "${selected.name}"! Feel free to edit slots or click 'Confirm & Import' to save.`);
    }
  });

  // Backup & Import buttons
  btnExport.addEventListener('click', exportData);
  fileImport.addEventListener('change', importData);
}

// Tab switcher logic
function switchTab(tab) {
  tabBtnDashboard.classList.remove('active');
  tabBtnCalendar.classList.remove('active');
  tabBtnTimetableView.classList.remove('active');
  
  viewDashboard.classList.add('hidden');
  viewCalendar.classList.add('hidden');
  viewTimetable.classList.add('hidden');

  if (tab === 'dashboard') {
    tabBtnDashboard.classList.add('active');
    viewDashboard.classList.remove('hidden');
    renderApp();
  } else if (tab === 'calendar') {
    tabBtnCalendar.classList.add('active');
    viewCalendar.classList.remove('hidden');
    renderCalendar();
  } else if (tab === 'timetable') {
    tabBtnTimetableView.classList.add('active');
    viewTimetable.classList.remove('hidden');
    renderTimetableView();
  }
}

const TIME_SLOTS = [
  "8:10-9:10",
  "9:10-10:10",
  "10:25-11:20",
  "11:20-12:15",
  "1:05-2:00",
  "2:00-2:55",
  "3:05-4:00",
  "4:00-4:55"
];

// Render the Weekly Timetable Grid
function renderTimetableView() {
  timetableSlotsBody.innerHTML = '';
  const activeDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  
  activeDays.forEach(day => {
    const row = document.createElement('tr');
    
    // Ensure day schedule is exactly 8 elements long
    if (!Array.isArray(state.schedule[day])) {
      state.schedule[day] = Array(8).fill("—");
    }
    while (state.schedule[day].length < 8) {
      state.schedule[day].push("—");
    }
    
    let cellsHtml = `<td class="timetable-day-header">${day}</td>`;
    
    state.schedule[day].forEach((slotValue) => {
      const cleanVal = slotValue.trim();
      const isEmpty = !cleanVal || cleanVal === '—' || cleanVal === '-' || cleanVal.toLowerCase() === 'empty';
      
      if (isEmpty) {
        cellsHtml += `<td><span class="timetable-cell-empty">—</span></td>`;
      } else {
        cellsHtml += `
          <td>
            <span class="timetable-cell-subject" title="${escapeHtml(cleanVal)}">
              ${escapeHtml(cleanVal)}
            </span>
          </td>
        `;
      }
    });
    
    row.innerHTML = cellsHtml;
    timetableSlotsBody.appendChild(row);
  });
}

// Open configuration modal and populate current values
function openConfigModal() {
  subjectEditorList.innerHTML = '';
  if (state.subjects.length === 0) {
    // Start with 3 empty fields by default to make it easy
    for (let i = 0; i < 3; i++) {
      renderSubjectEditRow('', 0, 0, '');
    }
  } else {
    state.subjects.forEach(sub => {
      renderSubjectEditRow(sub.name, sub.historicalPresent, sub.historicalTotal, sub.id);
    });
  }
  openModal(modalConfig);
}

// Open Timetable Modal
function openTimetableModal(editMode = false) {
  timetableTextInput.value = '';
  timetableFileInput.value = '';
  chkSaveTemplate.checked = false;
  txtTemplateName.value = '';
  txtTemplateName.classList.add('hidden');
  
  renderSharedTemplatesList();
  
  if (editMode && state.schedule && Object.keys(state.schedule).length > 0) {
    // Deep copy current schedule
    tempParsedSchedule = JSON.parse(JSON.stringify(state.schedule));
    timetableInputMethods.classList.add('hidden');
    ocrLoader.classList.add('hidden');
    timetablePreview.classList.remove('hidden');
    btnParseText.classList.add('hidden');
    btnConfirmTimetable.classList.remove('hidden');
    renderTimetablePreviewEditor();
  } else {
    tempParsedSchedule = {};
    timetableInputMethods.classList.remove('hidden');
    ocrLoader.classList.add('hidden');
    timetablePreview.classList.add('hidden');
    btnParseText.classList.remove('hidden');
    btnConfirmTimetable.classList.add('hidden');
  }
  
  openModal(modalTimetable);
}

function renderSharedTemplatesList() {
  selectSharedTemplate.innerHTML = '<option value="">-- Choose a Saved Template --</option>';
  
  if (sharedTemplates.length === 0) {
    sharedTemplatesSection.classList.add('hidden');
  } else {
    sharedTemplatesSection.classList.remove('hidden');
    sharedTemplates.forEach(t => {
      const option = document.createElement('option');
      option.value = t.id;
      option.textContent = t.name;
      selectSharedTemplate.appendChild(option);
    });
  }
}

function openModal(modal) {
  modal.classList.add('active');
}

function closeModal(modal) {
  modal.classList.remove('active');
}

// Append editable subject row inside configuration modal
function renderSubjectEditRow(name = '', historicalPresent = 0, historicalTotal = 0, subjectId = '') {
  const rowId = 'row-' + Math.random().toString(36).substr(2, 9);
  const rowHtml = `
    <div class="subject-edit-row" id="${rowId}" data-subj-id="${subjectId}">
      <div class="field-group">
        <span class="edit-row-label">Subject Name</span>
        <input type="text" class="input-text subj-name-input" placeholder="e.g. Mathematics" value="${escapeHtml(name)}">
      </div>
      <div class="field-group">
        <span class="edit-row-label">Hist. Attended</span>
        <input type="number" class="input-text input-num subj-present-input" min="0" value="${historicalPresent}">
      </div>
      <div class="field-group">
        <span class="edit-row-label">Hist. Total</span>
        <input type="number" class="input-text input-num subj-total-input" min="0" value="${historicalTotal}">
      </div>
      <button class="btn btn-icon-only btn-danger delete-row-btn" style="height: 38px; width: 38px;" title="Delete row">
        <i data-lucide="trash-2"></i>
      </button>
    </div>
  `;
  
  subjectEditorList.insertAdjacentHTML('beforeend', rowHtml);
  
  const rowElement = document.getElementById(rowId);
  rowElement.querySelector('.delete-row-btn').addEventListener('click', () => {
    rowElement.remove();
  });
  
  lucide.createIcons();
}

function generateSubjectId(name, existingSubjectsList) {
  let base = name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase();
  base = base.replace(/[^A-Z0-9]/g, '');
  if (!base) base = 'SUBJ';
  
  let id = base;
  let counter = 1;
  while (existingSubjectsList.some(s => s.id === id) || state.subjects.some(s => s.id === id)) {
    id = `${base}_${counter}`;
    counter++;
  }
  return id;
}

// Save config modal inputs
function saveSubjectsConfig() {
  const rows = subjectEditorList.querySelectorAll('.subject-edit-row');
  const updatedSubjects = [];
  
  rows.forEach((row, idx) => {
    const name = row.querySelector('.subj-name-input').value.trim();
    let present = parseInt(row.querySelector('.subj-present-input').value, 10);
    let total = parseInt(row.querySelector('.subj-total-input').value, 10);
    const dbSubId = row.getAttribute('data-subj-id');
    
    if (!name) return;

    if (isNaN(present) || present < 0) present = 0;
    if (isNaN(total) || total < 0) total = 0;
    if (present > total) total = present;

    // Use existing ID if it matches this row, or generate a structured unique ID
    const id = dbSubId || generateSubjectId(name, updatedSubjects);

    updatedSubjects.push({
      id: id,
      name: name,
      historicalPresent: present,
      historicalTotal: total
    });
  });

  state.subjects = updatedSubjects;
  saveStateToLocalStorage();
  closeModal(modalConfig);
  renderApp();
}

function getSubjectAggregatedStats(subject) {
  let present = subject.historicalPresent || 0;
  let total = subject.historicalTotal || 0;

  Object.keys(state.logs).forEach(date => {
    const dayLog = state.logs[date];
    if (dayLog && dayLog[subject.id]) {
      const sessions = dayLog[subject.id];
      if (Array.isArray(sessions)) {
        sessions.forEach(status => {
          if (status === 'present') {
            present++;
            total++;
          } else if (status === 'absent') {
            total++;
          }
        });
      } else {
        // Fallback for older single-string data migration
        if (sessions === 'present') {
          present++;
          total++;
        } else if (sessions === 'absent') {
          total++;
        }
      }
    }
  });

  return { present, total };
}

// Render complete state of dashboard elements
function renderApp() {
  const hasSubjects = state.subjects.length > 0;
  
  subjectsCountLabel.textContent = state.subjects.length;

  if (!hasSubjects) {
    emptyState.classList.remove('hidden');
    subjectsGrid.classList.add('hidden');
    todayScheduleCard.classList.add('hidden');
    updateOverallStats(0, 0, 0, 0);
    return;
  }
  
  emptyState.classList.add('hidden');
  subjectsGrid.classList.remove('hidden');

  // Render Classes Scheduled Today Dashboard Card
  renderTodayScheduleCard();

  let overallPresent = 0;
  let overallTotal = 0;
  let safeCount = 0;
  let dangerCount = 0;

  subjectsGrid.innerHTML = '';

  state.subjects.forEach(subject => {
    const stats = getSubjectAggregatedStats(subject);
    overallPresent += stats.present;
    overallTotal += stats.total;

    const percentage = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
    const isSafe = percentage >= state.targetPercentage;

    if (isSafe) {
      safeCount++;
    } else {
      dangerCount++;
    }

    const advice = calculateAdvice(stats.present, stats.total, state.targetPercentage);
    
    // Get today's sessions list for status feedback
    const todayStr = getTodayDateString();
    const todaySessions = (state.logs[todayStr] && state.logs[todayStr][subject.id]) || [];
    
    let todaySessionsHtml = '';
    if (todaySessions.length > 0) {
      todaySessionsHtml = '<div class="today-sessions-list" style="display:flex; gap:0.35rem; align-items:center; flex-wrap:wrap; margin-top: 0.65rem; font-size: 0.75rem; color: var(--text-secondary);">';
      todaySessionsHtml += '<span style="font-weight:600; color: #fff;">Today:</span>';
      todaySessions.forEach((status, sIdx) => {
        const isPres = status === 'present';
        todaySessionsHtml += `
          <span class="quick-info-badge" style="background:${isPres ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)'}; border-color:${isPres ? 'var(--safe-border)' : 'var(--danger-border)'}; color:${isPres ? 'var(--safe-color)' : 'var(--danger-color)'}; padding: 0.15rem 0.45rem; border-radius: 4px; display:inline-flex; align-items:center; gap:0.25rem;">
            ${isPres ? 'Present' : 'Absent'}
            <i data-lucide="x" style="width:10.5px; height:10.5px; cursor:pointer;" onclick="removeTodaySession('${subject.id}', ${sIdx}); event.stopPropagation();"></i>
          </span>
        `;
      });
      todaySessionsHtml += '</div>';
    }
    
    const card = document.createElement('div');
    card.className = 'subject-card glass-card';
    
    const strokeDash = 157.08;
    const offset = strokeDash - (percentage / 100) * strokeDash;
    
    const cardHtml = `
      <div class="subject-card-header">
        <div class="subj-title-area">
          <h3>${escapeHtml(subject.name)}</h3>
          <p class="subj-stats-summary">${stats.present} present out of ${stats.total} classes</p>
        </div>
        <span class="subj-status-badge ${isSafe ? 'subj-status-safe' : 'subj-status-danger'}">
          ${isSafe ? 'On Track' : 'Shortage'}
        </span>
      </div>

      <div class="subj-progress-wrapper">
        <div class="mini-radial">
          <svg width="60" height="60" style="transform: rotate(-90deg);">
            <circle cx="30" cy="30" r="25" stroke="rgba(255, 255, 255, 0.03)" stroke-width="4" fill="transparent"/>
            <circle cx="30" cy="30" r="25" stroke="${isSafe ? 'var(--safe-color)' : 'var(--danger-color)'}" stroke-width="4" 
              stroke-dasharray="${strokeDash}" stroke-dashoffset="${offset}" stroke-linecap="round" fill="transparent"
              style="transition: stroke-dashoffset 0.5s ease-out;"/>
          </svg>
          <span style="color: ${isSafe ? 'var(--safe-color)' : 'var(--danger-color)'}">${percentage}%</span>
        </div>
        
        <div class="subj-advice ${isSafe ? 'subj-advice-safe' : 'subj-advice-danger'}">
          ${advice}
        </div>
      </div>

      <div class="subject-actions-row" style="flex-direction:column; gap:0.6rem; align-items:stretch;">
        <div style="display:flex; gap:0.5rem; width:100%;">
          <button class="btn btn-success" style="flex:1;" onclick="markAttendanceToday('${subject.id}', true)">
            <i data-lucide="plus"></i> Present Today
          </button>
          <button class="btn btn-danger" style="flex:1;" onclick="markAttendanceToday('${subject.id}', false)">
            <i data-lucide="plus"></i> Absent Today
          </button>
        </div>
        
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          ${todaySessionsHtml}
          <div style="display:flex; gap:0.25rem; margin-left:auto;">
            <button class="btn btn-secondary btn-icon-only btn-adjust" onclick="adjustCounter('${subject.id}', 'present', -1)" title="Undo Hist. Attended">-P</button>
            <button class="btn btn-secondary btn-icon-only btn-adjust" onclick="adjustCounter('${subject.id}', 'total', -1)" title="Undo Hist. Total">-T</button>
          </div>
        </div>
      </div>
    `;

    card.innerHTML = cardHtml;
    subjectsGrid.appendChild(card);
  });

  const overallPercentage = overallTotal > 0 ? Math.round((overallPresent / overallTotal) * 100) : 0;
  updateOverallStats(overallPercentage, overallPresent, overallTotal, safeCount, dangerCount);
  
  if (!viewCalendar.classList.contains('hidden')) {
    renderCalendar();
  }

  lucide.createIcons();
}

// Render the classes scheduled for today on the dashboard
function renderTodayScheduleCard() {
  const d = new Date();
  const todayName = WEEKDAYS[d.getDay()];
  const todayStr = getTodayDateString();

  todayDayNameLabel.textContent = todayName;
  
  const todayScheduledSubjects = state.schedule[todayName] || [];
  
  if (todayScheduledSubjects.length === 0) {
    todayScheduleCard.classList.add('hidden');
    return;
  }
  
  todayScheduleCard.classList.remove('hidden');
  todayScheduleList.innerHTML = '';
  
  // Count scheduled slots per subject
  const scheduleCount = {};
  todayScheduledSubjects.forEach(subjName => {
    const subject = state.subjects.find(s => s.name.toLowerCase() === subjName.toLowerCase());
    if (subject) {
      scheduleCount[subject.id] = (scheduleCount[subject.id] || 0) + 1;
    }
  });

  const uniqueScheduledIds = Object.keys(scheduleCount);
  if (uniqueScheduledIds.length === 0) {
    todayScheduleCard.classList.add('hidden');
    return;
  }

  let rowsAdded = 0;

  uniqueScheduledIds.forEach(subjectId => {
    const subject = state.subjects.find(s => s.id === subjectId);
    if (!subject) return;

    rowsAdded++;
    const count = scheduleCount[subjectId];
    const dayLog = state.logs[todayStr] || {};
    const sessions = dayLog[subjectId] || [];

    const row = document.createElement('div');
    row.className = 'today-schedule-row';
    row.style = 'display:flex; flex-direction:column; gap:0.5rem; padding: 0.75rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);';

    let loggedHtml = '';
    if (sessions.length > 0) {
      loggedHtml = '<div style="display:flex; gap:0.35rem; align-items:center; flex-wrap:wrap;">';
      sessions.forEach((status, sIdx) => {
        const isPres = status === 'present';
        loggedHtml += `
          <span class="quick-info-badge" style="background:${isPres ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)'}; border-color:${isPres ? 'var(--safe-border)' : 'var(--danger-border)'}; color:${isPres ? 'var(--safe-color)' : 'var(--danger-color)'}; padding: 0.15rem 0.45rem; border-radius: 4px; display:inline-flex; align-items:center; gap:0.25rem; font-size:0.75rem;">
            ${isPres ? 'P' : 'A'}
            <i data-lucide="x" style="width:10px; height:10px; cursor:pointer;" onclick="removeTodaySession('${subject.id}', ${sIdx}); event.stopPropagation();"></i>
          </span>
        `;
      });
      loggedHtml += '</div>';
    } else {
      loggedHtml = '<span style="font-size:0.75rem; color:var(--text-muted);">Not logged yet</span>';
    }

    row.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
        <div class="today-sched-info" style="display:flex; flex-direction:column;">
          <span class="today-sched-name" style="font-weight:600; color:#fff;">${escapeHtml(subject.name)}</span>
          <span class="today-sched-status" style="font-size:0.75rem; color:var(--text-secondary);">${count} class${count > 1 ? 'es' : ''} scheduled</span>
        </div>
        <div class="today-sched-actions" style="display:flex; gap:0.35rem;">
          <button class="btn btn-success" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="markAttendanceToday('${subject.id}', true)">+ Present</button>
          <button class="btn btn-danger" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="markAttendanceToday('${subject.id}', false)">+ Absent</button>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:0.5rem; margin-top:0.25rem;">
        <span style="font-size:0.75rem; color:var(--text-secondary);">Today's Logs:</span>
        ${loggedHtml}
      </div>
    `;
    todayScheduleList.appendChild(row);
  });

  if (rowsAdded === 0) {
    todayScheduleCard.classList.add('hidden');
  }
}

// Calculate advice string
function calculateAdvice(present, total, target) {
  if (total === 0) {
    return `No classes held yet. Keep attendance high!`;
  }
  
  const currentPercentage = (present / total) * 100;
  
  if (currentPercentage >= target) {
    const maxMiss = Math.floor((100 * present) / target) - total;
    if (maxMiss > 0) {
      return `You can safely miss the next <strong>${maxMiss}</strong> class${maxMiss > 1 ? 'es' : ''}.`;
    } else {
      return `Safe, but you cannot miss the next class.`;
    }
  } else {
    if (target === 100) {
      return `You need to attend all remaining classes to reach 100%.`;
    }
    const needed = Math.ceil((target * total - 100 * present) / (100 - target));
    return `Must attend next <strong>${needed}</strong> class${needed > 1 ? 'es' : ''} consecutively.`;
  }
}

// Update overall Progress
function updateOverallStats(percentage, present, total, safeCount, dangerCount) {
  overallPercentageLabel.textContent = `${percentage}%`;
  overallAttendedLabel.textContent = present;
  overallTotalLabel.textContent = total;
  countSafeLabel.textContent = safeCount;
  countDangerLabel.textContent = dangerCount;

  const offset = PROGRESS_CIRCUMFERENCE - (percentage / 100) * PROGRESS_CIRCUMFERENCE;
  overallProgressCircle.style.strokeDashoffset = offset;
}

// Quick action: Increments log database entry for TODAY (appends session)
window.markAttendanceToday = function(subjectId, wasPresent) {
  const today = getTodayDateString();
  const status = wasPresent ? 'present' : 'absent';
  
  if (!state.logs[today]) {
    state.logs[today] = {};
  }
  
  if (!Array.isArray(state.logs[today][subjectId])) {
    state.logs[today][subjectId] = [];
  }
  
  state.logs[today][subjectId].push(status);
  
  saveStateToLocalStorage();
  renderApp();
  
  if (selectedDateString === today) {
    renderLogPanel(today);
  }
};

// Quick action: removes a specific today session log index
window.removeTodaySession = function(subjectId, sessionIndex) {
  const today = getTodayDateString();
  if (state.logs[today] && Array.isArray(state.logs[today][subjectId])) {
    state.logs[today][subjectId].splice(sessionIndex, 1);
    if (state.logs[today][subjectId].length === 0) {
      delete state.logs[today][subjectId];
    }
    if (Object.keys(state.logs[today]).length === 0) {
      delete state.logs[today];
    }
    saveStateToLocalStorage();
    renderApp();
    
    if (selectedDateString === today) {
      renderLogPanel(today);
    }
  }
};

// Modifies baseline counters
window.adjustCounter = function(subjectId, type, change) {
  const index = state.subjects.findIndex(s => s.id === subjectId);
  if (index === -1) return;

  const subject = state.subjects[index];
  
  if (type === 'present') {
    subject.historicalPresent = Math.max(0, (subject.historicalPresent || 0) + change);
    if (subject.historicalPresent > subject.historicalTotal) {
      subject.historicalTotal = subject.historicalPresent;
    }
  } else if (type === 'total') {
    subject.historicalTotal = Math.max(0, (subject.historicalTotal || 0) + change);
    if (subject.historicalTotal < subject.historicalPresent) {
      subject.historicalPresent = subject.historicalTotal;
    }
  }

  saveStateToLocalStorage();
  renderApp();
};


// ==========================================================================
// CALENDAR & LOG PANEL HANDLERS
// ==========================================================================

function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function changeMonth(dir) {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() + dir);
  renderCalendar();
}

function renderCalendar() {
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  calendarMonthYear.textContent = `${monthNames[month]} ${year}`;

  calendarDaysGrid.innerHTML = '';

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Padding blanks
  for (let i = 0; i < firstDayIndex; i++) {
    const blankCell = document.createElement('div');
    blankCell.className = 'calendar-day empty';
    calendarDaysGrid.appendChild(blankCell);
  }

  const todayStr = getTodayDateString();

  // Inject day cells
  for (let day = 1; day <= totalDays; day++) {
    const dayCell = document.createElement('div');
    dayCell.className = 'calendar-day';
    
    const formattedDay = String(day).padStart(2, '0');
    const formattedMonth = String(month + 1).padStart(2, '0');
    const dateStr = `${year}-${formattedMonth}-${formattedDay}`;

    if (dateStr === todayStr) {
      dayCell.classList.add('today');
    }
    if (dateStr === selectedDateString) {
      dayCell.classList.add('selected');
    }

    let dotsHtml = '';
    const dayLog = state.logs[dateStr];
    if (dayLog) {
      let count = 0;
      Object.keys(dayLog).forEach(subjId => {
        const sessions = dayLog[subjId];
        if (Array.isArray(sessions)) {
          sessions.forEach(status => {
            if (count < 4) {
              if (status === 'present') {
                dotsHtml += `<span class="indicator-dot present"></span>`;
              } else if (status === 'absent') {
                dotsHtml += `<span class="indicator-dot absent"></span>`;
              }
              count++;
            }
          });
        } else {
          if (count < 4) {
            if (sessions === 'present') {
              dotsHtml += `<span class="indicator-dot present"></span>`;
            } else if (sessions === 'absent') {
              dotsHtml += `<span class="indicator-dot absent"></span>`;
            }
            count++;
          }
        }
      });
    }

    dayCell.innerHTML = `
      <span class="day-num">${day}</span>
      <div class="day-indicators">
        ${dotsHtml}
      </div>
    `;

    dayCell.addEventListener('click', () => {
      const selected = calendarDaysGrid.querySelector('.calendar-day.selected');
      if (selected) selected.classList.remove('selected');
      dayCell.classList.add('selected');
      
      selectedDateString = dateStr;
      renderLogPanel(dateStr);
    });

    calendarDaysGrid.appendChild(dayCell);
  }

  if (selectedDateString) {
    renderLogPanel(selectedDateString);
  }
}

// Redraw log panel edit inputs for selected date (Schedule-aware!)
function renderLogPanel(dateString) {
  const [yr, mn, dy] = dateString.split('-');
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const formattedDate = `${months[parseInt(mn, 10) - 1]} ${parseInt(dy, 10)}, ${yr}`;
  
  logSelectedDateLabel.textContent = formattedDate;

  if (state.subjects.length === 0) {
    logSubjectsList.classList.add('hidden');
    logEditorContainer.querySelector('.no-date-selected-text').textContent = "Set up your subjects first to start logging attendance.";
    logEditorContainer.querySelector('.no-date-selected-text').classList.remove('hidden');
    return;
  }

  logEditorContainer.querySelector('.no-date-selected-text').classList.add('hidden');
  logSubjectsList.classList.remove('hidden');
  logSubjectsList.innerHTML = '';

  const dayLogs = state.logs[dateString] || {};
  
  // Schedule-aware sorting: subjects scheduled for this weekday should go first
  const parsedDate = new Date(parseInt(yr,10), parseInt(mn,10)-1, parseInt(dy,10));
  const dayName = WEEKDAYS[parsedDate.getDay()];
  const scheduledNames = state.schedule[dayName] || [];

  // Categorize subjects into scheduled and other
  const scheduledSubjects = [];
  const otherSubjects = [];

  state.subjects.forEach(subject => {
    const isScheduled = scheduledNames.some(name => name.toLowerCase() === subject.name.toLowerCase());
    if (isScheduled) {
      scheduledSubjects.push(subject);
    } else {
      otherSubjects.push(subject);
    }
  });

  // Render scheduled subjects first
  if (scheduledSubjects.length > 0) {
    const divider = document.createElement('div');
    divider.className = 'quick-info-badge';
    divider.style = 'align-self: flex-start; margin-bottom: 0.5rem; background: rgba(99,102,241,0.08); border-color: rgba(99,102,241,0.15); color: #a5b4fc;';
    divider.textContent = `Scheduled for ${dayName}`;
    logSubjectsList.appendChild(divider);

    scheduledSubjects.forEach(subject => renderLogPanelRow(subject, dayLogs, dateString));
  }

  // Render other subjects
  if (otherSubjects.length > 0) {
    if (scheduledSubjects.length > 0) {
      const divider = document.createElement('div');
      divider.className = 'quick-info-badge';
      divider.style = 'align-self: flex-start; margin-bottom: 0.5rem; margin-top: 1rem;';
      divider.textContent = 'Other Subjects';
      logSubjectsList.appendChild(divider);
    }
    otherSubjects.forEach(subject => renderLogPanelRow(subject, dayLogs, dateString));
  }
}

// Render individual subject row in log side-panel
function renderLogPanelRow(subject, dayLogs, dateString) {
  const sessions = dayLogs[subject.id] || [];

  const row = document.createElement('div');
  row.className = 'log-subject-row-multi';
  row.style = 'margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.04); display: flex; flex-direction: column; gap: 0.5rem;';

  let sessionsHtml = '';
  if (sessions.length === 0) {
    sessionsHtml = '<span style="font-size: 0.8rem; color: var(--text-muted);">No classes logged for this day</span>';
  } else {
    sessionsHtml = '<div style="display:flex; flex-direction:column; gap:0.4rem;">';
    sessions.forEach((status, idx) => {
      const isPres = status === 'present';
      sessionsHtml += `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); padding:0.35rem 0.65rem; border-radius:6px; border:1px solid rgba(255,255,255,0.04);">
          <span style="font-size:0.8rem; font-weight:500;">Class ${idx + 1}: <span style="color:${isPres ? 'var(--safe-color)' : 'var(--danger-color)'}">${isPres ? 'Present' : 'Absent'}</span></span>
          <div style="display:flex; gap:0.35rem; align-items:center;">
            <button class="btn btn-secondary" style="padding:0.15rem 0.45rem; font-size:0.7rem; height:24px;" onclick="toggleSessionStatus('${dateString}', '${subject.id}', ${idx})">Toggle P/A</button>
            <button class="btn btn-secondary btn-icon-only" style="width:24px; height:24px; border-color:var(--danger-border); color:var(--danger-color);" onclick="deleteSession('${dateString}', '${subject.id}', ${idx})">
              <i data-lucide="trash-2" style="width:12px; height:12px;"></i>
            </button>
          </div>
        </div>
      `;
    });
    sessionsHtml += '</div>';
  }

  row.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <span style="font-family:var(--font-display); font-weight:600; font-size:0.95rem; color:#fff;" title="${escapeHtml(subject.name)}">${escapeHtml(subject.name)}</span>
      <div style="display:flex; gap:0.35rem;">
        <button class="btn btn-success" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="addDaySession('${dateString}', '${subject.id}', 'present')">+ Present</button>
        <button class="btn btn-danger" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="addDaySession('${dateString}', '${subject.id}', 'absent')">+ Absent</button>
      </div>
    </div>
    ${sessionsHtml}
  `;
  logSubjectsList.appendChild(row);
}

window.addDaySession = function(dateStr, subjectId, status) {
  if (!state.logs[dateStr]) {
    state.logs[dateStr] = {};
  }
  if (!Array.isArray(state.logs[dateStr][subjectId])) {
    state.logs[dateStr][subjectId] = [];
  }
  state.logs[dateStr][subjectId].push(status);
  saveStateToLocalStorage();
  renderApp();
  renderCalendar();
};

window.toggleSessionStatus = function(dateStr, subjectId, index) {
  if (state.logs[dateStr] && Array.isArray(state.logs[dateStr][subjectId])) {
    const current = state.logs[dateStr][subjectId][index];
    state.logs[dateStr][subjectId][index] = current === 'present' ? 'absent' : 'present';
    saveStateToLocalStorage();
    renderApp();
    renderCalendar();
  }
};

window.deleteSession = function(dateStr, subjectId, index) {
  if (state.logs[dateStr] && Array.isArray(state.logs[dateStr][subjectId])) {
    state.logs[dateStr][subjectId].splice(index, 1);
    if (state.logs[dateStr][subjectId].length === 0) {
      delete state.logs[dateStr][subjectId];
    }
    if (Object.keys(state.logs[dateStr]).length === 0) {
      delete state.logs[dateStr];
    }
    saveStateToLocalStorage();
    renderApp();
    renderCalendar();
  }
};

window.setDayAttendanceStatus = function(dateStr, subjectId, status) {
  // Legacy handler compatibility
  if (status === 'none') {
    delete state.logs[dateStr][subjectId];
    if (Object.keys(state.logs[dateStr]).length === 0) {
      delete state.logs[dateStr];
    }
  } else {
    if (!state.logs[dateStr]) state.logs[dateStr] = {};
    state.logs[dateStr][subjectId] = [status];
  }
  saveStateToLocalStorage();
  renderApp();
};


// ==========================================================================
// DRAG & DROP AND OCR PARSER LOGIC
// ==========================================================================

function setupTimetableDragAndDrop() {
  // Prevent defaults for all drag events
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    timetableUploadZone.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // Visual dragover feedback
  ['dragenter', 'dragover'].forEach(eventName => {
    timetableUploadZone.addEventListener(eventName, () => {
      timetableUploadZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    timetableUploadZone.addEventListener(eventName, () => {
      timetableUploadZone.classList.remove('dragover');
    }, false);
  });

  // Handle dropped files
  timetableUploadZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleTimetableFiles(files);
  });

  // Handle clicked files
  timetableFileInput.addEventListener('change', (e) => {
    handleTimetableFiles(e.target.files);
  });
}

function handleTimetableFiles(files) {
  if (files.length === 0) return;
  const file = files[0];
  if (!file.type.startsWith('image/')) {
    alert("Please upload a valid image file (PNG, JPG)!");
    return;
  }

  // Switch to loading mode
  timetableInputMethods.classList.add('hidden');
  ocrLoader.classList.remove('hidden');
  btnParseText.classList.add('hidden');

  // Run OCR
  Tesseract.recognize(
    file,
    'eng',
    { logger: m => {
      if (m.status === 'recognizing') {
        ocrLoaderText.textContent = `Analyzing image contents: ${Math.round(m.progress * 100)}%`;
      } else {
        ocrLoaderText.textContent = `${m.status}...`;
      }
    }}
  ).then(({ data: { text } }) => {
    console.log("OCR Extracted text:", text);
    parseAndShowTimetable(text);
  }).catch(err => {
    console.error("OCR Error: ", err);
    alert("Optical Character Recognition (OCR) failed to analyze the image. Please try pasting the text manually!");
    ocrLoader.classList.add('hidden');
    timetableInputMethods.classList.remove('hidden');
    btnParseText.classList.remove('hidden');
  });
}

// Dictionary-based greedy timetable parser.
// OCR outputs table rows as continuous text (e.g. "Monday = = Deep Learning Research Methodology Project Project Project =")
// We can't split by spaces because multi-word subjects share single-space boundaries.
// Strategy: build a subject dictionary, scan for longest matches first, extract them, then handle leftovers.

// Known multi-word subject patterns (longest first for greedy matching)
const SUBJECT_DICTIONARY = [
  // 4-word
  "T & P Activities", "T and P Activities",
  // 3-word
  "Deep Learning Lab", "Cyber Security Lab", "Research Methodology Lab",
  "Machine Learning Lab", "Artificial Intelligence Lab", "Data Science Lab",
  "Computer Networks Lab", "Operating Systems Lab", "Database Management Lab",
  "Software Engineering Lab", "Web Development Lab", "Cloud Computing Lab",
  "Information Retrieval Lab", "Natural Language Processing",
  "Digital Signal Processing", "Computer Graphics Lab",
  "Object Oriented Programming", "Data Structures Lab",
  // 2-word
  "Deep Learning", "Cyber Security", "Research Methodology",
  "UNIX Internals", "Information Retrieval", "Machine Learning",
  "Artificial Intelligence", "Data Science", "Computer Networks",
  "Operating Systems", "Database Management", "Software Engineering",
  "Web Development", "Cloud Computing", "Data Mining",
  "Computer Architecture", "Digital Electronics", "Discrete Mathematics",
  "Linear Algebra", "Numerical Methods", "Probability Statistics",
  "Engineering Mathematics", "Engineering Physics", "Engineering Chemistry",
  "Digital Signal", "Computer Graphics", "Image Processing",
  "Network Security", "Mobile Computing", "Distributed Systems",
  "Compiler Design", "Theory Computation", "Design Analysis",
  "Big Data", "Internet Things", "Embedded Systems",
  "Data Structures", "Object Oriented", "Web Technology",
  "Soft Computing", "Fuzzy Logic", "Neural Networks",
  "Ethical Hacking", "Blockchain Technology", "Quantum Computing",
  "Human Computer", "Professional Ethics", "Environmental Studies",
  "Business Intelligence", "Information Security",
  "Computer Vision", "Parallel Computing", "System Programming",
  "Advanced Java", "Python Programming", "Java Programming",
  "C Programming",
  // 1-word (but important standalone names)
  "BFSI", "Project", "Honors", "Seminar", "Workshop", "Tutorial",
  "Elective", "Lab", "Internship", "Placement", "Minor"
].sort((a, b) => b.length - a.length); // Sort longest first for greedy matching

function parseAndShowTimetable(rawText) {
  tempParsedSchedule = {
    "Monday": Array(8).fill("—"),
    "Tuesday": Array(8).fill("—"),
    "Wednesday": Array(8).fill("—"),
    "Thursday": Array(8).fill("—"),
    "Friday": Array(8).fill("—"),
    "Saturday": Array(8).fill("—"),
    "Sunday": Array(8).fill("—")
  };

  // Log raw OCR text for debugging
  console.log("--- OCR Raw Text ---");
  console.log(rawText);
  console.log("--- End OCR Raw Text ---");

  const lines = rawText.split('\n');
  let currentDay = null;

  const dayPatterns = [
    { regex: /\b(monday)\b/i, day: 'Monday' },
    { regex: /\b(tuesday)\b/i, day: 'Tuesday' },
    { regex: /\b(wednesday)\b/i, day: 'Wednesday' },
    { regex: /\b(thursday)\b/i, day: 'Thursday' },
    { regex: /\b(friday)\b/i, day: 'Friday' },
    { regex: /\b(saturday)\b/i, day: 'Saturday' },
    { regex: /\b(sunday)\b/i, day: 'Sunday' },
    { regex: /\bmon\b/i, day: 'Monday' },
    { regex: /\btue\b/i, day: 'Tuesday' },
    { regex: /\bwed\b/i, day: 'Wednesday' },
    { regex: /\bthu\b/i, day: 'Thursday' },
    { regex: /\bfri\b/i, day: 'Friday' },
    { regex: /\bsat\b/i, day: 'Saturday' },
    { regex: /\bsun\b/i, day: 'Sunday' }
  ];

  lines.forEach(line => {
    const cleanLine = line.trim();
    if (!cleanLine) return;

    // Detect weekday
    let detectedDay = null;
    for (const dp of dayPatterns) {
      if (dp.regex.test(cleanLine)) {
        detectedDay = dp.day;
        break;
      }
    }

    if (detectedDay) {
      currentDay = detectedDay;
    }

    if (!currentDay) return;

    // Clean the line for scanning
    let textToScan = cleanLine;

    // Remove day names
    textToScan = textToScan.replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/gi, ' ');

    // Normalize empty slots (dashes, equal signs)
    textToScan = textToScan.replace(/[=]/g, ' — ');
    textToScan = textToScan.replace(/\s+-\s+/g, ' — ');

    // Remove parenthesized codes
    textToScan = textToScan.replace(/\([^)]*\)/g, ' ');
    textToScan = textToScan.replace(/\b[A-Z]\d+:/g, ' ');

    // Extract slots sequentially by matching known slot patterns or fallback words
    const extractedSlots = [];
    
    // Build regex of known subjects + dashes + general words
    const patternsEscaped = SUBJECT_DICTIONARY.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const slotRegexStr = "(" + patternsEscaped.join("|") + "|—|-|\\S+)";
    const slotRegex = new RegExp(slotRegexStr, "gi");
    
    let match;
    while ((match = slotRegex.exec(textToScan)) !== null) {
      const matchVal = match[0].trim();
      if (matchVal) {
        if (matchVal === '-' || matchVal === '—') {
          extractedSlots.push('—');
        } else {
          // Skip noise words
          const noiseWords = new Set([
            'to', 'the', 'and', 'of', 'in', 'for', 'a', 'an', 'or', 'is', 'at',
            'be', 'class', 'room', 'sec', 'sem', 'batch', 'break', 'lunch',
            'cc', 'day', 'year', 'final', 'engineering', 'computer', 'department'
          ]);
          if (!noiseWords.has(matchVal.toLowerCase()) && !/^\d+$/.test(matchVal)) {
            extractedSlots.push(formatSubjectName(matchVal));
          }
        }
      }
    }

    // Align extracted slots to the 8 timetable slots
    for (let i = 0; i < 8; i++) {
      tempParsedSchedule[currentDay][i] = extractedSlots[i] || '—';
    }
  });

  renderTimetablePreviewEditor();
}

// Greedy dictionary-based subject extractor (retained for backward compatibility)
function extractSubjectsFromText(text) {
  const results = [];
  let remaining = text;

  for (const subject of SUBJECT_DICTIONARY) {
    const regex = new RegExp(subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let match;
    while ((match = regex.exec(remaining)) !== null) {
      results.push(formatSubjectName(match[0]));
    }
    remaining = remaining.replace(regex, ' §§ ').trim();
  }

  remaining = remaining.replace(/§§/g, ' ').replace(/\s+/g, ' ').trim();
  if (remaining) {
    const leftoverTokens = remaining.split(/\s{2,}|[,;|]/);
    leftoverTokens.forEach(token => {
      const clean = token.trim();
      if (!clean || clean.length < 2) return;
      if (/^\d+$/.test(clean)) return;
      if (/^[a-z]+$/.test(clean)) return;
      const noiseWords = new Set([
        'to', 'the', 'and', 'of', 'in', 'for', 'a', 'an', 'or', 'is', 'at',
        'be', 'class', 'room', 'sec', 'sem', 'batch', 'break', 'lunch',
        'cc', 'day', 'year', 'final'
      ]);
      if (noiseWords.has(clean.toLowerCase())) return;
      if (/^[A-Z]/.test(clean) || clean === clean.toUpperCase()) {
        results.push(formatSubjectName(clean));
      }
    });
  }

  return results;
}

function formatSubjectName(name) {
  if (name.includes('/')) {
    return name.split('/').map(s => formatSubjectName(s.trim())).join(' / ');
  }
  return name.split(/\s+/)
    .map(word => {
      // Preserve all-uppercase short words (e.g. UNIX, BFSI, DL, CS, AI)
      if (word === word.toUpperCase() && word.length >= 2 && word.length <= 5) {
        return word;
      }
      if (word === '&') return '&';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}


// Render tabular preview spreadsheet-like editor inside timetable modal
function renderTimetablePreviewEditor() {
  weekdayGridEditor.innerHTML = '';
  
  const activeDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  
  // Get all unique subject names currently tracked
  const subjectOptions = new Set();
  state.subjects.forEach(s => subjectOptions.add(s.name));
  
  // Also collect any parsed subject names in the temp parsed schedule so they don't get lost
  Object.keys(tempParsedSchedule).forEach(day => {
    if (Array.isArray(tempParsedSchedule[day])) {
      tempParsedSchedule[day].forEach(val => {
        const clean = val.trim();
        const isEmpty = !clean || clean === '—' || clean === '-' || clean === 'empty';
        if (!isEmpty) {
          subjectOptions.add(clean);
        }
      });
    }
  });

  const subjectList = [...subjectOptions].sort();
  
  let tableHtml = `
    <div style="overflow-x:auto; width:100%; margin-top:1rem; border-radius: var(--radius-sm); border: 1px solid rgba(255,255,255,0.06); background: rgba(0,0,0,0.2);">
      <table style="width:100%; border-collapse:collapse; min-width:850px; text-align:left;">
        <thead>
          <tr style="border-bottom: 1.5px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.02);">
            <th style="padding:0.6rem 0.5rem; color:#fff; font-size:0.8rem; font-weight:600; width:100px;">Day</th>
            ${TIME_SLOTS.map(t => `<th style="padding:0.6rem 0.5rem; color:#fff; font-size:0.75rem; font-weight:600; text-align:center;">${t}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
  `;
  
  activeDays.forEach(day => {
    if (!Array.isArray(tempParsedSchedule[day])) {
      tempParsedSchedule[day] = Array(8).fill("—");
    }
    while (tempParsedSchedule[day].length < 8) {
      tempParsedSchedule[day].push("—");
    }
    
    tableHtml += `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s;">
        <td style="padding:0.5rem; font-weight:600; color:var(--accent-glow-end); font-size:0.8rem; background: rgba(255,255,255,0.01);">${day}</td>
    `;
    
    tempParsedSchedule[day].forEach((val, idx) => {
      let optionsHtml = `<option value="—" ${val === '—' ? 'selected' : ''}>—</option>`;
      subjectList.forEach(subj => {
        optionsHtml += `<option value="${escapeHtml(subj)}" ${val.toLowerCase() === subj.toLowerCase() ? 'selected' : ''}>${escapeHtml(subj)}</option>`;
      });

      tableHtml += `
        <td style="padding:0.35rem 0.2rem; text-align:center;">
          <select class="grid-slot-select" data-day="${day}" data-idx="${idx}" 
            onchange="updateTempGridSlot('${day}', ${idx}, this.value)"
            style="width:100%; min-width:95px; text-align:center; padding:0.35rem 0.25rem; background:rgba(20,22,36,0.9); border:1px solid rgba(255,255,255,0.12); border-radius:4px; color:#fff; font-size:0.75rem; font-family:var(--font-sans); cursor:pointer;"
          >
            ${optionsHtml}
          </select>
        </td>
      `;
    });
    
    tableHtml += `</tr>`;
  });
  
  tableHtml += `
        </tbody>
      </table>
    </div>
  `;
  
  weekdayGridEditor.innerHTML = tableHtml;

  timetableInputMethods.classList.add('hidden');
  ocrLoader.classList.add('hidden');
  timetablePreview.classList.remove('hidden');
  
  btnParseText.classList.add('hidden');
  btnConfirmTimetable.classList.remove('hidden');

  lucide.createIcons();
}

window.updateTempGridSlot = function(day, idx, value) {
  if (!tempParsedSchedule[day]) {
    tempParsedSchedule[day] = Array(8).fill("—");
  }
  tempParsedSchedule[day][idx] = value.trim() || "—";
};

// Confirm weekly timetable and merge subjects
function confirmTimetableImport() {
  const detectedSubjects = [];
  
  // Find all unique subjects in the temp schedule
  Object.keys(tempParsedSchedule).forEach(day => {
    tempParsedSchedule[day].forEach(name => {
      const clean = name.trim();
      const isEmpty = !clean || clean === '—' || clean === '-' || clean === 'empty';
      if (!isEmpty) {
        // Handle slash split subjects e.g. Deep Learning Lab / Cyber Security Lab / Project
        if (clean.includes('/')) {
          const subs = clean.split('/');
          subs.forEach(s => {
            const cleanSub = s.trim();
            if (cleanSub && cleanSub.length > 1 && !detectedSubjects.some(n => n.toLowerCase() === cleanSub.toLowerCase())) {
              detectedSubjects.push(cleanSub);
            }
          });
        } else {
          if (!detectedSubjects.some(n => n.toLowerCase() === clean.toLowerCase())) {
            detectedSubjects.push(clean);
          }
        }
      }
    });
  });

  if (detectedSubjects.length === 0) {
    alert("No subjects detected in schedule. Please add some first!");
    return;
  }

  // Handle saving as shared template
  if (chkSaveTemplate.checked) {
    const tName = txtTemplateName.value.trim();
    if (!tName) {
      alert("Please provide a name for your shared timetable template!");
      return;
    }
    const templateId = 'temp-' + Date.now();
    const newTemplate = {
      id: templateId,
      name: tName,
      schedule: tempParsedSchedule,
      createdBy: currentUser ? currentUser.uid : 'anonymous'
    };

    if (firestoreDb) {
      firestoreDb.collection("timetableTemplates").doc(templateId).set(newTemplate)
        .catch(e => console.error("Error saving template to cloud:", e));
    }
  }

  // Merge subjects list
  detectedSubjects.forEach(name => {
    const existing = state.subjects.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (!existing) {
      const formattedName = formatSubjectName(name);
      const subjectId = generateSubjectId(formattedName, state.subjects);
      state.subjects.push({
        id: subjectId,
        name: formattedName,
        historicalPresent: 0,
        historicalTotal: 0
      });
    }
  });

  // Save schedule map
  state.schedule = tempParsedSchedule;

  saveStateToLocalStorage();
  closeModal(modalTimetable);
  renderApp();
  
  if (tabBtnTimetableView.classList.contains('active')) {
    renderTimetableView();
  }
  
  alert("Weekly schedule successfully saved! Subjects configured.");
}


// ==========================================================================
// BACKUP IMPORT & EXPORT HANDLERS
// ==========================================================================

function exportData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  
  const dateStamp = new Date().toISOString().split('T')[0];
  downloadAnchor.setAttribute("download", `aura_attend_backup_${dateStamp}.json`);
  
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importData(e) {
  const fileReader = new FileReader();
  const file = e.target.files[0];
  if (!file) return;

  fileReader.onload = function(event) {
    try {
      const importedState = JSON.parse(event.target.result);
      
      if (importedState && (Array.isArray(importedState.subjects) || typeof importedState.logs === 'object')) {
        state = importedState;
        
        if (!Array.isArray(state.subjects)) state.subjects = [];
        if (!state.logs || typeof state.logs !== 'object') state.logs = {};
        if (!state.schedule || typeof state.schedule !== 'object') state.schedule = {};
        if (typeof state.targetPercentage !== 'number') state.targetPercentage = 75;

        state.subjects.forEach(sub => {
          if (!sub.id) {
            sub.id = generateSubjectId(sub.name, state.subjects.filter(s => s !== sub));
          }
          if (sub.present !== undefined && sub.historicalPresent === undefined) {
            sub.historicalPresent = sub.present;
            delete sub.present;
          }
          if (sub.total !== undefined && sub.historicalTotal === undefined) {
            sub.historicalTotal = sub.total;
            delete sub.total;
          }
          if (sub.historicalPresent === undefined) sub.historicalPresent = 0;
          if (sub.historicalTotal === undefined) sub.historicalTotal = 0;
        });

        saveStateToLocalStorage();
        targetRange.value = state.targetPercentage;
        targetValueLabel.textContent = `${state.targetPercentage}%`;
        
        currentCalendarDate = new Date();
        selectedDateString = getTodayDateString();

        renderApp();
        closeModal(modalBackup);
        alert('Data successfully restored from backup file!');
      } else {
        alert('Invalid backup file format. Could not import.');
      }
    } catch (err) {
      alert('Error parsing JSON backup file.');
      console.error(err);
    }
  };
  fileReader.readAsText(file);
  e.target.value = '';
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
