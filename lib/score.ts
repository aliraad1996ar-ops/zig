const MAX_SCORE = 1_000_000;

export function calculateScore(samples: Int16Array) {
  if (!isZeegLike(samples)) return 0;
  let strongest = 0;
  for (let start = 0; start + 1600 <= samples.length; start += 800) {
    let sum = 0;
    for (let i = start; i < start + 1600; i++) sum += (samples[i] / 32768) ** 2;
    strongest = Math.max(strongest, Math.sqrt(sum / 1600));
  }
  const dbfs = 20 * Math.log10(Math.max(strongest, 1e-8));
  const loudness = Math.max(0, Math.min(1, (dbfs + 60) / 60));
  return Math.round(MAX_SCORE * loudness ** 3);
}

/**
 * A zeeg is normally a short, noisy burst. Speech has a sustained voiced
 * waveform (a strong pitch correlation), so reject it before loudness is
 * turned into points. This is intentionally conservative: uncertain audio
 * earns zero instead of filling the board with talking.
 */
export function isZeegLike(samples: Int16Array) {
  const frameSize = 400; // 25 ms at the 16 kHz recording rate
  const active: {start: number; rms: number}[] = [];
  let loudestStart = 0, loudestRms = 0;

  for (let start = 0; start + frameSize <= samples.length; start += frameSize) {
    let sum = 0;
    for (let i = start; i < start + frameSize; i++) {
      const value = samples[i] / 32768;
      sum += value * value;
    }
    const rms = Math.sqrt(sum / frameSize);
    if (rms > 0.025) active.push({start, rms});
    if (rms > loudestRms) { loudestRms = rms; loudestStart = start; }
  }

  // Silence, clicks, and long sentences do not qualify.
  if (active.length < 2 || loudestRms < 0.035) return false;
  const activeDuration = active.length * 0.025;
  if (activeDuration > 1.25) return false;

  // A voiced syllable has a stable repeating period between 80–320 Hz.
  // A zeeg/noise burst does not. Check the loudest 25 ms window.
  let energy = 0;
  for (let i = loudestStart; i < loudestStart + frameSize; i++) {
    const value = samples[i] / 32768;
    energy += value * value;
  }
  let strongestPitch = 0;
  for (let lag = 50; lag <= 200; lag += 3) {
    let dot = 0, left = 0, right = 0;
    for (let i = loudestStart + lag; i < loudestStart + frameSize; i++) {
      const a = samples[i] / 32768, b = samples[i - lag] / 32768;
      dot += a * b; left += a * a; right += b * b;
    }
    strongestPitch = Math.max(strongestPitch, dot / Math.sqrt(Math.max(left * right, 1e-9)));
  }
  if (strongestPitch > 0.52) return false;

  let crossings = 0;
  for (let i = loudestStart + 1; i < loudestStart + frameSize; i++) {
    if ((samples[i] >= 0) !== (samples[i - 1] >= 0)) crossings++;
  }
  const crossingRate = crossings / (frameSize - 1);
  return crossingRate > 0.035 && crossingRate < 0.65;
}
