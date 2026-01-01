// --- DATA AND STATE MANAGEMENT ---

let awakenersData = [];
const TOTAL_UNITS = 52;
const MAX_ROWS = 10;
const MAX_ROW_CAPACITY = 4;
const MAX_WHEELS = 20;
const AWAKENERS_SOURCE_PATH = "../awakeners.json";
const WHEELS_SOURCE_PATH = "../wheels.json";
const FACTIONS = ["ULTRA", "CARO", "CHAOS", "AEQUOR"];

let rowsState = [
  {
    slots: [
      { awakener: null, wheel: null },
      { awakener: null, wheel: null },
      { awakener: null, wheel: null },
      { awakener: null, wheel: null },
    ],
  },
  {
    slots: [
      { awakener: null, wheel: null },
      { awakener: null, wheel: null },
      { awakener: null, wheel: null },
      { awakener: null, wheel: null },
    ],
  },
  {
    slots: [
      { awakener: null, wheel: null },
      { awakener: null, wheel: null },
      { awakener: null, wheel: null },
      { awakener: null, wheel: null },
    ],
  },
  {
    slots: [
      { awakener: null, wheel: null },
      { awakener: null, wheel: null },
      { awakener: null, wheel: null },
      { awakener: null, wheel: null },
    ],
  },
  {
    slots: [
      { awakener: null, wheel: null },
      { awakener: null, wheel: null },
      { awakener: null, wheel: null },
      { awakener: null, wheel: null },
    ],
  },
];

let wheelsState = [];
let originalWheelsData = []; // Keep original wheels for rarity lookup

let searchQuery = "";
let teamSearchQuery = "";
let currentTab = "inventory";
let cardSize = "large"; // 'small', 'medium', 'large'
let showImages = true;

// Filter states
let awakenerElementFilters = {}; // { ULTRA: true, CARO: true, CHAOS: true, AEQUOR: true }
let wheelRarityFilters = {}; // { SSR: true, SR: true, R: true }

// --- RESIZING STATE ---
let isResizing = false;
let isVerticalResizing = false;
let rosterColumn;
let ownedGroup;
let unownedGroup;
let ownedHeightPercentage = 50;
const MIN_WIDTH_PERCENT = 20;
const MIN_PX_HEIGHT = 120;

function generateMockData() {
  console.log("Could not load external data. Using mock data fallback.");
  const mockData = [];
  for (let i = 0; i < TOTAL_UNITS; i++) {
    const name = `Awakener-${i.toString().padStart(2, "0")}`;
    const faction = FACTIONS[i % FACTIONS.length];
    mockData.push({
      name: name,
      faction: faction,
      group: "owned",
      displayName: name,
    });
  }
  awakenersData = mockData;
}

