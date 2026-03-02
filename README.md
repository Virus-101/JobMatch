# 🎯 JobMatch AI — Smart Job Application Browser Extension

> **Score, save, and track jobs automatically based on your CV and preferences.**

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=google-chrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-6366F1)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

### 🔍 Smart Job Matching
- **CV Parsing** — Paste your resume and automatically extract skills, experience, and contact info
- **Job Scoring** — Every job listing gets a 0-100 match score based on your profile
- **Multi-criteria Matching** — Scores based on skills (35%), title (25%), location (15%), experience (10%), keywords (10%), and salary (5%)

### 💼 Supported Job Sites
- LinkedIn Jobs
- Indeed
- Glassdoor
- Monster
- ZipRecruiter

### 📊 Job Tracking
- Save interesting jobs with one click
- Track application status: Saved → Applied → Interview → Offer
- Filter and search your saved jobs
- Export all data as JSON

### ⚙️ Preferences Engine
- Set desired job titles and locations
- Remote-only filter
- Salary range matching
- Must-have and exclude keyword filters
- Job type preferences (full-time, part-time, contract, internship)

## 🚀 Installation

### Load as Unpacked Extension (Developer Mode)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **"Load unpacked"**
4. Select this project folder (`Auto-Apply`)
5. The extension icon should appear in your toolbar!

## 📖 How to Use

### Step 1: Set Up Your Profile
1. Click the JobMatch AI icon in the toolbar
2. Go to the **Profile** tab
3. Paste your CV/resume text and click **"Parse CV & Extract Skills"**
4. Review and add any additional skills manually
5. Fill in your personal info
6. Click **Save Profile**

### Step 2: Configure Preferences
1. Go to the **Preferences** tab
2. Add your desired job titles (e.g., "Frontend Developer", "React Engineer")
3. Set preferred locations or check "Remote only"
4. Set your salary range
5. Add must-have or exclude keywords
6. Click **Save Preferences**

### Step 3: Browse Jobs
1. Visit any supported job site (LinkedIn, Indeed, etc.)
2. JobMatch AI will automatically score each job listing
3. Look for the score badge on each job card
4. Click the bookmark icon to save interesting jobs
5. Use **"Scan This Page"** in the popup to manually trigger scoring

### Step 4: Track Applications
1. Go to the **Saved Jobs** tab
2. Update job status as you apply and progress
3. Use filters to view jobs by status
4. Export your data anytime

## 🏗️ Project Structure

```
Auto-Apply/
├── manifest.json          # Chrome Extension manifest (V3)
├── popup/
│   ├── popup.html         # Main popup UI
│   ├── popup.css          # Premium dark theme styles
│   └── popup.js           # Popup controller & logic
├── content/
│   ├── content.js         # Content script (runs on job sites)
│   └── content.css        # Injected badge styles
├── background/
│   └── background.js      # Service worker
├── utils/
│   ├── storage.js         # Chrome Storage API wrapper
│   ├── cv-parser.js       # CV/Resume text parser
│   └── job-matcher.js     # Job matching & scoring engine
└── assets/
    └── icons/             # Extension icons
```

## 🧠 Scoring Algorithm

| Factor | Weight | How it works |
|--------|--------|-------------|
| **Skills** | 35% | Matches your skills against job description keywords |
| **Title** | 25% | Compares your desired titles with the job title |
| **Location** | 15% | Checks location preferences & remote compatibility |
| **Experience** | 10% | Compares your years of experience vs requirements |
| **Keywords** | 10% | Checks for must-have keywords in the listing |
| **Salary** | 5% | Validates against your salary range |

### Match Levels
- 🔥 **Excellent Match** (85-100) — Apply immediately!
- ⭐ **Great Match** (70-84) — Highly recommended
- 👍 **Good Match** (55-69) — Worth considering
- 🤔 **Fair Match** (40-54) — Review carefully
- 😐 **Low Match** (0-39) — May not be the best fit

## 🔮 Roadmap (Platform Evolution)

- [ ] **Phase 2**: Backend API with user accounts
- [ ] **Phase 3**: AI-powered cover letter generation
- [ ] **Phase 4**: Auto-fill application forms
- [ ] **Phase 5**: Job recommendation engine
- [ ] **Phase 6**: Analytics dashboard & insights
- [ ] **Phase 7**: Team/Agency features
- [ ] **Phase 8**: Monetization (freemium model)

## 🛡️ Privacy

- **All data stays local** — Your CV and preferences are stored in Chrome's local storage
- **No data sent anywhere** — The extension works entirely offline
- **No tracking** — Zero analytics or telemetry
- **You own your data** — Export anytime as JSON

## 📄 License

MIT License — Feel free to use, modify, and distribute.

---

**Built with ❤️ for job seekers everywhere.**
