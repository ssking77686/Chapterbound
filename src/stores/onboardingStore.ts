import { create } from 'zustand'

const STORAGE_KEY = 'ereader-onboarding-v1'

function loadCompleted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function saveCompleted() {
  try {
    localStorage.setItem(STORAGE_KEY, 'true')
  } catch { /* ignore */ }
}

interface OnboardingState {
  hasCompleted: boolean
  isActive: boolean
  currentStep: number
  pendingNavigation: 'reader' | null
  start: () => void
  advance: () => void
  skip: () => void
  clearNavigation: () => void
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  hasCompleted: loadCompleted(),
  isActive: false,
  currentStep: 0,
  pendingNavigation: null,

  start: () => set({ isActive: true, currentStep: 0 }),

  advance: () => {
    const { currentStep } = get()
    const next = currentStep + 1
    // Step 4 (start-exploring) → Step 5 (page-turn): signal to navigate to reader
    if (next === 5) {
      set({ currentStep: next, pendingNavigation: 'reader' })
    } else if (next >= 9) {
      // All 9 steps done
      saveCompleted()
      set({ isActive: false, hasCompleted: true })
    } else {
      set({ currentStep: next })
    }
  },

  skip: () => {
    saveCompleted()
    set({ isActive: false, hasCompleted: true, pendingNavigation: null })
  },

  clearNavigation: () => set({ pendingNavigation: null }),
}))
