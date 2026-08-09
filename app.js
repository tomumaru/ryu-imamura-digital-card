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

    const qr = window.qrcode(0, "M");
    qr.addData(currentPublicUrl());
    qr.make();
    target.innerHTML = qr.createSvgTag({ cellSize: 8, margin: 4, scalable: true });
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

  hydratePage();

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
