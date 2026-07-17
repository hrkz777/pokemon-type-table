(() => {
	const DEFAULT_LOCALE = "ja"
	const FALLBACK_LOCALE = "en-US"
	const DATA_PATHS = {
		baseTypes: "assets/types.json",
		baseEffectiveness: "assets/type-effectiveness.json",
		matchups: "assets/type-matchup.csv",
	}
	const TABLE_COLUMNS = [
		{ key: "super_effective", rateKey: "2" },
		{ key: "not_very_effective", rateKey: "0.5" },
		{ key: "doesnt_affect", rateKey: "0" },
	]
	const PANEL_IDS = ["attack", "defense", "custom"]
	const UI_COPY = {
		ja: {
			pageTitle: "ポケモンタイプ相性表",
			heroTitle: "タイプ相性表",
			tabAriaLabel: "タイプ相性ビュー",
			tabs: {
				attack: "攻撃側",
				defense: "防御側",
				custom: "自分のポケモン",
			},
			titles: {
				attack: "攻撃相性一覧",
				defense: "防御相性一覧",
				custom: "自分のポケモンの防御相性",
			},
			tableTypeHeader: "タイプ",
			loadingTitle: "読み込み中",
			loadingMessage: "ファイルを読み込み中です。",
			errorTitle: "エラーが発生しました",
			errorMessage: "ファイルの読み込みに失敗しました。",
			customLead: "タイプを1つか2つ選ぶと、受ける技の相性をまとめて表示します。",
			typeFilterLabel: "タイプを選択",
			typeToggleGroupLabel: "タイプを最大2つまで選択",
			customHint: "2つまで選択できます。2つ選ぶと、他の未選択タイプは半透明になります。",
			emptyGroup: "なし",
			emptySelected: "未選択",
			statusPrompt: "タイプを1つ以上選ぶと、防御相性をここに表示します。",
			status(selectedNames) {
				return `${selectedNames.join(" / ")} の防御相性です。受ける技のタイプを倍率ごとにまとめています。`
			},
			count(value) {
				return `${value}タイプ`
			},
		},
		"en-US": {
			pageTitle: "Pokemon Type Matchup Chart",
			heroTitle: "Type Matchup Chart",
			tabAriaLabel: "Type matchup views",
			tabs: {
				attack: "Attack",
				defense: "Defense",
				custom: "Your Pokemon",
			},
			titles: {
				attack: "Attack Matchups",
				defense: "Defense Matchups",
				custom: "Defensive Matchups for Your Pokemon",
			},
			tableTypeHeader: "Type",
			loadingTitle: "Loading",
			loadingMessage: "Loading resources.",
			errorTitle: "An error occurred",
			errorMessage: "Failed to load required files.",
			customLead: "Select one or two types to group incoming move matchups.",
			typeFilterLabel: "Select Types",
			typeToggleGroupLabel: "Select up to two types",
			customHint: "You can select up to two types. Once two are selected, other unselected types become semi-transparent.",
			emptyGroup: "None",
			emptySelected: "None selected",
			statusPrompt: "Select at least one type to see defensive matchups here.",
			status(selectedNames) {
				return `Defensive matchups for ${selectedNames.join(" / ")}. Incoming move types are grouped by multiplier.`
			},
			count(value) {
				return `${value} ${value === 1 ? "type" : "types"}`
			},
		},
	}

	function createElement(tagName, options = {}) {
		const element = document.createElement(tagName)
		const {
			className,
			text,
			html,
			attributes = {},
			children = [],
		} = options

		if (className) {
			element.className = className
		}

		if (text !== undefined) {
			element.textContent = text
		}

		if (html !== undefined) {
			element.innerHTML = html
		}

		Object.entries(attributes).forEach(([name, value]) => {
			element.setAttribute(name, value)
		})

		children.forEach((child) => {
			if (child) {
				element.append(child)
			}
		})

		return element
	}

	function formatDamageRate(value) {
		const numeric = Number(value)
		if (!Number.isFinite(numeric)) {
			return ""
		}

		return Number.isInteger(numeric) ? String(numeric) : String(numeric)
	}

	function normalizeTypeKey(typeKey) {
		const normalized = String(typeKey ?? "").trim()
		if (!normalized) {
			return ""
		}

		return normalized
	}

	function normalizeLocaleForUi(locale) {
		const normalized = String(locale ?? "").trim().toLowerCase()
		if (normalized.startsWith("ja")) {
			return "ja"
		}

		if (normalized.startsWith("en")) {
			return "en-US"
		}

		return "en-US"
	}

	function getUiCopy(locale) {
		return UI_COPY[normalizeLocaleForUi(locale)] ?? UI_COPY["en-US"]
	}

	function buildLocaleCandidates() {
		const candidates = []
		const locales = [
			...(Array.isArray(navigator.languages) ? navigator.languages : []),
			navigator.language,
		]

		for (const locale of locales) {
			const normalized = String(locale ?? "").trim()
			if (!normalized) {
				continue
			}

			if (!candidates.includes(normalized)) {
				candidates.push(normalized)
			}

			const [baseLanguage] = normalized.split("-")
			if (baseLanguage && baseLanguage !== normalized && !candidates.includes(baseLanguage)) {
				candidates.push(baseLanguage)
			}
		}

		if (!candidates.includes(FALLBACK_LOCALE)) {
			candidates.push(FALLBACK_LOCALE)
		}

		if (!candidates.includes(DEFAULT_LOCALE)) {
			candidates.push(DEFAULT_LOCALE)
		}

		return candidates
	}

	function parseCsv(text) {
		const rows = []
		let row = []
		let cell = ""
		let inQuotes = false

		for (let index = 0; index < text.length; index += 1) {
			const char = text[index]
			const next = text[index + 1]

			if (char === "\"") {
				if (inQuotes && next === "\"") {
					cell += "\""
					index += 1
				} else {
					inQuotes = !inQuotes
				}
				continue
			}

			if (char === "," && !inQuotes) {
				row.push(cell)
				cell = ""
				continue
			}

			if ((char === "\n" || char === "\r") && !inQuotes) {
				if (char === "\r" && next === "\n") {
					index += 1
				}
				row.push(cell)
				rows.push(row)
				row = []
				cell = ""
				continue
			}

			cell += char
		}

		if (cell.length > 0 || row.length > 0) {
			row.push(cell)
			rows.push(row)
		}

		return rows.filter((line) => line.some((entry) => entry.trim() !== ""))
	}

	function normalizeMultiplier(value) {
		switch (String(value ?? "").trim()) {
			case "○":
				return 2
			case "△":
				return 0.5
			case "×":
				return 0
			default:
				return 1
		}
	}

	function normalizeTypeEntries(payload) {
		const rawTypes = Array.isArray(payload?.Types)
			? payload.Types
			: payload && typeof payload === "object" && !Array.isArray(payload)
				? Object.entries(payload).map(([key, entry]) => ({
					Key: key,
					Name: entry?.name,
					Color: entry?.color,
					FontColor: entry?.font_color,
					OutlineColor: entry?.outline_color,
					Style: entry?.style,
				}))
				: null

		if (!Array.isArray(rawTypes)) {
			throw new Error("types data format is invalid")
		}

		return rawTypes
			.map((entry) => {
				const key = normalizeTypeKey(entry?.Key ?? entry?.key)
				const name = String(entry?.Name ?? entry?.name ?? "").trim()
				if (!key || !name) {
					return null
				}

				return {
					key,
					name,
					className: String(entry?.Style ?? entry?.style ?? `type-${key}`).trim() || `type-${key}`,
					color: String(entry?.Color ?? entry?.color ?? "#DDD4C8").trim() || "#DDD4C8",
					fontColor: String(entry?.FontColor ?? entry?.font_color ?? "#221912").trim() || "#221912",
					outlineColor: String(entry?.OutlineColor ?? entry?.outline_color ?? "rgba(34, 25, 18, 0.18)").trim() || "rgba(34, 25, 18, 0.18)",
				}
			})
			.filter(Boolean)
	}

	function normalizeEffectivenessEntries(payload) {
		const rawEntries = Array.isArray(payload?.Effectiveness)
			? payload.Effectiveness
			: Array.isArray(payload)
				? payload
				: null

		if (!Array.isArray(rawEntries)) {
			throw new Error("effectiveness data format is invalid")
		}

		return rawEntries
			.map((entry) => {
				const damageRate = Number(entry?.DamageRate ?? entry?.damage_rate ?? entry?.damageRate)
				const rateKey = String(entry?.RateKey ?? entry?.rate_key ?? formatDamageRate(damageRate)).trim()
				if (!rateKey || !Number.isFinite(damageRate)) {
					return null
				}

				return {
					key: String(entry?.Key ?? entry?.key ?? "").trim(),
					label: String(entry?.Label ?? entry?.label ?? rateKey).trim() || rateKey,
					damageRate,
					rateKey,
					damageText: String(entry?.DamageText ?? entry?.damage_text ?? "").trim(),
					cardClass: String(entry?.CardClass ?? entry?.card_class ?? entry?.cardClass ?? "matchup-card").trim() || "matchup-card",
				}
			})
			.filter(Boolean)
	}

	async function fetchJson(path) {
		const response = await fetch(path, {
			headers: {
				Accept: "application/json",
			},
		})
		if (!response.ok) {
			throw new Error(`${path} load failed: ${response.status}`)
		}

		return response.json()
	}

	async function fetchText(path) {
		const response = await fetch(path)
		if (!response.ok) {
			throw new Error(`${path} load failed: ${response.status}`)
		}

		return response.text()
	}

	async function loadBaseData() {
		const [typesPayload, effectivenessPayload, matrixCsv] = await Promise.all([
			fetchJson(DATA_PATHS.baseTypes),
			fetchJson(DATA_PATHS.baseEffectiveness),
			fetchText(DATA_PATHS.matchups),
		])

		return {
			types: normalizeTypeEntries(typesPayload),
			effectiveness: normalizeEffectivenessEntries(effectivenessPayload),
			matrixCsv: matrixCsv.trim(),
		}
	}

	async function loadLocaleFile(candidates, fileName, normalizer) {
		for (const locale of candidates) {
			try {
				const payload = await fetchJson(`locales/${encodeURIComponent(locale)}/${fileName}`)
				return {
					locale,
					entries: normalizer(payload),
				}
			} catch {
				continue
			}
		}

		return null
	}

	function mergeTypes(baseTypes, localizedTypes) {
		const localizedMap = new Map(localizedTypes.map((typeInfo) => [typeInfo.key, typeInfo]))
		const merged = baseTypes.map((typeInfo) => ({
			...typeInfo,
			...(localizedMap.get(typeInfo.key) ?? {}),
			key: typeInfo.key,
		}))
		const seen = new Set(merged.map((typeInfo) => typeInfo.key))

		localizedTypes.forEach((typeInfo) => {
			if (!seen.has(typeInfo.key)) {
				merged.push(typeInfo)
			}
		})

		return merged
	}

	function mergeEffectiveness(baseEffectiveness, localizedEffectiveness) {
		const localizedMap = new Map(localizedEffectiveness.map((entry) => [entry.rateKey, entry]))
		const merged = baseEffectiveness.map((entry) => ({
			...entry,
			...(localizedMap.get(entry.rateKey) ?? {}),
			rateKey: entry.rateKey,
			damageRate: Number(localizedMap.get(entry.rateKey)?.damageRate ?? entry.damageRate),
		}))
		const seen = new Set(merged.map((entry) => entry.rateKey))

		localizedEffectiveness.forEach((entry) => {
			if (!seen.has(entry.rateKey)) {
				merged.push(entry)
			}
		})

		return merged
	}

	async function loadLocalizedData(baseData) {
		const candidates = buildLocaleCandidates()
		const [typesResult, effectivenessResult] = await Promise.all([
			loadLocaleFile(candidates, "types.json", normalizeTypeEntries),
			loadLocaleFile(candidates, "type-effectiveness.json", normalizeEffectivenessEntries),
		])
		const resolvedLocale = typesResult?.locale ?? effectivenessResult?.locale ?? DEFAULT_LOCALE

		return {
			locale: resolvedLocale,
			types: mergeTypes(baseData.types, typesResult?.entries ?? []),
			effectiveness: mergeEffectiveness(baseData.effectiveness, effectivenessResult?.entries ?? []),
		}
	}

	function buildMatrix(csvText, typeNameToKey) {
		const rows = parseCsv(csvText)
		if (rows.length < 2) {
			throw new Error("matrix is empty")
		}

		const defenders = rows[0]
			.slice(1)
			.map((name) => normalizeTypeKey(typeNameToKey.get(String(name).trim()) ?? String(name).trim()))
			.filter(Boolean)

		const records = rows
			.slice(1)
			.map((row) => {
				const attackerName = String(row[0] ?? "").trim()
				const attacker = normalizeTypeKey(typeNameToKey.get(attackerName) ?? attackerName)
				const matchups = {}

				defenders.forEach((defender, index) => {
					matchups[defender] = normalizeMultiplier(row[index + 1])
				})

				return { attacker, matchups }
			})
			.filter((record) => record.attacker)

		return { defenders, records }
	}

	function getTypeOrder(baseTypes, matrix) {
		const ordered = []
		const seen = new Set()
		const candidates = [
			...baseTypes.map((typeInfo) => typeInfo.key),
			...matrix.defenders,
			...matrix.records.map((record) => record.attacker),
		]

		candidates.forEach((key) => {
			if (key && !seen.has(key)) {
				seen.add(key)
				ordered.push(key)
			}
		})

		return ordered
	}

	function summarizeAttack(matrix, order) {
		const lookup = new Map(matrix.records.map((record) => [record.attacker, record.matchups]))

		return order.map((attacker) => {
			const matchups = lookup.get(attacker) ?? {}
			const super_effective = []
			const not_very_effective = []
			const doesnt_affect = []

			order.forEach((defender) => {
				const multiplier = matchups[defender] ?? 1
				if (multiplier === 2) {
					super_effective.push(defender)
				} else if (multiplier === 0.5) {
					not_very_effective.push(defender)
				} else if (multiplier === 0) {
					doesnt_affect.push(defender)
				}
			})

			return {
				name: attacker,
				super_effective,
				not_very_effective,
				doesnt_affect,
			}
		})
	}

	function summarizeDefense(matrix, order) {
		const lookup = new Map(matrix.records.map((record) => [record.attacker, record.matchups]))

		return order.map((defender) => {
			const super_effective = []
			const not_very_effective = []
			const doesnt_affect = []

			order.forEach((attacker) => {
				const matchups = lookup.get(attacker) ?? {}
				const multiplier = matchups[defender] ?? 1
				if (multiplier === 2) {
					super_effective.push(attacker)
				} else if (multiplier === 0.5) {
					not_very_effective.push(attacker)
				} else if (multiplier === 0) {
					doesnt_affect.push(attacker)
				}
			})

			return {
				name: defender,
				super_effective,
				not_very_effective,
				doesnt_affect,
			}
		})
	}

	function createTypeBadge(typeKey, typeMap, pill = false) {
		const typeInfo = typeMap.get(typeKey)
		return createElement("span", {
			className: `${pill ? "type-pill" : "type-badge"} ${typeInfo?.className ?? "type-unknown"}`,
			text: typeInfo?.name ?? typeKey,
			attributes: {
				"data-type-key": typeKey,
			},
		})
	}

	function renderTags(typeKeys, typeMap, emptyLabel) {
		if (!typeKeys.length) {
			return createElement("span", {
				className: "empty",
				text: emptyLabel,
			})
		}

		return createElement("div", {
			className: "tags",
			children: typeKeys.map((typeKey) => createTypeBadge(typeKey, typeMap, true)),
		})
	}

	function createTable(summaries, typeMap, effectivenessByRate, ui) {
		const table = createElement("table")
		const thead = createElement("thead")
		const tbody = createElement("tbody")
		const headerRow = createElement("tr")

		headerRow.append(
			createElement("th", {
				className: "column-type-header",
				text: ui.tableTypeHeader,
				attributes: { scope: "col" },
			}),
		)

		TABLE_COLUMNS.forEach((column) => {
			headerRow.append(
				createElement("th", {
					className: `column-matchup-header ${column.key}`,
					text: effectivenessByRate.get(column.rateKey)?.label ?? column.rateKey,
					attributes: {
						scope: "col",
						"data-effectiveness-label": column.rateKey,
					},
				}),
			)
		})

		thead.append(headerRow)

		summaries.forEach((summary) => {
			const row = createElement("tr")
			row.append(
				createElement("th", {
					className: "row-heading",
					attributes: { scope: "row" },
					children: [
						createElement("div", {
							className: "row-heading-content",
							children: [createTypeBadge(summary.name, typeMap)],
						}),
					],
				}),
			)

			TABLE_COLUMNS.forEach((column) => {
				row.append(
					createElement("td", {
						className: "column-matchup-cell",
						children: [renderTags(summary[column.key], typeMap, ui.emptyGroup)],
					}),
				)
			})

			tbody.append(row)
		})

		table.append(thead, tbody)
		return table
	}

	function createPanelHeader(title, lead = "") {
		return createElement("div", {
			className: "panel-header",
			children: [
				createElement("div", {
					children: [
						createElement("h2", { text: title }),
						lead
							? createElement("p", {
								className: "panel-lead",
								text: lead,
							})
							: null,
					],
				}),
			],
		})
	}

	function createTablePanel(panelId, title, isActive) {
		return createElement("section", {
			className: `panel${isActive ? " is-active" : ""}`,
			attributes: {
				id: `panel-${panelId}`,
				role: "tabpanel",
				"aria-labelledby": `tab-${panelId}`,
				...(isActive ? {} : { hidden: "" }),
			},
			children: [
				createPanelHeader(title),
				createElement("div", {
					className: "table-wrap",
					attributes: { id: `${panelId}-table` },
				}),
			],
		})
	}

	function createTypeToggleButton(typeKey, typeMap) {
		const typeInfo = typeMap.get(typeKey)
		return createElement("button", {
			className: `type-toggle-button type-badge ${typeInfo?.className ?? "type-unknown"}`,
			text: typeInfo?.name ?? typeKey,
			attributes: {
				type: "button",
				"data-type-toggle": typeKey,
				"data-type-key": typeKey,
				"aria-pressed": "false",
				"aria-disabled": "false",
			},
		})
	}

	function createCustomMatchupCard(entry, ui) {
		return createElement("section", {
			className: entry.cardClass,
			attributes: {
				"data-effectiveness-card": entry.rateKey,
			},
			children: [
				createElement("div", {
					className: "matchup-card-header",
					children: [
						createElement("h3", {
							text: entry.label,
							attributes: {
								"data-effectiveness-label": entry.rateKey,
							},
						}),
						createElement("p", {
							className: "matchup-card-count",
							text: "-",
							attributes: {
								"data-matchup-count": entry.rateKey,
							},
						}),
					],
				}),
				createElement("div", {
					className: "tags matchup-result-tags",
					attributes: {
						"data-matchup-result": entry.rateKey,
					},
					children: [
						createElement("span", {
							className: "empty",
							text: ui.emptyGroup,
						}),
					],
				}),
			],
		})
	}

	function createCustomPanel(ui, order, typeMap, effectiveness) {
		return createElement("section", {
			className: "panel",
			attributes: {
				id: "panel-custom",
				role: "tabpanel",
				"aria-labelledby": "tab-custom",
				hidden: "",
			},
			children: [
				createPanelHeader(ui.titles.custom, ui.customLead),
				createElement("div", {
					className: "type-filter-layout",
					children: [
						createElement("div", {
							className: "type-filter-controls",
							children: [
								createElement("p", {
									className: "type-filter-label",
									text: ui.typeFilterLabel,
								}),
								createElement("div", {
									className: "type-toggle-grid",
									attributes: {
										role: "group",
										"aria-label": ui.typeToggleGroupLabel,
									},
									children: order.map((typeKey) => createTypeToggleButton(typeKey, typeMap)),
								}),
								createElement("p", {
									className: "type-filter-hint",
									text: ui.customHint,
								}),
							],
						}),
						createElement("div", {
							className: "type-filter-summary",
							children: [
								createElement("p", {
									className: "type-filter-status",
									text: ui.statusPrompt,
									attributes: {
										"data-matchup-status": "",
										"aria-live": "polite",
									},
								}),
								createElement("div", {
									className: "tags selected-type-tags",
									attributes: {
										"data-selected-types": "",
										"aria-live": "polite",
									},
									children: [
										createElement("span", {
											className: "empty",
											text: ui.emptySelected,
										}),
									],
								}),
							],
						}),
					],
				}),
				createElement("div", {
					className: "matchup-summary-grid",
					children: effectiveness.map((entry) => createCustomMatchupCard(entry, ui)),
				}),
			],
		})
	}

	function createAppShell(ui, order, typeMap, effectiveness) {
		const page = createElement("div", { className: "page" })
		const hero = createElement("header", {
			className: "hero",
			children: [
				createElement("h1", {
					text: ui.heroTitle,
				}),
			],
		})
		const shell = createElement("main", { className: "shell" })
		const tabBar = createElement("div", {
			className: "tab-bar",
			attributes: {
				role: "tablist",
				"aria-label": ui.tabAriaLabel,
			},
		})

		PANEL_IDS.forEach((panelId, index) => {
			tabBar.append(
				createElement("button", {
					className: "tab-button",
					text: ui.tabs[panelId],
					attributes: {
						id: `tab-${panelId}`,
						type: "button",
						role: "tab",
						"aria-selected": String(index === 0),
						"aria-controls": `panel-${panelId}`,
						"data-tab": panelId,
						tabindex: index === 0 ? "0" : "-1",
					},
				}),
			)
		})

		shell.append(tabBar)
		shell.append(createTablePanel("attack", ui.titles.attack, true))
		shell.append(createTablePanel("defense", ui.titles.defense, false))
		shell.append(createCustomPanel(ui, order, typeMap, effectiveness))
		page.append(hero, shell)
		return page
	}

	function renderState(title, message, ui) {
		const root = document.getElementById("app")
		root.replaceChildren(
			createElement("div", {
				className: "page",
				children: [
					createElement("header", {
						className: "hero",
						children: [createElement("h1", { text: ui.heroTitle })],
					}),
					createElement("main", {
						className: "shell",
						children: [
							createElement("section", {
								className: "panel is-active",
								children: [createPanelHeader(title, message)],
							}),
						],
					}),
				],
			}),
		)
	}

	function activateTab(tabName) {
		const buttons = [...document.querySelectorAll(".tab-button")]
		const panels = [...document.querySelectorAll(".panel")]

		buttons.forEach((button) => {
			const selected = button.dataset.tab === tabName
			button.setAttribute("aria-selected", String(selected))
			button.tabIndex = selected ? 0 : -1
		})

		panels.forEach((panel) => {
			const active = panel.id === `panel-${tabName}`
			panel.classList.toggle("is-active", active)
			panel.hidden = !active
		})
	}

	function setupTabs() {
		const buttons = [...document.querySelectorAll(".tab-button")]
		buttons.forEach((button) => {
			button.addEventListener("click", () => activateTab(button.dataset.tab))
			button.addEventListener("keydown", (event) => {
				if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
					return
				}

				const currentIndex = buttons.indexOf(button)
				const offset = event.key === "ArrowRight" ? 1 : -1
				const nextButton = buttons[(currentIndex + offset + buttons.length) % buttons.length]
				nextButton.focus()
				nextButton.click()
			})
		})
	}

	function renderTables(matrix, order, typeMap, effectivenessByRate, ui) {
		const attackTable = createTable(
			summarizeAttack(matrix, order),
			typeMap,
			effectivenessByRate,
			ui,
		)
		const defenseTable = createTable(
			summarizeDefense(matrix, order),
			typeMap,
			effectivenessByRate,
			ui,
		)

		document.getElementById("attack-table")?.replaceChildren(attackTable)
		document.getElementById("defense-table")?.replaceChildren(defenseTable)
	}

	function initCustomMatchup(order, typeMap, matrix, effectiveness, ui) {
		const toggleButtons = [...document.querySelectorAll("[data-type-toggle]")]
		const selectedTypesContainer = document.querySelector("[data-selected-types]")
		const statusElement = document.querySelector("[data-matchup-status]")

		if (!toggleButtons.length || !selectedTypesContainer || !statusElement) {
			return
		}

		const matrixLookup = Object.fromEntries(
			matrix.records.map((record) => [record.attacker, record.matchups]),
		)
		const resultContainers = new Map(
			[...document.querySelectorAll("[data-matchup-result]")].map((element) => [element.dataset.matchupResult, element]),
		)
		const countElements = new Map(
			[...document.querySelectorAll("[data-matchup-count]")].map((element) => [element.dataset.matchupCount, element]),
		)
		const selectedTypes = []

		function createEmpty(text) {
			return createElement("span", {
				className: "empty",
				text,
			})
		}

		function renderBadges(container, typeKeys, emptyLabel) {
			if (!typeKeys.length) {
				container.replaceChildren(createEmpty(emptyLabel))
				return
			}

			container.replaceChildren(...typeKeys.map((typeKey) => createTypeBadge(typeKey, typeMap, true)))
		}

		function syncToggleButtons() {
			const reachedLimit = selectedTypes.length >= 2
			toggleButtons.forEach((button) => {
				const selected = selectedTypes.includes(button.dataset.typeToggle)
				const muted = reachedLimit && !selected
				button.setAttribute("aria-pressed", String(selected))
				button.setAttribute("aria-disabled", String(muted))
				button.classList.toggle("is-selected", selected)
				button.classList.toggle("is-muted", muted)
			})
		}

		function buildGroupedMatchups() {
			const grouped = new Map(effectiveness.map((entry) => [entry.rateKey, []]))
			if (!selectedTypes.length) {
				return grouped
			}

			order.forEach((attackerType) => {
				const multiplier = selectedTypes.reduce((currentMultiplier, defenderType) => {
					const row = matrixLookup[attackerType] ?? {}
					return currentMultiplier * Number(row[defenderType] ?? 1)
				}, 1)
				const rateKey = formatDamageRate(multiplier)
				if (grouped.has(rateKey)) {
					grouped.get(rateKey).push(attackerType)
				}
			})

			return grouped
		}

		function updateStatus() {
			if (!selectedTypes.length) {
				statusElement.textContent = ui.statusPrompt
				return
			}

			statusElement.textContent = ui.status(
				selectedTypes.map((typeKey) => typeMap.get(typeKey)?.name ?? typeKey),
			)
		}

		function updateResults() {
			const grouped = buildGroupedMatchups()
			resultContainers.forEach((container, rateKey) => {
				const typeKeys = grouped.get(rateKey) ?? []
				renderBadges(container, typeKeys, ui.emptyGroup)

				const countElement = countElements.get(rateKey)
				if (countElement) {
					countElement.textContent = selectedTypes.length ? ui.count(typeKeys.length) : "-"
				}
			})
		}

		function updateView() {
			syncToggleButtons()
			renderBadges(selectedTypesContainer, selectedTypes, ui.emptySelected)
			updateStatus()
			updateResults()
		}

		toggleButtons.forEach((button) => {
			button.addEventListener("click", () => {
				const typeKey = button.dataset.typeToggle
				const currentIndex = selectedTypes.indexOf(typeKey)
				if (currentIndex >= 0) {
					selectedTypes.splice(currentIndex, 1)
					updateView()
					return
				}

				if (selectedTypes.length >= 2) {
					return
				}

				selectedTypes.push(typeKey)
				updateView()
			})
		})

		updateView()
	}

	async function init() {
		const initialUi = getUiCopy(navigator.language)
		document.title = initialUi.pageTitle
		renderState(initialUi.loadingTitle, initialUi.loadingMessage, initialUi)

		try {
			const baseData = await loadBaseData()
			const localizedData = await loadLocalizedData(baseData)
			const ui = getUiCopy(localizedData.locale)
			const typeMap = new Map(localizedData.types.map((typeInfo) => [typeInfo.key, typeInfo]))
			const effectivenessByRate = new Map(localizedData.effectiveness.map((entry) => [entry.rateKey, entry]))
			const baseTypeNameToKey = new Map(baseData.types.map((typeInfo) => [typeInfo.name, typeInfo.key]))
			const matrix = buildMatrix(baseData.matrixCsv, baseTypeNameToKey)
			const order = getTypeOrder(baseData.types, matrix)
			const root = document.getElementById("app")

			document.documentElement.lang = localizedData.locale
			document.title = ui.pageTitle
			root.replaceChildren(createAppShell(ui, order, typeMap, localizedData.effectiveness))
			renderTables(matrix, order, typeMap, effectivenessByRate, ui)
			setupTabs()
			initCustomMatchup(order, typeMap, matrix, localizedData.effectiveness, ui)
		} catch (error) {
			renderState(initialUi.errorTitle, initialUi.errorMessage, initialUi)
			console.error(error)
		}
	}

	document.addEventListener("DOMContentLoaded", init)
})()
