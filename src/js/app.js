(() => {
	const buttons = [...document.querySelectorAll(".tab-button")];
	const panels = [...document.querySelectorAll(".panel")];

	function activateTab(tabName) {
		buttons.forEach((button) => {
			const selected = button.dataset.tab === tabName;
			button.setAttribute("aria-selected", String(selected));
			button.tabIndex = selected ? 0 : -1;
		});

		panels.forEach((panel) => {
			panel.classList.toggle("is-active", panel.id === `panel-${tabName}`);
		});
	}

	buttons.forEach((button) => {
		button.addEventListener("click", () => activateTab(button.dataset.tab));
		button.addEventListener("keydown", (event) => {
			if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
				return;
			}

			const currentIndex = buttons.indexOf(button);
			const offset = event.key === "ArrowRight" ? 1 : -1;
			const nextButton = buttons[(currentIndex + offset + buttons.length) % buttons.length];
			nextButton.focus();
			nextButton.click();
		});
	});
})();
