(function () {
  "use strict";

  const config = window.SITE_CONFIG;
  if (!config) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function setText(selector, value) {
    $$(selector).forEach((element) => {
      element.textContent = value;
    });
  }

  function setHref(selector, value) {
    $$(selector).forEach((element) => {
      element.href = value;
    });
  }

  function digits(value) {
    return value.replace(/[^0-9+]/g, "");
  }

  function internationalizeJapanesePhone(value) {
    const clean = digits(value);
    return clean.startsWith("0") ? `+81${clean.slice(1)}` : clean;
  }

  function hydratePage() {
    const { person, company, contact, social } = config;

    setText("[data-name-ja]", person.nameJa);
    setText("[data-name-en]", person.nameEn);
    setText("[data-title-ja]", person.titleJa);
    setText("[data-title-en]", person.titleEn);
    setText("[data-profession-ja]", person.professionJa);
    setText("[data-profession-en]", person.professionEn);
    setText("[data-expertise-ja]", person.expertiseJa);
    setText("[data-company-ja]", company.nameJa);
    setText("[data-company-en]", company.nameEn);
    setText("[data-email]", contact.email);
    setText("[data-mobile]", contact.mobile);
    setText("[data-telephone]", contact.telephone);
    setText("[data-fax]", contact.fax);
    setText("[data-postal]", contact.postalCode);
    setText("[data-address]", contact.address);

    const tagline = $("[data-tagline]");
    if (tagline) {
      const parts = person.tagline.split("、");
      tagline.textContent = "";
      tagline.append(document.createTextNode(parts[0]));
      if (parts.length > 1) {
        tagline.append(document.createTextNode("、"));
        const br = document.createElement("br");
        br.className = "mobile-break";
        tagline.append(br, document.createTextNode(parts.slice(1).join("、")));
      }
    }

    const profile = $("[data-profile-image]");
    if (profile) {
      profile.src = person.profileImage;
      profile.alt = person.profileAlt || `${person.nameJa}のプロフィール画像`;
    }

    const logo = $("[data-company-logo]");
    if (logo) logo.src = company.logo;

    setHref("[data-company-link]", company.website);
    setHref("[data-email-link]", `mailto:${contact.email}`);
    setHref("[data-mobile-link]", `tel:${internationalizeJapanesePhone(contact.mobile)}`);
    setHref("[data-tel-link]", `tel:${internationalizeJapanesePhone(contact.telephone)}`);
    setHref("[data-linkedin-link]", social.linkedin);
    setHref("[data-map-link]", contact.mapUrl);

    $("#year").textContent = new Date().getFullYear();
  }

  let toastTimer;
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
  }

  function currentPublicUrl() {
    return config.publicUrl || window.location.href.split("#")[0];
  }

  async function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    if (!copied) throw new Error("copy failed");
  }

  async function shareCard() {
    const shareData = {
      title: `${config.person.nameJa} | ${config.person.nameEn}`,
      text: `${config.company.nameJa} ${config.person.titleJa} ${config.person.nameJa}`,
      url: currentPublicUrl()
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error && error.name === "AbortError") return;
      }
    }

    try {
      await copyText(shareData.url);
      showToast("名刺のリンクをコピーしました");
    } catch (_error) {
      window.prompt("このリンクをコピーしてください", shareData.url);
    }
  }

  function roundedRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = source;
    });
  }

  async function renderQrCode() {
    const target = $("#qr-code");
    if (!target || target.dataset.ready === currentPublicUrl()) return;

    if (typeof window.qrcode !== "function") {
      target.textContent = "QRコードを表示できませんでした";
      return;
    }

    const qr = window.qrcode(0, "H");
    qr.addData(currentPublicUrl());
    qr.make();

    const count = qr.getModuleCount();
    const margin = 4;
    const canvasSize = count + margin * 2;
    const center = count / 2;
    const clearSize = Math.min(9, Math.floor(count * 0.22) | 1);
    const clearStart = Math.floor(center - clearSize / 2);
    const clearEnd = clearStart + clearSize;
    const finderOrigins = [[0, 0], [0, count - 7], [count - 7, 0]];
    const inFinder = (row, column) => finderOrigins.some(([fy, fx]) =>
      row >= fy && row < fy + 7 && column >= fx && column < fx + 7
    );

    const scale = 16;
    const canvas = document.createElement("canvas");
    canvas.width = canvasSize * scale;
    canvas.height = canvasSize * scale;
    const context = canvas.getContext("2d");
    context.fillStyle = "#fffdf8";
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < count; row += 1) {
      for (let column = 0; column < count; column += 1) {
        if (!qr.isDark(row, column) || inFinder(row, column)) continue;
        if (row >= clearStart && row < clearEnd && column >= clearStart && column < clearEnd) continue;
        const x = (margin + column + 0.08) * scale;
        const y = (margin + row + 0.08) * scale;
        const size = 0.84 * scale;
        context.fillStyle = (row + column) % 9 < 2 ? "#1256c4" : "#071c42";
        roundedRect(context, x, y, size, size, 0.26 * scale);
        context.fill();
      }
    }

    finderOrigins.forEach(([row, column]) => {
      const x = (margin + column) * scale;
      const y = (margin + row) * scale;
      context.fillStyle = "#1256c4";
      roundedRect(context, x, y, 7 * scale, 7 * scale, 1.25 * scale);
      context.fill();
      context.fillStyle = "#fffdf8";
      roundedRect(context, x + scale, y + scale, 5 * scale, 5 * scale, 0.9 * scale);
      context.fill();
      context.fillStyle = "#071c42";
      roundedRect(context, x + 2 * scale, y + 2 * scale, 3 * scale, 3 * scale, 0.72 * scale);
      context.fill();
    });

    const logoX = (margin + clearStart) * scale;
    const logoY = (margin + clearStart) * scale;
    const logoSize = clearSize * scale;
    context.fillStyle = "#fff";
    context.strokeStyle = "#1256c4";
    context.lineWidth = 0.24 * scale;
    roundedRect(context, logoX, logoY, logoSize, logoSize, 1.6 * scale);
    context.fill();
    context.stroke();

    try {
      const logo = await loadImage(config.company.logo);
      const inset = 1.15 * scale;
      const available = logoSize - inset * 2;
      const ratio = Math.min(available / logo.naturalWidth, available / logo.naturalHeight);
      const width = logo.naturalWidth * ratio;
      const height = logo.naturalHeight * ratio;
      context.drawImage(logo, logoX + (logoSize - width) / 2, logoY + (logoSize - height) / 2, width, height);
    } catch (_error) {
      // The QR remains usable and saveable even if the decorative logo cannot load.
    }

    const image = document.createElement("img");
    image.src = canvas.toDataURL("image/png");
    image.alt = "このデジタル名刺を開くQRコード";
    image.width = canvas.width;
    image.height = canvas.height;
    target.replaceChildren(image);
    target.dataset.ready = currentPublicUrl();
  }

  function openQrDialog() {
    const dialog = $("#qr-dialog");
    renderQrCode();
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function closeQrDialog() {
    const dialog = $("#qr-dialog");
    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  }

  function initializeMotionExperience() {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const revealTargets = [
      $(".identity-head"),
      $(".expertise"),
      $(".tagline-slot"),
      $(".contact-section .section-heading"),
      $(".office-section .section-heading"),
      ...$$(".primary-actions .action"),
      ...$$(".contact-item"),
      ...$$(".office-list > div")
    ].filter(Boolean);

    revealTargets.forEach((element, index) => {
      element.classList.add("motion-reveal");
      const group = element.closest(".primary-actions, .contact-grid, .office-list");
      if (group) {
        const siblings = [...group.querySelectorAll(":scope > .action, :scope > .contact-item, :scope > div")];
        const order = Math.max(0, siblings.indexOf(element));
        element.style.setProperty("--reveal-delay", `${Math.min(order * 95, 285)}ms`);
      } else {
        element.style.setProperty("--reveal-delay", `${Math.min(index * 20, 80)}ms`);
      }
    });
    if (reducedMotion.matches || !("IntersectionObserver" in window)) {
      revealTargets.forEach((element) => element.classList.add("is-revealed"));
    } else {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -15%" });
      revealTargets.forEach((element) => observer.observe(element));
    }

    $$(".contact-item, .office-list a").forEach((element) => {
      element.addEventListener("pointerdown", (event) => {
        element.classList.remove("is-activated");
        const bounds = element.getBoundingClientRect();
        element.style.setProperty("--pulse-x", `${event.clientX - bounds.left}px`);
        element.style.setProperty("--pulse-y", `${event.clientY - bounds.top}px`);
        requestAnimationFrame(() => element.classList.add("is-activated"));
        window.setTimeout(() => element.classList.remove("is-activated"), 620);
      });
    });

    const interactionDisplay = $("#interaction-display");
    const interactionLabel = $("#interaction-label");
    const interactionValue = $("#interaction-value");
    let interactionTimer;
    function showInteraction(label, value) {
      if (!interactionDisplay) return;
      interactionLabel.textContent = label;
      interactionValue.textContent = value;
      interactionDisplay.classList.remove("is-visible");
      requestAnimationFrame(() => interactionDisplay.classList.add("is-visible"));
      window.clearTimeout(interactionTimer);
      interactionTimer = window.setTimeout(() => interactionDisplay.classList.remove("is-visible"), 720);
    }

    [
      { selector: "[data-mobile-link]", label: "MOBILE", value: config.contact.mobile },
      { selector: "[data-tel-link]", label: "OFFICE TEL", value: config.contact.telephone },
      { selector: "[data-email-link]", label: "EMAIL", value: config.contact.email }
    ].forEach(({ selector, label, value }) => {
      $$(selector).forEach((element) => {
        element.addEventListener("pointerdown", () => showInteraction(label, value));
      });
    });

    const card = $(".card");
    const name = $(".name");
    let ticking = false;
    function updateScrollStory() {
      if (reducedMotion.matches) return;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, window.scrollY / max));
      card.style.setProperty("--scroll-progress", progress.toFixed(4));
      if (name) name.style.setProperty("--name-shift", `${(progress - 0.18) * 22}px`);
      ticking = false;
    }
    window.addEventListener("scroll", () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateScrollStory);
      }
    }, { passive: true });
    updateScrollStory();
  }

  hydratePage();
  initializeMotionExperience();

  $("#share-button").addEventListener("click", shareCard);
  $("#qr-button").addEventListener("click", openQrDialog);
  $("#qr-close").addEventListener("click", closeQrDialog);
  $("#copy-link-button").addEventListener("click", async () => {
    try {
      await copyText(currentPublicUrl());
      showToast("リンクをコピーしました");
    } catch (_error) {
      window.prompt("このリンクをコピーしてください", currentPublicUrl());
    }
  });

  $("#qr-dialog").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeQrDialog();
  });
})();