async function loadAwakenersData() {
  try {
    // Try ./awakeners.json first, then ../awakeners.json
    let response;
    try {
      response = await fetch("./awakeners.json");
      if (!response.ok) throw new Error("Not found");
    } catch (e) {
      response = await fetch("../awakeners.json");
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const externalData = await response.json();

    if (!Array.isArray(externalData) || externalData.length === 0) {
      throw new Error("External data is empty or invalid.");
    }

    const processedData = externalData.slice(0, TOTAL_UNITS).map((item, i) => ({
      name: `Awakener-${i.toString().padStart(2, "0")}`,
      faction: FACTIONS.includes(item.faction) ? item.faction : "AEQUOR",
      displayName: item.name || `Awakener-${i.toString().padStart(2, "0")}`,
      group: "owned",
    }));

    awakenersData = processedData;
    console.log(`Successfully loaded ${awakenersData.length} units.`);
  } catch (e) {
    console.error(`Error loading data:`, e);
    generateMockData();
  }
}

async function loadWheelsData() {
  try {
    let response;
    try {
      response = await fetch("./wheels.json");
      if (!response.ok) throw new Error("Not found");
    } catch (e) {
      response = await fetch("../wheels.json");
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const externalWheels = await response.json();

    if (!Array.isArray(externalWheels) || externalWheels.length === 0) {
      throw new Error("Wheels data is empty or invalid.");
    }

    wheelsState = externalWheels.map((wheel) => ({
      name: wheel.name || "Unknown",
      rarity: wheel.rarity || "R",
      equippedTo: "",
      group: "owned",
    }));

    originalWheelsData = [...wheelsState]; // Save original for rarity lookups

    console.log(`Successfully loaded ${wheelsState.length} wheels.`);
  } catch (e) {
    console.error(`Error loading wheels data:`, e);
    wheelsState = [];
  }
}

function getAwakenerByName(name) {
  return awakenersData.find((a) => a.name === name);
}

function getAwakenerIndexByName(name) {
  return name.split("-")[1];
}

function getAwakenerNameByIndex(indexString) {
  return `Awakener-${indexString}`;
}

function serializeState() {
  const rowsString = rowsState
    .map((row) => {
      const slotData = row.slots
        .map((slot) => {
          const awakenerIndex = slot.awakener
            ? getAwakenerIndexByName(slot.awakener)
            : "";
          // Handle both string (legacy) and object (new) wheel format
          const wheelStr = slot.wheel
            ? typeof slot.wheel === "string"
              ? slot.wheel
              : `${slot.wheel.name}:${slot.wheel.rarity}`
            : "";
          const wheelName = wheelStr ? encodeURIComponent(wheelStr) : "";
          return `${awakenerIndex}:${wheelName}`;
        })
        .join(",");
      return slotData;
    })
    .join(";");

  const ownedIndices = awakenersData
    .filter((a) => a.group === "owned")
    .map((a) => getAwakenerIndexByName(a.name));
  const ownedString = ownedIndices.join(",");

  const wheelsString = wheelsState
    .map((wheel) => {
      const wheelName = encodeURIComponent(wheel.name || "Unknown");
      const equippedTo = wheel.equippedTo || "";
      const group = wheel.group || "owned";
      const rarity = wheel.rarity || "R";
      return `${wheelName}:${equippedTo}:${group}:${rarity}`;
    })
    .join("|");

  const rawState = `${rowsString}#${ownedString}#${wheelsString}`;
  return rawState;
}

function deserializeState(rawState) {
  if (!rawState) return;
  try {
    const parts = rawState.split("#");
    const rowsPart = parts[0];
    const ownedPart = parts[1] || "";
    const wheelsPart = parts[2] || "";

    const newRowsState = rowsPart.split(";").map((rowString) => {
      const slotStrings = rowString.split(",").filter((s) => s.length > 0);
      const slots = slotStrings.map((slotStr) => {
        const [awakenerIndex, wheelData] = slotStr.split(":");
        const awakenerName = awakenerIndex
          ? getAwakenerNameByIndex(awakenerIndex)
          : null;
        const awakener = awakenerName ? getAwakenerByName(awakenerName) : null;

        let wheel = null;
        if (wheelData) {
          const decodedWheel = decodeURIComponent(wheelData);
          // Check if it contains rarity info (new format: name:rarity)
          if (decodedWheel.includes(":")) {
            const [name, rarity] = decodedWheel.split(":");
            wheel = { name: name, rarity: rarity };
          } else {
            // Legacy format - just the name
            wheel = { name: decodedWheel, rarity: "R" };
          }
        }

        return {
          awakener: awakener ? awakenerName : null,
          wheel: wheel,
        };
      });
      // Ensure exactly 4 slots
      while (slots.length < MAX_ROW_CAPACITY) {
        slots.push({ awakener: null, wheel: null });
      }
      return { slots: slots.slice(0, MAX_ROW_CAPACITY) };
    });

    rowsState =
      newRowsState.length > 0
        ? newRowsState
        : [
            {
              slots: [
                { awakener: null, wheel: null },
                { awakener: null, wheel: null },
                { awakener: null, wheel: null },
                { awakener: null, wheel: null },
              ],
            },
          ];

    awakenersData.forEach((a) => (a.group = "unowned"));

    if (ownedPart.length > 0) {
      const ownedIndices = ownedPart
        .split(",")
        .filter((index) => index.length > 0);
      ownedIndices.forEach((index) => {
        const name = getAwakenerNameByIndex(index);
        const awakener = getAwakenerByName(name);
        if (awakener) {
          awakener.group = "owned";
        }
      });
    }

    if (wheelsPart.length > 0) {
      wheelsState = wheelsPart
        .split("|")
        .map((wheelStr) => {
          const [name, equippedTo, group, rarity] = wheelStr.split(":");
          const wheelName = decodeURIComponent(name);
          // If rarity is missing, try to look it up from the original wheels data
          let wheelRarity = rarity || "R";
          if (!rarity && wheelsState.length > 0) {
            const originalWheel = wheelsState.find((w) => w.name === wheelName);
            if (originalWheel && originalWheel.rarity) {
              wheelRarity = originalWheel.rarity;
            }
          }
          return {
            name: wheelName,
            equippedTo: equippedTo || "",
            group: group || "owned",
            rarity: wheelRarity,
          };
        })
        .filter((w) => w.name);
    } else {
      wheelsState = [];
    }
  } catch (e) {
    console.error("Failed to load state from URL:", e);
  }
}

function updateUrlState() {
  const rawState = serializeState();
  let encodedState = encodeURIComponent(rawState);

  // FIX: Explicitly replace the encoded delimiters (%2C and %3B)
  // back to the unencoded characters (',' and ';') as requested.
  encodedState = encodedState.replace(/%2C/g, ",");
  encodedState = encodedState.replace(/%3B/g, ";");

  const newUrl = `${window.location.pathname}?state=${encodedState}`;
  history.replaceState(null, "", newUrl);
}

function loadStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const rawState = params.get("state");
  if (rawState) {
    const decodedState = decodeURIComponent(rawState);
    deserializeState(decodedState);
    console.log("State loaded from URL.");
  }
}

// --- UTILITY FUNCTIONS ---

function switchTab(tabName) {
  currentTab = tabName;
  const inventoryPanel = document.getElementById("inventory-panel");
  const teamPanel = document.getElementById("team-panel");
  const inventoryBtn = document.getElementById("inventory-tab-btn");
  const teamBtn = document.getElementById("team-tab-btn");

  if (tabName === "inventory") {
    inventoryPanel.classList.remove("hidden");
    teamPanel.classList.add("hidden");
    inventoryBtn.classList.add("text-indigo-400", "border-indigo-500");
    inventoryBtn.classList.remove("text-slate-400", "border-transparent");
    teamBtn.classList.remove("text-indigo-400", "border-indigo-500");
    teamBtn.classList.add("text-slate-400", "border-transparent");
  } else {
    inventoryPanel.classList.add("hidden");
    teamPanel.classList.remove("hidden");
    teamBtn.classList.add("text-indigo-400", "border-indigo-500");
    teamBtn.classList.remove("text-slate-400", "border-transparent");
    inventoryBtn.classList.remove("text-indigo-400", "border-indigo-500");
    inventoryBtn.classList.add("text-slate-400", "border-transparent");
    renderTeamAwakeners();
    renderTeamWheels();
  }
}

function isAwakenerInTeam(name) {
  return rowsState.some((row) => row.includes(name));
}

function findNextAvailableAwakenerSlot() {
  for (let teamIndex = 0; teamIndex < rowsState.length; teamIndex++) {
    for (
      let slotIndex = 0;
      slotIndex < rowsState[teamIndex].slots.length;
      slotIndex++
    ) {
      if (rowsState[teamIndex].slots[slotIndex].awakener === null) {
        return { teamIndex, slotIndex };
      }
    }
  }
  return null; // No available slot
}

function findNextAvailableWheelSlot() {
  for (let teamIndex = 0; teamIndex < rowsState.length; teamIndex++) {
    for (
      let slotIndex = 0;
      slotIndex < rowsState[teamIndex].slots.length;
      slotIndex++
    ) {
      if (rowsState[teamIndex].slots[slotIndex].wheel === null) {
        return { teamIndex, slotIndex };
      }
    }
  }
  return null; // No available slot
}

function renderInventoryWheels() {
  const list = document.getElementById("inventory-wheels-list");
  const countSpan = document.getElementById("wheels-count");
  list.innerHTML = "";

  const filteredWheels = filterWheels(wheelsState, searchQuery);

  filteredWheels.forEach((wheel) => {
    const originalIndex = wheelsState.indexOf(wheel);
    const card = createInventoryWheelCard(wheel, originalIndex);
    list.appendChild(card);
  });

  const ownedCount = wheelsState.filter((w) => w.group === "owned").length;
  countSpan.textContent = `(${ownedCount} owned)`;
}

function createWheelCardBase(wheel, config = {}) {
  const {
    width = "w-24",
    height = "h-28",
    iconSize = "w-16 h-16",
    titleSize = "text-[7px]",
    raritySize = "text-[8px]",
    clickHandler = null,
    dragStartHandler = null,
    showRarity = true,
    index = null,
  } = config;

  const card = document.createElement("div");
  const rarityClasses = getRarityClasses(wheel.rarity);
  let classes = `flex flex-col items-center ${width} ${height} p-1 rounded-lg border shadow-lg hover:shadow-xl transition duration-200 ${rarityClasses}`;

  if (clickHandler) {
    classes += " cursor-pointer";
    card.onclick = clickHandler;
  }

  if (dragStartHandler) {
    classes += " cursor-grab drag-source";
    card.draggable = true;
    card.ondragstart = dragStartHandler;
    if (index !== null) {
      card.dataset.wheelIndex = index;
    }
  }

  if (wheel.group === "unowned") {
    classes += " filter grayscale opacity-40 hover:opacity-80";
  }

  card.className = classes;

  const rarityDisplay = showRarity
    ? `<div class="${raritySize} font-semibold uppercase tracking-wider truncate w-full text-center mt-1 opacity-90">${wheel.rarity}</div>`
    : "";

  card.innerHTML = `
            <div class="${titleSize} font-bold uppercase tracking-wider truncate w-full text-center mb-1 opacity-80">${wheel.name}</div>
            <div class="${iconSize} flex items-center justify-center rounded-md border shadow-sm bg-slate-800 text-2xl">
                ⚙️
            </div>
            ${rarityDisplay}
        `;
  return card;
}

function createInventoryWheelCard(wheel, index) {
  return createWheelCardBase(wheel, {
    clickHandler: () => toggleWheelOwnership(index),
    index: index,
  });
}

function createTeamWheelCard(wheel, index) {
  const card = createWheelCardBase(wheel, {
    dragStartHandler: (e) => handleDragStart(e, wheel.name, null, wheel.rarity),
    index: index,
  });

  // Add double-click handler to fill next available wheel slot
  card.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    const slot = findNextAvailableWheelSlot();
    if (slot) {
      rowsState[slot.teamIndex].slots[slot.slotIndex].wheel = {
        name: wheel.name,
        rarity: wheel.rarity,
      };
      renderRows();
      updateUrlState();
    } else {
      console.warn("No available wheel slots");
    }
  });

  return card;
}

