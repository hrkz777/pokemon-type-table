const DATA_PATHS = {
	types: "assets/types.json",
	matchups: "assets/type-matchup.csv"
};

const CELL_CONFIG = {
	attack: [
		{ key: "weaknesses", label: "こうかばつぐん" },
		{ key: "resistances", label: "いまひとつ" },
		{ key: "immunities", label: "こうかがない" }
	],
	defense: [
		{ key: "weaknesses", label: "こうかばつぐん" },
		{ key: "resistances", label: "いまひとつ" },
		{ key: "immunities", label: "こうかがない" }
	]
};

const PANEL_COPY = {
	attack: {
		id: "attack",
		tabLabel: "攻撃側",
		title: "攻撃相性一覧",
	},
	defense: {
		id: "defense",
		tabLabel: "防御側",
		title: "防御相性一覧",
	}
};

function createElement(tagName, options = {}) {
	const element = document.createElement(tagName);
	const {
		className,
		text,
		html,
		attributes = {},
		children = []
	} = options;

	if (className) {
		element.className = className;
	}

	if (text !== undefined) {
		element.textContent = text;
	}

	if (html !== undefined) {
		element.innerHTML = html;
	}

	Object.entries(attributes).forEach(([name, value]) => {
		element.setAttribute(name, value);
	});

	children.forEach((child) => {
		element.append(child);
	});

	return element;
}

function renderStatus(title, message, modifier = "") {
	const root = document.getElementById("app");
	const wrapper = createElement("div", {
		className: `status ${modifier}`.trim()
	});
	const card = createElement("div", {
		className: "status-card",
		children: [
			createElement("h2", { text: title }),
			createElement("p", { text: message })
		]
	});

	wrapper.append(card);
	root.replaceChildren(wrapper);
}

function parseCsv(text) {
	const rows = [];
	let row = [];
	let cell = "";
	let inQuotes = false;

	for (let index = 0; index < text.length; index += 1) {
		const char = text[index];
		const next = text[index + 1];

		if (char === "\"") {
			if (inQuotes && next === "\"") {
				cell += "\"";
				index += 1;
			} else {
				inQuotes = !inQuotes;
			}
			continue;
		}

		if (char === "," && !inQuotes) {
			row.push(cell);
			cell = "";
			continue;
		}

		if ((char === "\n" || char === "\r") && !inQuotes) {
			if (char === "\r" && next === "\n") {
				index += 1;
			}
			row.push(cell);
			rows.push(row);
			row = [];
			cell = "";
			continue;
		}

		cell += char;
	}

	if (cell.length > 0 || row.length > 0) {
		row.push(cell);
		rows.push(row);
	}

	return rows.filter((line) => line.some((entry) => entry.trim() !== ""));
}

function normalizeMultiplier(value) {
	switch ((value || "").trim()) {
		case "○":
			return 2;
		case "△":
			return 0.5;
		case "×":
			return 0;
		default:
			return 1;
	}
}

async function loadData() {
	const [typesResponse, matrixResponse] = await Promise.all([
		fetch(DATA_PATHS.types),
		fetch(DATA_PATHS.matchups)
	]);

	if (!typesResponse.ok) {
		throw new Error(`${DATA_PATHS.types} load failed: ${typesResponse.status}`);
	}

	if (!matrixResponse.ok) {
		throw new Error(`${DATA_PATHS.matchups} load failed: ${matrixResponse.status}`);
	}

	const typesPayload = await typesResponse.json();
	const matrixCsv = await matrixResponse.text();

	if (!Array.isArray(typesPayload.Types)) {
		throw new Error(`${DATA_PATHS.types} format is invalid`);
	}

	return {
		types: typesPayload.Types,
		matrixCsv: matrixCsv.trim()
	};
}

function buildMatrix(csvText) {
	const rows = parseCsv(csvText.trim());
	if (rows.length < 2) {
		throw new Error("matrix is empty");
	}

	const defenders = rows[0].slice(1).map((name) => name.trim()).filter(Boolean);
	const records = rows.slice(1).map((row) => {
		const attacker = (row[0] || "").trim();
		const matchups = {};

		defenders.forEach((defender, index) => {
			matchups[defender] = normalizeMultiplier(row[index + 1]);
		});

		return { attacker, matchups };
	}).filter((record) => record.attacker);

	return { defenders, records };
}

