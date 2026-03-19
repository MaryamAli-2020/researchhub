export async function pixelateImage(dataUrl, pixelSize = 28, outputSize = 224) {
  const image = await loadImage(dataUrl);
  const smallCanvas = document.createElement("canvas");
  const smallContext = smallCanvas.getContext("2d");
  const outputCanvas = document.createElement("canvas");
  const outputContext = outputCanvas.getContext("2d");

  smallCanvas.width = pixelSize;
  smallCanvas.height = pixelSize;
  outputCanvas.width = outputSize;
  outputCanvas.height = outputSize;

  smallContext.imageSmoothingEnabled = false;
  outputContext.imageSmoothingEnabled = false;

  const crop = Math.min(image.width, image.height);
  const cropX = (image.width - crop) / 2;
  const cropY = (image.height - crop) / 2;

  smallContext.drawImage(image, cropX, cropY, crop, crop, 0, 0, pixelSize, pixelSize);
  outputContext.drawImage(smallCanvas, 0, 0, pixelSize, pixelSize, 0, 0, outputSize, outputSize);

  return outputCanvas.toDataURL("image/png");
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export function playReminderSound(volume = 0.04) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const context = new AudioCtx();
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(540, now);
    oscillator.frequency.exponentialRampToValueAtTime(760, now + 0.11);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.22);

    oscillator.onended = () => {
      context.close().catch(() => {});
    };
  } catch {
    // Ignore devices where audio context creation is blocked.
  }
}