function toggleWheelOwnership(wheelIndex) {
  const wheel = wheelsState[wheelIndex];
  if (wheel) {
    wheel.group = wheel.group === "owned" ? "unowned" : "owned";
    renderInventoryWheels();
    updateAllOwnedButtonUI();
    updateAllUnownedButtonUI();
    updateUrlState();
  }
}

function renderWheels() {
  renderInventoryWheels();
}

function getFactionClasses(faction) {
  switch (faction) {
    case "ULTRA":
      return "border-purple-700 text-purple-200 bg-purple-900/20";
    case "CARO":
      return "border-red-700 text-red-200 bg-red-900/20";
    case "CHAOS":
      return "border-yellow-600 text-yellow-200 bg-yellow-900/20";
    case "AEQUOR":
    default:
      return "border-blue-700 text-blue-200 bg-blue-900/20";
  }
}

function getRarityClasses(rarity) {
  switch (rarity) {
    case "SSR":
      return "border-amber-600 text-amber-200 bg-amber-900/30"; // Gold
    case "SR":
      return "border-slate-400 text-slate-200 bg-slate-700/30"; // Silver
    case "R":
    default:
      return "border-amber-700 text-amber-300 bg-amber-900/20"; // Bronze
  }
}

// --- REUSABLE COMPONENT CREATORS ---

function createAwakenerCardBase(awakener, config = {}) {
  const {
    width = "w-24",
    height = "h-28",
    imageSize = "w-16 h-16",
    textSize = "text-[9px]",
    draggable = false,
    clickHandler = null,
    dragStartHandler = null,
  } = config;

  const card = document.createElement("div");
  const factionClasses = getFactionClasses(awakener.faction);
  const awakenerName = awakener.name;
  const displayName = awakener.displayName || awakenerName;

  let classes = `flex flex-col items-center ${width} ${height} p-1 rounded-lg border shadow-lg hover:shadow-xl transition duration-200 ${factionClasses}`;

  if (draggable) {
    classes += " drag-source cursor-grab";
    card.draggable = true;
    if (dragStartHandler) {
      card.ondragstart = dragStartHandler;
    }
  } else if (clickHandler) {
    classes += " cursor-pointer";
  }

  if (awakener.group === "unowned") {
    classes += " filter grayscale opacity-40 hover:opacity-80";
  }

  card.className = classes;
  card.dataset.name = awakenerName;

  if (clickHandler) {
    card.onclick = clickHandler;
  }

  const imageUrl = `../images/awakeners/${displayName}.png`;
  const fallbackImageUrl = `https://placehold.co/100x100/1e293b/94a3b8?text=${displayName.replace(
    /[-\s]/g,
    "%20"
  )}`;

  card.innerHTML = `
            <div class="${textSize} font-bold uppercase tracking-wider truncate w-full text-center mb-1 opacity-90">${displayName}</div>
            <img
                src="${imageUrl}"
                alt="${displayName} image"
                class="${imageSize} object-cover rounded-md border border-slate-600 shadow-sm bg-slate-800"
                onerror="this.onerror=null; this.src='${fallbackImageUrl}';"
            />
        `;
  return card;
}

function createInventoryAwakenerCard(awakener) {
  return createAwakenerCardBase(awakener, {
    clickHandler: () => toggleAwakenerGroup(awakener.name),
  });
}

function createAwakenerCard(awakener, isClone = false, rowId = null) {
  const card = createAwakenerCardBase(awakener, {
    width: "w-28",
    height: "h-32",
    imageSize: "w-20 h-20",
    textSize: "text-[10px]",
    draggable: true,
    dragStartHandler: (e) =>
      handleDragStart(e, awakener.name, isClone ? rowId : null),
  });

  // Add double-click handler to fill next available awakener slot
  card.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    const slot = findNextAvailableAwakenerSlot();
    if (slot) {
      rowsState[slot.teamIndex].slots[slot.slotIndex].awakener = awakener.name;
      renderRows();
      updateUrlState();
    } else {
      console.warn("No available awakener slots");
    }
  });

  return card;
}

function createWheelSlot(wheelName, teamSlotId, slotIndex) {
  // teamSlotId format: "teamIndex-slotIndex"
  const slot = document.createElement("div");
  slot.className =
    "flex items-center justify-center w-20 h-16 p-1 rounded-lg border border-amber-600 bg-slate-700/50 text-amber-200 cursor-pointer hover:bg-slate-700 transition duration-200 flex-shrink-0";
  slot.dataset.teamSlotId = teamSlotId;
  slot.dataset.wheelName = wheelName || "";

  if (wheelName) {
    slot.innerHTML = `<span class="text-[8px] font-semibold uppercase text-center break-words px-1">${wheelName}</span>`;
  } else {
    slot.innerHTML = `<span class="text-slate-500 text-[10px] uppercase">Empty</span>`;
  }

  // Add drag event listeners to make individual slots proper drop targets
  slot.addEventListener("dragover", handleDragOver);
  slot.addEventListener("dragenter", (e) => {
    e.target.closest("[data-teamSlotId]")?.classList.add("drag-over");
  });
  slot.addEventListener("dragleave", (e) => {
    e.target.closest("[data-teamSlotId]")?.classList.remove("drag-over");
  });
  slot.addEventListener("drop", (e) => handleWheelSlotDrop(e, teamSlotId));

  return slot;
}

