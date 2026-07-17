# pokemon-type-table

`src/` に参照用リソースと生成プログラムを置き、`src/build_index.py` で `docs/` 配下の静的ファイルを生成する構成です。`docs/index.html` は最小のシェルだけを出力し、ページ本体は `docs/js/app.js` が読み込み時に `docs/assets/` と `docs/locales/` のデータから組み立てます。

ローカルビルド:

```bash
python src/build_index.py
```

生成物は `docs/index.html` `docs/css/styles.css` `docs/css/types.css` `docs/js/app.js` `docs/assets/*` `docs/locales/*` です。

GitHub Actions では `main` への push または手動実行時に `src/build_index.py` を実行し、生成した `docs/` を GitHub Pages へデプロイします。
