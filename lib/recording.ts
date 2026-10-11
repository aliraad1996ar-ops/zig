export const MAX_RECORDING_SECONDS = 12;
export function prepareAudio(channels: Float32Array[], sampleRate: number) {
  const length = Math.min(channels[0]?.length ?? 0, Math.floor(sampleRate * MAX_RECORDING_SECONDS));
  if (length < sampleRate * .25) throw new Error('التسجيل فارغ أو قصير. جرّب مرة ثانية.');
  const mono = new Float32Array(length);
  let peak = 0;
  for (let i = 0; i < length; i++) {
    for (const channel of channels) mono[i] += channel[i] / channels.length;
    peak = Math.max(peak, Math.abs(mono[i]));
  }
  if (peak < .0001) throw new Error('ما وصل صوت من المايك. تأكد من اختيار المايك الصحيح وأنه مو مكتوم، وبعدين أعد التسجيل.');
  const pcm = new Int16Array(Math.floor(length * 16000 / sampleRate));
  for (let i = 0; i < pcm.length; i++) pcm[i] = Math.round(Math.max(-1, Math.min(1, mono[Math.floor(i * sampleRate / 16000)])) * 32767);
  // Raise quiet playback only. The score always receives the original signal.
  const gain = Math.min(12, .9 / peak);
  const wav = new ArrayBuffer(44 + pcm.length * 2), view = new DataView(wav);
  function text(at: number, value: string) { for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i)); }
  text(0, 'RIFF'); view.setUint32(4, 36 + pcm.length * 2, true); text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true); view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, pcm[i] / 32768 * gain)) * 32767), true);
  return { pcm, wav };
}