function toggleAwakenerGroup(name) {
  const awakener = getAwakenerByName(name);
  if (awakener) {
    if (isAwakenerInTeam(name)) {
      console.warn(
        `Cannot toggle status for ${name}. It is currently in a team row.`
      );
      return;
    }

    awakener.group = awakener.group === "owned" ? "unowned" : "owned";
    renderInventoryAwakeners();
    updateAllOwnedButtonUI();
    updateAllUnownedButtonUI();
    updateUrlState();
  }
}

// --- REUSABLE BULK SELECTION FUNCTIONS ---

function bulkSetOwnership(items, group, renderFunctions) {
  items.forEach((item) => {
    item.group = group;
  });
  renderFunctions.forEach((fn) => fn());
  updateAllOwnedButtonUI();
  updateAllUnownedButtonUI();
  updateUrlState();
}

function selectAllAwakeners() {
  bulkSetOwnership(awakenersData, "owned", [renderInventoryAwakeners]);
}

function deselectAllAwakeners() {
  bulkSetOwnership(awakenersData, "unowned", [renderInventoryAwakeners]);
}

function selectAllWheels() {
  bulkSetOwnership(wheelsState, "owned", [renderInventoryWheels]);
}

function deselectAllWheels() {
  bulkSetOwnership(wheelsState, "unowned", [renderInventoryWheels]);
}

function toggleElementFilter(faction) {
  awakenerElementFilters[faction] = !awakenerElementFilters[faction];
  updateElementFilterButtonUI(faction);
  renderInventoryAwakeners();
  renderTeamAwakeners();
}

function toggleRarityFilter(rarity) {
  wheelRarityFilters[rarity] = !wheelRarityFilters[rarity];
  updateRarityFilterButtonUI(rarity);
  renderInventoryWheels();
  renderTeamWheels();
}

// --- REUSABLE UI UPDATE FUNCTIONS ---

function updateFilterButtonUI(idPrefixes, filter, isActive) {
  idPrefixes.forEach((prefix) => {
    const btn = document.getElementById(`${prefix}${filter.toLowerCase()}-btn`);
    if (btn) {
      if (isActive) {
        btn.classList.add("opacity-100");
        btn.classList.remove("opacity-40");
      } else {
        btn.classList.remove("opacity-100");
        btn.classList.add("opacity-40");
      }
    }
  });
}

function updateElementFilterButtonUI(faction) {
  updateFilterButtonUI(
    ["filter-", "team-filter-"],
    faction,
    awakenerElementFilters[faction]
  );
}

function updateRarityFilterButtonUI(rarity) {
  updateFilterButtonUI(
    ["filter-", "team-filter-"],
    rarity,
    wheelRarityFilters[rarity]
  );
}

function updateAllOwnedButtonUI() {
  // Check if all awakeners are owned
  const allAwakenerOwned = awakenersData.every((a) => a.group === "owned");
  const selectAllBtn = document.getElementById("select-all-awakeners-btn");
  if (selectAllBtn) {
    if (allAwakenerOwned) {
      selectAllBtn.classList.add("bg-indigo-600", "text-white");
      selectAllBtn.classList.remove("text-slate-400");
    } else {
      selectAllBtn.classList.remove("bg-indigo-600", "text-white");
      selectAllBtn.classList.add("text-slate-400");
    }
  }

  // Check if all wheels are owned
  const allWheelsOwned = wheelsState.every((w) => w.group === "owned");
  const selectWheelsBtn = document.getElementById("select-all-wheels-btn");
  if (selectWheelsBtn) {
    if (allWheelsOwned) {
      selectWheelsBtn.classList.add("bg-indigo-600", "text-white");
      selectWheelsBtn.classList.remove("text-slate-400");
    } else {
      selectWheelsBtn.classList.remove("bg-indigo-600", "text-white");
      selectWheelsBtn.classList.add("text-slate-400");
    }
  }
}

function updateAllUnownedButtonUI() {
  // Check if all awakeners are unowned
  const allAwakenerUnowned = awakenersData.every((a) => a.group === "unowned");
  const deselectAllBtn = document.getElementById("deselect-all-awakeners-btn");
  if (deselectAllBtn) {
    if (allAwakenerUnowned) {
      deselectAllBtn.classList.add("bg-indigo-600", "text-white");
      deselectAllBtn.classList.remove("text-slate-400");
    } else {
      deselectAllBtn.classList.remove("bg-indigo-600", "text-white");
      deselectAllBtn.classList.add("text-slate-400");
    }
  }

  // Check if all wheels are unowned
  const allWheelsUnowned = wheelsState.every((w) => w.group === "unowned");
  const deselectWheelsBtn = document.getElementById("deselect-all-wheels-btn");
  if (deselectWheelsBtn) {
    if (allWheelsUnowned) {
      deselectWheelsBtn.classList.add("bg-indigo-600", "text-white");
      deselectWheelsBtn.classList.remove("text-slate-400");
    } else {
      deselectWheelsBtn.classList.remove("bg-indigo-600", "text-white");
      deselectWheelsBtn.classList.add("text-slate-400");
    }
  }
}

// --- REUSABLE FILTERING FUNCTIONS ---

function filterItems(items, query, filterCheck) {
  const normalizedQuery = query.toLowerCase().trim();

  return items.filter((item) => {
    // Apply custom filter check (e.g., faction or rarity)
    if (!filterCheck(item)) {
      return false;
    }

    // If no search query, include all filtered items
    if (normalizedQuery === "") {
      return true;
    }

    // Apply search filter
    return (
      item.displayName?.toLowerCase().includes(normalizedQuery) ||
      item.name.toLowerCase().includes(normalizedQuery) ||
      item.faction?.toLowerCase().includes(normalizedQuery)
    );
  });
}

function filterAwakeners(awakeners, query) {
  return filterItems(
    awakeners,
    query,
    (awakener) => awakenerElementFilters[awakener.faction]
  );
}

function filterWheels(wheels, query) {
  return filterItems(
    wheels,
    query,
    (wheel) => wheelRarityFilters[wheel.rarity]
  );
}

function renderInventoryAwakeners() {
  const list = document.getElementById("inventory-awakeners-list");
  const countSpan = document.getElementById("awakeners-count");
  list.innerHTML = "";

  const filteredAwakeners = filterAwakeners(awakenersData, searchQuery);

  filteredAwakeners.forEach((awakener) => {
    const card = createInventoryAwakenerCard(awakener);
    list.appendChild(card);
  });

  const ownedCount = awakenersData.filter((a) => a.group === "owned").length;
  countSpan.textContent = `(${ownedCount} owned)`;
}

function renderTeamAwakeners() {
  const rosterList = document.getElementById("team-roster-list");
  rosterList.innerHTML = "";

  const ownedAwakeners = awakenersData.filter(
    (awakener) => awakener.group === "owned"
  );
  const filteredAwakeners = filterAwakeners(ownedAwakeners, teamSearchQuery);

  filteredAwakeners.forEach((awakener) => {
    const card = createAwakenerCard(awakener, false);
    rosterList.appendChild(card);
  });
}

