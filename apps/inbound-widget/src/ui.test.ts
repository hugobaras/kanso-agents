import { describe, expect, it } from "vitest";
import { t } from "./i18n.js";
import { mountChatUi } from "./ui.js";

describe("chat UI", () => {
  it("mounts inside a closed shadow root and never injects HTML from messages", () => {
    const ui = mountChatUi({
      strings: t("fr"),
      color: "#1B2A4A",
      name: "Cabinet <b>Test</b>",
      logoUrl: null,
      position: "right",
      privacyUrl: "https://app.kanso.fr/legal/confidentialite-widget",
    });
    const host = document.getElementById("kanso-widget-host");
    expect(host).not.toBeNull();
    // Closed shadow root: host page styles/scripts cannot reach inside.
    expect(host!.shadowRoot).toBeNull();
    ui.addMessage("assistant", "<img src=x onerror=alert(1)>");
    expect(document.querySelector("img")).toBeNull();
    ui.destroy();
    expect(document.getElementById("kanso-widget-host")).toBeNull();
  });
});
