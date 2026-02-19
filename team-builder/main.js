// --- DATA AND STATE MANAGEMENT ---

let awakenersData = [];
const TOTAL_UNITS = 54;
const MAX_ROWS = 10;
const MAX_ROW_CAPACITY = 4;
const DATA_SOURCE_PATH = '../awakeners.json';
const FACTIONS = ["ULTRA", "CARO", "CHAOS", "AEQUOR"];

let rowsState = [
    [], [], [], [], []
];

let searchQuery = '';

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
        const name = `Awakener-${i.toString().padStart(2, '0')}`;
        const faction = FACTIONS[i % FACTIONS.length];
        mockData.push({
            name: name,
            faction: faction,
            group: 'owned',
            displayName: name
        });
    }
    awakenersData = mockData;
}

async function loadAwakenersData() {
    try {
        // Try ./awakeners.json first, then ../awakeners.json
        let response;
        try {
             response = await fetch('./awakeners.json');
             if(!response.ok) throw new Error("Not found");
        } catch (e) {
             response = await fetch('../awakeners.json');
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const externalData = await response.json();

        if (!Array.isArray(externalData) || externalData.length === 0) {
            throw new Error("External data is empty or invalid.");
        }

        const processedData = externalData.slice(0, TOTAL_UNITS).map((item, i) => ({
            name: `Awakener-${i.toString().padStart(2, '0')}`,
            faction: FACTIONS.includes(item.faction) ? item.faction : "AEQUOR",
            displayName: item.name || `Awakener-${i.toString().padStart(2, '0')}`,
            group: 'owned'
        }));

        awakenersData = processedData;
        console.log(`Successfully loaded ${awakenersData.length} units.`);

    } catch (e) {
        console.error(`Error loading data:`, e);
        generateMockData();
    }
}

function getAwakenerByName(name) {
    return awakenersData.find(a => a.name === name);
}

function getAwakenerIndexByName(name) {
    return name.split('-')[1];
}

function getAwakenerNameByIndex(indexString) {
    return `Awakener-${indexString}`;
}

function serializeState() {
    const rowsString = rowsState.map(row =>
        row.map(name => getAwakenerIndexByName(name)).join(',')
    ).join(';');

    const unownedIndices = awakenersData
        .filter(a => a.group === 'unowned')
        .map(a => getAwakenerIndexByName(a.name));
    const unownedString = unownedIndices.join(',');

    // CHANGE: Replaced '&' with '|' as the main separator
    const rawState = `${rowsString}|${unownedString}`;
    return rawState;
}

function deserializeState(rawState) {
    if (!rawState) return;
    try {
        // CHANGE: Replaced '&' with '|' in the split
        const parts = rawState.split('|');
        const rowsPart = parts[0];
        const unownedPart = parts[1] || '';

        const newRowsState = rowsPart.split(';').map(rowString => {
            const indices = rowString.split(',').filter(index => index.length > 0);
            return indices.map(index => getAwakenerNameByIndex(index)).filter(name => getAwakenerByName(name));
        }).filter(row => row.length > 0 || newRowsState.length === 0);

        rowsState = newRowsState.length > 0 ? newRowsState : [[]];

        awakenersData.forEach(a => a.group = 'owned');

        if (unownedPart.length > 0) {
            const unownedIndices = unownedPart.split(',').filter(index => index.length > 0);
            unownedIndices.forEach(index => {
                const name = getAwakenerNameByIndex(index);
                const awakener = getAwakenerByName(name);
                if (awakener) {
                    awakener.group = 'unowned';
                }
            });
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
    encodedState = encodedState.replace(/%2C/g, ',');
    encodedState = encodedState.replace(/%3B/g, ';');

    const newUrl = `${window.location.pathname}?state=${encodedState}`;
    history.replaceState(null, '', newUrl);
}

function loadStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const rawState = params.get('state');
    if (rawState) {
        const decodedState = decodeURIComponent(rawState);
        deserializeState(decodedState);
        console.log("State loaded from URL.");
    }
}

// --- UTILITY FUNCTIONS ---

function isAwakenerInTeam(name) {
    return rowsState.some(row => row.includes(name));
}

function getFactionClasses(faction) {
    switch (faction) {
        case "ULTRA": return 'border-purple-700 text-purple-200 bg-purple-900/20';
        case "CARO": return 'border-red-700 text-red-200 bg-red-900/20';
        case "CHAOS": return 'border-yellow-600 text-yellow-200 bg-yellow-900/20';
        case "AEQUOR":
        default: return 'border-blue-700 text-blue-200 bg-blue-900/20';
    }
}

function createAwakenerCard(awakener, isClone = false, rowId = null) {
    const card = document.createElement('div');
    const factionClasses = getFactionClasses(awakener.faction);

    let classes = `flex flex-col items-center w-28 h-32 p-1 rounded-lg border shadow-lg hover:shadow-xl transition duration-200`;

    const awakenerName = awakener.name;
    const displayName = awakener.displayName || awakenerName;

    if (!isClone) {
        classes += ` drag-source cursor-pointer ${factionClasses}`;
        card.draggable = true;
        card.ondragstart = (e) => handleDragStart(e, awakenerName, null);
        card.oncontextmenu = (e) => {
            e.preventDefault();
            toggleAwakenerGroup(awakenerName);
        };
    } else {
        classes += ` drag-clone cursor-pointer ${factionClasses}`;
        card.draggable = true;
        card.ondragstart = (e) => handleDragStart(e, awakenerName, rowId);
    }

    if (awakener.group === 'unowned') {
        classes += ' filter grayscale opacity-40 hover:opacity-80';
    }

    card.className = classes;
    card.dataset.name = awakenerName;

    const imageUrl = `../images/awakeners/${displayName}.png`;
    const fallbackImageUrl = `https://placehold.co/100x100/1e293b/94a3b8?text=${displayName.replace(/[-\s]/g, '%20')}`;

    card.innerHTML = `
        <div class="text-[10px] font-bold uppercase tracking-wider truncate w-full text-center mb-1 opacity-90">${displayName}</div>
        <img
            src="${imageUrl}"
            alt="${displayName} image"
            class="w-20 h-20 object-cover rounded-md border border-slate-600 shadow-sm bg-slate-800 object-left"
            onerror="this.onerror=null; this.src='${fallbackImageUrl}';"
        />
    `;
    return card;
}

function toggleAwakenerGroup(name) {
    const awakener = getAwakenerByName(name);
    if (awakener) {
        if (isAwakenerInTeam(name)) {
            console.warn(`Cannot toggle status for ${name}. It is currently in a team row.`);
            return;
        }

        awakener.group = awakener.group === 'owned' ? 'unowned' : 'owned';
        renderAwakeners();
        updateUrlState();
    }
}

function renderAwakeners() {
    const ownedList = document.getElementById('owned-list');
    const unownedList = document.getElementById('unowned-list');

    ownedList.innerHTML = '';
    unownedList.innerHTML = '';

    const query = searchQuery.toLowerCase().trim();

    const filteredAwakeners = awakenersData.filter(awakener => {
        if (isAwakenerInTeam(awakener.name)) {
            return false;
        }

        if (query === '') {
            return true;
        }

        return awakener.displayName.toLowerCase().includes(query) ||
                awakener.name.toLowerCase().includes(query) ||
                awakener.faction.toLowerCase().includes(query);
    });

    filteredAwakeners.forEach(awakener => {
        const card = createAwakenerCard(awakener);
        if (awakener.group === 'owned') {
            ownedList.appendChild(card);
        } else {
            unownedList.appendChild(card);
        }
    });
}

function handleSearchInput(e) {
    searchQuery = e.target.value;
    renderAwakeners();
}

function renderRows() {
    const rowsContainer = document.getElementById('rows-container');
    rowsContainer.innerHTML = '';

    rowsState.forEach((rowNames, index) => {
        const rowElement = document.createElement('div');
        rowElement.id = `row-${index}`;

        rowElement.className = 'team-row p-2 bg-slate-800/50 border border-slate-700 rounded-lg shadow-inner flex flex-nowrap gap-2 overflow-x-auto transition duration-300 mb-2 items-center';

        const labelContainer = document.createElement('div');
        labelContainer.className = 'flex flex-col items-center justify-center w-full sm:w-auto flex-shrink-0 min-w-[70px] px-2 border-r border-slate-700 mr-2';

        const label = document.createElement('p');
        label.className = 'row-label text-indigo-400 font-bold text-sm uppercase tracking-wide';
        label.textContent = `Row ${index + 1}`;
        labelContainer.appendChild(label);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'text-slate-600 hover:text-red-400 font-bold p-1 leading-none text-xl mt-1 transition-colors';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = `Delete Row ${index + 1}`;

        if (rowsState.length > 1) {
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deleteRow(index);
            };
        } else {
            deleteBtn.disabled = true;
            deleteBtn.classList.add('opacity-0', 'cursor-not-allowed');
        }

        labelContainer.appendChild(deleteBtn);
        rowElement.appendChild(labelContainer);

        rowElement.addEventListener('dragover', handleDragOver);
        rowElement.addEventListener('dragenter', handleDragEnter);
        rowElement.addEventListener('dragleave', handleDragLeave);
        rowElement.addEventListener('drop', handleDrop);

        rowNames.forEach(name => {
            const awakener = getAwakenerByName(name);
            if (awakener) {
                const cardClone = createAwakenerCard(awakener, true, index);
                rowElement.appendChild(cardClone);
            }
        });

        rowsContainer.appendChild(rowElement);
    });

    updateAddRowButtonStatus();
}

function addRow() {
    if (rowsState.length < MAX_ROWS) {
        rowsState.push([]);
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

    rowsState.splice(rowIndex, 1);

    renderRows();
    renderAwakeners();
    updateUrlState();

    console.log(`Deleted Row ${rowIndex + 1}.`);
}

function updateAddRowButtonStatus() {
    const btn = document.getElementById('add-row-btn');
    if (btn) {
        if (rowsState.length >= MAX_ROWS) {
            btn.disabled = true;
            btn.textContent = `Max Rows (${MAX_ROWS}) Reached`;
            btn.className = "mt-4 p-3 bg-slate-800 text-slate-500 font-bold rounded-lg border border-slate-700 cursor-not-allowed flex-shrink-0";
        } else {
            btn.disabled = false;
            btn.textContent = `+ Add Team Row (Max ${MAX_ROWS})`;
            btn.className = "mt-4 p-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg border border-indigo-500 transition duration-200 shadow-lg flex-shrink-0";
        }
    }
}

// --- EVENT HANDLERS (Drag & Drop) ---

function handleDragStart(e, awakenerName, sourceRowId) {
    const dragData = {
        name: awakenerName,
        sourceRowId: sourceRowId
    };
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnter(e) {
    e.target.closest('.team-row, #owned-list, #unowned-list')?.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.target.closest('.team-row, #owned-list, #unowned-list')?.classList.remove('drag-over');
}

// MODIFIED: Simplified to not rely on visual cues on the row itself for reordering
function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

// NEW HELPER FUNCTION for reordering logic
function getDropIndex(e, rowElement) {
    const children = Array.from(rowElement.children);
    // Skip the first child (the label container)
    const cards = children.slice(1).filter(el => el.classList.contains('drag-clone'));

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


// MODIFIED: Implementation of reordering logic
function handleDrop(e) {
    e.preventDefault();
    const rowElement = e.target.closest('.team-row');
    if (!rowElement) return;

    rowElement.classList.remove('drag-over');

    try {
        const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
        const awakenerName = dragData.name;
        const sourceRowId = dragData.sourceRowId;
        const targetRowId = parseInt(rowElement.id.split('-')[1]);

        let dropIndex = getDropIndex(e, rowElement);
        let existingIndex = rowsState[targetRowId].indexOf(awakenerName);

        const isMoveBetweenRows = (sourceRowId !== null && parseInt(sourceRowId) !== targetRowId);
        const isDragFromRoster = (sourceRowId === null);

        // 1. CAPACITY CHECK & REJECTION
        // Check capacity only if the unit is not already in the row
        // AND it's a drag from the roster or another row.
        if (existingIndex === -1 && (isMoveBetweenRows || isDragFromRoster)) {
            if (rowsState[targetRowId].length >= MAX_ROW_CAPACITY) {
                console.log(`Row ${targetRowId + 1} is full. Drop rejected.`);
                // Ensure UI consistency (no state changes occurred yet)
                renderRows();
                return; // REJECT DROP
            }
        }

        // 2. REMOVAL FROM SOURCE ROW (if dragging from a row)
        if (sourceRowId !== null) {
            const rowId = parseInt(sourceRowId);

            // Remove from source row
            rowsState[rowId] = rowsState[rowId].filter(name => name !== awakenerName);

            // Adjust dropIndex for reorder within the same row, as the array length decreased.
            if (rowId === targetRowId) {
                if (existingIndex !== -1 && existingIndex < dropIndex) {
                    dropIndex--;
                }
            }
        }

        // 3. REORDER CLEANUP (Remove existing instance if dragged from roster)
        // If the unit was dragged from the roster (sourceRowId === null) but was already present in the target row,
        // remove the existing instance before re-inserting it.
        if (existingIndex !== -1 && sourceRowId === null) {
            rowsState[targetRowId].splice(existingIndex, 1);
            if (existingIndex < dropIndex) {
                dropIndex--;
            }
        }

        // 4. INSERTION
        rowsState[targetRowId].splice(dropIndex, 0, awakenerName);

        renderRows();
        renderAwakeners();
        updateUrlState();

    } catch (e) {
        console.error("Failed to process drop:", e);
        // Fallback render in case of error
        renderRows();
    }
}

function handleRosterDrop(e) {
    e.preventDefault();
    const listElement = e.target.closest('#owned-list, #unowned-list');
    if (!listElement) return;

    listElement.classList.remove('drag-over');

    try {
        const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
        const awakenerName = dragData.name;
        const sourceRowId = dragData.sourceRowId;

        if (sourceRowId !== null) {
            const rowId = parseInt(sourceRowId);
            rowsState[rowId] = rowsState[rowId].filter(name => name !== awakenerName);
        }

        const awakener = getAwakenerByName(awakenerName);
        if (awakener) {
            const targetGroup = listElement.id === 'owned-list' ? 'owned' : 'unowned';
            if (sourceRowId === null && awakener.group === targetGroup) {
                return;
            }
            awakener.group = targetGroup;

            renderRows();
            renderAwakeners();
            updateUrlState();
        }

    } catch (error) {
        console.error("Failed to process roster drop:", error);
    }
}

// --- RESIZE LOGIC ---

function setupResizers() {
    rosterColumn = document.getElementById('roster-column');
    ownedGroup = document.getElementById('owned-group');
    unownedGroup = document.getElementById('unowned-group');
    const dragHandle = document.getElementById('drag-handle');
    const rosterSplitter = document.getElementById('roster-splitter');
    const mainLayout = document.getElementById('main-layout');

    // --- HORIZONTAL RESIZE (Roster vs Team) ---
    dragHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        mainLayout.classList.add('no-select-col');
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const rect = mainLayout.getBoundingClientRect();
        let newWidth = e.clientX - rect.left;

        const minPxWidth = rect.width * (MIN_WIDTH_PERCENT / 100);
        const maxPxWidth = rect.width * (1 - MIN_WIDTH_PERCENT / 100);

        if (newWidth < minPxWidth) newWidth = minPxWidth;
        if (newWidth > maxPxWidth) newWidth = maxPxWidth;

        rosterColumn.style.flexBasis = `${newWidth}px`;
        rosterColumn.style.flexGrow = '0';
        rosterColumn.style.flexShrink = '0';
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            mainLayout.classList.remove('no-select-col');
        }
        if (isVerticalResizing) {
            isVerticalResizing = false;
            mainLayout.classList.remove('no-select-row');
        }
    });

    // --- VERTICAL RESIZE (Owned vs Unowned) ---
    rosterSplitter.addEventListener('mousedown', (e) => {
        isVerticalResizing = true;
        mainLayout.classList.add('no-select-row');
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isVerticalResizing) return;

        const rect = rosterColumn.getBoundingClientRect();
        const ownedRect = ownedGroup.getBoundingClientRect();

        let newHeight = e.clientY - ownedRect.top;

        const maxNewHeight = rect.height - MIN_PX_HEIGHT - rosterSplitter.offsetHeight - 20;

        if (newHeight < MIN_PX_HEIGHT) newHeight = MIN_PX_HEIGHT;
        if (newHeight > maxNewHeight) newHeight = maxNewHeight;

        ownedHeightPercentage = (newHeight / rect.height) * 100;

        ownedGroup.style.flexBasis = `${newHeight}px`;
        ownedGroup.style.flexGrow = '0';
        unownedGroup.style.flexGrow = '1';
        unownedGroup.style.minHeight = `${MIN_PX_HEIGHT}px`;
    });

    const applyInitialSplit = () => {
        const rect = rosterColumn.getBoundingClientRect();
        if (rect.height > 0) {
            const initialHeight = (rect.height * ownedHeightPercentage / 100);
            ownedGroup.style.flexBasis = `${initialHeight}px`;
            ownedGroup.style.flexGrow = '0';
            unownedGroup.style.flexGrow = '1';
        }
    };
    setTimeout(applyInitialSplit, 50);
    window.addEventListener('resize', applyInitialSplit);
}

function setupEventListeners() {
    document.getElementById('awakener-search').addEventListener('input', handleSearchInput);
    document.getElementById('add-row-btn').addEventListener('click', addRow);

    const ownedList = document.getElementById('owned-list');
    const unownedList = document.getElementById('unowned-list');

    [ownedList, unownedList].forEach(list => {
        list.addEventListener('dragover', handleDragOver);
        list.addEventListener('dragenter', handleDragEnter);
        list.addEventListener('dragleave', handleDragLeave);
        list.addEventListener('drop', handleRosterDrop);
    });
}

async function init() {
    await loadAwakenersData();
    loadStateFromUrl();
    renderRows();
    renderAwakeners();
    setupEventListeners();
    setupResizers();
    updateUrlState();
    console.log("App initialized.");
}

window.onload = init;