function renderTeamWheels() {
  const wheelsList = document.getElementById("team-wheels-list");
  wheelsList.innerHTML = "";

  const ownedWheels = wheelsState.filter((wheel) => wheel.group === "owned");
  const filteredWheels = filterWheels(ownedWheels, teamSearchQuery);

  filteredWheels.forEach((wheel) => {
    const originalIndex = wheelsState.indexOf(wheel);
    const card = createTeamWheelCard(wheel, originalIndex);
    wheelsList.appendChild(card);
  });
}

function handleSearchInput(e) {
  searchQuery = e.target.value;
  renderInventoryAwakeners();
  renderInventoryWheels();
}

function handleTeamSearchInput(e) {
  teamSearchQuery = e.target.value;
  renderTeamAwakeners();
  renderTeamWheels();
}

function getSizeClasses(size) {
  // Returns width, height, image size, text size for slot cards
  const sizes = {
    small: {
      cardWidth: "w-28",
      awakenerHeight: showImages ? "h-20" : "h-12",
      wheelHeight: showImages ? "h-16" : "h-12",
      imageWidth: "w-12",
      imageHeight: "h-12",
      textSize: showImages ? "text-[8px]" : "text-[10px]",
      teamCardFontSize: "text-[8px]",
      titleMargin: "mb-0.5",
    },
    medium: {
      cardWidth: "w-32",
      awakenerHeight: showImages ? "h-24" : "h-16",
      wheelHeight: showImages ? "h-18" : "h-16",
      imageWidth: "w-14",
      imageHeight: "h-14",
      textSize: showImages ? "text-[9px]" : "text-[11px]",
      teamCardFontSize: "text-sm",
      titleMargin: "mb-1",
    },
    large: {
      cardWidth: "w-40",
      awakenerHeight: showImages ? "h-32" : "h-16",
      wheelHeight: showImages ? "h-20" : "h-16",
      imageWidth: "w-20",
      imageHeight: "h-20",
      textSize: showImages ? "text-[9px]" : "text-[12px]",
      teamCardFontSize: "text-base",
      titleMargin: "mb-1",
    },
  };
  return sizes[size] || sizes.large;
}

function createTeamSlotCard(slot, teamIndex, slotIndex) {
  const slotId = `${teamIndex}-${slotIndex}`;
  const slotCard = document.createElement("div");
  const sizes = getSizeClasses(cardSize);
  slotCard.className = `flex flex-col gap-2 p-3 bg-slate-800 border border-slate-700 rounded-lg flex-shrink-0 ${sizes.cardWidth} shadow-md hover:shadow-lg transition duration-200 cursor-grab drag-source`;
  slotCard.dataset.slotId = slotId;
  slotCard.draggable = true;
  slotCard.ondragstart = (e) => handleSlotDragStart(e, teamIndex, slotIndex);

  // Awakener drop zone
  const awakenerZone = document.createElement("div");
  awakenerZone.className = `flex items-center justify-center w-full ${sizes.awakenerHeight} rounded-lg border-2 border-dashed border-slate-600 bg-slate-900/50 transition duration-200 hover:border-slate-500`;
  awakenerZone.dataset.slotIndex = slotIndex;
  awakenerZone.dataset.teamIndex = teamIndex;

  if (slot.awakener) {
    const awakener = getAwakenerByName(slot.awakener);
    if (awakener) {
      const factionClasses = getFactionClasses(awakener.faction);
      const displayName = awakener.displayName || awakener.name;
      const imageUrl = `../images/awakeners/${displayName}.png`;
      const fallbackImageUrl = `https://placehold.co/100x100/1e293b/94a3b8?text=${displayName.replace(
        /[-\s]/g,
        "%20"
      )}`;

      const awakenerCard = document.createElement("div");
      awakenerCard.className = `flex flex-col items-center justify-center w-full h-full rounded-lg border shadow-lg cursor-pointer group transition ${factionClasses}`;

      if (showImages) {
        awakenerCard.innerHTML = `
                        <div class="${sizes.textSize} font-bold uppercase tracking-wider truncate w-full text-center ${sizes.titleMargin} opacity-90">${displayName}</div>
                        <img
                            src="${imageUrl}"
                            alt="${displayName} image"
                            class="${sizes.imageWidth} ${sizes.imageHeight} object-cover rounded-md border border-slate-600 shadow-sm bg-slate-800 group-hover:opacity-75 transition"
                            onerror="this.onerror=null; this.src='${fallbackImageUrl}';"
                        />
                    `;
      } else {
        awakenerCard.innerHTML = `
                        <div class="${sizes.textSize} font-bold uppercase tracking-wider text-center px-1 break-words opacity-90">${displayName}</div>
                    `;
      }

      awakenerCard.ondblclick = (e) => {
        e.stopPropagation();
        rowsState[teamIndex].slots[slotIndex].awakener = null;
        renderRows();
        renderTeamAwakeners();
        renderTeamWheels();
        updateUrlState();
      };

      awakenerZone.appendChild(awakenerCard);
      awakenerZone.classList.add("bg-slate-900/30");
    } else {
      awakenerZone.innerHTML = `<span class="text-slate-400 ${sizes.teamCardFontSize} uppercase">Drop Awakener</span>`;
    }
  } else {
    awakenerZone.innerHTML = `<span class="text-slate-400 ${sizes.teamCardFontSize} uppercase">Drop Awakener</span>`;
  }

  // Add drag event listeners for awakener zone
  awakenerZone.addEventListener("dragover", handleDragOver);
  awakenerZone.addEventListener("dragenter", (e) => {
    e.preventDefault();
    awakenerZone.classList.add("drag-over");
  });
  awakenerZone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    awakenerZone.classList.remove("drag-over");
  });
  awakenerZone.addEventListener("drop", (e) =>
    handleAwakenerSlotDrop(e, teamIndex, slotIndex)
  );

  // Wheel drop zone
  const wheelZone = document.createElement("div");
  wheelZone.className = `flex items-center justify-center w-full ${sizes.wheelHeight} p-2 rounded-lg border-2 border-dashed border-amber-700/50 bg-amber-900/20 transition duration-200 hover:border-amber-600/50`;
  wheelZone.dataset.teamSlotId = slotId;

  if (slot.wheel) {
    // Handle both string (legacy) and object (new) wheel format
    const wheelName =
      typeof slot.wheel === "string" ? slot.wheel : slot.wheel.name;
    const wheelRarity =
      typeof slot.wheel === "string" ? "R" : slot.wheel.rarity || "R";
    const rarityClasses = getRarityClasses(wheelRarity);

    const wheelDisplay = document.createElement("div");
    wheelDisplay.className = "flex items-center gap-2 cursor-pointer group";

    // Extract text color from rarity classes
    const textColorClass = rarityClasses
      .split(" ")
      .find((c) => c.startsWith("text-"));

    if (showImages) {
      wheelDisplay.innerHTML = `
                    <span class="${textColorClass} ${sizes.teamCardFontSize} font-semibold text-center flex-grow group-hover:text-red-400 transition">${wheelName}</span>
                    <span class="${textColorClass} text-lg group-hover:text-red-400 transition">⚙️</span>
                `;
    } else {
      wheelDisplay.innerHTML = `
                    <span class="${textColorClass} ${sizes.teamCardFontSize} font-semibold text-center flex-grow group-hover:text-red-400 transition">${wheelName}</span>
                `;
    }

    wheelDisplay.ondblclick = (e) => {
      e.stopPropagation();
      rowsState[teamIndex].slots[slotIndex].wheel = null;
      renderRows();
      renderTeamAwakeners();
      renderTeamWheels();
      updateUrlState();
    };

    wheelZone.appendChild(wheelDisplay);
    // Apply rarity-based border styling
    wheelZone.classList.remove(
      "border-dashed",
      "border-amber-700/50",
      "bg-amber-900/20",
      "hover:border-amber-600/50"
    );
    wheelZone.classList.add(
      "border-solid",
      rarityClasses
        .split(" ")
        .filter((c) => c.includes("border-"))
        .join(" ")
    );
  } else {
    wheelZone.innerHTML = `<span class="text-amber-700/60 ${sizes.teamCardFontSize} uppercase">Drop Wheel</span>`;
  }

  // Add drag event listeners for wheel zone
  wheelZone.addEventListener("dragover", handleDragOver);
  wheelZone.addEventListener("dragenter", (e) => {
    e.preventDefault();
    wheelZone.classList.add("drag-over");
  });
  wheelZone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    wheelZone.classList.remove("drag-over");
  });
  wheelZone.addEventListener("drop", (e) => handleWheelSlotDrop(e, slotId));

  slotCard.appendChild(awakenerZone);
  slotCard.appendChild(wheelZone);

  // Add drop listeners to the slot card itself for reordering
  slotCard.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  });
  slotCard.addEventListener("dragenter", (e) => {
    e.preventDefault();
    slotCard.classList.add("drag-over");
  });
  slotCard.addEventListener("dragleave", (e) => {
    e.preventDefault();
    slotCard.classList.remove("drag-over");
  });
  slotCard.addEventListener("drop", (e) => {
    e.stopPropagation();
    slotCard.classList.remove("drag-over");
    handleSlotDrop(e, teamIndex, slotIndex);
  });

  return slotCard;
}