function getTypeOrder(types, matrix) {
	const ordered = [];
	const seen = new Set();

	[...types.map((type) => type.Name), ...matrix.defenders, ...matrix.records.map((row) => row.attacker)]
		.filter(Boolean)
		.forEach((name) => {
			if (!seen.has(name)) {
				seen.add(name);
				ordered.push(name);
			}
		});

	return ordered;
}

function summarizeAttack(matrix, order) {
	const lookup = new Map(matrix.records.map((record) => [record.attacker, record.matchups]));

	return order.map((attacker) => {
		const matchups = lookup.get(attacker) || {};
		const weaknesses = [];
		const resistances = [];
		const immunities = [];

		order.forEach((defender) => {
			const multiplier = matchups[defender] ?? 1;
			if (multiplier === 2) {
				weaknesses.push(defender);
			} else if (multiplier === 0.5) {
				resistances.push(defender);
			} else if (multiplier === 0) {
				immunities.push(defender);
			}
		});

		return { name: attacker, weaknesses, resistances, immunities };
	});
}

function summarizeDefense(matrix, order) {
	const recordLookup = new Map(matrix.records.map((record) => [record.attacker, record.matchups]));

	return order.map((defender) => {
		const weaknesses = [];
		const resistances = [];
		const immunities = [];

		order.forEach((attacker) => {
			const matchups = recordLookup.get(attacker) || {};
			const multiplier = matchups[defender] ?? 1;
			if (multiplier === 2) {
				weaknesses.push(attacker);
			} else if (multiplier === 0.5) {
				resistances.push(attacker);
			} else if (multiplier === 0) {
				immunities.push(attacker);
			}
		});

		return { name: defender, weaknesses, resistances, immunities };
	});
}

function getContrastColor(hexColor) {
	const cleaned = hexColor.replace("#", "");
	const full = cleaned.length === 3
		? cleaned.split("").map((char) => char + char).join("")
		: cleaned;

	const red = parseInt(full.slice(0, 2), 16);
	const green = parseInt(full.slice(2, 4), 16);
	const blue = parseInt(full.slice(4, 6), 16);
	const brightness = (red * 299 + green * 587 + blue * 114) / 1000;

	return brightness > 150 ? "#221912" : "#fffdfa";
}

function createTypeBadge(name, typeMap, pill = false) {
	const typeInfo = typeMap.get(name);
	const background = typeInfo ? typeInfo.Color : "#ddd4c8";
	const color = typeInfo && typeInfo.FontColor ? typeInfo.FontColor : getContrastColor(background);
	const outline = typeInfo && typeInfo.OutlineColor ? typeInfo.OutlineColor : "rgba(34, 25, 18, 0.18)";

	const outlineWidth = 2;
	return createElement("span", {
		className: pill ? "type-pill" : "type-badge",
		text: typeInfo ? typeInfo.Name : name,
		attributes: {
			style: `
				background: ${background};
				color: ${color};
				border: 2px solid ${outline};
				text-shadow: ${outlineWidth}px 0px ${outline},
							-${outlineWidth}px 0px ${outline},
							0px  ${outlineWidth}px ${outline},
							0px -${outlineWidth}px ${outline},
							 ${outlineWidth}px  ${outlineWidth}px ${outline},
							-${outlineWidth}px -${outlineWidth}px ${outline},
							 ${outlineWidth}px -${outlineWidth}px ${outline},
							-${outlineWidth}px  ${outlineWidth}px ${outline};
			`
		}
	});
}

function renderTags(typeNames, typeMap) {
	if (typeNames.length === 0) {
		return createElement("span", {
			className: "empty",
			text: "なし"
		});
	}

	return createElement("div", {
		className: "tags",
		children: typeNames.map((typeName) => createTypeBadge(typeName, typeMap, true))
	});
}

function createTable(summaries, cellConfig, typeMap) {
	const table = createElement("table");
	const thead = createElement("thead");
	const tbody = createElement("tbody");
	const headerRow = createElement("tr");

	headerRow.append(createElement("th", {
		className: "column-type-header",
		text: "タイプ",
		attributes: { scope: "col" }
	}));

	cellConfig.forEach((config) => {
		headerRow.append(createElement("th", {
			className: "column-matchup-header",
			text: config.label,
			attributes: { scope: "col" }
		}));
	});

	thead.append(headerRow);

	summaries.forEach((summary) => {
		const row = createElement("tr");
		const heading = createElement("th", {
			className: "row-heading",
			attributes: { scope: "row" },
			children: [
				createElement("div", {
					className: "row-heading-content",
					children: [createTypeBadge(summary.name, typeMap)]
				})
			]
		});

		row.append(heading);

		cellConfig.forEach((config) => {
			row.append(createElement("td", {
				className: "column-matchup-cell",
				children: [renderTags(summary[config.key], typeMap)]
			}));
		});

		tbody.append(row);
	});

	table.append(thead, tbody);
	return table;
}

