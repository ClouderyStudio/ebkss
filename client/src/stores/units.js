import { defineStore } from 'pinia';
import { api } from '../api.js';

export const useUnitsStore = defineStore('units', {
  state: () => ({
    units: [],
    loading: false,
    error: ''
  }),
  getters: {
    firstUnit: (state) => state.units[0] || null,
    allGrammarPoints: (state) => state.units.flatMap((unit) => unit.grammarPoints || [])
  },
  actions: {
    async loadUnits() {
      if (this.units.length > 0) {
        return;
      }

      this.loading = true;
      this.error = '';
      try {
        const data = await api.units();
        this.units = data.units || [];
      } catch (error) {
        this.error = error.message;
      } finally {
        this.loading = false;
      }
    }
  }
});

