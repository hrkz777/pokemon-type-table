# pokemon-type-table

`src/` に参照用リソースと生成プログラムを置き、`src/build_index.py` で `docs/` 配下の静的ファイルを生成する構成です。

ローカルビルド:

```bash
python src/build_index.py
```

生成物は `docs/index.html` `docs/css/styles.css` `docs/css/types.css` `docs/js/app.js` です。

GitHub Actions でも `src/**` の更新時に自動で `docs/` 配下を再生成してコミットします。
