# AuraAttend | Premium Attendance Tracker & Analytics

AuraAttend is a premium, glassmorphic, responsive single-page web application designed to help you track your class attendance, view calendar logs, import weekly timetables, and plan your schedules with smart predictive forecasts.

![AuraAttend Mockup](https://raw.githubusercontent.com/google/gemini-agent-assets/main/attendance-tracker-banner.png) *(Note: Placeholder path for illustration)*

---

## Key Features

- **Double-View Dashboard:**
  - **Dashboard Panel:** Overview of your total progress, shortage alerts, target threshold slider, and subject stats cards.
  - **Calendar Log Panel:** Full interactive monthly calendar grid. Select any date (past, present, or future) to log specific attendance entries or view a summary of that day's logs (colored indicator dots).
- **Smart Timetable Import (OCR):**
  - **Image Upload:** Upload a screenshot of your weekly timetable (PNG, JPG). The client-side OCR engine (powered by Tesseract.js) will scan the text.
  - **Heuristic Parsing:** Automatically parses days of the week and extracts clean subject names, filtering out time labels (e.g. 9:00 AM).
  - **Manual Fallback:** You can paste text directly or edit the parsed results in the preview grid before confirming.
- **Schedule-Aware Tracking:**
  - **Classes Scheduled Today:** Displays a quick-access panel on the dashboard showing only the subjects scheduled for the current weekday.
  - **Prioritized Calendar Logging:** In the calendar logging side-panel, the subjects scheduled for that date's weekday are automatically grouped at the top, so you don't have to scroll.
- **Segmented Logging Options:** Log `Present`, `Absent`, or `No Class` for each subject on any date.
- **Smart Attendance Forecasts:**
  - **On Track (Safe):** Tells you exactly how many consecutive classes you can safely miss without dipping below your target percentage.
  - **Shortage Alert:** Calculates exactly how many consecutive classes you must attend to reach your target percentage.
- **Visual Analytics:** Interactive glassmorphic dashboard showcasing overall metrics and circular progress bars.
- **Private & Safe:** Stores all records locally in your browser using `localStorage`. No logins or backend servers required.
- **Data Backups:** Easily export your log database as a JSON file and restore it on any other device.

---

## Math Behind the Analytics

AuraAttend uses precise formulas to calculate forecast statistics based on your target percentage ($T$, e.g., $75\%$):

### 1. Dynamic Subject Stat Aggregation
For each subject:
$$\text{Total Present} = \text{Historical Baseline Present} + \text{Count of 'Present' Logs in Calendar}$$
$$\text{Total Classes} = \text{Historical Baseline Total} + \text{Count of ('Present' + 'Absent') Logs in Calendar}$$
$$\text{Subject Attendance \%} = \frac{\text{Total Present}}{\text{Total Classes}} \times 100$$

### 2. Forecast Guidance
- **If you are Safe (Current % $\ge$ Target %):**
  We calculate the maximum number of classes ($x$) you can miss consecutively before falling below target:
  $$x = \lfloor \frac{100 \times \text{Total Present}}{\text{Target \%}} \rfloor - \text{Total Classes}$$

- **If you have a Shortage (Current % < Target %):**
  We calculate the minimum number of consecutive classes ($y$) you must attend to recover:
  $$y = \lceil \frac{\text{Target \%} \times \text{Total Classes} - 100 \times \text{Total Present}}{100 - \text{Target \%}} \rceil$$

---

## How to Run Locally

Since this is a client-side static web application (HTML/CSS/JS), it requires no installation.

1. Locate the project folder: `c:\proj\attendance`
2. Double-click the `index.html` file to open it in any modern web browser.
3. Alternatively, run a local development server using Python:
   ```bash
   python -m http.server 8000
   ```
   Then open `http://localhost:8000` in your web browser.

---

## Deployment Guide (How to host it online for FREE)

You can share your attendance tracker or access it from your phone by deploying it. Here are the 3 simplest ways:

### Option 1: Netlify Drag & Drop (Easiest - 1 minute)
1. Open your browser and go to [Netlify Drop](https://app.netlify.com/drop).
2. Drag and drop the entire `attendance` folder (`c:\proj\attendance`) directly into the upload area on the website.
3. Netlify will upload the files and instantly give you a live public URL.
4. (Optional) Create a free account to customize your site name.

### Option 2: GitHub Pages (Best for code tracking - 3 minutes)
1. Go to [GitHub](https://github.com) and log in (or sign up for free).
2. Create a new repository named `my-attendance-tracker` (set it to Public).
3. Initialize git in your project directory and push your files:
   ```bash
   git init
   git add .
   git commit -m "Initial commit with calendar and timetable OCR"
   git branch -M main
   git remote add origin https://github.com/your-username/my-attendance-tracker.git
   git push -u origin main
   ```
4. On your GitHub repository page:
   - Click on **Settings** (top tab).
   - Scroll down to the **Pages** menu (under Code and Automation).
   - Under **Build and deployment**, set the Source to **Deploy from a branch**.
   - Under **Branch**, select `main` and `/ (root)`, then click **Save**.
5. Wait 1-2 minutes. Your website will be live at `https://your-username.github.io/my-attendance-tracker/`.

### Option 3: Vercel (Fast & Premium - 2 minutes)
1. Go to [Vercel](https://vercel.com) and sign up for a free Hobby account.
2. Select **Add New** > **Project**.
3. Import your GitHub repository (`my-attendance-tracker`).
4. Click **Deploy**. Vercel will automatically host it and give you a clean production link.
