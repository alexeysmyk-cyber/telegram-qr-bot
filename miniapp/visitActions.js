import { openCreateVisit } from "./createVisit.js";

export function startMoveVisit(visit, previousOverlay) {
  openCreateVisit({
    mode: "move",
    visit,
    previousOverlay
  });
}
