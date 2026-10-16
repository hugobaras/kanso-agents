import { describe, expect, it } from "vitest";
import { templates } from "./templates.js";

describe("mail templates", () => {
  it("escapes user content in HTML", () => {
    const m = templates.newLead({
      workspace: "Cabinet <script>",
      tier: "hot",
      score: 82,
      event: "hot_lead",
      rows: [["Nom", "<b>x</b>"]],
      url: "https://app.example/x",
    });
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(m.text).toContain("Score : 82 / 100");
    expect(m.subject).toContain("Demande prioritaire");
  });

  it("renders the verify link in both parts", () => {
    const m = templates.verifyEmail({ name: "Claire", url: "https://a/b?t=1" });
    expect(m.html).toContain("https://a/b?t=1");
    expect(m.text).toContain("https://a/b?t=1");
  });
});
