from __future__ import annotations

import csv
import io
import json
import shutil
from html import escape
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT_DIR / "src"
DOCS_DIR = ROOT_DIR / "docs"
TYPES_PATH = SRC_DIR / "assets" / "types.json"
MATCHUP_PATH = SRC_DIR / "assets" / "type-matchup.csv"
STYLES_PATH = SRC_DIR / "css" / "styles.css"
TYPES_CSS_PATH = SRC_DIR / "css" / "types.css"
SCRIPT_PATH = SRC_DIR / "js" / "app.js"

OUTPUT_HTML_PATH = DOCS_DIR / "index.html"
OUTPUT_STYLES_PATH = DOCS_DIR / "css" / "styles.css"
OUTPUT_TYPES_CSS_PATH = DOCS_DIR / "css" / "types.css"
OUTPUT_SCRIPT_PATH = DOCS_DIR / "js" / "app.js"
OUTPUT_NOJEKYLL_PATH = DOCS_DIR / ".nojekyll"

HTML_INDENT = "\t"

CELL_CONFIG = (
    ("weaknesses", "こうかばつぐん"),
    ("resistances", "いまひとつ"),
    ("immunities", "こうかがない"),
)

PANELS = (
    {"id": "attack", "tab_label": "攻撃側", "title": "攻撃相性一覧"},
    {"id": "defense", "tab_label": "防御側", "title": "防御相性一覧"},
)

TYPE_CLASS_NAMES = {
    "ノーマル": "type-normal",
    "ほのお": "type-fire",
    "みず": "type-water",
    "でんき": "type-electric",
    "くさ": "type-grass",
    "こおり": "type-ice",
    "かくとう": "type-fighting",
    "どく": "type-poison",
    "じめん": "type-ground",
    "ひこう": "type-flying",
    "エスパー": "type-psychic",
    "むし": "type-bug",
    "いわ": "type-rock",
    "ゴースト": "type-ghost",
    "ドラゴン": "type-dragon",
    "あく": "type-dark",
    "はがね": "type-steel",
    "フェアリー": "type-fairy",
}


def html_line(level: int, text: str = "") -> str:
    return f"{HTML_INDENT * level}{text}" if text else ""


def join_lines(lines: list[str]) -> str:
    return "\n".join(lines)


def load_types() -> list[dict[str, str]]:
    payload = json.loads(TYPES_PATH.read_text(encoding="utf-8"))
    types = payload.get("Types")
    if not isinstance(types, list):
        raise ValueError(f"{TYPES_PATH} format is invalid")
    return types


def normalize_multiplier(value: str) -> float:
    match (value or "").strip():
        case "○":
            return 2
        case "△":
            return 0.5
        case "×":
            return 0
        case _:
            return 1


def build_matrix(csv_text: str) -> tuple[list[str], list[dict[str, object]]]:
    rows = [
        row
        for row in csv.reader(io.StringIO(csv_text.strip()))
        if any(cell.strip() for cell in row)
    ]
    if len(rows) < 2:
        raise ValueError("matrix is empty")

    defenders = [name.strip() for name in rows[0][1:] if name.strip()]
    records: list[dict[str, object]] = []
    for row in rows[1:]:
        attacker = (row[0] if row else "").strip()
        if not attacker:
            continue

        matchups: dict[str, float] = {}
        for index, defender in enumerate(defenders, start=1):
            value = row[index] if index < len(row) else ""
            matchups[defender] = normalize_multiplier(value)

        records.append({"attacker": attacker, "matchups": matchups})

    return defenders, records


def get_type_order(types: list[dict[str, str]], defenders: list[str], records: list[dict[str, object]]) -> list[str]:
    ordered: list[str] = []
    seen: set[str] = set()

    candidates = [
        *(type_info.get("Name", "") for type_info in types),
        *defenders,
        *(str(record["attacker"]) for record in records),
    ]

    for name in candidates:
        if name and name not in seen:
            seen.add(name)
            ordered.append(name)

    return ordered


def summarize_attack(records: list[dict[str, object]], order: list[str]) -> list[dict[str, object]]:
    lookup = {str(record["attacker"]): record["matchups"] for record in records}
    summaries: list[dict[str, object]] = []

    for attacker in order:
        matchups = lookup.get(attacker, {})
        weaknesses: list[str] = []
        resistances: list[str] = []
        immunities: list[str] = []

        for defender in order:
            multiplier = matchups.get(defender, 1) if isinstance(matchups, dict) else 1
            if multiplier == 2:
                weaknesses.append(defender)
            elif multiplier == 0.5:
                resistances.append(defender)
            elif multiplier == 0:
                immunities.append(defender)

        summaries.append(
            {
                "name": attacker,
                "weaknesses": weaknesses,
                "resistances": resistances,
                "immunities": immunities,
            }
        )

    return summaries