function renderRows() {
  const rowsContainer = document.getElementById("rows-container");
  rowsContainer.innerHTML = "";
  rowsContainer.className = "overflow-y-auto pr-2 flex-grow";

  // Create a flex wrapper for teams that wraps naturally
  const gridWrapper = document.createElement("div");
  gridWrapper.className = "flex flex-col gap-4";

  rowsState.forEach((team, teamIndex) => {
    const teamContainer = document.createElement("div");
    teamContainer.id = `team-${teamIndex}`;
    teamContainer.className = "flex flex-col gap-2";

    // Team label and controls
    const labelContainer = document.createElement("div");
    labelContainer.className = "flex items-center justify-between px-2";

    const label = document.createElement("p");
    label.className =
      "text-indigo-400 font-bold text-sm uppercase tracking-wide";
    label.textContent = `Team ${teamIndex + 1}`;
    labelContainer.appendChild(label);

    const deleteBtn = document.createElement("button");
    deleteBtn.className =
      "text-slate-600 hover:text-red-400 font-bold p-1 leading-none text-xl transition-colors";
    deleteBtn.innerHTML = "&times;";
    deleteBtn.title = `Delete Team ${teamIndex + 1}`;

    if (rowsState.length > 1) {
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deleteRow(teamIndex);
      };
    } else {
      deleteBtn.disabled = true;
      deleteBtn.classList.add("opacity-0", "cursor-not-allowed");
    }

    labelContainer.appendChild(deleteBtn);
    teamContainer.appendChild(labelContainer);

    // Slots row (horizontal)
    const slotsRow = document.createElement("div");
    slotsRow.className = "flex flex-nowrap gap-2 overflow-x-auto p-2";

    // Render each slot in the team
    team.slots.forEach((slot, slotIndex) => {
      const slotCard = createTeamSlotCard(slot, teamIndex, slotIndex);
      slotsRow.appendChild(slotCard);
    });

    teamContainer.appendChild(slotsRow);

    gridWrapper.appendChild(teamContainer);
  });

  rowsContainer.appendChild(gridWrapper);
  updateAddRowButtonStatus();
}

function addRow() {
  if (rowsState.length < MAX_ROWS) {
    rowsState.push({
      slots: [
        { awakener: null, wheel: null },
        { awakener: null, wheel: null },
        { awakener: null, wheel: null },
        { awakener: null, wheel: null },
      ],
    });
    renderRows();
    updateUrlState();
    console.log(`Added new row. Total rows: ${rowsState.length}`);
  } else {
    console.warn(`Cannot add more rows. Maximum limit of ${MAX_ROWS} reached.`);
  }
}

function deleteRow(rowIndex) {
  if (rowsState.length <= 1) {
    console.warn("Cannot delete the last remaining row.");
    return;
  }

  const unitsInDeletedRow = rowsState[rowIndex];

  rowsState.splice(rowIndex, 1);

  renderRows();
  renderTeamAwakeners();
  renderTeamWheels();
  updateUrlState();

  console.log(`Deleted Row ${rowIndex + 1}.`);
}

function updateAddRowButtonStatus() {
  const btn = document.getElementById("add-row-btn");
  if (btn) {
    if (rowsState.length >= MAX_ROWS) {
      btn.disabled = true;
      btn.textContent = `Max Rows (${MAX_ROWS}) Reached`;
      btn.className =
        "mt-4 p-3 bg-slate-800 text-slate-500 font-bold rounded-lg border border-slate-700 cursor-not-allowed flex-shrink-0";
    } else {
      btn.disabled = false;
      btn.textContent = `+ Add Team Row (Max ${MAX_ROWS})`;
      btn.className =
        "mt-4 p-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg border border-indigo-500 transition duration-200 shadow-lg flex-shrink-0";
    }
  }
}

// --- EVENT HANDLERS (Drag & Drop) ---

function handleDragStart(e, awakenerName, sourceRowId, rarity = null) {
  const dragData = {
    name: awakenerName,
    sourceRowId: sourceRowId,
    rarity: rarity,
  };
  e.dataTransfer.setData("application/json", JSON.stringify(dragData));
  e.dataTransfer.effectAllowed = "move";
}

