(function () {
  "use strict";

  const stage = document.querySelector("#portrait-stage");
  const canvas = document.querySelector("#portrait-3d");
  const image = stage && stage.querySelector("img");
  if (!stage || !canvas || !image) return;

  const context = canvas.getContext("2d", { alpha: false });
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarsePointer = window.matchMedia("(pointer: coarse)");
  let points = [];
  let width = 0;
  let height = 0;
  let ratio = 1;
  let visible = true;
  let animationFrame = 0;
  let pointerActive = false;
  let pointerX = 0;
  let pointerY = 0;
  let rotationX = -0.035;
  let rotationY = -0.12;
  let targetX = rotationX;
  let targetY = rotationY;
  let scrollRotation = -0.12;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function createPointCloud() {
    const sample = document.createElement("canvas");
    const sampleWidth = coarsePointer.matches ? 94 : 122;
    const sampleHeight = Math.round(sampleWidth * image.naturalHeight / image.naturalWidth);
    sample.width = sampleWidth;
    sample.height = sampleHeight;
    const sampleContext = sample.getContext("2d", { willReadFrequently: true });
    sampleContext.drawImage(image, 0, 0, sampleWidth, sampleHeight);
    const pixels = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data;
    const next = [];
    const stride = coarsePointer.matches ? 2 : 2;

    for (let y = 0; y < sampleHeight; y += stride) {
      for (let x = 0; x < sampleWidth; x += stride) {
        const offset = (y * sampleWidth + x) * 4;
        const red = pixels[offset];
        const green = pixels[offset + 1];
        const blue = pixels[offset + 2];
        const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
        const ink = 1 - luminance / 255;
        if (ink < 0.09) continue;

        const normalizedX = x / sampleWidth - 0.5;
        const normalizedY = y / sampleHeight - 0.5;
        const oval = Math.max(0, 1 - Math.pow(normalizedX * 1.72, 2) - Math.pow((normalizedY + 0.04) * 1.25, 2));
        const depth = Math.sqrt(oval) * 0.19 + ink * 0.085 + ((x * 13 + y * 7) % 11) * 0.0009;
        next.push({
          x: normalizedX,
          y: normalizedY * (sampleHeight / sampleWidth),
          z: depth,
          color: ink > 0.62 ? "#071c42" : blue > red * 1.08 ? "#1256c4" : "#526785",
          alpha: clamp(0.35 + ink * 0.9, 0.38, 1),
          size: ink > 0.55 ? 1.2 : 0.82
        });
      }
    }
    points = next;
    stage.classList.add("is-3d-ready");
  }

  function resize() {
    const bounds = stage.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }

  function draw() {
    if (!points.length || !width || !height) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#f8f5ee");
    gradient.addColorStop(0.62, "#ece7dd");
    gradient.addColorStop(1, "#dfe8f5");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    const cosY = Math.cos(rotationY);
    const sinY = Math.sin(rotationY);
    const cosX = Math.cos(rotationX);
    const sinX = Math.sin(rotationX);
    const scale = width * 0.91;
    const projected = points.map((point) => {
      const x1 = point.x * cosY - point.z * sinY;
      const z1 = point.x * sinY + point.z * cosY;
      const y1 = point.y * cosX - z1 * sinX;
      const z2 = point.y * sinX + z1 * cosX;
      const perspective = 1 / (1.22 - z2);
      return {
        x: width * 0.5 + x1 * scale * perspective,
        y: height * 0.52 + y1 * scale * perspective,
        z: z2,
        color: point.color,
        alpha: point.alpha,
        radius: point.size * perspective * (width < 380 ? 0.82 : 1)
      };
    }).sort((a, b) => a.z - b.z);

    for (const point of projected) {
      context.globalAlpha = point.alpha;
      context.fillStyle = point.color;
      context.beginPath();
      context.arc(point.x, point.y, Math.max(0.45, point.radius), 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;

    const shine = context.createLinearGradient(width * 0.15, 0, width * 0.85, 0);
    shine.addColorStop(0, "rgba(18, 86, 196, 0)");
    shine.addColorStop(0.5 + rotationY * 0.35, "rgba(255, 255, 255, 0.14)");
    shine.addColorStop(1, "rgba(18, 86, 196, 0)");
    context.fillStyle = shine;
    context.fillRect(0, 0, width, height);
  }

  function animate() {
    animationFrame = 0;
    const ease = reducedMotion.matches ? 1 : 0.085;
    rotationX += (targetX - rotationX) * ease;
    rotationY += (targetY - rotationY) * ease;
    draw();
    if (visible && !reducedMotion.matches) animationFrame = requestAnimationFrame(animate);
  }

  function startAnimation() {
    if (!animationFrame && visible) animationFrame = requestAnimationFrame(animate);
  }

  function updateScrollRotation() {
    if (pointerActive || reducedMotion.matches) return;
    const bounds = stage.getBoundingClientRect();
    const progress = clamp((window.innerHeight * 0.5 - bounds.top) / (window.innerHeight + bounds.height), 0, 1);
    scrollRotation = -0.32 + progress * 0.64;
    targetY = scrollRotation;
  }

  function updatePointer(event) {
    const bounds = stage.getBoundingClientRect();
    const x = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
    const y = clamp((event.clientY - bounds.top) / bounds.height, 0, 1);
    targetY = (x - 0.5) * 0.82;
    targetX = (0.5 - y) * 0.26;
  }

  stage.addEventListener("pointerdown", (event) => {
    pointerActive = true;
    pointerX = event.clientX;
    pointerY = event.clientY;
    stage.setPointerCapture(event.pointerId);
    stage.classList.add("is-dragging");
    updatePointer(event);
  });
  stage.addEventListener("pointermove", (event) => {
    if (pointerActive || event.pointerType === "mouse") updatePointer(event);
  });
  stage.addEventListener("pointerup", (event) => {
    pointerActive = false;
    stage.releasePointerCapture(event.pointerId);
    stage.classList.remove("is-dragging");
    targetX = -0.035;
    targetY = scrollRotation;
  });
  stage.addEventListener("pointercancel", () => {
    pointerActive = false;
    stage.classList.remove("is-dragging");
    targetX = -0.035;
    targetY = scrollRotation;
  });
  stage.addEventListener("pointerleave", () => {
    if (!pointerActive) {
      targetX = -0.035;
      targetY = scrollRotation;
    }
  });

  window.addEventListener("scroll", updateScrollRotation, { passive: true });
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) startAnimation();
    else if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
  }, { rootMargin: "120px" }).observe(stage);

  function initialize() {
    try {
      createPointCloud();
      resize();
      updateScrollRotation();
      startAnimation();
    } catch (_error) {
      stage.classList.remove("is-3d-ready");
    }
  }

  if (image.complete && image.naturalWidth) initialize();
  else image.addEventListener("load", initialize, { once: true });
})();