def summarize_defense(records: list[dict[str, object]], order: list[str]) -> list[dict[str, object]]:
    record_lookup = {str(record["attacker"]): record["matchups"] for record in records}
    summaries: list[dict[str, object]] = []

    for defender in order:
        weaknesses: list[str] = []
        resistances: list[str] = []
        immunities: list[str] = []

        for attacker in order:
            matchups = record_lookup.get(attacker, {})
            multiplier = matchups.get(defender, 1) if isinstance(matchups, dict) else 1
            if multiplier == 2:
                weaknesses.append(attacker)
            elif multiplier == 0.5:
                resistances.append(attacker)
            elif multiplier == 0:
                immunities.append(attacker)

        summaries.append(
            {
                "name": defender,
                "weaknesses": weaknesses,
                "resistances": resistances,
                "immunities": immunities,
            }
        )

    return summaries


def get_type_class_name(name: str) -> str:
    return TYPE_CLASS_NAMES.get(name, "type-unknown")


def render_type_badge(name: str, type_map: dict[str, dict[str, str]], pill: bool = False) -> str:
    type_info = type_map.get(name, {})
    base_class = "type-pill" if pill else "type-badge"
    type_class = get_type_class_name(name)
    label = escape(type_info.get("Name", name))
    return f'<span class="{base_class} {type_class}">{label}</span>'


def render_tags(type_names: list[str], type_map: dict[str, dict[str, str]], level: int) -> list[str]:
    if not type_names:
        return [html_line(level, '<span class="empty">なし</span>')]

    lines = [html_line(level, '<div class="tags">')]
    for type_name in type_names:
        lines.append(html_line(level + 1, render_type_badge(type_name, type_map, pill=True)))
    lines.append(html_line(level, '</div>'))
    return lines


def render_table(summaries: list[dict[str, object]], type_map: dict[str, dict[str, str]], level: int) -> list[str]:
    lines = [
        html_line(level, '<table>'),
        html_line(level + 1, '<thead>'),
        html_line(level + 2, '<tr>'),
        html_line(level + 3, '<th class="column-type-header" scope="col">タイプ</th>'),
    ]

    for _, label in CELL_CONFIG:
        lines.append(
            html_line(level + 3, f'<th class="column-matchup-header" scope="col">{escape(label)}</th>')
        )

    lines.extend(
        [
            html_line(level + 2, '</tr>'),
            html_line(level + 1, '</thead>'),
            html_line(level + 1, '<tbody>'),
        ]
    )

    for summary in summaries:
        name = str(summary["name"])
        lines.append(html_line(level + 2, '<tr>'))
        lines.append(html_line(level + 3, '<th class="row-heading" scope="row">'))
        lines.append(html_line(level + 4, '<div class="row-heading-content">'))
        lines.append(html_line(level + 5, render_type_badge(name, type_map)))
        lines.append(html_line(level + 4, '</div>'))
        lines.append(html_line(level + 3, '</th>'))

        for key, _ in CELL_CONFIG:
            lines.append(html_line(level + 3, '<td class="column-matchup-cell">'))
            lines.extend(render_tags(list(summary[key]), type_map, level + 4))
            lines.append(html_line(level + 3, '</td>'))

        lines.append(html_line(level + 2, '</tr>'))

    lines.extend(
        [
            html_line(level + 1, '</tbody>'),
            html_line(level, '</table>'),
        ]
    )
    return lines


def render_tab_button(panel: dict[str, str], selected: bool, level: int) -> list[str]:
    selected_value = "true" if selected else "false"
    tabindex_value = "0" if selected else "-1"
    return [
        html_line(level, '<button'),
        html_line(level + 1, 'class="tab-button"'),
        html_line(level + 1, f'id="tab-{panel["id"]}"'),
        html_line(level + 1, 'type="button"'),
        html_line(level + 1, 'role="tab"'),
        html_line(level + 1, f'aria-selected="{selected_value}"'),
        html_line(level + 1, f'aria-controls="panel-{panel["id"]}"'),
        html_line(level + 1, f'data-tab="{panel["id"]}"'),
        html_line(level + 1, f'tabindex="{tabindex_value}"'),
        html_line(level, f'>{escape(panel["tab_label"])}</button>'),
    ]


