(() => {
	const DEFAULT_LOCALE = "ja"
	const FALLBACK_LOCALE = "en-US"
	const CONTACT_FILE_NAME = "contact.json"
	const LOCALES_PATH = "../locales"
	const ISSUE_NEW_URL = "https://github.com/hrkz777/pokemon-type-matchup/issues/new?template=contact.md"
	const ISSUES_URL = "https://github.com/hrkz777/pokemon-type-matchup/issues"
	const SITE_HOME_PATH = "../"

	function createElement(tagName, options = {}) {
		const element = document.createElement(tagName)
		const {
			className,
			text,
			attributes = {},
			children = [],
		} = options

		if (className) {
			element.className = className
		}

		if (text !== undefined) {
			element.textContent = text
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

	function normalizeStringArray(value) {
		return Array.isArray(value)
			? value.map((item) => String(item ?? "").trimEnd())
			: undefined
	}

	function normalizeContactPayload(payload) {
		if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
			throw new Error("contact text format is invalid")
		}

		return {
			pageTitle: typeof payload.pageTitle === "string" ? payload.pageTitle : undefined,
			heroTitle: typeof payload.heroTitle === "string" ? payload.heroTitle : undefined,
			introTitle: typeof payload.introTitle === "string" ? payload.introTitle : undefined,
			lead: typeof payload.lead === "string" ? payload.lead : undefined,
			flowTitle: typeof payload.flowTitle === "string" ? payload.flowTitle : undefined,
			flowSteps: normalizeStringArray(payload.flowSteps),
			pointsTitle: typeof payload.pointsTitle === "string" ? payload.pointsTitle : undefined,
			points: normalizeStringArray(payload.points),
			templateTitle: typeof payload.templateTitle === "string" ? payload.templateTitle : undefined,
			templateLines: normalizeStringArray(payload.templateLines),
			createIssueLabel: typeof payload.createIssueLabel === "string" ? payload.createIssueLabel : undefined,
			issueListLabel: typeof payload.issueListLabel === "string" ? payload.issueListLabel : undefined,
			backToSiteLabel: typeof payload.backToSiteLabel === "string" ? payload.backToSiteLabel : undefined,
			note: typeof payload.note === "string" ? payload.note : undefined,
		}
	}

	function createEmptyContactCopy() {
		return {
			pageTitle: "",
			heroTitle: "",
			introTitle: "",
			lead: "",
			flowTitle: "",
			flowSteps: [],
			pointsTitle: "",
			points: [],
			templateTitle: "",
			templateLines: [],
			createIssueLabel: "",
			issueListLabel: "",
			backToSiteLabel: "",
			note: "",
		}
	}

	function mergeContactCopy(...payloads) {
		const merged = createEmptyContactCopy()

		payloads.forEach((payload) => {
			if (!payload) {
				return
			}

			Object.entries(payload).forEach(([key, value]) => {
				if (value === undefined) {
					return
				}

				merged[key] = Array.isArray(value) ? [...value] : value
			})
		})

		return merged
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

	async function loadBaseContact() {
		return normalizeContactPayload(await fetchJson(`${LOCALES_PATH}/${DEFAULT_LOCALE}/${CONTACT_FILE_NAME}`))
	}

	async function loadLocaleFile(candidates, fileName, normalizer) {
		for (const locale of candidates) {
			try {
				const payload = await fetchJson(`${LOCALES_PATH}/${encodeURIComponent(locale)}/${fileName}`)
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

	function createInfoList(className, items) {
		return createElement("ul", {
			className,
			children: items.map((item) => createElement("li", { text: item })),
		})
	}

	function createInfoSection(titleId, title, content) {
		return createElement("section", {
			className: "info-section",
			attributes: {
				"aria-labelledby": titleId,
			},
			children: [
				createElement("h3", {
					className: "info-subtitle",
					text: title,
					attributes: {
						id: titleId,
					},
				}),
				content,
			],
		})
	}

	function createContactPage(copy) {
		return createElement("div", {
			className: "page info-page",
			children: [
				createElement("header", {
					className: "hero",
					children: [
						createElement("h1", {
							text: copy.heroTitle,
						}),
					],
				}),
				createElement("main", {
					className: "shell info-shell",
					children: [
						createElement("section", {
							className: "panel is-active info-panel",
							children: [
								createElement("div", {
									className: "panel-header",
									children: [
										createElement("h2", {
											text: copy.introTitle,
										}),
									],
								}),
								createElement("p", {
									className: "panel-lead",
									text: copy.lead,
								}),
								createInfoSection(
									"contact-flow-title",
									copy.flowTitle,
									createElement("ol", {
										className: "info-steps",
										children: copy.flowSteps.map((step) => createElement("li", { text: step })),
									}),
								),
								createInfoSection(
									"contact-points-title",
									copy.pointsTitle,
									createInfoList("info-list", copy.points),
								),
								createInfoSection(
									"contact-template-title",
									copy.templateTitle,
									createElement("pre", {
										className: "info-template",
										children: [
											createElement("code", {
												text: copy.templateLines.join("\n"),
											}),
										],
									}),
								),
								createElement("div", {
									className: "info-actions",
									children: [
										createElement("a", {
											className: "info-action info-action-primary",
											text: copy.createIssueLabel,
											attributes: {
												href: ISSUE_NEW_URL,
												target: "_blank",
												rel: "noopener noreferrer",
											},
										}),
										createElement("a", {
											className: "info-action info-action-secondary",
											text: copy.issueListLabel,
											attributes: {
												href: ISSUES_URL,
												target: "_blank",
												rel: "noopener noreferrer",
											},
										}),
										createElement("a", {
											className: "info-action info-action-secondary",
											text: copy.backToSiteLabel,
											attributes: {
												href: SITE_HOME_PATH,
											},
										}),
									],
								}),
								createElement("p", {
									className: "info-note",
									text: copy.note,
								}),
							],
						}),
					],
				}),
			],
		})
	}

	async function init() {
		const root = document.getElementById("app")
		if (!root) {
			return
		}

		try {
			const baseCopy = await loadBaseContact()
			const candidates = buildLocaleCandidates()
			const localizedResult = await loadLocaleFile(candidates, CONTACT_FILE_NAME, normalizeContactPayload)
			const copy = mergeContactCopy(baseCopy, localizedResult?.entries)

			document.documentElement.lang = localizedResult?.locale ?? DEFAULT_LOCALE
			if (copy.pageTitle) {
				document.title = copy.pageTitle
			}

			root.replaceChildren(createContactPage(copy))
		} catch (error) {
			console.error(error)
		}
	}

	document.addEventListener("DOMContentLoaded", init)
})()
