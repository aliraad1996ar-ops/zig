const MAX_SCORE = 1_000_000;

export function calculateScore(samples: Int16Array) {
  const profile = zeegProfile(samples);
  if (!profile) return 0;
  let strongest = 0;
  for (let start = 0; start + 1600 <= samples.length; start += 800) {
    let sum = 0;
    for (let i = start; i < start + 1600; i++) sum += (samples[i] / 32768) ** 2;
    strongest = Math.max(strongest, Math.sqrt(sum / 1600));
  }
  const dbfs = 20 * Math.log10(Math.max(strongest, 1e-8));
  const loudness = Math.max(0, Math.min(1, (dbfs + 60) / 60));
  // Strength is the larger influence, while a sustained zeeg earns a bonus.
  const durationBonus = Math.min(1, Math.max(.12, profile.activeDuration / 2.5));
  return Math.round(MAX_SCORE * loudness ** 2.4 * durationBonus);
}

/**
 * Treat only near-silent recordings as invalid. Microphones and real zeeg
 * sounds vary too much for a narrow pitch/noise filter to be fair.
 */
export function isZeegLike(samples: Int16Array) {
  return Boolean(zeegProfile(samples));
}

function zeegProfile(samples: Int16Array): {activeDuration:number}|null {
  const frameSize = 400; // 25 ms at the 16 kHz recording rate
  const frames: {rms: number}[] = [];
  let loudestRms = 0;

  for (let start = 0; start + frameSize <= samples.length; start += frameSize) {
    let sum = 0;
    for (let i = start; i < start + frameSize; i++) {
      const value = samples[i] / 32768;
      sum += value * value;
    }
    const rms = Math.sqrt(sum / frameSize);
    frames.push({rms});
    loudestRms = Math.max(loudestRms, rms);
  }

  if (loudestRms < 0.006) return null;
  const activeThreshold = Math.max(0.004, loudestRms * .1);
  const active = frames.filter(frame => frame.rms >= activeThreshold);
  if (!active.length) return null;
  const activeDuration = active.length * 0.025;
  return {activeDuration};
}
