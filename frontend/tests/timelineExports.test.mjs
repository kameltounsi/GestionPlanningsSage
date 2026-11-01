import test from "node:test";
import assert from "node:assert/strict";
import { timelineExcelRows, timelineGanttHeader } from "../src/utils/timelineExports.js";

test("Gantt timelines stay in a header block without creating independent pages", () => {
  const html = timelineGanttHeader({ timelines: [{ name: "SOP <A>", comment: "Client & projet\nDate confirmée" }, { name: "PPAP", comment: "À valider" }] });
  assert.match(html, /SOP &lt;A&gt;/);
  assert.match(html, /Client &amp; projet\nDate confirmée/);
  assert.match(html, /PPAP/);
  assert.match(html, /À valider/);
  assert.doesNotMatch(html, /<main|pdf-export-page/);
  assert.equal(timelineGanttHeader({ timelines: [] }), "");
});

test("exports every selected timeline with its own comment and escapes user text", () => {
  const request = { timelines: [{ name: "Prototype <A>", comment: "Essai & contrôle\nSeconde ligne" }, { name: "SOP", comment: "Démarrage confirmé" }] };
  for (const html of [timelineExcelRows(request)]) {
    assert.match(html, /Prototype &lt;A&gt;/);
    assert.match(html, /Essai &amp; contrôle<br>Seconde ligne/);
    assert.match(html, /SOP/);
    assert.match(html, /Démarrage confirmé/);
  }
});

test("supports legacy single timelines and empty selections", () => {
  assert.match(timelineExcelRows({ timelineName: "Ancienne", timelineComment: "Conservé" }), /Conservé/);
  assert.equal(timelineExcelRows({ timelines: [] }), "");
});
