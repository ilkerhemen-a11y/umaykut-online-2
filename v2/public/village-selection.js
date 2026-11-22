export function applyVillageSelection(markers, selectedSlot) {
  const selected = selectedSlot === null || selectedSlot === undefined ? null : String(selectedSlot);
  for (const marker of markers) {
    const active = selected !== null && String(marker.dataset?.buildingSlot ?? "") === selected;
    marker.classList.toggle("is-selected", active);
    marker.setAttribute("aria-pressed", String(active));
  }
}
