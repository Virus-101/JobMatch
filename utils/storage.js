// ============================================
// JobMatch AI — Storage Utility
// ============================================

const StorageManager = {
  // Default profile structure
  DEFAULT_PROFILE: {
    name: '',
    email: '',
    phone: '',
    location: '',
    title: '',
    summary: '',
    skills: [],
    experience: [],
    education: [],
    cvText: '',
    preferences: {
      desiredTitles: [],
      desiredLocations: [],
      remoteOnly: false,
      salaryMin: 0,
      salaryMax: 0,
      jobTypes: ['full-time'], // full-time, part-time, contract, internship
      excludeKeywords: [],
      mustHaveKeywords: []
    },
    createdAt: null,
    updatedAt: null
  },

  // Save user profile
  async saveProfile(profile) {
    profile.updatedAt = new Date().toISOString();
    if (!profile.createdAt) {
      profile.createdAt = new Date().toISOString();
    }
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ userProfile: profile }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(profile);
        }
      });
    });
  },

  // Get user profile
  async getProfile() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['userProfile'], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result.userProfile || { ...this.DEFAULT_PROFILE });
        }
      });
    });
  },

  // Save a job to the saved jobs list
  async saveJob(job) {
    const jobs = await this.getSavedJobs();
    const existingIndex = jobs.findIndex(j => j.id === job.id);
    
    if (existingIndex >= 0) {
      jobs[existingIndex] = { ...jobs[existingIndex], ...job };
    } else {
      job.savedAt = new Date().toISOString();
      job.status = job.status || 'saved'; // saved, applied, interview, rejected, offer
      jobs.push(job);
    }

    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ savedJobs: jobs }, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(jobs);
      });
    });
  },

  // Get all saved jobs
  async getSavedJobs() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['savedJobs'], (result) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(result.savedJobs || []);
      });
    });
  },

  // Remove a saved job
  async removeJob(jobId) {
    const jobs = await this.getSavedJobs();
    const filtered = jobs.filter(j => j.id !== jobId);
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ savedJobs: filtered }, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(filtered);
      });
    });
  },

  // Update job status
  async updateJobStatus(jobId, status) {
    const jobs = await this.getSavedJobs();
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      job.status = status;
      job.updatedAt = new Date().toISOString();
      if (status === 'applied') {
        job.appliedAt = new Date().toISOString();
      }
    }
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ savedJobs: jobs }, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(jobs);
      });
    });
  },

  // Get stats
  async getStats() {
    const jobs = await this.getSavedJobs();
    return {
      totalSaved: jobs.length,
      applied: jobs.filter(j => j.status === 'applied').length,
      interviews: jobs.filter(j => j.status === 'interview').length,
      offers: jobs.filter(j => j.status === 'offer').length,
      rejected: jobs.filter(j => j.status === 'rejected').length,
    };
  },

  // Clear all data
  async clearAll() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });
  }
};

// Make available globally (for content scripts)
if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
}