function handleDragEnter(e) {
  e.target
    .closest(".team-row, #owned-list, #unowned-list")
    ?.classList.add("drag-over");
}

function handleDragLeave(e) {
  e.target
    .closest(".team-row, #owned-list, #unowned-list")
    ?.classList.remove("drag-over");
}

// MODIFIED: Simplified to not rely on visual cues on the row itself for reordering
function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
}

// NEW HELPER FUNCTION for reordering logic
function getDropIndex(e, rowElement) {
  const children = Array.from(rowElement.children);
  // Skip the first child (the label container)
  const cards = children
    .slice(1)
    .filter((el) => el.classList.contains("drag-clone"));

  const dropX = e.clientX;

  if (cards.length === 0) return 0;

  let insertIndex = 0;

  for (let i = 0; i < cards.length; i++) {
    const cardRect = cards[i].getBoundingClientRect();
    const cardMidX = cardRect.left + cardRect.width / 2;

    // If drop is before the middle of a card, insert before this card.
    if (dropX < cardMidX) {
      insertIndex = i;
      return insertIndex;
    }
  }

  // If drop is after the middle of the last card, insert after the last card.
  return cards.length;
}

// Handle slot dragging for reordering
function handleSlotDragStart(e, teamIndex, slotIndex) {
  const dragData = {
    type: "slot",
    teamIndex: teamIndex,
    slotIndex: slotIndex,
  };
  e.dataTransfer.setData("application/json", JSON.stringify(dragData));
  e.dataTransfer.effectAllowed = "move";
}

function handleSlotDrop(e, teamIndex, dropSlotIndex) {
  e.preventDefault();
  e.stopPropagation();

  try {
    const dragData = JSON.parse(e.dataTransfer.getData("application/json"));

    // Only handle slot-to-slot reordering within the same team
    if (dragData.type === "slot" && dragData.teamIndex === teamIndex) {
      const sourceSlotIndex = dragData.slotIndex;
      if (sourceSlotIndex !== dropSlotIndex) {
        // Swap the slots
        const temp = rowsState[teamIndex].slots[sourceSlotIndex];
        rowsState[teamIndex].slots[sourceSlotIndex] =
          rowsState[teamIndex].slots[dropSlotIndex];
        rowsState[teamIndex].slots[dropSlotIndex] = temp;

        renderRows();
        updateUrlState();
      }
    }
  } catch (e) {
    console.error("Failed to process slot drop:", e);
  }
}

// Handle awakener drops into team slots
function handleAwakenerSlotDrop(e, teamIndex, slotIndex) {
  e.preventDefault();
  e.stopPropagation();

  const slot = e.target.closest("[data-slotIndex]");
  if (slot) slot.classList.remove("drag-over");

  try {
    const dragData = JSON.parse(e.dataTransfer.getData("application/json"));
    const awakenerName = dragData.name;
    const sourceTeamIndex =
      dragData.sourceRowId !== null ? parseInt(dragData.sourceRowId) : null;

    // Place awakener in the slot
    rowsState[teamIndex].slots[slotIndex].awakener = awakenerName;

    // If dragging from another team slot, remove from source
    if (sourceTeamIndex !== null) {
      // Find and remove from source team
      for (let i = 0; i < rowsState[sourceTeamIndex].slots.length; i++) {
        if (rowsState[sourceTeamIndex].slots[i].awakener === awakenerName) {
          rowsState[sourceTeamIndex].slots[i].awakener = null;
          break;
        }
      }
    }

    renderRows();
    renderTeamAwakeners();
    renderTeamWheels();
    updateUrlState();
  } catch (e) {
    console.error("Failed to process awakener drop:", e);
    renderRows();
  }
}

// Handle wheel drops into team slots
function handleWheelSlotDrop(e, teamSlotId) {
  e.preventDefault();
  e.stopPropagation();

  const wheelSlot = e.target.closest("[data-teamSlotId]");
  if (wheelSlot) wheelSlot.classList.remove("drag-over");

  try {
    const dragData = JSON.parse(e.dataTransfer.getData("application/json"));
    const wheelName = dragData.name;
    const wheelRarity = dragData.rarity;

    // Parse teamSlotId (format: "teamIndex-slotIndex")
    const [teamIndex, slotIndex] = teamSlotId.split("-").map(Number);

    // Place wheel in the slot (store name and rarity)
    rowsState[teamIndex].slots[slotIndex].wheel = {
      name: wheelName,
      rarity: wheelRarity,
    };

    renderRows();
    renderTeamAwakeners();
    renderTeamWheels();
    updateUrlState();
  } catch (e) {
    console.error("Failed to process wheel drop:", e);
    renderRows();
  }
}

function handleRosterDrop(e) {
  e.preventDefault();
  const listElement = e.target.closest("#owned-list, #unowned-list");
  if (!listElement) return;

  listElement.classList.remove("drag-over");

  try {
    const dragData = JSON.parse(e.dataTransfer.getData("application/json"));
    const awakenerName = dragData.name;
    const sourceRowId = dragData.sourceRowId;

    if (sourceRowId !== null) {
      const rowId = parseInt(sourceRowId);
      rowsState[rowId] = rowsState[rowId].filter(
        (name) => name !== awakenerName
      );
    }

    const awakener = getAwakenerByName(awakenerName);
    if (awakener) {
      const targetGroup = listElement.id === "owned-list" ? "owned" : "unowned";
      if (sourceRowId === null && awakener.group === targetGroup) {
        return;
      }
      awakener.group = targetGroup;

      renderRows();
      renderTeamAwakeners();
      renderTeamWheels();
      updateUrlState();
    }
  } catch (e) {
    console.error("Failed to process roster drop:", e);
  }
}

// --- RESIZE LOGIC ---

