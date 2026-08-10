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
    setHref(
      "[data-map-link]",
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`
    );

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

  function renderQrCode() {
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

    const modules = [];
    for (let row = 0; row < count; row += 1) {
      for (let column = 0; column < count; column += 1) {
        if (!qr.isDark(row, column) || inFinder(row, column)) continue;
        if (row >= clearStart && row < clearEnd && column >= clearStart && column < clearEnd) continue;
        const fill = (row + column) % 9 < 2 ? "#1256c4" : "#071c42";
        modules.push(`<rect x="${margin + column + 0.08}" y="${margin + row + 0.08}" width="0.84" height="0.84" rx="0.26" fill="${fill}"/>`);
      }
    }

    const finders = finderOrigins.map(([row, column]) => {
      const x = margin + column;
      const y = margin + row;
      return `<g><rect x="${x}" y="${y}" width="7" height="7" rx="1.25" fill="#1256c4"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" rx="0.9" fill="#fffdf8"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.72" fill="#071c42"/></g>`;
    }).join("");

    const logoX = margin + clearStart;
    const logoY = margin + clearStart;
    target.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasSize} ${canvasSize}" role="img" aria-label="このデジタル名刺を開くQRコード"><rect width="${canvasSize}" height="${canvasSize}" rx="3" fill="#fffdf8"/>${modules.join("")}${finders}<rect x="${logoX}" y="${logoY}" width="${clearSize}" height="${clearSize}" rx="1.6" fill="#fff" stroke="#1256c4" stroke-width="0.24"/><image href="assets/winbest-logo.webp" x="${logoX + 1.15}" y="${logoY + 1.15}" width="${clearSize - 2.3}" height="${clearSize - 2.3}" preserveAspectRatio="xMidYMid meet"/></svg>`;
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
      $(".identity"),
      $(".primary-actions"),
      $(".contact-section"),
      $(".office-section")
    ].filter(Boolean);

    revealTargets.forEach((element) => element.classList.add("motion-reveal"));
    if (reducedMotion.matches || !("IntersectionObserver" in window)) {
      revealTargets.forEach((element) => element.classList.add("is-revealed"));
    } else {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.16, rootMargin: "0px 0px -7%" });
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

