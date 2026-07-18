# pokemon-type-table

ポケモンのタイプ相性表を GitHub Pages 向けに公開するための静的サイトです。

## リンク

- GitHub Pages: https://hrkz777.github.io/pokemon-type-matchup/
- GitHub リポジトリ: https://github.com/hrkz777/pokemon-type-matchup

`docs/index.html` は最小のシェルだけを持ち、ページ本体は `docs/js/app.js` が読み込み時に生成します。相性表、自分のポケモン用の絞り込み UI、表示文言の切り替えはすべて JavaScript 側で組み立てます。

## データ構成

`docs/assets/` には言語に依存しないデータを置きます。

- `types.json`
  タイプごとの色、クラス名、アウトライン色などの見た目用データ
- `type-effectiveness.json`
  倍率、倍率キー、カードクラスなどの相性カテゴリ用データ
- `type-matchup.csv`
  タイプ相性そのものの行列データ

`docs/locales/<locale>/` には言語依存のテキストを置きます。

- `types.json`
  タイプ名
- `type-effectiveness.json`
  相性ラベルや倍率テキスト
- `ui.json`
  タブ名、見出し、説明文、ステータス文言などの UI テキスト

## ディレクトリ

```text
docs/
├─ index.html
├─ assets/
│  ├─ type-effectiveness.json
│  ├─ type-matchup.csv
│  └─ types.json
├─ css/
│  ├─ styles.css
│  └─ types.css
├─ js/
│  └─ app.js
└─ locales/
   └─ ja/
      ├─ type-effectiveness.json
      ├─ types.json
      └─ ui.json
```

## 実行時の流れ

1. `docs/index.html` を読み込む
2. `docs/js/app.js` が `assets/` と `locales/` のデータを取得する
3. 取得したデータからタブ、表、タイプ選択 UI を DOM として生成する

## 補足

- 非テキストの定義は `assets/`、テキストは `locales/` に分離しています
- UI 文言は JavaScript に埋め込まず、`ui.json` から読み込みます
- 公開対象は `docs/` 配下です
