(() => {
  "use strict";

  const stage = document.querySelector("#portrait-stage");
  const canvas = document.querySelector("#portrait-points");
  const image = stage?.querySelector(".portrait");
  if (!stage || !canvas || !image) return;

  const context = canvas.getContext("2d", { alpha: true });
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarsePointer = window.matchMedia("(pointer: coarse)");
  const glyphs = ["0", "1", "I", "C", "T", "+"];
  const particles = [];
  const pointer = { x: -9999, y: -9999, active: false };
  let cssWidth = 0;
  let cssHeight = 0;
  let pixelRatio = 1;
  let visible = true;
  let frame = 0;
  let lastTime = 0;
  let scrollInfluence = 0;

  function seeded(index) {
    const value = Math.sin(index * 91.731 + 0.73) * 43758.5453;
    return value - Math.floor(value);
  }

  function coverRect(sourceWidth, sourceHeight, targetWidth, targetHeight) {
    const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    return { x: (targetWidth - width) / 2, y: (targetHeight - height) / 2, width, height };
  }

  function rebuild() {
    const bounds = stage.getBoundingClientRect();
    cssWidth = Math.max(1, Math.round(bounds.width));
    cssHeight = Math.max(1, Math.round(bounds.height));
    pixelRatio = Math.min(window.devicePixelRatio || 1, coarsePointer.matches ? 1.5 : 2);
    canvas.width = Math.round(cssWidth * pixelRatio);
    canvas.height = Math.round(cssHeight * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const sample = document.createElement("canvas");
    const sampleContext = sample.getContext("2d", { willReadFrequently: true });
    const detail = coarsePointer.matches ? 4.2 : 3.45;
    sample.width = Math.max(1, Math.round(cssWidth / detail));
    sample.height = Math.max(1, Math.round(cssHeight / detail));
    const fit = coverRect(image.naturalWidth, image.naturalHeight, sample.width, sample.height);
    sampleContext.drawImage(image, fit.x, fit.y, fit.width, fit.height);
    const pixels = sampleContext.getImageData(0, 0, sample.width, sample.height).data;

    particles.length = 0;
    let index = 0;
    for (let y = 0; y < sample.height; y += 1) {
      for (let x = 0; x < sample.width; x += 1) {
        const offset = (y * sample.width + x) * 4;
        const r = pixels[offset];
        const g = pixels[offset + 1];
        const b = pixels[offset + 2];
        const ink = Math.max(0, Math.min(1, (242 - (r * 0.28 + g * 0.54 + b * 0.18)) / 178));
        if (ink < 0.12 || seeded(index) > 0.36 + ink * 0.72) {
          index += 1;
          continue;
        }
        const baseX = (x + 0.5) * cssWidth / sample.width;
        const baseY = (y + 0.5) * cssHeight / sample.height;
        particles.push({
          baseX,
          baseY,
          x: baseX,
          y: baseY,
          vx: 0,
          vy: 0,
          ink,
          seed: seeded(index + 17),
          glyph: glyphs[Math.floor(seeded(index + 41) * glyphs.length)]
        });
        index += 1;
      }
    }
    stage.classList.add("is-points-ready");
    draw(performance.now(), true);
  }

  function updateScrollInfluence() {
    if (reducedMotion.matches) {
      scrollInfluence = 0;
      return;
    }
    const rect = stage.getBoundingClientRect();
    const travel = Math.max(1, window.innerHeight + rect.height);
    const progress = Math.max(0, Math.min(1, (window.innerHeight - rect.top) / travel));
    scrollInfluence = Math.sin(progress * Math.PI) * 5.5;
  }

  function draw(time, force = false) {
    if (!visible && !force) {
      frame = 0;
      return;
    }
    const elapsed = Math.min(2, (time - lastTime) / 16.67 || 1);
    lastTime = time;
    context.clearRect(0, 0, cssWidth, cssHeight);
    context.textAlign = "center";
    context.textBaseline = "middle";

    const interactionRadius = coarsePointer.matches ? 44 : 62;
    const radiusSquared = interactionRadius * interactionRadius;
    const motionAllowed = !reducedMotion.matches;
    let moving = false;

    for (let index = 0; index < particles.length; index += 1) {
      const particle = particles[index];
      const band = Math.sin((particle.baseY / Math.max(1, cssHeight)) * Math.PI * 8 + particle.seed * 2.4);
      const targetX = particle.baseX + (motionAllowed ? band * scrollInfluence * (0.32 + particle.ink * 0.68) : 0);
      const targetY = particle.baseY;

      if (pointer.active && motionAllowed) {
        const dx = particle.x - pointer.x;
        const dy = particle.y - pointer.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < radiusSquared && distanceSquared > 0.01) {
          const distance = Math.sqrt(distanceSquared);
          const pressure = (1 - distance / interactionRadius) * 0.72;
          particle.vx += dx / distance * pressure * elapsed;
          particle.vy += dy / distance * pressure * elapsed;
        }
      }

      particle.vx += (targetX - particle.x) * 0.075 * elapsed;
      particle.vy += (targetY - particle.y) * 0.075 * elapsed;
      particle.vx *= Math.pow(0.79, elapsed);
      particle.vy *= Math.pow(0.79, elapsed);
      particle.x += particle.vx * elapsed;
      particle.y += particle.vy * elapsed;
      moving ||= Math.abs(particle.vx) + Math.abs(particle.vy) > 0.025 || Math.abs(targetX - particle.x) > 0.12;

      const isScanAccent = particle.seed > 0.986 && particle.ink < 0.66;
      const isGlyph = particle.ink > 0.46 && particle.seed > 0.94;
      const alpha = Math.min(0.96, 0.28 + particle.ink * 0.76);

      context.fillStyle = isScanAccent
        ? `rgba(30, 185, 205, ${alpha})`
        : `rgba(7, 40, 94, ${alpha})`;
      if (isGlyph) {
        const fontSize = 2.8 + particle.ink * 2.5;
        context.font = `700 ${fontSize}px ui-monospace, SFMono-Regular, Consolas, monospace`;
        context.fillText(particle.glyph, particle.x, particle.y);
      } else {
        const size = 0.45 + particle.ink * 1.28;
        context.beginPath();
        context.arc(particle.x, particle.y, size, 0, Math.PI * 2);
        context.fill();
      }
    }

    if (moving || pointer.active) {
      frame = requestAnimationFrame(draw);
    } else {
      frame = 0;
    }
  }

  function ensureFrame() {
    if (!frame && visible) frame = requestAnimationFrame(draw);
  }

  function setPointer(event) {
    const bounds = stage.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
    pointer.active = true;
    stage.classList.add("is-dragging");
    ensureFrame();
  }

  stage.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") stage.setPointerCapture?.(event.pointerId);
    setPointer(event);
  });
  stage.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse" || pointer.active) setPointer(event);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
    stage.addEventListener(eventName, () => {
      pointer.active = false;
      stage.classList.remove("is-dragging");
      ensureFrame();
    });
  });

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) ensureFrame();
  }, { rootMargin: "120px" });
  observer.observe(stage);

  const resizeObserver = new ResizeObserver(() => {
    window.clearTimeout(rebuild.resizeTimer);
    rebuild.resizeTimer = window.setTimeout(rebuild, 120);
  });
  resizeObserver.observe(stage);

  window.addEventListener("scroll", () => {
    updateScrollInfluence();
    ensureFrame();
  }, { passive: true });
  reducedMotion.addEventListener?.("change", () => {
    updateScrollInfluence();
    ensureFrame();
  });

  function initialize() {
    rebuild();
    updateScrollInfluence();
    ensureFrame();
  }

  if (image.complete && image.naturalWidth) initialize();
  else image.addEventListener("load", initialize, { once: true });
})();