function setupResizers() {
  let resizeTarget = null;
  let resizeContainer = null;

  // Inventory tab resizing (Awakeners vs Wheels)
  const inventoryResizeHandle = document.getElementById(
    "inventory-resize-handle"
  );
  const awakenerPanel = document.getElementById("awakeners-panel");
  const wheelsPanel = document.getElementById("wheels-panel");
  const inventoryContent = document.getElementById("inventory-content");

  if (
    inventoryResizeHandle &&
    awakenerPanel &&
    wheelsPanel &&
    inventoryContent
  ) {
    inventoryResizeHandle.addEventListener("mousedown", (e) => {
      isResizing = true;
      resizeTarget = awakenerPanel;
      resizeContainer = inventoryContent;
      inventoryContent.classList.add("no-select-col");
    });
  }

  // Team Builder - Awakeners vs Wheels resizing
  const teamRosterResizeHandle = document.getElementById(
    "team-roster-resize-handle"
  );
  const teamAwakeningPanel = document.getElementById("team-awakeners-panel");
  const teamRosterContent = document.getElementById("team-roster-content");

  if (teamRosterResizeHandle && teamAwakeningPanel && teamRosterContent) {
    teamRosterResizeHandle.addEventListener("mousedown", (e) => {
      isResizing = true;
      resizeTarget = teamAwakeningPanel;
      resizeContainer = teamRosterContent;
      teamRosterContent.classList.add("no-select-col");
    });
  }

  // Team Builder tab resizing (Roster vs Team Builder)
  const teamDragHandle = document.getElementById("team-drag-handle");
  const teamRosterColumn = document.getElementById("team-roster-column");
  const teamPanel = document.getElementById("team-panel");

  if (teamDragHandle && teamRosterColumn && teamPanel) {
    teamDragHandle.addEventListener("mousedown", (e) => {
      isResizing = true;
      resizeTarget = teamRosterColumn;
      resizeContainer = teamPanel;
      teamPanel.classList.add("no-select-col");
    });
  }

  // Unified mousemove handler
  document.addEventListener("mousemove", (e) => {
    if (!isResizing || !resizeTarget || !resizeContainer) return;

    const rect = resizeContainer.getBoundingClientRect();
    let newWidth = e.clientX - rect.left;

    const minPxWidth = rect.width * (MIN_WIDTH_PERCENT / 100);
    const maxPxWidth = rect.width * (1 - MIN_WIDTH_PERCENT / 100);

    if (newWidth < minPxWidth) newWidth = minPxWidth;
    if (newWidth > maxPxWidth) newWidth = maxPxWidth;

    resizeTarget.style.flexBasis = `${newWidth}px`;
    resizeTarget.style.flexGrow = "0";
    resizeTarget.style.flexShrink = "0";
  });

  // Unified mouseup handler
  document.addEventListener("mouseup", () => {
    if (isResizing) {
      isResizing = false;
      if (resizeContainer) {
        resizeContainer.classList.remove("no-select-col");
      }
      resizeTarget = null;
      resizeContainer = null;
    }
  });
}

function updateSizeButtonUI() {
  const smallBtn = document.getElementById("size-btn-small");
  const mediumBtn = document.getElementById("size-btn-medium");
  const largeBtn = document.getElementById("size-btn-large");

  [smallBtn, mediumBtn, largeBtn].forEach((btn) => {
    btn.classList.remove("bg-indigo-600", "text-white");
    btn.classList.add("text-slate-400", "hover:text-slate-200");
  });

  const activeBtn =
    cardSize === "small"
      ? smallBtn
      : cardSize === "medium"
      ? mediumBtn
      : largeBtn;
  activeBtn.classList.remove("text-slate-400", "hover:text-slate-200");
  activeBtn.classList.add("bg-indigo-600", "text-white");
}

function updateImageToggleButtonUI() {
  const toggleBtn = document.getElementById("toggle-images-btn");
  toggleBtn.textContent = showImages ? "Hide Images" : "Show Images";
}

// --- REUSABLE EVENT LISTENER SETUP ---

function setupFilterButtons(idPrefix, filters, toggleFunction) {
  filters.forEach((filter) => {
    const btn = document.getElementById(
      `${idPrefix}${filter.toLowerCase()}-btn`
    );
    if (btn) {
      btn.addEventListener("click", () => toggleFunction(filter));
    }
  });
}

function setupEventListeners() {
  // Tab buttons
  document
    .getElementById("inventory-tab-btn")
    .addEventListener("click", () => switchTab("inventory"));
  document
    .getElementById("team-tab-btn")
    .addEventListener("click", () => switchTab("team"));

  // Inventory tab
  document
    .getElementById("inventory-search")
    .addEventListener("input", handleSearchInput);
  document
    .getElementById("select-all-awakeners-btn")
    .addEventListener("click", selectAllAwakeners);
  document
    .getElementById("deselect-all-awakeners-btn")
    .addEventListener("click", deselectAllAwakeners);
  document
    .getElementById("select-all-wheels-btn")
    .addEventListener("click", selectAllWheels);
  document
    .getElementById("deselect-all-wheels-btn")
    .addEventListener("click", deselectAllWheels);

  // Team Builder tab
  document
    .getElementById("team-awakener-search")
    .addEventListener("input", handleTeamSearchInput);
  document.getElementById("add-row-btn").addEventListener("click", addRow);

  // Size selector buttons
  ["small", "medium", "large"].forEach((size) => {
    document
      .getElementById(`size-btn-${size}`)
      .addEventListener("click", () => {
        cardSize = size;
        updateSizeButtonUI();
        renderRows();
      });
  });

  // Image toggle button
  document.getElementById("toggle-images-btn").addEventListener("click", () => {
    showImages = !showImages;
    updateImageToggleButtonUI();
    renderRows();
  });

  // Setup all filter buttons using helper function
  setupFilterButtons("filter-", FACTIONS, toggleElementFilter);
  setupFilterButtons("team-filter-", FACTIONS, toggleElementFilter);
  setupFilterButtons("filter-", ["SSR", "SR", "R"], toggleRarityFilter);
  setupFilterButtons("team-filter-", ["SSR", "SR", "R"], toggleRarityFilter);

  const teamRosterList = document.getElementById("team-roster-list");
  teamRosterList.addEventListener("dragover", handleDragOver);
  teamRosterList.addEventListener("dragenter", handleDragEnter);
  teamRosterList.addEventListener("dragleave", handleDragLeave);
  teamRosterList.addEventListener("drop", handleRosterDrop);
}

function initializeFilters() {
  // Initialize awakener element filters (all on by default)
  FACTIONS.forEach((faction) => {
    awakenerElementFilters[faction] = true;
  });

  // Initialize wheel rarity filters (all on by default)
  const rarities = ["SSR", "SR", "R"];
  rarities.forEach((rarity) => {
    wheelRarityFilters[rarity] = true;
  });

  // Update button UI to reflect initial state
  FACTIONS.forEach((faction) => {
    updateElementFilterButtonUI(faction);
  });
  rarities.forEach((rarity) => {
    updateRarityFilterButtonUI(rarity);
  });
}

function enrichWheelsWithRarity() {
  // If wheels were loaded from old state format without rarity, restore it from originalWheelsData
  wheelsState.forEach((wheel) => {
    const original = originalWheelsData.find((w) => w.name === wheel.name);
    if (original && original.rarity && wheel.rarity === "R") {
      wheel.rarity = original.rarity;
    }
  });
}

async function init() {
  await loadAwakenersData();
  await loadWheelsData();
  initializeFilters();
  loadStateFromUrl();
  enrichWheelsWithRarity();
  renderRows();
  renderInventoryAwakeners();
  renderInventoryWheels();
  renderTeamAwakeners();
  renderTeamWheels();
  setupEventListeners();
  setupResizers();
  updateAllOwnedButtonUI();
  updateAllUnownedButtonUI();
  updateUrlState();
  console.log("App initialized.");
}

window.onload = init;
