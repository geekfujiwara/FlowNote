# FlowNote – 未実装機能一覧

作成日: 2026-02-27

## 優先度: 高

| # | 機能 | 場所 | 状態 |
|---|------|------|------|
| 1 | **Ctrl+S 保存ショートカット** | `MarkdownEditor.tsx` に `keydown` listener 追加 | ✅ |
| 2 | **Undo/Redo ボタン** | `@codemirror/commands` の `undo`/`redo` を `ReactCodeMirrorRef.view` で呼び出し | ✅ |
| 3 | **新規ノートの永続化** | `newNote()` が `mockApi.saveNote` + `listNotes` を呼ぶよう修正 | ✅ |
| 4 | **見出し挿入の不具合** | `insertHeading` を末尾に `\n\n# 新しい見出し\n` を追記するよう修正 | ✅ |

## 優先度: 中

| # | 機能 | 場所 | 状態 |
|---|------|------|------|
| 5 | **タグ編集 UI** | チップ表示 + `+` ボタンで追加 / `×` で削除、`setTags` アクション実装 | ✅ |
| 6 | **チャット履歴クリア** | `clearChatMessages` アクション追加、ChatPanel ヘッダーにゴミ箱ボタン | ✅ |
| 7 | **ノートのエクスポート** | `handleExport` で Blob ダウンロード、EditorToolbar に Download ボタン追加 | ✅ |

## 優先度: 低 / 将来対応

| # | 機能 | 場所 | 状態 |
|---|------|------|------|
| 8 | **キャンバス上の Undo/Redo** | ノード追加・削除の取り消し履歴がない | ☐ |
| 9 | **ノートの複製** | サイドバーのコンテキストメニューで「複製」が実装されていない | ☐ |
| 10 | **SVG/PNG エクスポート** | キャンバスを画像としてエクスポートする機能がない | ☐ |

---

## 完了 (7/7 高・中優先度)

| # | 機能 | 実装内容 |
|---|------|----------|
| 1 | Ctrl+S 保存ショートカット | `MarkdownEditor.tsx` に `useEffect` で `keydown` listener |
| 2 | Undo/Redo ボタン | `ReactCodeMirrorRef` + `@codemirror/commands` |
| 3 | 新規ノートの永続化 | `newNote()` → `mockApi.saveNote` + `listNotes` |
| 4 | 見出し挿入の不具合修正 | 末尾追記に変更 |
| 5 | タグ編集 UI | チップ表示・追加・削除 |
| 6 | チャット履歴クリア | `Trash2` ボタンでワンクリッククリア |
| 7 | ノートのエクスポート | Markdown ファイルダウンロード |
