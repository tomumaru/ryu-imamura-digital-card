(function () {
  "use strict";

  const stage = document.querySelector("#portrait-stage");
  const canvas = document.querySelector("#portrait-3d");
  if (!stage || !canvas) return;

  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: true,
    depth: true,
    premultipliedAlpha: false,
    powerPreference: "high-performance"
  });
  if (!gl) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarsePointer = window.matchMedia("(pointer: coarse)");
  const source = new Image();
  source.decoding = "async";
  source.src = "assets/profile-dotmatrix-v3.webp";

  let program;
  let pointCount = 0;
  let animationFrame = 0;
  let visible = true;
  let pointerActive = false;
  let rotationX = -0.025;
  let rotationY = -0.08;
  let targetX = rotationX;
  let targetY = rotationY;
  let scrollRotation = rotationY;
  let angleLocation;
  let aspectLocation;
  let scaleLocation;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function gaussian(x, y, centerX, centerY, radiusX, radiusY) {
    const dx = (x - centerX) / radiusX;
    const dy = (y - centerY) / radiusY;
    return Math.exp(-(dx * dx + dy * dy) * 2.2);
  }

  function seededRandom(seed) {
    let state = seed >>> 0;
    return function random() {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function compileShader(type, sourceCode) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, sourceCode);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || "shader compile failed");
    }
    return shader;
  }

  function createProgram() {
    const vertexShader = compileShader(gl.VERTEX_SHADER, `
      attribute vec3 a_position;
      attribute vec4 a_color;
      attribute float a_size;
      uniform vec2 u_angle;
      uniform float u_aspect;
      uniform float u_scale;
      varying vec4 v_color;
      void main() {
        float cx = cos(u_angle.x);
        float sx = sin(u_angle.x);
        float cy = cos(u_angle.y);
        float sy = sin(u_angle.y);
        vec3 p = a_position;
        p = vec3(p.x * cy - p.z * sy, p.y, p.x * sy + p.z * cy);
        p = vec3(p.x, p.y * cx - p.z * sx, p.y * sx + p.z * cx);
        float perspective = 1.98 / (2.25 - p.z);
        gl_Position = vec4(p.x * perspective / u_aspect, p.y * perspective, p.z * 0.08, 1.0);
        gl_PointSize = clamp(a_size * u_scale * perspective, 1.0, 5.4 * u_scale);
        v_color = a_color;
      }
    `);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      varying vec4 v_color;
      void main() {
        vec2 centered = gl_PointCoord - vec2(0.5);
        float distanceFromCenter = length(centered);
        if (distanceFromCenter > 0.5) discard;
        float edge = 1.0 - smoothstep(0.32, 0.5, distanceFromCenter);
        gl_FragColor = vec4(v_color.rgb, v_color.a * edge);
      }
    `);
    const nextProgram = gl.createProgram();
    gl.attachShader(nextProgram, vertexShader);
    gl.attachShader(nextProgram, fragmentShader);
    gl.linkProgram(nextProgram);
    if (!gl.getProgramParameter(nextProgram, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(nextProgram) || "program link failed");
    }
    return nextProgram;
  }

  function pushPoint(store, x, y, z, red, green, blue, alpha, size) {
    store.positions.push(x, y, z);
    store.colors.push(red, green, blue, alpha);
    store.sizes.push(size);
  }

  function createPointData() {
    const sampleWidth = coarsePointer.matches ? 176 : 224;
    const sampleHeight = Math.round(sampleWidth * source.naturalHeight / source.naturalWidth);
    const sample = document.createElement("canvas");
    sample.width = sampleWidth;
    sample.height = sampleHeight;
    const sampleContext = sample.getContext("2d", { willReadFrequently: true });
    sampleContext.drawImage(source, 0, 0, sampleWidth, sampleHeight);
    const pixels = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data;
    const store = { positions: [], colors: [], sizes: [] };
    const stride = 1;

    for (let y = 0; y < sampleHeight; y += stride) {
      for (let x = 0; x < sampleWidth; x += stride) {
        const u = x / (sampleWidth - 1);
        const v = y / (sampleHeight - 1);
        const headX = (u - 0.5) / 0.405;
        const headY = (v - 0.39) / 0.435;
        const inHead = headX * headX + headY * headY < 1;
        const bodyHalfWidth = clamp(0.23 + (v - 0.63) * 1.15, 0.23, 0.54);
        const inBody = v > 0.61 && Math.abs(u - 0.5) < bodyHalfWidth;
        if (!inHead && !inBody) continue;

        const offset = (y * sampleWidth + x) * 4;
        const red = pixels[offset];
        const green = pixels[offset + 1];
        const blue = pixels[offset + 2];
        const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
        const colorRange = Math.max(red, green, blue) - Math.min(red, green, blue);
        if (luminance > 246 && colorRange < 10) continue;

        const ink = 1 - luminance / 255;
        const px = (u - 0.5) * 1.34;
        const py = (0.51 - v) * 1.68;
        let pz;
        if (inHead) {
          const shell = Math.sqrt(Math.max(0, 1 - headX * headX - headY * headY));
          const nose = gaussian(u, v, 0.5, 0.455, 0.078, 0.19) * 0.19;
          const leftCheek = gaussian(u, v, 0.355, 0.49, 0.13, 0.16) * 0.055;
          const rightCheek = gaussian(u, v, 0.645, 0.49, 0.13, 0.16) * 0.055;
          const leftEye = gaussian(u, v, 0.37, 0.345, 0.11, 0.052) * 0.038;
          const rightEye = gaussian(u, v, 0.63, 0.345, 0.11, 0.052) * 0.038;
          const mouth = gaussian(u, v, 0.5, 0.57, 0.18, 0.055) * 0.028;
          pz = shell * 0.34 + nose + leftCheek + rightCheek - leftEye - rightEye - mouth;
        } else {
          const torsoX = (u - 0.5) / Math.max(0.01, bodyHalfWidth);
          pz = Math.sqrt(Math.max(0, 1 - torsoX * torsoX)) * 0.11 - 0.04;
        }

        const shadow = clamp(ink, 0, 1);
        const cobaltWeight = clamp((0.72 - shadow) * 1.35, 0, 1);
        const darkWeight = 1 - cobaltWeight;
        const outRed = (7 * darkWeight + 18 * cobaltWeight) / 255;
        const outGreen = (28 * darkWeight + 86 * cobaltWeight) / 255;
        const outBlue = (66 * darkWeight + 196 * cobaltWeight) / 255;
        const alpha = clamp(0.48 + shadow * 0.92, 0.5, 1);
        const size = 1.14 + shadow * 2.35;
        pushPoint(store, px, py, pz, outRed, outGreen, outBlue, alpha, size);
      }
    }

    const random = seededRandom(314159);
    const shellCount = coarsePointer.matches ? 2600 : 5200;
    for (let index = 0; index < shellCount; index += 1) {
      const theta = random() * Math.PI * 2;
      const vertical = Math.asin(random() * 2 - 1);
      const radiusNoise = 0.96 + random() * 0.07;
      const cosVertical = Math.cos(vertical);
      const x = Math.sin(theta) * cosVertical * 0.54 * radiusNoise;
      const y = Math.sin(vertical) * 0.72 * radiusNoise + 0.20;
      const z = Math.cos(theta) * cosVertical * 0.39 * radiusNoise - 0.005;
      if (z > 0.07 && Math.abs(x) < 0.49) continue;
      const isHair = y > 0.43 || (y > 0.25 && Math.abs(x) > 0.35);
      const shade = isHair ? 0.94 : 0.58 + random() * 0.22;
      pushPoint(store, x, y, z, 0.03, 0.11 + shade * 0.05, 0.25 + shade * 0.17, 0.28 + shade * 0.34, 0.78 + random() * 1.05);
    }

    const interiorCount = coarsePointer.matches ? 1800 : 3600;
    for (let index = 0; index < interiorCount; index += 1) {
      const theta = random() * Math.PI * 2;
      const vertical = Math.asin(random() * 2 - 1);
      const radius = Math.cbrt(random()) * 0.93;
      const cosVertical = Math.cos(vertical);
      pushPoint(
        store,
        Math.sin(theta) * cosVertical * 0.52 * radius,
        Math.sin(vertical) * 0.69 * radius + 0.20,
        Math.cos(theta) * cosVertical * 0.37 * radius,
        0.045,
        0.25,
        0.58,
        0.08 + random() * 0.14,
        0.58 + random() * 0.72
      );
    }

    const torsoCount = coarsePointer.matches ? 900 : 1800;
    for (let index = 0; index < torsoCount; index += 1) {
      const y = -0.43 - random() * 0.42;
      const widthAtY = 0.42 + (-y - 0.43) * 0.66;
      const x = (random() * 2 - 1) * widthAtY;
      const normalizedX = x / widthAtY;
      const depth = Math.sqrt(Math.max(0, 1 - normalizedX * normalizedX)) * 0.15;
      const z = -random() * depth - 0.045;
      pushPoint(store, x, y, z, 0.027, 0.10, 0.24, 0.22 + random() * 0.32, 0.8 + random() * 1.2);
    }
    return store;
  }

  function uploadAttribute(name, values, components) {
    const location = gl.getAttribLocation(program, name);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, components, gl.FLOAT, false, 0, 0);
  }

  function initialize() {
    try {
      program = createProgram();
      gl.useProgram(program);
      const data = createPointData();
      pointCount = data.sizes.length;
      uploadAttribute("a_position", data.positions, 3);
      uploadAttribute("a_color", data.colors, 4);
      uploadAttribute("a_size", data.sizes, 1);
      angleLocation = gl.getUniformLocation(program, "u_angle");
      aspectLocation = gl.getUniformLocation(program, "u_aspect");
      scaleLocation = gl.getUniformLocation(program, "u_scale");
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.clearColor(0.957, 0.941, 0.902, 1);
      resize();
      updateScrollRotation();
      stage.classList.add("is-3d-ready");
      startAnimation();
    } catch (_error) {
      stage.classList.remove("is-3d-ready");
    }
  }

  function resize() {
    const bounds = stage.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(bounds.width * ratio));
    const height = Math.max(1, Math.round(bounds.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    draw();
  }

  function draw() {
    if (!program || !pointCount) return;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniform2f(angleLocation, rotationX, rotationY);
    gl.uniform1f(aspectLocation, canvas.width / canvas.height);
    gl.uniform1f(scaleLocation, Math.min(window.devicePixelRatio || 1, 2));
    gl.drawArrays(gl.POINTS, 0, pointCount);
  }

  function animate() {
    animationFrame = 0;
    const ease = reducedMotion.matches ? 1 : 0.075;
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
    scrollRotation = -0.18 + progress * 0.36;
    targetY = scrollRotation;
  }

  function updatePointer(event) {
    const bounds = stage.getBoundingClientRect();
    const x = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
    const y = clamp((event.clientY - bounds.top) / bounds.height, 0, 1);
    targetY = (x - 0.5) * 0.88;
    targetX = (0.5 - y) * 0.20;
  }

  stage.addEventListener("pointerdown", (event) => {
    pointerActive = true;
    stage.setPointerCapture(event.pointerId);
    stage.classList.add("is-dragging");
    updatePointer(event);
  });
  stage.addEventListener("pointermove", (event) => {
    if (pointerActive || event.pointerType === "mouse") updatePointer(event);
  });
  stage.addEventListener("pointerup", (event) => {
    pointerActive = false;
    if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    stage.classList.remove("is-dragging");
    targetX = -0.025;
    targetY = scrollRotation;
  });
  stage.addEventListener("pointercancel", () => {
    pointerActive = false;
    stage.classList.remove("is-dragging");
    targetX = -0.025;
    targetY = scrollRotation;
  });
  stage.addEventListener("pointerleave", () => {
    if (!pointerActive) {
      targetX = -0.025;
      targetY = scrollRotation;
    }
  });

  window.addEventListener("scroll", updateScrollRotation, { passive: true });
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(stage);
  else window.addEventListener("resize", resize);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) startAnimation();
      else if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
    }, { rootMargin: "120px" }).observe(stage);
  }

  if (source.complete && source.naturalWidth) initialize();
  else source.addEventListener("load", initialize, { once: true });
})();