function createPanel(panelConfig, tableId) {
	return createElement("section", {
		className: `panel${panelConfig.id === "attack" ? " is-active" : ""}`,
		attributes: {
			id: `panel-${panelConfig.id}`,
			role: "tabpanel",
			"aria-labelledby": `tab-${panelConfig.id}`
		},
		children: [
			createElement("div", {
				className: "panel-header",
				children: [
					createElement("div", {
						children: [
							createElement("h2", { text: panelConfig.title }),
						]
					}),
				]
			}),
			createElement("div", {
				className: "table-wrap",
				attributes: { id: tableId }
			})
		]
	});
}

function createAppShell() {
	const page = createElement("div", { className: "page" });
	const hero = createElement("header", {
		className: "hero",
		children: [
			createElement("h1", {
				html: "タイプ相性表"
			}),
		]
	});

	const shell = createElement("main", { className: "shell" });
	const tabBar = createElement("div", {
		className: "tab-bar",
		attributes: {
			role: "tablist",
			"aria-label": "タイプ相性ビュー"
		}
	});

	Object.values(PANEL_COPY).forEach((panelConfig, index) => {
		tabBar.append(createElement("button", {
			className: "tab-button",
			text: panelConfig.tabLabel,
			attributes: {
				id: `tab-${panelConfig.id}`,
				type: "button",
				role: "tab",
				"aria-selected": String(index === 0),
				"aria-controls": `panel-${panelConfig.id}`,
				"data-tab": panelConfig.id,
				tabindex: index === 0 ? "0" : "-1"
			}
		}));
	});

	shell.append(tabBar);
	shell.append(createPanel(PANEL_COPY.attack, "attack-table"));
	shell.append(createPanel(PANEL_COPY.defense, "defense-table"));
	page.append(hero, shell);

	return page;
}

function activateTab(tabName) {
	document.querySelectorAll(".tab-button").forEach((button) => {
		const selected = button.dataset.tab === tabName;
		button.setAttribute("aria-selected", String(selected));
		button.tabIndex = selected ? 0 : -1;
	});

	document.querySelectorAll(".panel").forEach((panel) => {
		panel.classList.toggle("is-active", panel.id === `panel-${tabName}`);
	});
}

function setupTabs() {
	document.querySelectorAll(".tab-button").forEach((button) => {
		button.addEventListener("click", () => activateTab(button.dataset.tab));
		button.addEventListener("keydown", (event) => {
			if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
				return;
			}

			const buttons = [...document.querySelectorAll(".tab-button")];
			const currentIndex = buttons.indexOf(button);
			const offset = event.key === "ArrowRight" ? 1 : -1;
			const nextButton = buttons[(currentIndex + offset + buttons.length) % buttons.length];
			nextButton.focus();
			nextButton.click();
		});
	});
}

function renderTables(types, matrixCsv) {
	const matrix = buildMatrix(matrixCsv);
	const order = getTypeOrder(types, matrix);
	const typeMap = new Map(types.map((type) => [type.Name, type]));

	const attackTable = createTable(
		summarizeAttack(matrix, order),
		CELL_CONFIG.attack,
		typeMap
	);

	const defenseTable = createTable(
		summarizeDefense(matrix, order),
		CELL_CONFIG.defense,
		typeMap
	);

	document.getElementById("attack-table").replaceChildren(attackTable);
	document.getElementById("defense-table").replaceChildren(defenseTable);
}

async function init() {
	renderStatus(
		"読み込み中",
		`ファイルを読み込み中です`,
		"is-loading"
	);

	try {
		const { types, matrixCsv } = await loadData();
		const root = document.getElementById("app");
		root.replaceChildren(createAppShell());
		renderTables(types, matrixCsv);
		setupTabs();
	} catch (error) {
		renderStatus(
			"エラーが発生しました",
			`ファイルの読み込みに失敗しました`,
			"is-error"
		);
		console.error(error);
	}
}

document.addEventListener("DOMContentLoaded", init);