def render_panel(panel: dict[str, str], table_lines: list[str], active: bool, level: int) -> list[str]:
    panel_class = "panel is-active" if active else "panel"
    lines = [
        html_line(level, '<section'),
        html_line(level + 1, f'class="{panel_class}"'),
        html_line(level + 1, f'id="panel-{panel["id"]}"'),
        html_line(level + 1, 'role="tabpanel"'),
        html_line(level + 1, f'aria-labelledby="tab-{panel["id"]}"'),
        html_line(level, '>'),
        html_line(level + 1, '<div class="panel-header">'),
        html_line(level + 2, '<div>'),
        html_line(level + 3, f'<h2>{escape(panel["title"])}</h2>'),
        html_line(level + 2, '</div>'),
        html_line(level + 1, '</div>'),
        html_line(level + 1, '<div class="table-wrap">'),
    ]
    lines.extend(table_lines)
    lines.extend(
        [
            html_line(level + 1, '</div>'),
            html_line(level, '</section>'),
        ]
    )
    return lines


def render_document() -> str:
    types = load_types()
    type_map = {type_info["Name"]: type_info for type_info in types if "Name" in type_info}
    matrix_csv = MATCHUP_PATH.read_text(encoding="utf-8")
    defenders, records = build_matrix(matrix_csv)
    order = get_type_order(types, defenders, records)
    attack_summaries = summarize_attack(records, order)
    defense_summaries = summarize_defense(records, order)

    attack_panel_lines = render_panel(
        PANELS[0],
        render_table(attack_summaries, type_map, level=6),
        active=True,
        level=4,
    )
    defense_panel_lines = render_panel(
        PANELS[1],
        render_table(defense_summaries, type_map, level=6),
        active=False,
        level=4,
    )

    lines = [
        '<!doctype html>',
        '<html lang="ja">',
        html_line(1, '<head>'),
        html_line(2, '<meta charset="utf-8">'),
        html_line(2, '<meta name="viewport" content="width=device-width, initial-scale=1">'),
        html_line(2, '<title>ポケモンタイプ相性表</title>'),
        html_line(2, '<meta name="generator" content="src/build_index.py">'),
        html_line(2, '<link rel="stylesheet" href="css/styles.css">'),
        html_line(2, '<link rel="stylesheet" href="css/types.css">'),
        html_line(1, '</head>'),
        html_line(1, '<body>'),
        html_line(2, '<!-- Generated by src/build_index.py. Do not edit directly. -->'),
        html_line(2, '<div class="page">'),
        html_line(3, '<header class="hero">'),
        html_line(4, '<h1>タイプ相性表</h1>'),
        html_line(3, '</header>'),
        html_line(3, '<main class="shell">'),
        html_line(4, '<div class="tab-bar" role="tablist" aria-label="タイプ相性ビュー">'),
    ]

    for index, panel in enumerate(PANELS):
        lines.extend(render_tab_button(panel, selected=index == 0, level=5))

    lines.append(html_line(4, '</div>'))
    lines.extend(attack_panel_lines)
    lines.extend(defense_panel_lines)
    lines.extend(
        [
            html_line(3, '</main>'),
            html_line(2, '</div>'),
            html_line(2, '<script src="js/app.js"></script>'),
            html_line(1, '</body>'),
            '</html>',
        ]
    )

    return join_lines(lines) + "\n"


def write_support_files() -> None:
    OUTPUT_STYLES_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_SCRIPT_PATH.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(STYLES_PATH, OUTPUT_STYLES_PATH)
    shutil.copyfile(TYPES_CSS_PATH, OUTPUT_TYPES_CSS_PATH)
    shutil.copyfile(SCRIPT_PATH, OUTPUT_SCRIPT_PATH)
    OUTPUT_NOJEKYLL_PATH.write_text("", encoding="utf-8")


def clean_output_directory() -> None:
    if not DOCS_DIR.exists():
        return

    for path in DOCS_DIR.iterdir():
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink()


def main() -> None:
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    clean_output_directory()
    OUTPUT_HTML_PATH.write_text(render_document(), encoding="utf-8")
    write_support_files()
    print(
        'Built '
        f'{OUTPUT_HTML_PATH.relative_to(ROOT_DIR)}, '
        f'{OUTPUT_STYLES_PATH.relative_to(ROOT_DIR)}, '
        f'{OUTPUT_TYPES_CSS_PATH.relative_to(ROOT_DIR)}, '
        f'{OUTPUT_SCRIPT_PATH.relative_to(ROOT_DIR)}, '
        f'{OUTPUT_NOJEKYLL_PATH.relative_to(ROOT_DIR)}'
    )


if __name__ == '__main__':
    main()


