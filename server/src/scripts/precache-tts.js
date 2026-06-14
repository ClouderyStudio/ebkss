import { classroomCorpus } from '../data/classroomSeedData.js';
import { getOrCreateSpeech } from '../services/ttsService.js';

const speeds = [0.7, 0.9];

async function precache() {
  for (const item of classroomCorpus) {
    for (const speed of speeds) {
      const result = await getOrCreateSpeech({ text: item.english, speed });
      console.log(`${result.cached ? 'cached' : 'created'} ${result.url}`);
    }
  }
}

precache().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

